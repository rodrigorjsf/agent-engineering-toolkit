#!/usr/bin/env node
import { runWatchdog } from "./context-watchdog.js";

// Entry point for the `context-watchdog` PostToolUse hook. Claude Code pipes
// the hook event JSON on stdin; this script estimates the session's context
// usage and raises the orchestrate handoff flag past the threshold. It always
// exits 0 — a hook must never fail a tool call — and only emits output on the
// turn the flag is first raised, so it stays silent in unrelated sessions.

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
    const result = runWatchdog({
      transcriptPath:
        typeof event.transcript_path === "string"
          ? event.transcript_path
          : undefined,
      cwd: typeof event.cwd === "string" ? event.cwd : process.cwd(),
    });

    if (result.flagRaised && result.evaluation) {
      const e = result.evaluation;
      process.stdout.write(
        JSON.stringify({
          systemMessage:
            `orchestrate context-watchdog: context at ${e.usagePercent}% of ` +
            `${e.contextWindowTokens} tokens (threshold ${e.thresholdPercent}%). ` +
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
