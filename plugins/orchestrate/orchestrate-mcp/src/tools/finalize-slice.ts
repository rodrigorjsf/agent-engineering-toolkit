import * as fs from "fs";
import { z } from "zod";
import { gitExecFile, optionInjectionError, cleanGitError } from "../git.js";
import { resolveRunDir } from "../run-dir.js";
import { pushAndVerify, type VerifyOptions } from "./push-and-verify.js";
import { removeWorktree } from "./worktree.js";

// ─── finalize_slice — the slice git + run-state finalization mechanics ─────────
//
// finalize_slice owns the deterministic git + run-state machinery of landing one
// reviewed slice — the half of §3 (Processing one slice) that is pure git and
// run-state writes, never forge state. It runs in two PHASES, both registered
// behind this one tool so the SKILL narrates one tool at steps 6 and 9:
//
//   phase 'commit-push' (step 6): stage ONLY the spine-computed file set
//     (`git add -- ...files`, never `add -A`/`-u`/`.`), guard an empty changeset,
//     commit with the two-`-m` form (subject + `Closes #<N>` trailer), compose
//     the exported `pushAndVerify` landing check, and write the `pushed`
//     checkpoint into run-state.json ONLY after the push is confirmed landed.
//
//   phase 'post-merge' (step 9, the thin tail): write the `merged` anchor into
//     run-state.json, remove the slice worktree, then force-reclaim the local
//     slice branch (ordered AFTER worktree removal — a checked-out branch refuses
//     `branch -D` — and idempotent if the branch is already gone).
//
// WHAT STAYS IN THE SPINE (never here, per the no-gh-in-MCP invariant): every
// forge op — `gh pr create`, the mergeability poll, `gh pr merge --squash`, the
// label edit — and the `pr-open` checkpoint, and the conflict-resolver path.
// finalize_slice is git-only, routed through the hardened exec seam (`src/git.ts`),
// and never throws — every failure mode is a structured `failed{errorCode}`.
//
// PATH DISCIPLINE — two distinct paths, never conflated:
//   `worktreePath` — the slice worktree; stage/commit/push and the worktree
//     removal target run here. It is a fresh checkout: `.orchestrate/runs/` is
//     gitignored and absent from it.
//   `repoPath`     — the MAIN repository root; the canonical run-state.json lives
//     under it (`resolveRunDir(repoPath, runId)`), and the post-merge worktree
//     removal + local `branch -D` are driven from it (by step 9 the worktree is
//     gone, so the main root is the only valid cwd for the branch reclaim).

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const finalizeSliceInputSchema = z.object({
  phase: z
    .enum(["commit-push", "post-merge"])
    .describe(
      "Which finalization phase to run. 'commit-push' = §3 step 6: stage the " +
        "named file set, guard an empty changeset, commit (subject + `Closes " +
        "#<N>`), push-and-verify, and write `subState:'pushed'` on a confirmed " +
        "landing. 'post-merge' = §3 step 9 (the thin tail): write " +
        "`subState:'merged'`, remove the worktree, then force-reclaim the local " +
        "slice branch (idempotent). Forge ops and the `pr-open` checkpoint stay " +
        "in the spine."
    ),
  worktreePath: z
    .string()
    .describe(
      "Absolute path of the slice WORKTREE. In 'commit-push' the stage/commit/" +
        "push run here; in 'post-merge' it is the worktree removed. NOT where " +
        "run-state.json lives — that is under `repoPath` (the main repo root)."
    ),
  repoPath: z
    .string()
    .describe(
      "Absolute path of the MAIN repository root — the canonical run-state.json " +
        "lives under it at `.orchestrate/runs/<runId>/run-state.json`, NOT under " +
        "the slice worktree (a fresh checkout that gitignores `.orchestrate/" +
        "runs/`). In 'post-merge' the worktree removal and the local `branch -D` " +
        "are also driven from here (the worktree is gone by then)."
    ),
  runId: z
    .string()
    .describe(
      "The orchestration run's id (`prd<N>-<timestamp>` or `backlog-" +
        "<timestamp>`). Selects the per-run directory `.orchestrate/runs/<runId>/` " +
        "under `repoPath` whose run-state.json this tool mutates."
    ),
  sliceId: z
    .string()
    .describe(
      "The issue-id-string key of this slice in run-state's `slices` map. Its " +
        "`subState` is the field this tool advances ('pushed' then 'merged')."
    ),
  branch: z
    .string()
    .describe(
      "The slice's local branch name (e.g. `orchestrate/slice-7`). In " +
        "'commit-push' it is the branch pushed and verified; in 'post-merge' it " +
        "is the local branch force-reclaimed after worktree removal."
    ),
  remote: z
    .string()
    .optional()
    .default("origin")
    .describe(
      "Remote to push to and verify against in 'commit-push'. Defaults to " +
        "`origin`. Unused in 'post-merge' (local reclaim only)."
    ),
  setUpstream: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "When true, the 'commit-push' push sets the upstream tracking ref (`-u`) " +
        "— the first push of a new slice branch. Default true."
    ),
  files: z
    .array(z.string())
    .optional()
    .describe(
      "The spine-computed EXACT file set to stage in 'commit-push' (the union " +
        "of the validated implementer + reviewer `filesChanged`). Staged via " +
        "`git add -- ...files` — NEVER `git add -A`/`-u`/`.`, so untracked build " +
        "artifacts in the worktree are never committed. Required for " +
        "'commit-push'; ignored in 'post-merge'."
    ),
  commitSubject: z
    .string()
    .optional()
    .describe(
      "The commit subject line for 'commit-push' (e.g. `feat(x): <issue " +
        "title>`). Committed via a first `-m`; the `Closes #<issueNumber>` " +
        "trailer is the second `-m`. Required for 'commit-push'."
    ),
  issueNumber: z
    .number()
    .int()
    .optional()
    .describe(
      "The GitHub issue number for the `Closes #<N>` commit trailer in " +
        "'commit-push'. Required for 'commit-push'."
    ),
});

