# Handoff: `orchestrate` plugin — Slices S2–S3 built; stopped at S3 on 3 foundational design calls

**Created:** 2026-05-21 01:51
**Branch:** `feat/orchestrate-plugin` (3 commits, not pushed)
**Session type:** Build session — executed PRD #153 slices S2 (#155) and S3 (#156); stopped before S4 (#157).

---

## Summary

The user asked to "run all slices" of PRD #153 autonomously (AFK). Slices **S2 (#155)** and **S3 (#156)** are built, Opus-reviewed, and committed. Work **stopped at S3** — not because the remaining issues are ambiguous, but because slice **S4 (#157)** surfaces **three foundational architectural decisions** that the PRD assumed and that 11 downstream slices would inherit. Those decisions affect runtime auth, infrastructure requirements, and the S1 tool contract — they cannot be picked unattended without locking guesses across the whole plugin.

This is the ratified stop-condition firing: *"a slice's acceptance criteria can't be met without a design call the user hasn't ratified."* Two clean commits are banked; the three decisions are laid out below as decision matrices for the user to resolve.

A new session should resume at **#157** only after the user picks Decision 1 and Decision 2 below.

---

## Work Completed

### S2 — issue #155 — capability executor tools (commit `6a79535`)

Added four fixed-capability MCP tools to `orchestrate-mcp`: `run_tests`, `run_typecheck`, `run_build`, `run_lint`. Each reads an **argv array** (not a shell string) for its verb from the project's `.orchestrate/commands.json` and runs it with `execFile` (no shell). The caller selects a capability by tool name and never passes a command string.

- Discriminated output: `status: "passed" | "failed" | "not-configured" | "error"`; `errorCode: "CONFIG_INVALID" | "EXEC_ERROR" | "TIMEOUT"` only on `status:"error"`.
- Missing file or unconfigured verb → `not-configured` (no errorCode). Malformed config → `error/CONFIG_INVALID`. Hung command → `error/TIMEOUT` with the output captured before the kill.
- Ships `plugins/orchestrate/templates/commands.json` (argv-array starter, npm defaults).
- 14 vitest tests against deterministic `node -e` fixtures.

### S3 — issue #156 — `plan_waves` dependency wave planner (commit `bc5a5df`)

Added the `plan_waves` tool. Given issues each carrying a `blockedBy` list, it builds the dependency graph and topologically sorts it (Kahn by waves) so every issue lands in a wave whose blockers all resolve earlier. Blockers outside the input set are treated as already satisfied. A dependency cycle is found via a three-colour DFS and returned as `error/CYCLE_DETECTED` with the cycle path — never a hang.

- 14 vitest tests: linear chains, parallel branches, diamonds, cycles (2-node, 3-node, self), order preservation, mixed in-set/out-of-set blockers, duplicate ids, empty set.

### Process used

Per-slice: build → independent `build`/`typecheck`/`test` → Opus reviewer subagent → fix P1/P2 → commit. `advisor()` consulted at the design fork before S2 and at the pre-S4 checkpoint (this stop decision). All `build`/`typecheck`/`test` runs verified independently — **46/46 tests green** across the three test files.

---

## Why the run stopped at S3 — three decisions for the user

Slice **#157** ("walking skeleton — single-issue orchestration") requires "the GitHub MCP wired in" and an `implementer` subagent that "has no Bash tool" yet "pushes its file set to the slice branch". Recon found **no GitHub MCP is configured anywhere in this repo** — every GitHub operation today uses the `gh` CLI (`docs/agents/issue-tracker.md`, root `CLAUDE.md`). That turns #157 into three coupled architectural calls.

### Decision 1 — Which GitHub integration to wire in

| Option | Auth | Infra needed | Tradeoff |
| --- | --- | --- | --- |
| **1A** Remote GitHub MCP (`https://api.githubcopilot.com/mcp/`) | OAuth | none (HTTP) | Cleanest install; may require a GitHub Copilot subscription; runtime remote dependency |
| **1B** Local GitHub MCP via Docker (`ghcr.io/github/github-mcp-server`) | `GITHUB_PERSONAL_ACCESS_TOKEN` | Docker daemon | No Copilot sub; every user needs Docker + a PAT |
| **1C** Local GitHub MCP binary (`github-mcp-server`) | `GITHUB_PERSONAL_ACCESS_TOKEN` | binary install | No Docker; every user installs a binary + a PAT |
| **1D** No GitHub MCP — orchestrator uses the `gh` CLI | `gh auth` (already configured) | `gh` CLI | Matches the repo's existing convention; the **orchestrator skill** needs Bash, the **implementer subagent** still does not. Contradicts the PRD's literal "GitHub MCP wired in" wording. |

