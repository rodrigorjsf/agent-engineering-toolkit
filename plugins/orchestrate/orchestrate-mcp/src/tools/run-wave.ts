import { z } from "zod";
import { gitExecFile, optionInjectionError, cleanGitError } from "../git.js";
import { runTests, runBuild, runIntegration } from "./run-command.js";

// ─── run_wave — the bracketed deterministic wave-loop operations ───────────────
//
// run_wave is a family of deterministic, side-effect-bounded operations the
// wave loop (SKILL §2) brackets out of the orchestrator spine. Each operation is
// a self-contained decision the spine would otherwise hand-roll in prose; behind
// this one tool, only the higher-level POLICY that decides how a wave processes
// its slices stays the orchestrator's concern. The operation is selected by the
// `operation` discriminant; every operation returns the same output envelope,
// discriminated by `verdict`.
//
//   'refresh-base' — fast-forward the local umbrella ref to its remote
//     counterpart before a wave's worktrees branch from it. A fetch updates
//     FETCH_HEAD, then a merge-base check proves the local ref is an ancestor of
//     the fetched tip (a clean fast-forward) before the ref is moved. A remote
//     tip that is NOT a descendant of the local ref means the umbrella history
//     diverged → verdict 'diverged' (the ref is left untouched, fail loud).
//
//   'select-processable' — the in-partition + out-of-partition blocker gate for
//     one slice. It consumes blocker STATE the orchestrator already resolved and
//     PASSED IN — it never shells `gh` (ADR-0008: the spine resolves an
//     out-of-partition blocker's real tracker state and passes it). A slice is
//     'processable' only when every in-partition blocker reached `passed` and
//     every out-of-partition blocker is resolved (CLOSED); otherwise 'skip',
//     naming the first unmet blocker.
//
//   'reverify-slice' — the post-merge unit re-verify of one slice against the
//     wave's already-merged siblings. A no-op ('skipped-first-merge') for the
//     first merged slice of a wave (whose pre-merge gate already covered the
//     umbrella). Otherwise it fetches and merges the umbrella into the slice
//     worktree, then runs the two correctness verbs (tests + build); 'passed' on
//     both, 'failed{which}' on a verb failure, 'conflict' when the merge leaves
//     an unmerged index. It FLAGS a conflict only — it never resolves or aborts
//     it (that is a separate concern, owned elsewhere) — and spawns nothing.
//
//   'integration-gate' — run the optional per-wave heavy `integration` suite
//     against the umbrella tip and map the result: 'proceed' (passed),
//     'halt' (failed/error), 'tolerate' (no integration command configured).
//
// All loop state — the umbrella ref, the remote, whether this is the first
// merged slice of the wave, the deferred worktree path — is PASSED IN by the
// orchestrator, never inferred here. run_wave is run-scoped: it mutates nothing
// outside the passed worktree (ADR-0012), is git-only via the hardened exec seam
// (`src/git.ts`), composes the capability verbs from `run-command.ts`, and never
// throws — every failure mode is a structured `verdict` result.

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

/**
 * The terminal state of an in-partition blocker — a `blockedBy` id that is
 * itself a slice in this run's partition. The dependent slice may run only when
 * every such blocker reached `passed`.
 */
const inPartitionBlockerStateEnum = z.enum([
  "pending",
  "in-progress",
  "passed",
  "failed",
  "skipped",
]);

/**
 * The resolved tracker state of an out-of-partition blocker — a `blockedBy` id
 * that is NOT a slice in this run's partition. The orchestrator resolves this
 * with the tracker and passes it in; this tool never reads it (ADR-0008).
 * `CLOSED` = resolved (merged or closed); `OPEN` = still unmet.
 */
const outOfPartitionBlockerStateEnum = z.enum(["OPEN", "CLOSED"]);

/** One in-partition blocker's id and resolved slice-state. */
const inPartitionBlockerSchema = z.object({
  blockerId: z
    .string()
    .describe("The blocker slice's id (its issue-id-string key in the run)."),
  state: inPartitionBlockerStateEnum.describe(
    "The blocker slice's terminal state. The dependent slice is processable " +
      "only when this is `passed`; any other value blocks it."
  ),
});

