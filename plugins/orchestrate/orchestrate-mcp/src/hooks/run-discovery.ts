import * as path from "path";
import * as fs from "fs";

// Shared run-discovery for hooks: answers "is an orchestration run in
// progress in this repository, and which one does this session drive?"
// Originally lived inside `context-watchdog.ts`; extracted so any hook can
// import it without coupling to an unrelated hook's module (#353). The
// `context-watchdog` hook consumes this module from its CLI entry point
// (`context-watchdog-cli.ts`), which is the only piece of that hook that
// needs a runId resolved from the raw hook event. Reads the filesystem but
// never throws — a hook that crashes a session is worse than one that misses.

/** One in-progress run discovered by {@link scanInProgressRuns}. */
interface InProgressRun {
  /** The run directory name — the `runId`. */
  runId: string;
  /**
   * The run's recorded driver-session identity, or null when the run-state
   * file carries no `driverSessionId` (a legacy/older checkpoint) or it is
   * not a string.
   */
  driverSessionId: string | null;
}

/**
 * Scans `.orchestrate/runs/*` and returns one {@link InProgressRun} per run
 * whose `run-state.json` has `status: "in-progress"`. Reads the filesystem but
 * never throws — a missing runs directory yields `[]`, and a malformed or
 * unreadable `run-state.json` is silently skipped. The `status` gate is the
 * only inclusion rule: completed runs are never returned.
 */
function scanInProgressRuns(cwd: string): InProgressRun[] {
  const runsDir = path.join(cwd, ".orchestrate", "runs");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(runsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const runs: InProgressRun[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const statePath = path.join(runsDir, entry.name, "run-state.json");
    let runState: unknown;
    try {
      runState = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch {
      continue;
    }
    if (
      typeof runState !== "object" ||
      runState === null ||
      (runState as Record<string, unknown>).status !== "in-progress"
    ) {
      continue;
    }
    // A missing or non-string driverSessionId degrades to null — never a
    // crash. Legacy run-state files predate this field entirely.
    const rawId = (runState as Record<string, unknown>).driverSessionId;
    runs.push({
      runId: entry.name,
      driverSessionId: typeof rawId === "string" ? rawId : null,
    });
  }
  return runs;
}

/**
 * Scans `.orchestrate/runs/*` for the first run whose `run-state.json` has
 * `status: "in-progress"` and returns its `runId`, or null when none is found.
 * Pure-ish — reads the filesystem but never throws.
 *
 * A hook event carries only the session `cwd`, never a `runId`, so a hook must
 * discover the active run before it can resolve the per-run paths. This is the
 * simpler single-active-run form: it ignores session identity, so with two or
 * more in-progress runs it returns whichever the directory scan yields first.
 * Prefer {@link findActiveRunForSession}, which disambiguates concurrent runs
 * by the driver-session identity and no-ops safely when it cannot decide
 * (#196).
 */
export function discoverActiveRunId(cwd: string): string | null {
  const runs = scanInProgressRuns(cwd);
  return runs.length > 0 ? runs[0].runId : null;
}

/**
 * Resolves which in-progress run a hook invocation belongs to, given the
 * session id the hook event carried. Reads the filesystem but never throws.
 *
 * The decision binds a global hook (e.g. the `context-watchdog` `PostToolUse`
 * hook) to the correct run when several runs proceed concurrently in one
 * repository (#196):
 *
 * - Only runs whose `run-state.json` `status` is `in-progress` are considered.
 * - When `sessionId` is given and **exactly one** in-progress run records a
 *   matching `driverSessionId`, that run is returned — the positive identity
 *   match.
 * - Otherwise, when **exactly one** run is in-progress at all, it is returned:
 *   with a single run there is no "wrong run" to mistakenly flag, so the
 *   caller still acts even if no session identity is available or matched
 *   (this also covers legacy run-state files with no `driverSessionId`).
 * - In every other case — two or more in-progress runs with no unambiguous
 *   single match — discovery cannot disambiguate and `null` is returned, so
 *   the caller safely no-ops rather than risk acting on the wrong run.
 *
 * Returning `null` is always safe: the run stays correct and merely loses
 * whatever automatic behaviour the caller would have driven for this
 * invocation.
 */
export function findActiveRunForSession(
  cwd: string,
  sessionId: string | undefined
): string | null {
  const runs = scanInProgressRuns(cwd);
  if (runs.length === 0) return null;

  // Positive identity match: exactly one in-progress run claims this session.
  if (typeof sessionId === "string" && sessionId.length > 0) {
    const matches = runs.filter((r) => r.driverSessionId === sessionId);
    if (matches.length === 1) return matches[0].runId;
    // matches.length >= 2 — the same session id binds multiple runs, which is
    // ambiguous; fall through to the single-run fast path, which also fails.
  }

  // Single-run fast path: one in-progress run means no "wrong run" exists.
  if (runs.length === 1) return runs[0].runId;

  // Two or more in-progress runs and no unambiguous match — cannot decide.
  return null;
}
