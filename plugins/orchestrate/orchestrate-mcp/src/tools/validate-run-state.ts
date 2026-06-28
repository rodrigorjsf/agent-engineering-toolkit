import * as fs from "fs";
import { z } from "zod";
import { resolveRunDir } from "../run-dir.js";
import { runStateSchema } from "./render.js";

// ─── validate_run_state ───────────────────────────────────────────────────────
//
// A thin, fast-fail guard over a run's run-state.json checkpoint. The latent
// trap it closes: `partition_backlog` returns `slices` as an ARRAY, but
// run-state.json stores `slices` as a MAP keyed by issue-id string. Passing the
// array straight through produces a checkpoint that fails `runStateSchema`, but
// today that only surfaces when a render tool runs — after the run has already
// burned expensive subagent turns. This tool reuses the SAME exported
// `runStateSchema` the render tools validate against, so a mis-shaped checkpoint
// fails in seconds when called right after the first write and on resume.
//
// It reuses the schema ONLY (not render's private `readAndValidateRunState`,
// which is `RenderOutput`-typed and lives on a hot shared file). The read +
// validate logic is re-implemented thinly here and never throws.

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const validateRunStateInputSchema = z.object({
  runId: z
    .string()
    .describe(
      "The orchestration run's id (its YYYYMMDD-HHMMSS timestamp, optionally " +
        "prefixed `prd<N>-` or `backlog-`). It selects the per-run directory " +
        ".orchestrate/runs/<runId>/, which holds that run's run-state.json. " +
        "Required — every validate call happens after the run has a runId."
    ),
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the project root that holds the .orchestrate/ directory. " +
        "Defaults to the MCP server process's current working directory — callers " +
        "should pass this explicitly rather than rely on the default."
    ),
});

export const validateRunStateOutputSchema = z.object({
  status: z
    .enum(["valid", "invalid"])
    .describe(
      "Outcome discriminant. 'valid' = run-state.json exists, is valid JSON, " +
        "and matches the canonical run-state schema; 'invalid' = it could not be " +
        "resolved, read, parsed, or it failed schema validation."
    ),
  errorCode: z
    .enum(["RUN_ID_INVALID", "RUN_STATE_NOT_FOUND", "RUN_STATE_INVALID"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='invalid'. " +
        "'RUN_ID_INVALID' = the runId is malformed and cannot resolve a run " +
        "directory; 'RUN_STATE_NOT_FOUND' = no run-state.json under " +
        ".orchestrate/runs/<runId>/; 'RUN_STATE_INVALID' = malformed JSON or a " +
        "schema mismatch (e.g. `slices` shaped as an array instead of a map)."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe("Human-readable failure description. Present when status='invalid'."),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type ValidateRunStateInput = z.infer<typeof validateRunStateInputSchema>;
export type ValidateRunStateOutput = z.infer<typeof validateRunStateOutputSchema>;

// ─── Internal helper ──────────────────────────────────────────────────────────

/** Returns the first non-empty trimmed line of a (possibly multi-line) string. */
function firstLine(message: string): string {
  const line = message
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? message.trim();
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

/**
 * Validates the run-state.json at `.orchestrate/runs/<runId>/run-state.json`
 * against the canonical `runStateSchema` (the same schema the render tools
 * validate against). Reads only; writes nothing. Never throws — every failure
 * path maps to a discriminated `{ status: "invalid", errorCode, errorMessage }`
 * result, mirroring the render tools' read+validate discipline.
 */
export async function validateRunState(
  input: ValidateRunStateInput
): Promise<ValidateRunStateOutput> {
  const repoPath = input.repoPath ?? process.cwd();
  const resolved = resolveRunDir(repoPath, input.runId);
  if (!resolved.ok) {
    return {
      status: "invalid",
      errorCode: "RUN_ID_INVALID",
      errorMessage: resolved.errorMessage,
    };
  }

  let raw: string;
  try {
    raw = fs.readFileSync(resolved.paths.runStatePath, "utf8");
  } catch {
    return {
      status: "invalid",
      errorCode: "RUN_STATE_NOT_FOUND",
      errorMessage: `No run-state.json found at ${resolved.paths.runStatePath}.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: "invalid",
      errorCode: "RUN_STATE_INVALID",
      errorMessage: `run-state.json is not valid JSON: ${firstLine(
        err instanceof Error ? err.message : String(err)
      )}`,
    };
  }

  const result = runStateSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      status: "invalid",
      errorCode: "RUN_STATE_INVALID",
      errorMessage: `run-state.json does not match the expected shape: ${detail}`,
    };
  }

  return { status: "valid" };
}
