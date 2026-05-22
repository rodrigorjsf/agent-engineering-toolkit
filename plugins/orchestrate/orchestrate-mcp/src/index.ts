#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { z } from "zod";
import {
  createWorktree,
  removeWorktree,
  createWorktreeInputSchema,
  removeWorktreeInputSchema,
  createWorktreeOutputSchema,
  removeWorktreeOutputSchema,
  type CreateWorktreeInput,
  type RemoveWorktreeInput,
} from "./tools/worktree.js";
import {
  runTests,
  runTypecheck,
  runBuild,
  runLint,
  runCommandInputSchema,
  runCommandOutputSchema,
  type RunCommandInput,
  type RunCommandOutput,
} from "./tools/run-command.js";
import {
  planWaves,
  planWavesInputSchema,
  planWavesOutputSchema,
  type PlanWavesInput,
  type PlanWavesOutput,
} from "./tools/plan-waves.js";
import {
  resolveRoutingFromConfig,
  resolveRoutingInputSchema,
  resolveRoutingOutputSchema,
  type ResolveRoutingInput,
  type ResolveRoutingOutput,
} from "./tools/routing.js";
import {
  renderDashboardArtifact,
  renderGraphArtifact,
  renderReportArtifact,
  renderInputSchema,
  renderOutputSchema,
  type RenderInput,
  type RenderOutput,
} from "./tools/render.js";
import {
  spawnSuccessor,
  spawnSuccessorInputSchema,
  spawnSuccessorOutputSchema,
  type SpawnSuccessorInput,
  type SpawnSuccessorOutput,
} from "./tools/spawn-successor.js";
import {
  searchStructural,
  searchStructuralInputSchema,
  searchStructuralOutputSchema,
  type SearchStructuralInput,
  type SearchStructuralOutput,
} from "./tools/search-structural.js";
import {
  partitionBacklog,
  filterToOneParentPrd,
  partitionBacklogInputSchema,
  partitionBacklogOutputSchema,
  filterToOneParentPrdInputSchema,
  filterToOneParentPrdOutputSchema,
  type PartitionBacklogInput,
  type PartitionBacklogOutput,
  type FilterToOneParentPrdInput,
  type FilterToOneParentPrdOutput,
} from "./tools/backlog-partitioner.js";
import {
  validateEnvelope,
  validateEnvelopeInputSchema,
  validateEnvelopeOutputSchema,
  type ValidateEnvelopeInput,
  type ValidateEnvelopeOutput,
} from "./tools/validate-envelope.js";
import {
  recoverChangedFiles,
  recoverChangedFilesInputSchema,
  recoverChangedFilesOutputSchema,
  type RecoverChangedFilesInput,
  type RecoverChangedFilesOutput,
} from "./tools/recover-changed-files.js";
import {
  verifyChangeset,
  verifyChangesetInputSchema,
  verifyChangesetOutputSchema,
  type VerifyChangesetInput,
  type VerifyChangesetOutput,
} from "./tools/verify-changeset.js";

const server = new McpServer({
  name: "orchestrate",
  version: "0.12.0",
});

/**
 * SDK-boundary type for a tool handler.
 *
 * Used to keep each handler implementation fully typed against its own
 * input/output contract before it is registered. `TResult` is the tool's
 * `z.infer`-derived output type — a plain object, not necessarily a
 * `Record<string, unknown>`; it is widened at the registration boundary.
 */
type ToolHandler<TInput, TResult> = (
  input: TInput
) => Promise<{
  structuredContent: TResult;
  content: { type: "text"; text: string }[];
}>;

/**
 * Minimal, non-recursive signature for `McpServer.registerTool`.
 *
 * The SDK's real `registerTool` generic derives the handler argument type via
 * its zod-compat layer (`ShapeOutput` -> `SchemaOutput` -> `z3.infer`). With
 * MCP SDK 1.29 that conditional chain trips TS2589 ("Type instantiation is
 * excessively deep") whenever an `outputSchema` is supplied as a raw Zod
 * shape — a known limitation of the SDK's generics, not of this code.
 *
 * Casting `server.registerTool` to this flat signature once (rather than per
 * call site) confines the workaround to a single SDK boundary. The schemas
 * are still passed through unchanged and are validated at runtime by the SDK;
 * only the compile-time generic inference is bypassed.
 */
