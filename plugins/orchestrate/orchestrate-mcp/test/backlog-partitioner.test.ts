import { describe, it, expect } from "vitest";
import {
  partitionBacklog,
  filterToOneParentPrd,
  type BacklogIssue,
} from "../src/tools/backlog-partitioner.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function issue(
  number: number,
  title: string,
  opts: { blockedBy?: number[]; parent?: number | null } = {}
): BacklogIssue {
  return {
    number,
    title,
    blockedBy: opts.blockedBy ?? [],
    parent: opts.parent ?? null,
  };
}

// ─── partitionBacklog ─────────────────────────────────────────────────────────

describe("partitionBacklog", () => {
  it("excludes an issue named as another issue's parent and surfaces it as parentIssue", () => {
    const issues = [
      issue(100, "PRD: my feature"),
      issue(101, "Implement auth", { parent: 100 }),
      issue(102, "Implement UI", { parent: 100 }),
    ];
    const result = partitionBacklog(issues);

    expect(result.parentIssue).not.toBeNull();
    expect(result.parentIssue!.number).toBe(100);
    expect(result.slices.map((s) => s.number)).toEqual([101, 102]);
  });

  it("resolves parentIssue to null when no issue names a parent", () => {
    const issues = [
      issue(101, "Implement auth"),
      issue(102, "Implement UI"),
    ];
    const result = partitionBacklog(issues);

    expect(result.parentIssue).toBeNull();
    expect(result.slices.map((s) => s.number)).toEqual([101, 102]);
  });

  it("catches a parent PRD not referenced via the Parent field using the PRD: title heuristic", () => {
    // Issue 100 has title "PRD: ..." but no child issue has parent=100.
    // The heuristic should still detect it as parentIssue.
    const issues = [
      issue(100, "PRD: my feature"),
      issue(101, "Implement auth"),
      issue(102, "Implement UI"),
    ];
    const result = partitionBacklog(issues);

    expect(result.parentIssue).not.toBeNull();
    expect(result.parentIssue!.number).toBe(100);
    expect(result.slices.map((s) => s.number)).toEqual([101, 102]);
  });

  it("applies the PRD: heuristic case-insensitively", () => {
    const issues = [
      issue(100, "prd: my feature"),
      issue(101, "Implement auth"),
    ];
    const result = partitionBacklog(issues);

    expect(result.parentIssue).not.toBeNull();
    expect(result.parentIssue!.number).toBe(100);
    expect(result.slices.map((s) => s.number)).toEqual([101]);
  });

  it("preserves slices order from the input", () => {
    const issues = [
      issue(100, "PRD: feature"),
      issue(103, "C", { parent: 100 }),
      issue(101, "A", { parent: 100 }),
      issue(102, "B", { parent: 100 }),
    ];
    const result = partitionBacklog(issues);

    expect(result.slices.map((s) => s.number)).toEqual([103, 101, 102]);
  });

  it("returns all issues as slices when no parent is detected", () => {
    const issues = [issue(10, "Task A"), issue(11, "Task B")];
    const result = partitionBacklog(issues);

    expect(result.slices).toHaveLength(2);
    expect(result.parentIssue).toBeNull();
  });

  it("prefers the parent field reference over the PRD title heuristic when both are present", () => {
    // Issue 100 is referenced as parent by issue 101 AND has PRD: title.
    const issues = [
      issue(100, "PRD: big feature"),
      issue(101, "Implement X", { parent: 100 }),
      issue(102, "Implement Y", { parent: 100 }),
    ];
    const result = partitionBacklog(issues);

    // parentIssue is the same issue detected by both signals — the result is the same.
    expect(result.parentIssue!.number).toBe(100);
    expect(result.slices.map((s) => s.number)).toEqual([101, 102]);
  });

  it("handles a single-issue backlog with no parent reference", () => {
    const issues = [issue(42, "Fix bug")];
    const result = partitionBacklog(issues);

    expect(result.parentIssue).toBeNull();
    expect(result.slices).toHaveLength(1);
    expect(result.slices[0].number).toBe(42);
  });

  it("handles a single-issue backlog that is itself a PRD", () => {
    // Only one issue and it matches PRD: heuristic — it becomes parentIssue with zero slices.
    const issues = [issue(50, "PRD: lone prd")];
    const result = partitionBacklog(issues);

    expect(result.parentIssue).not.toBeNull();
    expect(result.parentIssue!.number).toBe(50);
    expect(result.slices).toHaveLength(0);
  });

  it("returns an empty slices array for an empty input", () => {
    const result = partitionBacklog([]);

    expect(result.parentIssue).toBeNull();
    expect(result.slices).toEqual([]);
  });

  it("does not enroll a parent issue as a slice even if it has no blockedBy entries", () => {
    const issues = [
      issue(100, "PRD: feature"),
      issue(101, "Implement A", { parent: 100 }),
    ];
    const result = partitionBacklog(issues);

    const sliceNumbers = result.slices.map((s) => s.number);
    expect(sliceNumbers).not.toContain(100);
    expect(sliceNumbers).toContain(101);
  });
});

// ─── filterToOneParentPrd ─────────────────────────────────────────────────────

describe("filterToOneParentPrd", () => {
  it("returns only issues whose parent matches the given PRD number", () => {
    const issues = [
      issue(100, "PRD: feature A"),
      issue(200, "PRD: feature B"),
      issue(101, "Impl A1", { parent: 100 }),
      issue(102, "Impl A2", { parent: 100 }),
      issue(201, "Impl B1", { parent: 200 }),
    ];
    const result = filterToOneParentPrd(issues, 100);

    expect(result.map((i) => i.number)).toEqual([101, 102]);
  });

  it("returns an empty array when no issues belong to the given PRD", () => {
    const issues = [issue(101, "Task A"), issue(102, "Task B")];
    const result = filterToOneParentPrd(issues, 999);

    expect(result).toEqual([]);
  });

  it("preserves input order of the filtered issues", () => {
    const issues = [
      issue(103, "C", { parent: 100 }),
      issue(101, "A", { parent: 100 }),
      issue(102, "B", { parent: 100 }),
    ];
    const result = filterToOneParentPrd(issues, 100);

    expect(result.map((i) => i.number)).toEqual([103, 101, 102]);
  });

  it("does not include the parent issue itself in the result", () => {
    const issues = [
      issue(100, "PRD: feature"),
      issue(101, "Task A", { parent: 100 }),
    ];
    const result = filterToOneParentPrd(issues, 100);

    expect(result.map((i) => i.number)).not.toContain(100);
    expect(result.map((i) => i.number)).toContain(101);
  });
});
