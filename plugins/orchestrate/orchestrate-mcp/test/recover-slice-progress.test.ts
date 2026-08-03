import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { recoverSliceProgress } from "../src/tools/recover-slice-progress.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const RUN_ID = "prd352-20260803-015333";
const ISSUE = 355;

/** A full, schema-valid slice progress record. */
function validRecord(): Record<string, unknown> {
  return {
    runId: RUN_ID,
    issue: ISSUE,
    lastCompletedStage: "investigator",
    investigatorBrief: {
      relevantFiles: ["src/run-dir.ts", "src/tools/validate-envelope.ts"],
      patterns: "Schema-first — zod is the single source of truth.",
      risks: "The issue id is a second path-traversal vector.",
      approach: "Compose a per-slice resolver on resolveRunDir.",
      notes: "Both prerequisite slices are already in this branch.",
    },
    continuationsUsed: 1,
    worktreeFingerprint: "sha256:9f2c1a0b",
    fallbackTaken: false,
    updatedAt: "2026-08-03T01:53:33Z",
  };
}

// ─── Test harness ─────────────────────────────────────────────────────────────

const created: string[] = [];

/**
 * Writes a project dir with a per-run directory at
 * `.orchestrate/runs/<runId>/`. Pass null for `record` to skip creating the
 * progress file (the run directory is still created). Pass a string to write it
 * verbatim (for the bad-JSON case).
 */
function project(
  record: unknown | string | null,
  runId: string = RUN_ID,
  issue: number = ISSUE
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-progress-"));
  created.push(dir);
  return writeRecord(dir, record, runId, issue);
}

/** Writes one more progress record into an existing project dir. */
function writeRecord(
  dir: string,
  record: unknown | string | null,
  runId: string = RUN_ID,
  issue: number = ISSUE
): string {
  const runDir = path.join(dir, ".orchestrate", "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  if (record !== null) {
    const content =
      typeof record === "string" ? record : JSON.stringify(record, null, 2);
    fs.writeFileSync(path.join(runDir, `slice-${issue}-progress.json`), content);
  }
  return dir;
}

afterEach(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  created.length = 0;
});

// ─── Happy path (criterion 2) ────────────────────────────────────────────────

describe("recoverSliceProgress — a well-formed record", () => {
  it("returns status ok with every field of the validated record", async () => {
    const repoPath = project(validRecord());
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("ok");
    expect(result.errorCode).toBeUndefined();
    expect(result.record).toEqual(validRecord());
  });

  it("carries the investigator brief forward field by field", async () => {
    const repoPath = project(validRecord());
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.record?.investigatorBrief?.relevantFiles).toEqual([
      "src/run-dir.ts",
      "src/tools/validate-envelope.ts",
    ]);
    expect(result.record?.investigatorBrief?.approach).toContain(
      "resolveRunDir"
    );
  });

  it("accepts a record with no investigator brief — some tiers skip investigation", async () => {
    const { investigatorBrief: _omit, ...noBrief } = validRecord();
    const repoPath = project(noBrief);
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("ok");
    expect(result.record?.investigatorBrief).toBeUndefined();
  });

  it("accepts a record with no worktree fingerprint yet", async () => {
    const { worktreeFingerprint: _omit, ...noFingerprint } = validRecord();
    const repoPath = project(noFingerprint);
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("ok");
    expect(result.record?.worktreeFingerprint).toBeUndefined();
  });

  it("accepts every member of the slice-executor stage vocabulary", async () => {
    for (const stage of [
      "investigator",
      "implementer",
      "capability-gate",
      "reviewer",
    ]) {
      const repoPath = project({ ...validRecord(), lastCompletedStage: stage });
      const result = await recoverSliceProgress({
        runId: RUN_ID,
        issue: ISSUE,
        repoPath,
      });
      expect(result.status).toBe("ok");
      expect(result.record?.lastCompletedStage).toBe(stage);
    }
  });

  it("records the fallback guard as taken so a resumed executor cannot re-arm it", async () => {
    const repoPath = project({ ...validRecord(), fallbackTaken: true });
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("ok");
    expect(result.record?.fallbackTaken).toBe(true);
  });
});

// ─── lastCompletedStage — the subState precedent (absent ok, null rejected) ───

describe("recoverSliceProgress — lastCompletedStage absence semantics", () => {
  it("accepts an absent key — no stage has completed yet", async () => {
    const { lastCompletedStage: _omit, ...noStage } = validRecord();
    const repoPath = project(noStage);
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("ok");
    expect(result.record?.lastCompletedStage).toBeUndefined();
  });

  it("rejects an explicit null — .optional() is not .nullable()", async () => {
    const repoPath = project({ ...validRecord(), lastCompletedStage: null });
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PROGRESS_INVALID");
    expect(result.errorMessage).toContain("lastCompletedStage");
  });
});

// ─── Missing vs malformed, distinctly (criterion 3) ──────────────────────────

