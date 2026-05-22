import { describe, it, expect } from "vitest";
import * as path from "path";
import { resolveRunDir, isValidRunId } from "../src/run-dir.js";

// `run-dir` is a pure module — every test exercises path computation only, with
// no filesystem I/O. The resolver maps a (repoPath, runId) pair to the run's
// ephemeral directory and the files inside it.

// ─── isValidRunId ─────────────────────────────────────────────────────────────

describe("isValidRunId", () => {
  it("accepts the skill's YYYYMMDD-HHMMSS timestamp ids", () => {
    expect(isValidRunId("20260521-015143")).toBe(true);
  });

  it("accepts ids made of letters, digits, underscores, and hyphens", () => {
    expect(isValidRunId("run_42-abc")).toBe(true);
    expect(isValidRunId("A")).toBe(true);
  });

  it("accepts the prd<N>-<timestamp> id of a partitioned run", () => {
    expect(isValidRunId("prd195-20260521-015143")).toBe(true);
  });

  it("accepts the backlog-<timestamp> id of a no-argument run", () => {
    expect(isValidRunId("backlog-20260521-015143")).toBe(true);
  });

  it("rejects a path-traversal id even with the prd<N>- prefix", () => {
    // The prefixed forms must not weaken the path-traversal guard: a runId
    // carrying `..` or a separator stays rejected regardless of its prefix.
    expect(isValidRunId("prd195-../etc")).toBe(false);
    expect(isValidRunId("backlog-../../etc")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidRunId("")).toBe(false);
  });

  it("rejects a path-traversal id", () => {
    expect(isValidRunId("../../etc")).toBe(false);
    expect(isValidRunId("..")).toBe(false);
  });

  it("rejects an id containing a path separator", () => {
    expect(isValidRunId("a/b")).toBe(false);
    expect(isValidRunId("a\\b")).toBe(false);
  });

  it("rejects an id containing a dot", () => {
    expect(isValidRunId("run.1")).toBe(false);
  });

  it("rejects an id containing whitespace", () => {
    expect(isValidRunId("run 1")).toBe(false);
  });
});

// ─── resolveRunDir — invalid ids ─────────────────────────────────────────────

describe("resolveRunDir — invalid runId", () => {
  it("returns ok:false with RUN_ID_INVALID for a path-traversal id", () => {
    const result = resolveRunDir("/repo", "../../etc");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("RUN_ID_INVALID");
      expect(result.errorMessage).toContain("../../etc");
    }
  });

  it("returns ok:false with RUN_ID_INVALID for an empty id", () => {
    const result = resolveRunDir("/repo", "");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("RUN_ID_INVALID");
    }
  });

  it("returns ok:false with RUN_ID_INVALID for an id with a separator", () => {
    const result = resolveRunDir("/repo", "a/b");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("RUN_ID_INVALID");
    }
  });
});

// ─── resolveRunDir — valid ids ───────────────────────────────────────────────

describe("resolveRunDir — valid runId", () => {
  it("returns ok:true with every ephemeral path present", () => {
    const result = resolveRunDir("/repo", "20260521-015143");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths.runDir).toBeDefined();
      expect(result.paths.runStatePath).toBeDefined();
      expect(result.paths.contextFlagPath).toBeDefined();
      expect(result.paths.dashboardPath).toBeDefined();
      expect(result.paths.graphPath).toBeDefined();
      expect(result.paths.reportPath).toBeDefined();
    }
  });

  it("nests the run directory under .orchestrate/runs/<runId>/", () => {
    const result = resolveRunDir("/repo", "20260521-015143");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths.runDir).toBe(
        path.join("/repo", ".orchestrate", "runs", "20260521-015143")
      );
    }
  });

  it("places run-state.json and context-flag.json inside the run directory", () => {
    const result = resolveRunDir("/repo", "20260521-015143");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths.runStatePath).toBe(
        path.join(result.paths.runDir, "run-state.json")
      );
      expect(result.paths.contextFlagPath).toBe(
        path.join(result.paths.runDir, "context-flag.json")
      );
    }
  });

  it("places the three HTML artifacts inside the run directory", () => {
    const result = resolveRunDir("/repo", "20260521-015143");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths.dashboardPath).toBe(
        path.join(result.paths.runDir, "dashboard.html")
      );
      expect(result.paths.graphPath).toBe(
        path.join(result.paths.runDir, "graph.html")
      );
      expect(result.paths.reportPath).toBe(
        path.join(result.paths.runDir, "report.html")
      );
    }
  });
});

// ─── Per-run isolation invariant ─────────────────────────────────────────────

describe("resolveRunDir — per-run path isolation", () => {
  it("two distinct run ids never resolve to a shared path", () => {
    const a = resolveRunDir("/repo", "20260521-010101");
    const b = resolveRunDir("/repo", "20260521-020202");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      // No path in run A equals any path in run B.
      const aPaths = Object.values(a.paths);
      const bPaths = Object.values(b.paths);
      for (const ap of aPaths) {
        for (const bp of bPaths) {
          expect(ap).not.toBe(bp);
        }
      }
    }
  });

  it("resolves a prd<N>- and a backlog- runId to disjoint run directories", () => {
    // Two concurrent runs in one repository — one partitioned, one whole-backlog
    // — must never resolve to a shared run directory.
    const partitioned = resolveRunDir("/repo", "prd195-20260521-015143");
    const wholeBacklog = resolveRunDir("/repo", "backlog-20260521-015143");
    expect(partitioned.ok && wholeBacklog.ok).toBe(true);
    if (partitioned.ok && wholeBacklog.ok) {
      expect(partitioned.paths.runDir).not.toBe(wholeBacklog.paths.runDir);
      expect(partitioned.paths.runDir).toBe(
        path.join("/repo", ".orchestrate", "runs", "prd195-20260521-015143")
      );
      expect(wholeBacklog.paths.runDir).toBe(
        path.join("/repo", ".orchestrate", "runs", "backlog-20260521-015143")
      );
    }
  });

  it("the same run id resolves deterministically to the same paths", () => {
    const first = resolveRunDir("/repo", "20260521-015143");
    const second = resolveRunDir("/repo", "20260521-015143");
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.paths).toEqual(second.paths);
    }
  });

  it("keeps the run directory inside the repo's .orchestrate tree", () => {
    const result = resolveRunDir("/repo", "20260521-015143");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const expectedPrefix = path.join("/repo", ".orchestrate", "runs");
      expect(result.paths.runDir.startsWith(expectedPrefix)).toBe(true);
    }
  });
});
