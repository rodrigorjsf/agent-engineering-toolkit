import * as path from "path";
import * as fs from "fs";
import { loadHandoffConfig } from "../handoff-config.js";
import { resolveRunDir } from "../run-dir.js";

// The context-watchdog watches TWO budgets the orchestrator session can exhaust
// and raises a handoff flag once either reaches its configured threshold:
//
//   1. The CONTEXT WINDOW — estimated by reading the latest assistant turn's
//      token usage out of the session transcript.
//   2. The SESSION SPAWN BUDGET — the platform caps how many subagents one
//      session may spawn (200 by default, `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION`).
//      At roughly five spawns per slice a long run can spend that budget well
//      before it fills its context, so a watchdog that only watched tokens
//      would report all-clear while the run walked into an unrecoverable spawn
//      error. The spawn count is derived from the run's own append-only spawn
//      log, which this hook writes: every `Agent` tool call observed while the
//      run is in progress appends one line.
//
// Two properties of that counting path are worth stating rather than leaving a
// reader to discover them:
//
//   - `PostToolUse` fires after the tool SUCCEEDS, so a synchronous Agent call
//     is recorded when the subagent FINISHES, not when it is spawned. That is
//     acceptable for a cumulative, monotonic budget — the platform counts a
//     finished subagent too — but it means the count trails in-flight spawns.
//   - Plugin hooks fire INSIDE subagents as well, so a nested spawn (a slice
//     executor spawning its own worker) is recorded whenever that event
//     resolves to the same active run — which is what the platform's session
//     budget counts, and what a scan of the orchestrator's own transcript never
//     could. But that resolution has two conditions, and neither is guaranteed
//     for a subagent-fired event. It runs through the event's `cwd` — the run is
//     discovered by scanning `<cwd>/.orchestrate/runs/`, and the vendor
//     documents `cwd` only as "the current working directory when the hook is
//     invoked", never stating what a subagent-fired event carries — and it then
//     needs either a `session_id`-to-`driverSessionId` match or exactly one
//     in-progress run (see `run-discovery.ts`), so with two concurrent runs an
//     unmatched event resolves to null. An unresolved event is a silent no-op,
//     so the recorded count is a LOWER BOUND on the platform's: the watchdog can
//     raise later than ideal, never earlier on a spawn it imagined.
//
// The pure functions below are the testable core; `runWatchdog` wires them to
// the filesystem. Nothing here ever throws — a watchdog that crashes a session
// is worse than one that misses.

// ─── Token usage parsing ──────────────────────────────────────────────────────

