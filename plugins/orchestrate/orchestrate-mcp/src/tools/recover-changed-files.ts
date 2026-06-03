import * as fs from "fs";
import { z } from "zod";
import { gitExecFile, optionInjectionError, cleanGitError } from "../git.js";
import { parsePorcelainZ } from "./worktree.js";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const recoverChangedFilesInputSchema = z.object({
  worktreePath: z
    .string()
    .describe(
      "Absolute path to the slice worktree to inspect. The recovery treats " +
        "this worktree as the source of truth for the changed-file set."
    ),
});

export const recoverChangedFilesOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the changed-file set was recovered; " +
        "'error' = the worktree could not be inspected."
    ),
  changedFiles: z
    .array(z.string())
    .optional()
    .describe(
      "Every changed path in the worktree — tracked modifications, staged " +
        "changes, AND untracked files (build artifacts included; no filter is " +
        "applied). Each entry is a single real path relative to the worktree " +
        "root; a rename emits both its source and destination path, never an " +
        "'old -> new' composite. Present when status='ok' (an empty array " +
        "means a clean worktree)."
    ),
  errorCode: z
    .enum(["INVALID_INPUT", "PATH_NOT_FOUND", "GIT_ERROR"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'. " +
        "'INVALID_INPUT' = the path would be parsed by git as an option flag; " +
        "'PATH_NOT_FOUND' = the worktree path does not exist on disk; " +
        "'GIT_ERROR' = git could not report status (e.g. not a git worktree)."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='error'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type RecoverChangedFilesInput = z.infer<
  typeof recoverChangedFilesInputSchema
>;
export type RecoverChangedFilesOutput = z.infer<
  typeof recoverChangedFilesOutputSchema
>;

// ─── recover_changed_files ────────────────────────────────────────────────────

/**
 * Recovers the changed-file set of a slice worktree by inspecting it directly
 * with `git status --porcelain -z --untracked-files=all` — the orchestrator's fallback for when a
 * subagent's result envelope is missing or invalid and its `filesChanged` list
 * therefore cannot be trusted. The worktree is the source of truth.
 *
 * The recovery returns ALL changes — tracked modifications, staged changes, and
 * untracked files alike, build artifacts NOT filtered out. The orchestrator
 * already owns build-artifact handling on its commit path (it stages an
 * explicit file list, never `git add -A`); this tool is the diagnostic for an
 * inspect-and-preserve flow, where the complete picture is what is useful.
 *
 * Never throws — every failure mode is a structured result.
 */
export async function recoverChangedFiles(
  input: RecoverChangedFilesInput
): Promise<RecoverChangedFilesOutput> {
  const { worktreePath } = input;

  // Option-injection guard: reject a path git would treat as a flag.
  const guardErr = optionInjectionError("worktreePath", worktreePath);
  if (guardErr) {
    return {
      status: "error",
      errorCode: "INVALID_INPUT",
      errorMessage: guardErr,
    };
  }

  // The path must exist on disk before git can be run against it.
  if (!fs.existsSync(worktreePath)) {
    return {
      status: "error",
      errorCode: "PATH_NOT_FOUND",
      errorMessage: `Worktree path does not exist: ${worktreePath}`,
    };
  }

  // `-z` emits NUL-terminated records with no C-style quoting; rename/copy
  // entries split cleanly into both real paths via parsePorcelainZ.
  // --untracked-files=all enumerates files inside a new untracked dir (default -unormal collapses them to one 'dir/' entry); gitignored paths stay excluded.
  let porcelain: string;
  try {
    const { stdout } = await gitExecFile(
      ["status", "--porcelain", "-z", "--untracked-files=all"],
      worktreePath
    );
    porcelain = stdout;
  } catch (err) {
    return {
      status: "error",
      errorCode: "GIT_ERROR",
      errorMessage: cleanGitError(err),
    };
  }

  return {
    status: "ok",
    changedFiles: parsePorcelainZ(porcelain),
  };
}
