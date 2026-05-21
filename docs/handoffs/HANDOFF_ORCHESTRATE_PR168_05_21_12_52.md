# Handoff: `orchestrate` plugin — PRD #153 complete, PR #168 open for review

**Created:** 2026-05-21 12:52
**Branch:** `feat/orchestrate-plugin` (pushed; 14 commits ahead of `development`)
**Session Duration:** ~2.5 hours

---

## Summary

PRD #153 — the `orchestrate` Claude Code plugin — is **fully implemented**. This session resumed from the S10 handoff, built the final four slices (S11–S14 / issues #164–#167), pushed the branch, and opened **PR #168** into `development`. All fourteen slice issues and the parent PRD are relabeled to `ready-for-human`. The one thing not done: the end-to-end skill loop has never been run against a live fixture repository.

---

## Work Completed

### Changes Made

- [x] S11 (#164) — `context-watchdog` PostToolUse hook + `spawn_successor` MCP tool + context-handoff path in the skill — commit `5e53b59`
- [x] S12 (#165) — `search_structural` ast-grep MCP tool + structural-search wiring in the 4 investigator/reviewer subagents — commit `48245e8`
- [x] S13 (#166) — 8 red-green scenario specs + render-tool wiring into the skill — commit `3de614b`
- [x] S14 (#167) — plugin README + marketplace registration + `1.0.0` bump — commit `808207f`
- [x] Branch pushed to `origin/feat/orchestrate-plugin`
- [x] PR #168 created → `development`
- [x] Slice issues #154–#167 relabeled `ready-for-human`; PRD #153 relabeled `ready-for-human` + completion comment

### Key Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| S11 successor launcher: Windows-Terminal-first, configurable chain | User ratified Decision A — WSL2 environment, no Warp | Warp-first (issue's literal default) |
| `--remote-control` / `/goal` used as-is | Verified real via `claude --help` v2.1.146 — not guessed | Research agent wrongly claimed Remote Control was human-only |
| S12: `search_structural` tool inside `orchestrate-mcp` | Stable tool name the subagents' restrictive `tools:` lists can carry | Wiring an external ast-grep MCP (fragile name) |
| S13 E2E smoke test = runbook scenario | Repo has no executing-skill tests; a fake-green test would mislead | An automated vitest E2E |
| S13: wired render tools into SKILL.md | O8 review surfaced #163 added render tools never invoked by the skill | Flag-and-defer to a separate issue |
| Plugin → `1.0.0` at S14 | Versioning rule: first feature-complete, marketplace-registered surface | Stay `0.x` until E2E-verified |

---

## Files Affected

### Created (this session)

- `plugins/orchestrate/orchestrate-mcp/src/handoff-config.ts` — shared `handoff.json` zod schema + loader
- `plugins/orchestrate/orchestrate-mcp/src/hooks/context-watchdog.ts` / `context-watchdog-cli.ts` — watchdog logic + hook entry
- `plugins/orchestrate/orchestrate-mcp/src/tools/spawn-successor.ts` / `search-structural.ts` — two new MCP tools
- `plugins/orchestrate/orchestrate-mcp/test/{context-watchdog,spawn-successor,search-structural}.test.ts` — 55 new tests
- `plugins/orchestrate/hooks/hooks.json` — declares the `context-watchdog` PostToolUse hook
- `plugins/orchestrate/templates/handoff.json` — context-handoff config template
- `plugins/orchestrate/skills/orchestrate/references/context-handoff.md` — handoff mechanism reference
- `plugins/orchestrate/README.md` — the plugin README (229 lines)
- `.claude/PRPs/tests/scenarios/orchestrate-*.md` — 8 scenario specs (O1–O8)
- `docs/handoffs/HANDOFF_ORCHESTRATE_S14_COMPLETE_05_21_12_34.md` — earlier completion report (pre-push)

### Modified

- `plugins/orchestrate/orchestrate-mcp/src/index.ts` — registered `spawn_successor` + `search_structural`; `McpServer` version `0.12.0`
- `plugins/orchestrate/orchestrate-mcp/package.json` — build script (2nd esbuild entry); version `0.12.0`
- `plugins/orchestrate/skills/orchestrate/SKILL.md` — `/goal` at startup, stale-flag clear, handoff section, render step
- `plugins/orchestrate/.claude-plugin/plugin.json` — version `0.13.0` → `1.0.0`
- `plugins/orchestrate/agents/{investigator,reviewer}-{standard,deep}.md` — `search_structural` in `tools:` + Code search section
- `.claude-plugin/marketplace.json` — orchestrate entry added; version `1.2.0` → `1.3.0`
- `README.md` (root) — orchestrate in Distributions table, Installation, structure tree
- `plugins/orchestrate/orchestrate-mcp/dist/{index.js,context-watchdog.js}` — rebuilt bundles (committed)

---

## Technical Context

### Architecture Notes

- The orchestrate skill is markdown driven by a model — it cannot be unit-tested. `orchestrate-mcp` (TypeScript) holds the testable logic: 13 MCP tools, discriminated `status` results, never-throws contract.
- The `context-watchdog` hook is a separate esbuild bundle (`dist/context-watchdog.js`), declared in `hooks/hooks.json`, auto-discovered when the plugin is enabled. It is a silent no-op outside an active orchestration run.
- The MCP server version (`0.12.0`) and the plugin version (`1.0.0`) are **independent** — the MCP server version bumps only when `orchestrate-mcp` source changes (last: #165).

### Dependencies

No new npm dependencies. `search_structural` shells to the optional `ast-grep` CLI; absent → graceful text-search fallback.

---

## Things to Know

### Gotchas

- The `sg` alias for ast-grep collides with the POSIX `sg` (set-group) command — the tool hardcodes `ast-grep`, never `sg`.
- `Closes #N` trailers auto-close the slice issues **because `development` is the repo default branch** — confirmed via `gh repo view`.
- esbuild rebuilds are deterministic — a no-op `npm run build` leaves `dist/` byte-identical (no spurious git diff).

### Known Issues / Tech Debt

- **The end-to-end skill loop has never run.** Unit tests cover the MCP tools (144 tests); the skill loop is unverified — see scenario O8.
- `orchestrate-mcp` self-reports version `0.12.0` while the plugin is `1.0.0` — correct per the versioning rule, but mildly confusing for a 1.0 release.
- AGENT_TEAMS: PRD #153 mentioned "the plugin ships the config to enable it"; no slice AC made that concrete. The README documents it as optional; no `settings.json` is shipped (force-enabling an experimental feature contradicts "optional").

---

## Current State

### What's Working

- `orchestrate-mcp` — `build`, `typecheck`, `test` all green (144 tests, 9 files).
- `context-watchdog` hook — verified end-to-end with simulated hook stdin.
- PR #168 — open, base `development`, awaiting review.
- All 14 slice issues + PRD #153 — relabeled `ready-for-human`.

### What's Not Working / Unverified

- The full `/orchestrate` skill loop against a real GitHub repo — never executed.

### Tests

- [x] Unit tests: 144 passing (`orchestrate-mcp`)
- [ ] Integration / E2E: O8 runbook not yet run against a fixture
- [x] Per-slice Opus review: all 4 slices reviewed, P0/P1 resolved

---

## Next Steps

### Immediate (Start Here)

1. **Review PR #168** — https://github.com/rodrigorjsf/agent-engineering-toolkit/pull/168. The CI workflow `.github/workflows/claude-code-review.yml` is the final gate.
2. **Run the O8 runbook** — `.claude/PRPs/tests/scenarios/orchestrate-e2e-smoke.md` — against a throwaway fixture repository to verify the skill loop end to end.
3. **Merge PR #168** into `development` — this auto-closes slice issues #154–#167 via the `Closes` keywords.

### Subsequent

- Manually close PRD #153 after the merge (it carries only `Refs #153`, no `Closes`).
- Optional `chore(release)`: bump `orchestrate-mcp/package.json` + the `McpServer` version in `index.ts` to `1.0.0` to align with the plugin release.

### Blocked On

- Nothing. PR #168 is ready for human review.

---

## Related Resources

### Documentation

- PR #168 — the review surface
- PRD: GitHub issue #153 (`rodrigorjsf/agent-engineering-toolkit`)
- Earlier completion report: `docs/handoffs/HANDOFF_ORCHESTRATE_S14_COMPLETE_05_21_12_34.md`
- Scenario suite: `.claude/PRPs/tests/scenarios/orchestrate-*.md`

### Commands to Run

```bash
# Verify the package
cd plugins/orchestrate/orchestrate-mcp && npm run build && npm run typecheck && npm test

# PR status
gh pr view 168 --json state,reviewDecision,statusCheckRollup
```

---

## Open Questions

- [ ] Should `orchestrate-mcp` be version-aligned to `1.0.0` with the plugin? (Optional follow-up.)
- [ ] Does the user want a shipped opt-in `settings.json` for AGENT_TEAMS, or is README documentation sufficient?

---

## Session Notes

PRD #153 is the largest workstream on this branch — 14 slices across multiple sessions. This session completed S11–S14 with the per-slice ritual (build → independent verify → Opus review → fix P0/P1 → atomic commit), `advisor()` consulted at every design fork. Two stop-conditions fired and were resolved by user ratification (Decision A; the S12 ast-grep approach; the S13 runbook form). The S13 review caught a genuine half-finished feature from S10 (render tools never wired into the skill) — fixed in the same commit.

---

_PRD #153 complete. PR #168 awaits review, merge, and an O8 end-to-end run._
