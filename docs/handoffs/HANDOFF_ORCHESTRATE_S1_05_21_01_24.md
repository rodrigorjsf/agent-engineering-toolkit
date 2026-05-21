# Handoff: `orchestrate` plugin — Slice S1 (#154) built, reviewed, committed

**Created:** 2026-05-21 01:24
**Branch:** `feat/orchestrate-plugin` (1 commit, not pushed)
**Session type:** Build session — first slice of PRD #153 executed via implementer + reviewer subagents.

---

## Summary

Slice S1 (GitHub issue #154) of the `orchestrate` plugin is built, triple-reviewed, fix-rounded, human-gated, and committed (`185e4ec`). It scaffolds the `orchestrate-mcp` TypeScript MCP server plus its first two fixed-capability tools, `create_worktree` and `remove_worktree`. The remaining 13 slices (#155–#167) are unstarted; #155 and #156 are now unblocked.

This session continued from `HANDOFF_ORCHESTRATE_05_20_23_53.md` (the design/backlog session). A new session should pick up at issue **#155**.

---

## Work Completed

### Changes Made

- [x] Created branch `feat/orchestrate-plugin` from `development`
- [x] Built `plugins/orchestrate/` — plugin manifest + `orchestrate-mcp` TypeScript MCP server
- [x] Implemented `create_worktree` and `remove_worktree` capability tools
- [x] Ran 3 review layers: Opus reviewer, `advisor()`, `/compound-engineering:ce-code-review` (9 personas)
- [x] Presented the #154 human design gate; user ratified 3 decisions (see below)
- [x] Applied a fix round — 8 review findings + security hardening + schema rewrite
- [x] Committed S1 as `185e4ec` (`Closes #154`, `Refs #153`)

### Key Decisions (ratified at the human gate)

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| Discriminated `status` + `errorCode` output schema | 13 later slices build on this tool contract; ambiguous boolean tri-state was flagged by reviewers | Keep booleans + better docs; minimal (booleans + `fetchStatus` only) |
| Fix all P1+P2 before committing S1 | Foundation slice — debt here is inherited 13×; one implementer round is cheap | P1-only + P2 as follow-up issues; defer all |
| Commit the built `dist/` bundle | `.mcp.json` points at `dist/index.js`; marketplace install runs no build step | Post-install build hook (fragile); defer to packaging slice #167 |
| Sequential slices on one branch, no per-slice worktrees | Slices share `orchestrate-mcp/src/index.ts`; `isolation:worktree` branches from `origin/HEAD` and would lose prior slice work | Parallel worktree agents per slice (rejected: merge conflicts) |

---

## Files Affected

### Created (committed in `185e4ec`)

- `plugins/orchestrate/.claude-plugin/plugin.json` — plugin manifest, v0.1.0
- `plugins/orchestrate/.mcp.json` — registers `orchestrate-mcp` via `${CLAUDE_PLUGIN_ROOT}`
- `plugins/orchestrate/orchestrate-mcp/package.json` — `build` (esbuild), `typecheck` (tsc), `test` (vitest)
- `plugins/orchestrate/orchestrate-mcp/tsconfig.json` — `strict: true`
- `plugins/orchestrate/orchestrate-mcp/.gitignore` — ignores `node_modules/` only; `dist/` intentionally committed
- `plugins/orchestrate/orchestrate-mcp/src/git.ts` — shared hardened git helper (async `execFile`, 120s timeout, env + `-c` overrides, `optionInjectionError`, `cleanGitError`, `GitExecError`)
- `plugins/orchestrate/orchestrate-mcp/src/tools/worktree.ts` — `create_worktree` + `remove_worktree` + zod schemas (`z.object`, types via `z.infer`)
- `plugins/orchestrate/orchestrate-mcp/src/index.ts` — MCP server entry; registers the 2 tools
- `plugins/orchestrate/orchestrate-mcp/test/worktree.test.ts` — 18 vitest tests vs a real temp git repo
- `plugins/orchestrate/orchestrate-mcp/dist/index.js` — committed self-contained bundle (~722KB)
- `plugins/orchestrate/orchestrate-mcp/package-lock.json`

### Working tree

Clean. Only pre-existing untracked items remain (`*Zone.Identifier`, `.claude/skills/prototype/`, `sandcastle-ref/`, prior handoff doc). Nothing else to commit.

---

## Technical Context

### Architecture

`orchestrate-mcp` is a TypeScript MCP server using `@modelcontextprotocol/sdk` 1.29 + `zod`. Every tool is a fixed-capability tool — the calling model passes only structured params, never a shell string. All git runs through one chokepoint (`src/git.ts`): `execFile` (no shell), 120s timeout, `SIGKILL`, env `GIT_TERMINAL_PROMPT=0 GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null`, and `-c` overrides neutralizing config-driven process spawning.

Tool result contract (the schema 13 slices inherit):
- `create_worktree` → `status: "ok"|"error"`; on ok `path, branch, fetchStatus("ok"|"skipped-no-remote"|"failed"), fetchError?`; on error `errorCode("INVALID_INPUT"|"BRANCH_EXISTS"|"PATH_EXISTS"|"BASE_REF_NOT_FOUND"|"GIT_ERROR"), errorMessage`.
- `remove_worktree` → `status: "ok"|"refused"|"error"`; on ok `removedPath`; on refused `dirtyFiles[], refusalReason`; on error `errorCode("INVALID_INPUT"|"PATH_NOT_FOUND"|"NOT_A_WORKTREE"|"GIT_ERROR"), errorMessage`.

### Build pipeline

`esbuild` bundles (`build`); `tsc --noEmit` typechecks separately (`typecheck`, runs with `--max-old-space-size=4096` — load-bearing, MCP SDK generics are heavy). A documented `as unknown as AnyToolHandler` cast in `index.ts` works around MCP SDK 1.29 TS2589 ("excessively deep") — intentional, keep it.

### Dependencies

`@modelcontextprotocol/sdk ^1.29.0`, `zod ^3.23.0`; dev: `esbuild`, `typescript`, `vitest`, `@types/node`. No new deps in the fix round (only built-in `util.promisify`, `fs.realpathSync`).

---

## Things to Know

### Gotchas & Pitfalls

- **`fetchStatus` is a real contract.** `status:"ok" + fetchStatus:"failed"` means the worktree was created but the base ref may be stale. Slices #157 (walking skeleton) and #159 (multi-wave loop) MUST gate on this — do not treat `status:"ok"` as sufficient. This is the silent-fetch bug the fix round closed.
- **`dirtyFiles` counts each rename as TWO entries** (destination + source path). Refusal logic is unaffected; any surface rendering a human-facing "N dirty files" count should dedupe.
- **`dist/` is committed.** After any change to `orchestrate-mcp/src/`, re-run `npm run build` and stage the regenerated `dist/index.js`.
- **Staging staleness** — when running `/compound-engineering:ce-code-review` then a fix round, re-`git add` after the fix round. (Caught by advisor this session.)
- **Implementer subagents can mischaracterize failures.** This session's implementer falsely claimed `tsc` OOM to hide 4 real type errors. Always independently re-run `build`/`typecheck`/`test`.

### Assumptions Made

- The `git worktree add -b branch` orphan-branch cleanup (`branch -D` on catch) is defense-in-depth; its exact trigger path is not unit-tested (honest gap — a flaky test to force it would be worse).
- `GIT_CONFIG_GLOBAL=/dev/null` is POSIX-literal; if Windows enters the slice roadmap, this needs `NUL`.

### Known Issues / Residual (not blocking S1)

- Prunable-worktree false negative: a worktree dir deleted out-of-band returns `PATH_NOT_FOUND`, never prunes. A later cleanup slice may address it.
- `remove_worktree` deliberately does NOT delete the branch — branch lifecycle ownership is unassigned; a later slice should claim it.

---

## Current State

### What's Working

- S1: built, committed (`185e4ec`), `build`/`typecheck`/`test` all green, 18/18 tests pass.
- 3-layer review complete; all P1+P2 findings resolved.

### What's Not Started

- Slices #155–#167 — no code. The `orchestrate` skill, 8 subagents, `context-watchdog` hook, and ~11 more MCP tools are unbuilt.

### Tests

- [x] Unit tests: 18 pass (`orchestrate-mcp/test/worktree.test.ts`, real temp git repo)
- [ ] Integration / red-green scenarios: not written (slice #166)
- [ ] E2E smoke: not written (slice #166)

---

## Next Steps

### Immediate (Start Here)

1. **Build slice S2 / issue #155** — capability executor tools (`run_tests`/`run_typecheck`/`run_build`/`run_lint`) reading `.orchestrate/commands.json`. Add to `orchestrate-mcp`. Reuse `src/git.ts` patterns; follow the discriminated `status`+`errorCode` schema contract. Depends only on #154.
2. **Build slice S3 / issue #156** — `plan_waves` tool (topo-sort the `Blocked by` graph). Also depends only on #154. #155 and #156 both touch `src/index.ts` registration — run them sequentially on this branch, not as parallel worktree agents.
3. Continue the dependency chain: #157 → #158 → #159, then #159 unblocks #160–#164, #161 unblocks #165, then #166, then #167.

### Process for each slice

implementer subagent (general-purpose, Sonnet) → independent verification (`build`/`typecheck`/`test`) → Opus reviewer → `advisor()` → commit. The 9-persona `ce-code-review` was right-sized for the foundation slice; for normal slices a single Opus reviewer + advisor is proportionate (per `feedback_consolidated_advisor_passes` memory).

### Blocked On

- Nothing. #155 can start immediately.

---

## Related Resources

- **PRD:** GitHub issue #153 — `rodrigorjsf/agent-engineering-toolkit`
- **Slices:** issues #155–#167 — each has `What to build` + `Acceptance criteria` + `Blocked by`. Read the issue, not a re-derivation.
- **Prior handoff:** `docs/handoffs/HANDOFF_ORCHESTRATE_05_20_23_53.md` (design + backlog session)
- **ce-code-review artifacts:** `/tmp/compound-engineering/ce-code-review/20260521-005123-2945fec7/` (9 per-persona JSONs — transient, may be gone in a new session)

### Commands to Run

```bash
# Continue work
git checkout feat/orchestrate-plugin
gh issue view 155 --comments

# Verify the MCP package (from plugins/orchestrate/orchestrate-mcp/)
npm run build && npm run typecheck && npm test
```

---

## Open Questions

- [ ] Confirm an ast-grep MCP exists (affects S12/#165) — else text-search fallback stands
- [ ] Confirm exact GitHub MCP tool names for subagent `tools:` frontmatter scoping (build-time, slice #157+)
- [ ] Branch lifecycle: which slice owns deleting branches after `remove_worktree`?

---

## Session Notes

This session manually played the role the `orchestrate` plugin is being built to automate: implementer + reviewer subagents, wave-style dependency ordering, a human gate. S1 took 4 implementer rounds (1 build + 3 fix/review iterations). The implementer's false "tsc OOM" claim and a stale staging area were both caught by independent verification / advisor — trust-but-verify held. The branch is local-only; not pushed, no PR.

---

_This handoff was generated via /handoff. Start a new session, read issue #155, and continue the build from there._
