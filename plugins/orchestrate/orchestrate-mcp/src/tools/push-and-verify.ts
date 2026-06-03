import { z } from "zod";
import { gitExecFile, optionInjectionError, cleanGitError } from "../git.js";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const pushAndVerifyInputSchema = z.object({
  repoPath: z
    .string()
    .describe(
      "Absolute path the git push runs in. For a slice push this is the slice " +
        "**worktree** path (the orchestrator otherwise runs `git -C " +
        "<worktree-path> push`), not the main repo root."
    ),
  branch: z
    .string()
    .describe(
      "Name of the local branch to push and then verify landed on the remote " +
        "(e.g. `orchestrate/slice-7`)."
    ),
  remote: z
    .string()
    .optional()
    .default("origin")
    .describe("Remote to push to and verify against. Defaults to `origin`."),
  setUpstream: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "When true, push with `-u` to set the upstream tracking ref (the first " +
        "push of a new slice branch). Default true."
    ),
});

export const pushAndVerifyOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the branch was pushed AND confirmed on the " +
        "remote at the expected commit; 'error' = push failed, the branch never " +
        "landed, or input was rejected."
    ),
  branch: z
    .string()
    .optional()
    .describe("The branch that was verified. Present when status='ok'."),
  remote: z
    .string()
    .optional()
    .describe("The remote it landed on. Present when status='ok'."),
  sha: z
    .string()
    .optional()
    .describe(
      "The commit SHA confirmed on the remote (matches the local branch tip). " +
        "Present when status='ok'."
    ),
  attempts: z
    .number()
    .optional()
    .describe(
      "How many landing-verification polls ran before the remote ref matched " +
        "(>=1). Present when status='ok'."
    ),
  errorCode: z
    .enum(["INVALID_INPUT", "PUSH_FAILED", "BRANCH_NOT_ON_REMOTE", "GIT_ERROR"])
    .optional()
    .describe(
      "Machine-readable failure category. 'INVALID_INPUT' = branch/remote would " +
        "be parsed by git as an option flag; 'PUSH_FAILED' = `git push` itself " +
        "exited non-zero after all retries; 'BRANCH_NOT_ON_REMOTE' = push " +
        "reported success but `git ls-remote` never showed the branch at the " +
        "expected SHA within the backoff budget (the silent-failure mode); " +
        "'GIT_ERROR' = a git command could not run (e.g. not a git worktree, or " +
        "local rev-parse failed)."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='error'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type PushAndVerifyInput = z.infer<typeof pushAndVerifyInputSchema>;
export type PushAndVerifyOutput = z.infer<typeof pushAndVerifyOutputSchema>;

// ─── Backoff constants ────────────────────────────────────────────────────────

/** Max landing-verification polls before giving up (fail-loud). */
const VERIFY_ATTEMPTS = 5;
/** Initial delay before the second verification poll (ms). */
const VERIFY_BASE_DELAY_MS = 500;
/** Each backoff step multiplies the previous delay by this factor. */
const VERIFY_BACKOFF_FACTOR = 2;
/** Ceiling on a single backoff delay (ms), so the schedule never runs away. */
const VERIFY_MAX_DELAY_MS = 8_000;
/** Max `git push` attempts before reporting PUSH_FAILED. */
const PUSH_ATTEMPTS = 3;

// ─── verifyLanded — the testable landing-verify seam ──────────────────────────

/**
 * Tuning + injection knobs for {@link verifyLanded} and the push-retry backoff.
 *
 * `sleep` is INTERNAL: it lets a test run the backoff schedule with no real
 * delay. It is deliberately NOT a public Zod input field — the MCP input schema
 * stays clean.
 */
export interface VerifyOptions {
  attempts?: number;
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * Polls `git ls-remote --heads <remote> <branch>` until the remote ref's SHA
 * matches `expectedSha`, with bounded exponential backoff between polls.
 *
 * SHA-MATCH, NOT MERE PRESENCE: a stale branch left over from a prior push
 * passes a bare existence check, yet that is exactly the silent-failure mode
 * this guards against — only a SHA match proves *this* push landed. The first
 * column of the matching `refs/heads/<branch>` line is the remote SHA; it is
 * compared against the local tip SHA the caller resolved.
 *
 * Returns `{ landed, attempts }`; `landed:false` after the full attempt budget
 * means the ref never appeared at the expected SHA. Never throws — a failed
 * `ls-remote` poll is treated as "not landed yet" and retried.
 */
export async function verifyLanded(
  repoPath: string,
  remote: string,
  branch: string,
  expectedSha: string,
  opts?: VerifyOptions
): Promise<{ landed: boolean; attempts: number }> {
  const attempts = opts?.attempts ?? VERIFY_ATTEMPTS;
  const baseDelayMs = opts?.baseDelayMs ?? VERIFY_BASE_DELAY_MS;
  const factor = opts?.factor ?? VERIFY_BACKOFF_FACTOR;
  const maxDelayMs = opts?.maxDelayMs ?? VERIFY_MAX_DELAY_MS;
  const sleep = opts?.sleep ?? defaultSleep;

  const refName = `refs/heads/${branch}`;

  for (let i = 1; i <= attempts; i++) {
    let remoteSha: string | null = null;
    try {
      const { stdout } = await gitExecFile(
        ["ls-remote", "--heads", remote, branch],
        repoPath
      );
      // Each line is `<sha>\t<ref>`; match the exact refs/heads/<branch> line
      // and read its first column (the remote SHA).
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        const [sha, ref] = trimmed.split(/\s+/);
        if (ref === refName) {
          remoteSha = sha;
          break;
        }
      }
    } catch {
      // A transient ls-remote failure is treated as "not landed yet"; retry.
      remoteSha = null;
    }

    // SHA-match — presence alone is insufficient; a stale ref would pass that.
    if (remoteSha !== null && remoteSha === expectedSha) {
      return { landed: true, attempts: i };
    }

    if (i < attempts) {
      const delay = Math.min(
        baseDelayMs * Math.pow(factor, i - 1),
        maxDelayMs
      );
      await sleep(delay);
    }
  }

  return { landed: false, attempts };
}

// ─── push_and_verify ──────────────────────────────────────────────────────────

/**
 * Pushes `branch` to `remote` and then verifies the branch actually LANDED on
 * the remote at the local tip SHA — closing the silent-failure mode where an
 * exit-0 `git push` never reaches the remote and a later forge operation fails
 * confusingly.
 *
 * Algorithm:
 *   1. Option-injection guard on `branch` and `remote`.
 *   2. Resolve the expected SHA from the local branch tip (`git rev-parse`).
 *   3. Push with bounded-backoff retry (transient push failures).
 *   4. Verify the branch landed at the expected SHA via {@link verifyLanded}
 *      (SHA-match `git ls-remote`, not presence).
 *   5. Fail loud with BRANCH_NOT_ON_REMOTE when a successful-exit push never
 *      lands within the budget.
 *
 * `opts` injects the backoff `sleep` (and tuning) for fast, deterministic
 * tests; the registration handler calls this with no `opts` (real sleep). It is
 * never a public Zod field. Never throws — every failure mode is a structured
 * result.
 */
export async function pushAndVerify(
  input: PushAndVerifyInput,
  opts?: VerifyOptions
): Promise<PushAndVerifyOutput> {
  const { repoPath, branch, remote, setUpstream } = input;
  const sleep = opts?.sleep ?? defaultSleep;
  const baseDelayMs = opts?.baseDelayMs ?? VERIFY_BASE_DELAY_MS;
  const factor = opts?.factor ?? VERIFY_BACKOFF_FACTOR;
  const maxDelayMs = opts?.maxDelayMs ?? VERIFY_MAX_DELAY_MS;

  // 1. Option-injection guard — both branch and remote interpolate into args.
  const branchGuard = optionInjectionError("branch", branch);
  if (branchGuard) {
    return {
      status: "error",
      errorCode: "INVALID_INPUT",
      errorMessage: branchGuard,
    };
  }
  const remoteGuard = optionInjectionError("remote", remote);
  if (remoteGuard) {
    return {
      status: "error",
      errorCode: "INVALID_INPUT",
      errorMessage: remoteGuard,
    };
  }

  // 2. Resolve the expected SHA from the local branch tip. A branch that does
  //    not exist locally cannot be verified.
  let expectedSha: string;
  try {
    const { stdout } = await gitExecFile(
      ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
      repoPath
    );
    expectedSha = stdout.trim();
  } catch (err) {
    return {
      status: "error",
      errorCode: "GIT_ERROR",
      errorMessage: cleanGitError(err),
    };
  }
  if (expectedSha.length === 0) {
    return {
      status: "error",
      errorCode: "GIT_ERROR",
      errorMessage: `Local branch ${branch} does not exist — cannot verify a push of a missing branch.`,
    };
  }

  // 3. Push with bounded-backoff retry (handles transient push failures).
  const pushArgs = [
    "push",
    ...(setUpstream ? ["-u"] : []),
    remote,
    branch,
  ];
  let lastPushErr: unknown = null;
  let pushed = false;
  for (let i = 1; i <= PUSH_ATTEMPTS; i++) {
    try {
      await gitExecFile(pushArgs, repoPath);
      pushed = true;
      break;
    } catch (err) {
      lastPushErr = err;
      if (i < PUSH_ATTEMPTS) {
        const delay = Math.min(
          baseDelayMs * Math.pow(factor, i - 1),
          maxDelayMs
        );
        await sleep(delay);
      }
    }
  }
  if (!pushed) {
    return {
      status: "error",
      errorCode: "PUSH_FAILED",
      errorMessage: cleanGitError(lastPushErr),
    };
  }

  // 4. Verify the branch actually landed at the expected SHA (SHA-match poll).
  const { landed, attempts } = await verifyLanded(
    repoPath,
    remote,
    branch,
    expectedSha,
    opts
  );

  // 5. Fail loud when a successful-exit push never lands within the budget.
  if (!landed) {
    return {
      status: "error",
      errorCode: "BRANCH_NOT_ON_REMOTE",
      errorMessage:
        `git push reported success but branch ${branch} never appeared at ` +
        `${expectedSha} on ${remote} after ${attempts} verification attempts ` +
        `— the push did not land.`,
    };
  }

  return {
    status: "ok",
    branch,
    remote,
    sha: expectedSha,
    attempts,
  };
}
