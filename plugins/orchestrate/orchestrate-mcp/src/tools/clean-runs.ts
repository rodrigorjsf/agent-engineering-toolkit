import * as path from "path";
import * as fs from "fs";
import { z } from "zod";
import { gitExecFile, optionInjectionError, cleanGitError } from "../git.js";
import { isValidRunId } from "../run-dir.js";
import {
  checkCrossRunMutationAllowed,
  readRunState,
  type ParsedRunState,
} from "../run-state-guard.js";
import { removeWorktree } from "./worktree.js";

// ─── clean_runs — run cleanup sweep ───────────────────────────────────────────
//
// Removes the on-disk and git footprint of an orchestration run whose final
// integration pull request has merged into the integration base: its worktrees,
// its umbrella and slice branches (local and remote), and its run directory.
//
// The merged/open/closed-unmerged verdict is GitHub state, which only the `gh`
// CLI can read — and no MCP tool shells `gh`. So the orchestrator (the skill)
// computes each run's verdict with `gh pr view` and passes the verdict map in;
// this tool is purely git + filesystem, exactly like every other tool. A run
// the orchestrator did not supply a verdict for is left strictly intact — that
// is the orchestrator's signal that the run must not be touched (e.g. it is
// the current run, or another concurrently-in-progress run).
//
// Defense-in-depth: even when the verdict map says `merged`, this tool re-reads
// the run's `run-state.json` and refuses to act unless `status` is `completed`
// AND `finalPullRequest` is non-null. That re-check is the shared cross-run
// mutation gate `checkCrossRunMutationAllowed` (in `../run-state-guard.js`, the
// single chokepoint mandated by ADR-0012) — a tool-deterministic gate
// independent of the orchestrator's verdict map. An `in-progress` run, or a
// `completed` run with a null `finalPullRequest`, is never cleaned, whatever
// the verdict says.
//
// Every removal is best-effort and independently reported: an already-absent
// resource is success, not error, so the sweep is idempotent and one run's
// failure never aborts the others.
//
// ─── reclaim_run — the one sanctioned status-gate exception ────────────────────
//
// `reclaimRun` (below) is the deliberate exception to the defense-in-depth
// status gate. There is no `failed` run status — a crashed or abandoned run
// stays `in-progress` forever, so a status gate could never permit reclaiming
// it. `reclaimRun` therefore takes a REQUIRED single `runId`, reads its
// run-state directly, and removes that one run's complete footprint (passed AND
// failed worktrees, umbrella + slice branches, run dir) WITHOUT the status gate
// — the one ADR-0012 exception. It is scoped, by construction, to that single
// `runs/<runId>/` and its runId-embedding branches, so it can never touch
// another run. Its only protection is a mandatory interactive confirmation that
// lives in the skill, not this tool — `reclaimRun` is non-interactive execution.
// `cleanMergedRun` and `reclaimRun` share the same removal core
// (`removeRunFootprint`) so removal behavior is identical; only the gate (status
// for clean, none for reclaim) and the reported reason differ.

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

/** A per-run merge verdict, as resolved by the orchestrator via `gh pr view`. */
export const runVerdictSchema = z.enum([
  "merged",
  "open",
  "closed-unmerged",
  "unknown",
]);

export const cleanRunsInputSchema = z.object({
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the git repository whose `.orchestrate/runs/` directory is " +
        "swept. Defaults to the current working directory."
    ),
  verdicts: z
    .record(z.string(), runVerdictSchema)
    .describe(
      "Per-run merge-verdict map keyed by runId. Each value is the verdict " +
        "the orchestrator resolved for that run's final pull request via " +
        "`gh pr view`: 'merged' (the PR merged into the integration base — " +
        "the only verdict that triggers cleanup), 'open' (still open), " +
        "'closed-unmerged' (closed without merging), or 'unknown' (the " +
        "verdict could not be determined). A run found on disk but ABSENT " +
        "from this map is left strictly intact — its absence is the " +
        "orchestrator's signal not to touch it (e.g. the current run or a " +
        "concurrently-in-progress run)."
    ),
  force: z
    .boolean()
    .optional()
    .describe(
      "When true, a merged run's `failed`-state slice worktrees are removed " +
        "too and the run directory is always removed. Default false — a " +
        "failed-slice worktree is preserved for developer inspection and the " +
        "run directory is kept whenever any worktree was preserved."
    ),
});