export const finalizeSliceOutputSchema = z.object({
  status: z
    .enum(["ok", "failed"])
    .describe(
      "Outcome discriminant. 'ok' = the requested phase completed (commit + " +
        "verified push, or the merged-tail removal); 'failed' = a git or " +
        "run-state step failed — see `errorCode`."
    ),
  verdict: z
    .enum(["committed-pushed", "failed"])
    .describe(
      "The slice-finalization verdict. 'committed-pushed' on a successful phase " +
        "(both phases report it — 'commit-push' on a confirmed landing, " +
        "'post-merge' on the merged-tail completion); 'failed' otherwise."
    ),
  branch: z
    .string()
    .optional()
    .describe("The branch acted on. Present when status='ok'."),
  remote: z
    .string()
    .optional()
    .describe(
      "The remote the branch landed on. Present in a successful 'commit-push'."
    ),
  sha: z
    .string()
    .optional()
    .describe(
      "The commit SHA confirmed on the remote (matches the local branch tip). " +
        "Present in a successful 'commit-push'."
    ),
  attempts: z
    .number()
    .optional()
    .describe(
      "How many landing-verification polls ran before the remote ref matched " +
        "(>=1). Present in a successful 'commit-push'."
    ),
  worktreeRemoved: z
    .boolean()
    .optional()
    .describe(
      "True when the worktree was removed (or was already absent — idempotent). " +
        "Present in a successful 'post-merge'."
    ),
  branchReclaimed: z
    .boolean()
    .optional()
    .describe(
      "True when the local slice branch was deleted (or was already absent — " +
        "idempotent). Present in a successful 'post-merge'."
    ),
  errorCode: z
    .enum([
      "INVALID_INPUT",
      "EMPTY_CHANGESET",
      "PUSH_FAILED",
      "BRANCH_NOT_ON_REMOTE",
      "RUN_ID_INVALID",
      "RUN_STATE_NOT_FOUND",
      "RUN_STATE_INVALID",
      "SLICE_NOT_IN_RUN_STATE",
      "RUN_STATE_WRITE_FAILED",
      "WORKTREE_REMOVE_FAILED",
      "GIT_ERROR",
    ])
    .optional()
    .describe(
      "Machine-readable failure category (git-only). 'INVALID_INPUT' = a " +
        "branch/remote/path would be parsed by git as an option flag, or a " +
        "required phase field is missing; 'EMPTY_CHANGESET' = nothing was staged " +
        "(`git diff --cached --quiet` clean) — the slice produced no changes; " +
        "'PUSH_FAILED'/'BRANCH_NOT_ON_REMOTE' = bubbled from pushAndVerify (the " +
        "push exited non-zero, or exited 0 but never landed at the expected SHA " +
        "— the silent-failure mode); 'RUN_ID_INVALID' = the runId is malformed; " +
        "'RUN_STATE_NOT_FOUND'/'RUN_STATE_INVALID' = run-state.json is absent or " +
        "not parseable; 'SLICE_NOT_IN_RUN_STATE' = `sliceId` is not a key in the " +
        "`slices` map; 'RUN_STATE_WRITE_FAILED' = the checkpoint write failed; " +
        "'WORKTREE_REMOVE_FAILED' = the worktree could not be removed; " +
        "'GIT_ERROR' = another git command could not run."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='failed'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type FinalizeSliceInput = z.infer<typeof finalizeSliceInputSchema>;
export type FinalizeSliceOutput = z.infer<typeof finalizeSliceOutputSchema>;

// ─── Internal: run-state read/mutate/write (raw JSON, schema-faithful) ─────────
//
// The run-state write deliberately round-trips RAW JSON — read, mutate exactly
// `slices[sliceId].subState` (+ the two `updatedAt` timestamps), stringify back —
// rather than parsing through render.ts's `runStateSchema`. The schema omits live
// keys (e.g. `driverSessionId`, which binds the context-watchdog to its run), so a
// parse→reserialize round-trip would silently DROP them. Raw mutation preserves
// the full object.

type RunStateWriteResult =
  | { ok: true }
  | {
      ok: false;
      errorCode:
        | "RUN_ID_INVALID"
        | "RUN_STATE_NOT_FOUND"
        | "RUN_STATE_INVALID"
        | "SLICE_NOT_IN_RUN_STATE"
        | "RUN_STATE_WRITE_FAILED";
      errorMessage: string;
    };

/**
 * Reads `.orchestrate/runs/<runId>/run-state.json` under `repoPath` (the MAIN
 * repo root — NEVER the worktree), sets `slices[sliceId].subState` to `subState`,
 * refreshes that slice's `updatedAt` and the top-level `updatedAt`, and writes
 * the whole object back as raw JSON. Never throws — every failure is a keyed
 * result. The full object is preserved (no schema round-trip), so live keys the
 * canonical schema omits (e.g. `driverSessionId`) survive.
 */
function writeSubState(
  repoPath: string,
  runId: string,
  sliceId: string,
  subState: "pushed" | "merged"
): RunStateWriteResult {
  const resolved = resolveRunDir(repoPath, runId);
  if (!resolved.ok) {
    return {
      ok: false,
      errorCode: "RUN_ID_INVALID",
      errorMessage: resolved.errorMessage,
    };
  }
  const statePath = resolved.paths.runStatePath;

  let raw: string;
  try {
    raw = fs.readFileSync(statePath, "utf8");
  } catch {
    return {
      ok: false,
      errorCode: "RUN_STATE_NOT_FOUND",
      errorMessage: `No run-state.json found at ${statePath}.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      errorCode: "RUN_STATE_INVALID",
      errorMessage: `run-state.json is not valid JSON: ${
        err instanceof Error ? err.message.split("\n")[0] : String(err)
      }`,
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      errorCode: "RUN_STATE_INVALID",
      errorMessage: "run-state.json is not a JSON object.",
    };
  }

  const obj = parsed as Record<string, unknown>;
  const slices = obj.slices;
  if (
    slices === null ||
    typeof slices !== "object" ||
    Array.isArray(slices)
  ) {
    return {
      ok: false,
      errorCode: "RUN_STATE_INVALID",
      errorMessage: "run-state.json `slices` is not a map keyed by issue id.",
    };
  }
  const sliceMap = slices as Record<string, unknown>;
  const slice = sliceMap[sliceId];
  if (slice === null || typeof slice !== "object" || Array.isArray(slice)) {
    return {
      ok: false,
      errorCode: "SLICE_NOT_IN_RUN_STATE",
      errorMessage: `Slice '${sliceId}' is not a key in run-state.json's slices map.`,
    };
  }

  const nowIso = new Date().toISOString();
  (slice as Record<string, unknown>).subState = subState;
  (slice as Record<string, unknown>).updatedAt = nowIso;
  obj.updatedAt = nowIso;

  try {
    fs.writeFileSync(statePath, JSON.stringify(obj, null, 2), "utf8");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      errorCode: "RUN_STATE_WRITE_FAILED",
      errorMessage: `Could not write run-state.json at ${statePath}: ${
        err instanceof Error ? err.message.split("\n")[0] : String(err)
      }`,
    };
  }
}

// ─── Internal: idempotent local-branch reclaim (cloned from clean-runs.ts) ─────
//
// `deleteLocalBranch` / `isAbsentRefError` are module-private in clean-runs.ts;
// the brief mandates cloning the idempotency pattern rather than importing it.

/**
 * True when a `cleanGitError` string indicates the ref simply did not exist —
 * which, for an idempotent reclaim, is success, not failure. A run resumed at
 * `subState: merged` may find the branch already reclaimed by an earlier pass.
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
 * Force-deletes a branch's LOCAL ref from `repoPath`. The `-D` force is
 * mandatory: the squash-merge rewrote the slice's commit SHA, so the branch is
 * not an ancestor of umbrella and `git branch -d` would refuse it. An
 * already-absent local ref is success (idempotent). Returns null on success, or a
 * cleaned error message when the deletion genuinely failed. Never throws.
 */
async function deleteLocalBranch(
  branch: string,
  repoPath: string
): Promise<string | null> {
  try {
    // `--` terminates option parsing; the branch name is a positional.
    await gitExecFile(["branch", "-D", "--", branch], repoPath);
    return null;
  } catch (err) {
    const message = cleanGitError(err);
    if (isAbsentRefError(message)) {
      return null; // never created, or already deleted — success.
    }
    return message;
  }
}

// ─── finalize_slice ────────────────────────────────────────────────────────────

/**
 * Finalizes one reviewed slice's git + run-state mechanics for the requested
 * `phase`. `opts` injects the backoff `sleep` (and pushAndVerify tuning) for
 * fast, deterministic tests; the registration handler calls this with no `opts`
 * (real sleep). It is never a public Zod field. Never throws — every failure mode
 * is a structured `failed{errorCode}` result.
 */
export async function finalizeSlice(
  input: FinalizeSliceInput,
  opts?: VerifyOptions
): Promise<FinalizeSliceOutput> {
  if (input.phase === "commit-push") {
    return finalizeCommitPush(input, opts);
  }
  return finalizePostMerge(input);
}

/**
 * Phase 'commit-push' (§3 step 6): stage the named files, guard an empty
 * changeset, commit (subject + `Closes #<N>`), push-and-verify, and write
 * `subState:'pushed'` ONLY after the push is confirmed landed.
 */
async function finalizeCommitPush(
  input: FinalizeSliceInput,
  opts?: VerifyOptions
): Promise<FinalizeSliceOutput> {
  const { worktreePath, repoPath, runId, sliceId, branch } = input;
  const remote = input.remote ?? "origin";
  const setUpstream = input.setUpstream ?? true;

  // 0. Required-field guard for this phase.
  if (
    !input.files ||
    input.commitSubject === undefined ||
    input.issueNumber === undefined
  ) {
    return failed(
      "INVALID_INPUT",
      "phase 'commit-push' requires `files`, `commitSubject`, and `issueNumber`."
    );
  }
  const { files, commitSubject, issueNumber } = input;

  // 1. Option-injection guards — branch and remote interpolate into git args.
  //    Guarded BEFORE staging/commit so a `--force` branch never leaves a
  //    dangling local commit (pushAndVerify guards too, but only after commit).
  const branchGuard = optionInjectionError("branch", branch);
  if (branchGuard) return failed("INVALID_INPUT", branchGuard);
  const remoteGuard = optionInjectionError("remote", remote);
  if (remoteGuard) return failed("INVALID_INPUT", remoteGuard);

  // 2. Stage EXACTLY the named files. `git add -- ...files` (NEVER -A/-u/.) so
  //    untracked build artifacts the capability tools leave behind are excluded.
  try {
    await gitExecFile(["add", "--", ...files], worktreePath);
  } catch (err) {
    return failed("GIT_ERROR", cleanGitError(err));
  }

  // 3. Empty-changeset guard. `git diff --cached --quiet` exits 0 (no throw) when
  //    NOTHING is staged, and exits non-zero (gitExecFile THROWS) when there ARE
  //    staged changes — so the THROW is the success path here.
  let hasStaged = false;
  try {
    await gitExecFile(["diff", "--cached", "--quiet"], worktreePath);
    hasStaged = false; // exit 0 → index clean → nothing staged.
  } catch {
    hasStaged = true; // non-zero exit → staged changes present.
  }
  if (!hasStaged) {
    return failed(
      "EMPTY_CHANGESET",
      "Nothing was staged — the slice produced no changes; not committing."
    );
  }

  // 4. Commit with the two-`-m` form: subject line + `Closes #<N>` trailer.
  //    execFile (no shell), so no `--` (no positionals) and no newline trick.
  try {
    await gitExecFile(
      ["commit", "-m", commitSubject, "-m", `Closes #${issueNumber}`],
      worktreePath
    );
  } catch (err) {
    return failed("GIT_ERROR", cleanGitError(err));
  }

  // 5. Compose the exported pushAndVerify — do NOT re-implement push/verify. A
  //    push that never lands bubbles its push-failure code unchanged.
  const push = await pushAndVerify(
    { repoPath: worktreePath, branch, remote, setUpstream },
    opts
  );
  if (push.status === "error") {
    return {
      status: "failed",
      verdict: "failed",
      errorCode: push.errorCode ?? "GIT_ERROR",
      errorMessage: push.errorMessage,
    };
  }

  // 6. Write `subState:'pushed'` ONLY after pushAndVerify returns ok — the
  //    `pushed` checkpoint attests to a CONFIRMED landing, never a bare exit-0.
  const write = writeSubState(repoPath, runId, sliceId, "pushed");
  if (!write.ok) {
    return failed(write.errorCode, write.errorMessage);
  }

  return {
    status: "ok",
    verdict: "committed-pushed",
    branch: push.branch,
    remote: push.remote,
    sha: push.sha,
    attempts: push.attempts,
  };
}

/**
 * Phase 'post-merge' (§3 step 9, the thin tail): write `subState:'merged'`,
 * remove the worktree, then force-reclaim the local branch. The ORDER is
 * load-bearing: the `merged` anchor is the integration-boundary checkpoint and is
 * written FIRST, then the worktree is removed (a checked-out branch refuses
 * `branch -D`), then the local branch is reclaimed. Worktree-already-absent and
 * branch-already-absent both count as success — a run resumed at
 * `subState: merged` re-enters here idempotently.
 */
async function finalizePostMerge(
  input: FinalizeSliceInput
): Promise<FinalizeSliceOutput> {
  const { worktreePath, repoPath, runId, sliceId, branch } = input;

  // 1. Option-injection guard on the branch (it flows into `branch -D`).
  const branchGuard = optionInjectionError("branch", branch);
  if (branchGuard) return failed("INVALID_INPUT", branchGuard);

  // 2. Write `subState:'merged'` FIRST — the integration-boundary anchor, set
  //    before any removal so a crash between here and the reclaim resumes at
  //    step 9 and re-runs the idempotent removal, never re-merging.
  const write = writeSubState(repoPath, runId, sliceId, "merged");
  if (!write.ok) {
    return failed(write.errorCode, write.errorMessage);
  }

  // 3. Remove the worktree (force — it may hold untracked build artifacts). An
  //    already-absent worktree (PATH_NOT_FOUND) is success: idempotent resume.
  let worktreeRemoved = false;
  const removed = await removeWorktree({
    worktreePath,
    repoPath,
    force: true,
  });
  if (removed.status === "ok" || removed.errorCode === "PATH_NOT_FOUND") {
    worktreeRemoved = true;
  } else {
    return {
      status: "failed",
      verdict: "failed",
      errorCode: "WORKTREE_REMOVE_FAILED",
      errorMessage:
        removed.status === "refused"
          ? removed.refusalReason ?? "Worktree removal was refused."
          : removed.errorMessage ?? "Worktree removal failed.",
    };
  }

  // 4. Force-reclaim the LOCAL slice branch — AFTER worktree removal (a
  //    checked-out branch refuses `branch -D`). The `-D` force is mandatory (the
  //    squash rewrote the SHA). An already-absent branch is success (idempotent).
  const branchErr = await deleteLocalBranch(branch, repoPath);
  if (branchErr) {
    return failed("GIT_ERROR", branchErr);
  }

  return {
    status: "ok",
    verdict: "committed-pushed",
    branch,
    worktreeRemoved,
    branchReclaimed: true,
  };
}

/** Builds a structured `failed{errorCode}` result. */
function failed(
  errorCode: NonNullable<FinalizeSliceOutput["errorCode"]>,
  errorMessage: string
): FinalizeSliceOutput {
  return {
    status: "failed",
    verdict: "failed",
    errorCode,
    errorMessage,
  };
}