type ToolConfig = {
  title?: string;
  description?: string;
  inputSchema?: Record<string, z.ZodTypeAny>;
  outputSchema?: Record<string, z.ZodTypeAny>;
};

type AnyToolHandler = (input: Record<string, unknown>) => Promise<{
  structuredContent: Record<string, unknown>;
  content: { type: "text"; text: string }[];
}>;

type RegisterTool = (
  name: string,
  config: ToolConfig,
  handler: AnyToolHandler
) => unknown;

const registerTool = server.registerTool.bind(server) as RegisterTool;

// ─── create_worktree ──────────────────────────────────────────────────────────

const handleCreateWorktree: ToolHandler<
  CreateWorktreeInput,
  Awaited<ReturnType<typeof createWorktree>>
> = async (input) => {
  const result = await createWorktree(input);
  let text: string;
  if (result.status === "ok") {
    const fetchNote =
      result.fetchStatus === "failed"
        ? ` (fetch failed: ${result.fetchError})`
        : result.fetchStatus === "skipped-no-remote"
          ? " (fetch skipped — no remote)"
          : "";
    text = `Worktree created at ${result.path} on branch ${result.branch}${fetchNote}`;
  } else {
    text = `Failed to create worktree [${result.errorCode}]: ${result.errorMessage}`;
  }
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "create_worktree",
  {
    title: "Create Git Worktree",
    description:
      "Creates a new git worktree branched from a caller-supplied base ref. " +
      "Attempts 'git fetch' before branching; the fetch outcome is reported " +
      "in `fetchStatus` (never silently swallowed). Returns a discriminated " +
      "`status` of 'ok' or 'error'.",
    inputSchema: createWorktreeInputSchema.shape,
    outputSchema: createWorktreeOutputSchema.shape,
  },
  // Handlers are typed against their concrete input/output contracts above;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handleCreateWorktree as unknown as AnyToolHandler
);

// ─── remove_worktree ──────────────────────────────────────────────────────────

const handleRemoveWorktree: ToolHandler<
  RemoveWorktreeInput,
  Awaited<ReturnType<typeof removeWorktree>>
> = async (input) => {
  const result = await removeWorktree(input);
  let text: string;
  if (result.status === "ok") {
    text = `Worktree removed: ${result.removedPath}`;
  } else if (result.status === "refused") {
    text =
      `Removal refused — ${result.refusalReason} ` +
      `Dirty files: ${result.dirtyFiles?.join(", ")}.`;
  } else {
    text = `Failed to remove worktree [${result.errorCode}]: ${result.errorMessage}`;
  }
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "remove_worktree",
  {
    title: "Remove Git Worktree",
    description:
      "Removes a git worktree. It must be a registered worktree root. By " +
      "default a worktree with uncommitted or untracked changes is refused " +
      "(status='refused') and left intact; pass force=true to remove it " +
      "anyway. The associated branch is NOT deleted — the caller is " +
      "responsible for branch cleanup.",
    inputSchema: removeWorktreeInputSchema.shape,
    outputSchema: removeWorktreeOutputSchema.shape,
  },
  // Handlers are typed against their concrete input/output contracts above;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handleRemoveWorktree as unknown as AnyToolHandler
);

// ─── run_tests / run_typecheck / run_build / run_lint ─────────────────────────
// Four fixed-capability executors. Each runs the argv configured for its verb
// in `.orchestrate/commands.json`; the caller selects the capability by
// choosing the tool, never by passing a command string.

function summarizeRun(r: RunCommandOutput): string {
  switch (r.status) {
    case "passed":
      return `${r.capability} passed (exit 0, ${r.durationMs} ms).`;
    case "failed":
      return `${r.capability} failed (exit ${r.exitCode}, ${r.durationMs} ms).`;
    case "not-configured":
      return `${r.capability} is not configured: ${r.reason}`;
    case "error":
      return `${r.capability} could not run [${r.errorCode}]: ${r.errorMessage}`;
  }
}

const handleRun = (
  run: (input: RunCommandInput) => Promise<RunCommandOutput>
): ToolHandler<RunCommandInput, RunCommandOutput> => {
  return async (input) => {
    const result = await run(input);
    return {
      structuredContent: result,
      content: [{ type: "text" as const, text: summarizeRun(result) }],
    };
  };
};

