import "server-only";
import { parseLeetCodeUrl, LEETCODE_HOSTS } from "./url";
import { findQuestionInNextData, parseQuestion, type ParsedProblem, type RawQuestion } from "./parser";
import { safeFetch, SafeFetchError, type SafeFetchOptions, type SafeResponse } from "./safe-fetch";
import { MOCK_QUESTION } from "./mock-fixture";

export type ImportFailureReason =
  | "invalid_url"
  | "not_found"
  | "premium"
  | "blocked"
  | "timeout"
  | "too_large"
  | "upstream_error";

export type ImportResult =
  | {
      ok: true;
      slug: string;
      canonicalUrl: string;
      data: ParsedProblem;
      missingFields: string[];
      via: "graphql" | "page";
    }
  | { ok: false; reason: ImportFailureReason; message: string; slug: string | null; canonicalUrl: string | null };

export type Fetcher = (url: string, opts: SafeFetchOptions) => Promise<SafeResponse>;

const GRAPHQL_URL = "https://leetcode.com/graphql";
const QUERY = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId questionFrontendId title titleSlug content isPaidOnly difficulty
    topicTags { name }
    similarQuestions
  }
}`;

const MESSAGES: Record<ImportFailureReason, string> = {
  invalid_url: "Enter a LeetCode problem URL like https://leetcode.com/problems/two-sum/",
  not_found: "LeetCode has no public problem at this URL.",
  premium: "This is a LeetCode Premium problem. Its content is not publicly available, so enter it manually.",
  blocked: "LeetCode refused the request (rate limit or bot protection). Enter the problem manually or try again later.",
  timeout: "LeetCode took too long to respond. Try again, or enter the problem manually.",
  too_large: "LeetCode's response was larger than allowed.",
  upstream_error: "Could not read the problem from LeetCode. Enter it manually instead.",
};

const fail = (reason: ImportFailureReason, slug: string | null, canonicalUrl: string | null): ImportResult => ({
  ok: false,
  reason,
  message: MESSAGES[reason],
  slug,
  canonicalUrl,
});

function looksBlocked(res: SafeResponse) {
  if ([403, 429, 503].includes(res.status)) return true;
  return /cf-chl|challenge-platform|Just a moment\.\.\./i.test(res.body.slice(0, 5_000));
}

function mapFetchError(err: unknown): ImportFailureReason {
  if (err instanceof SafeFetchError) {
    if (err.kind === "timeout") return "timeout";
    if (err.kind === "too_large") return "too_large";
    if (err.kind === "blocked_host" || err.kind === "private_address" || err.kind === "too_many_redirects") return "blocked";
  }
  return "upstream_error";
}

const mockFetcher: Fetcher = async (url) => {
  if (url === GRAPHQL_URL) {
    return { status: 200, headers: {}, url, body: JSON.stringify({ data: { question: MOCK_QUESTION } }) };
  }
  return { status: 404, headers: {}, url, body: "" };
};

/** Real network fetcher unless IMPORT_MOCK=1 outside production (used by E2E tests). */
export function defaultFetcher(): Fetcher {
  if (process.env.IMPORT_MOCK === "1" && process.env.NODE_ENV !== "production") return mockFetcher;
  return (url, opts) => safeFetch(url, opts);
}

/**
 * Fetches public problem data for a LeetCode URL. Never fabricates fields: anything
 * not present upstream is reported in `missingFields`.
 */
export async function previewLeetCodeImport(input: string, fetcher: Fetcher = defaultFetcher()): Promise<ImportResult> {
  const parsed = parseLeetCodeUrl(input);
  if (!parsed) return fail("invalid_url", null, null);
  const { slug, canonicalUrl } = parsed;

  const baseOpts = {
    allowedHosts: LEETCODE_HOSTS,
    timeoutMs: 8_000,
    maxBytes: 2 * 1024 * 1024,
    maxRedirects: 3,
  } satisfies SafeFetchOptions;
  const headers = {
    "user-agent": "DailyDSAProgress/1.0 (personal study tracker)",
    referer: canonicalUrl,
  };

  // 1) Public GraphQL endpoint.
  let question: RawQuestion | null | undefined;
  let graphqlFailure: ImportFailureReason | null = null;
  try {
    const res = await fetcher(GRAPHQL_URL, {
      ...baseOpts,
      method: "POST",
      headers: { ...headers, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { titleSlug: slug }, operationName: "questionData" }),
    });
    if (looksBlocked(res)) graphqlFailure = "blocked";
    else if (res.status === 200) {
      const json = JSON.parse(res.body) as { data?: { question?: RawQuestion | null } };
      question = json?.data?.question;
      if (question === null) return fail("not_found", slug, canonicalUrl);
    } else graphqlFailure = "upstream_error";
  } catch (err) {
    graphqlFailure = err instanceof SyntaxError ? "upstream_error" : mapFetchError(err);
  }

  // 2) Fallback: structured data embedded in the public problem page.
  let via: "graphql" | "page" = "graphql";
  if (!question && graphqlFailure !== "timeout") {
    try {
      const res = await fetcher(canonicalUrl, { ...baseOpts, method: "GET", headers: { ...headers, accept: "text/html" } });
      if (looksBlocked(res)) graphqlFailure ??= "blocked";
      else if (res.status === 404) return fail("not_found", slug, canonicalUrl);
      else if (res.status === 200) {
        question = findQuestionInNextData(res.body, slug);
        if (question) via = "page";
      }
    } catch (err) {
      graphqlFailure ??= mapFetchError(err);
    }
  }

  if (!question) return fail(graphqlFailure ?? "upstream_error", slug, canonicalUrl);
  if (question.isPaidOnly && !question.content) return fail("premium", slug, canonicalUrl);

  const { data, missingFields } = parseQuestion(question, slug);
  if (!data.title) return fail("upstream_error", slug, canonicalUrl);
  return { ok: true, slug, canonicalUrl, data, missingFields, via };
}
