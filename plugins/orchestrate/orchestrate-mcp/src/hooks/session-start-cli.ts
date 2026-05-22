#!/usr/bin/env node
import * as fs from "fs";
import { buildSessionEnvLine } from "./session-start.js";

// Entry point for the orchestrate `SessionStart` hook. Claude Code pipes the
// hook event JSON on stdin and exposes a `CLAUDE_ENV_FILE` env var pointing at
// a file whose `export` lines are sourced into every subsequent Bash command of
// the session.
//
// This hook captures the session's own `session_id` and persists it as
// `ORCHESTRATE_SESSION_ID`, so the orchestrator — the sole Bash owner — can
// read `$ORCHESTRATE_SESSION_ID` at run start and record it in run-state as the
// run's driver-session identity. The context-watchdog later matches that
// identity to bind itself to the correct run when several runs proceed
// concurrently in one repository.
//
// It always exits 0 — a hook must never fail a session — and is a silent no-op
// when `CLAUDE_ENV_FILE` is unset or `session_id` is absent. That negative path
// is safe: the orchestrator simply finds `$ORCHESTRATE_SESSION_ID` empty,
// records no identity, and the run proceeds without automatic context-handoff.

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
    const envFile = process.env.CLAUDE_ENV_FILE;
    // No env file to persist into — nothing to do. The orchestrator's
    // safe-no-op fallback covers the missing-identity case.
    if (typeof envFile !== "string" || envFile.length === 0) {
      process.exit(0);
    }

    const event = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const sessionId =
      typeof event.session_id === "string" ? event.session_id : undefined;

    const line = buildSessionEnvLine(sessionId);
    if (line === null) {
      process.exit(0);
    }

    // Append (not overwrite) — other SessionStart hooks may share the file.
    fs.appendFileSync(envFile, line);
  } catch {
    // Any failure is swallowed — the hook must not disrupt the session.
  }
  process.exit(0);
}

void main();
