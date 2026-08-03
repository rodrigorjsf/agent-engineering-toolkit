import { describe, it, expect } from "vitest";
import {
  SLICE_EXECUTOR_FAILURE_CLASSES,
  validateEnvelope,
} from "../src/tools/validate-envelope.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Wraps an object as a complete, properly-fenced orchestrate-envelope block. */
function fenced(obj: unknown): string {
  return [
    "Some prose the orchestrator must never parse.",
    "",
    "```orchestrate-envelope",
    JSON.stringify(obj, null, 2),
    "```",
    "",
    "Trailing prose.",
  ].join("\n");
}

/** A complete, valid implementer envelope. */
function implementerEnvelope() {
  return {
    role: "implementer" as const,
    status: "completed" as const,
    filesChanged: ["src/tools/foo.ts", "test/foo.test.ts"],
    verification: [
      { capability: "typecheck", result: "passed" },
      { capability: "build", result: "passed" },
      { capability: "tests", result: "passed" },
      { capability: "lint", result: "not-configured" },
    ],
    notes: "Implemented per the acceptance criteria.",
  };
}

/** A complete, valid reviewer envelope. */
function reviewerEnvelope() {
  return {
    role: "reviewer" as const,
    status: "passed" as const,
    filesChanged: ["src/tools/foo.ts"],
    verification: [{ capability: "tests", result: "passed" }],
    notes: "Fixed a naming inconsistency inline.",
  };
}

/** A complete, valid conflict-resolver envelope. */
function conflictResolverEnvelope() {
  return {
    role: "conflict-resolver" as const,
    status: "resolved" as const,
    filesChanged: ["src/index.ts"],
    verification: [{ capability: "tests", result: "passed" }],
    notes: "Reconciled both intents in the import block.",
  };
}

/** A complete, valid investigator envelope. */
function investigatorEnvelope() {
  return {
    role: "investigator" as const,
    relevantFiles: ["src/tools/foo.ts"],
    patterns: "Zod schemas as the single source of truth.",
    risks: "Truncated envelopes must never be accepted.",
    approach: "Add the schema, then the validator, then tests.",
    notes: "Investigator is read-only.",
  };
}

/**
 * A complete, valid slice-executor envelope — the literal shape from issue
 * #354, reproduced verbatim (placeholders filled) because that shape is the
 * settled contract, not merely an illustration.
 */
function sliceExecutorEnvelope() {
  return {
    role: "slice-executor" as const,
    status: "failed" as const,
    failedStage: "implementer" as const,
    failureClass: "incomplete-budget-exhausted" as const,
    failureReason:
      "The nested continuation loop exhausted its budget before the " +
      "implementer reached a verified changeset.",
    reportPath: "reports/slice-354.md",
    nextTaskBriefing:
      "Done: schema groundwork. Left: none for this slice. Resume by " +
      "re-spawning the implementer in the same worktree.",
    filesChanged: ["src/tools/foo.ts"],
    verification: { tests: "passed" as const, build: "passed" as const },
    fallbackTaken: true,
  };
}

// ─── valid envelopes, one per role ────────────────────────────────────────────

describe("validateEnvelope — valid envelopes", () => {
  it("accepts a valid implementer envelope and returns the parsed value", () => {
    const r = validateEnvelope({
      text: fenced(implementerEnvelope()),
      role: "implementer",
    });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(implementerEnvelope());
    expect(r.errorCode).toBeUndefined();
  });

  it("accepts a valid reviewer envelope", () => {
    const r = validateEnvelope({
      text: fenced(reviewerEnvelope()),
      role: "reviewer",
    });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(reviewerEnvelope());
  });

  it("accepts a valid conflict-resolver envelope", () => {
    const r = validateEnvelope({
      text: fenced(conflictResolverEnvelope()),
      role: "conflict-resolver",
    });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(conflictResolverEnvelope());
  });

  it("accepts a valid investigator envelope with no filesChanged field", () => {
    const r = validateEnvelope({
      text: fenced(investigatorEnvelope()),
      role: "investigator",
    });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(investigatorEnvelope());
  });

  it("accepts a valid slice-executor envelope and returns the parsed object as the single source of the slice's outcome", () => {
    const r = validateEnvelope({
      text: fenced(sliceExecutorEnvelope()),
      role: "slice-executor",
    });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(sliceExecutorEnvelope());
    expect(r.errorCode).toBeUndefined();
  });

  it("accepts an implementer envelope with an empty filesChanged list", () => {
    const env = { ...implementerEnvelope(), filesChanged: [] };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("valid");
    expect(r.envelope!.role).toBe("implementer");
  });

  it("accepts an implementer envelope with status='incomplete'", () => {
    // 'incomplete' is the implementer's graceful turn-budget self-report —
    // distinct from 'completed' (done) and 'blocked' (unrecoverable obstacle).
    // An 'incomplete' envelope must carry a non-empty `remainingWork` handoff.
    const env = {
      ...implementerEnvelope(),
      status: "incomplete" as const,
      notes:
        "Foresaw the remaining acceptance criteria would not fit the turn " +
        "budget; reporting incomplete with the partial work above.",
      remainingWork:
        "Done: schema + validator. Left: the SKILL.md prose. Resume in the " +
        "same worktree by editing SKILL.md §3 step 4.",
    };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("valid");
    expect(r.envelope!.role).toBe("implementer");
    expect((r.envelope as { status: string }).status).toBe("incomplete");
  });
});

