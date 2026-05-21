import * as path from "path";
import * as fs from "fs";
import { z } from "zod";
import {
  gitExecFile,
  optionInjectionError,
  cleanGitError,
  GitExecError,
} from "../git.js";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const createWorktreeInputSchema = z.object({
  baseRef: z
    .string()
    .describe(
      "The git ref (branch, tag, or SHA) to branch the new worktree from. " +
        "A 'git fetch' is attempted before branching; see the `fetchStatus` " +
        "output field for whether it ran."
    ),
  branch: z
    .string()
    .describe(
      "Name of the new local branch to create for the worktree. Must not " +
        "already exist (see the BRANCH_EXISTS error code)."
    ),
  worktreePath: z
    .string()
    .describe(
      "Absolute or relative (to `repoPath`) filesystem path where the " +
        "worktree will be created. Must not already exist."
    ),
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the git repository. Defaults to the current working directory."
    ),
});

export const removeWorktreeInputSchema = z.object({
  worktreePath: z
    .string()
    .describe(
      "Absolute or relative (to `repoPath`) path to the worktree ROOT to " +
        "remove. Must be a registered worktree root, not a subdirectory of one."
    ),
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the git repository that owns the worktree. Defaults to the " +
        "current working directory."
    ),
});

export const createWorktreeOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = worktree created; 'error' = creation " +
        "failed. create_worktree never refuses."
    ),
  path: z
    .string()
    .optional()
    .describe(
      "Absolute filesystem path of the created worktree. Present when status='ok'."
    ),
  branch: z
    .string()
    .optional()
    .describe("Name of the branch in the worktree. Present when status='ok'."),
  fetchStatus: z
    .enum(["ok", "skipped-no-remote", "failed"])
    .optional()
    .describe(
      "Outcome of the pre-branch 'git fetch'. Present when status='ok'. " +
        "'ok' = fetch succeeded; 'skipped-no-remote' = no remote configured; " +
        "'failed' = a remote exists but fetch threw (the worktree was still " +
        "created from a possibly-stale ref — see `fetchError`)."
    ),
  fetchError: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable reason the fetch failed. Present only when " +
        "fetchStatus='failed'."
    ),
  errorCode: z
    .enum([
      "INVALID_INPUT",
      "BRANCH_EXISTS",
      "PATH_EXISTS",
      "BASE_REF_NOT_FOUND",
      "GIT_ERROR",
    ])
    .optional()
    .describe("Machine-readable failure category. Present when status='error'."),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='error'."
    ),
});

