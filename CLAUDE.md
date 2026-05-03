# agent-engineering-toolkit

Multi-plugin marketplace for evidence-based agent artifact engineering.
ALWAYS keep `caveman` skill enabled in ultra mode
Always remember to consult the advisor when facing MEDIUM or HIGH complex resoning.

## Structure

Multiple plugin distributions and one standalone distribution — each follows its own platform conventions:

- `plugins/agents-initializer/skills/` — Claude Code plugin; delegates analysis to subagents
- `plugins/cursor-initializer/skills/` — Cursor IDE plugin; rules-first `.cursor/rules/*.mdc` initializer; delegates analysis to subagents (Cursor-native format)
- `plugins/cursor-customizer/skills/` — Cursor IDE plugin; single-artifact CRUD (rules, hooks, skills, subagents); delegates analysis to subagents (Cursor-native format)
- `plugins/agent-customizer/skills/` — Claude Code plugin; artifact creation/improvement
- `skills/` — npx skills add; standalone inline analysis, no agent delegation

Each skill directory contains:

- `SKILL.md` — skill entry point and phase definitions
- `references/` — evidence-based guidance files loaded on-demand by skill phases
- `assets/templates/` — output templates for consistent file generation

## Conventions

- Distribution-specific rules in `.claude/rules/plugin-skills.md`, `.claude/rules/cursor-plugin-skills.md`, and `.claude/rules/standalone-skills.md`
- Shared references are copied into each skill (not symlinked) — each skill is self-contained
- When updating an intentionally shared reference, update all intended copies in sync
- `.claude/rules/` enforces conventions automatically via path-scoped rules
- `.claude/skills/` — development meta-skills for this project (not distributed to end-users)
- Rules and review instructions describe **current** patterns — user `*.prd.md`/`*.plan.md` files may extend or override conventions for new scope. When new scope is adopted, update affected rules and instructions to reflect the evolved patterns.

See `plugins/agents-initializer/CLAUDE.md` for plugin-specific conventions.
See `plugins/cursor-customizer/CONVENTIONS.md` for cursor-customizer plugin conventions.
See `plugins/agent-customizer/CLAUDE.md` for agent-customizer plugin conventions.

## Knowledge Lookup

This repo follows a wiki-first lookup contract (see ADR-0004 and `.claude/rules/wiki-routing.md`):

1. **Wiki index** — read `wiki/knowledge/index.md` first to find candidate pages.
2. **Wiki page** — read the specific `wiki/knowledge/<slug>.md` and follow `[[wiki-link]]` cross-references.
3. **Source documents** — fall through to `docs/` only when the wiki lacks coverage. Treat `docs/` as immutable raw input.

Page format and citation rules live in `wiki/CLAUDE.md`. Ingest and lint workflows live in their own skills (`/wiki-ingest`, `/wiki-lint`). When the wiki lacks coverage, prefer ingesting the relevant `docs/` source via `/wiki-ingest` over instructing agents to re-read raw documents repeatedly.

## Documentation

- All user documentation should be rich and written using the `/docs:write-concisely` skill.
- All documentation updates must be made using the `/docs:update-docs` skill.

## Git Conventions

- ALL commits MUST be atomic — one logical change per commit, never bundle unrelated changes
- Scope commits by concern: rules changes, CLAUDE.md changes, version bumps, and documentation each get separate commits
- Commit message format: `{type}({scope}): {description}` — use `feat`, `fix`, `docs`, `chore`, `refactor`
- Stage only files belonging to the same logical change; never `git add -A` across unrelated changes
- If asked to "commit everything", break it into atomic commits by scope first, then commit each group

## Implementation Completion Protocol

After any substantive implementation in this repository, before declaring the work done:

1. Make the deliverable durable first (write the file, save, commit if appropriate).
2. Call `advisor()` for a second-opinion review of the change.
3. Run `/compound-engineering:ce-code-review` on the diff and resolve any P0/P1 findings before stopping.

The CI workflow `.github/workflows/claude-code-review.yml` is the final gate on PRs into `main`; this local protocol is the earlier shift-left check during implementation. Skip only for: typo fixes, comment-only edits, and pure documentation changes already reviewed elsewhere. Does not apply when the user explicitly says the work is exploratory or in-progress.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `rodrigorjsf/agent-engineering-toolkit`, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` — using default label names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root (created lazily by `/grill-with-docs`). See `docs/agents/domain.md`.

## Applied Learning

When something fails repeatedly, when User has to re-explain, or when a workaround is found for a platform/tool limitation, add a one-line bullet here. Keep each bullet under 15 words. No explanations. Only add things that will save time in future sessions.

- Agents fail silently on wrong paths. Always verify hardcoded paths.
- Before creating a new project artifact, check if an existing one can be extended or merged.