// ─── rootCause on diagnostic failure outcomes (#239) ──────────────────────────

describe("validateEnvelope — rootCause on failure outcomes", () => {
  it("accepts an implementer 'blocked' envelope carrying a verified rootCause", () => {
    const env = {
      ...implementerEnvelope(),
      status: "blocked" as const,
      notes: "Hit an unrecoverable obstacle; see rootCause.",
      rootCause: {
        status: "verified" as const,
        claim: "The build fails because a peer dependency is missing.",
        evidence: "npm run build → error: Cannot find module 'left-pad'.",
      },
    };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(env);
    expect(r.errorCode).toBeUndefined();
  });

  it("accepts a reviewer 'failed' envelope carrying a hypothesis rootCause without evidence", () => {
    const env = {
      ...reviewerEnvelope(),
      status: "failed" as const,
      notes: "Correctness blocker I cannot fix inline; see rootCause.",
      rootCause: {
        status: "hypothesis" as const,
        claim:
          "The race condition likely stems from the unsynchronized cache " +
          "write, but I could not reproduce it within the turn.",
      },
    };
    const r = validateEnvelope({ text: fenced(env), role: "reviewer" });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(env);
    expect(r.errorCode).toBeUndefined();
  });

  it("rejects an implementer 'blocked' envelope that omits rootCause", () => {
    const env = {
      ...implementerEnvelope(),
      status: "blocked" as const,
      notes: "Hit an obstacle but forgot to declare a root cause.",
    };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("SCHEMA_MISMATCH");
    expect(r.envelope).toBeUndefined();
  });

  it("rejects a reviewer 'failed' envelope that omits rootCause", () => {
    const env = {
      ...reviewerEnvelope(),
      status: "failed" as const,
      notes: "Found a blocker but did not declare a root cause.",
    };
    const r = validateEnvelope({ text: fenced(env), role: "reviewer" });

    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("SCHEMA_MISMATCH");
    expect(r.envelope).toBeUndefined();
  });

  it("accepts an implementer 'incomplete' envelope without rootCause", () => {
    // 'incomplete' is the turn-budget self-report — rootCause is optional there.
    // It still requires a `remainingWork` handoff (see the #234 suite below).
    const env = {
      ...implementerEnvelope(),
      status: "incomplete" as const,
      notes: "Ran out of budget; partial work recorded.",
      remainingWork: "Resume the remaining acceptance criteria in this worktree.",
    };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("valid");
    expect(r.errorCode).toBeUndefined();
  });

  it("accepts the default 'completed' implementer factory without rootCause (regression guard)", () => {
    const r = validateEnvelope({
      text: fenced(implementerEnvelope()),
      role: "implementer",
    });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(implementerEnvelope());
  });
});

// ─── remainingWork handoff on 'incomplete' (#234) ─────────────────────────────

describe("validateEnvelope — remainingWork on incomplete envelopes", () => {
  it("accepts an implementer 'incomplete' envelope carrying a non-empty remainingWork", () => {
    const env = {
      ...implementerEnvelope(),
      status: "incomplete" as const,
      notes: "Partial work recorded; see remainingWork for the handoff.",
      remainingWork:
        "Done: schema field + validator. Left: the index.ts describe text. " +
        "Resume in the same worktree.",
    };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(env);
    expect(r.errorCode).toBeUndefined();
  });

  it("rejects an implementer 'incomplete' envelope that omits remainingWork", () => {
    const env = {
      ...implementerEnvelope(),
      status: "incomplete" as const,
      notes: "Ran out of budget but forgot the handoff.",
    };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("SCHEMA_MISMATCH");
    expect(r.envelope).toBeUndefined();
  });

  it("rejects an implementer 'incomplete' envelope with whitespace-only remainingWork", () => {
    const env = {
      ...implementerEnvelope(),
      status: "incomplete" as const,
      notes: "Handoff present but empty after trimming.",
      remainingWork: "   \n\t ",
    };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("SCHEMA_MISMATCH");
    expect(r.envelope).toBeUndefined();
  });

  it("accepts a 'completed' implementer envelope WITHOUT remainingWork (field optional for non-incomplete)", () => {
    const r = validateEnvelope({
      text: fenced(implementerEnvelope()),
      role: "implementer",
    });

    expect(r.status).toBe("valid");
    expect(r.errorCode).toBeUndefined();
  });
});