/** One out-of-partition blocker's id and tracker-resolved state. */
const outOfPartitionBlockerSchema = z.object({
  blockerId: z
    .string()
    .describe("The blocker issue's id (an issue outside this run's partition)."),
  state: outOfPartitionBlockerStateEnum.describe(
    "The blocker issue's resolved tracker state, looked up by the orchestrator " +
      "and passed in (ADR-0008 — this tool never reads tracker state). `CLOSED` " +
      "= resolved, the dependent slice proceeds; `OPEN` = unmet, it is skipped."
  ),
});

export const runWaveInputSchema = z.object({
  operation: z
    .enum([
      "refresh-base",
      "select-processable",
      "reverify-slice",
      "integration-gate",
    ])
    .describe(
      "Which bracketed wave operation to run. 'refresh-base' (§2 step 1): " +
        "fast-forward the local umbrella ref to its remote tip, or report " +
        "`diverged` when that is not a fast-forward. 'select-processable' " +
        "(§2 step 2): gate one slice on its in-partition + out-of-partition " +
        "blocker states (passed in), returning `processable` or `skip`. " +
        "'reverify-slice' (§2 step 4 inner re-verify): merge the umbrella into " +
        "the slice worktree and run the two correctness verbs, returning " +
        "`passed`/`failed`/`conflict` (or `skipped-first-merge` for the first " +
        "merged slice). 'integration-gate' (§2 step 4a): run the per-wave " +
        "integration suite, returning `proceed`/`halt`/`tolerate`."
    ),
  repoPath: z
    .string()
    .optional()
    .describe(
      "The directory the operation runs in. For 'refresh-base' it is the main " +
        "repo root holding the local umbrella ref. For 'reverify-slice' and " +
        "'integration-gate' it is the slice/deferred WORKTREE the merge and the " +
        "capability commands run against — the same `repoPath` the run_* " +
        "capability tools take (config is resolved from the main root, the " +
        "command execs here). Unused by 'select-processable' (pure)."
    ),
  umbrellaRef: z
    .string()
    .optional()
    .describe(
      "The umbrella branch name (e.g. `orchestrate/umbrella-<runId>`). In " +
        "'refresh-base' it is the local ref fast-forwarded to its remote " +
        "counterpart; in 'reverify-slice' it is the remote-tracking branch " +
        "(`origin/<umbrellaRef>`) merged into the worktree. Required for both " +
        "those operations; unused by the others."
    ),
  remote: z
    .string()
    .optional()
    .default("origin")
    .describe(
      "Remote to fetch the umbrella from. Defaults to `origin`. Used by " +
        "'refresh-base' and 'reverify-slice'; unused by the others."
    ),
  isFirstMergedThisWave: z
    .boolean()
    .optional()
    .describe(
      "'reverify-slice' only: when true, this is the first slice merged in this " +
        "wave, whose pre-merge gate already covered the umbrella — re-verify is " +
        "a no-op (`skipped-first-merge`). Required for 'reverify-slice'."
    ),
  inPartitionBlockers: z
    .array(inPartitionBlockerSchema)
    .optional()
    .describe(
      "'select-processable' only: the dependent slice's blockers that are " +
        "themselves slices in this run's partition, each with its resolved " +
        "state. The slice is processable only when every one reached `passed`. " +
        "Pass [] when the slice has no in-partition blockers."
    ),
  outOfPartitionBlockers: z
    .array(outOfPartitionBlockerSchema)
    .optional()
    .describe(
      "'select-processable' only: the dependent slice's blockers that are NOT " +
        "slices in this run's partition, each with the tracker state the " +
        "orchestrator resolved and passed in (ADR-0008). The slice is " +
        "processable only when every one is `CLOSED`. Pass [] when the slice " +
        "has no out-of-partition blockers."
    ),
});

