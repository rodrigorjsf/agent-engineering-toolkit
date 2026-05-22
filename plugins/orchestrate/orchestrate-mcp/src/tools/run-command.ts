import * as path from "path";
import * as fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

// ─── Execution limits ─────────────────────────────────────────────────────────

/** Default ceiling on a single capability command (ms). Builds/tests are slow. */
const DEFAULT_TIMEOUT_MS = 600_000;

/**
 * Hard ceiling on captured child output (bytes). A command emitting more than
 * this is killed by `execFile` — generous enough that real test/build logs
 * complete, low enough to bound memory.
 */
const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;

/** Per-stream character cap applied to the captured output in the result. */
const MAX_OUTPUT_CHARS = 64_000;

// ─── Capability verbs ─────────────────────────────────────────────────────────

/** The four fixed capability verbs, each a key in `.orchestrate/commands.json`. */
export const CAPABILITY_VERBS = ["tests", "typecheck", "build", "lint"] as const;
export type CapabilityVerb = (typeof CAPABILITY_VERBS)[number];

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

/**
 * Schema for `.orchestrate/commands.json`.
 *
 * Each verb maps to an argv array — `["npm", "test"]`, NOT `"npm test"`. The
 * argv form is executed with `execFile` (no shell), so a command string can
 * never be word-split, glob-expanded, or interpreted. Unknown keys are
 * stripped, so a `$schema` pointer or future additive keys do not break an
 * existing config.
 *
 * `install` is a setup verb, not a capability verb — it runs once after a
 * worktree is created (a fresh worktree has no installed dependencies) so the
 * four capability commands above have what they need. It is optional: a
 * project whose capability commands need no install simply omits it.
 */
export const commandsConfigSchema = z.object({
  tests: z.array(z.string().min(1)).optional(),
  typecheck: z.array(z.string().min(1)).optional(),
  build: z.array(z.string().min(1)).optional(),
  lint: z.array(z.string().min(1)).optional(),
  install: z.array(z.string().min(1)).optional(),
});

export const runCommandInputSchema = z.object({
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the project root that holds the .orchestrate/commands.json " +
        "configuration file. Defaults to the MCP server process's current " +
        "working directory — callers should pass this explicitly rather than " +
        "rely on the default, which is not guaranteed to be the project root."
    ),
});

