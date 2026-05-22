import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  parseLatestUsage,
  contextTokens,
  evaluateWatchdog,
  runWatchdog,
  discoverActiveRunId,
  findActiveRunForSession,
} from "../src/hooks/context-watchdog.js";

// ─── Transcript fixtures ──────────────────────────────────────────────────────

/** A transcript assistant line carrying the given input-side token counts. */
function assistantLine(
  inputTokens: number,
  cacheCreation: number,
  cacheRead: number
): string {
  return JSON.stringify({
    type: "assistant",
    message: {
      role: "assistant",
      model: "claude-opus-4-7",
      usage: {
        input_tokens: inputTokens,
        cache_creation_input_tokens: cacheCreation,
        cache_read_input_tokens: cacheRead,
        output_tokens: 100,
      },
    },
  });
}

/** A non-assistant transcript line (user turn) — carries no usage. */
function userLine(text: string): string {
  return JSON.stringify({ type: "user", message: { role: "user", content: text } });
}

// ─── Test project scaffolding ─────────────────────────────────────────────────

const created: string[] = [];

/** The runId every test fixture uses unless a test needs a second run. */
const RUN_ID = "20260521-015143";

/**
 * Creates a temp project dir. `runState` and `flag` are written under the
 * per-run directory `.orchestrate/runs/<runId>/`; `handoff.json` stays flat at
 * `.orchestrate/` (it is committed config, not ephemeral run state).
 */
function project(opts: {
  runState?: unknown;
  handoff?: unknown;
  transcript?: string;
  flag?: unknown;
  runId?: string;
}): { dir: string; transcriptPath?: string } {
  const runId = opts.runId ?? RUN_ID;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-watchdog-"));
  created.push(dir);
  const runDir = path.join(dir, ".orchestrate", "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });

  if (opts.runState !== undefined) {
    fs.writeFileSync(
      path.join(runDir, "run-state.json"),
      typeof opts.runState === "string"
        ? opts.runState
        : JSON.stringify(opts.runState)
    );
  }
  if (opts.handoff !== undefined) {
    fs.writeFileSync(
      path.join(dir, ".orchestrate", "handoff.json"),
      JSON.stringify(opts.handoff)
    );
  }
  if (opts.flag !== undefined) {
    fs.writeFileSync(
      path.join(runDir, "context-flag.json"),
      JSON.stringify(opts.flag)
    );
  }

  let transcriptPath: string | undefined;
  if (opts.transcript !== undefined) {
    transcriptPath = path.join(dir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, opts.transcript);
  }
  return { dir, transcriptPath };
}

afterEach(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  created.length = 0;
});

function flagPath(dir: string, runId: string = RUN_ID): string {
  return path.join(dir, ".orchestrate", "runs", runId, "context-flag.json");
}

// ─── parseLatestUsage ─────────────────────────────────────────────────────────

describe("parseLatestUsage", () => {
  it("returns the most recent assistant turn's usage", () => {
    const transcript = [
      assistantLine(1, 5000, 10000),
      assistantLine(2, 8000, 90000),
      userLine("a later user turn carries no usage"),
    ].join("\n");

    const usage = parseLatestUsage(transcript);
    expect(usage).not.toBeNull();
    expect(usage!.inputTokens).toBe(2);
    expect(usage!.cacheCreationInputTokens).toBe(8000);
    expect(usage!.cacheReadInputTokens).toBe(90000);
  });

  it("returns null when no assistant turn carries usage", () => {
    const transcript = [userLine("one"), userLine("two")].join("\n");
    expect(parseLatestUsage(transcript)).toBeNull();
  });

  it("returns null for an empty transcript", () => {
    expect(parseLatestUsage("")).toBeNull();
  });

  it("skips malformed (non-JSON) lines without crashing", () => {
    const transcript = [
      assistantLine(1, 100, 200),
      "{ this is not valid json",
      "",
    ].join("\n");

    const usage = parseLatestUsage(transcript);
    expect(usage).not.toBeNull();
    expect(usage!.inputTokens).toBe(1);
  });

  it("defaults missing cache fields to zero", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { role: "assistant", usage: { input_tokens: 42 } },
    });
    const usage = parseLatestUsage(line);
    expect(usage).toEqual({
      inputTokens: 42,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    });
  });
});