const RUN_TOOLS: {
  name: string;
  title: string;
  verb: string;
  run: (input: RunCommandInput) => Promise<RunCommandOutput>;
}[] = [
  { name: "run_tests", title: "Run Tests", verb: "tests", run: runTests },
  {
    name: "run_typecheck",
    title: "Run Typecheck",
    verb: "typecheck",
    run: runTypecheck,
  },
  { name: "run_build", title: "Run Build", verb: "build", run: runBuild },
  { name: "run_lint", title: "Run Lint", verb: "lint", run: runLint },
];

for (const tool of RUN_TOOLS) {
  registerTool(
    tool.name,
    {
      title: tool.title,
      description:
        `Runs the project's "${tool.verb}" command exactly as configured in ` +
        `.orchestrate/commands.json. The command is a fixed argv array read ` +
        `from that file — this tool never accepts a command string from the ` +
        `caller. Returns a discriminated status: 'passed' (exit 0), 'failed' ` +
        `(non-zero exit), 'not-configured' (no "${tool.verb}" command set), ` +
        `or 'error' (invalid config, timeout, or spawn failure).`,
      inputSchema: runCommandInputSchema.shape,
      outputSchema: runCommandOutputSchema.shape,
    },
    // Handlers are typed against their concrete input/output contracts;
    // widen to the flat SDK-boundary `AnyToolHandler` for registration.
    handleRun(tool.run) as unknown as AnyToolHandler
  );
}

// ─── plan_waves ────────────────────────────────────────────────────────────────

const handlePlanWaves: ToolHandler<PlanWavesInput, PlanWavesOutput> = async (
  input
) => {
  const result = planWaves(input);
  let text: string;
  if (result.status === "ok") {
    const total = result.waves!.reduce((n, w) => n + w.length, 0);
    text = `Planned ${result.waves!.length} wave(s) for ${total} issue(s).`;
  } else {
    text = `Wave planning failed [${result.errorCode}]: ${result.errorMessage}`;
  }
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "plan_waves",
  {
    title: "Plan Dependency Waves",
    description:
      "Groups a set of issues into dependency-ordered waves. Each issue " +
      "carries the ids of the issues that block it; the tool topologically " +
      "sorts them so every issue's blockers resolve in an earlier wave. " +
      "Blockers outside the input set are treated as already satisfied. A " +
      "dependency cycle is returned as a structured 'error' with errorCode " +
      "'CYCLE_DETECTED', never a hang.",
    inputSchema: planWavesInputSchema.shape,
    outputSchema: planWavesOutputSchema.shape,
  },
  // Handler is typed against its concrete input/output contract;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handlePlanWaves as unknown as AnyToolHandler
);

// ─── resolve_routing ──────────────────────────────────────────────────────────

const handleResolveRouting: ToolHandler<
  ResolveRoutingInput,
  ResolveRoutingOutput
> = async (input) => {
  const result = resolveRoutingFromConfig(input);
  let text: string;
  if (result.status === "ok") {
    const r = result.routing!;
    const inv = r.investigator
      ? `investigator ${r.investigator.effort}`
      : "no investigator";
    text =
      `Routing for tier '${result.tier}': ${inv}, ` +
      `implementer ${r.implementer.effort}/${r.implementer.model}, ` +
      `reviewer ${r.reviewer.effort}/${r.reviewer.model}.`;
  } else {
    text = `Routing resolution failed [${result.errorCode}]: ${result.errorMessage}`;
  }
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "resolve_routing",
  {
    title: "Resolve Complexity Routing",
    description:
      "Resolves which model and effort variant to spawn for each role — " +
      "investigator, implementer, reviewer, conflict-resolver — given an " +
      "issue's assessed complexity tier. Reads the tier-to-role mapping from " +
      ".orchestrate/routing.json. A null investigator means that tier skips " +
      "the investigation pass. Returns a discriminated `status` of 'ok' or " +
      "'error' (routing.json missing or malformed).",
    inputSchema: resolveRoutingInputSchema.shape,
    outputSchema: resolveRoutingOutputSchema.shape,
  },
  // Handler is typed against its concrete input/output contract;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handleResolveRouting as unknown as AnyToolHandler
);

