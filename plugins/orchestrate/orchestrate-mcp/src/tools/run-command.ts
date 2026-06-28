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

/**
 * The capability verbs, each a key in `.orchestrate/commands.json`. The first
 * four (`tests`, `typecheck`, `build`, `lint`) are the fast, per-slice verbs the
 * Capability detector auto-populates. `integration` is an optional, heavy,
 * per-wave suite (Testcontainers/failsafe) that is never auto-detected — it is
 * hand-authored only when a project ships such a suite, and runs once per wave
 * against the umbrella tip rather than on every slice.
 */
export const CAPABILITY_VERBS = [
  "tests",
  "typecheck",
  "build",
  "lint",
  "integration",
] as const;
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
 * `integration` is an optional, heavy capability verb — a per-wave suite
 * (Testcontainers/failsafe) distinct from the four fast, per-slice capability
 * verbs above and distinct from the `install` setup verb. It is never
 * auto-detected: a project hand-authors it only when it ships such a suite, and
 * the orchestrator runs it once per wave against the umbrella tip rather than on
 * every slice. Because unknown keys are stripped, a project that omits it stays
 * forward-compatible.
 *
 * `install` is a setup verb, not a capability verb — it runs once after a
 * worktree is created (a fresh worktree has no installed dependencies) so the
 * four capability commands above have what they need. It is optional: a
 * project whose capability commands need no install simply omits it.
 *
 * `knownFailures` is a non-capability annotation key — like `install`, it is
 * NOT one of the four capability verbs and is never executed. It is an optional
 * list of substring/regex patterns matched against the captured output of a
 * failing capability command to annotate which baseline-failure patterns
 * appeared (`matched`) and which configured patterns did not (`unmatched`). It
 * is a best-effort L1 hint for the orchestrator, never a "zero new failures"
 * guarantee.
 */
export const commandsConfigSchema = z.object({
  tests: z.array(z.string().min(1)).optional(),
  typecheck: z.array(z.string().min(1)).optional(),
  build: z.array(z.string().min(1)).optional(),
  lint: z.array(z.string().min(1)).optional(),
  integration: z.array(z.string().min(1)).optional(),
  install: z.array(z.string().min(1)).optional(),
  knownFailures: z.array(z.string().min(1)).optional(),
});

