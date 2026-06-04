import { z } from "zod";
import { runVerdictSchema } from "./clean-runs.js";

// ─── resolve_cleanup_verdicts — the two-phase PURE cleanup-verdict module ──────
//
// The start-of-run cleanup sweep (SKILL §1) decides, per concluded run, whether
// that run's footprint may be removed. The decision turns on GitHub merge state,
// which only the `gh` CLI can read — and no MCP tool shells `gh` (ADR-0012's
// no-`gh` invariant). So the sweep is split across this module and the spine:
//
//   • Phase one (this tool) ingests the enumerated parsed run-states, applies the
//     cleanup-eligibility gate (`status === "completed" && finalPullRequest != null`,
//     the same gate as `checkCrossRunMutationAllowed`), and returns the
//     DEDUPLICATED list of final-PR identifiers the SPINE then looks up with
//     `gh pr view <id> --json state,mergedAt`. Ineligible runs are omitted.
//
//   • Phase two (this tool) ingests the `{state, mergedAt}` facts the spine
//     fetched, classifies each into the four-way verdict
//     (`merged | open | closed-unmerged | unknown`) that `clean_runs` consumes,
//     and — in the SAME pass — captures each `merged` run's `closeSetIssues`
//     (the issue numbers of its `passed` slices) before `clean_runs` deletes the
//     run directory that holds them.
//
// This module is FULLY PURE: it touches no filesystem, no git, no `gh`, no child
// process. It imports only `zod` and the canonical `runVerdictSchema` from
// `clean-runs.ts` (reused verbatim — never forked). ADR-0012's cross-run
// isolation holds by construction: a module that mutates nothing can never touch
// another run's footprint. The `gh pr view` fetch loop, the `gh issue close`
// backstop, and `clean_runs`' fs/git removal all stay in the spine.

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

/** The slice-state enum, mirrored from render.ts's `sliceStateEnum`. */
const sliceStateEnum = z.enum([
  "pending",
  "in-progress",
  "passed",
  "failed",
  "skipped",
]);

/** One slice's verdict-relevant fields, parsed defensively. */
const cleanupSliceSchema = z.object({
  issue: z
    .number()
    .int()
    .describe("The slice's GitHub issue number."),
  state: sliceStateEnum.describe(
    "The slice's terminal state. Only `passed` slices join a merged run's " +
      "close-set; `failed`/`skipped`/`pending`/`in-progress` are excluded."
  ),
});

/**
 * One enumerated run as the orchestrator parsed it from
 * `.orchestrate/runs/<runId>/run-state.json`. The spine reads these fields; this
 * tool never reads them from disk.
 */
const parsedRunSchema = z.object({
  runId: z.string().describe("The run's timestamp id (its directory name)."),
  status: z
    .string()
    .describe(
      "The run's `status` field — `in-progress` or `completed`. A run that is " +
        "not `completed` is omitted from phase one's eligible set."
    ),
  finalPullRequest: z
    .string()
    .nullable()
    .describe(
      "The run's final integration pull-request identifier, or null if it has " +
        "none yet. A run with a null `finalPullRequest` is omitted from phase " +
        "one's eligible set (it has not concluded)."
    ),
  slices: z
    .array(cleanupSliceSchema)
    .describe(
      "The run's slices, normalized to an array. Used only in phase two to " +
        "build a merged run's close-set; omit or pass [] in phase one."
    )
    .optional(),
});

/**
 * One fetched merge fact: the run, its final-PR identifier, and the `state` /
 * `mergedAt` the spine read with `gh pr view`. A malformed, missing, or
 * unexpected fact classifies to `unknown` — never a throw.
 */
const mergeFactSchema = z.object({
  runId: z.string().describe("The run's timestamp id (its directory name)."),
  finalPullRequest: z
    .string()
    .describe(
      "The final-PR identifier the spine looked up. Echoed back from phase one."
    ),
  state: z
    .string()
    .nullable()
    .optional()
    .describe(
      "The PR `state` from `gh pr view` — typically `MERGED`, `OPEN`, or " +
        "`CLOSED`. Any other, missing, or null value classifies to `unknown`."
    ),
  mergedAt: z
    .string()
    .nullable()
    .optional()
    .describe(
      "The PR `mergedAt` timestamp from `gh pr view`, or null when unmerged. " +
        "`MERGED` with a null `mergedAt`, or `CLOSED` with a non-null " +
        "`mergedAt`, is a malformed fact and classifies to `unknown`."
    ),
  slices: z
    .array(cleanupSliceSchema)
    .describe(
      "The run's slices, normalized to an array — the source of the close-set " +
        "for a run that classifies `merged`. Omit or pass [] for a run that " +
        "cannot be merged."
    )
    .optional(),
});

