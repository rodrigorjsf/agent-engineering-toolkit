# Context handoff — watchdog, flag, and successor session

A long orchestration run can fill the orchestrator session's context window
before every wave is done. Rather than degrade or stop, the run **hands off**:
a fresh Claude Code session is launched, it resumes from the `run-state.json`
checkpoint, and the predecessor exits. This file documents the three pieces.

## 1. The `context-watchdog` hook

`context-watchdog` is a `PostToolUse` hook bundled with the orchestrate plugin
(`hooks/hooks.json`). It runs after every tool call, asynchronously, and is a
**silent no-op unless an orchestration run is in progress**.

The hook event carries the session `cwd`, `transcript_path`, and `session_id`
— never a runId. The watchdog therefore first **discovers the run this session
drives**:

- It scans `.orchestrate/runs/*/run-state.json` and considers **only** runs
  whose `status` is `in-progress` — a completed run is never selected.
- When the event's `session_id` matches exactly one in-progress run's
  `driverSessionId`, that run is selected — the positive identity match. This
  is what binds the watchdog to the right run when several runs proceed
  concurrently in one repository.
- When exactly one run is in-progress at all, it is selected even with no
  identity match: with a single run there is no "wrong run" to flag, so the
  watchdog still acts (this also covers a legacy `run-state.json` with no
  `driverSessionId`).
- Otherwise — two or more in-progress runs with no unambiguous single match —
  the watchdog **cannot disambiguate and writes no flag**. The run stays
  correct; it merely loses automatic context-handoff for that invocation. The
  watchdog never writes the wrong run's `context-flag.json`.

The session's own identity is supplied by a companion `SessionStart` hook (also
in `hooks/hooks.json`): it captures the session `session_id` and persists it as
`ORCHESTRATE_SESSION_ID` into `CLAUDE_ENV_FILE`. The orchestrator reads
`$ORCHESTRATE_SESSION_ID` at run start and records it as `driverSessionId` in
`run-state.json`; a resuming successor session refreshes the field with its own
new `session_id`. When the identity is unavailable, `driverSessionId` is `null`
and the run runs in the degraded, no-auto-handoff mode described above.

With no active run the watchdog does nothing, so it is harmless in unrelated
sessions even though the plugin is always enabled.

When a run is selected it:

1. Reads the session transcript and finds the latest assistant turn's token
   usage (`input_tokens` + `cache_creation_input_tokens` +
   `cache_read_input_tokens`).
2. Compares that against the context window and threshold from
   `.orchestrate/handoff.json` (defaults: 40% of a 200000-token window).
3. On the first sample that reaches the threshold, writes the selected run's
   `.orchestrate/runs/<runId>/context-flag.json` — under that run's own run
   directory, never another's — and surfaces a `systemMessage`. The flag is
   written **at most once per run** — once it exists, later samples are no-ops.

The hook never throws and never blocks a tool call; a watchdog that disrupts
the session would be worse than one that misses.

## 2. `context-flag.json` — the handoff signal

A small JSON file the watchdog writes when the threshold is reached. It lives in
the run's per-run directory, at `.orchestrate/runs/<runId>/context-flag.json`:

```json
{
  "raisedAt": "2026-05-21T10:24:00Z",
  "usedTokens": 134750,
  "contextWindowTokens": 200000,
  "thresholdPercent": 40,
  "usagePercent": 67.4
}
```

Its **existence** is the signal. The wave loop checks for it after each slice
integrates (SKILL.md section 2); the successor **deletes it on startup**
(SKILL.md section 1) once consumed — a stale flag would make the successor hand
off again immediately, an infinite spawn loop.

It is ephemeral run state, not config — it lives in `.orchestrate/runs/<runId>/`
alongside `run-state.json`, which the target project should gitignore.

## 3. `.orchestrate/handoff.json` — configuration (optional)

Tunes the watchdog and the successor launcher. **Entirely optional**: when the
file is absent, built-in defaults apply; when it is present but malformed, the
defaults apply and `spawn_successor` reports a `configWarning`. Copy the
plugin's `templates/handoff.json` to `.orchestrate/handoff.json` to customize.

| Field | Default | Meaning |
| --- | --- | --- |
| `watchdog.thresholdPercent` | `40` | Raise the flag at this percentage of the window. |
| `watchdog.contextWindowTokens` | `200000` | Window the percentage measures against. Set to `1000000` for a 1M-context session. |
| `successor.claudeArgs` | `["--remote-control", "orchestrate-successor", "--permission-mode", "auto"]` | Flags for the successor's `claude` CLI invocation. |
| `successor.resumePrompt` | `"/orchestrate"` | Initial prompt — appended last, as a positional argument. |
| `successor.terminals` | Windows Terminal, then Warp | Ordered terminal fallback chain. |

### The terminal fallback chain

`successor.terminals` is an ordered list; `spawn_successor` tries each entry
and stops at the first that spawns. Each entry is `{ name, argv }` where
`argv[0]` is the executable. Two placeholders are substituted into every argv
token:

- `{claudeCommand}` — the full shell command: `cd <repoPath> && exec claude …`.
- `{repoPath}` — the repository root path.

The default chain targets a **WSL2** environment: **Windows Terminal first**
(`wt.exe new-tab … wsl.exe -- bash -lc "{claudeCommand}"`), Warp second. This
order reflects the environment the plugin was built against — Windows Terminal
is reliable from WSL2. To prefer Warp, reorder the array. The Warp entry
(`warp-terminal`) is a starting point; adjust `argv` to match your Warp
install. On a non-WSL2 host, replace the entries with your terminal's
new-window invocation.

## 4. `spawn_successor` and Remote Control

`spawn_successor` (an orchestrate MCP tool) builds the launch argv from
`handoff.json` and spawns the first working terminal **detached**, so the
predecessor MCP server can exit while the successor keeps running.

The default `claudeArgs` start the successor with `--remote-control` — a
documented `claude` CLI flag that starts an **interactive** session (never
print mode) that is additionally drivable from `claude.ai/code` or mobile. The
session name (`orchestrate-successor`) is passed **explicitly** right after
`--remote-control`; the `resumePrompt` is appended **last** as a positional
argument. This ordering is deliberate — `--remote-control` takes an optional
name value, so a prompt placed adjacent to it would be swallowed as the name.

The successor does not need a Claude-Code conversation resume (`--continue` /
`--resume`): it is a brand-new session. It resumes the *orchestration run*, a
separate layer, by re-invoking `/orchestrate`, which detects the
`run-state.json` checkpoint and continues.

The orchestrator derives the partition-correct invocation from the active run's
`runId` prefix — `/orchestrate <N>` for a `prd<N>-` run, bare `/orchestrate`
for a `backlog-` run — and passes it as `spawn_successor`'s `resumePrompt`,
which overrides `handoff.json`'s static `successor.resumePrompt`. The
orchestrator always derives and passes `resumePrompt`, so the table row above
remains the documented fallback default, used only when no `resumePrompt` is
passed (a manual or legacy launch); a single static prompt cannot encode the
partition per-run.
