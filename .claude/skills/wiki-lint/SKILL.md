---
name: wiki-lint
description: 'Lint `wiki/knowledge/` for contradictions, orphans, broken `[[links]]`, stale claims. Use for explicit audits or after large `wiki-ingest` runs.'
---

# Wiki Lint

Mechanizes the health-check loop from ADR-0004 (Karpathy "LLM Knowledge Bases" methodology). Audits the curated `wiki/knowledge/` knowledge base for integrity issues and reports a numbered findings list with suggested fixes.

## Inputs

- **Scope** — defaults to `wiki/knowledge/**/*.md`. The user may pass `$ARGUMENTS` (e.g., a single page, a directory) to narrow scope.
- **Wiki conventions** — `wiki/CLAUDE.md` § Page format and § Citation rules are the authority.

## Invariants

- **No auto-fix on wiki pages.** This skill never modifies files in `wiki/knowledge/*.md` without explicit per-finding consent.
- **Audit log is the only sanctioned write.** Step 5 appends a single dated entry to `wiki/knowledge/log.md` unconditionally — that is the *only* file this skill writes without confirmation.
- **Findings are evidence-cited.** Every finding lists the file path and line range that triggers it, plus a suggested fix.
- **Severity is meaningful.** P0 = breaks lookup (e.g., missing `index.md` entry, dangling `[[link]]`). P1 = degrades quality (orphan, missing backlink, format drift). P2 = stylistic.

## Checks

### 1. Format compliance

Every page in scope must have:

- A title (`# Page Title`)
- Frontmatter prose: `**Summary**:`, `**Sources**:`, `**Last updated**:`
- A `---` separator after frontmatter
- A `## Related pages` section near the end (at least one entry, unless the page is intentionally terminal — flag and ask)

Report: pages missing any of the above.

### 2. Index hygiene

- Every page in `wiki/knowledge/*.md` must appear in `wiki/knowledge/index.md` under one of its topical groups.
- Every entry in `index.md` must point to an existing file.
- Index entry summaries must roughly match the actual page `**Summary**:` (not a stale summary from a prior version).

Report: pages missing from index, dead index entries, drift between index summary and page summary.

### 3. Cross-link integrity

- Every `[[wiki-link]]` must resolve to an existing page (`<slug>.md`).
- Bidirectional relationships (where the relationship is symmetric) must show up in both pages' `## Related pages`. Asymmetric is allowed but should be deliberate, not accidental.
- Pages with **zero inbound** links from other wiki pages are **orphans** — flag P1 unless the page is documented as intentionally standalone.

Report: dangling links (P0), missing back-references (P1), orphan pages (P1).

### 4. Citation coverage

- Factual claims should carry a `(source: <filename>)` reference.
- Claims without a source are flagged for verification or removal.
- `**Sources**:` frontmatter must list every source actually cited in the body — drift between the frontmatter and inline citations is a finding.

Report: uncited claims (P1), source-frontmatter drift (P2).

### 5. Contradiction detection

- Cross-read related pages (those linked via `[[wiki-link]]` or sharing a `**Sources**:` entry) and surface direct contradictions in factual claims.
- When a contradiction is found, list both pages, both quotes, and the source(s) — let the user resolve.

Report: contradiction set (P1).

### 6. Concept-gap detection

- Scan page bodies for **bold or repeatedly-mentioned terms** that are not themselves wiki pages and are not generic English.
- These are candidates for new concept pages — list them with their first occurrence so the user (or `/wiki-ingest`) can act.

Report: missing concept candidates (P2 — opportunity, not error).

### 7. Stale-claim heuristics

- Compare `**Last updated**:` against the modification timestamps of cited sources. If a source has changed since the wiki page was updated and the page makes specific factual claims, flag for re-review.
- Pages whose `**Last updated**:` is more than 6 months old AND whose sources have moved on are candidates.

Report: stale candidates (P2).

## Process

### 1. Confirm scope with the user

If `$ARGUMENTS` is empty, default to the full wiki. If it is a path, restrict checks to that path and any pages it links to. Report the scope back before running.

### 2. Run the checks

Run them in the order listed. Use `Read`, `Glob`, `Grep` — do not require external tooling. The first three checks are mechanical; checks 5–7 require reasoning across pages.

### 3. Generate the findings report

Produce a numbered list grouped by severity (P0 → P1 → P2). For each finding:

```
[P1-3] orphan page: wiki/knowledge/persuasion-in-ai.md
  Evidence: zero inbound [[wiki-link]] references found across the wiki.
  Suggested fix: link from [[context-engineering]] under Related pages, or document as intentionally standalone in the page body.
```

### 4. Offer remediation, do not auto-fix

After the report, ask the user which findings to act on. The user may delegate `/wiki-ingest` for ingestion-driven fixes, or ask for direct edits per finding. **Never modify wiki pages in this skill without explicit per-finding consent.**

### 5. Append a lint entry to `wiki/knowledge/log.md`

Append a dated entry summarizing what was checked, finding counts per severity, and which findings the user chose to act on (or deferred). The log is the audit trail.

## When to defer or escalate

- **Large lint runs (50+ findings).** Group by category and offer the user a triage view rather than a flat list.
- **Ambiguous "stale" calls.** When you cannot tell whether a page is stale or the upstream source moved on cosmetically, ask before flagging.
- **Disagreements between the wiki and `docs/`.** Surface, do not resolve. The user is the arbiter — `docs/` is immutable raw input, but the wiki is allowed to interpret it.

## Related artifacts

- ADR-0004 — methodology, including the future search-CLI and synthetic-data extensions reserved for later
- `.claude/rules/wiki-routing.md` — the lookup contract this skill protects
- `wiki/CLAUDE.md` — page format and citation rules (authority for checks 1 and 4)
- `/wiki-ingest` (skill `wiki-ingest`) — the ingest counterpart; lint findings often suggest ingest work