export const runCommandInputSchema = z.object({
  repoPath: z
    .string()
    .optional()
    .describe(
      "The execution directory — the slice worktree (or project root) the " +
        "command runs in (cwd). The .orchestrate/commands.json config is NOT " +
        "read from here: it is resolved from the MAIN repository root derived " +
        "from this path (via `git rev-parse --git-common-dir`), so a fresh " +
        "worktree — which checks out only tracked files and so lacks " +
        ".orchestrate/ — still finds config. Defaults to the MCP server " +
        "process's current working directory — callers should pass this " +
        "explicitly rather than rely on the default, which is not guaranteed " +
        "to be the project root."
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
    .enum(["tests", "typecheck", "build", "lint", "integration"])
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
  knownFailureMatches: z
    .object({
      matched: z.array(z.string()),
      unmatched: z.array(z.string()),
    })
    .optional()
    .describe(
      "Baseline-failure annotation, present only when the command exited " +
        "non-zero AND `knownFailures` is configured in commands.json. " +
        "`matched` = the configured patterns that appeared in the captured " +
        "output; `unmatched` = the configured patterns that did NOT appear. " +
        "This is a best-effort L1 hint, NOT a guarantee of 'zero new " +
        "failures': run_tests returns capped exit-code output, not a " +
        "structured test-result list, so an unmatched failure indicator in " +
        "the output still warrants a spot-check by the orchestrator."
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

/**
 * Annotates which configured `knownFailures` patterns appear in a failing
 * command's captured output. Best-effort L1 baseline-vs-regression hint — NOT a
 * "zero new failures" guarantee.
 *
 * Matching runs against the UNTRUNCATED combined output (`rawStdout + "\n" +
 * rawStderr`), not the capped text returned in the result: a failure indicator
 * can live in the dropped head of oversized output. Each pattern is compiled as
 * a RegExp; an invalid pattern (e.g. a stray paren) is matched literally via
 * `includes` rather than escalating to an error — this honors the module's
 * "never throw — every failure mode is a structured result" philosophy.
 *
 * Returns `undefined` when no patterns are configured, so the output field is
 * omitted entirely.
 */
function annotateKnownFailures(
  patterns: string[] | undefined,
  rawStdout: string,
  rawStderr: string
): { matched: string[]; unmatched: string[] } | undefined {
  if (!patterns || patterns.length === 0) {
    return undefined;
  }
  const rawCombined = `${rawStdout}\n${rawStderr}`;
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const pattern of patterns) {
    let present: boolean;
    try {
      present = new RegExp(pattern).test(rawCombined);
    } catch {
      // Invalid regex (e.g. a stray paren) — fall back to a literal substring
      // match instead of throwing or surfacing CONFIG_INVALID.
      present = rawCombined.includes(pattern);
    }
    (present ? matched : unmatched).push(pattern);
  }
  return { matched, unmatched };
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
 * Resolves the main repository root for config lookup. In a linked worktree
 * `git rev-parse --git-common-dir` points at the shared `.git` dir under the
 * MAIN working tree; its parent IS that main tree (uniform for worktree and
 * non-worktree invocations). The command still executes in `execCwd` (the
 * worktree) — only config resolution moves to the main root. Falls back to
 * `execCwd` on any git failure so non-git/test callers behave as before.
 */
async function resolveConfigRoot(execCwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--git-common-dir"],
      { cwd: execCwd, encoding: "utf8" }
    );
    return path.dirname(path.resolve(execCwd, stdout.trim()));
  } catch {
    return execCwd;
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
 * {@link commandsConfigSchema}. The caller derives `cwd` — the config root —
 * via {@link resolveConfigRoot} from the execution directory, so in a worktree
 * this points at the main repository root, not the worktree. A missing file is
 * not an error — it means the project has not configured orchestrate commands
 * yet. Malformed JSON or a wrong shape is a real misconfiguration. Never throws.
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
 * Reads `.orchestrate/commands.json` from the main repository root derived from
 * `<repoPath>` (via {@link resolveConfigRoot}), looks up the argv array for
 * `verb`, and executes it with no shell with `cwd = <repoPath>` (the slice
 * worktree) — so a fresh worktree still finds config while the command runs
 * against the worktree's code. The caller supplies only `repoPath` — never a
 * command string. Every failure mode is a structured result; this function
 * does not throw.
 */
export async function runConfiguredCommand(
  verb: CapabilityVerb,
  input: RunCommandInput,
  opts: RunCommandOptions = {}
): Promise<RunCommandOutput> {
  const execCwd = input.repoPath ?? process.cwd();
  const configRoot = await resolveConfigRoot(execCwd);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const loaded = loadCommandsConfig(configRoot);
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

  const exec = await execCommand(argv, execCwd, timeoutMs);

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
  // Annotate known baseline failures on the FAILED branch only, matching
  // against the UNTRUNCATED output (a failure indicator can sit in the dropped
  // head of oversized output). On 'passed' the field stays absent.
  const knownFailureMatches =
    exec.exitCode === 0
      ? undefined
      : annotateKnownFailures(
          loaded.config.knownFailures,
          exec.stdout,
          exec.stderr
        );
  return {
    status: exec.exitCode === 0 ? "passed" : "failed",
    capability: verb,
    command: argv,
    exitCode: exec.exitCode,
    stdout: out.text,
    stderr: errOut.text,
    truncated: out.truncated || errOut.truncated,
    ...(knownFailureMatches ? { knownFailureMatches } : {}),
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

export const runIntegration = (
  input: RunCommandInput,
  opts?: RunCommandOptions
) => runConfiguredCommand("integration", input, opts);

// ─── Install (setup verb) ─────────────────────────────────────────────────────

/**
 * Output schema for the `run_install` MCP tool (and the internal `runInstall`
 * return). The single source of truth — `InstallResult` is its `z.infer`.
 *
 * Mirrors the shape of {@link runCommandOutputSchema} minus `capability`:
 * `install` is the mutating dependency-resolve setup verb (`pnpm install` /
 * `npm install`), not one of the four capability verbs. `run_install` is
 * orchestrator- and subagent-callable on any checkout; a subagent calls it
 * after editing a manifest to fetch a newly-added dependency before re-running
 * the capability tools.
 */
export const runInstallOutputSchema = z.object({
  status: z
    .enum(["installed", "not-configured", "failed", "error"])
    .describe(
      "Outcome discriminant. 'installed' = the install command exited 0; " +
        "'failed' = it exited non-zero; 'not-configured' = no `install` " +
        "command is set (a clean, expected state — a project that needs no " +
        "install simply omits the key); 'error' = the command could not be " +
        "run (invalid config, timeout, or spawn failure)."
    ),
  command: z
    .array(z.string())
    .optional()
    .describe(
      "The exact argv array that was executed, read verbatim from " +
        ".orchestrate/commands.json. Present when status is 'installed' or " +
        "'failed'. The caller never supplies this — it is fixed by config."
    ),
  exitCode: z
    .number()
    .optional()
    .describe(
      "Process exit code. 0 for 'installed', non-zero for 'failed'. Present " +
        "when status is 'installed' or 'failed'."
    ),
  stdout: z
    .string()
    .optional()
    .describe(
      "Captured standard output, tail-truncated to 64,000 characters. " +
        "Present when status is 'installed' or 'failed', and on a 'TIMEOUT' " +
        "error (the output captured before the command was killed). See " +
        "`truncated`."
    ),
  stderr: z
    .string()
    .optional()
    .describe(
      "Captured standard error, tail-truncated to 64,000 characters. " +
        "Present when status is 'installed' or 'failed', and on a 'TIMEOUT' " +
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
        "the install command was actually executed — status 'installed' or " +
        "'failed', or a 'TIMEOUT' / 'EXEC_ERROR' error. Absent for " +
        "config-level failures."
    ),
  reason: z
    .string()
    .optional()
    .describe(
      "Human-readable explanation of why no install ran. Present when status " +
        "is 'not-configured'."
    ),
  errorCode: z
    .enum(["CONFIG_INVALID", "EXEC_ERROR", "TIMEOUT"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status is 'error'. " +
        "'CONFIG_INVALID' = commands.json is malformed JSON or the wrong " +
        "shape; 'EXEC_ERROR' = the install binary could not be spawned (e.g. " +
        "a missing `pnpm` — there is no silent npm fallback); 'TIMEOUT' = the " +
        "command exceeded the time limit and was killed."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status is " +
        "'error'."
    ),
});

/**
 * Result of running the configured `install` command — the `z.infer` of
 * {@link runInstallOutputSchema} (the schema is the single source of truth).
 *
 * Surfaced as the `run_install` MCP tool output and also returned by the
 * internal `runInstall` (called by `create_worktree` after a worktree is
 * created).
 *
 * - `installed` — the install command exited 0.
 * - `not-configured` — no `install` command is set (a clean, expected state —
 *   a project that needs no install simply omits it).
 * - `failed` — the install command exited non-zero.
 * - `error` — the command could not be run (invalid config, timeout, spawn
 *   failure).
 */
export type InstallResult = z.infer<typeof runInstallOutputSchema>;

/**
 * Runs the project's configured `install` command — the dependency-install step
 * a freshly created worktree needs before any capability command can run.
 *
 * Reads `.orchestrate/commands.json` from the main repository root derived from
 * `<repoPath>` (via {@link resolveConfigRoot}) and executes the `install` argv
 * with no shell with `cwd = <repoPath>` — install MUST exec in the worktree
 * because it materializes the `node_modules` the worktree needs to compile,
 * while config is read from the main root. A missing file or absent `install`
 * key is `not-configured`, never an error. Every failure mode is a structured
 * result; this function does not throw.
 */
export async function runInstall(
  input: RunCommandInput,
  opts: RunCommandOptions = {}
): Promise<InstallResult> {
  const execCwd = input.repoPath ?? process.cwd();
  const configRoot = await resolveConfigRoot(execCwd);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const loaded = loadCommandsConfig(configRoot);
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

  const exec = await execCommand(argv, execCwd, timeoutMs);

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
