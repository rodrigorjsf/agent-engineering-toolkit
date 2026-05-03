---
paths:
  - "wiki/**/*.md"
  - "docs/**/*.md"
  - "plugins/*/skills/*/SKILL.md"
  - "skills/*/SKILL.md"
  - ".claude/skills/*/SKILL.md"
  - ".github/instructions/**/*.md"
---

# Wiki-First Knowledge Lookup

Search project knowledge in this order — stop when the answer is sufficient:

1. **Wiki index** (`wiki/knowledge/index.md`) — table of contents grouped by topic. Read this first to find candidate pages.
2. **Wiki page** (`wiki/knowledge/<slug>.md`) — read the specific page(s) the index points at, and follow `[[wiki-link]]` cross-references when relevant.
3. **Source documents** (`docs/`) — only when the wiki lacks coverage. Treat `docs/` as immutable raw input; never edit it.

When wiki coverage is incomplete, prefer creating or updating a wiki page (via the `wiki-ingest` or direct edits) over adding instructions that re-read `docs/` repeatedly.

- Cite wiki pages by slug in answers: e.g., `[[claude-code-skills]]`, not the file path.
- After substantive edits to `wiki/knowledge/*.md`, update `wiki/knowledge/index.md` and append an entry to `wiki/knowledge/log.md`.
- Page format and citation rules live in `wiki/CLAUDE.md`; this rule is the routing contract only.
