import * as fs from "fs";
import { z } from "zod";
import { resolveSliceProgressPath } from "../run-dir.js";
import {
  SLICE_EXECUTOR_STAGES,
  investigatorEnvelopeSchema,
} from "./validate-envelope.js";

// ─── recover_slice_progress ───────────────────────────────────────────────────
//
// A slice's **progress record** is the resume anchor for the slice-executor
// delegation layer (ADR-0017). One executor spawn now spans investigation,
// implementation, and review, so a session that died mid-executor would throw
// away a finished investigation and a finished review — precisely the durability
// this plugin exists to provide. The executor therefore writes the record at
// each completed stage, into the run's own directory beside the run-state
// checkpoint, and a fresh executor reads its own record to resume itself.
//
// The trap this tool closes: the orchestrator must NOT open that file. Reading
// slice-internal artifacts is exactly the coupling the delegation layer removes,
// and a prose file read back into the orchestrator's context is unvalidated by
// construction. So when a slice-executor's envelope comes back missing or
// invalid, the orchestrator recovers the record's contents THROUGH this tool,
// which returns validated, structured data — the same structured-recovery
// posture as `recover_changed_files`, where the worktree is ground truth
// recovered through a tool rather than by reading a subagent's prose.
//
// The tool derives the record's path from `(runId, issue)` and deliberately
// does NOT accept a file path from the caller. That is what makes ADR-0012's
// invariant (3) — no tool reaches outside its own `runs/<runId>/` — true by
// construction rather than by convention: a path parameter would let a caller
// read another run's records, or anything else on disk.
//
// It reads only. Writing the record is the executor's job, done with its own
// file-writing tool; there is deliberately no writer tool here, because a
// writer would hand the orchestrator a way to forge a slice's resume state.

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

/**
 * The slice progress record itself. Every field the executor needs to resume
 * itself after a handoff, and nothing more.
 *
 * `runId` and `issue` are REQUIRED so the record self-identifies: this tool
 * checks them against the pair it was asked for, which turns a mis-filed record
 * into a detected error instead of a silently-accepted one.
 */
export const sliceProgressRecordSchema = z.object({
  runId: z
    .string()
    .describe(
      "The run this record belongs to. Must equal the runId whose directory " +
        "the record was read from — a mismatch means the record was mis-filed " +
        "and is rejected rather than trusted."
    ),
  issue: z
    .number()
    .int()
    .describe(
      "The issue number of the slice this record tracks. Must equal the issue " +
        "the record's filename encodes; a mismatch is rejected."
    ),
  lastCompletedStage: z
    .enum(SLICE_EXECUTOR_STAGES)
    .optional()
    .describe(
      "The last inner stage that FINISHED. Note this is NOT the envelope's " +
        "`failedStage`, which names the stage that was RUNNING when a failure " +
        "occurred — the value set is deliberately shared, the meaning is not. " +
        "The enum is a set of stage NAMES, not an order: which stages run, in " +
        "what sequence, and which are skipped are the executor's decisions, " +
        "never implied by this field's member order. ABSENT means no stage has " +
        "completed yet — omit the key entirely; an explicit null is rejected."
    ),
  investigatorBrief: investigatorEnvelopeSchema
    .omit({ role: true })
    .optional()
    .describe(
      "The investigator's research brief, carried forward so a resumed " +
        "executor does not re-run a finished investigation. Reuses the " +
        "investigator envelope's own fields rather than a free-form blob, so " +
        "the brief stays validated end to end. Absent when the slice's tier " +
        "skips investigation entirely (`resolvedRouting.investigator` is null)."
    ),
  continuationsUsed: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "How many continuations the executor's continue-in-place loop has spent " +
        "on this slice. Persisted because two continuation loops now nest, and " +
        "ADR-0017 caps the PRODUCT of their budgets at 6 — a counter that reset " +
        "on every handoff could not enforce that bound across sessions."
    ),
  worktreeFingerprint: z
    .string()
    .optional()
    .describe(
      "Opaque content-level fingerprint of the worktree's uncommitted state at " +
        "the last completed stage, used by the no-progress guard to tell a " +
        "real continuation from a stalled one. Stored as an opaque string: " +
        "COMPUTING it is the executor's job, so this record fixes only how it " +
        "is carried, never how it is derived. Absent before the first " +
        "fingerprint is taken."
    ),
  fallbackTaken: z
    .boolean()
    .describe(
      "The once-only Model fallback guard: true when the premium-lane retry " +
        "has already been spent on this slice. REQUIRED, with no default — an " +
        "absent key must never silently read as `false`, which would re-arm a " +
        "fallback that was already used. This deliberately DUPLICATES the " +
        "orchestrator's `resolvedRouting.fallbackTaken` in run-state.json, and " +
        "the duplication is ADR-0017-sanctioned, not an oversight: the " +
        "run-state field is orchestrator-owned and drives the legacy " +
        "non-executor path, while this copy is executor-owned, because the " +
        "executor cannot write the orchestrator's checkpoint. Do not unify them."
    ),
  updatedAt: z
    .string()
    .describe(
      "ISO-8601 UTC timestamp of the last write, matching run-state.json's " +
        "timestamp convention (documented in prose, not enforced by the schema)."
    ),
});

