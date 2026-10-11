import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now();
const alice = { name: "Alice Tester", email: `alice-${stamp}@example.com`, password: "alice-password-1" };
const bob = { name: "Bob Other", email: `bob-${stamp}@example.com`, password: "bob-password-12" };

async function register(page: Page, u: typeof alice) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(u.name);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password").fill(u.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function pickOption(page: Page, trigger: string, option: string | RegExp) {
  await page.getByLabel(trigger, { exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}

async function addSolution(page: Page, problemUrl: string, language: string, label: string, code: string) {
  await page.goto(`${problemUrl}/solutions/new`);
  await pickOption(page, "Language", language);
  await page.getByLabel("Version label").fill(label);
  await page.getByLabel("Code").fill(code);
  await page.getByLabel("Time complexity").fill("O(n)");
  await page.getByRole("button", { name: "Save solution" }).click();
  await expect(page).toHaveURL(new RegExp(`${problemUrl}(#solutions)?$`));
  await expect(page.getByRole("tab", { name: new RegExp(label.replace(/[+]/g, "\\+")) })).toBeVisible();
}

test("full workflow: manual problem, solutions, revision, library, import, isolation", async ({ page, browser }) => {
  // 1. Register (also logs in).
  await register(page, alice);
  await expect(page.getByText("Welcome, Alice")).toBeVisible();

  // Sign out and back in to exercise login.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(alice.email);
  await page.getByLabel("Password").fill(alice.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // 2-3. Manual problem without URL, with a priority.
  await page.goto("/problems/new");
  await page.getByLabel("Title").fill("Longest Increasing Subsequence (book)");
  await pickOption(page, "Source", "Book");
  await pickOption(page, "Difficulty", "Medium");
  await pickOption(page, "Priority", /^9/);
  await page.getByLabel("Topics").fill("Dynamic Programming, Binary Search");
  await page.getByRole("button", { name: "Save problem" }).click();
  await expect(page).toHaveURL(/\/problems\/[a-f0-9]{24}$/);
  const problemUrl = new URL(page.url()).pathname;
  const problemId = problemUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Longest Increasing Subsequence");
  await expect(page.getByLabel("Priority 9 of 10, high").first()).toBeVisible();
  await expect(page.getByText("No solutions yet")).toBeVisible();

  // 4. Two solution versions in different languages.
  await addSolution(page, problemUrl, "Python", "Python DP", "def lis(a):\n    return 0");
  await addSolution(page, problemUrl, "C++", "C++ patience", "int lis(){ return 0; }");
  await expect(page.getByRole("tab", { name: /Python DP/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /C\+\+ patience/ })).toBeVisible();

  // 5. Mark the C++ version as preferred.
  await page.getByRole("tab", { name: /C\+\+ patience/ }).click();
  await page.getByRole("tabpanel").getByRole("button", { name: "Mark preferred" }).click();
  await expect(page.getByRole("tab", { name: /^Preferred\s*C\+\+ patience/ })).toBeVisible();

  // 6. Compare versions.
  await page.getByRole("link", { name: "Compare" }).click();
  await expect(page.getByRole("heading", { name: "Compare solutions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Python DP" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "C++ patience" })).toBeVisible();

  // 7-8. Manual revision with hidden solution; verify the next date.
  await page.goto(problemUrl);
  await page.getByRole("tab", { name: /Python DP/ }).click();
  await page.getByRole("tabpanel").getByRole("link", { name: "Revise now" }).click();
  await expect(page).toHaveURL(/\/revise\/[a-f0-9]{24}\?mode=manual/);
  await expect(page.getByText("Hidden. Try the problem on your own first")).toBeVisible();
  await page.getByRole("button", { name: "Reveal solution" }).click();
  await expect(page.locator("#saved-solution").getByText("def lis(a):")).toBeVisible();
  await page.getByText("Solved independently").click();
  await page.getByRole("radio", { name: /4\s*Good/ }).click();
  await page.getByLabel(/Notes/).fill("Remembered the tails array");
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(page.getByRole("heading", { name: "Revision recorded" })).toBeVisible();
  await expect(page.getByText(/in 3 days/)).toBeVisible();
  await page.goto(problemUrl);
  await page.getByRole("tab", { name: /Python DP/ }).click();
  await expect(page.getByRole("tabpanel").getByText("Remembered the tails array")).toBeVisible();

  // 9. Library: search, filter, sort, paginate. Seed extra problems through the API (same session cookie).
  for (let i = 1; i <= 22; i++) {
    const res = await page.request.post("/api/problems", {
      headers: { origin: new URL(page.url()).origin },
      data: { title: `Seed problem ${String(i).padStart(2, "0")}`, sourceType: i % 2 ? "codeforces" : "hackerrank", difficulty: i % 3 ? "easy" : "hard", priorityScore: (i % 10) + 1 },
    });
    expect(res.status()).toBe(201);
  }
  await page.goto("/problems");
  await expect(page.getByText("23 problems")).toBeVisible();
  await page.getByLabel("Search problems").fill("increasing");
  await expect(page).toHaveURL(/q=increasing/);
  await expect(page.getByText("1 problem match your filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page.getByText("23 problems")).toBeVisible();

  await page.getByRole("button", { name: /Filters/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Codeforces").check();
  await sheet.getByLabel("Hard", { exact: true }).check();
  await sheet.getByRole("button", { name: "Show results" }).click();
  await expect(page).toHaveURL(/source=codeforces/);
  await expect(page).toHaveURL(/difficulty=hard/);
  // Codeforces = odd i; hard = i % 3 == 0 → 3, 9, 15, 21
  await expect(page.getByText("4 problems match your filters")).toBeVisible();
  await page.getByRole("button", { name: "Remove filter Hard" }).click();
  await expect(page.getByText("11 problems match your filters")).toBeVisible();
  await page.goBack();
  await expect(page.getByText("4 problems match your filters")).toBeVisible();

  await page.goto("/problems?sort=priority_desc");
  await expect(page.getByText("23 problems")).toBeVisible();
  await expect(page.getByText("page 1 of 2")).toBeVisible();
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/sort=priority_desc/);
  await expect(page.getByText("page 2 of 2")).toBeVisible();

  // 10. Import a (mocked) LeetCode problem.
  await page.goto("/problems/import");
  await page.getByLabel("LeetCode problem URL").fill("https://leetcode.com/problems/pair-target-indices/");
  await page.getByRole("button", { name: "Fetch problem" }).click();
  await expect(page.getByText(/Fetched “Pair Target Indices”/)).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Pair Target Indices");
  await pickOption(page, "Priority", /^8/);
  await page.getByRole("button", { name: "Save problem" }).click();
  await expect(page).toHaveURL(/\/problems\/[a-f0-9]{24}$/);
  await expect(page.getByText("2 <= values.length <= 10^5")).toBeVisible();
  await expect(page.getByText("Imported from LeetCode")).toBeVisible();

  // Importing again flags the duplicate.
  await page.goto("/problems/import");
  await page.getByLabel("LeetCode problem URL").fill("https://leetcode.com/problems/pair-target-indices/description/");
  await page.getByRole("button", { name: "Fetch problem" }).click();
  await expect(page.getByText("Already in your library")).toBeVisible();

  // 11. Another user cannot see any of it.
  const other = await browser.newContext();
  const bobPage = await other.newPage();
  await register(bobPage, bob);
  // Pages stream (status is committed before the ownership check), so assert the
  // rendered not-found UI and that nothing of Alice's leaks; the API returns a real 404.
  await bobPage.goto(`/problems/${problemId}`);
  await expect(bobPage.getByRole("heading", { name: "Not found" })).toBeVisible();
  expect(await bobPage.content()).not.toContain("Longest Increasing Subsequence");
  const api = await bobPage.request.get(`/api/problems/${problemId}`);
  expect(api.status()).toBe(404);
  await bobPage.goto("/problems");
  await expect(bobPage.getByText("Your library is empty")).toBeVisible();
  await other.close();
});

test("protected pages redirect to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});
