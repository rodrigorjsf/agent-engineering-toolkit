import { z } from "zod";

// ─── Envelope schemas — z.object is the single source of truth ────────────────
//
// Each orchestrate subagent ends its turn by emitting a result *envelope*: a
// JSON object inside an ```orchestrate-envelope fenced block. The envelope is
// the orchestrator's ONLY machine-checkable source of a subagent's status and
// changed-file set — the orchestrator never parses the subagent's prose. The
// worker roles (implementer, reviewer, conflict-resolver) carry a work summary;
// the investigator carries a research brief. A discriminated union on `role`
// keeps each role's existing status vocabulary intact.

/**
 * One capability-tool run and its outcome. An array (not a map) so a re-run of
 * the same capability is representable and the order is preserved.
 */
const verificationEntrySchema = z.object({
  capability: z
    .enum(["tests", "typecheck", "build", "lint"])
    .describe("Which capability tool was run."),
  result: z
    .enum(["passed", "failed", "not-configured"])
    .describe(
      "Outcome of that run. 'not-configured' means the verb has no command set."
    ),
});

/**
 * Result envelope for the implementer role. `status` keeps the implementer's
 * existing vocabulary: 'completed' or 'blocked'.
 */
export const implementerEnvelopeSchema = z.object({
  role: z.literal("implementer").describe("Discriminant — the implementer role."),
  status: z
    .enum(["completed", "blocked"])
    .describe(
      "Outcome. 'completed' = acceptance criteria met and every configured " +
        "capability tool passed; 'blocked' = the implementer could not finish."
    ),
  filesChanged: z
    .array(z.string())
    .describe(
      "Files the implementer created or edited, as paths relative to the " +
        "worktree root. An empty array means no file was changed."
    ),
  verification: z
    .array(verificationEntrySchema)
    .describe("Each capability tool the implementer ran and its result."),
  notes: z
    .string()
    .describe(
      "Free-form notes for the orchestrator or a later reviewer — assumptions, " +
        "partial work, or, when blocked, exactly what stopped the implementer."
    ),
});

/**
 * Result envelope for the reviewer role. `status` keeps the reviewer's existing
 * vocabulary: 'passed' or 'failed'.
 */
export const reviewerEnvelopeSchema = z.object({
  role: z.literal("reviewer").describe("Discriminant — the reviewer role."),
  status: z
    .enum(["passed", "failed"])
    .describe(
      "Outcome. 'passed' = acceptance criteria met, code sound, every " +
        "configured capability tool passed; 'failed' = an unrecoverable blocker."
    ),
  filesChanged: z
    .array(z.string())
    .describe(
      "Files the reviewer edited during review, relative to the worktree root. " +
        "An empty array means the reviewer changed nothing."
    ),
  verification: z
    .array(verificationEntrySchema)
    .describe("Each capability tool the reviewer ran and its result."),
  notes: z
    .string()
    .describe(
      "Free-form notes — what was fixed and why, or, when failed, the exact " +
        "blocker and why it is unsafe to fix inline."
    ),
});

/**
 * Result envelope for the conflict-resolver role. `status` keeps the
 * conflict-resolver's existing vocabulary: 'resolved' or 'failed'.
 */
export const conflictResolverEnvelopeSchema = z.object({
  role: z
    .literal("conflict-resolver")
    .describe("Discriminant — the conflict-resolver role."),
  status: z
    .enum(["resolved", "failed"])
    .describe(
      "Outcome. 'resolved' = every conflict marker gone and every configured " +
        "capability tool passed; 'failed' = a conflict that could not be " +
        "resolved correctly."
    ),
  filesChanged: z
    .array(z.string())
    .describe(
      "The conflicted files the resolver edited, relative to the worktree root."
    ),
  verification: z
    .array(verificationEntrySchema)
    .describe("Each capability tool the conflict-resolver ran and its result."),
  notes: z
    .string()
    .describe(
      "Free-form notes — how each conflict was reconciled, or, when failed, the " +
        "exact conflict that could not be resolved safely."
    ),
});

/**
 * Result envelope for the investigator role. The investigator is read-only — it
 * produces a research brief, not a work summary, so it carries no `status` and
 * no `filesChanged`; no worktree fallback applies to it.
 */
