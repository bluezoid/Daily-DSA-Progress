import "server-only";
import { parseDocument } from "htmlparser2";
import { getOuterHTML } from "domutils";
import type { AnyNode, Element } from "domhandler";
import { isAllowedImageUrl, sanitizeStatementHtml } from "@/lib/sanitize";
import type { Difficulty } from "@/lib/constants";
import type { ProblemExample, ProblemImage } from "@/types/domain";

/** Raw question payload (from GraphQL or __NEXT_DATA__). */
export interface RawQuestion {
  questionId?: string | null;
  questionFrontendId?: string | null;
  title?: string | null;
  titleSlug?: string | null;
  content?: string | null;
  isPaidOnly?: boolean | null;
  difficulty?: string | null;
  topicTags?: { name?: string | null }[] | null;
  similarQuestions?: string | null;
}

export interface ParsedProblem {
  title: string;
  slug: string;
  problemNumber: string | null;
  sourceProblemId: string | null;
  difficulty: Difficulty;
  statement: string;
  examples: ProblemExample[];
  constraints: string[];
  followUps: string[];
  topics: string[];
  similarProblems: string[];
  images: ProblemImage[];
}

export const OPTIONAL_IMPORT_FIELDS = [
  "problemNumber",
  "difficulty",
  "statement",
  "examples",
  "constraints",
  "followUps",
  "topics",
  "similarProblems",
  "images",
] as const;

const BLOCK_TAGS = new Set(["p", "div", "li", "ul", "ol", "pre", "br", "h3", "h4", "h5", "tr", "blockquote"]);

const isElement = (n: AnyNode): n is Element => n.type === "tag" || n.type === "script" || n.type === "style";

/** Text with structure: blocks become newlines, <sup> becomes ^ (10<sup>4</sup> → 10^4). */
export function nodeText(node: AnyNode): string {
  if (node.type === "text") return (node as unknown as { data: string }).data;
  if (!isElement(node)) return "";
  if (node.name === "br") return "\n";
  if (node.name === "img") return "";
  const inner = node.children.map(nodeText).join("");
  if (node.name === "sup") return `^${inner}`;
  if (BLOCK_TAGS.has(node.name)) return `\n${inner}\n`;
  return inner;
}

const clean = (s: string) =>
  s
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

const oneLine = (s: string) => clean(s).replace(/\n+/g, " ");

function parseExampleText(text: string): ProblemExample | null {
  const t = clean(text);
  const m = /Input\s*:?\s*([\s\S]*?)\s*Output\s*:?\s*([\s\S]*?)(?:\s*Explanation\s*:?\s*([\s\S]*))?$/i.exec(t);
  if (!m) return null;
  return { input: m[1].trim(), output: m[2].trim(), explanation: (m[3] ?? "").trim() };
}

function normalizeDifficulty(d: string | null | undefined): Difficulty | null {
  const v = d?.toLowerCase();
  return v === "easy" || v === "medium" || v === "hard" ? v : null;
}

function parseSimilar(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as { title?: unknown }[];
    if (!Array.isArray(list)) return [];
    return list
      .map((q) => (typeof q?.title === "string" ? q.title.trim() : ""))
      .filter(Boolean)
      .slice(0, 50);
  } catch {
    return [];
  }
}

