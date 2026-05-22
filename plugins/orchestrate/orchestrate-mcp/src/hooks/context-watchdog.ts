import * as path from "path";
import * as fs from "fs";
import { loadHandoffConfig } from "../handoff-config.js";
import { resolveRunDir } from "../run-dir.js";

// The context-watchdog estimates how full the orchestrator session's context
// window is by reading the session transcript, and raises a handoff flag once
// usage passes a configurable threshold. The pure functions below are the
// testable core; `runWatchdog` wires them to the filesystem. Nothing here ever
// throws — a watchdog that crashes a session is worse than one that misses.

// ─── Token usage parsing ──────────────────────────────────────────────────────

/** The input-side token counts of a single assistant turn. */
export interface TokenUsage {
  inputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

/** The watchdog's verdict for one transcript sample. */
export interface WatchdogEvaluation {
  usedTokens: number;
  contextWindowTokens: number;
  thresholdPercent: number;
  /** Used tokens as a percentage of the window, rounded to one decimal. */
  usagePercent: number;
  overThreshold: boolean;
}

/**
 * Extracts the most recent assistant turn's token usage from a transcript.
 *
 * The transcript is JSONL: one JSON object per line. An assistant turn is a
 * line with `type: "assistant"` and a `message.usage` object. The *last* such
 * line reflects current context occupancy, so the scan runs back to front and
 * returns on the first match. Pure — no I/O. Returns null when the transcript
 * carries no assistant usage yet.
 */
export function parseLatestUsage(transcriptText: string): TokenUsage | null {
  const lines = transcriptText.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;

    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // a partially-written or non-JSON line — skip it
    }

    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (record.type !== "assistant") continue;

    const message = record.message;
    if (typeof message !== "object" || message === null) continue;
    const usage = (message as Record<string, unknown>).usage;
    if (typeof usage !== "object" || usage === null) continue;

    const u = usage as Record<string, unknown>;
    if (typeof u.input_tokens !== "number") continue;

    return {
      inputTokens: u.input_tokens,
      cacheCreationInputTokens:
        typeof u.cache_creation_input_tokens === "number"
          ? u.cache_creation_input_tokens
          : 0,
      cacheReadInputTokens:
        typeof u.cache_read_input_tokens === "number"
          ? u.cache_read_input_tokens
          : 0,
    };
  }
  return null;
}

/**
 * Total context occupancy of a turn: the prompt actually sent to the model —
 * fresh input plus cache-creation plus cache-read tokens. Output tokens are
 * excluded; they are the reply, not the standing context. Pure.
 */
export function contextTokens(usage: TokenUsage): number {
  return (
    usage.inputTokens +
    usage.cacheCreationInputTokens +
    usage.cacheReadInputTokens
  );
}

/**
 * Compares used tokens against the window and threshold. Pure. `overThreshold`
 * is true once usage *reaches* the threshold (>=), so a threshold of 40 fires
 * exactly at 40%.
 */
export function evaluateWatchdog(args: {
  usedTokens: number;
  contextWindowTokens: number;
  thresholdPercent: number;
}): WatchdogEvaluation {
  const ratio = (args.usedTokens / args.contextWindowTokens) * 100;
  return {
    usedTokens: args.usedTokens,
    contextWindowTokens: args.contextWindowTokens,
    thresholdPercent: args.thresholdPercent,
    usagePercent: Math.round(ratio * 10) / 10,
    overThreshold: ratio >= args.thresholdPercent,
  };
}

// ─── Transcript reading ───────────────────────────────────────────────────────

/** Upper bound on bytes read from the tail of a transcript. */
const TRANSCRIPT_TAIL_BYTES = 1024 * 1024;

/**
 * Reads the transcript, capping the read at the last {@link TRANSCRIPT_TAIL_BYTES}.
 * The watchdog only needs the latest assistant turn, which sits near the end,
 * and transcripts grow without bound — so reading the whole file on every tool
 * call would be needless I/O. A tail read may start mid-line; that truncated
 * first line simply fails to parse and is skipped by {@link parseLatestUsage},
 * which scans back to front anyway.
 */
