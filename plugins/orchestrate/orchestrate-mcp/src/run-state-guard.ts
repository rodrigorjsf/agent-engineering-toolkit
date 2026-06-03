import * as fs from "fs";

// ─── run-state-guard — the shared cross-run mutation gate ─────────────────────
//
// This module is the single status-gate guard mandated by ADR-0012 §invariant
// ("Orchestrate cross-run isolation is a status-gated invariant"). Any tool that
// deletes or mutates a run's on-disk or git footprint MUST pass through
// `checkCrossRunMutationAllowed` before acting, so the eligibility gate lives in
// exactly one place and every cross-run-mutating tool reuses it rather than
// re-deriving it. `clean_runs` is the only current consumer; the guard is
// factored out now so the next such tool calls it instead of forking the gate.
//
// The gate is deterministic and independent of the orchestrator's verdict map:
// it re-reads the run's own `run-state.json` and refuses to act unless the run
// is `completed` AND carries a non-null `finalPullRequest`. The one sanctioned
// exception — `/orchestrate clean --failed <runId>` — bypasses this gate by
// design (see ADR-0012); it must skip this guard, never duplicate it.

/** The subset of run-state fields the cleanup gate and removal steps read. */
export interface ParsedRunState {
  status: unknown;
  umbrellaBranch: unknown;
  slices: unknown;
  finalPullRequest: unknown;
}

/**
 * Reads and JSON-parses a run's `run-state.json`. Returns a discriminated
 * result so the caller can map the failure modes to keyed reasons.
 */
export function readRunState(
  runStatePath: string
):
  | { ok: true; state: ParsedRunState }
  | { ok: false; reason: "missing-run-state" | "malformed-run-state" } {
  if (!fs.existsSync(runStatePath)) {
    return { ok: false, reason: "missing-run-state" };
  }
  let raw: string;
  try {
    raw = fs.readFileSync(runStatePath, "utf8");
  } catch {
    return { ok: false, reason: "malformed-run-state" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed-run-state" };
  }
  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, reason: "malformed-run-state" };
  }
  const obj = parsed as Record<string, unknown>;
  return {
    ok: true,
    state: {
      status: obj.status,
      umbrellaBranch: obj.umbrellaBranch,
      slices: obj.slices,
      finalPullRequest: obj.finalPullRequest,
    },
  };
}

/** The keyed reason a cross-run mutation was refused. */
export type CrossRunGateReason =
  | "missing-run-state"
  | "malformed-run-state"
  | "run-not-completed"
  | "final-pr-missing";

/**
 * The single cross-run mutation gate. Any tool that deletes or mutates a run's
 * on-disk/git footprint MUST pass through this before acting.
 *
 * Gate order, in sequence: (1) `readRunState` — bail with its
 * `missing-run-state`/`malformed-run-state` reason; (2) `status !== "completed"`
 * → `run-not-completed`; (3) `finalPullRequest == null` (catches both `null` and
 * `undefined`) → `final-pr-missing`; else `{ ok: true, state }`. Status is
 * checked before finalPR by design: an `in-progress` run with a null finalPR is
 * reported `run-not-completed`, not `final-pr-missing`.
 */
export function checkCrossRunMutationAllowed(
  runStatePath: string
):
  | { ok: true; state: ParsedRunState }
  | { ok: false; reason: CrossRunGateReason } {
  const stateResult = readRunState(runStatePath);
  if (!stateResult.ok) {
    return { ok: false, reason: stateResult.reason };
  }
  if (stateResult.state.status !== "completed") {
    return { ok: false, reason: "run-not-completed" };
  }
  if (stateResult.state.finalPullRequest == null) {
    return { ok: false, reason: "final-pr-missing" };
  }
  return { ok: true, state: stateResult.state };
}
