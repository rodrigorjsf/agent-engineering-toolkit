---
paths:
  - "README.md"
  - "plugins/*/README.md"
  - "skills/README.md"
---

# README File Conventions

- Every README must include `## Cost and Model Guidance` as section 2 (immediately after the title and description paragraph) with standard wording about model cost, execution frequency, and one-time investment framing
- Root `README.md` covers repo-level content only — per-plugin skill detail belongs in plugin READMEs, not root; reference plugin READMEs with links
- Root README installation section contains one-liners per distribution, each ending with a link to the respective plugin README for full detail
- Per-plugin READMEs cover only their own distribution — no content from other plugins
- `skills/README.md` covers standalone distribution only — `init-cursor` and `improve-cursor` are plugin-only and must not appear here
- Root README line budget: ≤ 200 lines; per-plugin READMEs: ≤ 400 lines
- All skill invocation examples must use the correct namespace prefix for plugin distributions (e.g., `/agents-initializer:init-claude`)
- Installation commands must match the `name` field in the corresponding `plugin.json` manifest
