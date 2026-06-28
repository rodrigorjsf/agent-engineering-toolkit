# Orientation digest

One agent runs once, before the fan-out, and returns a compact map of the repo and its
documentation. Every investigator receives this digest so none has to re-read the whole
repo. The digest is shared context, not a deliverable — keep it tight.

## Probe list (ordered, generic)

Probe these in order; skip what is absent. Do not assume any specific repo's layout.

1. `README*` at the repo root — purpose, stack, how it is built and run.
2. `CONTEXT.md` / `CONTEXT-MAP.md` — domain glossary and context boundaries, if present.
3. `CONTRIBUTING*`, `ARCHITECTURE*`, `CLAUDE.md`, `AGENTS.md` — working conventions.
4. `docs/` — table of contents; note the major subtrees, do not read every file.
5. `docs/adr/` or `docs/decisions/` — list the ADR titles (the decisions, not bodies).
6. `wiki/` — index/table of contents if one exists.
7. Package/build manifests (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`,
   `Gemfile`, …) — language, key dependencies, scripts.
8. Top-level source layout — the main directories and what each roughly holds.

## What the digest must contain

A compact map an investigator can use to jump straight to the right place:

- One or two sentences on what the project is and its stack.
- Where the docs live and what each major area covers (paths + one-line descriptions).
- The list of ADR/decision titles (so investigators can spot prior decisions that bear
  on an issue without reading every ADR).
- The source-tree shape: top directories and their responsibility.
- Any obvious conventions a triage should respect (e.g. "tests live in X", "docs must
  stay in sync with code").

## What it must NOT be

- Not a file dump. Paths + one-liners, not contents.
- Not issue-specific. Issue-specific reading is each investigator's own job.
- Not long. Aim for something an investigator skims in seconds; if it is growing past a
  page, compress.
