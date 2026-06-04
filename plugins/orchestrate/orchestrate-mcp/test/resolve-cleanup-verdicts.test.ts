import { describe, it, expect } from "vitest";
import { resolveCleanupVerdicts } from "../src/tools/resolve-cleanup-verdicts.js";

// ─── Tests ────────────────────────────────────────────────────────────────────
//
// In-memory inputs only — no fs, no git, no `gh`, no temp repos. The module is
// pure, so every case is a plain object in, plain object out (mirrors
// plan-waves.test.ts, NOT clean-runs.test.ts's on-disk fixtures).

describe("resolve_cleanup_verdicts — phase two: the {state,mergedAt} classifier", () => {
  // The highest-value unit: every cell of the four-way truth table, plus the
  // malformed/missing/unexpected → unknown fall-through.

  it("classifies MERGED with a non-null mergedAt as `merged`", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "https://x/pull/1",
          state: "MERGED",
          mergedAt: "2026-06-04T10:00:00Z",
          slices: [],
        },
      ],
    });

    expect(r.status).toBe("ok");
    expect(r.verdicts![0].verdict).toBe("merged");
  });

  it("classifies OPEN as `open`", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "https://x/pull/1",
          state: "OPEN",
          mergedAt: null,
        },
      ],
    });

    expect(r.verdicts![0].verdict).toBe("open");
  });

  it("classifies CLOSED with a null mergedAt as `closed-unmerged`", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "https://x/pull/1",
          state: "CLOSED",
          mergedAt: null,
        },
      ],
    });

    expect(r.verdicts![0].verdict).toBe("closed-unmerged");
  });

  it("classifies MERGED with a null mergedAt as `unknown` (malformed)", () => {
    // A genuinely-merged PR always reports a mergedAt; MERGED+null is malformed.
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "https://x/pull/1",
          state: "MERGED",
          mergedAt: null,
        },
      ],
    });

    expect(r.verdicts![0].verdict).toBe("unknown");
  });

  it("classifies CLOSED with a non-null mergedAt as `unknown` (malformed)", () => {
    // A merged PR reports MERGED, not CLOSED; CLOSED+mergedAt is malformed.
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "https://x/pull/1",
          state: "CLOSED",
          mergedAt: "2026-06-04T10:00:00Z",
        },
      ],
    });

    expect(r.verdicts![0].verdict).toBe("unknown");
  });

  it("classifies a missing state as `unknown`", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [{ runId: "R1", finalPullRequest: "https://x/pull/1" }],
    });

    expect(r.verdicts![0].verdict).toBe("unknown");
  });

  it("classifies a null state as `unknown`", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "https://x/pull/1",
          state: null,
          mergedAt: null,
        },
      ],
    });

    expect(r.verdicts![0].verdict).toBe("unknown");
  });

  it("classifies an unexpected state string as `unknown`", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "https://x/pull/1",
          state: "DRAFT",
          mergedAt: null,
        },
      ],
    });

    expect(r.verdicts![0].verdict).toBe("unknown");
  });

  it("classifies each fact independently, in input order", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "p/1",
          state: "MERGED",
          mergedAt: "2026-06-04T10:00:00Z",
          slices: [],
        },
        { runId: "R2", finalPullRequest: "p/2", state: "OPEN", mergedAt: null },
        {
          runId: "R3",
          finalPullRequest: "p/3",
          state: "CLOSED",
          mergedAt: null,
        },
      ],
    });

    expect(r.verdicts!.map((v) => [v.runId, v.verdict])).toEqual([
      ["R1", "merged"],
      ["R2", "open"],
      ["R3", "closed-unmerged"],
    ]);
  });
});

describe("resolve_cleanup_verdicts — phase two: closeSetIssues", () => {
  it("collects exactly the `passed` slices' issue numbers for a merged run", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "p/1",
          state: "MERGED",
          mergedAt: "2026-06-04T10:00:00Z",
          slices: [
            { issue: 101, state: "passed" },
            { issue: 102, state: "failed" },
            { issue: 103, state: "passed" },
            { issue: 104, state: "skipped" },
            { issue: 105, state: "pending" },
            { issue: 106, state: "in-progress" },
          ],
        },
      ],
    });

    // Exactly the two passed slices, in slice order — no failed/skipped/pending/
    // in-progress slice joins the close-set.
    expect(r.verdicts![0].closeSetIssues).toEqual([101, 103]);
  });

  it("returns an empty close-set for a merged run with no passed slices", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "p/1",
          state: "MERGED",
          mergedAt: "2026-06-04T10:00:00Z",
          slices: [
            { issue: 201, state: "failed" },
            { issue: 202, state: "skipped" },
          ],
        },
      ],
    });

    expect(r.verdicts![0].closeSetIssues).toEqual([]);
  });

  it("never collects a close-set for a non-merged verdict, even with passed slices", () => {
    // An open/closed-unmerged/unknown run must yield no close-set — the spine
    // only closes issues for runs whose footprint is actually removed.
    const passedSlices = [{ issue: 301, state: "passed" as const }];
    for (const fact of [
      { state: "OPEN", mergedAt: null },
      { state: "CLOSED", mergedAt: null },
      { state: "MERGED", mergedAt: null }, // malformed → unknown
    ]) {
      const r = resolveCleanupVerdicts({
        phase: "classify",
        facts: [
          {
            runId: "R1",
            finalPullRequest: "p/1",
            state: fact.state,
            mergedAt: fact.mergedAt,
            slices: passedSlices,
          },
        ],
      });

      expect(r.verdicts![0].verdict).not.toBe("merged");
      expect(r.verdicts![0].closeSetIssues).toEqual([]);
    }
  });

  it("returns an empty close-set when a merged run's slices are omitted", () => {
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "p/1",
          state: "MERGED",
          mergedAt: "2026-06-04T10:00:00Z",
        },
      ],
    });

    expect(r.verdicts![0].verdict).toBe("merged");
    expect(r.verdicts![0].closeSetIssues).toEqual([]);
  });
});

