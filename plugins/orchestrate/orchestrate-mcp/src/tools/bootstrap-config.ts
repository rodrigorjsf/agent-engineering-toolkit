import * as path from "path";
import * as fs from "fs";
import { z } from "zod";
import {
  detectCommandMap,
  detectProjectType,
  type ProjectType,
} from "./detect-project.js";
import { commandsConfigSchema, type CommandsConfig } from "./run-command.js";

// ─── Overview ─────────────────────────────────────────────────────────────────
//
// The config bootstrapper makes a first-ever orchestrate run set up its own
// `.orchestrate/` configuration. On a fresh repository it:
//   1. Detects the project type and writes a project-appropriate `commands.json`.
//   2. Writes `handoff.json` with a context-window size derived from the running
//      model (passed as input — the MCP process cannot see the calling LLM's
//      model), and `routing.json` with the shipped defaults.
//   3. Creates `.orchestrate/runs/` and idempotently appends it to the target
//      repository's `.gitignore`.
//
// Every step is individually idempotent: an existing config file is never
// overwritten (a user may have customized it), the runs directory mkdir is
// recursive, and the `.gitignore` append checks for an existing matching line.
// The core function never throws — every failure mode is a structured result.

// ─── Model → context-window table ─────────────────────────────────────────────

/**
 * The default context window (tokens) used when no model is recognized and no
 * explicit `contextWindowTokens` is supplied. This is the conservative value
 * the watchdog schema also defaults to.
 */
const DEFAULT_CONTEXT_WINDOW_TOKENS = 200_000;

/** The context window of a 1M-token session. */
const ONE_MILLION_TOKENS = 1_000_000;

/**
 * Explicit, exact-match model → context-window table. Lookup is exact-match
 * only — no substring or regex matching, which would misclassify unrelated
 * ids silently. Any model not listed here resolves to
 * {@link DEFAULT_CONTEXT_WINDOW_TOKENS}.
 */
const MODEL_CONTEXT_WINDOW: Readonly<Record<string, number>> = {
  opus: DEFAULT_CONTEXT_WINDOW_TOKENS,
  sonnet: DEFAULT_CONTEXT_WINDOW_TOKENS,
  haiku: DEFAULT_CONTEXT_WINDOW_TOKENS,
  "claude-opus-4-8[1m]": ONE_MILLION_TOKENS,
  "claude-opus-4-7[1m]": ONE_MILLION_TOKENS,
  "claude-opus-4-1[1m]": ONE_MILLION_TOKENS,
  "claude-sonnet-4-6[1m]": ONE_MILLION_TOKENS,
  "claude-sonnet-4-5[1m]": ONE_MILLION_TOKENS,
  "claude-sonnet-4[1m]": ONE_MILLION_TOKENS,
};

// ─── Shipped defaults ─────────────────────────────────────────────────────────

/**
 * The default `routing.json` content the bootstrapper writes. Native v2 shape —
 * `version: 2` present so a fresh-repo bootstrap produces NO deprecation
 * warning. Kept byte-for-byte equivalent (modulo formatting) to
 * `templates/routing.json`.
 *
 * Tier matrix (ADR-0015):
 * - trivial: investigator=null; implementer=haiku/standard; reviewer=sonnet/standard;
 *   conflict-resolver=sonnet/standard (deliberate cross-model merge gate).
 * - standard: investigator=haiku/standard (NEW — was null); implementer=sonnet/standard;
 *   reviewer=opus/standard; conflict-resolver=opus/standard.
 * - complex: all roles = opus/deep (unchanged).
 * - labels: route:fable → implementer patched to fable/deep with opus fallback.
 * - run: intraWaveConcurrency=parallel; continuationBudget=2 (same values as v1,
 *   now under the run block).
 */