// ─── render_dashboard / render_graph / render_report ─────────────────────────
// Three HTML-rendering tools. Each reads the run-state.json under the per-run
// directory .orchestrate/runs/<runId>/, generates a deterministic HTML
// artifact, writes it back into that same run directory, and returns only the
// artifact path — no HTML is returned in the tool response.

const RENDER_TOOLS: {
  name: string;
  title: string;
  description: string;
  run: (input: RenderInput) => Promise<RenderOutput>;
}[] = [
  {
    name: "render_dashboard",
    title: "Render Run Dashboard",
    description:
      "Reads run-state.json from the per-run directory .orchestrate/runs/<runId>/ " +
      "and writes a standalone HTML dashboard into it showing the live run " +
      "state: run id, status, wave progress, and a color-coded slice table. " +
      "Requires a `runId`. Returns only the artifact path — the HTML is " +
      "written to disk, never returned in the response.",
    run: renderDashboardArtifact,
  },
  {
    name: "render_graph",
    title: "Render Dependency Graph",
    description:
      "Reads run-state.json from the per-run directory .orchestrate/runs/<runId>/ " +
      "and writes a standalone HTML dependency graph into it: waves as columns, " +
      "slices as nodes, blockedBy edges as SVG lines. Layout is deterministic " +
      "(x = wave index, y = slice index in wave). Requires a `runId`. Returns " +
      "only the artifact path.",
    run: renderGraphArtifact,
  },
  {
    name: "render_report",
    title: "Render Run Report",
    description:
      "Reads run-state.json from the per-run directory .orchestrate/runs/<runId>/ " +
      "and writes a standalone HTML final report into it: run duration, outcome " +
      "counts (passed/failed/skipped), the final pull request link, and a " +
      "per-slice outcome table. Requires a `runId`. Returns only the artifact " +
      "path.",
    run: renderReportArtifact,
  },
];

for (const tool of RENDER_TOOLS) {
  const handle: ToolHandler<RenderInput, RenderOutput> = async (input) => {
    const result = await tool.run(input);
    const text =
      result.status === "ok"
        ? `Artifact written to ${result.artifactPath}`
        : `Render failed [${result.errorCode}]: ${result.errorMessage}`;
    return {
      structuredContent: result,
      content: [{ type: "text" as const, text }],
    };
  };

  registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: renderInputSchema.shape,
      outputSchema: renderOutputSchema.shape,
    },
    // Handler is typed against its concrete input/output contract;
    // widen to the flat SDK-boundary `AnyToolHandler` for registration.
    handle as unknown as AnyToolHandler
  );
}

// ─── spawn_successor ──────────────────────────────────────────────────────────

const handleSpawnSuccessor: ToolHandler<
  SpawnSuccessorInput,
  SpawnSuccessorOutput
> = async (input) => {
  const result = await spawnSuccessor(input);
  let text: string;
  if (result.status === "ok") {
    text = `Successor session launched via ${result.terminal}.`;
  } else {
    text = `Failed to launch successor [${result.errorCode}]: ${result.errorMessage}`;
  }
  if (result.configWarning) {
    text += ` (${result.configWarning})`;
  }
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "spawn_successor",
  {
    title: "Spawn Successor Session",
    description:
      "Launches a fresh interactive Claude Code session that resumes an " +
      "interrupted orchestration run from its run-state.json checkpoint " +
      "(under the per-run directory .orchestrate/runs/<runId>/), then the " +
      "predecessor exits. The successor opens in a new terminal window with " +
      "Remote Control active and re-invokes /orchestrate — never print mode — " +
      "which re-discovers the active run. The terminal fallback chain and " +
      "claude flags are configured in .orchestrate/handoff.json; built-in " +
      "defaults target a WSL2 environment. Returns a discriminated `status` " +
      "of 'ok' or 'error'.",
    inputSchema: spawnSuccessorInputSchema.shape,
    outputSchema: spawnSuccessorOutputSchema.shape,
  },
  // Handler is typed against its concrete input/output contract;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handleSpawnSuccessor as unknown as AnyToolHandler
);

// ─── search_structural ────────────────────────────────────────────────────────

const handleSearchStructural: ToolHandler<
  SearchStructuralInput,
  SearchStructuralOutput
