import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  shellQuote,
  buildClaudeArgv,
  buildClaudeCommand,
  buildLaunchArgv,
  spawnSuccessor,
} from "../src/tools/spawn-successor.js";
import { handoffConfigSchema, loadHandoffConfig } from "../src/handoff-config.js";

/** The built-in default successor config — every field at its schema default. */
const DEFAULT_SUCCESSOR = handoffConfigSchema.parse({}).successor;

// ─── Test project scaffolding ─────────────────────────────────────────────────

const created: string[] = [];

/** Creates a temp project dir, optionally with an .orchestrate/handoff.json. */
function project(handoff?: unknown | string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-successor-"));
  created.push(dir);
  fs.mkdirSync(path.join(dir, ".orchestrate"));
  if (handoff !== undefined) {
    fs.writeFileSync(
      path.join(dir, ".orchestrate", "handoff.json"),
      typeof handoff === "string" ? handoff : JSON.stringify(handoff)
    );
  }
  return dir;
}

afterEach(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  created.length = 0;
});

// ─── shellQuote ───────────────────────────────────────────────────────────────

describe("shellQuote", () => {
  it("wraps a plain token in single quotes", () => {
    expect(shellQuote("hello")).toBe("'hello'");
  });

  it("escapes an embedded single quote", () => {
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });

  it("safely quotes a path with spaces", () => {
    expect(shellQuote("/home/a b/repo")).toBe("'/home/a b/repo'");
  });
});

// ─── buildClaudeArgv ──────────────────────────────────────────────────────────

describe("buildClaudeArgv", () => {
  it("produces the default invocation in claude, args, prompt order", () => {
    expect(buildClaudeArgv(DEFAULT_SUCCESSOR)).toEqual([
      "claude",
      "--remote-control",
      "orchestrate-successor",
      "--permission-mode",
      "auto",
      "/orchestrate",
    ]);
  });

  it("keeps the Remote Control name and the resume prompt in distinct argv positions", () => {
    const argv = buildClaudeArgv(DEFAULT_SUCCESSOR);
    const rcIndex = argv.indexOf("--remote-control");

    // The token right after --remote-control is the session NAME...
    expect(rcIndex).toBeGreaterThan(-1);
    expect(argv[rcIndex + 1]).toBe("orchestrate-successor");
    // ...not the resume prompt — a prompt there would be eaten as the name.
    expect(argv[rcIndex + 1]).not.toBe(DEFAULT_SUCCESSOR.resumePrompt);

    // The resume prompt is the final, separate positional argument.
    expect(argv[argv.length - 1]).toBe(DEFAULT_SUCCESSOR.resumePrompt);
    expect(argv.lastIndexOf(DEFAULT_SUCCESSOR.resumePrompt)).toBe(
      argv.length - 1
    );
  });

  it("appends a custom resume prompt last", () => {
    const config = { ...DEFAULT_SUCCESSOR, resumePrompt: "/orchestrate resume" };
    const argv = buildClaudeArgv(config);
    expect(argv[argv.length - 1]).toBe("/orchestrate resume");
  });
});

// ─── buildClaudeCommand ───────────────────────────────────────────────────────

describe("buildClaudeCommand", () => {
  it("cd's into the repo and exec's the claude invocation", () => {
    const cmd = buildClaudeCommand(DEFAULT_SUCCESSOR, "/home/me/repo");
    expect(cmd).toMatch(/^cd '\/home\/me\/repo' && exec /);
    expect(cmd).toContain("'claude'");
    expect(cmd).toContain("'--remote-control'");
    expect(cmd).toContain("'/orchestrate'");
  });

  it("safely quotes a repo path containing spaces", () => {
    const cmd = buildClaudeCommand(DEFAULT_SUCCESSOR, "/home/a b/repo");
    expect(cmd).toContain("cd '/home/a b/repo'");
  });
});

// ─── buildLaunchArgv ──────────────────────────────────────────────────────────

describe("buildLaunchArgv", () => {
  it("substitutes the {claudeCommand} placeholder", () => {
    const argv = buildLaunchArgv(
      { name: "t", argv: ["bash", "-lc", "{claudeCommand}"] },
      { claudeCommand: "cd /r && exec claude", repoPath: "/r" }
    );
    expect(argv).toEqual(["bash", "-lc", "cd /r && exec claude"]);
  });

  it("substitutes the {repoPath} placeholder", () => {
    const argv = buildLaunchArgv(
      { name: "t", argv: ["wt.exe", "--cd", "{repoPath}"] },
      { claudeCommand: "x", repoPath: "/home/me/repo" }
    );
    expect(argv).toEqual(["wt.exe", "--cd", "/home/me/repo"]);
  });

  it("leaves tokens without placeholders unchanged", () => {
    const argv = buildLaunchArgv(
      { name: "t", argv: ["wt.exe", "new-tab", "--title", "x"] },
      { claudeCommand: "c", repoPath: "/r" }
    );
    expect(argv).toEqual(["wt.exe", "new-tab", "--title", "x"]);
  });
});

