import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  runTests,
  runTypecheck,
  runBuild,
  runLint,
  runInstall,
  runCommandInputSchema,
} from "../src/tools/run-command.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a temporary project directory and, unless `commands` is null, writes
 * `.orchestrate/commands.json` into it. A string `commands` is written
 * verbatim (used to exercise malformed JSON); an object is JSON-serialized.
 */
function makeProject(commands: unknown | string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-cmd-"));
  if (commands !== null) {
    fs.mkdirSync(path.join(dir, ".orchestrate"));
    const content =
      typeof commands === "string"
        ? commands
        : JSON.stringify(commands, null, 2);
    fs.writeFileSync(path.join(dir, ".orchestrate", "commands.json"), content);
  }
  return dir;
}

function rmrf(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// ─── Test state ───────────────────────────────────────────────────────────────

const created: string[] = [];

/** Registers a temp project for teardown and returns its path. */
function project(commands: unknown | string | null): string {
  const dir = makeProject(commands);
  created.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of created) rmrf(dir);
  created.length = 0;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("run-command capability tools", () => {
  it("returns status='passed' with exitCode 0 when the configured command exits 0", async () => {
    const dir = project({ tests: ["node", "-e", "process.exit(0)"] });
    const r = await runTests({ repoPath: dir });

    expect(r.status).toBe("passed");
    expect(r.capability).toBe("tests");
    expect(r.exitCode).toBe(0);
    expect(r.command).toEqual(["node", "-e", "process.exit(0)"]);
    expect(typeof r.durationMs).toBe("number");
    expect(r.errorCode).toBeUndefined();
  });

  it("returns status='failed' with the non-zero exitCode", async () => {
    const dir = project({ tests: ["node", "-e", "process.exit(3)"] });
    const r = await runTests({ repoPath: dir });

    expect(r.status).toBe("failed");
    expect(r.exitCode).toBe(3);
  });

  it("captures stdout and stderr from the command", async () => {
    const dir = project({
      build: [
        "node",
        "-e",
        "process.stdout.write('built ok'); process.stderr.write('a warning')",
      ],
    });
    const r = await runBuild({ repoPath: dir });

    expect(r.status).toBe("passed");
    expect(r.stdout).toContain("built ok");
    expect(r.stderr).toContain("a warning");
    expect(r.truncated).toBe(false);
  });

  it("each tool reads only its own verb key from commands.json", async () => {
    const dir = project({
      tests: ["node", "-e", "process.exit(0)"],
      typecheck: ["node", "-e", "process.exit(1)"],
      build: ["node", "-e", "process.exit(2)"],
      lint: ["node", "-e", "process.exit(0)"],
    });

    expect((await runTests({ repoPath: dir })).exitCode).toBe(0);
    expect((await runTypecheck({ repoPath: dir })).exitCode).toBe(1);
    expect((await runBuild({ repoPath: dir })).exitCode).toBe(2);

    const lint = await runLint({ repoPath: dir });
    expect(lint.status).toBe("passed");
    expect(lint.capability).toBe("lint");
  });

  it("returns status='not-configured' (no errorCode) when the verb has no entry", async () => {
    const dir = project({ tests: ["node", "-e", "process.exit(0)"] });
    const r = await runLint({ repoPath: dir });

    expect(r.status).toBe("not-configured");
    expect(r.capability).toBe("lint");
    expect(r.reason).toBeDefined();
    expect(r.errorCode).toBeUndefined();
  });

  it("returns status='not-configured' when no commands.json file exists", async () => {
    const dir = project(null);
    const r = await runTests({ repoPath: dir });

    expect(r.status).toBe("not-configured");
    expect(r.reason).toBeDefined();
    expect(r.errorCode).toBeUndefined();
  });

  it("treats an empty argv array as not-configured", async () => {
    const dir = project({ lint: [] });
    const r = await runLint({ repoPath: dir });

    expect(r.status).toBe("not-configured");
  });

  it("returns errorCode='CONFIG_INVALID' for malformed JSON, with no command echoed", async () => {
    const dir = project("{ this is not valid json");
    const r = await runTests({ repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_INVALID");
    expect(r.errorMessage).toBeDefined();
    // A config-level failure never ran a command — nothing to echo or time.
    expect(r.command).toBeUndefined();
    expect(r.durationMs).toBeUndefined();
  });

  it("returns errorCode='CONFIG_INVALID' when a verb value is not an argv array", async () => {
    const dir = project({ tests: "npm test" });
    const r = await runTests({ repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_INVALID");
  });

  it("returns errorCode='EXEC_ERROR' when the command binary does not exist", async () => {
    const dir = project({
      tests: ["orchestrate-nonexistent-binary-xyz", "--run"],
    });
    const r = await runTests({ repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("EXEC_ERROR");
    expect(r.errorMessage).toBeDefined();
  });

  it(
    "returns errorCode='TIMEOUT' and surfaces output captured before the kill",
    async () => {
      const dir = project({
        tests: [
          "node",
          "-e",
          "process.stdout.write('partial before hang'); setTimeout(() => {}, 30000)",
        ],
      });
      const r = await runTests({ repoPath: dir }, { timeoutMs: 1500 });

      expect(r.status).toBe("error");
      expect(r.errorCode).toBe("TIMEOUT");
      // Partial output written before SIGKILL must reach the caller for triage.
      expect(r.stdout).toContain("partial before hang");
      expect(typeof r.durationMs).toBe("number");
    },
    10_000
  );

  it("truncates oversized stdout and sets truncated=true", async () => {
    const dir = project({
      build: ["node", "-e", "process.stdout.write('x'.repeat(200000))"],
    });
    const r = await runBuild({ repoPath: dir });

    expect(r.status).toBe("passed");
    expect(r.truncated).toBe(true);
    expect(r.stdout!.length).toBeLessThan(200000);
  });

  it("truncates oversized stderr and sets truncated=true", async () => {
    const dir = project({
      build: ["node", "-e", "process.stderr.write('y'.repeat(200000))"],
    });
    const r = await runBuild({ repoPath: dir });

    expect(r.status).toBe("passed");
    expect(r.truncated).toBe(true);
    expect(r.stderr!.length).toBeLessThan(200000);
  });

  it("exposes only repoPath as input — never a free-form command string", () => {
    expect(Object.keys(runCommandInputSchema.shape)).toEqual(["repoPath"]);
  });
});

describe("runInstall", () => {
  it("returns status='installed' when the configured install command exits 0", async () => {
    const dir = project({ install: ["node", "-e", "process.exit(0)"] });
    const r = await runInstall({ repoPath: dir });

    expect(r.status).toBe("installed");
    expect(r.exitCode).toBe(0);
    expect(r.command).toEqual(["node", "-e", "process.exit(0)"]);
    expect(typeof r.durationMs).toBe("number");
  });

  it("returns status='failed' with the non-zero exitCode when the install command fails", async () => {
    const dir = project({ install: ["node", "-e", "process.exit(5)"] });
    const r = await runInstall({ repoPath: dir });

    expect(r.status).toBe("failed");
    expect(r.exitCode).toBe(5);
  });

  it("returns status='not-configured' when no install command is set", async () => {
    const dir = project({ tests: ["node", "-e", "process.exit(0)"] });
    const r = await runInstall({ repoPath: dir });

    expect(r.status).toBe("not-configured");
    expect(r.reason).toBeDefined();
    expect(r.errorCode).toBeUndefined();
  });

  it("returns status='not-configured' when no commands.json file exists", async () => {
    const dir = project(null);
    const r = await runInstall({ repoPath: dir });

    expect(r.status).toBe("not-configured");
    expect(r.reason).toBeDefined();
  });

  it("returns errorCode='CONFIG_INVALID' for malformed commands.json", async () => {
    const dir = project("{ not valid json");
    const r = await runInstall({ repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_INVALID");
    expect(r.errorMessage).toBeDefined();
  });

  it("captures stdout from the install command", async () => {
    const dir = project({
      install: ["node", "-e", "process.stdout.write('deps installed')"],
    });
    const r = await runInstall({ repoPath: dir });

    expect(r.status).toBe("installed");
    expect(r.stdout).toContain("deps installed");
  });
});