// ─── truncated envelopes ──────────────────────────────────────────────────────

describe("validateEnvelope — truncated envelopes", () => {
  it("reports a fence opened but never closed as invalid, never missing", () => {
    // A turn cut off mid-emission: the opening fence is present, the JSON is
    // partial, and there is no closing fence.
    const text = [
      "Some prose.",
      "",
      "```orchestrate-envelope",
      '{\n  "role": "implementer",\n  "status": "comple',
    ].join("\n");

    const r = validateEnvelope({ text, role: "implementer" });

    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBeDefined();
    expect(r.envelope).toBeUndefined();
  });

  it("reports a closed fence with mid-string-truncated JSON as invalid", () => {
    // The fence closed but the JSON itself was cut mid-string — JSON.parse fails.
    const text = [
      "```orchestrate-envelope",
      '{\n  "role": "implementer",\n  "status": "comp',
      "```",
    ].join("\n");

    const r = validateEnvelope({ text, role: "implementer" });

    expect(r.status).toBe("invalid");
    expect(r.envelope).toBeUndefined();
  });
});

// ─── malformed and schema-invalid envelopes ───────────────────────────────────

describe("validateEnvelope — malformed and schema-invalid envelopes", () => {
  it("reports a properly-fenced block of non-JSON as invalid", () => {
    const text = [
      "```orchestrate-envelope",
      "this is not json at all",
      "```",
    ].join("\n");

    const r = validateEnvelope({ text, role: "implementer" });

    expect(r.status).toBe("invalid");
    expect(r.envelope).toBeUndefined();
  });

  it("reports a parseable envelope missing a required field as invalid", () => {
    // Valid JSON, properly fenced, but `verification` is absent.
    const partial = {
      role: "implementer",
      status: "completed",
      filesChanged: ["src/foo.ts"],
      notes: "missing verification",
    };
    const r = validateEnvelope({
      text: fenced(partial),
      role: "implementer",
    });

    expect(r.status).toBe("invalid");
    expect(r.envelope).toBeUndefined();
  });

  it("reports an envelope whose role mismatches the expected role as invalid", () => {
    // A reviewer envelope validated against the implementer role.
    const r = validateEnvelope({
      text: fenced(reviewerEnvelope()),
      role: "implementer",
    });

    expect(r.status).toBe("invalid");
    expect(r.envelope).toBeUndefined();
  });

  it("reports an implementer envelope with an unknown status value as invalid", () => {
    const env = { ...implementerEnvelope(), status: "done" };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("invalid");
    expect(r.envelope).toBeUndefined();
  });
});

// ─── slice-executor role (#354) ───────────────────────────────────────────────

