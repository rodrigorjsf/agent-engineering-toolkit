import * as fs from "fs";
import { z } from "zod";
import { gitExecFile, optionInjectionError, cleanGitError } from "../git.js";
import { parsePorcelainZ } from "./worktree.js";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const verifyChangesetInputSchema = z.object({
  worktreePath: z
    .string()
    .describe(
      "Absolute path to the slice worktree to inspect. The verification " +
        "treats this worktree as the source of truth for what was actually " +
        "changed."
    ),
  declaredFiles: z
    .array(z.string())
    .describe(
      "The changed-file set the implementer DECLARED in its result envelope " +
        "(`filesChanged`), as paths relative to the worktree root. An empty " +
        "array means the implementer claimed it changed nothing. Order and " +
        "duplicates are ignored — the comparison is set-based."
    ),
});

export const verifyChangesetOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the worktree was inspected and the " +
        "comparison ran; 'error' = the worktree could not be inspected."
    ),
  match: z
    .enum([
      "matched",
      "mismatch",
      "clean",
      "empty-but-declared",
      "suspiciously-empty",
    ])
    .optional()
    .describe(
      "The set-comparison verdict. Present when status='ok'. " +
        "'matched' = the declared set equals the worktree changeset; " +
        "'clean' = nothing was declared and the worktree is clean (a no-op " +
        "slice); 'mismatch' = the declared set and the worktree changeset " +
        "differ in at least one direction (see declaredButAbsent and " +
        "presentButUndeclared); 'empty-but-declared' = files were declared " +
        "but the worktree is entirely clean — the implementer's edits never " +
        "landed on disk; 'suspiciously-empty' = nothing was declared but the " +
        "worktree DOES have changes — the implementer under-reported its work. " +
        "Only 'matched' and 'clean' mean the declared set can be trusted as-is."
    ),
  actualFiles: z
    .array(z.string())
    .optional()
    .describe(
      "Every changed path the worktree actually carries — tracked " +
        "modifications, staged changes, and untracked files alike (build " +
        "artifacts NOT filtered). A rename emits both its source and " +
        "destination path, never an 'old -> new' composite. Present when " +
        "status='ok' (an empty array means a clean worktree)."
    ),
  declaredButAbsent: z
    .array(z.string())
    .optional()
    .describe(
      "Files the implementer declared in `filesChanged` that are NOT in the " +
        "worktree changeset — declared but never actually changed on disk. " +
        "Present when status='ok'; empty when every declared file is real."
    ),
  presentButUndeclared: z
    .array(z.string())
    .optional()
    .describe(
      "Files the worktree actually changed that the implementer did NOT " +
        "declare — undeclared collateral the orchestrator would otherwise " +
        "miss when staging only the declared set. Present when status='ok'; " +
        "empty when the implementer declared everything it touched."
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

export type VerifyChangesetInput = z.infer<typeof verifyChangesetInputSchema>;
export type VerifyChangesetOutput = z.infer<typeof verifyChangesetOutputSchema>;

// ─── verify_changeset ─────────────────────────────────────────────────────────

/**
 * Verifies a slice worktree's ACTUAL changeset against the changed-file set the
 * implementer DECLARED in its result envelope — the orchestrator's scope check
 * after every implementer returns, so a `completed` envelope is not trusted
 * before the disk has been compared against it.
 *
 * The worktree is inspected with `git status --porcelain -z` (the same
 * machinery `recover_changed_files` uses) and the declared set is compared to it
 * as a SET: order and duplicates are irrelevant. This is a cheap set comparison,
 * not a semantic scope check — it does NOT parse the issue body, does not judge
 * whether the changed files are the "right" files for the issue, and does not
 * read file contents. It answers only: do the declared files and the real
 * changeset agree?
 *
 * The `match` verdict classifies the comparison so the orchestrator can act:
 *  - 'clean'               — nothing declared, worktree clean (a no-op slice)
 *  - 'matched'             — declared set == worktree changeset (trustworthy)
 *  - 'empty-but-declared'  — files declared, worktree entirely clean (edits
 *                            never landed)
 *  - 'suspiciously-empty'  — nothing declared, worktree HAS changes (work
 *                            under-reported)
 *  - 'mismatch'            — the two sets differ in at least one direction
 *
 * Never throws — every failure mode is a structured result.
 */
export async function verifyChangeset(
  input: VerifyChangesetInput
): Promise<VerifyChangesetOutput> {
  const { worktreePath, declaredFiles } = input;

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
  let porcelain: string;
  try {
    const { stdout } = await gitExecFile(
      ["status", "--porcelain", "-z"],
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

  const actualFiles = parsePorcelainZ(porcelain);

  // Set-based comparison — order and duplicates do not matter.
  const declaredSet = new Set(declaredFiles);
  const actualSet = new Set(actualFiles);

  const declaredButAbsent = [...declaredSet]
    .filter((f) => !actualSet.has(f))
    .sort();
  const presentButUndeclared = [...actualSet]
    .filter((f) => !declaredSet.has(f))
    .sort();

  const match = classifyMatch(
    declaredSet.size,
    actualSet.size,
    declaredButAbsent.length,
    presentButUndeclared.length
  );

  return {
    status: "ok",
    match,
    actualFiles,
    declaredButAbsent,
    presentButUndeclared,
  };
}

/**
 * Maps the four comparison counts to a single `match` verdict. The two
 * "empty side" cases are called out specifically because they are the loud
 * turn-limit / under-report signals the orchestrator most needs to catch; any
 * other divergence collapses into the generic 'mismatch'.
 */
function classifyMatch(
  declaredCount: number,
  actualCount: number,
  absentCount: number,
  undeclaredCount: number
): NonNullable<VerifyChangesetOutput["match"]> {
  if (declaredCount === 0 && actualCount === 0) {
    return "clean";
  }
  if (declaredCount > 0 && actualCount === 0) {
    return "empty-but-declared";
  }
  if (declaredCount === 0 && actualCount > 0) {
    return "suspiciously-empty";
  }
  if (absentCount === 0 && undeclaredCount === 0) {
    return "matched";
  }
  return "mismatch";
}
