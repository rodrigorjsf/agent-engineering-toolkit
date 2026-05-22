import { z } from "zod";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

/**
 * Zod schema for a single issue in the fetched `ready-for-agent` backlog.
 * Each issue carries its parsed `Blocked by` and `Parent` sections — numbers
 * only, already extracted from the GitHub issue body by the caller.
 */
export const backlogIssueSchema = z.object({
  number: z
    .number()
    .int()
    .positive()
    .describe("GitHub issue number."),
  title: z
    .string()
    .min(1)
    .describe("Issue title, verbatim from GitHub."),
  blockedBy: z
    .array(z.number().int().positive())
    .describe(
      "Issue numbers this issue is blocked by — the parsed 'Blocked by' " +
        "section of the issue body (`- #NNN` lines). Empty array when the " +
        "section is absent or has no entries."
    ),
  parent: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe(
      "The issue number named in the 'Parent' section of this issue's body " +
        "(the `PRD #NNN` line), or null when no parent is declared."
    ),
});

/** TypeScript type inferred from the Zod schema. */
export type BacklogIssue = z.infer<typeof backlogIssueSchema>;

// ─── partition_backlog MCP tool schemas ───────────────────────────────────────

export const partitionBacklogInputSchema = z.object({
  issues: z
    .array(backlogIssueSchema)
    .describe(
      "The full ready-for-agent backlog. Each issue carries its parsed " +
        "Blocked by and Parent sections."
    ),
});

export const partitionBacklogOutputSchema = z.object({
  slices: z
    .array(backlogIssueSchema)
    .describe(
      "Issues to process as implementation slices, in the same order they " +
        "appeared in the input. The parent PRD (if any) is excluded."
    ),
  parentIssue: backlogIssueSchema
    .nullable()
    .describe(
      "The detected parent PRD issue, or null when none was detected. " +
        "This is only the progress-comment target — it is never implemented " +
        "as a slice."
    ),
});

/** TypeScript input type inferred from the Zod schema. */
export type PartitionBacklogInput = z.infer<typeof partitionBacklogInputSchema>;

/** TypeScript output type inferred from the Zod schema. */
export type PartitionBacklogOutput = z.infer<
  typeof partitionBacklogOutputSchema
>;

// ─── filter_to_one_parent_prd MCP tool schemas ────────────────────────────────

export const filterToOneParentPrdInputSchema = z.object({
  issues: z
    .array(backlogIssueSchema)
    .describe("The full backlog to filter."),
  prdNumber: z
    .number()
    .int()
    .positive()
    .describe(
      "The issue number of the parent PRD whose children are requested."
    ),
});

export const filterToOneParentPrdOutputSchema = z.object({
  issues: z
    .array(backlogIssueSchema)
    .describe(
      "The subset of issues whose parent field equals prdNumber, in input " +
        "order. The parent PRD issue itself is excluded."
    ),
});

/** TypeScript input type inferred from the Zod schema. */
export type FilterToOneParentPrdInput = z.infer<
  typeof filterToOneParentPrdInputSchema
>;

/** TypeScript output type inferred from the Zod schema. */
export type FilterToOneParentPrdOutput = z.infer<
  typeof filterToOneParentPrdOutputSchema
>;

// ─── BacklogPartition convenience type ───────────────────────────────────────

/**
 * The result of partitioning the backlog.
 *
 * - `slices` — the issues that should be processed as implementation slices,
 *   in the same order they appeared in the input. The parent PRD (if any) is
 *   excluded.
 * - `parentIssue` — the detected parent PRD issue, or `null` when none was
 *   detected. This is only the progress-comment target — it is never
 *   implemented as a slice.
 */
export type BacklogPartition = PartitionBacklogOutput;

// ─── PRD title heuristic ───────────────────────────────────────────────────────

/**
 * Returns `true` when the issue title matches the `PRD:` prefix heuristic
 * (case-insensitive). Used as a secondary signal when no issue explicitly
 * names another backlog issue as its parent.
 */
function hasPrdTitlePrefix(title: string): boolean {
  return /^prd\s*:/i.test(title.trim());
}

// ─── partitionBacklog ─────────────────────────────────────────────────────────

/**
 * Turns the fetched `ready-for-agent` backlog into the run's `slices` set and
 * resolved `parentIssue`. Pure — no I/O. Never throws.
 *
 * Detection order:
 * 1. **Parent-field reference** — if any issue's `parent` field names another
 *    backlog issue's number, that issue is the parent PRD.
 * 2. **PRD title heuristic** — if no parent-field reference exists, any issue
 *    whose title starts with `PRD:` (case-insensitive) is treated as the
 *    parent PRD.
 *
 * The detected parent PRD is excluded from `slices`. If no parent is detected,
 * `parentIssue` is `null` and all issues are returned as slices.
 */
export function partitionBacklog(issues: BacklogIssue[]): BacklogPartition {
  if (issues.length === 0) {
    return { slices: [], parentIssue: null };
  }

  // Build a lookup by issue number for fast resolution.
  const byNumber = new Map<number, BacklogIssue>();
  for (const issue of issues) {
    byNumber.set(issue.number, issue);
  }

  // ── Signal 1: parent-field reference ──────────────────────────────────────
  // Collect every issue number that appears as another issue's `.parent`.
  // We only consider references to issues that are themselves in the backlog.
  const referencedAsParent = new Set<number>();
  for (const issue of issues) {
    if (issue.parent !== null && byNumber.has(issue.parent)) {
      referencedAsParent.add(issue.parent);
    }
  }

  if (referencedAsParent.size > 0) {
    // Use the first referenced parent in input order.
    const parentIssue =
      issues.find((i) => referencedAsParent.has(i.number)) ?? null;
    const parentNumber = parentIssue?.number ?? -1;
    return {
      parentIssue,
      slices: issues.filter((i) => i.number !== parentNumber),
    };
  }

  // ── Signal 2: PRD title heuristic ─────────────────────────────────────────
  const prdByTitle = issues.find((i) => hasPrdTitlePrefix(i.title));
  if (prdByTitle) {
    return {
      parentIssue: prdByTitle,
      slices: issues.filter((i) => i.number !== prdByTitle.number),
    };
  }

  // ── No parent detected ────────────────────────────────────────────────────
  return { slices: issues, parentIssue: null };
}

// ─── filterToOneParentPrd ─────────────────────────────────────────────────────

/**
 * Filters a backlog to the subset of issues whose `parent` field equals
 * `prdNumber`. The parent PRD issue itself is excluded from the result — only
 * its child slices are returned, in input order.
 *
 * This function is the single canonical answer for "/orchestrate <PRD#>" runs:
 * a later skill slice calls it to narrow the whole backlog to one PRD's
 * children.
 *
 * Pure — no I/O. Never throws.
 */
export function filterToOneParentPrd(
  issues: BacklogIssue[],
  prdNumber: number
): BacklogIssue[] {
  return issues.filter(
    (i) => i.parent === prdNumber && i.number !== prdNumber
  );
}
