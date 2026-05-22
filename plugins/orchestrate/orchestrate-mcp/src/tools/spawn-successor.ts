import { spawn } from "child_process";
import { z } from "zod";
import {
  loadHandoffConfig,
  type SuccessorConfig,
  type TerminalEntry,
} from "../handoff-config.js";

// `spawn_successor` launches a fresh interactive Claude Code session that
// resumes an interrupted orchestration run, then the predecessor exits. The
// run is resumable from its per-run `run-state.json` (under
// `.orchestrate/runs/<runId>/`), so the successor only needs to re-invoke
// `/orchestrate`. Command construction is pure and tested; the detached spawn
// itself is verified end-to-end, not by unit tests.
//
// `spawn_successor` deliberately takes NO `runId` parameter. It resolves no
// per-run path itself: it reads only the flat `.orchestrate/handoff.json`
// config and launches a terminal. The successor's `/orchestrate` invocation
// re-discovers the active run from `.orchestrate/runs/*/run-state.json` on
// startup — that re-discovery is what makes the handoff per-run-aware. Adding
// a `runId` here would be a dead parameter.

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

export const spawnSuccessorInputSchema = z.object({
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the repository root — the directory holding .orchestrate/. " +
        "The successor session opens here and re-discovers the active run " +
        "from .orchestrate/runs/*/run-state.json to resume. Defaults to the " +
        "MCP server process's current working directory; callers should pass " +
        "it explicitly."
    ),
});

const launchAttemptSchema = z.object({
  terminal: z.string().describe("The terminal entry's name."),
  argv: z.array(z.string()).describe("The fully-substituted launch argv."),
  outcome: z
    .enum(["launched", "failed"])
    .describe("'launched' = the process spawned; 'failed' = it did not."),
  error: z
    .string()
    .optional()
    .describe("Failure description. Present when outcome='failed'."),
});