export const resolveCleanupVerdictsInputSchema = z.object({
  phase: z
    .enum(["enumerate", "classify"])
    .describe(
      "Which half of the two-phase sweep to run. 'enumerate' (phase one) " +
        "ingests parsed run-states, applies the eligibility gate, and returns " +
        "the DEDUPLICATED final-PR identifiers the spine then fetches with " +
        "`gh pr view`. 'classify' (phase two) ingests the fetched " +
        "`{state, mergedAt}` facts and returns the verdict map `clean_runs` " +
        "consumes, plus each merged run's close-set."
    ),
  runs: z
    .array(parsedRunSchema)
    .optional()
    .describe(
      "Phase one only: the enumerated parsed run-states. Each carries its " +
        "`runId`, `status`, `finalPullRequest`, and (optionally) `slices`. " +
        "Ignored when phase='classify'."
    ),
  facts: z
    .array(mergeFactSchema)
    .optional()
    .describe(
      "Phase two only: the fetched merge facts, one per final-PR the spine " +
        "looked up. Each carries the `runId`, `finalPullRequest`, the fetched " +
        "`state`/`mergedAt`, and the run's `slices`. Ignored when " +
        "phase='enumerate'."
    ),
});

/** One eligible run's final-PR lookup request, returned by phase one. */
export const eligibleRunSchema = z.object({
  runId: z.string().describe("The eligible run's id."),
  finalPullRequest: z
    .string()
    .describe(
      "The run's final-PR identifier — the argument the spine passes to " +
        "`gh pr view <id> --json state,mergedAt`."
    ),
});

/** One run's resolved verdict and (for a merged run) its close-set. */
export const runVerdictEntrySchema = z.object({
  runId: z.string().describe("The classified run's id."),
  verdict: runVerdictSchema.describe(
    "The four-way merge verdict `clean_runs` consumes: 'merged' (the only " +
      "verdict that triggers cleanup), 'open', 'closed-unmerged', or " +
      "'unknown' (a malformed, missing, or unexpected fact)."
  ),
  closeSetIssues: z
    .array(z.number().int())
    .describe(
      "For a `merged` run, the issue numbers of exactly its `passed` slices — " +
        "the close-set the spine closes with `gh issue close <N>` after the " +
        "sweep. Empty for any non-`merged` verdict (no close-set is collected)."
    ),
});

export const resolveCleanupVerdictsOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the phase ran; 'error' = the input did " +
        "not match the requested phase (e.g. a missing `runs`/`facts` array)."
    ),
  finalPullRequests: z
    .array(z.string())
    .optional()
    .describe(
      "Phase one: the DEDUPLICATED final-PR identifiers to fetch, in " +
        "first-seen order. Present when status='ok' and phase='enumerate'."
    ),
  eligibleRuns: z
    .array(eligibleRunSchema)
    .optional()
    .describe(
      "Phase one: the eligible runs paired with their final-PR identifiers, " +
        "in input order (NOT deduplicated — two runs may share a final PR, " +
        "though that is degenerate). Present when status='ok' and " +
        "phase='enumerate'. Lets the spine map a fetched fact back to its run."
    ),
  verdicts: z
    .array(runVerdictEntrySchema)
    .optional()
    .describe(
      "Phase two: one verdict entry per fact, in input order. Present when " +
        "status='ok' and phase='classify'. The spine collapses these into the " +
        "`Record<runId, verdict>` map `clean_runs` ingests."
    ),
  errorCode: z
    .enum(["INVALID_INPUT"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Human-readable failure description. Present when status='error'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type ResolveCleanupVerdictsInput = z.infer<
  typeof resolveCleanupVerdictsInputSchema
>;
export type ResolveCleanupVerdictsOutput = z.infer<
  typeof resolveCleanupVerdictsOutputSchema
>;
export type EligibleRun = z.infer<typeof eligibleRunSchema>;
export type RunVerdictEntry = z.infer<typeof runVerdictEntrySchema>;

type ParsedRun = z.infer<typeof parsedRunSchema>;
type MergeFact = z.infer<typeof mergeFactSchema>;
type CleanupSlice = z.infer<typeof cleanupSliceSchema>;
type RunVerdict = z.infer<typeof runVerdictSchema>;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * The cleanup-eligibility gate, mirroring `checkCrossRunMutationAllowed`'s GitHub
 * half: a run is eligible for a `gh pr view` lookup only when its `status` is
 * exactly `"completed"` AND its `finalPullRequest` is non-null. `!= null` catches
 * both `null` and `undefined`.
 */
function isEligible(run: ParsedRun): boolean {
  return run.status === "completed" && run.finalPullRequest != null;
}

/**
 * Classifies one fetched `{state, mergedAt}` fact into the four-way verdict.
 * Every cell is explicit; anything that does not match a known-good cell —
 * a missing/null/unexpected `state`, a `MERGED` with a null `mergedAt`, a
 * `CLOSED` with a non-null `mergedAt` — falls through to `unknown`. Never throws.
 */
function classifyFact(state: unknown, mergedAt: unknown): RunVerdict {
  // MERGED requires a non-null mergedAt; a MERGED-but-unmerged fact is malformed.
  if (state === "MERGED") {
    return typeof mergedAt === "string" && mergedAt.length > 0
      ? "merged"
      : "unknown";
  }
  // OPEN is open regardless of mergedAt (an open PR has no merge timestamp).
  if (state === "OPEN") {
    return "open";
  }
  // CLOSED requires a null/absent mergedAt; a CLOSED-with-mergedAt fact is
  // malformed (a merged PR reports MERGED, not CLOSED).
  if (state === "CLOSED") {
    return mergedAt == null ? "closed-unmerged" : "unknown";
  }
  // Any other, missing, or null state — the verdict could not be determined.
  return "unknown";
}

/**
 * The close-set of a merged run: the issue numbers of EXACTLY its `passed`
 * slices, in slice order. A `failed`/`skipped`/`pending`/`in-progress` slice is
 * excluded. A malformed/absent `slices` array yields an empty close-set.
 */
function closeSetOf(slices: CleanupSlice[] | undefined): number[] {
  if (!Array.isArray(slices)) {
    return [];
  }
  const out: number[] = [];
  for (const slice of slices) {
    if (slice.state === "passed") {
      out.push(slice.issue);
    }
  }
  return out;
}

// ─── resolve_cleanup_verdicts ──────────────────────────────────────────────────

/**
 * Resolves the start-of-run cleanup sweep's verdict logic in two pure phases.
 * Never throws — a phase/input mismatch is a structured `error` result.
 *
 * Phase 'enumerate': applies the eligibility gate to the parsed `runs`, omitting
 * any non-`completed` or null-final-PR run, and returns the DEDUPLICATED
 * final-PR identifiers (first-seen order) the spine fetches with `gh pr view`,
 * plus the eligible runs paired with their final PRs.
 *
 * Phase 'classify': classifies each fetched `{state, mergedAt}` fact into the
 * four-way verdict and, for every `merged` run, captures its `closeSetIssues`
 * (the issue numbers of its `passed` slices) in the same pass.
 */
export function resolveCleanupVerdicts(
  input: ResolveCleanupVerdictsInput
): ResolveCleanupVerdictsOutput {
  if (input.phase === "enumerate") {
    const runs = input.runs;
    if (runs === undefined) {
      return {
        status: "error",
        errorCode: "INVALID_INPUT",
        errorMessage:
          "phase='enumerate' requires a `runs` array of parsed run-states.",
      };
    }

    const eligibleRuns: EligibleRun[] = [];
    const seen = new Set<string>();
    const finalPullRequests: string[] = [];

    for (const run of runs) {
      if (!isEligible(run)) {
        continue;
      }
      // isEligible guarantees finalPullRequest is non-null here.
      const finalPr = run.finalPullRequest as string;
      eligibleRuns.push({ runId: run.runId, finalPullRequest: finalPr });
      // Deduplicate the lookup list, preserving first-seen order so the spine's
      // fetch loop is deterministic. The per-run `eligibleRuns` list is NOT
      // deduplicated — every run still needs its own verdict.
      if (!seen.has(finalPr)) {
        seen.add(finalPr);
        finalPullRequests.push(finalPr);
      }
    }

    return { status: "ok", finalPullRequests, eligibleRuns };
  }

  // phase === "classify"
  const facts = input.facts;
  if (facts === undefined) {
    return {
      status: "error",
      errorCode: "INVALID_INPUT",
      errorMessage:
        "phase='classify' requires a `facts` array of fetched merge facts.",
    };
  }

  const verdicts: RunVerdictEntry[] = facts.map((fact: MergeFact) => {
    const verdict = classifyFact(fact.state, fact.mergedAt);
    // Only a merged run carries a close-set; every other verdict gets [].
    const closeSetIssues = verdict === "merged" ? closeSetOf(fact.slices) : [];
    return { runId: fact.runId, verdict, closeSetIssues };
  });

  return { status: "ok", verdicts };
}
