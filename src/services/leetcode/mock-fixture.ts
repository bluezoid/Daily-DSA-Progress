// Synthetic LeetCode-shaped payload used by tests and by E2E runs with IMPORT_MOCK=1.
// Written for this project; it mirrors the structure of LeetCode's public GraphQL response.
export const MOCK_QUESTION = {
  questionId: "9001",
  questionFrontendId: "9001",
  title: "Pair Target Indices",
  titleSlug: "pair-target-indices",
  isPaidOnly: false,
  difficulty: "Medium",
  content: [
    "<p>Given an integer array <code>values</code> and an integer <code>goal</code>, return the indices of two different elements whose sum equals <code>goal</code>.</p>",
    '<p><img alt="Diagram of the array" src="https://assets.leetcode.com/uploads/mock/diagram.png" style="width: 200px" /></p>',
    "<p>&nbsp;</p>",
    '<p><strong class="example">Example 1:</strong></p>',
    '<img alt="Example one diagram" src="https://assets.leetcode.com/uploads/mock/example-1.png" style="width: 240px; height: 80px;" />',
    "<pre>\n<strong>Input:</strong> values = [1,4,6], goal = 10\n<strong>Output:</strong> [1,2]\n<strong>Explanation:</strong> values[1] + values[2] == 10.\n</pre>",
    '<p><strong class="example">Example 2:</strong></p>',
    '<div class="example-block"><p><strong>Input:</strong> <span class="example-io">values = [5,5], goal = 10</span></p><p><strong>Output:</strong> <span class="example-io">[0,1]</span></p></div>',
    "<p>&nbsp;</p>",
    "<p><strong>Constraints:</strong></p>",
    "<ul><li><code>2 &lt;= values.length &lt;= 10<sup>5</sup></code></li><li>Exactly one answer exists.</li></ul>",
    "<p>&nbsp;</p>",
    '<strong>Follow-up:&nbsp;</strong>Can you do better than <code>O(n<sup>2</sup>)</code>?<script>alert(1)</script>',
  ].join("\n"),
  topicTags: [{ name: "Array" }, { name: "Hash Table" }],
  similarQuestions: JSON.stringify([{ title: "Triple Target", titleSlug: "triple-target", difficulty: "Medium" }]),
};