// ─── contextTokens ────────────────────────────────────────────────────────────

describe("contextTokens", () => {
  it("sums input, cache-creation, and cache-read tokens", () => {
    expect(
      contextTokens({
        inputTokens: 2,
        cacheCreationInputTokens: 8000,
        cacheReadInputTokens: 90000,
      })
    ).toBe(98002);
  });
});

// ─── evaluateWatchdog ─────────────────────────────────────────────────────────

describe("evaluateWatchdog", () => {
  it("is over threshold when usage exceeds the percentage", () => {
    const e = evaluateWatchdog({
      usedTokens: 110000,
      contextWindowTokens: 200000,
      thresholdPercent: 40,
    });
    expect(e.overThreshold).toBe(true);
    expect(e.usagePercent).toBe(55);
  });

  it("is under threshold when usage is below the percentage", () => {
    const e = evaluateWatchdog({
      usedTokens: 50000,
      contextWindowTokens: 200000,
      thresholdPercent: 40,
    });
    expect(e.overThreshold).toBe(false);
    expect(e.usagePercent).toBe(25);
  });

  it("fires exactly at the threshold boundary (>=)", () => {
    const e = evaluateWatchdog({
      usedTokens: 80000,
      contextWindowTokens: 200000,
      thresholdPercent: 40,
    });
    expect(e.overThreshold).toBe(true);
  });
});

// ─── discoverActiveRunId ──────────────────────────────────────────────────────

describe("discoverActiveRunId", () => {
  it("returns null when there is no .orchestrate/runs directory", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-watchdog-"));
    created.push(dir);
    expect(discoverActiveRunId(dir)).toBeNull();
  });

  it("returns null when no run is in-progress", () => {
    const { dir } = project({ runState: { status: "completed" } });
    expect(discoverActiveRunId(dir)).toBeNull();
  });

  it("returns the runId of the single in-progress run", () => {
    const { dir } = project({ runState: { status: "in-progress" } });
    expect(discoverActiveRunId(dir)).toBe(RUN_ID);
  });

  it("returns null when a run-state.json is malformed", () => {
    const { dir } = project({ runState: "{ not json" });
    expect(discoverActiveRunId(dir)).toBeNull();
  });

  it("ignores a completed run and finds the in-progress one", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-watchdog-"));
    created.push(dir);
    const done = path.join(dir, ".orchestrate", "runs", "20260101-000000");
    const active = path.join(dir, ".orchestrate", "runs", "20260202-000000");
    fs.mkdirSync(done, { recursive: true });
    fs.mkdirSync(active, { recursive: true });
    fs.writeFileSync(
      path.join(done, "run-state.json"),
      JSON.stringify({ status: "completed" })
    );
    fs.writeFileSync(
      path.join(active, "run-state.json"),
      JSON.stringify({ status: "in-progress" })
    );
    expect(discoverActiveRunId(dir)).toBe("20260202-000000");
  });
});

// ─── findActiveRunForSession ──────────────────────────────────────────────────

/**
 * Writes one per-run directory with a `run-state.json` carrying the given
 * `status` and (optionally) `driverSessionId`, inside an existing project dir.
 */
function writeRun(
  dir: string,
  runId: string,
  status: string,
  driverSessionId?: string
): void {
  const runDir = path.join(dir, ".orchestrate", "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  const state: Record<string, unknown> = { runId, status };
  if (driverSessionId !== undefined) state.driverSessionId = driverSessionId;
  fs.writeFileSync(
    path.join(runDir, "run-state.json"),
    JSON.stringify(state)
  );
}

/** A bare temp project dir with no run directories yet. */
function emptyProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-watchdog-"));
  created.push(dir);
  return dir;
}

describe("findActiveRunForSession — identity match", () => {
  it("returns the run whose driverSessionId matches the given session", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "in-progress", "session-A");
    writeRun(dir, "20260202-000000", "in-progress", "session-B");

    expect(findActiveRunForSession(dir, "session-A")).toBe("20260101-000000");
    expect(findActiveRunForSession(dir, "session-B")).toBe("20260202-000000");
  });

  it("matches by identity even when one run-state lacks driverSessionId", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "in-progress", "session-A");
    writeRun(dir, "20260202-000000", "in-progress"); // legacy: no field

    expect(findActiveRunForSession(dir, "session-A")).toBe("20260101-000000");
  });
});

