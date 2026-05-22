// Pure core for the orchestrate `SessionStart` hook. The hook captures the
// session's own `session_id` so the orchestrator can record it in run-state as
// the run's driver-session identity — the key the context-watchdog matches to
// bind itself to the correct run when several runs proceed concurrently.
//
// The functions here are pure (no I/O) and so directly unit-testable; the CLI
// shell (`session-start-cli.ts`) wires them to stdin and `CLAUDE_ENV_FILE`.

/** The env var the orchestrator reads to learn its own session identity. */
export const SESSION_ID_ENV_VAR = "ORCHESTRATE_SESSION_ID";

/**
 * Single-quotes a value for safe inclusion in a POSIX shell `export`. Any
 * embedded single quote is escaped as `'\''` — close, escaped quote, reopen —
 * so an unexpected `session_id` shape can never break the shell parse of the
 * `CLAUDE_ENV_FILE`. Pure.
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Builds the `export` line to append to `CLAUDE_ENV_FILE` for the given
 * `session_id`, or null when the id is absent or empty — in which case the hook
 * writes nothing and the orchestrator's safe-no-op fallback applies. The line
 * is newline-terminated and shell-quoted. Pure.
 */
export function buildSessionEnvLine(
  sessionId: string | undefined
): string | null {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return null;
  }
  return `export ${SESSION_ID_ENV_VAR}=${shellQuote(sessionId)}\n`;
}
