import { z } from "zod";
import { gitExecFile, optionInjectionError, cleanGitError } from "../git.js";

// ─── resolve_merge_conflict — the re-entrant conflict-merge lifecycle ──────────
//
// resolve_merge_conflict brackets the two deterministic git operations that
// surround the conflict-resolver spawn (SKILL §3 step 8a) out of the orchestrator
// spine. The spine still spawns the resolver, validates its envelope, runs the
// clean-path capability re-verify, and enforces the attempt-once policy — only
// the raw git lifecycle moves here. The operation is selected by the `operation`
// discriminant; both operations return the same output envelope, discriminated by
// `verdict`.
//
//   'prepare' — fetch the umbrella and merge it into the slice worktree so any
//     conflict markers surface in the files. Its FIRST git step (after guards) is
//     a re-entrancy probe: a pre-existing in-progress merge (a stale `MERGE_HEAD`,
//     e.g. left by an interrupted predecessor) is `git merge --abort`ed
//     best-effort before the fresh fetch+merge, so this recovers a mid-merge
//     successor instead of wedging on "you have not concluded your merge". A clean
//     merge → `clean` (git auto-committed it); an irreconcilable merge → the index
//     is left unmerged and the conflicted paths (a rename emits BOTH) are returned
//     as `conflicted{files}`.
//
//   'finalize' — stage the resolver's resolved file set, scan the staged diff for
//     residual conflict markers, and complete the merge commit. No residual
//     markers → `completed`. Residual markers found → the merge is ABORTED (which
//     leaves the worktree clean) and the verdict is `markers_remain` — the
//     resolution was incomplete, the one attempt is spent.
//
// WHAT STAYS IN THE SPINE (never here): spawning/composing the conflict-resolver
// subagent, calling `validate_envelope`, running the capability verbs, and the
// attempt-once policy. resolve_merge_conflict is git-only via the hardened exec
// seam (`src/git.ts`), run-scoped (mutates nothing outside the passed worktree),
// shells no `gh`, and never throws — every failure mode is a structured `verdict`.

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const resolveMergeConflictInputSchema = z.object({
  operation: z
    .enum(["prepare", "finalize"])
    .describe(
      "Which conflict-merge lifecycle operation to run. 'prepare' (§3 step 8a, " +
        "pre-resolver): abort any pre-existing in-progress merge (re-entrancy " +
        "recovery), then fetch the umbrella and merge it into the slice worktree, " +
        "returning `clean` (auto-committed, nothing to resolve) or " +
        "`conflicted{conflictedFiles}` (the index is left unmerged for the " +
        "resolver). 'finalize' (§3 step 8a, post-resolver): stage the resolved " +
        "file set, scan the staged diff for residual conflict markers, and " +
        "complete the merge commit — `completed` when no markers remain, or " +
        "`markers_remain` (the merge is ABORTED, leaving the worktree clean) when " +
        "any do."
    ),
  worktreePath: z
    .string()
    .describe(
      "Absolute path of the slice WORKTREE the merge runs in. In 'prepare' the " +
        "fetch+merge target it; in 'finalize' the stage/scan/commit target it. " +
        "This is the only directory the operation mutates."
    ),
  umbrellaRef: z
    .string()
    .optional()
    .describe(
      "The umbrella branch name (e.g. `orchestrate/umbrella-<runId>`) merged into " +
        "the worktree as `<remote>/<umbrellaRef>`. Required for 'prepare'; unused " +
        "by 'finalize' (the merge is already in progress from 'prepare')."
    ),
  remote: z
    .string()
    .optional()
    .default("origin")
    .describe(
      "Remote to fetch the umbrella from in 'prepare'. Defaults to `origin`. " +
        "Unused by 'finalize'."
    ),
  resolvedFiles: z
    .array(z.string())
    .optional()
    .describe(
      "'finalize' only: the EXACT file set the conflict-resolver resolved, staged " +
        "via `git add -- ...resolvedFiles` (NEVER `git add -A`/`-u`/`.`). The " +
        "residual-marker scan runs on the resulting staged diff. Required for " +
        "'finalize'; unused by 'prepare'."
    ),
});