export const DEFAULT_ROUTING_CONFIG = {
  version: 2,
  tiers: {
    trivial: {
      investigator: null,
      implementer: { model: "haiku", variant: "standard" },
      reviewer: { model: "sonnet", variant: "standard" },
      "conflict-resolver": { model: "sonnet", variant: "standard" },
    },
    standard: {
      investigator: { model: "haiku", variant: "standard" },
      implementer: { model: "sonnet", variant: "standard" },
      reviewer: { model: "opus", variant: "standard" },
      "conflict-resolver": { model: "opus", variant: "standard" },
    },
    complex: {
      investigator: { model: "opus", variant: "deep" },
      implementer: { model: "opus", variant: "deep" },
      reviewer: { model: "opus", variant: "deep" },
      "conflict-resolver": { model: "opus", variant: "deep" },
    },
  },
  labels: {
    "route:fable": {
      roles: ["implementer"],
      set: { model: "fable", variant: "deep" },
      fallback: { model: "opus", maxRetries: 1 },
    },
  },
  run: {
    intraWaveConcurrency: "parallel",
    continuationBudget: 2,
  },
} as const;

/** The `.gitignore` entry covering every run's ephemeral per-run directory. */
const RUNS_GITIGNORE_LINE = ".orchestrate/runs/";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const bootstrapConfigInputSchema = z.object({
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the project root the .orchestrate/ configuration is " +
        "bootstrapped into. Defaults to the MCP server process's current " +
        "working directory — callers should pass this explicitly rather than " +
        "rely on the default, which is not guaranteed to be the project root."
    ),
  model: z
    .string()
    .optional()
    .describe(
      "The model identifier of the running orchestrator session (e.g. 'opus' " +
        "or 'claude-opus-4-7[1m]'). The MCP process cannot see the calling " +
        "LLM's model, so the caller passes it. It is mapped to a context-" +
        "window token count via an explicit table; an unknown or absent " +
        "model falls back to 200000. Ignored when contextWindowTokens is set."
    ),
  contextWindowTokens: z
    .number()
    .optional()
    .describe(
      "An explicit context-window token count for the running session. When " +
        "supplied as a positive integer it takes precedence over the model " +
        "table. A non-positive or non-integer value is ignored and the run " +
        "falls back to the model table, then to 200000."
    ),
});

