import { z } from "zod";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const planWavesInputSchema = z.object({
  issues: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .describe(
            "Unique identifier of the issue — e.g. a GitHub issue number " +
              "rendered as a string."
          ),
        blockedBy: z
          .array(z.string())
          .optional()
          .describe(
            "Ids of the issues this issue is blocked by. A blocker not " +
              "present in the input set is treated as already satisfied (it " +
              "is assumed done). Omit, or pass [], for an unblocked issue."
          ),
      })
    )
    .describe(
      "The set of issues to schedule. Each carries its own id and the ids " +
        "of the issues that block it."
    ),
});

export const planWavesOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the issues were scheduled into waves; " +
        "'error' = the graph could not be scheduled."
    ),
  waves: z
    .array(z.array(z.string()))
    .optional()
    .describe(
      "Dependency-ordered waves of issue ids. Wave 0 holds every issue with " +
        "no in-set blockers; each later wave holds issues whose in-set " +
        "blockers all resolve in an earlier wave. Issue order within a wave " +
        "follows input order. Present when status='ok' (an empty issue set " +
        "yields an empty array)."
    ),
  errorCode: z
    .enum(["INVALID_INPUT", "CYCLE_DETECTED"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'. " +
        "'INVALID_INPUT' = the issue set is malformed (e.g. a duplicate id); " +
        "'CYCLE_DETECTED' = the dependency graph contains a cycle and cannot " +
        "be topologically ordered."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Human-readable failure description. Present when status='error'."
    ),
  cycle: z
    .array(z.string())
    .optional()
    .describe(
      "The detected dependency cycle as an ordered path of issue ids, with " +
        "the entry id repeated at the end to close the loop. Present when " +
        "errorCode='CYCLE_DETECTED'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type PlanWavesInput = z.infer<typeof planWavesInputSchema>;
export type PlanWavesOutput = z.infer<typeof planWavesOutputSchema>;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Finds one dependency cycle within the still-unresolved subgraph via a
 * three-colour DFS. Called only after a wave round made no progress, so a
 * cycle is guaranteed to exist.
 *
 * @param remaining ids that could not be scheduled
 * @param deps      id -> set of ids it is blocked by (already filtered to the input set)
 * @returns the cycle as an ordered path, entry id repeated last to close it
 */
function findCycle(
  remaining: Set<string>,
  deps: Map<string, Set<string>>
): string[] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of remaining) color.set(id, WHITE);
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of deps.get(node) ?? []) {
      if (!remaining.has(dep)) continue; // only walk the unresolved subgraph
      if (color.get(dep) === GRAY) {
        // Back-edge — the cycle is the stack slice from `dep` to the top.
        return [...stack.slice(stack.indexOf(dep)), dep];
      }
      if (color.get(dep) === WHITE) {
        const found = dfs(dep);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }

  for (const id of remaining) {
    if (color.get(id) === WHITE) {
      const found = dfs(id);
      if (found) return found;
    }
  }
  return []; // unreachable: a no-progress round guarantees a cycle exists
}

// ─── plan_waves ────────────────────────────────────────────────────────────────

/**
 * Groups issues into dependency-ordered waves via Kahn-style topological
 * sorting. Every issue in a wave has all of its in-set blockers satisfied by
 * an earlier wave; a dependency cycle is returned as a structured error
 * rather than a hang. Never throws.
 */
export function planWaves(input: PlanWavesInput): PlanWavesOutput {
  const { issues } = input;

  // Reject duplicate ids — they would make the dependency graph ambiguous.
  const idSet = new Set<string>();
  for (const issue of issues) {
    if (idSet.has(issue.id)) {
      return {
        status: "error",
        errorCode: "INVALID_INPUT",
        errorMessage: `Duplicate issue id in the input set: "${issue.id}".`,
      };
    }
    idSet.add(issue.id);
  }

  // deps: id -> the subset of its blockers that are present in the input set.
  // A blocker outside the set is assumed already done and does not constrain
  // ordering. A self-reference is kept so cycle detection can report it.
  const deps = new Map<string, Set<string>>();
  for (const issue of issues) {
    const inSet = (issue.blockedBy ?? []).filter((b) => idSet.has(b));
    deps.set(issue.id, new Set(inSet));
  }

  // Kahn by waves: each round collects every remaining issue whose blockers
  // are all already resolved. `remaining` keeps input insertion order, so
  // wave membership is deterministic.
  const remaining = new Set<string>(issues.map((i) => i.id));
  const resolved = new Set<string>();
  const waves: string[][] = [];

  while (remaining.size > 0) {
    const wave: string[] = [];
    for (const id of remaining) {
      const ready = [...deps.get(id)!].every((dep) => resolved.has(dep));
      if (ready) wave.push(id);
    }

    if (wave.length === 0) {
      // No issue became ready — the remaining issues contain a cycle.
      const cycle = findCycle(remaining, deps);
      return {
        status: "error",
        errorCode: "CYCLE_DETECTED",
        errorMessage: `Dependency cycle detected: ${cycle.join(" -> ")}.`,
        cycle,
      };
    }

    waves.push(wave);
    for (const id of wave) {
      remaining.delete(id);
      resolved.add(id);
    }
  }

  return { status: "ok", waves };
}
