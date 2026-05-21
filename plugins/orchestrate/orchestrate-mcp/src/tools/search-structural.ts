import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

// `search_structural` runs syntax-aware code search via the `ast-grep` CLI, so
// the investigator and reviewer subagents can match code by structure instead
// of brittle text. When `ast-grep` is not installed the tool reports
// `status: "unavailable"` — a clean signal, not an error — and the caller
// falls back to text search. This function never throws.

// ─── Limits ───────────────────────────────────────────────────────────────────

/** Structural search is fast; 30s is a generous ceiling for a runaway scan. */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Hard ceiling on captured ast-grep output (bytes). */
const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;
/** Maximum matches returned — a structural search wants a focused set. */
const MAX_MATCHES = 100;
/** Per-match snippet character cap. */
const MAX_SNIPPET_CHARS = 2_000;
/**
 * The ast-grep binary. Deliberately the full name `ast-grep`, never the `sg`
 * alias — `sg` collides with the standard POSIX set-group command, so invoking
 * `sg` would run an unrelated system utility.
 */
const ASTGREP_BINARY = "ast-grep";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

const structuralMatchSchema = z.object({
  file: z
    .string()
    .describe("Path of the file containing the match, as reported by ast-grep."),
  startLine: z
    .number()
    .int()
    .describe("First line of the match, as reported by ast-grep."),
  endLine: z
    .number()
    .int()
    .describe("Last line of the match, as reported by ast-grep."),
  snippet: z
    .string()
    .describe("The matched source text, capped to 2000 characters."),
});

export const searchStructuralInputSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .describe(
      "An ast-grep pattern — code with metavariables, e.g. `console.log($A)` " +
        "or `function $N($$$) { $$$ }`. Matches code by syntax, not text."
    ),
  language: z
    .string()
    .optional()
    .describe(
      "ast-grep language id the pattern is parsed in, e.g. 'typescript', " +
        "'tsx', 'python', 'rust', 'go'. Recommended — a pattern is grammar-" +
        "specific."
    ),
  path: z
    .string()
    .optional()
    .describe(
      "File or directory to search, relative to repoPath. Defaults to the " +
        "whole repository."
    ),
  repoPath: z
    .string()
    .optional()
    .describe(
      "Repository root the search runs in. Defaults to the MCP server's " +
        "current working directory — callers should pass it explicitly."
    ),
});