function readTranscriptText(transcriptPath: string): string {
  const stat = fs.statSync(transcriptPath);
  if (stat.size <= TRANSCRIPT_TAIL_BYTES) {
    return fs.readFileSync(transcriptPath, "utf8");
  }
  const fd = fs.openSync(transcriptPath, "r");
  try {
    const buf = Buffer.alloc(TRANSCRIPT_TAIL_BYTES);
    const bytesRead = fs.readSync(
      fd,
      buf,
      0,
      TRANSCRIPT_TAIL_BYTES,
      stat.size - TRANSCRIPT_TAIL_BYTES
    );
    return buf.toString("utf8", 0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

// ─── Hook orchestration ───────────────────────────────────────────────────────

/** The outcome of one `runWatchdog` invocation. */
export interface WatchdogResult {
  /** True only when an orchestration run is active and the watchdog ran. */
  acted: boolean;
  /** True only when this invocation newly created the flag file. */
  flagRaised: boolean;
  flagPath?: string;
  evaluation?: WatchdogEvaluation;
}

/**
 * Shape written to the per-run `context-flag.json` (under
 * `.orchestrate/runs/<runId>/`) when the flag is raised.
 */
interface ContextFlag {
  raisedAt: string;
  usedTokens: number;
  contextWindowTokens: number;
  thresholdPercent: number;
  usagePercent: number;
}

/**
 * Scans `.orchestrate/runs/*` for the single run whose `run-state.json` has
 * `status: "in-progress"` and returns its `runId`, or null when none is found.
 * Pure-ish — reads the filesystem but never throws.
 *
 * The `PostToolUse` hook receives only the session `cwd`, not a `runId`, so the
 * watchdog must discover the active run before it can resolve the per-run
 * paths. This deliberately handles only the single-active-run case: a session
 * drives exactly one orchestration run. Disambiguating concurrent runs is a
 * separate concern and out of scope here.
 */
export function discoverActiveRunId(cwd: string): string | null {
  const runsDir = path.join(cwd, ".orchestrate", "runs");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(runsDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const statePath = path.join(runsDir, entry.name, "run-state.json");
    let runState: unknown;
    try {
      runState = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch {
      continue;
    }
    if (
      typeof runState === "object" &&
      runState !== null &&
      (runState as Record<string, unknown>).status === "in-progress"
    ) {
      return entry.name;
    }
  }
  return null;
}

/**
 * Reads the session transcript, estimates context usage, and raises the
 * handoff flag when usage passes the configured threshold.
 *
 * The watchdog only acts while the named run is in progress — it checks the
 * per-run `run-state.json` under `.orchestrate/runs/<runId>/` first and is a
 * silent no-op otherwise, so the bundled hook is harmless in unrelated
 * sessions. The flag is written at most once per run: if the per-run
 * `context-flag.json` already exists this is a no-op. Never throws.
 */
export function runWatchdog(input: {
  transcriptPath?: string;
  cwd: string;
  runId: string;
}): WatchdogResult {
  // 1. Resolve the per-run paths; a malformed runId is a silent no-op.
  const resolved = resolveRunDir(input.cwd, input.runId);
  if (!resolved.ok) {
    return { acted: false, flagRaised: false };
  }
  const { runStatePath, contextFlagPath: flagPath } = resolved.paths;

  // 2. Act only while this orchestration run is in progress.
  let runState: unknown;
  try {
    runState = JSON.parse(fs.readFileSync(runStatePath, "utf8"));
  } catch {
    return { acted: false, flagRaised: false };
  }
  if (
    typeof runState !== "object" ||
    runState === null ||
    (runState as Record<string, unknown>).status !== "in-progress"
  ) {
    return { acted: false, flagRaised: false };
  }

  // 3. A transcript is required to estimate usage.
  if (!input.transcriptPath) return { acted: true, flagRaised: false, flagPath };
  let transcriptText: string;
  try {
    transcriptText = readTranscriptText(input.transcriptPath);
  } catch {
    return { acted: true, flagRaised: false, flagPath };
  }

  // 4. Estimate usage from the latest assistant turn.
  const usage = parseLatestUsage(transcriptText);
  if (!usage) return { acted: true, flagRaised: false, flagPath };

  // 5. Evaluate against the (possibly defaulted) config.
  const { config } = loadHandoffConfig(input.cwd);
  const evaluation = evaluateWatchdog({
    usedTokens: contextTokens(usage),
    contextWindowTokens: config.watchdog.contextWindowTokens,
    thresholdPercent: config.watchdog.thresholdPercent,
  });

  // 6. Below threshold, or the flag is already raised — nothing to do.
  if (!evaluation.overThreshold || fs.existsSync(flagPath)) {
    return { acted: true, flagRaised: false, flagPath, evaluation };
  }

  // 7. Raise the flag.
  const flag: ContextFlag = {
    raisedAt: new Date().toISOString(),
    usedTokens: evaluation.usedTokens,
    contextWindowTokens: evaluation.contextWindowTokens,
    thresholdPercent: evaluation.thresholdPercent,
    usagePercent: evaluation.usagePercent,
  };
  try {
    fs.mkdirSync(path.dirname(flagPath), { recursive: true });
    fs.writeFileSync(flagPath, JSON.stringify(flag, null, 2));
  } catch {
    return { acted: true, flagRaised: false, flagPath, evaluation };
  }
  return { acted: true, flagRaised: true, flagPath, evaluation };
}