export const runCommandOutputSchema = z.object({
  status: z
    .enum(["passed", "failed", "not-configured", "error"])
    .describe(
      "Outcome discriminant. 'passed' = command exited 0; 'failed' = command " +
        "exited non-zero; 'not-configured' = no command is configured for this " +
        "verb (a clear, expected state — not a failure); 'error' = the command " +
        "could not be run (invalid config, timeout, or spawn failure)."
    ),
  capability: z
    .enum(["tests", "typecheck", "build", "lint"])
    .describe("The capability verb this result is for. Always present."),
  command: z
    .array(z.string())
    .optional()
    .describe(
      "The exact argv array that was executed, read verbatim from " +
        ".orchestrate/commands.json. Present when status is 'passed' or " +
        "'failed'. The caller never supplies this — it is fixed by config."
    ),
  exitCode: z
    .number()
    .optional()
    .describe(
      "Process exit code. 0 for 'passed', non-zero for 'failed'. Present " +
        "when status is 'passed' or 'failed'."
    ),
  stdout: z
    .string()
    .optional()
    .describe(
      "Captured standard output, tail-truncated to 64,000 characters. " +
        "Present when status is 'passed' or 'failed', and on a 'TIMEOUT' " +
        "error (the output captured before the command was killed). See " +
        "`truncated`."
    ),
  stderr: z
    .string()
    .optional()
    .describe(
      "Captured standard error, tail-truncated to 64,000 characters. " +
        "Present when status is 'passed' or 'failed', and on a 'TIMEOUT' " +
        "error. See `truncated`."
    ),
  truncated: z
    .boolean()
    .optional()
    .describe(
      "True when `stdout` or `stderr` was truncated to fit the size cap. " +
        "Present whenever `stdout`/`stderr` are present."
    ),
  durationMs: z
    .number()
    .optional()
    .describe(
      "Wall-clock duration of the command in milliseconds. Present whenever " +
        "a command was actually executed — status 'passed' or 'failed', or a " +
        "'TIMEOUT' / 'EXEC_ERROR' error. Absent for config-level failures."
    ),
  reason: z
    .string()
    .optional()
    .describe(
      "Human-readable explanation of why no command ran. Present when status " +
        "is 'not-configured'."
    ),
  errorCode: z
    .enum(["CONFIG_INVALID", "EXEC_ERROR", "TIMEOUT"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status is 'error'. " +
        "'CONFIG_INVALID' = commands.json is malformed JSON or the wrong " +
        "shape; 'EXEC_ERROR' = the command binary could not be spawned; " +
        "'TIMEOUT' = the command exceeded the time limit and was killed."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status is " +
        "'error'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type CommandsConfig = z.infer<typeof commandsConfigSchema>;
export type RunCommandInput = z.infer<typeof runCommandInputSchema>;
export type RunCommandOutput = z.infer<typeof runCommandOutputSchema>;

/**
 * Internal execution overrides. NOT exposed as an MCP tool input — the only
 * caller-facing input is `RunCommandInput`. Used by tests to shorten the
 * timeout without waiting out the production default.
 */
export interface RunCommandOptions {
  timeoutMs?: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns the first non-empty trimmed line of a (possibly multi-line) string. */
function firstLine(message: string): string {
  const line = message
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? message.trim();
}

/** Tail-truncates a stream to the output cap, prepending a truncation marker. */
function capOutput(s: string): { text: string; truncated: boolean } {
  if (s.length <= MAX_OUTPUT_CHARS) {
    return { text: s, truncated: false };
  }
  const tail = s.slice(s.length - MAX_OUTPUT_CHARS);
  return {
    text: `[... output truncated — showing the last ${MAX_OUTPUT_CHARS} characters ...]\n${tail}`,
    truncated: true,
  };
}

/** Outcome of a single `execFile` invocation, classified for the caller. */
type ExecResult =
  | { kind: "exited"; exitCode: number; stdout: string; stderr: string; durationMs: number }
  | { kind: "timeout"; stdout: string; stderr: string; durationMs: number }
  | { kind: "exec-error"; message: string; durationMs: number };

/**
 * Runs `argv` with `execFile` (no shell — `argv[0]` is the binary, the rest
 * are literal arguments). Bounded by `timeoutMs`; on timeout the child is
 * SIGKILLed. Output beyond {@link MAX_CAPTURE_BYTES} aborts the run.
 *
 * Never throws — every failure mode is returned as a classified {@link ExecResult}.
 *
 * `argv[0]` is resolved by the OS — a bare name via `PATH`, a relative path
 * against `cwd`. This is intended: `commands.json` is trusted project config,
 * not caller input.
 *
 * Note: the timeout kills the immediate child only, not its descendants. A
 * command that forks worker processes (e.g. some test runners) may leave
 * orphans on timeout — acceptable for v1.
 */
async function execCommand(
  argv: string[],
  cwd: string,
  timeoutMs: number
): Promise<ExecResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(argv[0], argv.slice(1), {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      maxBuffer: MAX_CAPTURE_BYTES,
      windowsHide: true,
    });
    return {
      kind: "exited",
      exitCode: 0,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const e = err as NodeJS.ErrnoException & {
      code?: string | number;
      killed?: boolean;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };

    // The process ran to completion and exited non-zero: `code` is the
    // numeric exit code, and stdout/stderr carry the full captured output.
    if (typeof e.code === "number") {
      return {
        kind: "exited",
        exitCode: e.code,
        stdout: e.stdout ? e.stdout.toString() : "",
        stderr: e.stderr ? e.stderr.toString() : "",
        durationMs,
      };
    }
    // Output exceeded the capture ceiling — the child was killed mid-run.
    if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      return {
        kind: "exec-error",
        message: `Command output exceeded the ${MAX_CAPTURE_BYTES}-byte capture limit and was aborted.`,
        durationMs,
      };
    }
    // `execFile` killed the child — the only kill path here is the timeout.
    // Surface whatever the child wrote before SIGKILL; it aids triage of a hang.
    if (e.killed) {
      return {
        kind: "timeout",
        stdout: e.stdout ? e.stdout.toString() : "",
        stderr: e.stderr ? e.stderr.toString() : "",
        durationMs,
      };
    }
    // Spawn failure (binary not found, not executable) or an uncaught signal.
    return {
      kind: "exec-error",
      message: firstLine(e.message ?? String(err)),
      durationMs,
    };
  }
}

/**
 * Outcome of loading and validating `.orchestrate/commands.json`. `runInstall`
 * and `runConfiguredCommand` share this loader so the file is read, parsed, and
 * shape-checked in exactly one place.
 */
type LoadCommandsConfigResult =
  | { kind: "loaded"; config: CommandsConfig }
  | { kind: "not-configured"; reason: string }
  | { kind: "invalid"; errorMessage: string };

/**
 * Reads `<cwd>/.orchestrate/commands.json` and validates it against
 * {@link commandsConfigSchema}. A missing file is not an error — it means the
 * project has not configured orchestrate commands yet. Malformed JSON or a
 * wrong shape is a real misconfiguration. Never throws.
 */
function loadCommandsConfig(cwd: string): LoadCommandsConfigResult {
  const configPath = path.join(cwd, ".orchestrate", "commands.json");

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch {
    return {
      kind: "not-configured",
      reason:
        `No .orchestrate/commands.json found in ${cwd}. Copy the orchestrate ` +
        `plugin's templates/commands.json to .orchestrate/commands.json.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      kind: "invalid",
      errorMessage: `.orchestrate/commands.json is not valid JSON: ${firstLine(
        err instanceof Error ? err.message : String(err)
      )}`,
    };
  }

  const config = commandsConfigSchema.safeParse(parsed);
  if (!config.success) {
    const detail = config.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      kind: "invalid",
      errorMessage: `.orchestrate/commands.json does not match the expected shape: ${detail}`,
    };
  }

  return { kind: "loaded", config: config.data };
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Runs the project's configured command for a single capability `verb`.
 *
 * Reads `<repoPath>/.orchestrate/commands.json`, looks up the argv array for
 * `verb`, and executes it with no shell. The caller supplies only `repoPath` —
 * never a command string. Every failure mode is a structured result; this
 * function does not throw.
 */
export async function runConfiguredCommand(
  verb: CapabilityVerb,
  input: RunCommandInput,
  opts: RunCommandOptions = {}
): Promise<RunCommandOutput> {
  const cwd = input.repoPath ?? process.cwd();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const loaded = loadCommandsConfig(cwd);
  if (loaded.kind === "not-configured") {
    return { status: "not-configured", capability: verb, reason: loaded.reason };
  }
  if (loaded.kind === "invalid") {
    return {
      status: "error",
      capability: verb,
      errorCode: "CONFIG_INVALID",
      errorMessage: loaded.errorMessage,
    };
  }

  // An absent key or an empty argv array both mean "this verb is unconfigured".
  const argv = loaded.config[verb];
  if (!argv || argv.length === 0) {
    return {
      status: "not-configured",
      capability: verb,
      reason: `No "${verb}" command is configured in .orchestrate/commands.json.`,
    };
  }

  const exec = await execCommand(argv, cwd, timeoutMs);

  if (exec.kind === "timeout") {
    // Surface the output captured before SIGKILL — a hung run is otherwise
    // opaque. The output is bounded by the same per-stream cap as a normal run.
    const out = capOutput(exec.stdout);
    const errOut = capOutput(exec.stderr);
    return {
      status: "error",
      capability: verb,
      errorCode: "TIMEOUT",
      errorMessage: `The "${verb}" command exceeded the ${timeoutMs} ms time limit and was killed.`,
      stdout: out.text,
      stderr: errOut.text,
      truncated: out.truncated || errOut.truncated,
      durationMs: exec.durationMs,
    };
  }
  if (exec.kind === "exec-error") {
    return {
      status: "error",
      capability: verb,
      errorCode: "EXEC_ERROR",
      errorMessage: `The "${verb}" command could not be executed: ${exec.message}`,
      durationMs: exec.durationMs,
    };
  }

  const out = capOutput(exec.stdout);
  const errOut = capOutput(exec.stderr);
  return {
    status: exec.exitCode === 0 ? "passed" : "failed",
    capability: verb,
    command: argv,
    exitCode: exec.exitCode,
    stdout: out.text,
    stderr: errOut.text,
    truncated: out.truncated || errOut.truncated,
    durationMs: exec.durationMs,
  };
}

// ─── Capability tool wrappers ─────────────────────────────────────────────────
// Each tool is a thin, fixed-verb forwarder over runConfiguredCommand — the
// caller picks the capability by choosing the tool, never by passing a string.

export const runTests = (input: RunCommandInput, opts?: RunCommandOptions) =>
  runConfiguredCommand("tests", input, opts);

export const runTypecheck = (input: RunCommandInput, opts?: RunCommandOptions) =>
  runConfiguredCommand("typecheck", input, opts);

export const runBuild = (input: RunCommandInput, opts?: RunCommandOptions) =>
  runConfiguredCommand("build", input, opts);

export const runLint = (input: RunCommandInput, opts?: RunCommandOptions) =>
  runConfiguredCommand("lint", input, opts);

// ─── Install (setup verb) ─────────────────────────────────────────────────────

/**
 * Result of running the configured `install` command.
 *
 * Not an MCP tool output — `runInstall` is internal, called by `create_worktree`
 * after a worktree is created. Mirrors the shape of {@link RunCommandOutput}
 * minus `capability`: `install` is a setup verb, not one of the four capability
 * verbs.
 *
 * - `installed` — the install command exited 0.
 * - `not-configured` — no `install` command is set (a clean, expected state —
 *   a project that needs no install simply omits it).
 * - `failed` — the install command exited non-zero.
 * - `error` — the command could not be run (invalid config, timeout, spawn
 *   failure).
 */
export interface InstallResult {
  status: "installed" | "not-configured" | "failed" | "error";
  command?: string[];
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  truncated?: boolean;
  durationMs?: number;
  reason?: string;
  errorCode?: "CONFIG_INVALID" | "EXEC_ERROR" | "TIMEOUT";
  errorMessage?: string;
}

/**
 * Runs the project's configured `install` command — the dependency-install step
 * a freshly created worktree needs before any capability command can run.
 *
 * Reads `<repoPath>/.orchestrate/commands.json` and executes the `install` argv
 * with no shell. A missing file or absent `install` key is `not-configured`,
 * never an error. Every failure mode is a structured result; this function does
 * not throw.
 */
export async function runInstall(
  input: RunCommandInput,
  opts: RunCommandOptions = {}
): Promise<InstallResult> {
  const cwd = input.repoPath ?? process.cwd();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const loaded = loadCommandsConfig(cwd);
  if (loaded.kind === "not-configured") {
    return { status: "not-configured", reason: loaded.reason };
  }
  if (loaded.kind === "invalid") {
    return {
      status: "error",
      errorCode: "CONFIG_INVALID",
      errorMessage: loaded.errorMessage,
    };
  }

  // An absent key or an empty argv array both mean "no install step needed".
  const argv = loaded.config.install;
  if (!argv || argv.length === 0) {
    return {
      status: "not-configured",
      reason: `No "install" command is configured in .orchestrate/commands.json.`,
    };
  }

  const exec = await execCommand(argv, cwd, timeoutMs);

  if (exec.kind === "timeout") {
    const out = capOutput(exec.stdout);
    const errOut = capOutput(exec.stderr);
    return {
      status: "error",
      errorCode: "TIMEOUT",
      errorMessage: `The "install" command exceeded the ${timeoutMs} ms time limit and was killed.`,
      stdout: out.text,
      stderr: errOut.text,
      truncated: out.truncated || errOut.truncated,
      durationMs: exec.durationMs,
    };
  }
  if (exec.kind === "exec-error") {
    return {
      status: "error",
      errorCode: "EXEC_ERROR",
      errorMessage: `The "install" command could not be executed: ${exec.message}`,
      durationMs: exec.durationMs,
    };
  }

  const out = capOutput(exec.stdout);
  const errOut = capOutput(exec.stderr);
  return {
    status: exec.exitCode === 0 ? "installed" : "failed",
    command: argv,
    exitCode: exec.exitCode,
    stdout: out.text,
    stderr: errOut.text,
    truncated: out.truncated || errOut.truncated,
    durationMs: exec.durationMs,
  };
}
