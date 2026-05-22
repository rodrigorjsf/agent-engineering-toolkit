import * as path from "path";

// ─── Per-run directory resolver ───────────────────────────────────────────────
//
// Every orchestration run keeps its ephemeral state — the run-state checkpoint,
// the context-flag, and the rendered HTML artifacts — under a per-run directory,
// `.orchestrate/runs/<runId>/`. The committed config files (`commands.json`,
// `routing.json`, `handoff.json`) stay flat at the `.orchestrate/` top level and
// are NOT resolved here.
//
// This module is a pure function of `(repoPath, runId)` — no filesystem I/O —
// so it is directly unit-testable and callers can resolve paths without side
// effects. It is the structural foundation for concurrent runs: two distinct
// run ids can never resolve to a shared path.

/**
 * Allowed `runId` shape. The skill mints run ids in two prefixed forms:
 * `prd<N>-<timestamp>` for a run partitioned to one parent PRD's children
 * (e.g. `prd195-20260521-015143`), and `backlog-<timestamp>` for a
 * no-argument whole-backlog run (e.g. `backlog-20260521-015143`). Both reduce
 * to letters, digits, and hyphens, which this pattern admits — the `prd<N>-`
 * prefix is also what the startup scan parses to disambiguate which run to
 * resume. The pattern is also the path-traversal guard: a `runId` flows into
 * `path.join`, so an id like `../../etc` or one carrying a separator must be
 * rejected before it can escape the run directory.
 */
const RUN_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The ephemeral paths owned by one orchestration run. */
export interface RunPaths {
  /** The per-run directory: `<repoPath>/.orchestrate/runs/<runId>/`. */
  runDir: string;
  /** The run-state checkpoint inside the run directory. */
  runStatePath: string;
  /** The context-handoff flag file inside the run directory. */
  contextFlagPath: string;
  /** The rendered dashboard HTML artifact inside the run directory. */
  dashboardPath: string;
  /** The rendered dependency-graph HTML artifact inside the run directory. */
  graphPath: string;
  /** The rendered report HTML artifact inside the run directory. */
  reportPath: string;
}

/** Discriminated result of {@link resolveRunDir}. */
export type ResolveRunDirResult =
  | { ok: true; paths: RunPaths }
  | { ok: false; errorCode: "RUN_ID_INVALID"; errorMessage: string };

/**
 * Returns true when `runId` is a safe run-directory name: a non-empty string of
 * letters, digits, underscores, and hyphens only. This admits both prefixed
 * forms the skill mints — `prd<N>-<timestamp>` and `backlog-<timestamp>` —
 * since neither introduces a character outside that class. Anything that could
 * traverse out of the run directory (`..`, a path separator, a dot) is
 * rejected, prefix or no prefix. Pure.
 */
export function isValidRunId(runId: string): boolean {
  return RUN_ID_PATTERN.test(runId);
}

/**
 * Resolves a `runId` to its ephemeral paths under
 * `<repoPath>/.orchestrate/runs/<runId>/`. The `runId` is one of the skill's
 * minted forms — `prd<N>-<timestamp>` or `backlog-<timestamp>` — so two
 * concurrent runs (one partitioned, one whole-backlog) always resolve to
 * disjoint run directories. Pure — performs no filesystem I/O; the caller is
 * responsible for `mkdirSync` before any write.
 *
 * A malformed `runId` (one that fails {@link isValidRunId}) is returned as a
 * structured `RUN_ID_INVALID` error rather than throwing — the resolver never
 * throws, in keeping with the discriminated-result contract of the tools that
 * consume it. Two distinct valid run ids always resolve to disjoint paths.
 */
export function resolveRunDir(
  repoPath: string,
  runId: string
): ResolveRunDirResult {
  if (!isValidRunId(runId)) {
    return {
      ok: false,
      errorCode: "RUN_ID_INVALID",
      errorMessage:
        `Invalid runId '${runId}': a runId must be a non-empty string of ` +
        `letters, digits, underscores, and hyphens (e.g. '20260521-015143').`,
    };
  }

  const runDir = path.join(repoPath, ".orchestrate", "runs", runId);
  return {
    ok: true,
    paths: {
      runDir,
      runStatePath: path.join(runDir, "run-state.json"),
      contextFlagPath: path.join(runDir, "context-flag.json"),
      dashboardPath: path.join(runDir, "dashboard.html"),
      graphPath: path.join(runDir, "graph.html"),
      reportPath: path.join(runDir, "report.html"),
    },
  };
}