export const recoverSliceProgressInputSchema = z.object({
  runId: z
    .string()
    .describe(
      "The orchestration run's id (its YYYYMMDD-HHMMSS timestamp, optionally " +
        "prefixed `prd<N>-` or `backlog-`). It selects the per-run directory " +
        ".orchestrate/runs/<runId>/ the record is read from."
    ),
  issue: z
    .number()
    .int()
    .positive()
    .describe(
      "The issue number of the slice whose record to read. Together with " +
        "`runId` it derives the record's path — the tool deliberately accepts " +
        "no file path, so it can never read outside this run's directory."
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

export const recoverSliceProgressOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the record was found, parsed, and " +
        "validated; 'error' = it could not be resolved, read, parsed, or it " +
        "failed schema validation."
    ),
  record: sliceProgressRecordSchema
    .optional()
    .describe(
      "The validated slice progress record. Present ONLY when status='ok'."
    ),
  errorCode: z
    .enum([
      "RUN_ID_INVALID",
      "ISSUE_INVALID",
      "PROGRESS_NOT_FOUND",
      "PROGRESS_INVALID",
    ])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'. " +
        "'RUN_ID_INVALID' = the runId is malformed and cannot resolve a run " +
        "directory; 'ISSUE_INVALID' = the issue is not a positive integer and " +
        "cannot form a record filename; 'PROGRESS_NOT_FOUND' = no " +
        "slice-<issue>-progress.json under .orchestrate/runs/<runId>/ (the " +
        "slice has not recorded a completed stage yet) — distinct from " +
        "'PROGRESS_INVALID', which means the file EXISTS but is malformed JSON, " +
        "fails the record schema, or self-identifies as a different run/slice " +
        "than the one requested."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe("Human-readable failure description. Present when status='error'."),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type SliceProgressRecord = z.infer<typeof sliceProgressRecordSchema>;
export type RecoverSliceProgressInput = z.infer<
  typeof recoverSliceProgressInputSchema
>;
export type RecoverSliceProgressOutput = z.infer<
  typeof recoverSliceProgressOutputSchema
>;

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
 * Reads and validates one slice's progress record at
 * `.orchestrate/runs/<runId>/slice-<issue>-progress.json`, returning it as
 * structured data. The orchestrator's structured recovery for when a
 * slice-executor's result envelope is missing or invalid: it obtains the
 * record's contents through this tool instead of opening the file, keeping the
 * read boundary of ADR-0017 intact and the recovered data validated.
 *
 * The path is derived from `(runId, issue)`, never accepted from the caller, so
 * the read stays inside this run's own directory by construction (ADR-0012
 * invariant 3). Reads only; writes nothing.
 *
 * Never throws — every failure path, a missing file and a malformed one alike,
 * maps to a discriminated `{ status: "error", errorCode, errorMessage }` result.
 */
export async function recoverSliceProgress(
  input: RecoverSliceProgressInput
): Promise<RecoverSliceProgressOutput> {
  const repoPath = input.repoPath ?? process.cwd();
  const resolved = resolveSliceProgressPath(repoPath, input.runId, input.issue);
  if (!resolved.ok) {
    return {
      status: "error",
      errorCode: resolved.errorCode,
      errorMessage: resolved.errorMessage,
    };
  }

  let raw: string;
  try {
    raw = fs.readFileSync(resolved.path, "utf8");
  } catch {
    return {
      status: "error",
      errorCode: "PROGRESS_NOT_FOUND",
      errorMessage: `No slice progress record found at ${resolved.path}.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: "error",
      errorCode: "PROGRESS_INVALID",
      errorMessage: `The slice progress record is not valid JSON: ${firstLine(
        err instanceof Error ? err.message : String(err)
      )}`,
    };
  }

  const result = sliceProgressRecordSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      status: "error",
      errorCode: "PROGRESS_INVALID",
      errorMessage: `The slice progress record does not match the expected shape: ${detail}`,
    };
  }

  // Self-identification check: the record must agree with the path it came
  // from. A record naming a different run or slice was mis-filed, and trusting
  // it would resume an executor from another slice's state.
  const record = result.data;
  if (record.runId !== input.runId || record.issue !== input.issue) {
    return {
      status: "error",
      errorCode: "PROGRESS_INVALID",
      errorMessage:
        `The slice progress record self-identifies as runId ` +
        `'${record.runId}' / issue ${record.issue}, but was read from the ` +
        `record of runId '${input.runId}' / issue ${input.issue}.`,
    };
  }

  return { status: "ok", record };
}
