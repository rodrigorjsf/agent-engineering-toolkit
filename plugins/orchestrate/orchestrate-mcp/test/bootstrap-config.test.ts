import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { bootstrapConfig } from "../src/tools/bootstrap-config.js";
import { commandsConfigSchema } from "../src/tools/run-command.js";
import { handoffConfigSchema } from "../src/handoff-config.js";
import { routingConfigSchema } from "../src/tools/routing.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const created: string[] = [];

/**
 * Creates an empty temp repository directory. When `manifest` is given, an empty
 * file of that name is written at the top level so the capability detector
 * resolves the corresponding project type.
 */
function repo(manifest?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-bootstrap-"));
  created.push(dir);
  if (manifest) {
    fs.writeFileSync(path.join(dir, manifest), "");
  }
  return dir;
}

/** Reads and JSON-parses a file under the repo's `.orchestrate/` directory. */
function readConfig(repoDir: string, name: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(repoDir, ".orchestrate", name), "utf8")
  );
}

afterEach(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  created.length = 0;
});

// ─── Fresh-run bootstrap ──────────────────────────────────────────────────────

describe("bootstrapConfig — fresh run", () => {
  it("writes all three config files and reports status='ok'", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.files).toEqual({
      commandsJson: "written",
      routingJson: "written",
      handoffJson: "written",
    });
    expect(fs.existsSync(path.join(dir, ".orchestrate", "commands.json"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(dir, ".orchestrate", "routing.json"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(dir, ".orchestrate", "handoff.json"))).toBe(
      true
    );
  });

  it("writes config files that satisfy their schemas", () => {
    const dir = repo("Cargo.toml");
    bootstrapConfig({ repoPath: dir });

    expect(() =>
      commandsConfigSchema.parse(readConfig(dir, "commands.json"))
    ).not.toThrow();
    expect(() =>
      routingConfigSchema.parse(readConfig(dir, "routing.json"))
    ).not.toThrow();
    expect(() =>
      handoffConfigSchema.parse(readConfig(dir, "handoff.json"))
    ).not.toThrow();
  });

  it("writes JSON with 2-space indent and a trailing newline", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });

    const raw = fs.readFileSync(
      path.join(dir, ".orchestrate", "commands.json"),
      "utf8"
    );
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('\n  "tests"');
  });
});

// ─── Project-type-aware commands.json ─────────────────────────────────────────

describe("bootstrapConfig — commands.json per project type", () => {
  it("derives npm commands and includes install for an npm project", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.projectType).toBe("npm");
    const cmds = readConfig(dir, "commands.json") as Record<string, unknown>;
    expect(cmds.tests).toEqual(["npm", "test"]);
    expect(cmds.typecheck).toEqual(["npm", "run", "typecheck"]);
    expect(cmds.build).toEqual(["npm", "run", "build"]);
    expect(cmds.lint).toEqual(["npm", "run", "lint"]);
    expect(cmds.install).toEqual(["npm", "ci"]);
  });

  it("derives cargo commands and omits install for a cargo project", () => {
    const dir = repo("Cargo.toml");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.projectType).toBe("cargo");
    const cmds = readConfig(dir, "commands.json") as Record<string, unknown>;
    expect(cmds.tests).toEqual(["cargo", "test"]);
    expect(cmds.install).toBeUndefined();
  });

  it("derives python commands and omits install for a python project", () => {
    const dir = repo("pyproject.toml");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.projectType).toBe("python");
    const cmds = readConfig(dir, "commands.json") as Record<string, unknown>;
    expect(cmds.tests).toEqual(["pytest"]);
    expect(cmds.install).toBeUndefined();
  });

  it("derives make commands and omits install for a make project", () => {
    const dir = repo("Makefile");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.projectType).toBe("make");
    const cmds = readConfig(dir, "commands.json") as Record<string, unknown>;
    expect(cmds.tests).toEqual(["make", "test"]);
    expect(cmds.install).toBeUndefined();
  });

  it("writes an empty commands.json for a manifest-less project", () => {
    const dir = repo();
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.projectType).toBe("none");
    const cmds = readConfig(dir, "commands.json");
    expect(cmds).toEqual({});
  });
});

// ─── Model-derived context window ─────────────────────────────────────────────

describe("bootstrapConfig — model-derived context window", () => {
  it("maps a recognized 1M model to 1000000 tokens", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({
      repoPath: dir,
      model: "claude-opus-4-7[1m]",
    });

    expect(r.contextWindowTokens).toBe(1000000);
    expect(r.contextWindowSource).toBe("model-table");
    const handoff = readConfig(dir, "handoff.json") as {
      watchdog: { contextWindowTokens: number };
    };
    expect(handoff.watchdog.contextWindowTokens).toBe(1000000);
  });

  it("maps a recognized standard model to 200000 tokens", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({ repoPath: dir, model: "opus" });

    expect(r.contextWindowTokens).toBe(200000);
    expect(r.contextWindowSource).toBe("model-table");
    const handoff = readConfig(dir, "handoff.json") as {
      watchdog: { contextWindowTokens: number };
    };
    expect(handoff.watchdog.contextWindowTokens).toBe(200000);
  });

  it("falls back to 200000 for an unknown model", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({ repoPath: dir, model: "some-future-model" });

    expect(r.contextWindowTokens).toBe(200000);
    expect(r.contextWindowSource).toBe("default");
    const handoff = readConfig(dir, "handoff.json") as {
      watchdog: { contextWindowTokens: number };
    };
    expect(handoff.watchdog.contextWindowTokens).toBe(200000);
  });

  it("falls back to 200000 when no model is supplied", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.contextWindowTokens).toBe(200000);
    expect(r.contextWindowSource).toBe("default");
  });

  it("uses an explicit contextWindowTokens over the model table", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({
      repoPath: dir,
      model: "opus",
      contextWindowTokens: 500000,
    });

    expect(r.contextWindowTokens).toBe(500000);
    expect(r.contextWindowSource).toBe("explicit");
    const handoff = readConfig(dir, "handoff.json") as {
      watchdog: { contextWindowTokens: number };
    };
    expect(handoff.watchdog.contextWindowTokens).toBe(500000);
  });

  it("never writes NaN — a non-positive explicit value falls back", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({
      repoPath: dir,
      model: "some-future-model",
      contextWindowTokens: 0,
    });

    expect(Number.isInteger(r.contextWindowTokens)).toBe(true);
    expect(r.contextWindowTokens).toBe(200000);
    expect(r.contextWindowSource).toBe("default");
  });
});