export const searchStructuralOutputSchema = z.object({
  status: z
    .enum(["ok", "unavailable", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the search ran; 'unavailable' = the " +
        "ast-grep binary is not installed, so the caller should fall back to " +
        "text search; 'error' = ast-grep ran but the search failed."
    ),
  matches: z
    .array(structuralMatchSchema)
    .optional()
    .describe(
      "Structural matches found. Present when status='ok'. Empty when nothing " +
        "matched."
    ),
  matchCount: z
    .number()
    .int()
    .optional()
    .describe("Number of matches in `matches`. Present when status='ok'."),
  truncated: z
    .boolean()
    .optional()
    .describe(
      `True when more than ${MAX_MATCHES} matches were found and \`matches\` ` +
        "was capped. Present when status='ok'."
    ),
  errorCode: z
    .enum(["ASTGREP_FAILED", "BAD_OUTPUT", "TIMEOUT"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'. " +
        "'ASTGREP_FAILED' = ast-grep exited non-zero (often an invalid " +
        "pattern); 'BAD_OUTPUT' = its output could not be parsed; 'TIMEOUT' = " +
        "the search exceeded the time limit."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Human-readable description — why the search failed (status='error') " +
        "or why ast-grep is unavailable (status='unavailable')."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type StructuralMatch = z.infer<typeof structuralMatchSchema>;
export type SearchStructuralInput = z.infer<typeof searchStructuralInputSchema>;
export type SearchStructuralOutput = z.infer<typeof searchStructuralOutputSchema>;

/**
 * Internal execution overrides. NOT exposed as an MCP tool input — the only
 * caller-facing input is {@link SearchStructuralInput}. Used by tests to
 * shorten the timeout, substitute a fake `ast-grep` binary, or lower the
 * maxBuffer ceiling to exercise the overflow branch without 16 MB of output.
 */
export interface SearchStructuralOptions {
  timeoutMs?: number;
  binary?: string;
  maxBufferBytes?: number;
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

/**
 * Parses ast-grep's `--json` output (a JSON array of match objects) into the
 * tool's match shape. Pure — never throws. Returns `{ ok: false }` when the
 * text is not a JSON array; an empty string parses to zero matches.
 */
export function parseAstGrepJson(
  stdout: string
): { ok: true; matches: StructuralMatch[] } | { ok: false } {
  const trimmed = stdout.trim();
  if (!trimmed) return { ok: true, matches: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false };
  }
  if (!Array.isArray(parsed)) return { ok: false };

  const matches: StructuralMatch[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;

    const file = typeof rec.file === "string" ? rec.file : null;
    if (file === null) continue;

    const range = (typeof rec.range === "object" && rec.range !== null
      ? rec.range
      : {}) as Record<string, unknown>;
    const start = (typeof range.start === "object" && range.start !== null
      ? range.start
      : {}) as Record<string, unknown>;
    const end = (typeof range.end === "object" && range.end !== null
      ? range.end
      : {}) as Record<string, unknown>;
    const startLine = typeof start.line === "number" ? start.line : 0;
    const endLine = typeof end.line === "number" ? end.line : startLine;

    const rawSnippet =
      typeof rec.lines === "string"
        ? rec.lines
        : typeof rec.text === "string"
          ? rec.text
          : "";
    const snippet =
      rawSnippet.length > MAX_SNIPPET_CHARS
        ? rawSnippet.slice(0, MAX_SNIPPET_CHARS) + "…"
        : rawSnippet;

    matches.push({ file, startLine, endLine, snippet });
  }
  return { ok: true, matches };
}

/** Caps the match list to {@link MAX_MATCHES} and builds the `ok` result. */
function buildOk(matches: StructuralMatch[]): SearchStructuralOutput {
  const truncated = matches.length > MAX_MATCHES;
  const capped = truncated ? matches.slice(0, MAX_MATCHES) : matches;
  return {
    status: "ok",
    matches: capped,
    matchCount: capped.length,
    truncated,
  };
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Runs a syntax-aware code search with `ast-grep`.
 *
 * Spawns `ast-grep run --json --pattern <pattern> [--lang <language>] <path>`
 * with no shell. A missing `ast-grep` binary resolves to `status: "unavailable"`
 * so the caller can fall back to text search; every other failure mode is a
 * structured `error`. Never throws.
 */
export async function searchStructural(
  input: SearchStructuralInput,
  opts: SearchStructuralOptions = {}
): Promise<SearchStructuralOutput> {
  const cwd = input.repoPath ?? process.cwd();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const binary = opts.binary ?? ASTGREP_BINARY;
  const maxBuffer = opts.maxBufferBytes ?? MAX_CAPTURE_BYTES;
  const searchPath = input.path ?? ".";

  // `--json` is placed before the value-taking flags so it can never consume
  // the positional path. `--` terminates option parsing so a leading `-` in
  // the search path is never misparsed as a flag; the path is always last.
  const args = ["run", "--json", "--pattern", input.pattern];
  if (input.language) args.push("--lang", input.language);
  args.push("--", searchPath);

  try {
    const { stdout } = await execFileAsync(binary, args, {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      maxBuffer,
      windowsHide: true,
    });
    const parsed = parseAstGrepJson(stdout.toString());
    if (!parsed.ok) {
      return {
        status: "error",
        errorCode: "BAD_OUTPUT",
        errorMessage: "ast-grep output could not be parsed as JSON.",
      };
    }
    return buildOk(parsed.matches);
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      code?: string | number;
      killed?: boolean;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };

    // Binary missing or not executable — the caller falls back to text search.
    if (e.code === "ENOENT" || e.code === "EACCES") {
      return {
        status: "unavailable",
        errorMessage:
          `The 'ast-grep' binary is not available (${e.code}). ` +
          "Fall back to text search.",
      };
    }
    // Output exceeded the capture ceiling. Checked before the `e.killed`
    // timeout branch: a maxBuffer overflow also kills the child, so the
    // specific error code must be matched first or an overflow would be
    // misreported as a TIMEOUT.
    if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      return {
        status: "error",
        errorCode: "ASTGREP_FAILED",
        errorMessage: `ast-grep output exceeded the ${maxBuffer}-byte capture limit.`,
      };
    }
    // The timeout SIGKILLed the child.
    if (e.killed) {
      return {
        status: "error",
        errorCode: "TIMEOUT",
        errorMessage: `Structural search exceeded the ${timeoutMs} ms time limit.`,
      };
    }
    // ast-grep ran and exited non-zero. It may still have emitted valid JSON
    // (some result modes do); parse defensively before declaring failure.
    if (typeof e.code === "number") {
      const out = e.stdout ? e.stdout.toString() : "";
      const parsed = parseAstGrepJson(out);
      if (parsed.ok && out.trim()) {
        return buildOk(parsed.matches);
      }
      const errText = e.stderr ? e.stderr.toString() : "";
      return {
        status: "error",
        errorCode: "ASTGREP_FAILED",
        errorMessage: `ast-grep exited ${e.code}: ${firstLine(
          errText || e.message || String(err)
        )}`,
      };
    }
    // Any other spawn failure — treat as unavailable so the caller falls back.
    return {
      status: "unavailable",
      errorMessage:
        `ast-grep could not be run: ${firstLine(e.message ?? String(err))}. ` +
        "Fall back to text search.",
    };
  }
}