/** The input-side token counts of a single assistant turn. */
export interface TokenUsage {
  inputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

/** The watchdog's verdict for one sample of both budgets. */
export interface WatchdogEvaluation {
  /** Null when token usage was not observable — an absent or lagging transcript. */
  usedTokens: number | null;
  contextWindowTokens: number;
  thresholdPercent: number;
  /**
   * Used tokens as a percentage of the window, rounded to one decimal. Null
   * whenever `usedTokens` is null — an unknown figure is never reported as 0%.
   */
  usagePercent: number | null;
  /** Subagent spawns recorded for this run so far. */
  spawnCount: number;
  sessionSpawnBudget: number;
  spawnThresholdPercent: number;
  /** Spawns as a percentage of the budget, rounded to one decimal. */
  spawnPercent: number;
  /** True once EITHER budget reached its threshold. */
  overThreshold: boolean;
  /**
   * Which budget raised the verdict — the discriminant that makes "whichever
   * threshold arrives first" observable in the flag file and lets the CLI say
   * the true reason. Null when neither is over.
   */
  trigger: "tokens" | "spawns" | null;
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
 * Reads one spawn-log line's session tag, or null when the line carries none —
 * because it is a legacy line written before spawns were tagged, because its
 * `session` is not a string or is the EMPTY string (no identity at all), or
 * because the line does not parse at all.
 */
function lineSessionId(line: string): string | null {
  try {
    const entry: unknown = JSON.parse(line);
    if (typeof entry !== "object" || entry === null) return null;
    const session = (entry as Record<string, unknown>).session;
    return typeof session === "string" && session.length > 0 ? session : null;
  } catch {
    return null;
  }
}

/**
 * Counts the spawns in a spawn log that count against `sessionId`'s budget.
 * Pure.
 *
 * The log lives in the per-RUN directory and is append-only, but the budget it
 * is measured against is the platform's per-SESSION cap, which RESETS in a new
 * session. A handoff keeps the same runId — and therefore the same log — so
 * counting every line would make every successor session re-raise on its first
 * spawn and degrade the run to one slice per session. Counting is therefore
 * partitioned by session: a line tagged with a DIFFERENT session is skipped.
 *
 * Session-tagging rather than clearing the log on resume is deliberate. Section
 * 1 also resumes a run WITHOUT a handoff — a re-invocation in the same session,
 * whose real budget did not reset — and clearing the log there would under-count
 * a session that had already spent part of its budget.
 *
 * An UNTAGGED line — a legacy log from before tagging, or an unparseable one —
 * counts toward whichever session is asking. It cannot be attributed, and
 * over-counting only hands off early, while under-counting is what walks a run
 * into an unrecoverable spawn error. Passing no `sessionId` counts every line,
 * for the same reason — as does passing an EMPTY one, which is no identity at
 * all: partitioning on it would match no line ever written and so hide the
 * whole log, the under-count this rule exists to prevent.
 *
 * A torn final line (a partially-flushed append) is counted, but it does not
 * inflate the total: having no trailing newline, it is what the NEXT append
 * merges into, so a torn write costs one line rather than adding one — a
 * bounded under-count of 1, not an over-count.
 */
export function countSpawns(logText: string, sessionId?: string): number {
  const asking =
    sessionId !== undefined && sessionId.length > 0 ? sessionId : null;

  let count = 0;
  for (const line of logText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    const tag = lineSessionId(trimmed);
    if (asking !== null && tag !== null && tag !== asking) continue;

    count++;
  }
  return count;
}

/**
 * Compares BOTH budgets against their thresholds. Pure. `overThreshold` is true
 * once *either* budget reaches its threshold (>=), so a threshold of 40 fires
 * exactly at 40% on either axis.
 *
 * A null `usedTokens` — an absent or still-lagging transcript — skips the TOKEN
 * comparison only; the spawn comparison still runs, which is what makes the
 * spawn threshold fire independently of token usage.
 *
 * TIEBREAK: when both budgets cross on the same sample, `trigger` reports
 * `'tokens'`. The choice is arbitrary but must be deterministic — the flag is
 * written once, so it can name only one reason, and tokens are the older, more
 * familiar signal.
 */
export function evaluateWatchdog(args: {
  usedTokens: number | null;
  contextWindowTokens: number;
  thresholdPercent: number;
  spawnCount: number;
  sessionSpawnBudget: number;
  spawnThresholdPercent: number;
}): WatchdogEvaluation {
  const tokenRatio =
    args.usedTokens === null
      ? null
      : (args.usedTokens / args.contextWindowTokens) * 100;
  const spawnRatio = (args.spawnCount / args.sessionSpawnBudget) * 100;

  const tokensOver = tokenRatio !== null && tokenRatio >= args.thresholdPercent;
  const spawnsOver = spawnRatio >= args.spawnThresholdPercent;

  return {
    usedTokens: args.usedTokens,
    contextWindowTokens: args.contextWindowTokens,
    thresholdPercent: args.thresholdPercent,
    usagePercent: tokenRatio === null ? null : Math.round(tokenRatio * 10) / 10,
    spawnCount: args.spawnCount,
    sessionSpawnBudget: args.sessionSpawnBudget,
    spawnThresholdPercent: args.spawnThresholdPercent,
    spawnPercent: Math.round(spawnRatio * 10) / 10,
    overThreshold: tokensOver || spawnsOver,
    trigger: tokensOver ? "tokens" : spawnsOver ? "spawns" : null,
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

// ─── Spawn-log recording ──────────────────────────────────────────────────────

/**
 * The tool whose `PostToolUse` event means a subagent was spawned. The hook
 * matcher is `.*` (it sees every tool call), so the watchdog selects the spawn
 * events itself.
 */
const SPAWN_TOOL_NAME = "Agent";

/**
 * Appends one line to the run's spawn log, TAGGED with the session that made
 * the spawn — the tag is what lets a successor session count only its own
 * spawns against its own fresh budget. Best-effort: a write failure is
 * swallowed, leaving the count one short rather than disrupting the session.
 * `appendFileSync` creates the file when absent, and each line is a short,
 * single write, so concurrent hook processes interleave lines rather than
 * corrupting each other's.
 */
function recordSpawn(spawnLogPath: string, sessionId?: string): void {
  try {
    fs.mkdirSync(path.dirname(spawnLogPath), { recursive: true });
    fs.appendFileSync(
      spawnLogPath,
      JSON.stringify({
        at: new Date().toISOString(),
        tool: SPAWN_TOOL_NAME,
        session: sessionId ?? null,
      }) + "\n"
    );
  } catch {
    // Best-effort — an unwritable spawn log must not disrupt the session.
  }
}

/**
 * Reads the run's spawn log and counts the lines charged to `sessionId`. An
 * absent or unreadable log is 0 — a run that has spawned nothing and a log the
 * hook could not read are the same "no evidence of spawn pressure", and neither
 * justifies a handoff.
 */
function readSpawnCount(spawnLogPath: string, sessionId?: string): number {
  try {
    return countSpawns(fs.readFileSync(spawnLogPath, "utf8"), sessionId);
  } catch {
    return 0;
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
 * `.orchestrate/runs/<runId>/`) when the flag is raised. It records `trigger`
 * — which budget raised it — plus both budgets' figures, so which threshold
 * arrived first is readable after the fact rather than inferred. The token
 * fields are null on a spawn-triggered raise whose transcript was unreadable:
 * unknown usage is recorded as unknown, never as zero.
 */
interface ContextFlag {
  raisedAt: string;
  trigger: "tokens" | "spawns";
  usedTokens: number | null;
  contextWindowTokens: number;
  thresholdPercent: number;
  usagePercent: number | null;
  spawnCount: number;
  sessionSpawnBudget: number;
  spawnThresholdPercent: number;
  spawnPercent: number;
}

/**
 * Records the spawn this event represents, samples both budgets — context
 * usage from the session transcript, spawn count from the run's spawn log —
 * and raises the handoff flag when either reaches its configured threshold.
 *
 * The watchdog only acts while the named run is in progress — it checks the
 * per-run `run-state.json` under `.orchestrate/runs/<runId>/` first and is a
 * silent no-op otherwise, so the bundled hook is harmless in unrelated
 * sessions. Spawns made before the run started are therefore not counted.
 *
 * The spawn log is stored per RUN but counted per SESSION: the platform's cap
 * is a session cap that resets in a new session, while the log survives a
 * handoff along with the runId. Every line is tagged with the session that
 * wrote it and {@link countSpawns} charges only the current session's lines, so
 * a successor starts from its own fresh budget while a same-session resume
 * keeps counting the spawns that session already spent.
 *
 * Unknown token usage — an absent `transcriptPath`, an unreadable transcript,
 * or one whose latest turns carry no usage yet (the transcript is written
 * asynchronously and may lag) — skips only the TOKEN comparison. The spawn
 * comparison still runs, which is what makes the spawn threshold independent of
 * token usage rather than silently defeated by it.
 *
 * The flag is written at most once per run, across BOTH thresholds: the
 * `fs.existsSync(flagPath)` check is a filesystem latch, not an in-memory one,
 * so whichever budget writes the flag first suppresses every later raise — and
 * it survives the hook's per-invocation process, which no in-memory latch
 * would. Never throws.
 */
export function runWatchdog(input: {
  transcriptPath?: string;
  cwd: string;
  runId: string;
  /**
   * The `tool_name` of the `PostToolUse` event. When it is the spawn tool, this
   * invocation appends one line to the run's spawn log before evaluating, so
   * the spawn it represents is counted in this very sample.
   */
  toolName?: string;
  /**
   * The `session_id` of the event — the session whose spawn budget this spawn
   * is charged against. It tags the log line written here and selects which
   * lines are counted. Absent (an event with no session identity), every line
   * counts: the count cannot be partitioned, and over-counting is the safe
   * direction.
   */
  sessionId?: string;
}): WatchdogResult {
  // 1. Resolve the per-run paths; a malformed runId is a silent no-op.
  const resolved = resolveRunDir(input.cwd, input.runId);
  if (!resolved.ok) {
    return { acted: false, flagRaised: false };
  }
  const {
    runStatePath,
    contextFlagPath: flagPath,
    spawnLogPath,
  } = resolved.paths;

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

  // 3. Record the spawn this event represents, so it counts in this sample.
  //    Deliberately BEHIND the in-progress guard: only a live run's spawns
  //    count toward the budget the run hands off on.
  if (input.toolName === SPAWN_TOOL_NAME) {
    recordSpawn(spawnLogPath, input.sessionId);
  }

  // 4. Estimate token usage from the latest assistant turn. Every failure mode
  //    here — no transcript path, an unreadable file, no usage recorded yet —
  //    resolves to `null` (unknown) rather than RETURNING, so the spawn
  //    threshold below is evaluated either way. This is the difference between
  //    a second threshold that works and one that is silently defeated by a
  //    transcript that has not been flushed yet.
  let usedTokens: number | null = null;
  if (input.transcriptPath) {
    try {
      const usage = parseLatestUsage(readTranscriptText(input.transcriptPath));
      if (usage) usedTokens = contextTokens(usage);
    } catch {
      usedTokens = null;
    }
  }

  // 5. Evaluate BOTH budgets against the (possibly defaulted) config.
  const { config } = loadHandoffConfig(input.cwd);
  const evaluation = evaluateWatchdog({
    usedTokens,
    contextWindowTokens: config.watchdog.contextWindowTokens,
    thresholdPercent: config.watchdog.thresholdPercent,
    spawnCount: readSpawnCount(spawnLogPath, input.sessionId),
    sessionSpawnBudget: config.watchdog.sessionSpawnBudget,
    spawnThresholdPercent: config.watchdog.spawnThresholdPercent,
  });

  // 6. Both budgets below threshold, or the flag is already raised — nothing to
  //    do. The `existsSync` check is what keeps the raise at most once per run
  //    no matter which budget crosses first, or how many cross later.
  if (
    !evaluation.overThreshold ||
    evaluation.trigger === null ||
    fs.existsSync(flagPath)
  ) {
    return { acted: true, flagRaised: false, flagPath, evaluation };
  }

  // 7. Raise the flag, naming the budget that raised it.
  const flag: ContextFlag = {
    raisedAt: new Date().toISOString(),
    trigger: evaluation.trigger,
    usedTokens: evaluation.usedTokens,
    contextWindowTokens: evaluation.contextWindowTokens,
    thresholdPercent: evaluation.thresholdPercent,
    usagePercent: evaluation.usagePercent,
    spawnCount: evaluation.spawnCount,
    sessionSpawnBudget: evaluation.sessionSpawnBudget,
    spawnThresholdPercent: evaluation.spawnThresholdPercent,
    spawnPercent: evaluation.spawnPercent,
  };
  try {
    fs.mkdirSync(path.dirname(flagPath), { recursive: true });
    fs.writeFileSync(flagPath, JSON.stringify(flag, null, 2));
  } catch {
    return { acted: true, flagRaised: false, flagPath, evaluation };
  }
  return { acted: true, flagRaised: true, flagPath, evaluation };
}