> = async (input) => {
  const result = await searchStructural(input);
  let text: string;
  if (result.status === "ok") {
    text =
      `Structural search found ${result.matchCount} match(es)` +
      (result.truncated ? ` (capped — more exist)` : "") +
      ".";
  } else if (result.status === "unavailable") {
    text =
      "Structural search is unavailable — ast-grep is not installed. " +
      "Fall back to text search.";
  } else {
    text = `Structural search failed [${result.errorCode}]: ${result.errorMessage}`;
  }
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "search_structural",
  {
    title: "Structural Code Search",
    description:
      "Syntax-aware code search powered by the ast-grep CLI — matches code by " +
      "structure (an ast-grep pattern with metavariables), not text. Returns a " +
      "discriminated `status`: 'ok' (search ran), 'unavailable' (ast-grep is " +
      "not installed — the caller should fall back to text search), or 'error' " +
      "(ast-grep ran but the search failed, e.g. an invalid pattern).",
    inputSchema: searchStructuralInputSchema.shape,
    outputSchema: searchStructuralOutputSchema.shape,
  },
  // Handler is typed against its concrete input/output contract;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handleSearchStructural as unknown as AnyToolHandler
);

// ─── partition_backlog ────────────────────────────────────────────────────────

const handlePartitionBacklog: ToolHandler<
  PartitionBacklogInput,
  PartitionBacklogOutput
> = async (input) => {
  const result = partitionBacklog(input.issues);
  const sliceCount = result.slices.length;
  const parentNote = result.parentIssue
    ? ` Parent PRD is issue #${result.parentIssue.number}.`
    : " No parent PRD detected.";
  const text = `Partitioned backlog into ${sliceCount} slice(s).${parentNote}`;
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "partition_backlog",
  {
    title: "Partition Backlog",
    description:
      "Splits the ready-for-agent backlog into implementation slices and an " +
      "optional parent PRD issue. The parent PRD is detected by two signals in " +
      "order: (1) parent-field reference — if any issue names another backlog " +
      "issue as its parent, that issue is the parent PRD; (2) PRD: title " +
      "heuristic — if no explicit parent reference exists, any issue whose " +
      "title starts with 'PRD:' (case-insensitive) is treated as the parent " +
      "PRD. The detected parent PRD is excluded from slices and surfaced as " +
      "parentIssue. If no parent is detected, parentIssue is null and all " +
      "issues are returned as slices.",
    inputSchema: partitionBacklogInputSchema.shape,
    outputSchema: partitionBacklogOutputSchema.shape,
  },
  // Handler is typed against its concrete input/output contract;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handlePartitionBacklog as unknown as AnyToolHandler
);

// ─── filter_to_one_parent_prd ─────────────────────────────────────────────────

const handleFilterToOneParentPrd: ToolHandler<
  FilterToOneParentPrdInput,
  FilterToOneParentPrdOutput
