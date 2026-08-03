# Context handoff — watchdog, flag, and successor session

A long orchestration run can exhaust the orchestrator session before every wave
is done — either by filling its **context window** or by spending its
**subagent-spawn budget**. Rather than degrade or stop, the run **hands off**:
a fresh Claude Code session is launched, it resumes from the `run-state.json`
checkpoint, and the predecessor exits. This file documents the three pieces.

## 1. The `context-watchdog` hook

`context-watchdog` is a `PostToolUse` hook bundled with the orchestrate plugin
(`hooks/hooks.json`). It runs after every tool call, asynchronously, and is a
**silent no-op unless an orchestration run is in progress**.

The hook event carries the session `cwd`, `transcript_path`, and `session_id`
— never a runId. The watchdog therefore first **discovers the run this session
drives**, via a shared run-discovery module any hook can import (not
watchdog-specific internals):

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

1. **Records the spawn**, when the event's `tool_name` is `Agent`: one line is
   appended to the run's `spawn-log.jsonl` (see below), tagged with the event's
   `session_id`.
2. Reads the session transcript and finds the latest assistant turn's token
   usage (`input_tokens` + `cache_creation_input_tokens` +
   `cache_read_input_tokens`).
3. Compares **two budgets** against their thresholds from
   `.orchestrate/handoff.json`:
   - **Context window** — used tokens against `contextWindowTokens` and
     `thresholdPercent` (defaults: 40% of a 200000-token window).
   - **Session spawn budget** — the spawn log's line count **for this session**
     against `sessionSpawnBudget` and `spawnThresholdPercent` (defaults: 40% of
     200 spawns). At roughly five spawns per slice, a long run can spend its
     spawn budget well before it fills its context, and a watchdog that only
     watched tokens would report all-clear while the run walked into an
     unrecoverable spawn error.
4. On the first sample where **either** budget reaches its threshold, writes the
   selected run's `.orchestrate/runs/<runId>/context-flag.json` — under that
   run's own run directory, never another's — and surfaces a `systemMessage`
   naming the budget that raised it. The flag is written **at most once per
   run**: `context-flag.json`'s existence is checked before every raise, so
   whichever threshold arrives first suppresses every later one, no matter which
   budget crosses next. When both cross on the same sample, the flag reports
   `trigger: "tokens"` — a deterministic, documented tiebreak, since the flag is
   written once and can name only one reason.

**The two thresholds are independent.** Token usage may be unknown — there is no
transcript, it is unreadable, or its latest turns carry no usage yet, since the
transcript is written asynchronously and may lag. Unknown usage skips only the
**token** comparison; the spawn comparison still runs, and the flag records
`usedTokens: null` rather than pretending usage was zero.

**Why a spawn log rather than a transcript scan.** The watchdog counts spawns
from a file it writes itself, for two structural reasons. The transcript is read
tail-capped (the watchdog only needs the latest turn), so a tail scan would miss
most of a long run's spawns — and lifting the cap would mean an unbounded
full-file read on every tool call. More decisively, **nested spawns never appear
in the orchestrator's transcript at all**, yet they count fully toward the
platform's session budget — and plugin hooks *do* fire inside subagents, so a
nested spawn is recorded whenever its event resolves to the same active run,
which a transcript scan could never manage. That resolution has two conditions,
and neither is guaranteed for a subagent-fired event: it runs through the
event's `cwd` (the run is discovered by scanning `<cwd>/.orchestrate/runs/`,
and the vendor documents `cwd` only as the working directory the hook was
invoked in, never stating what a subagent-fired event carries), and it then
needs either a `session_id` match against `driverSessionId` or exactly one
in-progress run — so with two concurrent runs an unmatched event resolves to
nothing. An unresolved event is a silent no-op, so the recorded count is a
**lower bound** on the platform's: the watchdog may raise later than ideal,
never on a spawn that did not happen.