export const runWaveOutputSchema = z.object({
  status: z
    .enum(["ok", "failed"])
    .describe(
      "Outcome discriminant. 'ok' = the operation reached a non-failure " +
        "verdict (refreshed | processable | skip | skipped-first-merge | " +
        "passed | proceed | tolerate); 'failed' = a blocking verdict or error " +
        "(diverged | failed | conflict | halt | error). The `verdict` field " +
        "carries the specific outcome."
    ),
  verdict: z
    .enum([
      "refreshed",
      "diverged",
      "processable",
      "skip",
      "skipped-first-merge",
      "passed",
      "failed",
      "conflict",
      "proceed",
      "halt",
      "tolerate",
      "error",
    ])
    .describe(
      "The operation's specific outcome. 'refresh-base' → `refreshed` " +
        "(fast-forwarded) | `diverged` (not a fast-forward — the ref is left " +
        "untouched). 'select-processable' → `processable` | `skip` (see " +
        "`blockerId`). 'reverify-slice' → `skipped-first-merge` | `passed` | " +
        "`failed` (see `which`) | `conflict` (the merge left an unmerged " +
        "index, flagged not resolved). 'integration-gate' → `proceed` | `halt` " +
        "| `tolerate` (no integration command configured). `error` = a git or " +
        "input failure (see `errorCode`)."
    ),
  sha: z
    .string()
    .optional()
    .describe(
      "'refresh-base' `refreshed`: the umbrella SHA the local ref now points at " +
        "(the fetched remote tip)."
    ),
  blockerId: z
    .string()
    .optional()
    .describe(
      "'select-processable' `skip`: the id of the first unmet blocker (a " +
        "non-`passed` in-partition blocker or an `OPEN` out-of-partition " +
        "blocker) — the reason the dependent slice is skipped."
    ),
  which: z
    .enum(["tests", "build"])
    .optional()
    .describe(
      "'reverify-slice' `failed`: which correctness verb failed after the " +
        "umbrella was merged into the worktree."
    ),
  errorCode: z
    .enum(["INVALID_INPUT", "GIT_ERROR"])
    .optional()
    .describe(
      "Machine-readable failure category for `verdict: 'error'`. " +
        "'INVALID_INPUT' = a ref/remote would be parsed by git as an option " +
        "flag, or a required field for the operation is missing; 'GIT_ERROR' = " +
        "a git command failed for a reason other than divergence or a merge " +
        "conflict (e.g. an unreachable remote, a missing local umbrella ref)."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present for `diverged`, " +
        "`conflict`, `failed`, `halt`, and `error`."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type RunWaveInput = z.infer<typeof runWaveInputSchema>;
export type RunWaveOutput = z.infer<typeof runWaveOutputSchema>;

type InPartitionBlocker = z.infer<typeof inPartitionBlockerSchema>;
type OutOfPartitionBlocker = z.infer<typeof outOfPartitionBlockerSchema>;

/**
 * Tuning + injection knobs for the bounded umbrella-fetch retry.
 *
 * `sleep` is INTERNAL — it lets a test run the backoff schedule with no real
 * delay. It is deliberately NOT a public Zod input field; the MCP input schema
 * stays clean. The registration handler calls run_wave with no `opts` (real
 * sleep), matching push-and-verify / finalize-slice.
 */
export interface RunWaveOptions {
  fetchAttempts?: number;
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Max umbrella-fetch attempts before reporting a git error (transient retry). */
const FETCH_ATTEMPTS = 3;
/** Initial delay before the second fetch attempt (ms). */
const FETCH_BASE_DELAY_MS = 500;
/** Each backoff step multiplies the previous delay by this factor. */
const FETCH_BACKOFF_FACTOR = 2;
/** Ceiling on a single backoff delay (ms), so the schedule never runs away. */
const FETCH_MAX_DELAY_MS = 8_000;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

// ─── run_wave ──────────────────────────────────────────────────────────────────

/**
 * Runs one bracketed wave operation, selected by `input.operation`. `opts`
 * injects the umbrella-fetch backoff `sleep` for fast, deterministic tests; the
 * registration handler calls this with no `opts` (real sleep). Never throws —
 * every failure mode is a structured `verdict` result.
 */
export async function runWave(
  input: RunWaveInput,
  opts?: RunWaveOptions
): Promise<RunWaveOutput> {
  switch (input.operation) {
    case "refresh-base":
      return refreshBase(input, opts);
    case "select-processable":
      return selectProcessable(input);
    case "reverify-slice":
      return reverifySlice(input, opts);
    case "integration-gate":
      return integrationGate(input);
  }
}

/**
 * 'refresh-base' (§2 step 1): fast-forward the local umbrella ref to its remote
 * counterpart so this wave's worktrees branch from the integrated state of every
 * prior wave. Fetches the remote umbrella into FETCH_HEAD (a bounded retry
 * absorbs a transient network failure), then proves the local ref is an ancestor
 * of the fetched tip via `git merge-base` — a clean fast-forward — before moving
 * the ref. A remote tip the local ref is NOT an ancestor of means the umbrella
 * history diverged → `diverged`, and the local ref is left untouched (fail loud,
 * never clobber). `diverged` is terminal — it is never retried.
 */
async function refreshBase(
  input: RunWaveInput,
  opts?: RunWaveOptions
): Promise<RunWaveOutput> {
  const repoPath = input.repoPath;
  const umbrellaRef = input.umbrellaRef;
  const remote = input.remote ?? "origin";

  if (repoPath === undefined || umbrellaRef === undefined) {
    return failed(
      "INVALID_INPUT",
      "operation 'refresh-base' requires `repoPath` and `umbrellaRef`."
    );
  }

  // Option-injection guards — both ref and remote interpolate into git args.
  const refGuard = optionInjectionError("umbrellaRef", umbrellaRef);
  if (refGuard) return failed("INVALID_INPUT", refGuard);
  const remoteGuard = optionInjectionError("remote", remote);
  if (remoteGuard) return failed("INVALID_INPUT", remoteGuard);

  // 1. Fetch the remote umbrella into FETCH_HEAD WITHOUT moving the local ref.
  //    A bare `<refname>` refspec updates FETCH_HEAD only — the local update is
  //    deferred to step 4 and gated on the fast-forward proof. Bounded retry
  //    absorbs a transient network failure; a persistent failure → GIT_ERROR.
  const fetchErr = await fetchWithRetry(
    [remote, umbrellaRef],
    repoPath,
    opts
  );
  if (fetchErr) {
    return failed("GIT_ERROR", fetchErr);
  }

  // 2. Resolve the local umbrella tip. It must exist — the umbrella is created
  //    at run start and this step runs on every wave (and on resume). An absent
  //    local ref is a real misconfiguration → GIT_ERROR.
  let localTip: string;
  try {
    const { stdout } = await gitExecFile(
      ["rev-parse", "--verify", "--quiet", `refs/heads/${umbrellaRef}`],
      repoPath
    );
    localTip = stdout.trim();
  } catch (err) {
    return failed("GIT_ERROR", cleanGitError(err));
  }
  if (localTip.length === 0) {
    return failed(
      "GIT_ERROR",
      `Local umbrella ref refs/heads/${umbrellaRef} does not exist — cannot refresh a missing base.`
    );
  }

  // 3. Resolve the fetched remote tip (FETCH_HEAD) and the merge-base of the two.
  //    `merge-base` PRINTS the common ancestor and EXITS 0 (so a diverged result
  //    stays on the non-throwing path — gitExecFile drops the numeric exit code,
  //    so an exit-code-signalled `--is-ancestor` could not be classified here).
  let fetchedTip: string;
  let mergeBase: string;
  try {
    const fh = await gitExecFile(["rev-parse", "FETCH_HEAD"], repoPath);
    fetchedTip = fh.stdout.trim();
    const mb = await gitExecFile(
      ["merge-base", `refs/heads/${umbrellaRef}`, "FETCH_HEAD"],
      repoPath
    );
    mergeBase = mb.stdout.trim();
  } catch (err) {
    // The only throw here is the pathological unrelated-histories case (no
    // common ancestor) — the umbrella always shares history with its remote, so
    // this is a defensive GIT_ERROR, not the common diverged path.
    return failed("GIT_ERROR", cleanGitError(err));
  }

  // 4. Fast-forward iff the local tip IS the merge-base (i.e. the local ref is an
  //    ancestor of the fetched tip). Otherwise the histories diverged → fail
  //    loud, leaving the local ref untouched. `update-ref` moves the ref without
  //    a checkout — refresh-base never touches a working tree.
  if (mergeBase !== localTip) {
    return {
      status: "failed",
      verdict: "diverged",
      errorMessage:
        `The umbrella ${umbrellaRef} diverged: the local ref is not an ancestor ` +
        `of ${remote}/${umbrellaRef} (${fetchedTip}), so a fast-forward is ` +
        `impossible. Leaving the local ref untouched.`,
    };
  }

  try {
    await gitExecFile(
      ["update-ref", `refs/heads/${umbrellaRef}`, fetchedTip],
      repoPath
    );
  } catch (err) {
    return failed("GIT_ERROR", cleanGitError(err));
  }

  return { status: "ok", verdict: "refreshed", sha: fetchedTip };
}

/**
 * 'select-processable' (§2 step 2): the pure blocker gate for one slice. A slice
 * is processable only when every in-partition blocker reached `passed` AND every
 * out-of-partition blocker is `CLOSED`; otherwise `skip`, naming the FIRST unmet
 * blocker in a deterministic order — in-partition blockers first (their failure
 * means a sibling slice broke), then out-of-partition. Consumes blocker STATE
 * passed in by the orchestrator; it never shells `gh` (ADR-0008). Pure.
 */
function selectProcessable(input: RunWaveInput): RunWaveOutput {
  const inPartition: InPartitionBlocker[] = input.inPartitionBlockers ?? [];
  const outOfPartition: OutOfPartitionBlocker[] =
    input.outOfPartitionBlockers ?? [];

  // In-partition first: a non-`passed` in-partition blocker is the strongest
  // signal (a sibling slice failed/was-skipped, or has not finished).
  for (const blocker of inPartition) {
    if (blocker.state !== "passed") {
      return { status: "ok", verdict: "skip", blockerId: blocker.blockerId };
    }
  }
  // Then out-of-partition: an OPEN external blocker is unmet.
  for (const blocker of outOfPartition) {
    if (blocker.state !== "CLOSED") {
      return { status: "ok", verdict: "skip", blockerId: blocker.blockerId };
    }
  }

  return { status: "ok", verdict: "processable" };
}

/**
 * 'reverify-slice' (§2 step 4 inner re-verify): the post-merge unit re-verify of
 * one slice against the wave's already-merged siblings. A no-op
 * (`skipped-first-merge`) for the first merged slice of the wave (its pre-merge
 * gate already covered the umbrella). Otherwise: fetch the umbrella, merge
 * `<remote>/<umbrellaRef>` into the slice worktree, and — on a clean merge — run
 * the two correctness verbs (tests, then build). `passed` on both passing,
 * `failed{which}` on the first verb that fails, `conflict` when the merge leaves
 * an unmerged index. On a conflict the conflicted index is LEFT IN PLACE — this
 * operation only FLAGS the conflict; it never resolves or aborts it, and spawns
 * nothing (conflict resolution is a separate, downstream concern).
 */
async function reverifySlice(
  input: RunWaveInput,
  opts?: RunWaveOptions
): Promise<RunWaveOutput> {
  const repoPath = input.repoPath;
  const umbrellaRef = input.umbrellaRef;
  const remote = input.remote ?? "origin";

  if (
    repoPath === undefined ||
    umbrellaRef === undefined ||
    input.isFirstMergedThisWave === undefined
  ) {
    return failed(
      "INVALID_INPUT",
      "operation 'reverify-slice' requires `repoPath`, `umbrellaRef`, and `isFirstMergedThisWave`."
    );
  }

  // The first merged slice of a wave was the pre-merge gate's subject already —
  // re-verify is a no-op for it (the merge would be empty at that point).
  if (input.isFirstMergedThisWave) {
    return { status: "ok", verdict: "skipped-first-merge" };
  }

  // Option-injection guards — both ref and remote interpolate into git args.
  const refGuard = optionInjectionError("umbrellaRef", umbrellaRef);
  if (refGuard) return failed("INVALID_INPUT", refGuard);
  const remoteGuard = optionInjectionError("remote", remote);
  if (remoteGuard) return failed("INVALID_INPUT", remoteGuard);

  // 1. Fetch the umbrella so the remote-tracking ref `origin/<umbrellaRef>` is
  //    up to date (it carries this wave's already-merged siblings). Bounded
  //    retry absorbs a transient network failure.
  const fetchErr = await fetchWithRetry([remote, umbrellaRef], repoPath, opts);
  if (fetchErr) {
    return failed("GIT_ERROR", fetchErr);
  }

  // 2. Merge the umbrella into the worktree. A conflict exits non-zero AND
  //    leaves an unmerged index — classified STRUCTURALLY (locale-proof, no
  //    string-matching) by `git diff --diff-filter=U`. A non-zero merge with an
  //    EMPTY unmerged set is some other git failure → GIT_ERROR, not a conflict.
  try {
    await gitExecFile(
      ["merge", "--no-edit", `${remote}/${umbrellaRef}`],
      repoPath
    );
  } catch (err) {
    const conflicted = await hasUnmergedPaths(repoPath);
    if (conflicted) {
      // Leave the conflicted index IN PLACE — resolution is a downstream
      // concern. Flag it only.
      return {
        status: "failed",
        verdict: "conflict",
        errorMessage:
          `Merging ${remote}/${umbrellaRef} into the slice worktree produced a ` +
          `conflict (the unmerged index is left in place for resolution).`,
      };
    }
    return failed("GIT_ERROR", cleanGitError(err));
  }

  // 3. Run the two correctness verbs against the merged worktree, in order.
  //    Compose the capability runners — never re-implement command exec.
  const tests = await runTests({ repoPath });
  if (tests.status !== "passed") {
    return {
      status: "failed",
      verdict: "failed",
      which: "tests",
      errorMessage:
        `The merged slice worktree failed the 'tests' verb ` +
        `(status: ${tests.status}).`,
    };
  }

  const build = await runBuild({ repoPath });
  if (build.status !== "passed") {
    return {
      status: "failed",
      verdict: "failed",
      which: "build",
      errorMessage:
        `The merged slice worktree failed the 'build' verb ` +
        `(status: ${build.status}).`,
    };
  }

  return { status: "ok", verdict: "passed" };
}

/**
 * 'integration-gate' (§2 step 4a): run the optional per-wave heavy `integration`
 * suite against the (deferred) worktree and map the result. `proceed` when it
 * passed; `halt` when it failed or errored (do not build the next wave on a
 * broken umbrella); `tolerate` when no `integration` command is configured (the
 * same posture as any unconfigured capability verb). Composes `runIntegration`.
 */
async function integrationGate(input: RunWaveInput): Promise<RunWaveOutput> {
  const repoPath = input.repoPath;
  if (repoPath === undefined) {
    return failed(
      "INVALID_INPUT",
      "operation 'integration-gate' requires `repoPath`."
    );
  }

  const result = await runIntegration({ repoPath });
  switch (result.status) {
    case "passed":
      return { status: "ok", verdict: "proceed" };
    case "not-configured":
      return { status: "ok", verdict: "tolerate" };
    case "failed":
    case "error":
      return {
        status: "failed",
        verdict: "halt",
        errorMessage:
          `The per-wave integration suite did not pass (status: ` +
          `${result.status}) — halting rather than building the next wave on a ` +
          `broken umbrella.`,
      };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Fetches `git fetch <remote> <umbrellaRef>` (updating the remote-tracking and
 * FETCH_HEAD refs, not the local branch) with bounded exponential-backoff retry,
 * to absorb a transient network failure. Returns null on success, or a cleaned
 * error message when every attempt failed. Never throws.
 */
async function fetchWithRetry(
  fetchArgs: string[],
  repoPath: string,
  opts?: RunWaveOptions
): Promise<string | null> {
  const attempts = opts?.fetchAttempts ?? FETCH_ATTEMPTS;
  const baseDelayMs = opts?.baseDelayMs ?? FETCH_BASE_DELAY_MS;
  const factor = opts?.factor ?? FETCH_BACKOFF_FACTOR;
  const maxDelayMs = opts?.maxDelayMs ?? FETCH_MAX_DELAY_MS;
  const sleep = opts?.sleep ?? defaultSleep;

  let lastErr: unknown = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      await gitExecFile(["fetch", ...fetchArgs], repoPath);
      return null;
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        const delay = Math.min(
          baseDelayMs * Math.pow(factor, i - 1),
          maxDelayMs
        );
        await sleep(delay);
      }
    }
  }
  return cleanGitError(lastErr);
}

/**
 * Structurally detects whether the index carries unmerged (conflicted) paths —
 * `git diff --name-only --diff-filter=U` lists exactly the conflicted paths.
 * Locale-proof: it reads git's plumbing, not its human-readable conflict text.
 * A non-empty result means a merge conflict left the index unmerged. Never
 * throws — a diff failure is treated as "no detectable conflict" (false).
 */
async function hasUnmergedPaths(repoPath: string): Promise<boolean> {
  try {
    const { stdout } = await gitExecFile(
      ["diff", "--name-only", "--diff-filter=U"],
      repoPath
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** Builds a structured `error` verdict result. */
function failed(
  errorCode: NonNullable<RunWaveOutput["errorCode"]>,
  errorMessage: string
): RunWaveOutput {
  return {
    status: "failed",
    verdict: "error",
    errorCode,
    errorMessage,
  };
}
