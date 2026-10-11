import { describe, expect, it } from "vitest";
import { findQuestionInNextData, parseContentHtml, parseQuestion } from "@/services/leetcode/parser";
import { MOCK_QUESTION } from "@/services/leetcode/mock-fixture";
import { canonicalizeSourceUrl, parseLeetCodeUrl } from "@/services/leetcode/url";
import { sanitizeStatementHtml } from "@/lib/sanitize";

describe("parseQuestion", () => {
  const { data, missingFields } = parseQuestion(MOCK_QUESTION, "pair-target-indices");

  it("extracts metadata", () => {
    expect(data).toMatchObject({
      title: "Pair Target Indices",
      slug: "pair-target-indices",
      problemNumber: "9001",
      difficulty: "medium",
      topics: ["Array", "Hash Table"],
      similarProblems: ["Triple Target"],
    });
  });

  it("extracts both <pre> and example-block examples", () => {
    expect(data.examples).toEqual([
      { input: "values = [1,4,6], goal = 10", output: "[1,2]", explanation: "values[1] + values[2] == 10.", images: [] },
      { input: "values = [5,5], goal = 10", output: "[0,1]", explanation: "", images: [] },
    ]);
  });

  it("extracts constraints with superscripts and follow-ups", () => {
    expect(data.constraints).toEqual(["2 <= values.length <= 10^5", "Exactly one answer exists."]);
    expect(data.followUps).toEqual(["Can you do better than O(n^2)?"]);
  });

  it("keeps only the description in the statement and strips scripts", () => {
    expect(data.statement).toContain("return the indices");
    expect(data.statement).not.toContain("Example");
    expect(data.statement).not.toContain("Constraints");
    expect(data.statement).not.toMatch(/script|alert/);
  });

  it("collects allowed images with alt text", () => {
    expect(data.images).toEqual([{ url: "https://assets.leetcode.com/uploads/mock/diagram.png", alt: "Diagram of the array", width: 200 }]);
    expect(data.statement).toContain("https://assets.leetcode.com/uploads/mock/diagram.png");
  });

  it("reports only genuinely missing fields", () => {
    expect(missingFields).toEqual([]);
  });

  it("reports missing fields instead of inventing them", () => {
    const r = parseQuestion({ title: "Bare", content: "<p>Only text.</p>" }, "bare");
    expect(r.data.difficulty).toBe("unknown");
    expect(r.missingFields).toEqual(
      expect.arrayContaining(["problemNumber", "difficulty", "examples", "constraints", "topics", "followUps", "images"]),
    );
    expect(r.missingFields).not.toContain("statement");
  });
});

describe("example images", () => {
  const img = (name: string, w: number) =>
    `<img alt="" src="https://assets.leetcode.com/uploads/${name}.png" style="width: ${w}px; height: 90px; margin-top: 8px;" />`;

  it("attaches an image placed between the heading and <pre> to that example", () => {
    const html = [
      "<p>Detect a loop in the chain.</p>",
      '<p><strong class="example">Example 1:</strong></p>',
      img("loop-a", 300),
      "<pre>\n<strong>Input:</strong> nodes = [3,2,0,-4], at = 1\n<strong>Output:</strong> true\n</pre>",
      '<p><strong class="example">Example 2:</strong></p>',
      img("loop-b", 141),
      "<pre>\n<strong>Input:</strong> nodes = [1,2], at = 0\n<strong>Output:</strong> true\n</pre>",
      '<p><strong class="example">Example 3:</strong></p>',
      "<pre>\n<strong>Input:</strong> nodes = [1], at = -1\n<strong>Output:</strong> false\n</pre>",
      "<p><strong>Constraints:</strong></p><ul><li>n &gt;= 0</li></ul>",
    ].join("\n");
    const r = parseContentHtml(html);
    expect(r.examples.map((e) => e.images)).toEqual([
      [{ url: "https://assets.leetcode.com/uploads/loop-a.png", alt: "", width: 300 }],
      [{ url: "https://assets.leetcode.com/uploads/loop-b.png", alt: "", width: 141 }],
      [],
    ]);
    expect(r.statement).not.toContain("loop-a");
  });

  it("attaches images inside a newer example-block to that example", () => {
    const html =
      '<p>Traverse the tree.</p><p><strong class="example">Example 1:</strong></p>' +
      '<div class="example-block"><p><strong>Input:</strong> <span class="example-io">root = [1,null,2]</span></p>' +
      '<p><strong>Output:</strong> <span class="example-io">[1,2]</span></p><p><strong>Explanation:</strong></p>' +
      `<p>${img("tree", 200)}</p></div>`;
    const [ex] = parseContentHtml(html).examples;
    expect(ex.output).toBe("[1,2]");
    expect(ex.images).toEqual([{ url: "https://assets.leetcode.com/uploads/tree.png", alt: "", width: 200 }]);
  });
});

describe("sanitizeStatementHtml", () => {
  it("removes scripts, event handlers, javascript: links and foreign images", () => {
    const html = sanitizeStatementHtml(
      '<p onclick="x()">Hi<script>alert(1)</script><a href="javascript:alert(1)">l</a>' +
        '<img src="https://evil.example/p.png"><img src="https://assets.leetcode.com/a.png" onerror="x()"></p><iframe src="https://x"></iframe>',
    );
    expect(html).not.toMatch(/onclick|onerror|script|javascript|evil|iframe/);
    expect(html).toContain('src="https://assets.leetcode.com/a.png"');
  });
});

describe("parseContentHtml", () => {
  it("handles content with no sections", () => {
    const r = parseContentHtml("<p>Just a statement.</p>");
    expect(r.statement).toBe("<p>Just a statement.</p>");
    expect(r.examples).toEqual([]);
  });
});

describe("findQuestionInNextData", () => {
  it("finds the question in embedded page data", () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { dehydratedState: { queries: [{ state: { data: { question: { ...MOCK_QUESTION } } } }] } } },
    }).replace(/</g, "\\u003c")}</script></html>`;
    expect(findQuestionInNextData(html, "pair-target-indices")?.title).toBe("Pair Target Indices");
    expect(findQuestionInNextData(html, "other")).toBeNull();
    expect(findQuestionInNextData("<html></html>", "x")).toBeNull();
  });
});

describe("LeetCode URLs", () => {
  it.each([
    ["https://leetcode.com/problems/two-sum/", "two-sum"],
    ["https://www.leetcode.com/problems/two-sum/description/?envType=x", "two-sum"],
    ["http://leetcode.com/problems/Two-Sum", "two-sum"],
  ])("accepts %s", (url, slug) => {
    expect(parseLeetCodeUrl(url)).toEqual({ slug, canonicalUrl: `https://leetcode.com/problems/${slug}/` });
  });

  it.each([
    "https://leetcode.com.evil.com/problems/two-sum/",
    "https://evil.com/problems/two-sum/",
    "https://leetcode.com/contest/weekly/",
    "https://user:pw@leetcode.com/problems/two-sum/",
    "https://leetcode.com:8443/problems/two-sum/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://127.0.0.1/problems/two-sum/",
    "not a url",
  ])("rejects %s", (url) => {
    expect(parseLeetCodeUrl(url)).toBeNull();
  });

  it("canonicalizes other source URLs for duplicate detection", () => {
    expect(canonicalizeSourceUrl("https://www.HackerRank.com/challenges/x/#top")).toBe("https://hackerrank.com/challenges/x");
    expect(canonicalizeSourceUrl("https://leetcode.com/problems/two-sum/solutions/")).toBe("https://leetcode.com/problems/two-sum/");
    expect(canonicalizeSourceUrl(null)).toBeNull();
  });
});