describe("findActiveRunForSession — safe no-op on ambiguity", () => {
  it("returns null when 2 in-progress runs and no session is given", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "in-progress", "session-A");
    writeRun(dir, "20260202-000000", "in-progress", "session-B");

    expect(findActiveRunForSession(dir, undefined)).toBeNull();
  });

  it("returns null when 2 in-progress runs and the session matches none", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "in-progress", "session-A");
    writeRun(dir, "20260202-000000", "in-progress", "session-B");

    expect(findActiveRunForSession(dir, "session-Z")).toBeNull();
  });

  it("returns null when 2 in-progress runs both lack driverSessionId", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "in-progress");
    writeRun(dir, "20260202-000000", "in-progress");

    expect(findActiveRunForSession(dir, "session-A")).toBeNull();
  });

  it("returns null when a session matches two in-progress runs", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "in-progress", "session-A");
    writeRun(dir, "20260202-000000", "in-progress", "session-A");

    expect(findActiveRunForSession(dir, "session-A")).toBeNull();
  });
});

describe("findActiveRunForSession — single in-progress fast path", () => {
  it("returns the sole in-progress run when no session is given", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "in-progress", "session-A");

    expect(findActiveRunForSession(dir, undefined)).toBe("20260101-000000");
  });

  it("returns the sole in-progress run when the session does not match", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "in-progress", "session-A");

    expect(findActiveRunForSession(dir, "session-Z")).toBe("20260101-000000");
  });

  it("returns the sole in-progress run when it has no driverSessionId", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "in-progress"); // legacy run-state

    expect(findActiveRunForSession(dir, "session-A")).toBe("20260101-000000");
    expect(findActiveRunForSession(dir, undefined)).toBe("20260101-000000");
  });
});

describe("findActiveRunForSession — in-progress-only scan", () => {
  it("never selects a completed run, even when its session matches", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "completed", "session-A");
    writeRun(dir, "20260202-000000", "in-progress", "session-B");

    // The completed run carries session-A. Called with session-A, the
    // completed run is excluded from the scan entirely; the only in-progress
    // run (session-B) is then returned by the single-run fast path — the
    // completed run is never the answer.
    expect(findActiveRunForSession(dir, "session-A")).toBe("20260202-000000");
    expect(findActiveRunForSession(dir, "session-B")).toBe("20260202-000000");
  });

  it("returns null when a completed run matches and 2+ runs are in-progress", () => {
    const dir = emptyProject();
    // A completed run carries session-A; two distinct in-progress runs exist.
    writeRun(dir, "20260101-000000", "completed", "session-A");
    writeRun(dir, "20260202-000000", "in-progress", "session-B");
    writeRun(dir, "20260303-000000", "in-progress", "session-C");

    // session-A matches only the completed (excluded) run — no in-progress
    // match, and 2 in-progress runs is ambiguous, so the result is null. The
    // completed run is never selected.
    expect(findActiveRunForSession(dir, "session-A")).toBeNull();
  });

  it("the lone in-progress run wins when the other run is completed", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "completed", "session-A");
    writeRun(dir, "20260202-000000", "in-progress", "session-B");

    // Only one in-progress run, so the fast path applies even with no session.
    expect(findActiveRunForSession(dir, undefined)).toBe("20260202-000000");
  });

  it("returns null when no run is in-progress", () => {
    const dir = emptyProject();
    writeRun(dir, "20260101-000000", "completed", "session-A");

    expect(findActiveRunForSession(dir, "session-A")).toBeNull();
  });

  it("returns null when there is no .orchestrate/runs directory", () => {
    const dir = emptyProject();
    expect(findActiveRunForSession(dir, "session-A")).toBeNull();
  });

  it("ignores a malformed run-state.json without crashing", () => {
    const dir = emptyProject();
    const runDir = path.join(dir, ".orchestrate", "runs", "20260101-000000");
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "run-state.json"), "{ not json");
    writeRun(dir, "20260202-000000", "in-progress", "session-B");

    expect(findActiveRunForSession(dir, "session-B")).toBe("20260202-000000");
  });

  it("ignores a non-string driverSessionId without crashing", () => {
    const dir = emptyProject();
    const runDir = path.join(dir, ".orchestrate", "runs", "20260101-000000");
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(
      path.join(runDir, "run-state.json"),
      JSON.stringify({ status: "in-progress", driverSessionId: 42 })
    );
    writeRun(dir, "20260202-000000", "in-progress", "session-B");

    // The numeric driverSessionId can never match a string session id.
    expect(findActiveRunForSession(dir, "session-B")).toBe("20260202-000000");
    expect(findActiveRunForSession(dir, "session-A")).toBeNull();
  });
});