// ─── loadHandoffConfig ────────────────────────────────────────────────────────

describe("loadHandoffConfig", () => {
  it("returns defaults with no warning when handoff.json is absent", () => {
    const dir = project();
    const { config, warning } = loadHandoffConfig(dir);
    expect(warning).toBeNull();
    expect(config.watchdog.thresholdPercent).toBe(40);
    expect(config.successor.terminals.length).toBeGreaterThan(0);
  });

  it("returns defaults with a warning when handoff.json is malformed JSON", () => {
    const dir = project("{ not valid json");
    const { config, warning } = loadHandoffConfig(dir);
    expect(warning).not.toBeNull();
    expect(config.watchdog.thresholdPercent).toBe(40);
  });

  it("merges a partial handoff.json over the defaults", () => {
    const dir = project({ watchdog: { thresholdPercent: 75 } });
    const { config, warning } = loadHandoffConfig(dir);
    expect(warning).toBeNull();
    expect(config.watchdog.thresholdPercent).toBe(75);
    // Untouched fields keep their defaults.
    expect(config.watchdog.contextWindowTokens).toBe(200000);
  });
});

// ─── spawnSuccessor ───────────────────────────────────────────────────────────

describe("spawnSuccessor", () => {
  it("returns NO_TERMINALS when the terminal chain is empty", async () => {
    const dir = project({ successor: { terminals: [] } });
    const result = await spawnSuccessor({ repoPath: dir });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("NO_TERMINALS");
  });

  it("returns ALL_TERMINALS_FAILED when every terminal fails to spawn", async () => {
    const dir = project({
      successor: {
        terminals: [
          { name: "bogus-a", argv: ["orchestrate-nonexistent-binary-aaa"] },
          { name: "bogus-b", argv: ["orchestrate-nonexistent-binary-bbb"] },
        ],
      },
    });
    const result = await spawnSuccessor({ repoPath: dir });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("ALL_TERMINALS_FAILED");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts!.every((a) => a.outcome === "failed")).toBe(true);
  });

  it("falls back to the next terminal when the first fails", async () => {
    const dir = project({
      successor: {
        terminals: [
          { name: "bogus", argv: ["orchestrate-nonexistent-binary-ccc"] },
          { name: "works", argv: ["true"] },
        ],
      },
    });
    const result = await spawnSuccessor({ repoPath: dir });

    expect(result.status).toBe("ok");
    expect(result.terminal).toBe("works");
    expect(result.command).toEqual(["true"]);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts![0].outcome).toBe("failed");
    expect(result.attempts![1].outcome).toBe("launched");
  });

  it("launches the first working terminal and records the attempt", async () => {
    const dir = project({
      successor: { terminals: [{ name: "works", argv: ["true"] }] },
    });
    const result = await spawnSuccessor({ repoPath: dir });

    expect(result.status).toBe("ok");
    expect(result.terminal).toBe("works");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts![0].outcome).toBe("launched");
  });

  it("flows an injected resumePrompt through to the launched argv", async () => {
    // A bogus terminal whose argv embeds {claudeCommand}: spawn fails (so no
    // real session launches), but buildLaunchArgv still substitutes the
    // claudeCommand built from the (overridden) resumePrompt — proving the
    // input override reached buildClaudeArgv *through the tool*, not just the
    // pure builder.
    const dir = project({
      successor: {
        terminals: [
          {
            name: "bogus",
            argv: ["orchestrate-nonexistent-binary-resume", "{claudeCommand}"],
          },
        ],
      },
    });

    const overridden = await spawnSuccessor({
      repoPath: dir,
      resumePrompt: "/orchestrate 195",
    });
    expect(overridden.status).toBe("error");
    expect(overridden.errorCode).toBe("ALL_TERMINALS_FAILED");
    // The claudeCommand is the last argv token; shellQuote wraps the prompt, so
    // assert the partition-correct invocation is present (trailing quote means
    // no exact-match / endsWith).
    const overriddenArgv = overridden.attempts![0].argv;
    expect(overriddenArgv[overriddenArgv.length - 1]).toContain(
      "/orchestrate 195"
    );

    // Omitting resumePrompt falls back to the config/default "/orchestrate"; the
    // partition-specific "195" must be absent.
    const fallback = await spawnSuccessor({ repoPath: dir });
    expect(fallback.status).toBe("error");
    const fallbackArgv = fallback.attempts![0].argv;
    expect(fallbackArgv[fallbackArgv.length - 1]).toContain("'/orchestrate'");
    expect(fallbackArgv[fallbackArgv.length - 1]).not.toContain("195");
  });
});