// ─── Config-file idempotence ──────────────────────────────────────────────────

describe("bootstrapConfig — config-file idempotence", () => {
  it("does not overwrite an existing user-modified commands.json", () => {
    const dir = repo("package.json");
    fs.mkdirSync(path.join(dir, ".orchestrate"));
    const userConfig = '{ "tests": ["my", "custom", "runner"] }\n';
    fs.writeFileSync(
      path.join(dir, ".orchestrate", "commands.json"),
      userConfig
    );

    const r = bootstrapConfig({ repoPath: dir });

    expect(r.files.commandsJson).toBe("already-present");
    expect(
      fs.readFileSync(path.join(dir, ".orchestrate", "commands.json"), "utf8")
    ).toBe(userConfig);
  });

  it("writes only the missing files in a mixed state", () => {
    const dir = repo("package.json");
    fs.mkdirSync(path.join(dir, ".orchestrate"));
    fs.writeFileSync(
      path.join(dir, ".orchestrate", "commands.json"),
      "{}\n"
    );

    const r = bootstrapConfig({ repoPath: dir });

    expect(r.files.commandsJson).toBe("already-present");
    expect(r.files.routingJson).toBe("written");
    expect(r.files.handoffJson).toBe("written");
  });

  it("is fully idempotent — a second run writes nothing", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });
    const second = bootstrapConfig({ repoPath: dir });

    expect(second.status).toBe("ok");
    expect(second.files).toEqual({
      commandsJson: "already-present",
      routingJson: "already-present",
      handoffJson: "already-present",
    });
  });
});

// ─── runs/ directory ──────────────────────────────────────────────────────────

describe("bootstrapConfig — runs directory", () => {
  it("creates .orchestrate/runs/ on a fresh run", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.runsDir).toBe("created");
    expect(
      fs.statSync(path.join(dir, ".orchestrate", "runs")).isDirectory()
    ).toBe(true);
  });

  it("reports already-present and never throws when runs/ exists", () => {
    const dir = repo("package.json");
    fs.mkdirSync(path.join(dir, ".orchestrate", "runs"), { recursive: true });

    const r = bootstrapConfig({ repoPath: dir });

    expect(r.runsDir).toBe("already-present");
    expect(
      fs.statSync(path.join(dir, ".orchestrate", "runs")).isDirectory()
    ).toBe(true);
  });
});

// ─── .gitignore idempotence ───────────────────────────────────────────────────

describe("bootstrapConfig — .gitignore idempotence", () => {
  it("creates .gitignore with the runs line when none exists", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.gitignore).toBe("created-with-line");
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    expect(gi.split("\n").map((l) => l.trim())).toContain(".orchestrate/runs/");
    expect(gi.endsWith("\n")).toBe(true);
  });

  it("appends the runs line to an existing .gitignore", () => {
    const dir = repo("package.json");
    fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules/\ndist/\n");

    const r = bootstrapConfig({ repoPath: dir });

    expect(r.gitignore).toBe("line-added");
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    expect(gi).toContain("node_modules/");
    expect(gi.split("\n").map((l) => l.trim())).toContain(".orchestrate/runs/");
  });

  it("appends a leading newline when the existing file lacks a trailing one", () => {
    const dir = repo("package.json");
    fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules/");

    bootstrapConfig({ repoPath: dir });

    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    expect(gi).toBe("node_modules/\n.orchestrate/runs/\n");
  });

  it("does not duplicate an existing .orchestrate/runs/ line", () => {
    const dir = repo("package.json");
    fs.writeFileSync(
      path.join(dir, ".gitignore"),
      "node_modules/\n.orchestrate/runs/\n"
    );

    const r = bootstrapConfig({ repoPath: dir });

    expect(r.gitignore).toBe("already-present");
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    const matches = gi
      .split("\n")
      .filter((l) => l.trim() === ".orchestrate/runs/");
    expect(matches.length).toBe(1);
  });

  it("recognizes the line without a trailing slash and does not duplicate", () => {
    const dir = repo("package.json");
    fs.writeFileSync(
      path.join(dir, ".gitignore"),
      "node_modules/\n.orchestrate/runs\n"
    );

    const r = bootstrapConfig({ repoPath: dir });

    expect(r.gitignore).toBe("already-present");
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    expect(gi).toBe("node_modules/\n.orchestrate/runs\n");
  });

  it("is idempotent across repeated bootstraps", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });
    const second = bootstrapConfig({ repoPath: dir });

    expect(second.gitignore).toBe("already-present");
    const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
    const matches = gi
      .split("\n")
      .filter((l) => l.trim() === ".orchestrate/runs/");
    expect(matches.length).toBe(1);
  });
});
