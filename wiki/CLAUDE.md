# LLM Wiki

The canonical knowledge base for this repo, maintained by Claude Code.
Based on Andrej Karpathy's "LLM Knowledge Bases" pattern (see ADR-0004).
Wiki-first lookup is the contract for every agent in this repo (see `.claude/rules/wiki-routing.md`).

## Folder structure

```text
docs/                   -- source documents (vendor-doc mirrors are living; all else immutable -- see ADR-0010)
wiki/                   -- root wiki folder
wiki/knowledge          -- markdown pages maintained by Claude
wiki/knowledge/index.md -- table of contents for the entire wiki
wiki/knowledge/log.md   -- append-only record of all operations
```

## Page format

Every wiki knowledge page should follow this structure:

```markdown
# Page Title

**Summary**: One to two sentences describing this page.
**Sources**: List of raw source files this page draws from.
**Last updated**: Date of most recent update.
---

Main content goes here. Use clear headings and short paragraphs.

Link to related concepts using [[knowledge-links]] throughout the text.

## Related pages

- [[related-concept-1]]
- [[related-concept-2]]
```

## Citation rules

- Every factual claim should reference its source file
- Use the format `(source: filename.pdf)` after the claim
- If two sources disagree, note the contradiction explicitly
- If a claim has no source, mark it as needing verification

## Rules

- Never modify `docs/` artifacts, except the vendor-documentation mirrors `docs/claude/`, `docs/claude-code/`, `docs/cursor/`, which are re-synced against upstream — see [ADR-0010](../docs/adr/0010-vendor-doc-mirrors-are-living.md)
- Always update `wiki/knowledge/index.md` and `wiki/knowledge/log.md` after substantive changes
- Keep page names lowercase with hyphens (e.g. `machine-learning.md`)
- Write in clear, plain language
- When uncertain about how to categorize something, ask the user

## Workflows

This file is the authority on **page format** and **citation rules**. Workflows are owned by dedicated skills:

- **Ingest** — `/wiki-ingest <docs/path>` (skill `wiki-ingest`) compiles a source document into the wiki
- **Lint / audit** — `/wiki-lint` (skill `wiki-lint`) runs health checks and reports findings
- **Q&A** — driven by `.claude/rules/wiki-routing.md` (read `index.md` → specific page → `docs/` fallback). Good answers should be filed back into the wiki via `/wiki-ingest` so knowledge compounds.
