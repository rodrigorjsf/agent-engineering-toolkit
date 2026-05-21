# Handoff: `orchestrate` plugin — Slices S2–S10 built; stopped at S10 before the platform-specific S11

**Created:** 2026-05-21 10:24
**Branch:** `feat/orchestrate-plugin` (10 commits, not pushed)
**Supersedes:** `HANDOFF_ORCHESTRATE_S3_05_21_01_51.md` — that handoff's three foundational decisions were answered by the user (see *Decisions already ratified*).

---

## Summary

The user asked to "run all slices" of PRD #153 autonomously. After the S3 handoff surfaced three foundational design calls, the user ratified them ("Bundle A — gh-native"), and the build resumed. Slices **S4 (#157) through S10 (#163)** are now built, Opus-reviewed, and committed — **nine new commits this session**, on top of S1.

Work **stopped at S10**. Slice **S11 (#164)** — the `context-watchdog` hook and successor handoff — requires three platform/CLI specifics that cannot be verified unattended: the exact Claude Code "Remote Control" launch invocation, whether Warp is the user's terminal, and the WSL2→Windows Terminal handoff. Shipping a successor-spawner on guessed defaults fails *silently* (a terminal launches, but the Claude Code inside is not Remote-Control-driveable). This is the ratified stop-condition firing again: *"a slice's acceptance criteria can't be met without a design call the user hasn't ratified."*

Ten of the fourteen PRD slices are done. A new session should resume at **#164** once the user answers *Decisions A–C* below.

---

## Decisions already ratified (from the S3 handoff)

The user chose **Bundle A — gh-native**:

- **No GitHub MCP.** The orchestrator skill uses the `gh` CLI for all GitHub operations.
- **The orchestrator commits and pushes** the slice via Bash; the implementer subagent stays Bash-free.
- **`remove_worktree` gained a `force` option** so the orchestrator can clean up a worktree unconditionally.

All of S4–S10 is built on this architecture.

---

## Work Completed

| Slice | Issue | Commit | What it added |
| --- | --- | --- | --- |
| S2 | #155 | `6a79535` | `run_tests`/`run_typecheck`/`run_build`/`run_lint` capability tools + `commands.json` template |
| S3 | #156 | `bc5a5df` | `plan_waves` dependency wave planner (Kahn topo-sort, cycle detection) |
| S4 | #157 | `b9a9291` | The `orchestrate` skill + `implementer` subagent — walking skeleton; `remove_worktree` force option |
| S5 | #158 | `d116e4c` | `reviewer` subagent + review gate + auto-merge |
| S6 | #159 | `d2720aa` | Multi-wave resumable loop + `run-state.json` checkpoint |
| S7 | #160 | `7e23d9d` | `conflict-resolver` subagent + final umbrella→development PR |
| S8 | #161 | `e40ef83` | Complexity routing — `resolve_routing` tool, `routing.json`, 8 subagent effort variants, `investigator` role |
| S9 | #162 | `9f45463` | Issue-label + parent-PRD status sync |
| S10 | #163 | `c486680` | `render_dashboard`/`render_graph`/`render_report` HTML artifact tools |

S1 (`185e4ec`, issue #154) pre-dated this session. **Branch is 10 commits ahead of `development`.**

### Process used per slice

Build → independent `build`/`typecheck`/`test` verification → Opus reviewer subagent → fix P1/P2 → commit. `advisor()` consulted at the design forks (pre-S2, pre-S4 stop decision, pre-S11 stop decision). Heavy slices (S8's 8 subagent files, S10's renderer) had their build delegated to a Sonnet subagent, then independently verified — the handoff's "implementers can mischaracterize failures" gotcha held; all subagent claims were re-checked.

---

## Current State — what works on paper

- **Plugin at `0.10.0`.** `orchestrate-mcp` `build`/`typecheck`/`test` all green — **89 tests** across 5 files.
- **`orchestrate-mcp` — 10 MCP tools:** `create_worktree`, `remove_worktree`, `run_tests`, `run_typecheck`, `run_build`, `run_lint`, `plan_waves`, `resolve_routing`, `render_dashboard`, `render_graph`, `render_report`.
- **The `orchestrate` skill** drives the full multi-wave loop: read the `ready-for-agent` backlog → assess complexity tiers → `plan_waves` → umbrella branch → per-wave, per-slice processing (routed investigator/implementer/reviewer subagents in isolated worktrees) → commit/push/PR/merge → conflict resolution → `run-state.json` checkpoint → resume → tracker sync → final umbrella→development PR.
- **8 subagent definitions** — `{investigator,implementer,reviewer,conflict-resolver}-{standard,deep}`; all Bash-free and git-free; the investigator is read-only.
- **Not verified end-to-end.** Every slice is built *to spec* and structurally/unit verified. The skill + subagent orchestration has not been run against a live GitHub repo — true E2E verification is slice #166.

### Working tree

Clean. Only pre-existing untracked items remain (`*Zone.Identifier`, `.claude/skills/prototype/`, `sandcastle-ref/`, prior handoff docs). **Not pushed. No PR.**

---

## Why the run stopped at S10 — decisions for the user

Slice **#164** ("context-watchdog hook + successor handoff") needs the orchestrator to launch a *new interactive Claude Code window* that resumes the run. Most of #164 is buildable to spec — the `context-watchdog` PostToolUse hook (read the transcript, estimate token usage, write a `.orchestrate/context-flag` past a threshold), the flag-driven handoff steps in the skill, the `/goal`-at-startup. **What cannot be verified unattended is the successor launch itself.**

### Decision A — The successor terminal launcher

The issue says "prefers Warp, falls back to Windows Terminal, configurable." The strategy is clear; the **exact default commands** are not, in a WSL2 environment.

| Option | Default launch command | Note |
| --- | --- | --- |
| **A1** Warp (Linux build) | a Warp launch URI / `warp-cli` invocation | Only correct if the user actually runs Warp's Linux build under WSL2 |
| **A2** Windows Terminal from WSL2 | `wt.exe new-tab …` | Reliable from WSL2, but launches on the Windows side |
| **A3** Both, with fallback + a `successor.json` config (the issue's literal ask) | try A1, fall back to A2 | Still needs *correct* defaults — a wrong default fails silently |
| **A4** The user's actual terminal | — | Tell us what you run |

### Decision B — Claude Code "Remote Control" invocation

The acceptance criteria require the successor to launch "with Remote Control active … never print mode." The exact `claude` CLI flag/subcommand that starts an **interactive** session with **Remote Control** enabled is not known here and must not be guessed — a wrong flag yields a successor that runs but cannot be driven. **Please confirm the exact invocation.**

### Decision C — The successor's resume command

Once launched, the successor must re-enter the run. Because S6 made the run resumable from `run-state.json`, the successor only needs to invoke `/orchestrate` (it detects the checkpoint and resumes) with a `/goal` set so it does not stop mid-run. The composition of this into the launch command depends on Decision B.

---

## Downstream slices

| Slice | Gated on |
| --- | --- |
| #164 | Decisions A, B, C above |
| #165 (ast-grep structural search) | Whether an ast-grep MCP exists in the target environment — if not, the text-search fallback stands (carried open question). Buildable to spec; the choice should be ratified. |
| #166 (E2E smoke + red-green scenarios) | A **live GitHub MCP-free environment** with a fixture repo. The scenario harness can be written, but the end-to-end smoke test cannot truly pass without a running orchestrate skill against a real repo — shipping it green would be misleading. |
| #167 (README + marketplace packaging) | Cleanly last — the README and the marketplace registration should describe what actually shipped, including #164's resolved spawner. Also: register `orchestrate` in `.claude-plugin/marketplace.json` (still unregistered — deliberate, this is #167's job) and decide the `0.x → 1.0.0` bump. |

---

## Open Questions

Carried and still unresolved:

- [ ] **Decision A/B/C** above — the #164 successor-spawner specifics.
- [ ] Does an ast-grep MCP exist in the target environment? (#165 — else text-search fallback.)
- [ ] Branch lifecycle: which slice owns deleting slice branches after `remove_worktree`? Currently unowned; `remove_worktree` deliberately does not delete branches.

---

## Next Steps

1. **User answers Decisions A, B, C.**
2. Resume at **#164**. Re-read it: `gh issue view 164 --json number,title,body,labels,state` (always `--json` — plain `gh issue view` fails on this repo's projectCards deprecation).
3. Continue #165 → #166 → #167 in order.
4. Per-slice process: build → independent `build`/`typecheck`/`test` → Opus reviewer subagent → fix P1/P2 → commit `Closes #N` / `Refs #153`, MINOR-bumping `plugin.json` (and `package.json` + the `McpServer` version in `index.ts` when `orchestrate-mcp` changes).
5. At #167, register the plugin in `.claude-plugin/marketplace.json` and run a final `advisor()` + handoff.

### Verify the package after resuming

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build && npm run typecheck && npm test
```

---

## Related Resources

- **PRD:** GitHub issue #153 — `rodrigorjsf/agent-engineering-toolkit`
- **Slices:** issues #164–#167 — each has `What to build` + `Acceptance criteria` + `Blocked by`.
- **Prior handoffs:** `HANDOFF_ORCHESTRATE_S3_05_21_01_51.md` (the three now-ratified decisions), `HANDOFF_ORCHESTRATE_S1_05_21_01_24.md`, `HANDOFF_ORCHESTRATE_05_20_23_53.md`.
- **run-state.json schema:** `plugins/orchestrate/skills/orchestrate/references/run-state.md`.

---

## Session Notes

This session resumed from the S3 stop, built S4–S10 (nine commits), and stopped again at S10 — both stops triggered by the same ratified stop-condition: a slice whose acceptance criteria need a design call the user has not made. S2's discriminated `status`+`errorCode` contract carried through all nine slices without drift. Per-slice Opus review caught real defects every time (stale umbrella base in S4, a reviewer/brief contract mismatch in S8, two resume bugs in S6, a dead issue link in S10). The branch is local-only — not pushed, no PR — pending the user's review.

---

_Resume by having the user answer Decisions A–C, then re-read issue #164 and continue the build._