export const bootstrapConfigOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the bootstrap completed (every file " +
        "either written or already present); 'error' = a filesystem write " +
        "failed and the configuration is incomplete."
    ),
  projectType: z
    .enum(["npm", "cargo", "python", "maven", "gradle", "make", "none"])
    .optional()
    .describe(
      "The detected project type. 'none' means no recognized manifest — " +
        "commands.json is written empty. Present when status='ok'."
    ),
  contextWindowTokens: z
    .number()
    .optional()
    .describe(
      "The context-window token count written into handoff.json. Always a " +
        "positive integer — never NaN. Present when status='ok'."
    ),
  contextWindowSource: z
    .enum(["explicit", "model-table", "model-suffix", "default"])
    .optional()
    .describe(
      "How contextWindowTokens was resolved. 'explicit' = a valid " +
        "contextWindowTokens input; 'model-table' = a recognized model id; " +
        "'model-suffix' = an unlisted id whose trailing [Nm] capacity suffix " +
        "was parsed to N×1000000; 'default' = an unknown/absent model fell " +
        "back to 200000. Present when status='ok'."
    ),
  files: z
    .object({
      commandsJson: z.enum(["written", "already-present"]),
      routingJson: z.enum(["written", "already-present"]),
      handoffJson: z.enum(["written", "already-present"]),
    })
    .optional()
    .describe(
      "Per-config-file outcome. 'written' = the bootstrapper created it; " +
        "'already-present' = it existed and was left untouched (a committed " +
        "config is never overwritten). Present when status='ok'."
    ),
  runsDir: z
    .enum(["created", "already-present"])
    .optional()
    .describe(
      "Outcome for the .orchestrate/runs/ directory. Present when status='ok'."
    ),
  gitignore: z
    .enum(["created-with-line", "line-added", "already-present"])
    .optional()
    .describe(
      "Outcome for the .gitignore entry. 'created-with-line' = no .gitignore " +
        "existed, one was created with the .orchestrate/runs/ line; " +
        "'line-added' = the line was appended to an existing file; " +
        "'already-present' = the line was already there. Present when " +
        "status='ok'."
    ),
  errorCode: z
    .enum(["WRITE_FAILED"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'. " +
        "'WRITE_FAILED' = a filesystem operation (mkdir or write) failed."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='error'."
    ),
  warnings: z
    .array(z.string())
    .optional()
    .describe(
      "Advisory warnings about the bootstrapped configuration. Non-empty only " +
        "when status='ok' and the freshly-written commands.json is empty ({}) — " +
        "meaning no recognized project type was detected and the capability gates " +
        "(run_tests, run_build, etc.) will report 'not-configured', allowing a " +
        "slice to merge green with no verification. Empty array when the written " +
        "commands map is non-empty. Present when status='ok'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type BootstrapConfigInput = z.infer<typeof bootstrapConfigInputSchema>;
export type BootstrapConfigOutput = z.infer<typeof bootstrapConfigOutputSchema>;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns the first non-empty trimmed line of a (possibly multi-line) string. */
function firstLine(message: string): string {
  const line = message
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? message.trim();
}

/** Serializes a value as 2-space-indented JSON with a trailing newline. */
function toJsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** How the context-window token count was resolved. */
type ContextWindowResolution = {
  tokens: number;
  source: "explicit" | "model-table" | "model-suffix" | "default";
};

/**
 * Resolves the context-window token count from the bootstrap input. Precedence:
 *   1. An explicit `contextWindowTokens` that is a positive integer.
 *   2. An exact model-table hit.
 *   3. A trailing `[Nm]` capacity suffix on the model id, parsed to N×1M.
 *   4. The {@link DEFAULT_CONTEXT_WINDOW_TOKENS} fallback.
 *
 * Always returns a positive integer — never NaN — so a malformed input can
 * never write a broken value into handoff.json.
 */
export function resolveContextWindow(
  input: BootstrapConfigInput
): ContextWindowResolution {
  const explicit = input.contextWindowTokens;
  if (
    typeof explicit === "number" &&
    Number.isInteger(explicit) &&
    explicit > 0
  ) {
    return { tokens: explicit, source: "explicit" };
  }

  if (input.model !== undefined) {
    const fromTable = MODEL_CONTEXT_WINDOW[input.model];
    if (fromTable !== undefined) {
      return { tokens: fromTable, source: "model-table" };
    }

    // Bracket-only, post-miss fallback: parse a trailing `[Nm]` capacity token
    // (e.g. the `[1m]` in `claude-future-x[1m]`) to N×1M. This is orthogonal to
    // the exact-match table invariant — it never matches the table by
    // substring and never inspects the model FAMILY; it reads only the
    // end-anchored bracketed capacity token and runs solely after an exact
    // table miss, so it cannot alter any exact-table outcome. The `N > 0` guard
    // sends a pathological `[0m]` through to the default, preserving the
    // never-zero/never-NaN contract.
    const suffixMatch = /\[(\d+)m\]$/.exec(input.model);
    if (suffixMatch !== undefined && suffixMatch !== null) {
      const n = Number.parseInt(suffixMatch[1], 10);
      if (n > 0) {
        return { tokens: n * ONE_MILLION_TOKENS, source: "model-suffix" };
      }
    }
  }

  return { tokens: DEFAULT_CONTEXT_WINDOW_TOKENS, source: "default" };
}

/**
 * Builds the `commands.json` content for a detected project. The four
 * capability verbs AND the `install` setup verb come from the capability
 * detector ({@link detectCommandMap}), which is package-manager-aware for the
 * JS ecosystem: it emits a **mutating/resolving** install keyed on the lockfile
 * (`pnpm install` / `yarn install` / `npm install`, defaulting to pnpm with no
 * lock — never `npm ci`), plus `cargo fetch` for cargo and `pip install -e .`
 * for python. A `make`/manifest-less ('none') project has no install verb. The
 * detected install flows through unchanged — there is no hardcoded override.
 */
export function buildCommandsConfig(repoRoot: string): {
  config: CommandsConfig;
  projectType: ProjectType;
} {
  let entries: string[];
  try {
    entries = fs.readdirSync(repoRoot);
  } catch {
    entries = [];
  }
  const projectType = detectProjectType(entries);
  const capabilities = detectCommandMap(repoRoot);

  const config: CommandsConfig = { ...capabilities };
  return { config, projectType };
}

/** Outcome of one config-file write attempt. */
type FileWriteResult =
  | { kind: "written" }
  | { kind: "already-present" }
  | { kind: "error"; message: string };

/**
 * Writes `content` to `filePath` only when the file does not already exist. An
 * existing file is left untouched — a committed, possibly user-customized
 * config is never overwritten.
 */
function writeIfAbsent(filePath: string, content: string): FileWriteResult {
  if (fs.existsSync(filePath)) {
    return { kind: "already-present" };
  }
  try {
    fs.writeFileSync(filePath, content);
    return { kind: "written" };
  } catch (err) {
    return {
      kind: "error",
      message: firstLine(err instanceof Error ? err.message : String(err)),
    };
  }
}

/** Outcome of the idempotent `.gitignore` append. */
type GitignoreResult =
  | { kind: "created-with-line" }
  | { kind: "line-added" }
  | { kind: "already-present" }
  | { kind: "error"; message: string };

/**
 * Idempotently ensures `.orchestrate/runs/` is listed in the repository's
 * `.gitignore`. The line is considered present when any trimmed line of the
 * file equals `.orchestrate/runs/` or `.orchestrate/runs` (with or without the
 * trailing slash). When absent it is appended; the file is guaranteed to end
 * with a newline both before and after the appended line. A missing file is
 * created with just the line.
 */
function ensureGitignoreEntry(repoRoot: string): GitignoreResult {
  const gitignorePath = path.join(repoRoot, ".gitignore");

  let existing: string | null;
  try {
    existing = fs.readFileSync(gitignorePath, "utf8");
  } catch {
    existing = null;
  }

  if (existing === null) {
    try {
      fs.writeFileSync(gitignorePath, `${RUNS_GITIGNORE_LINE}\n`);
      return { kind: "created-with-line" };
    } catch (err) {
      return {
        kind: "error",
        message: firstLine(err instanceof Error ? err.message : String(err)),
      };
    }
  }

  const alreadyListed = existing
    .split("\n")
    .map((l) => l.trim())
    .some((l) => l === ".orchestrate/runs/" || l === ".orchestrate/runs");
  if (alreadyListed) {
    return { kind: "already-present" };
  }

  // Append the line, guaranteeing exactly one separating newline and a
  // trailing newline regardless of how the existing file ended.
  const separator = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  try {
    fs.appendFileSync(
      gitignorePath,
      `${separator}${RUNS_GITIGNORE_LINE}\n`
    );
    return { kind: "line-added" };
  } catch (err) {
    return {
      kind: "error",
      message: firstLine(err instanceof Error ? err.message : String(err)),
    };
  }
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Bootstraps a repository's `.orchestrate/` configuration for a first-ever
 * orchestrate run.
 *
 * Writes the three config files (`commands.json`, `routing.json`,
 * `handoff.json`) with project- and model-appropriate values, creates
 * `.orchestrate/runs/`, and idempotently adds `.orchestrate/runs/` to the
 * repository's `.gitignore`. Every step is individually idempotent: an existing
 * config file is never overwritten, the runs directory mkdir is recursive, and
 * the `.gitignore` append never duplicates the line.
 *
 * Never throws — every failure mode is returned as a structured result.
 */
export function bootstrapConfig(
  input: BootstrapConfigInput
): BootstrapConfigOutput {
  const repoRoot = input.repoPath ?? process.cwd();
  const orchestrateDir = path.join(repoRoot, ".orchestrate");

  // The .orchestrate/ directory and its runs/ subdirectory. `mkdirSync` with
  // `recursive: true` creates both in one call and is itself idempotent.
  const runsDir = path.join(orchestrateDir, "runs");
  const runsDirExisted = fs.existsSync(runsDir);
  try {
    fs.mkdirSync(runsDir, { recursive: true });
  } catch (err) {
    return {
      status: "error",
      errorCode: "WRITE_FAILED",
      errorMessage: `Failed to create ${runsDir}: ${firstLine(
        err instanceof Error ? err.message : String(err)
      )}`,
    };
  }

  // Resolve the per-project and per-model values.
  const { config: commandsConfig, projectType } = buildCommandsConfig(repoRoot);
  const contextWindow = resolveContextWindow(input);

  // commands.json — project-type-aware, validated against its own schema so a
  // malformed map can never be written. `safeParse` keeps the never-throws
  // contract intact even though the inputs come from a closed-set map.
  const validatedCommands = commandsConfigSchema.safeParse(commandsConfig);
  if (!validatedCommands.success) {
    const detail = validatedCommands.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      status: "error",
      errorCode: "WRITE_FAILED",
      errorMessage: `Derived commands.json failed schema validation: ${detail}`,
    };
  }
  const commandsResult = writeIfAbsent(
    path.join(orchestrateDir, "commands.json"),
    toJsonFile(validatedCommands.data)
  );
  if (commandsResult.kind === "error") {
    return {
      status: "error",
      errorCode: "WRITE_FAILED",
      errorMessage: `Failed to write commands.json: ${commandsResult.message}`,
    };
  }

  // routing.json — shipped defaults (no project-type axis).
  const routingResult = writeIfAbsent(
    path.join(orchestrateDir, "routing.json"),
    toJsonFile(DEFAULT_ROUTING_CONFIG)
  );
  if (routingResult.kind === "error") {
    return {
      status: "error",
      errorCode: "WRITE_FAILED",
      errorMessage: `Failed to write routing.json: ${routingResult.message}`,
    };
  }

  // handoff.json — context window derived from the running model.
  const handoffConfig = {
    watchdog: {
      thresholdPercent: 40,
      contextWindowTokens: contextWindow.tokens,
    },
    successor: {
      claudeArgs: [
        "--remote-control",
        "orchestrate-successor",
        "--permission-mode",
        "auto",
      ],
      resumePrompt: "/orchestrate",
      terminals: [
        {
          name: "windows-terminal",
          argv: [
            "wt.exe",
            "new-tab",
            "--title",
            "orchestrate-successor",
            "wsl.exe",
            "--",
            "bash",
            "-lc",
            "{claudeCommand}",
          ],
        },
        {
          name: "warp",
          argv: ["warp-terminal", "--", "bash", "-lc", "{claudeCommand}"],
        },
      ],
    },
  };
  const handoffResult = writeIfAbsent(
    path.join(orchestrateDir, "handoff.json"),
    toJsonFile(handoffConfig)
  );
  if (handoffResult.kind === "error") {
    return {
      status: "error",
      errorCode: "WRITE_FAILED",
      errorMessage: `Failed to write handoff.json: ${handoffResult.message}`,
    };
  }

  // .gitignore — idempotently list the per-run directory.
  const gitignoreResult = ensureGitignoreEntry(repoRoot);
  if (gitignoreResult.kind === "error") {
    return {
      status: "error",
      errorCode: "WRITE_FAILED",
      errorMessage: `Failed to update .gitignore: ${gitignoreResult.message}`,
    };
  }

  // Emit a loud warning when the bootstrapper just wrote an empty commands.json
  // ({}). This happens for unrecognized project types ('none') where no manifest
  // is detected. An empty map means all capability gates (run_tests, run_build,
  // etc.) will report 'not-configured' — a slice can merge green with no
  // verification, which is a common source of false-green merges.
  const commandsMapEmpty =
    Object.keys(validatedCommands.data).length === 0;
  const warnings: string[] =
    commandsResult.kind === "written" && commandsMapEmpty
      ? [
          "commands.json was written empty ({}): no recognized project type detected. " +
            "The capability gates run_tests and run_build will report 'not-configured' — " +
            "a slice can merge green with no verification. " +
            "Edit .orchestrate/commands.json to add your project's test and build commands.",
        ]
      : [];

  return {
    status: "ok",
    projectType,
    contextWindowTokens: contextWindow.tokens,
    contextWindowSource: contextWindow.source,
    files: {
      commandsJson: commandsResult.kind,
      routingJson: routingResult.kind,
      handoffJson: handoffResult.kind,
    },
    runsDir: runsDirExisted ? "already-present" : "created",
    gitignore: gitignoreResult.kind,
    warnings,
  };
}
