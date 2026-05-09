---
name: wiki-ingest
description: 'Compile a `docs/` source file into `wiki/knowledge/` (summary, cross-links, index). Use to ingest a doc into the wiki, not for casual reads.'
---

# Wiki Ingest

Mechanizes the data-ingest loop from ADR-0004 (Karpathy "LLM Knowledge Bases" methodology). Reads an immutable source document under `docs/` and compiles it into the curated `wiki/knowledge/` knowledge base — summary page, concept pages, backlinks, index, and log.

## Inputs

- **Source path** — required. A file or directory under `docs/`. Passed as `$ARGUMENTS` (e.g., `docs/agentic-engineering/research-plan-implement-rpi.md`) or asked from the user when omitted.
- **Wiki state** — `wiki/knowledge/index.md` and `wiki/knowledge/log.md` for current page inventory.

## Invariants

- **Never edit `docs/`.** It is the immutable raw layer. If the source is wrong, the user fixes it manually; ingest does not "correct" sources.
- **Lowercase-hyphen page names.** `claude-code-skills.md`, not `ClaudeCodeSkills.md`.
- **Every page has Summary + Sources + Last updated frontmatter prose** per `wiki/CLAUDE.md` § Page format.
- **Every factual claim cites its source.** Use `(source: <filename>)` after the claim.
- **`[[wiki-link]]` cross-references** connect related pages. Link aggressively; orphan pages are a lint failure.

## Process

### 1. Read the source in full

Read the file at the given path. Do not skim. If it is a directory, list and read each `.md`/`.pdf` inside.

### 2. Surface key takeaways with the user

Before writing anything, summarize back to the user:

- Top 3-5 ideas worth a wiki page
- Which existing wiki pages should this source extend (vs. new pages to create)
- Open questions or contradictions noticed against existing wiki content

Wait for the user to confirm or steer. **Do not write wiki files yet.**

### 3. Create or update the per-source summary page

Add a page named after the source file slug (e.g., `wiki/knowledge/research-plan-implement-rpi.md`) following `wiki/CLAUDE.md` § Page format. Frontmatter prose:

```markdown
# <Title>

**Summary**: <One or two sentences>.
**Sources**: <docs/path/to/source.md>
**Last updated**: <YYYY-MM-DD>

---

<Body with [[wiki-link]] cross-references and (source: filename) citations>

## Related pages

- [[related-concept-1]]
- [[related-concept-2]]
```

If the source already has a summary page, update in place — bump `Last updated`, preserve unrelated body content.

### 4. Create or update concept pages

For each major idea identified in step 2, ensure there is a dedicated concept page (`wiki/knowledge/<concept>.md`). New page: same format as step 3. Existing page: integrate the new claims, citing the new source alongside any existing sources.

A single source typically touches 5-15 wiki pages. That is normal.

### 5. Add cross-references both directions

For every `[[wiki-link]]` you place into a page, ensure the linked target also references back from its `## Related pages` section if the relationship is bidirectional. Asymmetric links create orphans that `/wiki-lint` will flag.

### 6. Update `wiki/knowledge/index.md`

Add new pages to the appropriate topical group with a one-line summary. Update existing entries if their summary changed materially. The index is the routing surface for every agent in this repo (per `.claude/rules/wiki-routing.md`); it must stay accurate.

### 7. Append to `wiki/knowledge/log.md`

Append (not edit-in-place) a dated entry at the top of the log with:

- Date (`YYYY-MM-DD`)
- Source ingested
- Pages created vs. updated
- Notable cross-link decisions or unresolved tensions surfaced for follow-up

### 8. Report back

Tell the user:

- Pages created (with slugs)
- Pages updated (with slugs)
- Open questions surfaced for the user to resolve manually
- Suggested next ingestion candidates if related sources exist in `docs/`

## When to defer or escalate

- **Ambiguous categorization.** If a concept could plausibly belong in multiple existing pages, ask the user before splitting/merging.
- **Conflicts with existing content.** If the new source contradicts a claim already in the wiki, surface the contradiction explicitly in the per-source summary page and flag it in the log entry. Do not silently overwrite.
- **Source outside `docs/`.** Reject. Sources must live under `docs/` (see `wiki/CLAUDE.md`). If the user wants to ingest something else, they must add it to `docs/` first.

## Related artifacts

- ADR-0004 — methodology and the future search-CLI / synthetic-data extensions reserved for later
- `.claude/rules/wiki-routing.md` — the global lookup contract this skill maintains
- `wiki/CLAUDE.md` — page format, citation rules, and lint criteria
- `/wiki-lint` (skill `wiki-lint`) — health check after ingest if many pages were touched