export const spawnSuccessorOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = a successor terminal launched; " +
        "'error' = no terminal in the fallback chain could be launched."
    ),
  terminal: z
    .string()
    .optional()
    .describe("Name of the terminal that launched. Present when status='ok'."),
  command: z
    .array(z.string())
    .optional()
    .describe("The argv that launched the successor. Present when status='ok'."),
  attempts: z
    .array(launchAttemptSchema)
    .optional()
    .describe(
      "Every terminal tried, in order, with its outcome — so a failed " +
        "handoff is diagnosable rather than silent."
    ),
  configWarning: z
    .string()
    .optional()
    .describe(
      "Set when .orchestrate/handoff.json was present but unreadable, so " +
        "built-in defaults were used. The launch still proceeds."
    ),
  errorCode: z
    .enum(["NO_TERMINALS", "ALL_TERMINALS_FAILED"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'. " +
        "'NO_TERMINALS' = the config's terminal chain is empty; " +
        "'ALL_TERMINALS_FAILED' = every terminal failed to spawn."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe("Human-readable failure description. Present when status='error'."),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type SpawnSuccessorInput = z.infer<typeof spawnSuccessorInputSchema>;
export type SpawnSuccessorOutput = z.infer<typeof spawnSuccessorOutputSchema>;
export type LaunchAttempt = z.infer<typeof launchAttemptSchema>;

// ─── Pure command construction ────────────────────────────────────────────────

/** Returns the first non-empty trimmed line of a (possibly multi-line) string. */
function firstLine(message: string): string {
  const line = message
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? message.trim();
}

/** Single-quotes a token so it is safe as one POSIX-shell word. */
export function shellQuote(token: string): string {
  return `'${token.replace(/'/g, `'\\''`)}'`;
}

/**
 * Builds the `claude` invocation argv for the successor session. Pure.
 *
 * The order is fixed: `claude`, then the configured `claudeArgs`, then the
 * `resumePrompt` as the *final positional argument*. Keeping the prompt last
 * and distinct matters — `--remote-control` takes an optional name value, so a
 * prompt placed adjacent to it would be swallowed as the session name. The
 * default `claudeArgs` name the session explicitly (`orchestrate-successor`)
 * for exactly this reason.
 */
export function buildClaudeArgv(config: SuccessorConfig): string[] {
  return ["claude", ...config.claudeArgs, config.resumePrompt];
}

/**
 * Builds the shell command string that the launched terminal runs: it cd's
 * into the repository and exec's the `claude` invocation. Pure.
 */
export function buildClaudeCommand(
  config: SuccessorConfig,
  repoPath: string
): string {
  const invocation = buildClaudeArgv(config).map(shellQuote).join(" ");
  return `cd ${shellQuote(repoPath)} && exec ${invocation}`;
}

/**
 * Substitutes the `{claudeCommand}` and `{repoPath}` placeholders in a
 * terminal entry's argv, returning the concrete argv to spawn. Pure.
 */
export function buildLaunchArgv(
  entry: TerminalEntry,
  subs: { claudeCommand: string; repoPath: string }
): string[] {
  return entry.argv.map((token) =>
    token
      .replace(/\{claudeCommand\}/g, subs.claudeCommand)
      .replace(/\{repoPath\}/g, subs.repoPath)
  );
}

// ─── Spawn ────────────────────────────────────────────────────────────────────

/** Grace period to wait for an immediate spawn `error` (e.g. ENOENT). */
const SPAWN_GRACE_MS = 300;

/**
 * Spawns one detached process and reports whether it started. Resolves
 * `{ ok: false }` if the executable is missing or spawn throws; resolves
 * `{ ok: true }` once the process survives the grace period without an error
 * event. The child is detached and unref'd so the MCP server can exit while
 * the successor keeps running.
 */
function trySpawn(
  argv: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(argv[0], argv.slice(1), {
        detached: true,
        stdio: "ignore",
      });
    } catch (err) {
      resolve({
        ok: false,
        error: firstLine(err instanceof Error ? err.message : String(err)),
      });
      return;
    }

    let settled = false;
    child.once("error", (err) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: firstLine(err.message) });
    });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve({ ok: true });
    }, SPAWN_GRACE_MS);
  });
}

/**
 * Launches a successor Claude Code session that resumes the orchestration run.
 *
 * Reads `.orchestrate/handoff.json` (or uses defaults), builds the launch argv
 * for each terminal in the configured fallback chain, and spawns the first one
 * that starts. Never throws — every failure mode is a structured result, and
 * every terminal tried is recorded in `attempts` so a failed handoff is
 * diagnosable.
 */
export async function spawnSuccessor(
  input: SpawnSuccessorInput
): Promise<SpawnSuccessorOutput> {
  const repoPath = input.repoPath ?? process.cwd();
  const { config, warning } = loadHandoffConfig(repoPath);
  const successor = config.successor;
  const configWarning = warning ?? undefined;

  if (successor.terminals.length === 0) {
    return {
      status: "error",
      errorCode: "NO_TERMINALS",
      errorMessage:
        "No terminals are configured in .orchestrate/handoff.json — the " +
        "successor cannot be launched.",
      configWarning,
    };
  }

  const claudeCommand = buildClaudeCommand(successor, repoPath);
  const attempts: LaunchAttempt[] = [];

  for (const entry of successor.terminals) {
    const argv = buildLaunchArgv(entry, { claudeCommand, repoPath });
    const result = await trySpawn(argv);
    if (result.ok) {
      attempts.push({ terminal: entry.name, argv, outcome: "launched" });
      return {
        status: "ok",
        terminal: entry.name,
        command: argv,
        attempts,
        configWarning,
      };
    }
    attempts.push({
      terminal: entry.name,
      argv,
      outcome: "failed",
      error: result.error,
    });
  }

  return {
    status: "error",
    errorCode: "ALL_TERMINALS_FAILED",
    errorMessage:
      `Every terminal in the fallback chain failed to launch: ` +
      attempts.map((a) => `${a.terminal} (${a.error})`).join("; ") +
      ". Resume the run manually with /orchestrate in a new session.",
    attempts,
    configWarning,
  };
}
