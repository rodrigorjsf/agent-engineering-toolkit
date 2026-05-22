# Vendor-documentation mirrors are living, not immutable

**Status**: accepted — amends [ADR-0004](0004-wiki-first-knowledge-base-replaces-rag.md)

ADR-0004 cast all of `docs/` as Karpathy's immutable `raw/` layer. That holds for research
papers, posts, and other point-in-time artifacts, but not for the subdirectories that mirror
official vendor documentation — `docs/claude/`, `docs/claude-code/`, and `docs/cursor/`.
Vendor docs are continuously revised upstream; a frozen mirror silently rots, and the project
already carried `docs-drift-manifest.md` files acknowledging the drift without ever deciding
what to do once drift became material. We decided those three directories are **living
mirrors**: re-synced against their upstream sources when drift is material (e.g. via the
`/grill-with-docs` docs-sync workflow). The immutability invariant still applies to every
other artifact under `docs/`.

## Considered alternative

Keep `docs/` fully immutable and push all freshness into `wiki/knowledge/` only. Rejected:
the literal request was to refresh both layers, and leaving degraded/stale vendor mirrors in
place makes the `docs/` fallback actively misleading when the wiki lacks coverage.

## Consequences

- Re-syncing a vendor-doc mirror shifts its line numbers, which invalidates line-range
  citations in `docs/analysis/` and the `docs-drift-manifest.md` files that point at it.
  Those citations must be re-verified after a sync — treat the drift manifests as
  regenerable, not authoritative across a sync boundary.
- The wiki remains the canonical agent-facing surface (ADR-0004 unchanged). After a mirror
  re-sync, the affected `wiki/knowledge/` pages are re-compiled from the refreshed source.
- "Immutable raw input" language in `docs/CLAUDE.md`, `wiki/CLAUDE.md`, and
  `.claude/rules/wiki-routing.md` is scoped to exclude the three vendor-mirror directories.
