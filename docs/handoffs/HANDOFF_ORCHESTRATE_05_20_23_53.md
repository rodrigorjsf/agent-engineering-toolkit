# Handoff: `orchestrate` plugin — design, PRD & backlog

**Created:** 2026-05-20 23:53
**Branch:** development
**Session type:** Design session (grill-me → /to-prd → /to-issues → /triage). No plugin code written yet.

---

## Summary

This session designed a new Claude Code plugin, **`orchestrate`** — a Bash-free, AFK issue-orchestration loop that behaves like Sandcastle but runs entirely inside one interactive Claude Code session (no `claude -p`). The design was settled through a relentless grill-me interview (~17 decisions), then published as **PRD #153** and **14 dependency-ordered slice issues (#154–#167)** on GitHub, all triaged. The deliverable so far is the design + backlog; building has not started. A new session should begin implementation at issue **#154**.

---

## Work Completed

### Changes Made

- [x] Ran a full grill-me interview resolving ~17 design decisions for the `orchestrate` plugin
- [x] Set `remoteControlAtStartup: true` in `~/.claude/settings.json` (was `false`)
- [x] Saved auto-memory: `feedback_html_eye_friendly_colors` + indexed it in `MEMORY.md`
- [x] Published **PRD #153** to GitHub Issues (`enhancement`, `needs-triage`)
- [x] Published **14 slice issues #154–#167** (`/to-issues`), dependency-ordered, each with Parent → #153 and real `Blocked by` refs
- [x] Triaged all 15: `#154` → `ready-for-human`; `#155–#167` → `ready-for-agent`; `#153` stays `needs-triage` (parent tracker); all `enhancement`

### Key Decisions

| Decision | Rationale | Alternatives considered |
| --- | --- | --- |
| Orchestration parity, not container isolation | One Claude Code session cannot sandbox like Docker; git worktree is the only isolation available | Spawn Docker/Podman per slice (rejected: heavy, not portable) |
| Zero Bash for every agent | Bash is bypassable (chaining, subshells); MCP tools are capability-scoped and structurally safe | Bash with allowlist hook (rejected by user — leaky) |
| Custom `orchestrate-mcp` server (capability tools) | The only Bash-free way to run tests, manage worktrees, render HTML, spawn successors | `safe-exec` MCP with allowlist; scoped Bash for subagents only |
| GitHub Issues as fixed backlog source | `/to-prd` + `/to-issues` already target GitHub; "project-agnostic" ≠ "tracker-agnostic" | Pluggable backlog layer (rejected: speculative scope) |
| Deterministic wave planner (topo-sort), not a planner agent | `/to-issues` already records explicit `Blocked by`; no need for a fuzzy LLM planner | Planner agent; hybrid |
| PR per slice → umbrella; final umbrella → development PR | CI gate per slice + clean diff; human merges the final PR | Direct `git merge` to umbrella, single PR |
| 4 subagent roles × 2 effort variants = 8 defs | `effort` is fixed in subagent frontmatter, not overridable at spawn | 4 variants per role; prompt-injected effort |
| `run-state.json` checkpoint + resumable loop | Orchestrator loop runs inside the LLM; state must live on disk to survive overflow/crash | State in context only; derive from GitHub each wave |
| Context handoff at 40% via successor window | Keep orchestrator context healthy; `spawn_successor` opens a real `claude` window | Background sessions (`--bg`); never handing off |
| `/goal` set at skill startup | Keeps the orchestrator looping autonomously; condition = "run complete OR successor spawned" resolves the handoff tension | No goal (risk of premature return of control) |
| Distribution = full marketplace plugin | Deliverable spans skill + 8 subagents + hook + MCP server; plugin is the export unit | Skill in `.claude/` + separate MCP package |

---

## Files Affected

### Created (durable)

- `~/.claude/projects/-home-rodrigo-Workspace-agent-engineering-toolkit/memory/feedback_html_eye_friendly_colors.md` — user preference: HTML artifacts use eye-friendly colors readable on light + dark backgrounds
- GitHub: PRD **#153**, issues **#154–#167** (the real backlog — see "Related Resources")

### Modified

