#!/usr/bin/env node
import { runWatchdog } from "./context-watchdog.js";
import { findActiveRunForSession } from "./run-discovery.js";

// Entry point for the `context-watchdog` PostToolUse hook. Claude Code pipes
// the hook event JSON on stdin; this script samples the session's two budgets —
// context usage and the run's subagent-spawn count — and raises the orchestrate
// handoff flag past either threshold. It always exits 0 — a hook must never
// fail a tool call — and only emits output on the turn the flag is first
// raised, so it stays silent in unrelated sessions.
//
// Two event fields are forwarded to the watchdog beyond what run discovery
// needs. `tool_name` identifies a SPAWN: an `Agent` call appends one line to
// the run's spawn log, which is how the session spawn budget is counted at all.
// `session_id` says whose budget that spawn spends — the log outlives a handoff
// with its run, while the platform's cap resets per session, so each line is
// tagged and only the current session's lines are counted.
//
// The hook event carries `cwd`, `transcript_path`, and `session_id` — never a
// runId. Run state lives in per-run directories (.orchestrate/runs/<runId>/),
// so the hook first discovers the active run by matching the event's
// `session_id` against each in-progress run's recorded driver-session identity
// (`findActiveRunForSession`), then runs the watchdog against that run. When
// several runs proceed concurrently and the session cannot be disambiguated,
// discovery returns null and the hook is a silent no-op — the run stays
// correct and merely loses automatic context-handoff for this invocation.
// With no active run at all, it is likewise a silent no-op.

/** Reads all of stdin as a string. Resolves with whatever arrived on error. */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

async function main(): Promise<void> {
  let raw = "";
  try {
    raw = await readStdin();
  } catch {
    process.exit(0);
  }

  try {
    const event = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const cwd = typeof event.cwd === "string" ? event.cwd : process.cwd();
    // An EMPTY `session_id` is treated as absent, the same guard
    // `findActiveRunForSession` applies. An empty string is not an identity:
    // tagging a spawn with it would partition the count on a value no earlier
    // line can carry, hiding every one of them — an under-count, the single
    // direction this counting is built to avoid. Absent instead means every
    // line counts, which only hands off early.
    const sessionId =
      typeof event.session_id === "string" && event.session_id.length > 0
        ? event.session_id
        : undefined;

    // Discover the run this session drives. With concurrent runs, the session
    // identity disambiguates; when it cannot, discovery returns null and the
    // watchdog has nothing safe to do.
    const runId = findActiveRunForSession(cwd, sessionId);
    if (runId === null) {
      process.exit(0);
    }

    const result = runWatchdog({
      transcriptPath:
        typeof event.transcript_path === "string"
          ? event.transcript_path
          : undefined,
      cwd,
      runId,
      toolName: typeof event.tool_name === "string" ? event.tool_name : undefined,
      // The same `session_id` that discovery matched on — here it charges the
      // spawn to the session whose budget it actually spends, so a successor
      // session inheriting this run's spawn log starts from its own budget.
      sessionId,
    });

    if (result.flagRaised && result.evaluation) {
      const e = result.evaluation;
      // The message names the budget that actually raised the flag — a
      // spawn-triggered raise reported in token phrasing would send a reader
      // looking at the wrong number.
      const reason =
        e.trigger === "spawns"
          ? `${e.spawnCount} of ${e.sessionSpawnBudget} session subagent ` +
            `spawns used (${e.spawnPercent}%, threshold ` +
            `${e.spawnThresholdPercent}%)`
          : `context at ${e.usagePercent}% of ${e.contextWindowTokens} tokens ` +
            `(threshold ${e.thresholdPercent}%)`;
      process.stdout.write(
        JSON.stringify({
          systemMessage:
            `orchestrate context-watchdog: ${reason}. ` +
            `Handoff flag raised — the run will hand off to a successor ` +
            `session after the current slice finishes.`,
        })
      );
    }
  } catch {
    // Any failure is swallowed — the watchdog must not disrupt the session.
  }
  process.exit(0);
}

void main();