export const investigatorEnvelopeSchema = z.object({
  role: z
    .literal("investigator")
    .describe("Discriminant — the investigator role."),
  relevantFiles: z
    .array(z.string())
    .describe(
      "Paths, relative to the repository root, the implementer will likely " +
        "need to read or change."
    ),
  patterns: z
    .string()
    .describe(
      "Existing conventions in the affected areas the implementer must follow."
    ),
  risks: z
    .string()
    .describe(
      "Edge cases, failure modes, affected callers, and invariants to preserve."
    ),
  approach: z
    .string()
    .describe("A suggested implementation approach — what to change and why."),
  notes: z
    .string()
    .describe("Anything else that does not fit the fields above."),
});

/**
 * The full set of envelope shapes, discriminated on `role`. Each subagent role
 * maps to exactly one member.
 */
export const envelopeSchema = z.discriminatedUnion("role", [
  implementerEnvelopeSchema,
  reviewerEnvelopeSchema,
  conflictResolverEnvelopeSchema,
  investigatorEnvelopeSchema,
]);

// ─── validate_envelope tool I/O schemas ───────────────────────────────────────

/** The subagent roles an envelope can belong to. */
export const ENVELOPE_ROLES = [
  "implementer",
  "reviewer",
  "conflict-resolver",
  "investigator",
] as const;

export const validateEnvelopeInputSchema = z.object({
  text: z
    .string()
    .describe(
      "The raw, verbatim text a subagent returned as its final message. The " +
        "validator locates the ```orchestrate-envelope fenced block within it."
    ),
  role: z
    .enum(ENVELOPE_ROLES)
    .describe(
      "The role the subagent was spawned as. The located envelope must declare " +
        "this same role — a role mismatch is reported as an invalid envelope."
    ),
});

export const validateEnvelopeOutputSchema = z.object({
  status: z
    .enum(["valid", "invalid", "missing"])
    .describe(
      "Outcome discriminant. 'valid' = a well-formed envelope matching the " +
        "expected role was found; 'invalid' = an envelope was attempted but is " +
        "truncated, malformed, or does not match the schema (a truncated " +
        "envelope is ALWAYS reported invalid, never silently accepted); " +
        "'missing' = no orchestrate-envelope block was found at all."
    ),
  role: z
    .enum(ENVELOPE_ROLES)
    .describe("The role the envelope was validated against — echoes the input."),
  envelope: envelopeSchema
    .optional()
    .describe(
      "The parsed, schema-conforming envelope. Present only when status='valid'."
    ),
  errorCode: z
    .enum(["TRUNCATED_OR_MALFORMED", "SCHEMA_MISMATCH"])
    .optional()
    .describe(
      "Machine-readable reason an attempted envelope was rejected. Present when " +
        "status='invalid'. 'TRUNCATED_OR_MALFORMED' = the fenced block could " +
        "not be parsed as JSON (truncated mid-turn, or not JSON); " +
        "'SCHEMA_MISMATCH' = it parsed as JSON but does not match the role's " +
        "envelope schema (a missing field, wrong role, or bad value)."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Human-readable description of why the envelope is invalid or missing. " +
        "Present when status='invalid' or status='missing'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type VerificationEntry = z.infer<typeof verificationEntrySchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export type ImplementerEnvelope = z.infer<typeof implementerEnvelopeSchema>;
export type ReviewerEnvelope = z.infer<typeof reviewerEnvelopeSchema>;
export type ConflictResolverEnvelope = z.infer<
  typeof conflictResolverEnvelopeSchema
>;
export type InvestigatorEnvelope = z.infer<typeof investigatorEnvelopeSchema>;
export type ValidateEnvelopeInput = z.infer<typeof validateEnvelopeInputSchema>;
export type ValidateEnvelopeOutput = z.infer<
  typeof validateEnvelopeOutputSchema
>;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** The fence identifier that marks a result envelope. */
const FENCE_TAG = "orchestrate-envelope";

/**
 * Extracts the body of every complete ```orchestrate-envelope fenced block in
 * `text`, in document order. A "complete" block has both an opening and a
 * matching closing fence; an opening fence with no closing fence is handled
 * separately by {@link hasUnclosedEnvelopeFence}.
 *
 * The opening fence is `\`\`\`orchestrate-envelope` on its own line (leading
 * whitespace tolerated); the closing fence is `\`\`\`` on its own line.
 */
function extractEnvelopeBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let inBlock = false;
  let buffer: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inBlock) {
      if (trimmed === "```" + FENCE_TAG) {
        inBlock = true;
        buffer = [];
      }
    } else {
      if (trimmed === "```") {
        blocks.push(buffer.join("\n"));
        inBlock = false;
      } else {
        buffer.push(line);
      }
    }
  }
  return blocks;
}