### Decision 2 — How the implementer gets its work onto the slice branch

The implementer has **no Bash**, must land its file changes on the slice branch, and then the orchestrator must call `remove_worktree`. **Conflict:** S1's shipped `remove_worktree` *refuses a dirty worktree*. If the implementer edits files but never makes a local commit, the worktree stays dirty and removal is refused.

| Option | Mechanism | Consequence |
| --- | --- | --- |
| **2A** GitHub MCP `push_files` (API-side commit) | Implementer reads file contents, pushes via the GitHub API | Worktree never gets a local commit → stays dirty → `remove_worktree` refuses. Needs a `remove_worktree` reframe/force flag. Requires the chosen MCP to expose `push_files`. |
| **2B** New `orchestrate-mcp` tool (e.g. `commit_worktree`) | An MCP tool runs `add`/`commit`/`push` inside the worktree | Local commit → worktree clean → `remove_worktree` works unchanged. Keeps the implementer Bash-free. **Expands #157's scope** with a new tool. |
| **2C** `force` flag on `remove_worktree` | Implementer pushes via API (2A); orchestrator force-removes | Contract change to already-shipped S1; the flag is a standing footgun for later slices. |
| **2D** Orchestrator commits + pushes via Bash | Implementer only edits; the orchestrator skill (which has Bash) commits + pushes | Implementer stays Bash-free; no new MCP tool. The orchestrator skill needs Bash. Pairs naturally with **1D**. |

### Coherent architecture bundles

The two decisions are coupled. Two clean pairings:

- **Bundle A — `gh`-native:** `1D` + `2D`. No GitHub MCP, no new MCP tool, no S1 change. Orchestrator skill uses Bash + `gh`; implementer stays sandboxed. Lowest user-setup burden; consistent with this repo. Cost: deviates from the PRD's "GitHub MCP" wording.
- **Bundle B — MCP-native:** (`1A`/`1B`/`1C`) + `2B`. Honors the PRD literally; adds a `commit_worktree` tool. Cost: every user configures a GitHub MCP (auth + infra), and #157 grows by one tool.

### Decision 3 — `remove_worktree` dirty-refusal reconciliation

Whatever Decision 2 picks, confirm whether S1's `remove_worktree` needs a follow-up change (force flag, or a documented "clean before remove" precondition). This **touches already-shipped S1 code** (`src/tools/worktree.ts`) — call it out explicitly so the next session does not treat it as a fresh feature.

---

## Downstream impact map

| Slice | Gated on |
| --- | --- |
| #157 (walking skeleton) | Decision 1 + Decision 2 + Decision 3 |
| #158 (reviewer + auto-merge) | Decision 1 (needs a PR-merge capability) + Decision 2 (reviewer re-pushes fixes) |
| #160 (conflict-resolver + final PR) | Decision 1 (PR creation) |
| #162 (issue + PRD status sync) | Decision 1 (issue-label write capability) |
| #159, #161, #163, #164, #165, #166, #167 | Indirectly — they build on the #157–#162 surface |

**Not gated on Decisions 1/2 (TS sub-modules that are pure logic, unit-testable):**

- #161's `routing-resolver` module (complexity-tier → model/effort mapping) — pure function, testable. *But* #161's eight subagent `.md` definitions reference role tool-scoping that depends on Decision 1.
- #164's `context-watchdog` hook and `spawn_successor` spawner modules — read transcript token usage / launch a terminal; independent of GitHub.
- #163's HTML renderers are *deterministic* but render from `run-state.json`, whose schema is defined in **#159** — so #163 is gated on #159's contract, not on Decisions 1/2.

No downstream slice is *fully* un-gated. The honest resume split: after the user answers Decisions 1–3, #157→#162 is orchestration-prose work that benefits from the user being reachable for check-ins; #161/#163/#164 contain TS modules an agent can build autonomously once their upstream contracts (#159's `run-state.json`) exist.

---

## Files Affected

### Committed this session

