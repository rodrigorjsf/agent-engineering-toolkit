import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  parseLatestUsage,
  contextTokens,
  evaluateWatchdog,
  runWatchdog,
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

function project(opts: {
  runState?: unknown;
  handoff?: unknown;
  transcript?: string;
  flag?: unknown;
}): { dir: string; transcriptPath?: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-watchdog-"));
  created.push(dir);
  fs.mkdirSync(path.join(dir, ".orchestrate"));

  if (opts.runState !== undefined) {
    fs.writeFileSync(
      path.join(dir, ".orchestrate", "run-state.json"),
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
      path.join(dir, ".orchestrate", "context-flag.json"),
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

function flagPath(dir: string): string {
  return path.join(dir, ".orchestrate", "context-flag.json");
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

// ─── runWatchdog ──────────────────────────────────────────────────────────────

describe("runWatchdog — no active run", () => {
  it("is a no-op when run-state.json is absent", () => {
    const { dir, transcriptPath } = project({
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir });
    expect(result.acted).toBe(false);
    expect(result.flagRaised).toBe(false);
    expect(fs.existsSync(flagPath(dir))).toBe(false);
  });

  it("is a no-op when the run status is not in-progress", () => {
    const { dir, transcriptPath } = project({
      runState: { status: "completed" },
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir });
    expect(result.acted).toBe(false);
    expect(fs.existsSync(flagPath(dir))).toBe(false);
  });

  it("is a no-op when run-state.json is malformed", () => {
    const { dir, transcriptPath } = project({
      runState: "{ not json",
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir });
    expect(result.acted).toBe(false);
  });
});

describe("runWatchdog — active run", () => {
  it("raises the flag when usage passes the default 40% threshold", () => {
    // 2 + 8000 + 100000 = 108002 tokens = 54% of the default 200000 window.
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript: assistantLine(2, 8000, 100000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir });

    expect(result.acted).toBe(true);
    expect(result.flagRaised).toBe(true);
    expect(result.evaluation!.overThreshold).toBe(true);
    expect(fs.existsSync(flagPath(dir))).toBe(true);

    const flag = JSON.parse(fs.readFileSync(flagPath(dir), "utf8"));
    expect(flag.usedTokens).toBe(108002);
    expect(flag.thresholdPercent).toBe(40);
    expect(typeof flag.raisedAt).toBe("string");
  });

  it("does not raise the flag when usage is below the threshold", () => {
    // 2 + 8000 + 40000 = 48002 tokens = 24% of the default window.
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript: assistantLine(2, 8000, 40000),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir });

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
    const result = runWatchdog({ transcriptPath, cwd: dir });

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
    const result = runWatchdog({ transcriptPath, cwd: dir });

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
    const result = runWatchdog({ transcriptPath, cwd: dir });

    expect(result.flagRaised).toBe(false);
  });

  it("does not raise the flag when no transcript is available", () => {
    const { dir } = project({ runState: { status: "in-progress" } });
    const result = runWatchdog({ transcriptPath: undefined, cwd: dir });

    expect(result.acted).toBe(true);
    expect(result.flagRaised).toBe(false);
  });

  it("does not raise the flag when the transcript carries no usage", () => {
    const { dir, transcriptPath } = project({
      runState: { status: "in-progress" },
      transcript: [userLine("one"), userLine("two")].join("\n"),
    });
    const result = runWatchdog({ transcriptPath, cwd: dir });

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
    const result = runWatchdog({ transcriptPath, cwd: dir });

    expect(result.flagRaised).toBe(true);
    expect(result.evaluation!.usedTokens).toBe(108002);
  });
});
