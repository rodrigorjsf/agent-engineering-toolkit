import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { validateRunState } from "../src/tools/validate-run-state.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const RUN_ID = "20260521-010101";

/** A single, schema-valid slice entry. */
const SLICE = {
  issue: 157,
  title: "S1: walking skeleton",
  wave: 0,
  tier: "standard",
  blockedBy: [],
  state: "pending",
  sliceBranch: "orchestrate/slice-157",
  worktreePath: null,
  pullRequest: null,
  failureReason: null,
  updatedAt: "2026-05-21T01:30:00Z",
};

/** A full run-state with `slices` as the canonical MAP keyed by issue-id string. */
function validMapState(): Record<string, unknown> {
  return {
    runId: RUN_ID,
    status: "in-progress",
    umbrellaBranch: `orchestrate/umbrella-${RUN_ID}`,
    integrationBase: "development",
    parentIssue: 100,
    startedAt: "2026-05-21T01:01:01Z",
    updatedAt: "2026-05-21T02:30:00Z",
    waves: [["157"]],
    completedWaves: 0,
    finalPullRequest: null,
    slices: { "157": SLICE },
  };
}

// ─── Test harness ─────────────────────────────────────────────────────────────

const created: string[] = [];

/**
 * Writes a project dir with a per-run directory at
 * `.orchestrate/runs/<runId>/`. Pass null for `config` to skip creating
 * run-state.json (the run directory is still created). Pass a string to write
 * it verbatim (for the bad-JSON case).
 */
function project(
  config: unknown | string | null,
  runId: string = RUN_ID
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-validate-"));
  created.push(dir);
  const runDir = path.join(dir, ".orchestrate", "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  if (config !== null) {
    const content =
      typeof config === "string" ? config : JSON.stringify(config, null, 2);
    fs.writeFileSync(path.join(runDir, "run-state.json"), content);
  }
  return dir;
}

afterEach(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  created.length = 0;
});

// ─── Cases ────────────────────────────────────────────────────────────────────

describe("validateRunState", () => {
  it("valid map — slices keyed by issue-id string returns status: valid", async () => {
    const repoPath = project(validMapState());
    const result = await validateRunState({ runId: RUN_ID, repoPath });
    expect(result).toEqual({ status: "valid" });
  });

  it("slices-as-array (the #238 regression) returns RUN_STATE_INVALID and names the slices path", async () => {
    const bad = validMapState();
    // The latent trap: the partition_backlog ARRAY passed straight through.
    bad.slices = [SLICE];
    const repoPath = project(bad);
    const result = await validateRunState({ runId: RUN_ID, repoPath });
    expect(result.status).toBe("invalid");
    expect(result.errorCode).toBe("RUN_STATE_INVALID");
    expect(result.errorMessage).toContain("slices");
  });

  it("missing file returns RUN_STATE_NOT_FOUND", async () => {
    const repoPath = project(null);
    const result = await validateRunState({ runId: RUN_ID, repoPath });
    expect(result.status).toBe("invalid");
    expect(result.errorCode).toBe("RUN_STATE_NOT_FOUND");
  });

  it("bad JSON returns RUN_STATE_INVALID", async () => {
    const repoPath = project("{ not json");
    const result = await validateRunState({ runId: RUN_ID, repoPath });
    expect(result.status).toBe("invalid");
    expect(result.errorCode).toBe("RUN_STATE_INVALID");
  });

  it("traversal-y runId returns RUN_ID_INVALID", async () => {
    const repoPath = project(validMapState());
    const result = await validateRunState({ runId: "../escape", repoPath });
    expect(result.status).toBe("invalid");
    expect(result.errorCode).toBe("RUN_ID_INVALID");
  });
});