- `6a79535` — S2: `src/tools/run-command.ts`, `src/index.ts`, `test/run-command.test.ts`, `dist/index.js`, `templates/commands.json`, `plugin.json` + `package.json` (→ 0.2.0)
- `bc5a5df` — S3: `src/tools/plan-waves.ts`, `src/index.ts`, `test/plan-waves.test.ts`, `dist/index.js`, `plugin.json` + `package.json` (→ 0.3.0)

### Working tree

Clean. Only pre-existing untracked items remain (`*Zone.Identifier`, `.claude/skills/prototype/`, `sandcastle-ref/`, prior handoff docs). Nothing staged.

---

## Current State

- **Branch:** `feat/orchestrate-plugin`, 3 commits ahead of `development` (`185e4ec` S1, `6a79535` S2, `bc5a5df` S3). **Not pushed. No PR.** (Local-only, per S1 precedent.)
- **`orchestrate-mcp`:** 6 MCP tools registered — `create_worktree`, `remove_worktree`, `run_tests`, `run_typecheck`, `run_build`, `run_lint`, `plan_waves`. `build`/`typecheck`/`test` all green; **46/46 tests pass**.
- **Plugin version:** `0.3.0` (`plugin.json`, `package.json`, and the `McpServer` version in `index.ts` are in sync).
- **`orchestrate` is still NOT registered** in `.claude-plugin/marketplace.json` — deliberate; packaging is slice #167.

### What's not started

Slices **#157–#167** — no code. The `orchestrate` skill, all subagents, the `context-watchdog` hook, and ~6 more MCP tools are unbuilt.

---

## Next Steps

1. **User decides Decision 1, Decision 2, Decision 3** above (Bundle A vs Bundle B is the fast path).
2. Resume at **#157** with those decisions. Re-read issue #157 via `gh issue view 157 --json number,title,body,labels,state` (note: plain `gh issue view` fails on this repo with a `projectCards` deprecation error — always use `--json`).
3. Continue the dependency chain in linear order #157 → #158 → #159 → #160 → #161 → #162 → #163 → #164 → #165 → #166 → #167 (this order respects every `Blocked by` edge).
4. Per-slice process: build → independent `build`/`typecheck`/`test` → Opus reviewer subagent → fix P1/P2 → commit `Closes #N` / `Refs #153`. Consolidate `advisor()` to ~3 calls total, not per-slice.
5. Each slice MINOR-bumps the plugin version (`plugin.json` + `package.json` + `McpServer` version), riding in the same commit.

---

## Open Questions

Carried from the S1 handoff:

- [ ] Confirm an ast-grep MCP exists (affects #165) — else the text-search fallback stands.
- [ ] Branch lifecycle: which slice owns deleting branches after `remove_worktree`? Currently unowned.

New, surfaced this session (the blockers):

- [ ] **Decision 1** — which GitHub integration (1A/1B/1C/1D).
- [ ] **Decision 2** — implementer push mechanism (2A/2B/2C/2D).
- [ ] **Decision 3** — does `remove_worktree` (shipped in S1) need a force flag or a documented precondition?

The S1 handoff's "Confirm exact GitHub MCP tool names" question is **superseded** by Decision 1 — the issue is not the tool *names* but whether a GitHub MCP exists at all.

---

## Related Resources

- **PRD:** GitHub issue #153 — `rodrigorjsf/agent-engineering-toolkit`
- **Slices:** issues #157–#167 — each has `What to build` + `Acceptance criteria` + `Blocked by`.
- **Prior handoffs:** `HANDOFF_ORCHESTRATE_S1_05_21_01_24.md` (S1 build), `HANDOFF_ORCHESTRATE_05_20_23_53.md` (design/backlog).

---

## Session Notes

The user's "run all slices" request assumed the `ready-for-agent` issues carried no unresolved foundational ambiguity. That assumption broke at #157: the PRD says "GitHub MCP wired in" but no GitHub MCP exists in the repo, and the implementer's no-Bash + push + worktree-removal mechanics have four substantially different solutions. Picking those AFK would stack three load-bearing guesses across 11 slices. S2 and S3 — both self-contained, unit-testable MCP tools — were the clean stopping point. Two solid commits banked; three foundational decisions surfaced for the user.

---

_Resume by having the user answer Decisions 1–3, then re-read issue #157 and continue the build from there._