Two properties of that counting are worth knowing: `PostToolUse` fires after a
tool **succeeds**, so a synchronous `Agent` call is recorded when the subagent
finishes rather than when it starts (acceptable for a cumulative, monotonic
budget — the platform counts a finished subagent too), and spawns made **before
the run started** are not counted, since the watchdog is a no-op until a run is
in progress.

The hook never throws and never blocks a tool call; a watchdog that disrupts
the session would be worse than one that misses.

## 2. `context-flag.json` — the handoff signal

A small JSON file the watchdog writes when the threshold is reached. It lives in
the run's per-run directory, at `.orchestrate/runs/<runId>/context-flag.json`:

```json
{
  "raisedAt": "2026-05-21T10:24:00Z",
  "trigger": "tokens",
  "usedTokens": 134750,
  "contextWindowTokens": 200000,
  "thresholdPercent": 40,
  "usagePercent": 67.4,
  "spawnCount": 62,
  "sessionSpawnBudget": 200,
  "spawnThresholdPercent": 40,
  "spawnPercent": 31
}
```

Its **existence** is the signal. The wave loop checks for it after each slice
integrates (SKILL.md section 2); the successor **deletes it on startup**
(SKILL.md section 1) once consumed — a stale flag would make the successor hand
off again immediately, an infinite spawn loop.

`trigger` records **which** budget raised the flag — `"tokens"` or `"spawns"` —
so which threshold arrived first is readable after the fact rather than
inferred. Both budgets' figures are recorded either way. On a spawn-triggered
raise whose token usage was never observable, `usedTokens` and `usagePercent`
are `null`: unknown usage is recorded as unknown, never as zero.

It is ephemeral run state, not config — it lives in `.orchestrate/runs/<runId>/`
alongside `run-state.json` and the run's `spawn-log.jsonl`, which the target
project should gitignore. `spawn-log.jsonl` is the watchdog's own append-only
record, one line per observed spawn; it is removed with the run directory.

**The log is stored per run but counted per session.** The platform's spawn cap
is a *session* cap that resets in a new session, while the log survives a
handoff along with the `runId`. Each line therefore carries the `session` that
wrote it, and only the current session's lines are counted — so a successor
starts from its own fresh budget. This is why nothing deletes the log on
startup, unlike `context-flag.json`: a run is also resumed **without** a handoff,
in the same session whose budget did *not* reset, and clearing the log there
would under-count a session that had already spent part of its budget. A line
with no session tag — one written by an older version of the plugin, or a torn
line — is counted toward whichever session is asking: it cannot be attributed,
and over-counting only hands off early, while under-counting is what walks a run
into the unrecoverable error.

## 3. `.orchestrate/handoff.json` — configuration (optional)

Tunes the watchdog and the successor launcher. **Entirely optional**: when the
file is absent, built-in defaults apply; when it is present but malformed, the
defaults apply and `spawn_successor` reports a `configWarning`. Copy the
plugin's `templates/handoff.json` to `.orchestrate/handoff.json` to customize.

One consequence of adding a field is worth knowing: a key the schema did not
recognize was silently **stripped**, so any value was tolerated. Once that key
becomes a real field it is **validated**, and an off-schema value now sends the
whole file down the defaults-plus-warning path. That is the correct behaviour —
a `spawnThresholdPercent` of `150` should not be honoured silently — but a
config that "worked" before can start reporting a warning after an upgrade.

| Field | Default | Meaning |
| --- | --- | --- |
| `watchdog.thresholdPercent` | `40` | Raise the flag at this percentage of the window. |
| `watchdog.contextWindowTokens` | `200000` | Window the percentage measures against. Set to `1000000` for a 1M-context session. |
| `watchdog.spawnThresholdPercent` | `40` | Raise the flag at this percentage of the spawn budget. Mirrors `thresholdPercent`. |
| `watchdog.sessionSpawnBudget` | `200` | Total subagent spawns the session may make — the platform's own per-session default, which `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION` changes. Nested and background subagents count toward it, and a finished subagent still counts. |
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