describe("validateEnvelope — slice-executor role", () => {
  it("accepts a slice-executor envelope reporting a successful slice", () => {
    // A 'completed' outcome carries none of the failure-only fields.
    const env = {
      role: "slice-executor" as const,
      status: "completed" as const,
      reportPath: "reports/slice-354.md",
      nextTaskBriefing:
        "Schema groundwork landed; the next slice can build the executor " +
        "agent against it.",
      filesChanged: ["src/tools/foo.ts", "test/foo.test.ts"],
      verification: { tests: "passed", typecheck: "passed", build: "passed" },
      fallbackTaken: false,
    };
    const r = validateEnvelope({ text: fenced(env), role: "slice-executor" });

    expect(r.status).toBe("valid");
    expect(r.envelope).toEqual(env);
    expect(r.errorCode).toBeUndefined();
  });

  it("reports a truncated slice-executor envelope (unclosed fence) as invalid", () => {
    const text = [
      "Some prose.",
      "",
      "```orchestrate-envelope",
      '{\n  "role": "slice-executor",\n  "status": "fail',
    ].join("\n");

    const r = validateEnvelope({ text, role: "slice-executor" });

    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBeDefined();
    expect(r.envelope).toBeUndefined();
  });

  it("reports an off-schema slice-executor envelope (missing reportPath) as invalid", () => {
    const { reportPath: _reportPath, ...withoutReportPath } =
      sliceExecutorEnvelope();
    const r = validateEnvelope({
      text: fenced(withoutReportPath),
      role: "slice-executor",
    });

    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("SCHEMA_MISMATCH");
    expect(r.envelope).toBeUndefined();
  });

  it("reports a slice-executor envelope whose failureClass falls outside the closed set as invalid", () => {
    const env = { ...sliceExecutorEnvelope(), failureClass: "gave-up" };
    const r = validateEnvelope({ text: fenced(env), role: "slice-executor" });

    expect(r.status).toBe("invalid");
    expect(r.errorCode).toBe("SCHEMA_MISMATCH");
    expect(r.envelope).toBeUndefined();
  });

  it("reports a slice-executor envelope with an unknown status value as invalid", () => {
    const env = { ...sliceExecutorEnvelope(), status: "loop-continue" };
    const r = validateEnvelope({ text: fenced(env), role: "slice-executor" });

    expect(r.status).toBe("invalid");
    expect(r.envelope).toBeUndefined();
  });

  it("reports a slice-executor envelope validated against a mismatched role as invalid", () => {
    const r = validateEnvelope({
      text: fenced(sliceExecutorEnvelope()),
      role: "implementer",
    });

    expect(r.status).toBe("invalid");
    expect(r.envelope).toBeUndefined();
  });

  it("reports text with no envelope fence at all as missing for slice-executor", () => {
    const text = "The executor wrote a prose summary and forgot the envelope.";
    const r = validateEnvelope({ text, role: "slice-executor" });

    expect(r.status).toBe("missing");
    expect(r.envelope).toBeUndefined();
  });

  it("accepts every closed-set failureClass value paired with its natural failedStage", () => {
    // Driven by the exported closed set rather than a restated literal list —
    // the set is defined in exactly one place, and this test reads that one
    // definition instead of duplicating it. `test/` is excluded from
    // tsconfig, so the Record's exhaustiveness is NOT enforced at compile
    // time; the assertion inside the loop enforces it at run time, so an
    // added class with no stage mapped here fails loudly instead of silently
    // dropping to an absent (optional) `failedStage`.
    const naturalStage: Record<
      (typeof SLICE_EXECUTOR_FAILURE_CLASSES)[number],
      "investigator" | "implementer" | "capability-gate" | "reviewer"
    > = {
      "unrecoverable-obstacle": "capability-gate",
      "incomplete-budget-exhausted": "implementer",
      "no-progress-stall": "investigator",
      "invalid-or-missing-worker-envelope": "implementer",
      "changeset-mismatch": "implementer",
      "empty-changeset": "implementer",
      "model-refusal": "reviewer",
    };

    for (const failureClass of SLICE_EXECUTOR_FAILURE_CLASSES) {
      expect(naturalStage[failureClass]).toBeDefined();

      const env = {
        ...sliceExecutorEnvelope(),
        failureClass,
        failedStage: naturalStage[failureClass],
      };
      const r = validateEnvelope({ text: fenced(env), role: "slice-executor" });

      expect(r.status).toBe("valid");
    }
  });
});

// ─── missing envelopes ────────────────────────────────────────────────────────

describe("validateEnvelope — missing envelopes", () => {
  it("reports text with no envelope fence at all as missing", () => {
    const text =
      "The implementer wrote a prose summary and forgot the envelope entirely.";
    const r = validateEnvelope({ text, role: "implementer" });

    expect(r.status).toBe("missing");
    expect(r.envelope).toBeUndefined();
  });

  it("does not treat an unrelated json fenced block as an envelope", () => {
    const text = [
      "Here is a config snippet:",
      "```json",
      '{ "role": "implementer", "status": "completed" }',
      "```",
    ].join("\n");

    const r = validateEnvelope({ text, role: "implementer" });

    expect(r.status).toBe("missing");
  });

  it("reports empty text as missing", () => {
    const r = validateEnvelope({ text: "", role: "implementer" });
    expect(r.status).toBe("missing");
  });
});

// ─── multiple envelopes ───────────────────────────────────────────────────────

describe("validateEnvelope — multiple envelopes", () => {
  it("uses the last envelope when more than one fenced block is present", () => {
    // A subagent that emitted a draft envelope, then a corrected final one.
    const draft = { ...implementerEnvelope(), notes: "draft" };
    const final = { ...implementerEnvelope(), notes: "final" };
    const text = [fenced(draft), fenced(final)].join("\n\n");

    const r = validateEnvelope({ text, role: "implementer" });

    expect(r.status).toBe("valid");
    expect(r.envelope!.notes).toBe("final");
  });

  it("reports invalid when the last of several blocks is truncated", () => {
    // An earlier valid block must not rescue a truncated final block — the
    // last block is what the turn ended on.
    const valid = fenced(implementerEnvelope());
    const truncated = [
      "```orchestrate-envelope",
      '{\n  "role": "implementer",\n  "status": "comple',
    ].join("\n");
    const text = [valid, truncated].join("\n\n");

    const r = validateEnvelope({ text, role: "implementer" });

    expect(r.status).toBe("invalid");
  });
});