/** What clean_runs decided to do with one run. */
export const runActionSchema = z.enum(["removed", "preserved", "skipped"]);

/** The keyed reason explaining a run's action. */
export const runReasonSchema = z.enum([
  // ── removed / preserved ──
  "merged-and-clean",
  "merged-with-preserved-worktrees",
  // The reclaim_run override's success reason: a single named run's footprint
  // (passed AND failed worktrees, umbrella + slice branches, run dir) removed
  // after the human confirmed the deletion set, bypassing the status gate.
  "failed-run-reclaimed",
  // ── skipped ──
  "final-pr-open",
  "final-pr-closed-unmerged",
  "verdict-unknown",
  "no-verdict-from-orchestrator",
  "run-not-completed",
  "final-pr-missing",
  "malformed-run-state",
  "missing-run-state",
  "invalid-run-id",
  // reclaim_run only: a valid runId whose `runs/<runId>/` dir does not exist on
  // disk — a structured skipped result, never a throw (idempotent re-reclaim).
  "run-not-found",
]);

/** A best-effort branch-deletion failure, scoped to local or remote. */
export const branchErrorSchema = z.object({
  branch: z.string().describe("The branch whose deletion failed."),
  scope: z
    .enum(["local", "remote"])
    .describe("Whether the failure was deleting the local or remote ref."),
  error: z
    .string()
    .describe("Cleaned, human-readable reason the deletion failed."),
});

/** The cleanup report for one run. */
export const runReportSchema = z.object({
  runId: z.string().describe("The run's timestamp id (its directory name)."),
  action: runActionSchema.describe(
    "What was done: 'removed' (run directory and all resources gone), " +
      "'preserved' (a merged run cleaned partially — some worktrees and the " +
      "run directory kept), or 'skipped' (the run was not eligible and " +
      "nothing was touched)."
  ),
  reason: runReasonSchema.describe(
    "The keyed reason explaining the action."
  ),
  removedWorktrees: z
    .array(z.string())
    .describe("Absolute paths of the slice worktrees that were removed."),
  preservedWorktrees: z
    .array(z.string())
    .describe(
      "Absolute paths of the slice worktrees that were preserved — " +
        "`failed`-state worktrees kept for inspection when force is false."
    ),
  removedBranches: z
    .array(z.string())
    .describe(
      "Branch names whose local and/or remote refs were deleted (or were " +
        "already absent — an absent ref counts as a successful removal)."
    ),
  branchErrors: z
    .array(branchErrorSchema)
    .describe(
      "Branch deletions that genuinely failed (not merely an absent ref). " +
        "Empty when every branch was removed cleanly."
    ),
  runDirRemoved: z
    .boolean()
    .describe(
      "True when the run directory `.orchestrate/runs/<runId>/` was removed."
    ),
});

export const cleanRunsOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the sweep ran (individual runs may still " +
        "have been skipped or partially cleaned — see each run's report); " +
        "'error' = the sweep itself could not run."
    ),
  runs: z
    .array(runReportSchema)
    .describe(
      "One report per run directory found under `.orchestrate/runs/`. Empty " +
        "when no runs directory exists or it holds no run directories."
    ),
  errorCode: z
    .enum(["INVALID_INPUT", "FS_ERROR"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='error'."
    ),
});

// ─── reclaim_run — the human-gated single-run override schemas ────────────────

