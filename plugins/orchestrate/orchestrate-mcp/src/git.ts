import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Hard ceiling on any single git invocation (ms). */
const GIT_TIMEOUT_MS = 120_000;

/**
 * Config `-c` overrides prepended to every git arg list.
 *
 * These neutralize `.git/config` keys that would otherwise spawn external
 * processes during ordinary `fetch`/`status`/`worktree` operations — closing
 * the config-driven code-execution surface on a repository whose `.git/config`
 * the orchestrator does not control.
 */
const GIT_CONFIG_OVERRIDES: string[] = [
  "-c",
  "core.hooksPath=/dev/null",
  "-c",
  "core.fsmonitor=",
  // `core.sshCommand=ssh`, not a blank value. A command-line `-c` overrides
  // whatever an untrusted repo's `.git/config` sets, so a malicious
  // `core.sshCommand` from the repo config cannot run. A blank value would
  // also close that vector, but it makes an SSH `fetch` spawn an empty
  // command and fail (F-005); `ssh` is the real, working invocation,
  // resolved from PATH. Note: an inherited `GIT_SSH_COMMAND` env var takes
  // precedence over `core.sshCommand` and is not neutralized here — see #200.
  "-c",
  "core.sshCommand=ssh",
  "-c",
  "core.pager=cat",
];

/**
 * Environment applied to every git invocation.
 *
 * - `GIT_TERMINAL_PROMPT=0`: an auth prompt fails fast instead of hanging.
 * - `GIT_CONFIG_NOSYSTEM=1`: ignore the system-wide git config.
 * - `GIT_CONFIG_GLOBAL=/dev/null`: ignore the user-global git config.
 */
function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  };
}

/** Result of a git invocation that did not throw. */
export interface GitResult {
  stdout: string;
  stderr: string;
}

/**
 * Error thrown by {@link gitExecFile} when git exits non-zero, times out, or
 * cannot be spawned. Carries the captured `stderr` so callers can classify it.
 */
export class GitExecError extends Error {
  readonly stderr: string;
  readonly stdout: string;

  constructor(message: string, stdout: string, stderr: string) {
    super(message);
    this.name = "GitExecError";
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * Runs `git` with the given args (no shell — `execFile`, injection-safe).
 *
 * Every call is bounded by a 120s timeout, runs with a hardened environment,
 * and is prefixed with config `-c` overrides that disable hook/pager/ssh
 * config-driven process spawning. Throws {@link GitExecError} on any failure.
 *
 * @param args git arguments AFTER the config overrides (e.g. `["status", "--porcelain"]`)
 * @param cwd  working directory the git command runs in
 */
export async function gitExecFile(
  args: string[],
  cwd: string
): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "git",
      [...GIT_CONFIG_OVERRIDES, ...args],
      {
        cwd,
        encoding: "utf8",
        timeout: GIT_TIMEOUT_MS,
        killSignal: "SIGKILL",
        env: gitEnv(),
      }
    );
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    const stdout = e.stdout ? e.stdout.toString() : "";
    const stderr = e.stderr ? e.stderr.toString() : "";
    throw new GitExecError(e.message ?? String(err), stdout, stderr);
  }
}

/**
 * Rejects a value that git would parse as an option flag rather than a
 * positional argument. A `baseRef` like "--no-checkout" or a `branch` like
 * "--lock" would silently alter git's behavior; this guard closes that.
 *
 * @returns an error message string when the value is unsafe, or null when ok.
 */
export function optionInjectionError(
  field: string,
  value: string
): string | null {
  if (value.startsWith("-")) {
    return `Invalid ${field}: value "${value}" starts with "-" and would be parsed by git as an option flag. Refusing.`;
  }
  return null;
}

/**
 * Distills a {@link GitExecError} into a single trimmed, human-readable line.
 *
 * Prefers the first non-empty line of git's `stderr` (the actual diagnostic),
 * falling back to the first line of the error `message`. Never returns the
 * full multi-line `Error: Command failed: git ...` blob.
 */
export function cleanGitError(err: unknown): string {
  if (err instanceof GitExecError && err.stderr.trim().length > 0) {
    const firstLine = err.stderr
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (firstLine) {
      return firstLine;
    }
  }
  const message =
    err instanceof Error ? err.message : String(err);
  const firstLine = message
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return firstLine ?? "Unknown git error";
}