- `~/.claude/settings.json` — `remoteControlAtStartup` flipped `false` → `true`, so every new Claude Code window starts with Remote Control active
- `~/.claude/projects/.../memory/MEMORY.md` — added index line for the new memory

### Created (transient — safe to delete)

- `/tmp/orchestrate-prd.md`, `/tmp/orch-s1.md … /tmp/orch-s14.md` — issue body files used by `gh issue create`; content is now durable on GitHub

### Repo working tree

No tracked repo files were changed this session. `git status` shows only pre-existing untracked items (`*Zone.Identifier` files, `.claude/skills/prototype/`, `sandcastle-ref/`). Nothing to commit.

---

## Technical Context

### Architecture — `orchestrate` plugin

The main Claude Code session becomes a **pure orchestrator**: it never edits source or runs code; it only coordinates. Flow per run:

1. `/orchestrate` → skill sets `/goal` (condition: run terminal OR successor spawned). Orchestrator = zero Bash.
2. Read `ready-for-agent` GitHub issues (GitHub MCP) → `plan_waves` MCP tool topo-sorts the `Blocked by` graph into waves.
3. Create umbrella branch from `development`.
4. Assess each issue's complexity tier → `routing.json` → `{model, effort-variant}` per role.
5. Per wave, parallel per slice: `create_worktree` (from fetched `origin/umbrella`) → investigator (high tiers) → implementer → reviewer (fixes inline; unrecoverable blocker → `FAILED`) → slice PR → CI → auto-merge → conflict → conflict-resolver once → `remove_worktree` → update `run-state.json` + dashboard + labels.
6. Each slice boundary: check `context-watchdog` flag; if > 40%, checkpoint → `spawn_successor` (new `claude --remote-control` window) → exit.
7. Backlog done → single umbrella → `development` PR, left unmerged (human gate) → final HTML report.

### Components

- **`orchestrate-mcp`** (TypeScript MCP server) — tools: `create_worktree`/`remove_worktree`, `run_tests`/`run_typecheck`/`run_build`/`run_lint`, `plan_waves`, `render_dashboard`/`render_graph`/`render_report`, `spawn_successor`
- **8 subagents** — investigator, implementer, reviewer, conflict-resolver, each in `standard` + `deep` effort variant; no Bash (scoped via frontmatter `tools`/`mcpServers`)
- **1 hook** — `context-watchdog` (PostToolUse), reads transcript `usage` to flag the 40% threshold
- **Config** — `.orchestrate/commands.json` (test/build commands), `.orchestrate/routing.json` (tier → model+effort), handoff threshold, successor launcher
- **3 HTML artifacts** — dashboard, dependency graph, final report; rendered deterministically by the MCP from `run-state.json` (no model tokens); eye-friendly palette
- Bash denied to all agents via `permissions.deny`

### Verified harness facts (from research this session)