export const resolveMergeConflictOutputSchema = z.object({
  status: z
    .enum(["ok", "failed"])
    .describe(
      "Outcome discriminant. 'ok' = the operation reached a non-failure verdict " +
        "(clean | completed); 'failed' = a blocking verdict or error (conflicted " +
        "| markers_remain | error). The `verdict` field carries the specific " +
        "outcome."
    ),
  verdict: z
    .enum(["clean", "conflicted", "completed", "markers_remain", "error"])
    .describe(
      "The operation's specific outcome. 'prepare' → `clean` (the umbrella merge " +
        "applied with no conflicts and git auto-committed it — nothing to " +
        "resolve) | `conflicted` (the merge left an unmerged index; see " +
        "`conflictedFiles`). 'finalize' → `completed` (the resolved set staged " +
        "cleanly with no residual markers and the merge commit was written) | " +
        "`markers_remain` (residual conflict markers were found in the staged " +
        "diff — the merge was ABORTED, leaving the worktree clean). `error` = a " +
        "git or input failure (see `errorCode`)."
    ),
  conflictedFiles: z
    .array(z.string())
    .optional()
    .describe(
      "'prepare' `conflicted`: the unmerged paths the umbrella merge left in the " +
        "index (`git diff --name-only --diff-filter=U`). A rename-conflict emits " +
        "BOTH of its paths. This is the list the spine passes to the " +
        "conflict-resolver."
    ),
  markerLines: z
    .array(z.string())
    .optional()
    .describe(
      "'finalize' `markers_remain`: the verbatim staged-diff lines (diff column " +
        "included, e.g. `+<<<<<<< HEAD`) that still carried a residual conflict " +
        "marker (`<<<<<<<`, `=======`, or `>>>>>>>`) — the reason the resolution " +
        "was rejected. The merge was aborted before this is reported."
    ),
  errorCode: z
    .enum(["INVALID_INPUT", "GIT_ERROR"])
    .optional()
    .describe(
      "Machine-readable failure category for `verdict: 'error'`. 'INVALID_INPUT' " +
        "= a ref/remote would be parsed by git as an option flag, or a required " +
        "field for the operation is missing; 'GIT_ERROR' = a git command failed " +
        "for a reason other than a merge conflict (e.g. an unreachable remote)."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present for `conflicted`, " +
        "`markers_remain`, and `error`."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type ResolveMergeConflictInput = z.infer<
  typeof resolveMergeConflictInputSchema
>;
export type ResolveMergeConflictOutput = z.infer<
  typeof resolveMergeConflictOutputSchema
>;

/**
 * Tuning + injection knobs for the bounded umbrella-fetch retry.
 *
 * `sleep` is INTERNAL — it lets a test run the backoff schedule with no real
 * delay. It is deliberately NOT a public Zod input field; the MCP input schema
 * stays clean. The registration handler calls resolveMergeConflict with no `opts`
 * (real sleep), matching run-wave / finalize-slice / push-and-verify.
 */
export interface ResolveMergeConflictOptions {
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

// ─── Pure marker-scan predicate — the highest-value isolated unit ─────────────

/** The three git conflict-marker line prefixes, each exactly 7 characters. */
const CONFLICT_MARKERS = ["<<<<<<<", "=======", ">>>>>>>"] as const;

/**
 * PURE predicate: does the given text carry a residual git conflict marker?
 * No I/O — a string goes in, a structured boolean/offending-lines result comes
 * out. The caller fetches the text (`git diff --cached`) in the I/O wrapper and
 * passes the already-fetched STRING here.
 *
 * The text is the STAGED DIFF (`git diff --cached`), where a residual marker line
 * carries a leading diff column (`+`, `-`, or space). Each line's optional single
 * leading `+`/`-`/space column is stripped before the marker match, so a
 * `+<<<<<<< HEAD` diff line is detected. Git's own `---`/`+++` hunk headers are 3
 * characters and never collide with the 7-character markers.
 *
 * @returns `{ hasMarkers, offendingLines }` — `offendingLines` is the set of
 *   marker-bearing lines (verbatim, diff column included), empty when none.
 */
export function scanConflictMarkers(diffText: string): {
  hasMarkers: boolean;
  offendingLines: string[];
} {
  const offendingLines: string[] = [];
  for (const rawLine of diffText.split("\n")) {
    // Strip a single optional diff-column character (`+`, `-`, or space) so a
    // staged-diff line like `+<<<<<<< HEAD` matches the bare marker.
    const line =
      rawLine.length > 0 && (rawLine[0] === "+" || rawLine[0] === "-" || rawLine[0] === " ")
        ? rawLine.slice(1)
        : rawLine;
    if (CONFLICT_MARKERS.some((marker) => line.startsWith(marker))) {
      offendingLines.push(rawLine);
    }
  }
  return { hasMarkers: offendingLines.length > 0, offendingLines };
}

// ─── resolve_merge_conflict ────────────────────────────────────────────────────

/**
 * Runs one conflict-merge lifecycle operation, selected by `input.operation`.
 * `opts` injects the umbrella-fetch backoff `sleep` for fast, deterministic
 * tests; the registration handler calls this with no `opts` (real sleep). Never
 * throws — every failure mode is a structured `verdict` result.
 */
export async function resolveMergeConflict(
  input: ResolveMergeConflictInput,
  opts?: ResolveMergeConflictOptions
): Promise<ResolveMergeConflictOutput> {
  switch (input.operation) {
    case "prepare":
      return prepare(input, opts);
    case "finalize":
      return finalize(input);
  }
}

/**
 * 'prepare' (§3 step 8a, pre-resolver): merge the umbrella into the slice
 * worktree so any conflict markers surface in the files, recovering from a
 * pre-existing in-progress merge first. The FIRST git step (after guards) is the
 * re-entrancy probe + abort; then a bounded fetch and a `git merge --no-edit`.
 * A clean merge → `clean` (git auto-committed it — nothing to resolve). A merge
 * that throws AND leaves an unmerged index → `conflicted`, with the conflicted
 * paths (a rename emits BOTH) collected for the resolver. A merge that throws but
 * leaves an EMPTY unmerged set is some other git failure → `error`.
 */
async function prepare(
  input: ResolveMergeConflictInput,
  opts?: ResolveMergeConflictOptions
): Promise<ResolveMergeConflictOutput> {
  const worktreePath = input.worktreePath;
  const umbrellaRef = input.umbrellaRef;
  const remote = input.remote ?? "origin";

  if (umbrellaRef === undefined) {
    return failed(
      "INVALID_INPUT",
      "operation 'prepare' requires `umbrellaRef`."
    );
  }

  // Option-injection guards — both ref and remote interpolate into git args.
  const refGuard = optionInjectionError("umbrellaRef", umbrellaRef);
  if (refGuard) return failed("INVALID_INPUT", refGuard);
  const remoteGuard = optionInjectionError("remote", remote);
  if (remoteGuard) return failed("INVALID_INPUT", remoteGuard);

  // 1. RE-ENTRANCY (HARD): abort any pre-existing in-progress merge BEFORE the
  //    fresh fetch+merge, so a mid-merge successor recovers instead of wedging on
  //    "you have not concluded your merge". `git rev-parse --verify --quiet
  //    MERGE_HEAD` PRINTS the merge SHA and exits 0 when a merge is in progress,
  //    but exits NON-ZERO and silently when none is — and gitExecFile turns that
  //    non-zero exit into a THROW. So both the throw (no MERGE_HEAD) and an empty
  //    trimmed stdout map to "no merge in progress, not an error". The abort is
  //    best-effort (try/caught) — a no-op abort on a now-clean worktree is fine.
  let mergeInProgress = false;
  try {
    const { stdout } = await gitExecFile(
      ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"],
      worktreePath
    );
    mergeInProgress = stdout.trim().length > 0;
  } catch {
    mergeInProgress = false;
  }
  if (mergeInProgress) {
    await abortMergeBestEffort(worktreePath);
  }

  // 2. Fetch the umbrella so the remote-tracking ref `origin/<umbrellaRef>` is up
  //    to date. Bounded retry absorbs a transient network failure.
  const fetchErr = await fetchWithRetry([remote, umbrellaRef], worktreePath, opts);
  if (fetchErr) {
    return failed("GIT_ERROR", fetchErr);
  }

  // 3. Merge the umbrella into the worktree. A conflict exits non-zero AND leaves
  //    an unmerged index — classified STRUCTURALLY (locale-proof, no
  //    string-matching) by `git diff --diff-filter=U`, collecting the conflicted
  //    paths (a rename emits BOTH, one per line). A non-zero merge with an EMPTY
  //    unmerged set is some other git failure → GIT_ERROR, not a conflict.
  try {
    await gitExecFile(
      ["merge", "--no-edit", `${remote}/${umbrellaRef}`],
      worktreePath
    );
  } catch (err) {
    const conflictedFiles = await unmergedPaths(worktreePath);
    if (conflictedFiles.length > 0) {
      return {
        status: "failed",
        verdict: "conflicted",
        conflictedFiles,
        errorMessage:
          `Merging ${remote}/${umbrellaRef} into the slice worktree produced a ` +
          `conflict in ${conflictedFiles.length} path(s) — the unmerged index is ` +
          `left in place for the conflict-resolver.`,
      };
    }
    return failed("GIT_ERROR", cleanGitError(err));
  }

  // 4. The merge applied with no conflicts — `git merge --no-edit` auto-committed
  //    it. Nothing to resolve. The spine owns the clean-path capability re-verify.
  return { status: "ok", verdict: "clean" };
}

/**
 * 'finalize' (§3 step 8a, post-resolver): complete the in-progress merge with the
 * resolver's resolved file set. Stage exactly `resolvedFiles` (`git add -- ...`,
 * never `-A`/`-u`/`.`), then scan the STAGED DIFF for residual conflict markers
 * via the pure {@link scanConflictMarkers} predicate. No markers → commit the
 * merge (`git commit --no-edit`) → `completed`. Markers remain → the resolution
 * is incomplete: `git merge --abort` (which resets the index AND the worktree,
 * leaving it clean) → `markers_remain`. The one attempt is spent either way.
 */
async function finalize(
  input: ResolveMergeConflictInput
): Promise<ResolveMergeConflictOutput> {
  const worktreePath = input.worktreePath;
  const resolvedFiles = input.resolvedFiles;

  if (resolvedFiles === undefined) {
    return failed(
      "INVALID_INPUT",
      "operation 'finalize' requires `resolvedFiles`."
    );
  }

  // 1. Stage EXACTLY the resolved files. `git add -- ...resolvedFiles` (NEVER
  //    -A/-u/.) — the `--` also guards the file args from option injection.
  try {
    await gitExecFile(["add", "--", ...resolvedFiles], worktreePath);
  } catch (err) {
    return failed("GIT_ERROR", cleanGitError(err));
  }

  // 2. Read the STAGED DIFF (the I/O wrapper around the pure marker scan). The
  //    git read stays here; the predicate takes the already-fetched STRING.
  let stagedDiff: string;
  try {
    const { stdout } = await gitExecFile(
      ["diff", "--cached"],
      worktreePath
    );
    stagedDiff = stdout;
  } catch (err) {
    return failed("GIT_ERROR", cleanGitError(err));
  }

  // 3. Scan for residual conflict markers. If any remain, the resolution is
  //    incomplete: ABORT the merge (resets index AND worktree → left clean) and
  //    report `markers_remain`. The abort is best-effort.
  const scan = scanConflictMarkers(stagedDiff);
  if (scan.hasMarkers) {
    await abortMergeBestEffort(worktreePath);
    return {
      status: "failed",
      verdict: "markers_remain",
      markerLines: scan.offendingLines,
      errorMessage:
        `Residual conflict markers remain in the staged diff after resolution ` +
        `(${scan.offendingLines.length} marker line(s)) — the merge was aborted, ` +
        `leaving the worktree clean. The one resolution attempt is spent.`,
    };
  }

  // 4. No residual markers — complete the merge commit. `git commit --no-edit`
  //    uses the prepared MERGE_MSG (no shell, no positionals).
  try {
    await gitExecFile(["commit", "--no-edit"], worktreePath);
  } catch (err) {
    return failed("GIT_ERROR", cleanGitError(err));
  }

  return { status: "ok", verdict: "completed" };
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
  opts?: ResolveMergeConflictOptions
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
 * Structurally lists the index's unmerged (conflicted) paths — `git diff
 * --name-only --diff-filter=U` prints exactly the conflicted paths, one per line
 * (a rename-conflict prints BOTH its paths). Locale-proof: it reads git's
 * plumbing, not its human-readable conflict text. Returns the trimmed non-empty
 * lines. Never throws — a diff failure is treated as "no detectable conflict"
 * (empty list).
 */
async function unmergedPaths(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await gitExecFile(
      ["diff", "--name-only", "--diff-filter=U"],
      repoPath
    );
    return stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

/**
 * Best-effort `git merge --abort` — swallows every failure (including a no-op
 * abort on a worktree with no merge in progress). Used both to recover a stale
 * in-progress merge in 'prepare' and to leave the worktree clean on
 * `markers_remain` in 'finalize'. Never throws.
 */
async function abortMergeBestEffort(repoPath: string): Promise<void> {
  try {
    await gitExecFile(["merge", "--abort"], repoPath);
  } catch {
    // A no-op abort (nothing to abort) or any abort failure is swallowed — the
    // abort is best-effort by contract.
  }
}

/** Builds a structured `error` verdict result. */
function failed(
  errorCode: NonNullable<ResolveMergeConflictOutput["errorCode"]>,
  errorMessage: string
): ResolveMergeConflictOutput {
  return {
    status: "failed",
    verdict: "error",
    errorCode,
    errorMessage,
  };
}