describe("resolve_cleanup_verdicts — phase one: the eligibility gate", () => {
  it("omits a run whose status is not `completed`", () => {
    const r = resolveCleanupVerdicts({
      phase: "enumerate",
      runs: [
        { runId: "R1", status: "in-progress", finalPullRequest: "p/1" },
        { runId: "R2", status: "completed", finalPullRequest: "p/2" },
      ],
    });

    expect(r.status).toBe("ok");
    expect(r.eligibleRuns!.map((e) => e.runId)).toEqual(["R2"]);
    expect(r.finalPullRequests).toEqual(["p/2"]);
  });

  it("omits a `completed` run whose finalPullRequest is null", () => {
    const r = resolveCleanupVerdicts({
      phase: "enumerate",
      runs: [
        { runId: "R1", status: "completed", finalPullRequest: null },
        { runId: "R2", status: "completed", finalPullRequest: "p/2" },
      ],
    });

    expect(r.eligibleRuns!.map((e) => e.runId)).toEqual(["R2"]);
    expect(r.finalPullRequests).toEqual(["p/2"]);
  });

  it("admits a `completed` run with a non-null finalPullRequest", () => {
    const r = resolveCleanupVerdicts({
      phase: "enumerate",
      runs: [{ runId: "R1", status: "completed", finalPullRequest: "p/1" }],
    });

    expect(r.eligibleRuns).toEqual([
      { runId: "R1", finalPullRequest: "p/1" },
    ]);
    expect(r.finalPullRequests).toEqual(["p/1"]);
  });

  it("omits every run when none is eligible, yielding empty lists", () => {
    const r = resolveCleanupVerdicts({
      phase: "enumerate",
      runs: [
        { runId: "R1", status: "in-progress", finalPullRequest: null },
        { runId: "R2", status: "in-progress", finalPullRequest: "p/2" },
        { runId: "R3", status: "completed", finalPullRequest: null },
      ],
    });

    expect(r.status).toBe("ok");
    expect(r.eligibleRuns).toEqual([]);
    expect(r.finalPullRequests).toEqual([]);
  });
});

describe("resolve_cleanup_verdicts — phase one: dedup", () => {
  it("deduplicates the final-PR list (Set-collapsed) in first-seen order", () => {
    const r = resolveCleanupVerdicts({
      phase: "enumerate",
      runs: [
        { runId: "R1", status: "completed", finalPullRequest: "p/9" },
        { runId: "R2", status: "completed", finalPullRequest: "p/3" },
        { runId: "R3", status: "completed", finalPullRequest: "p/9" }, // dup
        { runId: "R4", status: "completed", finalPullRequest: "p/3" }, // dup
        { runId: "R5", status: "completed", finalPullRequest: "p/7" },
      ],
    });

    // First-seen order, each PR once — deterministic for the spine's fetch loop.
    expect(r.finalPullRequests).toEqual(["p/9", "p/3", "p/7"]);
  });

  it("keeps every eligible run in eligibleRuns even when PRs collide", () => {
    // eligibleRuns is NOT deduplicated — every run still needs its own verdict.
    const r = resolveCleanupVerdicts({
      phase: "enumerate",
      runs: [
        { runId: "R1", status: "completed", finalPullRequest: "p/9" },
        { runId: "R2", status: "completed", finalPullRequest: "p/9" },
      ],
    });

    expect(r.eligibleRuns).toEqual([
      { runId: "R1", finalPullRequest: "p/9" },
      { runId: "R2", finalPullRequest: "p/9" },
    ]);
    expect(r.finalPullRequests).toEqual(["p/9"]);
  });
});

describe("resolve_cleanup_verdicts — phase/input guards", () => {
  it("returns an empty enumeration for an empty run set", () => {
    const r = resolveCleanupVerdicts({ phase: "enumerate", runs: [] });

    expect(r.status).toBe("ok");
    expect(r.eligibleRuns).toEqual([]);
    expect(r.finalPullRequests).toEqual([]);
  });

  it("returns an empty verdict list for an empty fact set", () => {
    const r = resolveCleanupVerdicts({ phase: "classify", facts: [] });

    expect(r.status).toBe("ok");
    expect(r.verdicts).toEqual([]);
  });

  it("errors when phase='enumerate' is missing its `runs` array", () => {
    const r = resolveCleanupVerdicts({ phase: "enumerate" });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });

  it("errors when phase='classify' is missing its `facts` array", () => {
    const r = resolveCleanupVerdicts({ phase: "classify" });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });

  it("reuses the exact runVerdictSchema enum values", () => {
    // Guards against a forked enum: every verdict the classifier can emit must
    // be one of clean_runs' four canonical values.
    const canonical = new Set(["merged", "open", "closed-unmerged", "unknown"]);
    const r = resolveCleanupVerdicts({
      phase: "classify",
      facts: [
        {
          runId: "R1",
          finalPullRequest: "p/1",
          state: "MERGED",
          mergedAt: "2026-06-04T10:00:00Z",
          slices: [],
        },
        { runId: "R2", finalPullRequest: "p/2", state: "OPEN", mergedAt: null },
        {
          runId: "R3",
          finalPullRequest: "p/3",
          state: "CLOSED",
          mergedAt: null,
        },
        {
          runId: "R4",
          finalPullRequest: "p/4",
          state: "WEIRD",
          mergedAt: null,
        },
      ],
    });

    for (const v of r.verdicts!) {
      expect(canonical.has(v.verdict)).toBe(true);
    }
  });
});
