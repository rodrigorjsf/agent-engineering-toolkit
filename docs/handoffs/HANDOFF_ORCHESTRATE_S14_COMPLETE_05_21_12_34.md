# PRD #153 Complete — `orchestrate` plugin, slices S1–S14 shipped

**Created:** 2026-05-21 12:34
**Branch:** `feat/orchestrate-plugin` — 14 commits, local-only, **not pushed, no PR**
**Status:** **PRD #153 COMPLETE.** All fourteen slices are built, reviewed, and committed.
**Supersedes:** `HANDOFF_ORCHESTRATE_S10_05_21_10_24.md` — this is a completion report, not a continuation handoff.

---

## Summary

This session resumed from the S10 handoff. The user ratified the design calls
the S10 handoff had blocked on, and slices **S11–S14 (#164–#167)** were built,
reviewed, and committed — **four new commits**. PRD #153 is now complete: all
fourteen slices, S1 through S14.

The branch is local-only — not pushed, no PR — preserving the posture both
prior handoffs maintained. The user reviews the branch, pushes it, and opens
the pull request.

---

## Decisions ratified this session

- **S11 / Decision A (terminal launcher):** Windows Terminal first, with a
  configurable Warp→WT fallback chain in `handoff.json`.
- **S11 / Decisions B & C:** resolved by `claude --help` (v2.1.146) — not a
  guess. `--remote-control [name]` is a documented flag; `/goal` is a real
  slash command (v2.1.139+). No external guesswork shipped.
- **S12 / ast-grep:** a `search_structural` tool inside `orchestrate-mcp` that
  shells to the `ast-grep` CLI — chosen over wiring an external ast-grep MCP,
  for a stable tool name the subagents' restrictive `tools:` lists can carry.
- **S13 / E2E smoke test:** delivered as a **runbook scenario**, not a
  fake-green automated test — consistent with the repo's scenario-spec
  testing methodology.

---

## Work completed this session

| Slice | Issue | Commit | What it added |
| --- | --- | --- | --- |
| S11 | #164 | `5e53b59` | `context-watchdog` PostToolUse hook + `spawn_successor` MCP tool + the context-handoff path in the skill |
| S12 | #165 | `48245e8` | `search_structural` ast-grep MCP tool + structural-search wiring in the four investigator/reviewer subagents |
| S13 | #166 | `3de614b` | 8 red-green scenario specs (`.claude/PRPs/tests/scenarios/orchestrate-*.md`) + render-tool wiring into the skill (gap surfaced by scenario O8) |
| S14 | #167 | `808207f` | Plugin `README.md` + marketplace registration + the `1.0.0` release bump |

Per-slice process for each: build → independent `build`/`typecheck`/`test` →
Opus reviewer subagent → fix P0/P1/P2 → atomic commit. `advisor()` consulted at
every design fork and before every commit.

---

## Full PRD arc

S1–S10 landed in prior sessions (`185e4ec` … `c486680`); S11–S14 landed this
session. The branch is **14 commits ahead of `development`**.

## Final state

- **Plugin `orchestrate` at `1.0.0`**, registered in
  `.claude-plugin/marketplace.json` (marketplace bumped `1.2.0` → `1.3.0`).
- **`orchestrate-mcp`** — 13 MCP tools; **144 unit tests** across 9 files;
  `build`/`typecheck`/`test` all green.
- **`context-watchdog` hook** — bundled at `dist/context-watchdog.js`,
  declared in `hooks/hooks.json`.
- **8 subagents**, the `orchestrate` skill (sections 1–4 + failure handling),
  3 config templates, and the `references/` documents.
- **8 scenario specs** — 7 red-green (O1–O7) + 1 E2E smoke runbook (O8).

### Working tree

Clean except pre-existing untracked items (`*Zone.Identifier`,
`.claude/skills/prototype/`, `sandcastle-ref/`, the prior handoff docs).

---

## Open items for the user

1. **O8 has never run end-to-end.** The E2E smoke scenario
   (`.claude/PRPs/tests/scenarios/orchestrate-e2e-smoke.md`) is a runbook — it
   needs a throwaway fixture repository and a live GitHub run to verify. The
   `orchestrate-mcp` tools are unit-tested; the **skill loop itself is not yet
   verified end-to-end**. This is the honest gap, deliberately not papered
   over with a fake-green test.

2. **`orchestrate-mcp` internal version.** The bundled MCP server is at
   `0.12.0` (its last code change was #165); the plugin is `1.0.0`. They are
   versioned independently per `.claude/rules/plugin-versioning.md`, and #166
   and #167 changed no MCP server code — so this is correct, not a bug.
   However, a running MCP server self-reports `0.12.0` while the plugin says
   `1.0.0`, which is mildly confusing for a 1.0 release. A `chore(release)`
   bumping `orchestrate-mcp/package.json` and the `McpServer` version in
   `orchestrate-mcp/src/index.ts` to `1.0.0` would align them. **Optional —
   the user's call.**

3. **AGENT_TEAMS shipped config.** PRD #153 mentioned "the plugin ships the
   config to enable" agent teams. No slice's acceptance criteria made that
   concrete, and #167's AC was documentation-only. Force-enabling an
   experimental feature on install contradicts "optional," so the README
   documents agent teams as an optional enhancement and **no `settings.json`
   is shipped**. If the user wants an opt-in config shipped with the plugin,
   that is a follow-up decision.

---

## Next steps for the user

1. **Review** the 14-commit diff on `feat/orchestrate-plugin`.
2. **Push** the branch and **open a PR** into `development`. (Not done here —
   the local-only posture of every prior handoff is preserved.)
3. The CI workflow `.github/workflows/claude-code-review.yml` is the final
   gate on the PR.
4. **Run the O8 runbook** against a throwaway fixture repository to verify the
   full skill loop — the one piece unit tests cannot cover.
5. Optionally take the `orchestrate-mcp` version-alignment `chore(release)`
   (open item 2).

### Verify the package

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build && npm run typecheck && npm test
```

Expect: both bundles built, typecheck clean, 144 tests across 9 files green.

---

## Related resources

- **PRD:** GitHub issue #153 — `rodrigorjsf/agent-engineering-toolkit`.
- **Slices:** issues #154–#167 — all closed by `Closes #N` trailers once the
  branch's PR merges into `development`.
- **Prior handoffs:** `HANDOFF_ORCHESTRATE_S10_05_21_10_24.md` (the resumed
  state), `HANDOFF_ORCHESTRATE_S3_05_21_01_51.md`, `HANDOFF_ORCHESTRATE_S1_05_21_01_24.md`.
- **Scenario suite:** `.claude/PRPs/tests/scenarios/orchestrate-*.md`.
- **run-state schema:** `plugins/orchestrate/skills/orchestrate/references/run-state.md`.
- **Context-handoff mechanism:** `plugins/orchestrate/skills/orchestrate/references/context-handoff.md`.

---

_PRD #153 is complete. The branch awaits the user's review, push, and PR._
