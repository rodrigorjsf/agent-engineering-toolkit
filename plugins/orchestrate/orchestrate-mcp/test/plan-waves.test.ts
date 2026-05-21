import { describe, it, expect } from "vitest";
import { planWaves } from "../src/tools/plan-waves.js";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("plan_waves", () => {
  it("orders a linear chain into one issue per wave", () => {
    const r = planWaves({
      issues: [
        { id: "A" },
        { id: "B", blockedBy: ["A"] },
        { id: "C", blockedBy: ["B"] },
      ],
    });

    expect(r.status).toBe("ok");
    expect(r.waves).toEqual([["A"], ["B"], ["C"]]);
  });

  it("puts every blocker-free issue in the first wave", () => {
    const r = planWaves({
      issues: [{ id: "A" }, { id: "B" }, { id: "C" }],
    });

    expect(r.status).toBe("ok");
    expect(r.waves).toEqual([["A", "B", "C"]]);
  });

  it("runs independent branches in parallel and joins them in a later wave", () => {
    const r = planWaves({
      issues: [
        { id: "A" },
        { id: "B" },
        { id: "C", blockedBy: ["A", "B"] },
      ],
    });

    expect(r.status).toBe("ok");
    expect(r.waves).toEqual([["A", "B"], ["C"]]);
  });

  it("schedules a diamond dependency correctly", () => {
    const r = planWaves({
      issues: [
        { id: "A" },
        { id: "B", blockedBy: ["A"] },
        { id: "C", blockedBy: ["A"] },
        { id: "D", blockedBy: ["B", "C"] },
      ],
    });

    expect(r.status).toBe("ok");
    expect(r.waves).toEqual([["A"], ["B", "C"], ["D"]]);
  });

  it("preserves input order within a wave", () => {
    const r = planWaves({
      issues: [{ id: "C" }, { id: "A" }, { id: "B" }],
    });

    expect(r.status).toBe("ok");
    expect(r.waves).toEqual([["C", "A", "B"]]);
  });

  it("preserves input order within a non-first wave produced by Kahn", () => {
    // C and B both unblock in wave 1; the wave must keep input order (C, B).
    const r = planWaves({
      issues: [
        { id: "A" },
        { id: "C", blockedBy: ["A"] },
        { id: "B", blockedBy: ["A"] },
      ],
    });

    expect(r.status).toBe("ok");
    expect(r.waves).toEqual([["A"], ["C", "B"]]);
  });

  it("handles an issue blocked by one in-set and one out-of-set blocker", () => {
    // "ext" is not in the set (assumed done); only B constrains A.
    const r = planWaves({
      issues: [
        { id: "A", blockedBy: ["ext", "B"] },
        { id: "B" },
      ],
    });

    expect(r.status).toBe("ok");
    expect(r.waves).toEqual([["B"], ["A"]]);
  });

  it("treats a blocker that is not in the input set as already satisfied", () => {
    // "999" is not one of the input issues — assumed done.
    const r = planWaves({
      issues: [{ id: "A", blockedBy: ["999"] }, { id: "B", blockedBy: ["A"] }],
    });

    expect(r.status).toBe("ok");
    expect(r.waves).toEqual([["A"], ["B"]]);
  });

  it("detects a two-node cycle and reports it as a structured error", () => {
    const r = planWaves({
      issues: [
        { id: "A", blockedBy: ["B"] },
        { id: "B", blockedBy: ["A"] },
      ],
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CYCLE_DETECTED");
    expect(r.cycle).toBeDefined();
    // The cycle path closes on itself (entry id repeated last).
    expect(r.cycle![0]).toBe(r.cycle![r.cycle!.length - 1]);
    expect(r.errorMessage).toMatch(/->/);
    expect(r.waves).toBeUndefined();
  });

  it("detects a three-node cycle and reports the full path", () => {
    const r = planWaves({
      issues: [
        { id: "A", blockedBy: ["C"] },
        { id: "B", blockedBy: ["A"] },
        { id: "C", blockedBy: ["B"] },
      ],
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CYCLE_DETECTED");
    // Three distinct nodes plus the repeated entry id closing the loop.
    expect(r.cycle!.length).toBe(4);
    expect(r.cycle![0]).toBe(r.cycle![3]);
    expect(new Set(r.cycle)).toEqual(new Set(["A", "B", "C"]));
  });

  it("detects a self-dependency as a cycle", () => {
    const r = planWaves({
      issues: [{ id: "A", blockedBy: ["A"] }],
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CYCLE_DETECTED");
    expect(r.cycle).toEqual(["A", "A"]);
  });

  it("detects a cycle even when acyclic issues also depend on it", () => {
    // A <-> B is a cycle; C depends on A but is not itself in the cycle.
    const r = planWaves({
      issues: [
        { id: "A", blockedBy: ["B"] },
        { id: "B", blockedBy: ["A"] },
        { id: "C", blockedBy: ["A"] },
      ],
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CYCLE_DETECTED");
    expect(r.cycle).not.toContain("C");
    expect(r.waves).toBeUndefined();
  });

  it("rejects a duplicate issue id with errorCode='INVALID_INPUT'", () => {
    const r = planWaves({
      issues: [{ id: "A" }, { id: "A" }],
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
    expect(r.errorMessage).toMatch(/duplicate/i);
  });

  it("returns an empty wave list for an empty issue set", () => {
    const r = planWaves({ issues: [] });

    expect(r.status).toBe("ok");
    expect(r.waves).toEqual([]);
  });
});