// ─── runWatchdog ──────────────────────────────────────────────────────────────

describe("runWatchdog — no active run", () => {
  it("is a no-op when run-state.json is absent", () => {
    const { dir, transcriptPath } = project({
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });
    expect(result.acted).toBe(false);
    expect(result.flagRaised).toBe(false);
    expect(fs.existsSync(flagPath(dir))).toBe(false);
  });

  it("is a no-op when the run status is not in-progress", () => {
    const { dir, transcriptPath } = project({
      runState: { status: "completed" },
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });
    expect(result.acted).toBe(false);
    expect(fs.existsSync(flagPath(dir))).toBe(false);
  });

  it("is a no-op when run-state.json is malformed", () => {
    const { dir, transcriptPath } = project({
      runState: "{ not json",
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });
    expect(result.acted).toBe(false);
  });

  it("is a no-op when the runId is malformed", () => {
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({
      transcriptPath,
      cwd: dir,
      runId: "../../etc",
    });
    expect(result.acted).toBe(false);
    expect(result.flagRaised).toBe(false);
  });
});

describe("runWatchdog — active run", () => {
  it("raises the flag when usage passes the default 40% threshold", () => {
    // 2 + 8000 + 100000 = 108002 tokens = 54% of the default 200000 window.
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });

    expect(result.acted).toBe(true);
    expect(result.flagRaised).toBe(true);
    expect(result.evaluation!.overThreshold).toBe(true);
    expect(fs.existsSync(flagPath(dir))).toBe(true);

    const flag = JSON.parse(fs.readFileSync(flagPath(dir), "utf8"));
    expect(flag.usedTokens).toBe(108002);
    expect(flag.thresholdPercent).toBe(40);
    expect(typeof flag.raisedAt).toBe("string");
  });

  it("writes the flag under the per-run directory", () => {
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });

    expect(result.flagRaised).toBe(true);
    expect(result.flagPath).toBe(
      path.join(dir, ".orchestrate", "runs", RUN_ID, "context-flag.json")
    );
  });

  it("does not raise the flag when usage is below the threshold", () => {
    // 2 + 8000 + 40000 = 48002 tokens = 24% of the default window.
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript: assistantLine(2, 8000, 40000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });

    expect(result.acted).toBe(true);
    expect(result.flagRaised).toBe(false);
    expect(result.evaluation!.overThreshold).toBe(false);
    expect(fs.existsSync(flagPath(dir))).toBe(false);
  });

  it("does not re-raise an already-raised flag (idempotent)", () => {
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript: assistantLine(2, 8000, 100000),
      flag: { raisedAt: "2026-01-01T00:00:00Z", usedTokens: 1 },
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });

    expect(result.flagRaised).toBe(false);
    // The pre-existing flag is left untouched.
    const flag = JSON.parse(fs.readFileSync(flagPath(dir), "utf8"));
    expect(flag.raisedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("honours a custom threshold from handoff.json", () => {
    // 108002 tokens = 54% — over the 40% default, but under a 90% threshold.
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      handoff: { watchdog: { thresholdPercent: 90 } },
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });

    expect(result.flagRaised).toBe(false);
    expect(fs.existsSync(flagPath(dir))).toBe(false);
  });

  it("honours a custom context window from handoff.json", () => {
    // 108002 tokens = 11% of a 1M window — under the 40% default threshold.
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      handoff: { watchdog: { contextWindowTokens: 1000000 } },
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });

    expect(result.flagRaised).toBe(false);
  });

  it("does not raise the flag when no transcript is available", () => {
    const { dir } = project({ runState: { status: "in-progress" } });
    const result = runWatchdog({
      transcriptPath: undefined,
      cwd: dir,
      runId: RUN_ID,
    });

    expect(result.acted).toBe(true);
    expect(result.flagRaised).toBe(false);
  });

  it("does not raise the flag when the transcript carries no usage", () => {
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript: [userLine("one"), userLine("two")].join("\n"),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });

    expect(result.flagRaised).toBe(false);
  });

  it("detects usage in a transcript larger than the tail-read window", () => {
    // ~1.3 MiB of padding pushes the file past the 1 MiB tail window; the
    // over-threshold assistant turn is last, so the tail read still finds it.
    const padding = Array.from({ length: 1300 }, () =>
      userLine("x".repeat(1000))
    ).join("\n");
    const transcript = padding + "\n" + assistantLine(2, 8000, 100000);
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript,
    });
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: RUN_ID });

    expect(result.flagRaised).toBe(true);
    expect(result.evaluation!.usedTokens).toBe(108002);
  });
});