export const removeWorktreeOutputSchema = z.object({
  status: z
    .enum(["ok", "refused", "error"])
    .describe(
      "Outcome discriminant. 'ok' = worktree removed; 'refused' = worktree " +
        "had uncommitted/untracked changes and was left intact; 'error' = the " +
        "request could not be processed."
    ),
  removedPath: z
    .string()
    .optional()
    .describe(
      "Absolute path of the worktree that was removed. Present when status='ok'."
    ),
  dirtyFiles: z
    .array(z.string())
    .optional()
    .describe(
      "Real path strings of the uncommitted/untracked files that triggered " +
        "the refusal. Present when status='refused'. Each entry is a single " +
        "path — rename/copy entries are never rendered as 'old -> new'."
    ),
  refusalReason: z
    .string()
    .optional()
    .describe(
      "Human-readable explanation of why removal was refused. Present when " +
        "status='refused'."
    ),
  errorCode: z
    .enum(["INVALID_INPUT", "PATH_NOT_FOUND", "NOT_A_WORKTREE", "GIT_ERROR"])
    .optional()
    .describe("Machine-readable failure category. Present when status='error'."),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='error'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type CreateWorktreeInput = z.infer<typeof createWorktreeInputSchema>;
export type CreateWorktreeOutput = z.infer<typeof createWorktreeOutputSchema>;
export type RemoveWorktreeInput = z.infer<typeof removeWorktreeInputSchema>;
export type RemoveWorktreeOutput = z.infer<typeof removeWorktreeOutputSchema>;

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Classifies a git failure on `worktree add` into a create_worktree errorCode. */
function classifyCreateError(
  err: unknown
): z.infer<typeof createWorktreeOutputSchema>["errorCode"] {
  const stderr = (err instanceof GitExecError ? err.stderr : "").toLowerCase();
  if (stderr.includes("already exists")) {
    // `worktree add` reports both an existing branch and an existing path
    // with "already exists"; the branch case is pre-checked before this
    // point, so an "already exists" reaching here is a path collision.
    return "PATH_EXISTS";
  }
  if (
    stderr.includes("not a valid") ||
    stderr.includes("invalid reference") ||
    stderr.includes("unknown revision")
  ) {
    return "BASE_REF_NOT_FOUND";
  }
  return "GIT_ERROR";
}

/**
 * Resolves `worktreePath` against `cwd` to an absolute path. A path that is
 * already absolute is returned unchanged.
 */
function resolveWorktreePath(worktreePath: string, cwd: string): string {
  return path.isAbsolute(worktreePath)
    ? worktreePath
    : path.resolve(cwd, worktreePath);
}

/**
 * Canonicalizes a path for symlink-safe equality comparison.
 *
 * `path.resolve` does not follow symlinks — on macOS `/tmp` is a symlink to
 * `/private/tmp`, so a caller-supplied `/tmp/foo` would not string-match the
 * `/private/tmp/foo` that `git worktree list` reports. `fs.realpathSync`
 * resolves symlink components. Falls back to `path.resolve` when the path
 * does not exist on disk (realpath throws in that case).
 */
function canonicalize(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/**
 * Returns true when `refs/heads/<branch>` already resolves in the repo.
 * A failure to run rev-parse is treated as "branch does not exist" — the
 * subsequent `worktree add` will surface any real git problem.
 */
async function branchExists(branch: string, cwd: string): Promise<boolean> {
  try {
    await gitExecFile(
      ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
      cwd
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Collects the registered worktree root paths from `git worktree list`.
 * Parsed from `--porcelain` output: each record begins with `worktree <path>`.
 */
async function listWorktreeRoots(cwd: string): Promise<string[]> {
  const { stdout } = await gitExecFile(
    ["worktree", "list", "--porcelain"],
    cwd
  );
  const roots: string[] = [];
  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      roots.push(line.slice("worktree ".length).trim());
    }
  }
  return roots;
}

// ─── create_worktree ──────────────────────────────────────────────────────────

export async function createWorktree(
  input: CreateWorktreeInput
): Promise<CreateWorktreeOutput> {
  const { baseRef, branch, worktreePath } = input;
  const cwd = input.repoPath ?? process.cwd();

  // Option-injection guard: reject values git would treat as flags.
  for (const [field, value] of [
    ["branch", branch],
    ["baseRef", baseRef],
    ["worktreePath", worktreePath],
  ] as const) {
    const guardErr = optionInjectionError(field, value);
    if (guardErr) {
      return {
        status: "error",
        errorCode: "INVALID_INPUT",
        errorMessage: guardErr,
      };
    }
  }

  // Pre-check the branch so a failure can never leave an orphan branch ref.
  if (await branchExists(branch, cwd)) {
    return {
      status: "error",
      errorCode: "BRANCH_EXISTS",
      errorMessage: `A branch named "${branch}" already exists.`,
    };
  }

  // Attempt fetch; surface the outcome via fetchStatus rather than swallowing it.
  let fetchStatus: NonNullable<CreateWorktreeOutput["fetchStatus"]>;
  let fetchError: string | undefined;
  try {
    const { stdout: remotes } = await gitExecFile(["remote"], cwd);
    if (remotes.trim().length === 0) {
      fetchStatus = "skipped-no-remote";
    } else {
      try {
        await gitExecFile(["fetch", "--all", "--prune"], cwd);
        fetchStatus = "ok";
      } catch (err) {
        fetchStatus = "failed";
        fetchError = cleanGitError(err);
      }
    }
  } catch (err) {
    // `git remote` itself failed — treat as a failed fetch attempt.
    fetchStatus = "failed";
    fetchError = cleanGitError(err);
  }

  const absWorktreePath = resolveWorktreePath(worktreePath, cwd);

  try {
    // `--` terminates option parsing; path/baseRef positionals follow.
    await gitExecFile(
      ["worktree", "add", "-b", branch, "--", absWorktreePath, baseRef],
      cwd
    );
  } catch (err) {
    // Best-effort cleanup: git may have created the branch before failing.
    // Never let cleanup throw.
    try {
      await gitExecFile(["branch", "-D", branch], cwd);
    } catch {
      // Branch was never created, or cannot be deleted — ignore.
    }
    return {
      status: "error",
      errorCode: classifyCreateError(err),
      errorMessage: cleanGitError(err),
    };
  }

  return {
    status: "ok",
    path: absWorktreePath,
    branch,
    fetchStatus,
    ...(fetchError ? { fetchError } : {}),
  };
}

// ─── remove_worktree ──────────────────────────────────────────────────────────

export async function removeWorktree(
  input: RemoveWorktreeInput
): Promise<RemoveWorktreeOutput> {
  const { worktreePath } = input;
  const cwd = input.repoPath ?? process.cwd();

  // Option-injection guard.
  const guardErr = optionInjectionError("worktreePath", worktreePath);
  if (guardErr) {
    return {
      status: "error",
      errorCode: "INVALID_INPUT",
      errorMessage: guardErr,
    };
  }

  const absWorktreePath = resolveWorktreePath(worktreePath, cwd);

  // The path must exist on disk.
  if (!fs.existsSync(absWorktreePath)) {
    return {
      status: "error",
      errorCode: "PATH_NOT_FOUND",
      errorMessage: `Worktree path does not exist: ${absWorktreePath}`,
    };
  }

  // The path must be a registered worktree ROOT — not a non-worktree
  // directory and not a subdirectory of a worktree. One check covers both.
  let worktreeRoots: string[];
  try {
    worktreeRoots = await listWorktreeRoots(cwd);
  } catch (err) {
    return {
      status: "error",
      errorCode: "GIT_ERROR",
      errorMessage: cleanGitError(err),
    };
  }
  // Symlink-safe comparison: `git worktree list` may report canonicalized
  // paths that differ from the caller's path only by symlink components.
  const canonicalTarget = canonicalize(absWorktreePath);
  const isRegisteredRoot = worktreeRoots.some(
    (root) => canonicalize(root) === canonicalTarget
  );
  if (!isRegisteredRoot) {
    return {
      status: "error",
      errorCode: "NOT_A_WORKTREE",
      errorMessage: `Path is not a registered git worktree root: ${absWorktreePath}`,
    };
  }

  // Check for uncommitted or untracked changes. `-z` emits NUL-terminated
  // records with no C-style quoting; rename/copy entries split cleanly.
  let porcelain: string;
  try {
    const { stdout } = await gitExecFile(
      ["status", "--porcelain", "-z"],
      absWorktreePath
    );
    porcelain = stdout;
  } catch (err) {
    return {
      status: "error",
      errorCode: "GIT_ERROR",
      errorMessage: cleanGitError(err),
    };
  }

  const dirtyFiles = parsePorcelainZ(porcelain);
  if (dirtyFiles.length > 0) {
    return {
      status: "refused",
      dirtyFiles,
      refusalReason:
        "Worktree has uncommitted or untracked changes; removal refused. " +
        "The worktree and its branch have been left intact.",
    };
  }

  // Clean — proceed with removal (never --force).
  // `--` terminates option parsing; the path positional follows.
  try {
    await gitExecFile(["worktree", "remove", "--", absWorktreePath], cwd);
  } catch (err) {
    return {
      status: "error",
      errorCode: "GIT_ERROR",
      errorMessage: cleanGitError(err),
    };
  }

  return {
    status: "ok",
    removedPath: absWorktreePath,
  };
}

/**
 * Parses `git status --porcelain -z` output into a list of real path strings.
 *
 * In `-z` mode each record is NUL-terminated and the leading 3-character
 * `XY ` status prefix is followed by the path with NO C-style quoting. For a
 * rename/copy (status R/C) the entry emits TWO NUL-separated tokens: the
 * destination path (carrying the status prefix) immediately followed by a
 * bare source path. Both are real paths and are returned individually — the
 * output never contains an `old -> new` composite.
 */
function parsePorcelainZ(porcelain: string): string[] {
  // Records are NUL-terminated; the final record has a trailing NUL.
  const tokens = porcelain.split("\0").filter((t) => t.length > 0);
  const paths: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // A status record starts with a 3-char `XY ` prefix (X and Y are status
    // codes or spaces). The path is everything after index 3.
    const statusPrefix = token.slice(0, 2);
    const renameOrCopy = statusPrefix.includes("R") || statusPrefix.includes("C");
    const filePath = token.slice(3);
    if (filePath.length > 0) {
      paths.push(filePath);
    }
    if (renameOrCopy) {
      // The next token is the bare source path of the rename/copy.
      const source = tokens[i + 1];
      if (source !== undefined && source.length > 0) {
        paths.push(source);
        i++; // consumed the source token
      }
    }
  }
  return paths;
}
