import { describe, it, expect } from "vitest";
import { validateEnvelope } from "../src/tools/validate-envelope.js";

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

  it("accepts an implementer envelope with an empty filesChanged list", () => {
    const env = { ...implementerEnvelope(), filesChanged: [] };
    const r = validateEnvelope({ text: fenced(env), role: "implementer" });

    expect(r.status).toBe("valid");
    expect(r.envelope!.role).toBe("implementer");
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
