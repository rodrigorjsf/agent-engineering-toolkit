#!/usr/bin/env node
import { decideReadGuard, denyPayload } from "./read-guard.js";
import { findActiveRunForSession } from "./run-discovery.js";

// Entry point for the `read-guard` PreToolUse hook. Claude Code pipes the hook
// event JSON on stdin; this script asks `read-guard.ts` whether the call is the
// orchestrator opening a slice-internal artifact, and on a deny writes the
// `hookSpecificOutput` payload to stdout. Every decision — deny and no-decision
// alike — exits 0: JSON output is only processed on exit 0, and silence plus
// exit 0 is the documented "no decision, normal permission flow applies" path.
// A blocking hook that crashed would be worse than one that missed, so the
// whole body is wrapped in a swallowing try/catch.
//
// All judgement lives in the pure module. This file does two things the module
// cannot: it reads the event, and it resolves the active run from the
// filesystem — the same split `context-watchdog-cli.ts` uses, where
// `findActiveRunForSession` is called here rather than inside the hook module.
//
// The run resolution is also the guard's OFF SWITCH: with no in-progress run,
// or with concurrent runs this session cannot be disambiguated against,
// discovery returns null and every path is allowed. That short-circuit is
// duplicated inside the module (which no-ops on an absent `activeRunId`), so
// the behaviour is unit-testable rather than reachable only through a process.

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
    // `findActiveRunForSession` applies — an empty string is not an identity.
    const sessionId =
      typeof event.session_id === "string" && event.session_id.length > 0
        ? event.session_id
        : undefined;

    const runId = findActiveRunForSession(cwd, sessionId);
    if (runId === null) {
      process.exit(0);
    }

    const decision = decideReadGuard({
      toolName: typeof event.tool_name === "string" ? event.tool_name : undefined,
      toolInput:
        typeof event.tool_input === "object" && event.tool_input !== null
          ? (event.tool_input as Record<string, unknown>)
          : undefined,
      // Present ONLY inside a subagent call, which is what makes it — and not
      // `agent_type`, which a `--agent` session also carries — the main-thread
      // discriminator.
      agentId: typeof event.agent_id === "string" ? event.agent_id : undefined,
      cwd,
      activeRunId: runId,
    });

    if (decision.decision === "deny") {
      process.stdout.write(JSON.stringify(denyPayload(decision.reason)));
    }
  } catch {
    // Any failure is swallowed — the guard must not disrupt the session.
  }
  process.exit(0);
}

void main();