- Subagent frontmatter supports `effort` (low/medium/high/xhigh/max), `tools`, `disallowedTools`, `mcpServers`, `isolation: worktree`, `permissionMode`, `maxTurns`. `effort` is **not** overridable at spawn — only `model` is.
- `isolation: worktree` branches from `origin/HEAD` by default (`worktree.baseRef: head` overrides) — why worktree lifecycle is owned by the MCP, not the native tool.
- No git/GitHub/filesystem/ast-grep MCP servers are currently installed (no `.mcp.json`). `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is already on in the project `.claude/settings.json`.
- `/goal` (v2.1.139+) holds a completion condition across turns. `claude "prompt"` starts an interactive session with the prompt executed.
- No native API exposes context fill % to the agent — hence the `context-watchdog` hook reading transcript `usage`.

---

## Things to Know

### Gotchas & Pitfalls

- **Local umbrella drift:** slice PRs auto-merge to umbrella on the *remote*; the orchestrator's *local* checkout does not follow. `create_worktree` must `git fetch` and branch from `origin/umbrella`, never local `umbrella` — else wave 2 loses wave 1's work.
- **`remoteControlAtStartup` is under-documented:** the key is present in the real `settings.json` (so it is valid and `/config` manages it), but Anthropic docs do not list it. If it does not take effect, fall back to the `/config` toggle "Enable Remote Control for all sessions". `spawn_successor` also passes `--remote-control` explicitly.
- **Issue numbering is exact:** #154–#167 came out perfectly sequential, so every `Blocked by` reference in the issue bodies is correct. Do not renumber.
- **`/goal` vs handoff tension:** the goal condition must include "OR successor spawned" so a 40% handoff cleanly satisfies the predecessor's goal and lets it exit.

### Assumptions Made

- The successor terminal launcher prefers Warp (user's terminal) and falls back to `wt.exe`.
- The implementer pushes file contents via the GitHub MCP `push_files` (no local `git commit`/`git push`).

### Known Issues / Open scope

- Whether an ast-grep MCP exists in the market is unconfirmed — S12 (#165) degrades to text search if absent.
- Exact GitHub MCP tool-name granularity for subagent `tools:` frontmatter to be verified at build time.

---

## Current State

### What's Working

- Design: complete and ratified through grill-me.
- Backlog: PRD #153 + 14 slices #154–#167 published and triaged on GitHub.
- `remoteControlAtStartup` fix: applied.

### What's Not Working / Not Started

- No plugin code exists yet. `plugins/orchestrate/` has not been created.
- The `orchestrate-mcp` server, subagents, hook, configs, tests, README — all unbuilt.

### Tests

- [ ] Unit tests: not written (planned per slice — all 7 deterministic modules)
- [ ] Integration / red-green scenarios: not written (slice #166)
- [ ] E2E smoke: not written (slice #166)

---

## Next Steps

### Immediate (Start Here)

1. **Build slice S1 / issue #154** (`ready-for-human`, HITL): scaffold `plugins/orchestrate/` with `plugin.json` and the `orchestrate-mcp` TypeScript server; implement `create_worktree`/`remove_worktree` + unit tests. This issue carries a human design-review gate on the MCP package layout and tool schemas — review before dependent slices start.
2. After #154: **#155 (S2, capability executor)** and **#156 (S3, wave planner)** unblock — both depend only on #154.
3. Follow the dependency graph: #157 → #158 → #159, then #159 unblocks #160–#164, #161 unblocks #165, then #166, then #167.

Use `/agent-customizer:create-skill` for the skill, `/agent-customizer:create-subagent` for the 8 subagents, `/agent-customizer:create-hook` for `context-watchdog`. The MCP server is hand-built TypeScript.

### Blocked On

- Nothing. #154 can start immediately.

---

## Related Resources

### The durable spec lives on GitHub

- **PRD:** https://github.com/rodrigorjsf/agent-engineering-toolkit/issues/153
- **Slices:** issues #154–#167 — each has full `What to build` + `Acceptance criteria` + `Blocked by`. These ARE the build briefs; read them, not a re-derivation.

### Commands to Run

```bash
# See the full backlog
gh issue list --state open --label ready-for-agent --search "orchestrate in:title"
# Read a slice
gh issue view 154 --comments
```

### Reference material (read this session)

- `sandcastle-ref/sandcastle/` — Sandcastle source (README, CONTEXT.md, `.sandcastle/*.md` prompts, `parallel-planner-with-review` template) — the orchestration model being adapted
- `docs/html-structure/thariq-html-effectiveness.md` — the HTML-artifact rationale

---

## Open Questions

- [ ] Confirm an ast-grep MCP exists (affects S12/#165) — else text-search fallback stands
- [ ] Confirm the exact GitHub MCP tool names for subagent `tools:` frontmatter scoping (build-time)
- [ ] TypeScript vs other language for `orchestrate-mcp` — recommended TypeScript (mature MCP SDK); confirm at S1

---

## Session Notes

This was a long grill-me design session. The user added several requirements mid-grill that reshaped the design: the total Bash ban (→ MCP capability model), complexity-based model/effort routing, eye-friendly HTML colors, the 40% context handoff with successor windows, and `/goal` integration. All are folded into PRD #153. The repo convention chain `grill-me → /to-prd → /to-issues → /triage` is now complete; the next phase is pure build. The advisor was consulted at the architecture pivot and caught three silent transformations (worktree-via-MCP, effort-variant collapse, conflict-resolver as a 4th role) — all subsequently confirmed with the user.

---

_This handoff was generated via /handoff. Start a new session, read PRD #153 and issue #154, and begin the build._
