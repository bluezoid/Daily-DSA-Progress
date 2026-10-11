---
name: feedback-memory-location
description: User wants all project memory stored inside the project's .claude directory
metadata:
  type: feedback
---

Store all memory for this project under `./.claude/memory/` (index: `.claude/memory/MEMORY.md`), not elsewhere.

**Why:** user explicitly asked: "Create your memory with .claude dir to store all the memory."
**How to apply:** new memories → new file in `.claude/memory/` + one line in its MEMORY.md. See [[project-overview]].