describe("recoverSliceProgress — missing is distinct from malformed", () => {
  it("reports a missing record as PROGRESS_NOT_FOUND, resolving rather than throwing", async () => {
    const repoPath = project(null);
    const call = recoverSliceProgress({ runId: RUN_ID, issue: ISSUE, repoPath });
    await expect(call).resolves.toBeDefined();
    const result = await call;
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PROGRESS_NOT_FOUND");
    expect(result.record).toBeUndefined();
  });

  it("reports unparseable JSON as PROGRESS_INVALID, resolving rather than throwing", async () => {
    const repoPath = project("{ not json");
    const call = recoverSliceProgress({ runId: RUN_ID, issue: ISSUE, repoPath });
    await expect(call).resolves.toBeDefined();
    const result = await call;
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PROGRESS_INVALID");
    expect(result.record).toBeUndefined();
  });

  it("keeps the two codes distinct for the same run", async () => {
    const missing = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath: project(null),
    });
    const malformed = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath: project("}{"),
    });
    expect(missing.errorCode).not.toBe(malformed.errorCode);
  });

  it("reports a schema mismatch as PROGRESS_INVALID naming the offending field path", async () => {
    const repoPath = project({
      ...validRecord(),
      lastCompletedStage: "merger", // not a slice-executor stage
    });
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PROGRESS_INVALID");
    expect(result.errorMessage).toContain("lastCompletedStage");
  });

  it("rejects a negative continuation count", async () => {
    const repoPath = project({ ...validRecord(), continuationsUsed: -1 });
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PROGRESS_INVALID");
    expect(result.errorMessage).toContain("continuationsUsed");
  });

  it("rejects a record missing fallbackTaken — an absent guard must never read as unspent", async () => {
    const { fallbackTaken: _omit, ...noGuard } = validRecord();
    const repoPath = project(noGuard);
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PROGRESS_INVALID");
    expect(result.errorMessage).toContain("fallbackTaken");
  });
});

// ─── Path-traversal guards (ADR-0012 invariant 3, by test) ───────────────────

describe("recoverSliceProgress — hostile inputs never escape the run directory", () => {
  it("rejects a traversal-y runId", async () => {
    const repoPath = project(validRecord());
    const result = await recoverSliceProgress({
      runId: "../../etc",
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_ID_INVALID");
    expect(result.record).toBeUndefined();
  });

  it("rejects a traversal-y issue id", async () => {
    const repoPath = project(validRecord());
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: "../../../etc/passwd" as unknown as number,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("ISSUE_INVALID");
    expect(result.record).toBeUndefined();
  });

  it("rejects a non-integer and a non-positive issue id", async () => {
    const repoPath = project(validRecord());
    for (const issue of [0, -355, 1.5, NaN]) {
      const result = await recoverSliceProgress({ runId: RUN_ID, issue, repoPath });
      expect(result.status).toBe("error");
      expect(result.errorCode).toBe("ISSUE_INVALID");
    }
  });

  it("never reads a file outside the run directory for a hostile issue id", async () => {
    const repoPath = project(validRecord());
    // Plant a decoy the traversal would reach if the id were joined unguarded.
    fs.writeFileSync(
      path.join(repoPath, "slice-x-progress.json"),
      JSON.stringify(validRecord())
    );
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: "../../../x" as unknown as number,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.record).toBeUndefined();
  });
});

// ─── Self-identification — a mis-filed record is detected, not accepted ──────

describe("recoverSliceProgress — the record must match the path it came from", () => {
  it("rejects a record whose runId disagrees with the requested run", async () => {
    const repoPath = project({ ...validRecord(), runId: "backlog-20260101-000000" });
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PROGRESS_INVALID");
    expect(result.errorMessage).toContain("runId");
  });

  it("rejects a record whose issue disagrees with the requested slice", async () => {
    const repoPath = project({ ...validRecord(), issue: 999 });
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: ISSUE,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PROGRESS_INVALID");
    expect(result.errorMessage).toContain("issue");
  });
});

// ─── Cross-run and intra-run isolation (criteria 4 + 5) ──────────────────────

describe("recoverSliceProgress — records never collide", () => {
  it("keeps sibling slices of ONE parallel wave separate", async () => {
    // The intra-run hazard: several slices of the same wave share one run
    // directory, so a single progress.json would clobber siblings.
    const repoPath = project({ ...validRecord(), continuationsUsed: 1 });
    writeRecord(
      repoPath,
      { ...validRecord(), issue: 356, continuationsUsed: 2 },
      RUN_ID,
      356
    );

    const a = await recoverSliceProgress({ runId: RUN_ID, issue: ISSUE, repoPath });
    const b = await recoverSliceProgress({ runId: RUN_ID, issue: 356, repoPath });
    expect(a.record?.continuationsUsed).toBe(1);
    expect(b.record?.continuationsUsed).toBe(2);
    expect(a.record?.issue).toBe(ISSUE);
    expect(b.record?.issue).toBe(356);
  });

  it("keeps the same issue number in two concurrent runs separate (ADR-0012)", async () => {
    const otherRun = "backlog-20260803-022540";
    const repoPath = project({ ...validRecord(), continuationsUsed: 1 });
    writeRecord(
      repoPath,
      { ...validRecord(), runId: otherRun, continuationsUsed: 3 },
      otherRun,
      ISSUE
    );

    const a = await recoverSliceProgress({ runId: RUN_ID, issue: ISSUE, repoPath });
    const b = await recoverSliceProgress({ runId: otherRun, issue: ISSUE, repoPath });
    expect(a.record?.continuationsUsed).toBe(1);
    expect(b.record?.continuationsUsed).toBe(3);
    expect(a.record?.runId).toBe(RUN_ID);
    expect(b.record?.runId).toBe(otherRun);
  });

  it("reports NOT_FOUND for a sibling slice that has no record yet", async () => {
    const repoPath = project(validRecord());
    const result = await recoverSliceProgress({
      runId: RUN_ID,
      issue: 356,
      repoPath,
    });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PROGRESS_NOT_FOUND");
  });
});
