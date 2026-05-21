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

const server = new McpServer({
  name: "orchestrate",
  version: "0.3.0",
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
      "Removes a git worktree if and only if it is a registered worktree " +
      "root and clean (no uncommitted or untracked changes). If dirty, " +
      "returns status='refused' and leaves the worktree and its branch " +
      "intact. The associated branch is NOT deleted — the caller is " +
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