/** Splits LeetCode content HTML into statement / examples / constraints / follow-ups / images. */
export function parseContentHtml(contentHtml: string) {
  const sanitized = sanitizeStatementHtml(contentHtml);
  const doc = parseDocument(sanitized);

  const statementNodes: AnyNode[] = [];
  const examples: ProblemExample[] = [];
  const constraints: string[] = [];
  const followUps: string[] = [];
  let section: "statement" | "examples" | "constraints" | "followup" = "statement";
  let followBuf = "";

  const flushFollow = () => {
    const t = oneLine(followBuf);
    if (t) followUps.push(t);
    followBuf = "";
  };

  for (const node of doc.children) {
    const text = clean(nodeText(node));
    if (!text && !(isElement(node) && node.name === "img")) continue;

    if (/^Example\s*\d*\s*:?$/i.test(text)) {
      if (section === "followup") flushFollow();
      section = "examples";
      continue;
    }
    if (/^Constraints\s*:?/i.test(text)) {
      if (section === "followup") flushFollow();
      section = "constraints";
      const rest = text.replace(/^Constraints\s*:?/i, "").trim();
      if (rest) constraints.push(oneLine(rest));
      continue;
    }
    if (/^Follow[\s-]*up\b/i.test(text)) {
      if (section === "followup") flushFollow();
      section = "followup";
      followBuf = text.replace(/^Follow[\s-]*up\s*:?/i, "");
      continue;
    }

    switch (section) {
      case "statement":
        statementNodes.push(node);
        break;
      case "examples": {
        const ex = parseExampleText(text);
        if (ex) examples.push(ex);
        break;
      }
      case "constraints":
        if (isElement(node) && (node.name === "ul" || node.name === "ol")) {
          for (const li of node.children) {
            if (isElement(li) && li.name === "li") {
              const t = oneLine(nodeText(li));
              if (t) constraints.push(t);
            }
          }
        } else {
          constraints.push(oneLine(text));
        }
        break;
      case "followup":
        // Raw text keeps inline spacing intact ("O(n^2)?" not "O(n^2) ?").
        followBuf += nodeText(node);
        break;
    }
  }
  if (section === "followup") flushFollow();

  const images: ProblemImage[] = [];
  const seen = new Set<string>();
  const walk = (n: AnyNode) => {
    if (!isElement(n)) return;
    if (n.name === "img") {
      const src = n.attribs.src ?? "";
      if (isAllowedImageUrl(src) && !seen.has(src)) {
        seen.add(src);
        images.push({ url: src, alt: (n.attribs.alt ?? "").slice(0, 300) });
      }
    }
    n.children.forEach(walk);
  };
  doc.children.forEach(walk);

  // Drop trailing empty/nbsp paragraphs from the statement.
  const statement = statementNodes
    .map((n) => getOuterHTML(n))
    .join("")
    .replace(/(<p>(\s|&nbsp;| )*<\/p>\s*)+$/g, "")
    .trim();

  return {
    statement: sanitizeStatementHtml(statement),
    examples: examples.slice(0, 30),
    constraints: constraints.slice(0, 50),
    followUps: followUps.slice(0, 20),
    images: images.slice(0, 30),
  };
}

/** Converts a raw question into editable fields + the list of fields that were not found. */
export function parseQuestion(q: RawQuestion, fallbackSlug: string): { data: ParsedProblem; missingFields: string[] } {
  const content = q.content ? parseContentHtml(q.content) : null;
  const difficulty = normalizeDifficulty(q.difficulty);
  const data: ParsedProblem = {
    title: (q.title ?? "").trim(),
    slug: (q.titleSlug ?? fallbackSlug).trim(),
    problemNumber: q.questionFrontendId?.trim() || null,
    sourceProblemId: q.questionId?.trim() || null,
    difficulty: difficulty ?? "unknown",
    statement: content?.statement ?? "",
    examples: content?.examples ?? [],
    constraints: content?.constraints ?? [],
    followUps: content?.followUps ?? [],
    topics: (q.topicTags ?? []).map((t) => (t?.name ?? "").trim()).filter(Boolean).slice(0, 30),
    similarProblems: parseSimilar(q.similarQuestions),
    images: content?.images ?? [],
  };

  const missingFields: string[] = [];
  if (!data.title) missingFields.push("title");
  if (!data.problemNumber) missingFields.push("problemNumber");
  if (!difficulty) missingFields.push("difficulty");
  if (!data.statement) missingFields.push("statement");
  if (!data.examples.length) missingFields.push("examples");
  if (!data.constraints.length) missingFields.push("constraints");
  if (!data.followUps.length) missingFields.push("followUps");
  if (!data.topics.length) missingFields.push("topics");
  if (!data.similarProblems.length) missingFields.push("similarProblems");
  if (!data.images.length) missingFields.push("images");
  return { data, missingFields };
}

/** Finds the question object for `slug` anywhere inside a __NEXT_DATA__ payload. */
export function findQuestionInNextData(html: string, slug: string): RawQuestion | null {
  const m = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const stack: unknown[] = [data];
  let visited = 0;
  while (stack.length && visited < 50_000) {
    const cur = stack.pop();
    visited++;
    if (!cur || typeof cur !== "object") continue;
    const obj = cur as Record<string, unknown>;
    if (obj.titleSlug === slug && typeof obj.content === "string" && typeof obj.title === "string") {
      return obj as RawQuestion;
    }
    for (const v of Object.values(obj)) if (v && typeof v === "object") stack.push(v);
  }
  return null;
}