// ─── concurrent-run binding: discovery + runWatchdog end to end ────────────────
//
// These cover the acceptance criteria as the CLI exercises them: discover the
// run for a session id, then raise that run's flag — and only that run's flag.

describe("session-bound watchdog — concurrent runs", () => {
  /**
   * Builds a project with two concurrent in-progress runs, each with its own
   * over-threshold transcript, distinct `driverSessionId`s, and per-run dirs.
   */
  function twoRunProject(): {
    dir: string;
    transcriptPath: string;
    runA: string;
    runB: string;
  } {
    const dir = emptyProject();
    const runA = "20260101-000000";
    const runB = "20260202-000000";
    writeRun(dir, runA, "in-progress", "session-A");
    writeRun(dir, runB, "in-progress", "session-B");
    const transcriptPath = path.join(dir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, assistantLine(2, 8000, 100000));
    return { dir, transcriptPath, runA, runB };
  }

  it("raises only the matching run's flag and never the other run's", () => {
    const { dir, transcriptPath, runA, runB } = twoRunProject();

    const runId = findActiveRunForSession(dir, "session-A");
    expect(runId).toBe(runA);
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: runId! });

    expect(result.flagRaised).toBe(true);
    expect(fs.existsSync(flagPath(dir, runA))).toBe(true);
    // The wrong run's flag is never written.
    expect(fs.existsSync(flagPath(dir, runB))).toBe(false);
  });

  it("writes no flag for any run when the session is unknown (ambiguous)", () => {
    const { dir, runA, runB } = twoRunProject();

    const runId = findActiveRunForSession(dir, "session-unknown");
    expect(runId).toBeNull();
    // The CLI would exit(0) here — no run is selected, so no flag is written.
    expect(fs.existsSync(flagPath(dir, runA))).toBe(false);
    expect(fs.existsSync(flagPath(dir, runB))).toBe(false);
  });

  it("writes no flag for any run when no session is available (ambiguous)", () => {
    const { dir, runA, runB } = twoRunProject();

    const runId = findActiveRunForSession(dir, undefined);
    expect(runId).toBeNull();
    expect(fs.existsSync(flagPath(dir, runA))).toBe(false);
    expect(fs.existsSync(flagPath(dir, runB))).toBe(false);
  });

  it("never raises a completed run's flag even when its session matches", () => {
    const dir = emptyProject();
    const done = "20260101-000000";
    const activeB = "20260202-000000";
    const activeC = "20260303-000000";
    // A completed run carries session-A; two concurrent runs are in-progress.
    writeRun(dir, done, "completed", "session-A");
    writeRun(dir, activeB, "in-progress", "session-B");
    writeRun(dir, activeC, "in-progress", "session-C");
    const transcriptPath = path.join(dir, "transcript.jsonl");
    fs.writeFileSync(transcriptPath, assistantLine(2, 8000, 100000));

    // session-A matches only the completed (scan-excluded) run. With two
    // in-progress runs and no positive match, discovery returns null.
    const runId = findActiveRunForSession(dir, "session-A");
    expect(runId).toBeNull();
    // No flag is written anywhere — least of all the completed run's.
    expect(fs.existsSync(flagPath(dir, done))).toBe(false);
    expect(fs.existsSync(flagPath(dir, activeB))).toBe(false);
    expect(fs.existsSync(flagPath(dir, activeC))).toBe(false);

    // runWatchdog also refuses to act on a non-in-progress run directly.
    const result = runWatchdog({ transcriptPath, cwd: dir, runId: done });
    expect(result.acted).toBe(false);
    expect(fs.existsSync(flagPath(dir, done))).toBe(false);
  });
});
