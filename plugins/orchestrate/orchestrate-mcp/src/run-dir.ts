import * as path from "path";

// ─── Per-run directory resolver ───────────────────────────────────────────────
//
// Every orchestration run keeps its ephemeral state — the run-state checkpoint,
// the context-flag, the spawn log, and the rendered HTML artifacts — under a
// per-run directory, `.orchestrate/runs/<runId>/`. The committed config files
// (`commands.json`, `routing.json`, `handoff.json`) stay flat at the
// `.orchestrate/` top level and are NOT resolved here.
//
// Everything resolved here is REMOVED WHOLESALE with the run directory —
// `clean-runs.ts` deletes it with a recursive `rmSync`, so a new per-run file
// added to {@link RunPaths} needs no matching cleanup change.
//
// The run directory ALSO holds one **slice progress record per slice**
// (ADR-0017) — `slice-<issue>-progress.json`, resolved by
// {@link resolveSliceProgressPath}. It is deliberately per-slice, not one file
// per run: a parallel wave processes several slices concurrently inside ONE
// run directory, so a single shared `progress.json` would have sibling slices
// silently clobber each other's resume anchor. Because the issue id becomes a
// path segment, it needs exactly the same traversal guard the `runId` has — an
// unguarded id like `../../etc/passwd` would escape the run directory and break
// ADR-0012's invariant (3) by construction.
//
// This module is a pure function of its arguments — no filesystem I/O — so it
// is directly unit-testable and callers can resolve paths without side effects.
// It is the structural foundation for concurrent runs: two distinct run ids can
// never resolve to a shared path, and within one run, two distinct issue ids
// can never resolve to a shared record.

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
  /**
   * The run's append-only spawn log inside the run directory — one line per
   * subagent spawn observed while the run is in progress. It is what the
   * context-watchdog's SECOND threshold (the session spawn budget) counts.
   */
  spawnLogPath: string;
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

/** Discriminated result of {@link resolveSliceProgressPath}. */
export type ResolveSliceProgressPathResult =
  | { ok: true; path: string }
  | {
      ok: false;
      errorCode: "RUN_ID_INVALID" | "ISSUE_INVALID";
      errorMessage: string;
    };

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
      spawnLogPath: path.join(runDir, "spawn-log.jsonl"),
      dashboardPath: path.join(runDir, "dashboard.html"),
      graphPath: path.join(runDir, "graph.html"),
      reportPath: path.join(runDir, "report.html"),
    },
  };
}

/**
 * Returns true when `issue` is a safe slice-record filename segment: a positive
 * safe integer, matching the `z.number().int()` shape every issue id already
 * carries in this package.
 *
 * The number type is itself the traversal guard — a number can never contribute
 * a `..` or a path separator — but the check is still made at runtime because
 * MCP tool input crosses a process boundary, and this is an exported function a
 * TypeScript caller can reach with a value the compiler never saw. `0` and
 * negatives are rejected: GitHub issue numbers start at 1, so anything else is
 * a caller bug, not a slice. Pure.
 */
export function isValidIssueId(issue: number): boolean {
  return typeof issue === "number" && Number.isSafeInteger(issue) && issue > 0;
}

/**
 * Resolves one slice's progress record to
 * `<repoPath>/.orchestrate/runs/<runId>/slice-<issue>-progress.json` — the
 * per-slice resume anchor the slice executor writes at each completed stage
 * (ADR-0017).
 *
 * Composed on {@link resolveRunDir} so the run scoping is INHERITED rather than
 * re-derived: whatever keeps the run directory isolated keeps the record
 * isolated too. The filename then carries the issue id, which is what keeps the
 * concurrent slices of one parallel wave from clobbering each other inside the
 * single run directory they share.
 *
 * The `slice-<issue>-progress.json` filename is a PUBLIC CONTRACT, not an
 * implementation detail: the orchestrator passes the record's path forward
 * while `recover_slice_progress` derives the same path from `(runId, issue)`,
 * so both sides depend on this one convention. It is documented in
 * `references/run-state.md` alongside the run directory's other contents.
 *
 * Pure — performs no filesystem I/O; the caller is responsible for `mkdirSync`
 * before any write. Never throws: a malformed `runId` or `issue` comes back as
 * a structured `RUN_ID_INVALID` / `ISSUE_INVALID` error, keeping the derived
 * path inside `runs/<runId>/` for every input (ADR-0012 invariant 3).
 */
export function resolveSliceProgressPath(
  repoPath: string,
  runId: string,
  issue: number
): ResolveSliceProgressPathResult {
  const resolved = resolveRunDir(repoPath, runId);
  if (!resolved.ok) {
    return {
      ok: false,
      errorCode: resolved.errorCode,
      errorMessage: resolved.errorMessage,
    };
  }

  if (!isValidIssueId(issue)) {
    return {
      ok: false,
      errorCode: "ISSUE_INVALID",
      errorMessage:
        `Invalid issue '${String(issue)}': an issue must be a positive ` +
        `integer (e.g. 355). The id becomes part of the record's filename, so ` +
        `anything else is rejected before it can escape the run directory.`,
    };
  }

  return {
    ok: true,
    path: path.join(resolved.paths.runDir, `slice-${issue}-progress.json`),
  };
}