export const reclaimRunInputSchema = z.object({
  runId: z
    .string()
    .describe(
      "The single run id (its `.orchestrate/runs/<runId>/` directory name) to " +
        "reclaim. REQUIRED — there is no sweep form. This is the human-gated " +
        "reclaim path for a crashed or abandoned run that looks `in-progress` " +
        "forever (there is no `failed` run status). It BYPASSES the " +
        "`status === 'completed'` cross-run isolation gate by design (the one " +
        "sanctioned exception in ADR-0012), and is scoped by construction to " +
        "this single `runs/<runId>/` and the branches embedding that runId, so " +
        "it can never touch another run. The mandatory interactive confirmation " +
        "that authorizes this deletion lives in the skill, not this tool."
    ),
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the git repository whose `.orchestrate/runs/<runId>/` is " +
        "reclaimed. Defaults to the current working directory."
    ),
});

export const reclaimRunOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the reclaim ran (the run may still have " +
        "been a no-op — e.g. `run-not-found` — see the report); 'error' = the " +
        "reclaim could not run (invalid input)."
    ),
  report: runReportSchema
    .optional()
    .describe(
      "The single-run cleanup report. Present when status='ok'. NOT an array — " +
        "reclaim_run acts on exactly one named run."
    ),
  errorCode: z
    .enum(["INVALID_INPUT", "FS_ERROR"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='error'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type RunVerdict = z.infer<typeof runVerdictSchema>;
export type CleanRunsInput = z.infer<typeof cleanRunsInputSchema>;
export type CleanRunsOutput = z.infer<typeof cleanRunsOutputSchema>;
export type RunReport = z.infer<typeof runReportSchema>;
export type BranchError = z.infer<typeof branchErrorSchema>;
export type ReclaimRunInput = z.infer<typeof reclaimRunInputSchema>;
export type ReclaimRunOutput = z.infer<typeof reclaimRunOutputSchema>;

// ─── Internal types ───────────────────────────────────────────────────────────

// `ParsedRunState` is imported from `../run-state-guard.js` — `cleanMergedRun`
// still reads its `umbrellaBranch`/`slices` fields. The cleanup-eligibility gate
// (status + finalPullRequest) lives entirely in that shared guard module.

/** One slice's cleanup-relevant fields. */
interface SliceInfo {
  sliceBranch: string | null;
  worktreePath: string | null;
  state: string | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns the slice records of a parsed run-state as a normalized array. A
 * malformed `slices` value yields an empty array — the caller still cleans the
 * umbrella branch and run directory.
 */
function extractSlices(slices: unknown): SliceInfo[] {
  if (slices === null || typeof slices !== "object" || Array.isArray(slices)) {
    return [];
  }
  const out: SliceInfo[] = [];
  for (const value of Object.values(slices as Record<string, unknown>)) {
    if (value === null || typeof value !== "object") {
      continue;
    }
    const s = value as Record<string, unknown>;
    out.push({
      sliceBranch: typeof s.sliceBranch === "string" ? s.sliceBranch : null,
      worktreePath:
        typeof s.worktreePath === "string" ? s.worktreePath : null,
      state: typeof s.state === "string" ? s.state : null,
    });
  }
  return out;
}

/**
 * True when a `cleanGitError` string indicates the ref simply did not exist —
 * which, for a cleanup tool, is success, not failure. Idempotency depends on
 * this: a re-run, or a run whose branches were never pushed, must not error.
 */
function isAbsentRefError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("remote ref does not exist") ||
    m.includes("not found") ||
    m.includes("does not exist") ||
    m.includes("couldn't find remote ref") ||
    /branch .* not found/.test(m)
  );
}

/**
 * Deletes a branch's local ref. An already-absent local ref is success. Returns
 * null on success, or a {@link BranchError} when the deletion genuinely failed.
 */
async function deleteLocalBranch(
  branch: string,
  repoPath: string
): Promise<BranchError | null> {
  const guardErr = optionInjectionError("branch", branch);
  if (guardErr) {
    return { branch, scope: "local", error: guardErr };
  }
  try {
    // `--` terminates option parsing; the branch name is a positional.
    await gitExecFile(["branch", "-D", "--", branch], repoPath);
    return null;
  } catch (err) {
    const message = cleanGitError(err);
    if (isAbsentRefError(message)) {
      return null; // never created, or already deleted — success.
    }
    return { branch, scope: "local", error: message };
  }
}

/**
 * Deletes a branch's remote ref on `origin`. An already-absent remote ref, and
 * the absence of an `origin` remote entirely, are both treated as success.
 * Returns null on success, or a {@link BranchError} when it genuinely failed.
 */
async function deleteRemoteBranch(
  branch: string,
  repoPath: string
): Promise<BranchError | null> {
  const guardErr = optionInjectionError("branch", branch);
  if (guardErr) {
    return { branch, scope: "remote", error: guardErr };
  }
  // No `origin` remote — nothing to delete remotely; that is success.
  try {
    const { stdout } = await gitExecFile(["remote"], repoPath);
    if (!stdout.split("\n").some((r) => r.trim() === "origin")) {
      return null;
    }
  } catch {
    return null; // cannot enumerate remotes — treat remote cleanup as a no-op.
  }
  try {
    // `--delete` removes the remote branch; `--` terminates option parsing.
    await gitExecFile(
      ["push", "origin", "--delete", "--", branch],
      repoPath
    );
    return null;
  } catch (err) {
    const message = cleanGitError(err);
    if (isAbsentRefError(message)) {
      return null; // remote ref already gone — success.
    }
    return { branch, scope: "remote", error: message };
  }
}

/**
 * Deletes a branch both locally and on the remote, best-effort. Mutates the
 * accumulating `removedBranches` / `branchErrors` lists in the run report.
 */
async function deleteBranch(
  branch: string,
  repoPath: string,
  report: { removedBranches: string[]; branchErrors: BranchError[] }
): Promise<void> {
  const local = await deleteLocalBranch(branch, repoPath);
  const remote = await deleteRemoteBranch(branch, repoPath);
  if (local) {
    report.branchErrors.push(local);
  }
  if (remote) {
    report.branchErrors.push(remote);
  }
  // The branch counts as removed when neither scope reported a genuine error
  // (an absent ref is not an error — it is the idempotent success case).
  if (!local && !remote) {
    report.removedBranches.push(branch);
  }
}

/** Builds a `skipped` run report with no resources touched. */
function skippedReport(
  runId: string,
  reason: z.infer<typeof runReasonSchema>
): RunReport {
  return {
    runId,
    action: "skipped",
    reason,
    removedWorktrees: [],
    preservedWorktrees: [],
    removedBranches: [],
    branchErrors: [],
    runDirRemoved: false,
  };
}

/**
 * The shared removal core for both `clean_runs`' merged-run cleanup and the
 * `reclaim_run` failed-run override. Given a parsed run-state it removes the
 * run's slice worktrees, deletes its umbrella and slice branches, and removes
 * the run directory — populating only the **mechanical** report fields
 * (`removedWorktrees` / `preservedWorktrees` / `removedBranches` /
 * `branchErrors` / `runDirRemoved`) and the `action`. The **reason** is the
 * caller's to set: `cleanMergedRun` keys it to `merged-and-clean` /
 * `merged-with-preserved-worktrees`, `reclaimRun` to `failed-run-reclaimed`.
 *
 * `removeFailedWorktrees` controls whether a `failed`-state slice's worktree is
 * removed (true) or preserved on disk for inspection (false). `cleanMergedRun`
 * passes the caller's `force`; `reclaimRun` passes `true` — the human already
 * confirmed the deletion set, so passed AND failed worktrees both go. When a
 * worktree is preserved (only possible with `removeFailedWorktrees: false`, or a
 * genuine removal failure) the run directory is kept so its `run-state.json`
 * survives, and the action is `preserved`; otherwise the run directory is
 * removed and the action is `removed`.
 */
async function removeRunFootprint(
  runId: string,
  runDir: string,
  state: ParsedRunState,
  repoPath: string,
  opts: { removeFailedWorktrees: boolean }
): Promise<RunReport> {
  const removeFailedWorktrees = opts.removeFailedWorktrees;
  const report: RunReport = {
    runId,
    action: "removed",
    // Mechanical placeholder — every caller overrides `reason` after this
    // helper returns, keying it to the caller's own semantics.
    reason: "merged-and-clean",
    removedWorktrees: [],
    preservedWorktrees: [],
    removedBranches: [],
    branchErrors: [],
    runDirRemoved: false,
  };

  const slices = extractSlices(state.slices);

  // Slice branches whose worktree was preserved: their branch is left fully
  // intact — local AND remote — so the inspecting developer can still check it
  // out and push from the preserved worktree. Deleting only the remote half
  // would leave that worktree's local branch unpushable.
  const preservedSliceBranches = new Set<string>();

  // ── Step 1: remove worktrees ──
  // A `failed`-state slice keeps its worktree on disk for inspection unless
  // `removeFailedWorktrees`. Worktree removal must run before branch deletion:
  // `git branch -D` refuses to delete a checked-out branch, so a still-present
  // worktree would turn into a (correctly reported) branch error.
  for (const slice of slices) {
    if (!slice.worktreePath) {
      continue;
    }
    if (slice.state === "failed" && !removeFailedWorktrees) {
      report.preservedWorktrees.push(slice.worktreePath);
      if (slice.sliceBranch) {
        preservedSliceBranches.add(slice.sliceBranch);
      }
      continue;
    }
    // removeFailedWorktrees:true — a slice worktree carries untracked build
    // artifacts, so it is removed even when dirty. An already-absent worktree is
    // success: the PATH_NOT_FOUND result is tolerated, not reported as an error.
    const removed = await removeWorktree({
      worktreePath: slice.worktreePath,
      repoPath,
      force: true,
    });
    if (removed.status === "ok" || removed.errorCode === "PATH_NOT_FOUND") {
      report.removedWorktrees.push(slice.worktreePath);
    } else {
      // The worktree could not be removed; keep it reported as preserved so
      // the run directory is conservatively retained, and its branch intact.
      report.preservedWorktrees.push(slice.worktreePath);
      if (slice.sliceBranch) {
        preservedSliceBranches.add(slice.sliceBranch);
      }
    }
  }

  // ── Step 2: delete branches (local then remote, best-effort) ──
  // A slice branch whose worktree was preserved is skipped entirely — the
  // branch belongs to a worktree a developer still needs to inspect.
  const branchNames = new Set<string>();
  if (typeof state.umbrellaBranch === "string" && state.umbrellaBranch) {
    branchNames.add(state.umbrellaBranch);
  }
  for (const slice of slices) {
    if (slice.sliceBranch && !preservedSliceBranches.has(slice.sliceBranch)) {
      branchNames.add(slice.sliceBranch);
    }
  }
  for (const branch of branchNames) {
    await deleteBranch(branch, repoPath, report);
  }

  // ── Step 3: remove the run directory ──
  // Keep the run directory whenever a worktree was preserved — the preserved
  // worktree's run-state.json must survive for the inspecting developer.
  // Remove it fully only when nothing was preserved.
  const anyPreserved = report.preservedWorktrees.length > 0;
  if (anyPreserved) {
    report.action = "preserved";
    report.runDirRemoved = false;
  } else {
    try {
      fs.rmSync(runDir, { recursive: true, force: true });
      report.runDirRemoved = true;
    } catch {
      // The run directory could not be removed; the branches and worktrees
      // are already gone — report the run dir as retained, not a hard error.
      report.runDirRemoved = false;
    }
    report.action = report.runDirRemoved ? "removed" : "preserved";
  }
  return report;
}

/**
 * Cleans one merged run: removes its `passed`-slice worktrees (and `failed`
 * ones too when `force`), deletes its umbrella and slice branches, and removes
 * the run directory unless a worktree was preserved (and not `force`).
 */
async function cleanMergedRun(
  runId: string,
  runDir: string,
  state: ParsedRunState,
  repoPath: string,
  force: boolean
): Promise<RunReport> {
  const report = await removeRunFootprint(runId, runDir, state, repoPath, {
    removeFailedWorktrees: force,
  });
  // Key the reason to clean_runs' merged-run semantics: a preserved worktree
  // (only possible without force) means a partial clean; otherwise a full one.
  report.reason =
    report.action === "preserved"
      ? "merged-with-preserved-worktrees"
      : "merged-and-clean";
  return report;
}

// ─── clean_runs ────────────────────────────────────────────────────────────────

/**
 * Sweeps `.orchestrate/runs/` and cleans up every run the orchestrator's
 * verdict map reports as `merged`. A run that is open, closed-unmerged, of
 * unknown verdict, absent from the map, not `completed`, or whose run-state is
 * malformed/absent is left strictly intact and only reported.
 *
 * Never throws — every failure mode is a structured result; one run's failure
 * never aborts the sweep of the others.
 */
export async function cleanRuns(
  input: CleanRunsInput
): Promise<CleanRunsOutput> {
  const repoPath = input.repoPath ?? process.cwd();
  const force = input.force ?? false;

  // Option-injection guard: reject a repoPath git would parse as a flag.
  const guardErr = optionInjectionError("repoPath", repoPath);
  if (guardErr) {
    return {
      status: "error",
      runs: [],
      errorCode: "INVALID_INPUT",
      errorMessage: guardErr,
    };
  }

  const runsRoot = path.join(repoPath, ".orchestrate", "runs");
  if (!fs.existsSync(runsRoot)) {
    // No runs directory — a clean no-op.
    return { status: "ok", runs: [] };
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(runsRoot, { withFileTypes: true });
  } catch (err) {
    return {
      status: "error",
      runs: [],
      errorCode: "FS_ERROR",
      errorMessage:
        err instanceof Error ? err.message : "Cannot read the runs directory.",
    };
  }

  const runs: RunReport[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const runId = entry.name;

    // Path-traversal guard: a directory name that is not a valid runId must
    // never flow into a path join — skip it, leaving it untouched.
    if (!isValidRunId(runId)) {
      runs.push(skippedReport(runId, "invalid-run-id"));
      continue;
    }

    const runDir = path.join(runsRoot, runId);
    const runStatePath = path.join(runDir, "run-state.json");

    // A run absent from the verdict map is left strictly intact — its absence
    // is the orchestrator's signal not to touch it.
    const verdict = input.verdicts[runId];
    if (verdict === undefined) {
      runs.push(skippedReport(runId, "no-verdict-from-orchestrator"));
      continue;
    }

    // A non-merged verdict: leave intact, report the verdict-keyed reason.
    if (verdict === "open") {
      runs.push(skippedReport(runId, "final-pr-open"));
      continue;
    }
    if (verdict === "closed-unmerged") {
      runs.push(skippedReport(runId, "final-pr-closed-unmerged"));
      continue;
    }
    if (verdict === "unknown") {
      runs.push(skippedReport(runId, "verdict-unknown"));
      continue;
    }

    // verdict === "merged" — pass through the shared cross-run mutation gate.
    // Defense-in-depth, independent of the verdict map: the gate re-reads
    // run-state and refuses unless `status === "completed"` AND
    // `finalPullRequest != null`. An `in-progress` run (run-not-completed) or a
    // `completed` run with a null finalPR (final-pr-missing) is left strictly
    // intact — removing it would destroy a live or unconcluded run's footprint.
    const gate = checkCrossRunMutationAllowed(runStatePath);
    if (!gate.ok) {
      runs.push(skippedReport(runId, gate.reason));
      continue;
    }

    // The gate is satisfied — clean the run. A failure here is contained to
    // this run's report; the sweep continues with the next run.
    try {
      runs.push(
        await cleanMergedRun(runId, runDir, gate.state, repoPath, force)
      );
    } catch (err) {
      // cleanMergedRun is best-effort and should not throw, but if some
      // unforeseen failure escapes, contain it: report the run as skipped and
      // keep sweeping the rest.
      runs.push(skippedReport(runId, "malformed-run-state"));
      void err;
    }
  }

  return { status: "ok", runs };
}

// ─── reclaim_run — the human-gated single-run override ────────────────────────

/**
 * Reclaims one named run, removing its complete footprint — ALL worktrees
 * (passed AND failed), the umbrella branch and every slice branch (local and
 * remote), and the run directory.
 *
 * This is the one sanctioned exception to the cross-run isolation gate
 * (ADR-0012): there is no `failed` run status, so a crashed or abandoned run
 * stays `in-progress` forever, indistinguishable from a live run — a status gate
 * could never permit its reclamation. `reclaimRun` therefore reads the run-state
 * with `readRunState` directly and **deliberately does NOT pass through
 * `checkCrossRunMutationAllowed` and does NOT gate on `status`**. It stays
 * scoped, by construction, to the single `runs/<runId>/` and that runId's
 * branches, so it can never touch another run. The human gate — the interactive
 * confirmation, the deletion-set preview, and the `updatedAt` staleness advisory
 * — lives entirely in the skill; this tool is non-interactive execution only.
 *
 * Never throws — every failure mode is a structured result. A valid runId with
 * no `runs/<runId>/` directory is reason `run-not-found` (so an idempotent
 * re-reclaim of an already-removed run is a clean no-op, not an error).
 */
export async function reclaimRun(
  input: ReclaimRunInput
): Promise<ReclaimRunOutput> {
  const repoPath = input.repoPath ?? process.cwd();

  // Option-injection guard: reject a repoPath git would parse as a flag.
  const repoGuardErr = optionInjectionError("repoPath", repoPath);
  if (repoGuardErr) {
    return {
      status: "error",
      errorCode: "INVALID_INPUT",
      errorMessage: repoGuardErr,
    };
  }

  // runId guards: reject an injection-shaped or otherwise malformed runId before
  // it ever flows into a path join — a structured result, never a throw.
  const runIdGuardErr = optionInjectionError("runId", input.runId);
  if (runIdGuardErr) {
    return {
      status: "ok",
      report: skippedReport(input.runId, "invalid-run-id"),
    };
  }
  if (!isValidRunId(input.runId)) {
    return {
      status: "ok",
      report: skippedReport(input.runId, "invalid-run-id"),
    };
  }

  const runDir = path.join(repoPath, ".orchestrate", "runs", input.runId);

  // A valid runId whose run directory does not exist on disk: a clean no-op,
  // reported as `run-not-found`. This is the idempotent re-reclaim case — a
  // second reclaim of an already-removed run lands here.
  if (!fs.existsSync(runDir)) {
    return {
      status: "ok",
      report: skippedReport(input.runId, "run-not-found"),
    };
  }

  // Read the run-state directly — NO status gate. A missing/malformed run-state
  // is reported with the shared keyed reason, but the footprint is still NOT
  // removed (there are no branch/worktree names to act on); a developer can
  // remove the orphan dir manually.
  const runStatePath = path.join(runDir, "run-state.json");
  const stateResult = readRunState(runStatePath);
  if (!stateResult.ok) {
    return {
      status: "ok",
      report: skippedReport(input.runId, stateResult.reason),
    };
  }

  // Remove the run's full footprint — passed AND failed worktrees both go, since
  // the human already confirmed the deletion set. The mechanical fields and
  // action come from the shared helper; key the reason to reclaim semantics.
  const report = await removeRunFootprint(
    input.runId,
    runDir,
    stateResult.state,
    repoPath,
    { removeFailedWorktrees: true }
  );
  report.reason = "failed-run-reclaimed";
  return { status: "ok", report };
}