/**
 * Returns true when `text` contains an opening orchestrate-envelope fence that
 * is never closed — the signature of a turn cut off mid-emission. The presence
 * of the opening fence proves an envelope was *attempted*; the missing close
 * means it was truncated.
 */
function hasUnclosedEnvelopeFence(text: string): boolean {
  const lines = text.split("\n");
  let openCount = 0;
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inBlock) {
      if (trimmed === "```" + FENCE_TAG) {
        inBlock = true;
        openCount++;
      }
    } else if (trimmed === "```") {
      inBlock = false;
    }
  }
  // `inBlock` still true => the final opening fence was never closed.
  return inBlock && openCount > 0;
}

// ─── validate_envelope ────────────────────────────────────────────────────────

/**
 * Locates and validates a subagent result envelope inside the subagent's raw
 * returned text. Pure — never throws; every outcome is a structured result.
 *
 * Classification:
 *  - no orchestrate-envelope fence found at all          -> status 'missing'
 *  - an opening fence with no closing fence (truncated)  -> status 'invalid'
 *  - a fenced block that is not valid JSON               -> status 'invalid'
 *  - valid JSON that does not match the role's schema    -> status 'invalid'
 *  - valid JSON that matches the role's schema           -> status 'valid'
 *
 * When several complete envelope blocks are present, the LAST one is used — it
 * is the block the subagent's turn ended on (e.g. a corrected final envelope
 * superseding an earlier draft).
 */
export function validateEnvelope(
  input: ValidateEnvelopeInput
): ValidateEnvelopeOutput {
  const { text, role } = input;

  const blocks = extractEnvelopeBlocks(text);
  const truncated = hasUnclosedEnvelopeFence(text);

  // No complete block AND no unclosed opening fence => no envelope was emitted.
  if (blocks.length === 0 && !truncated) {
    return {
      status: "missing",
      role,
      errorMessage:
        `No \`\`\`${FENCE_TAG} block was found in the subagent's output. ` +
        `The subagent did not emit a result envelope.`,
    };
  }

  // An unclosed opening fence is the signature of a truncated turn. It is
  // reported invalid even when an earlier complete block exists — the truncated
  // block is what the turn ended on, so the result cannot be trusted.
  if (truncated) {
    return {
      status: "invalid",
      role,
      errorCode: "TRUNCATED_OR_MALFORMED",
      errorMessage:
        `An opening \`\`\`${FENCE_TAG} fence was found with no closing fence — ` +
        `the subagent's turn was truncated mid-envelope. A truncated envelope ` +
        `is never accepted.`,
    };
  }

  // Use the LAST complete block — the one the turn ended on.
  const lastBlock = blocks[blocks.length - 1];

  let parsed: unknown;
  try {
    parsed = JSON.parse(lastBlock);
  } catch (err) {
    return {
      status: "invalid",
      role,
      errorCode: "TRUNCATED_OR_MALFORMED",
      errorMessage:
        `The \`\`\`${FENCE_TAG} block does not contain valid JSON: ` +
        `${err instanceof Error ? err.message : String(err)}. The envelope is ` +
        `truncated or malformed.`,
    };
  }

  // Validate against the discriminated union, then confirm the role matches the
  // role the subagent was spawned as.
  const result = envelopeSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      status: "invalid",
      role,
      errorCode: "SCHEMA_MISMATCH",
      errorMessage:
        `The envelope does not match the expected schema: ${detail}.`,
    };
  }

  if (result.data.role !== role) {
    return {
      status: "invalid",
      role,
      errorCode: "SCHEMA_MISMATCH",
      errorMessage:
        `The envelope declares role "${result.data.role}" but the subagent was ` +
        `spawned as "${role}".`,
    };
  }

  return {
    status: "valid",
    role,
    envelope: result.data,
  };
}