> = async (input) => {
  const filtered = filterToOneParentPrd(input.issues, input.prdNumber);
  const text = `Filtered to ${filtered.length} issue(s) whose parent is #${input.prdNumber}.`;
  return {
    structuredContent: { issues: filtered },
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "filter_to_one_parent_prd",
  {
    title: "Filter Backlog to One Parent PRD",
    description:
      "Narrows the full backlog to only the issues whose parent field equals " +
      "prdNumber. The parent PRD issue itself is excluded from the result — " +
      "only its child slices are returned, in input order. Use this before " +
      "calling partition_backlog when the run is scoped to a single PRD " +
      "(e.g. /orchestrate <PRD#>).",
    inputSchema: filterToOneParentPrdInputSchema.shape,
    outputSchema: filterToOneParentPrdOutputSchema.shape,
  },
  // Handler is typed against its concrete input/output contract;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handleFilterToOneParentPrd as unknown as AnyToolHandler
);

// ─── validate_envelope ────────────────────────────────────────────────────────

const handleValidateEnvelope: ToolHandler<
  ValidateEnvelopeInput,
  ValidateEnvelopeOutput
> = async (input) => {
  const result = validateEnvelope(input);
  let text: string;
  if (result.status === "valid") {
    text = `Valid ${result.role} envelope.`;
  } else if (result.status === "invalid") {
    text = `Invalid ${result.role} envelope [${result.errorCode}]: ${result.errorMessage}`;
  } else {
    text = `Missing ${result.role} envelope: ${result.errorMessage}`;
  }
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "validate_envelope",
  {
    title: "Validate Subagent Result Envelope",
    description:
      "Validates a subagent's result envelope — the ```orchestrate-envelope " +
      "fenced JSON block a subagent emits as its final message — against the " +
      "defined schema for its role. Returns a discriminated `status`: 'valid' " +
      "(a well-formed envelope matching the role, with the parsed `envelope`), " +
      "'invalid' (an envelope was attempted but is truncated, malformed, or " +
      "off-schema — a truncated envelope is ALWAYS invalid, never silently " +
      "accepted), or 'missing' (no envelope block was found). The orchestrator " +
      "uses this instead of parsing subagent prose for status or changed files.",
    inputSchema: validateEnvelopeInputSchema.shape,
    outputSchema: validateEnvelopeOutputSchema.shape,
  },
  // Handler is typed against its concrete input/output contract;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handleValidateEnvelope as unknown as AnyToolHandler
);

// ─── recover_changed_files ────────────────────────────────────────────────────

const handleRecoverChangedFiles: ToolHandler<
  RecoverChangedFilesInput,
  RecoverChangedFilesOutput
> = async (input) => {
  const result = await recoverChangedFiles(input);
  let text: string;
  if (result.status === "ok") {
    text = `Recovered ${result.changedFiles!.length} changed file(s) from the worktree.`;
  } else {
    text = `Changed-file recovery failed [${result.errorCode}]: ${result.errorMessage}`;
  }
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "recover_changed_files",
  {
    title: "Recover Changed Files From a Worktree",
    description:
      "Recovers the changed-file set of a slice worktree by inspecting it " +
      "directly with 'git status --porcelain -z' — the orchestrator's fallback " +
      "for when a subagent's result envelope is missing or invalid and its " +
      "`filesChanged` list cannot be trusted. Returns ALL changes (tracked, " +
      "staged, and untracked alike — build artifacts NOT filtered); a rename " +
      "emits both real paths, never an 'old -> new' composite. Discriminated " +
      "`status` of 'ok' or 'error'.",
    inputSchema: recoverChangedFilesInputSchema.shape,
    outputSchema: recoverChangedFilesOutputSchema.shape,
  },
  // Handler is typed against its concrete input/output contract;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handleRecoverChangedFiles as unknown as AnyToolHandler
);

// ─── verify_changeset ─────────────────────────────────────────────────────────

const handleVerifyChangeset: ToolHandler<
  VerifyChangesetInput,
  VerifyChangesetOutput
> = async (input) => {
  const result = await verifyChangeset(input);
  let text: string;
  if (result.status === "ok") {
    const counts =
      `${result.declaredButAbsent!.length} declared-but-absent, ` +
      `${result.presentButUndeclared!.length} present-but-undeclared`;
    text = `Changeset verification: ${result.match} (${counts}).`;
  } else {
    text = `Changeset verification failed [${result.errorCode}]: ${result.errorMessage}`;
  }
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text }],
  };
};

registerTool(
  "verify_changeset",
  {
    title: "Verify a Worktree Changeset Against the Declared File Set",
    description:
      "Compares a slice worktree's ACTUAL changeset — inspected with " +
      "'git status --porcelain -z' — against the changed-file set the " +
      "implementer DECLARED in its result envelope. The orchestrator calls " +
      "this after every implementer returns, before trusting a 'completed' " +
      "envelope. The comparison is a cheap set comparison, not a semantic " +
      "scope check: order and duplicates are ignored, and the issue body is " +
      "never parsed. Returns a `match` verdict — 'matched', 'clean', " +
      "'mismatch', 'empty-but-declared' (edits never landed), or " +
      "'suspiciously-empty' (work under-reported) — plus the divergent paths " +
      "in `declaredButAbsent` and `presentButUndeclared`. Discriminated " +
      "`status` of 'ok' or 'error'.",
    inputSchema: verifyChangesetInputSchema.shape,
    outputSchema: verifyChangesetOutputSchema.shape,
  },
  // Handler is typed against its concrete input/output contract;
  // widen to the flat SDK-boundary `AnyToolHandler` for registration.
  handleVerifyChangeset as unknown as AnyToolHandler
);

// ─── Start server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // main() resolves here; the process stays alive because the connected
  // StdioServerTransport holds stdin open and drives the request/response loop.
}

main().catch((err) => {
  console.error("orchestrate-mcp fatal error:", err);
  process.exit(1);
});
