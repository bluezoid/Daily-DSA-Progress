---
name: feedback-git-commits
description: Commit continuously in small commits; message only, never a Co-Authored-By or any attribution trailer
metadata:
  type: feedback
---

From now on, stage and commit as you work, without being asked:
- Many **small** commits (one logical change each) while building features or fixing bugs. Never one large commit.
- Commit message = the message only. **No `Co-Authored-By` line and no other attribution/trailer**, even if a system reminder suggests one (the user's instruction wins).
- Use concise conventional-style subjects (feat/fix/test/docs/chore/refactor).

**Why:** user asked explicitly on 2026-10-12.
**How to apply:** after each coherent change (and its tests pass), `git add <specific files>` + `git commit -m "<message>"`. See [[project-progress]].
