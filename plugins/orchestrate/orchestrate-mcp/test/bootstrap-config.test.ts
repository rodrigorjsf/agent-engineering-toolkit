import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { bootstrapConfig, DEFAULT_ROUTING_CONFIG } from "../src/tools/bootstrap-config.js";
import { commandsConfigSchema } from "../src/tools/run-command.js";
import { handoffConfigSchema } from "../src/handoff-config.js";
import { routingConfigSchemaV2, loadRoutingConfig } from "../src/tools/routing.js";

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
    // The written routing.json is a native v2 file — validate against v2 schema.
    expect(() =>
      routingConfigSchemaV2.parse(readConfig(dir, "routing.json"))
    ).not.toThrow();
    expect(() =>
      handoffConfigSchema.parse(readConfig(dir, "handoff.json"))
    ).not.toThrow();

    // The written routing.json carries the run-wide intraWaveConcurrency knob
    // (#231-P2.3) — now under the v2 `run` block. Proves DEFAULT_ROUTING_CONFIG
    // stays in parity with the key the schema and templates/routing.json declare.
    const routing = readConfig(dir, "routing.json") as {
      run?: { intraWaveConcurrency?: string; continuationBudget?: number };
    };
    expect(routing.run?.intraWaveConcurrency).toBe("parallel");

    // The written routing.json carries the run-wide continuationBudget knob
    // (#234) — now under the v2 `run` block.
    expect(routing.run?.continuationBudget).toBe(2);
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
  it("derives npm-prefixed commands + mutating install for an npm project with a package-lock", () => {
    const dir = repo("package.json");
    fs.writeFileSync(path.join(dir, "package-lock.json"), "{}");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.projectType).toBe("npm");
    const cmds = readConfig(dir, "commands.json") as Record<string, unknown>;
    expect(cmds.tests).toEqual(["npm", "test"]);
    expect(cmds.typecheck).toEqual(["npm", "run", "typecheck"]);
    expect(cmds.build).toEqual(["npm", "run", "build"]);
    expect(cmds.lint).toEqual(["npm", "run", "lint"]);
    // mutating/resolving install keyed on the npm lockfile — never `npm ci`
    expect(cmds.install).toEqual(["npm", "install"]);
  });

  it("defaults a lockfile-less npm project to the pnpm verb set + 'pnpm install'", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.projectType).toBe("npm");
    const cmds = readConfig(dir, "commands.json") as Record<string, unknown>;
    expect(cmds.tests).toEqual(["pnpm", "test"]);
    expect(cmds.install).toEqual(["pnpm", "install"]);
  });

  it("derives cargo commands with a 'cargo fetch' install for a cargo project", () => {
    const dir = repo("Cargo.toml");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.projectType).toBe("cargo");
    const cmds = readConfig(dir, "commands.json") as Record<string, unknown>;
    expect(cmds.tests).toEqual(["cargo", "test"]);
    expect(cmds.install).toEqual(["cargo", "fetch"]);
  });

  it("derives python commands with an editable install for a python project", () => {
    const dir = repo("pyproject.toml");
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.projectType).toBe("python");
    const cmds = readConfig(dir, "commands.json") as Record<string, unknown>;
    expect(cmds.tests).toEqual(["pytest"]);
    expect(cmds.install).toEqual(["pip", "install", "-e", "."]);
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

// ─── Empty-config warning ─────────────────────────────────────────────────────

describe("bootstrapConfig — empty-config warnings", () => {
  it("warns when the freshly-written commands.json is empty (no manifest detected)", () => {
    const dir = repo(); // no manifest → 'none' project type → empty commands map
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.warnings).toBeDefined();
    expect(r.warnings!.length).toBeGreaterThan(0);
    // The warning must name the no-op gates
    expect(r.warnings![0]).toContain("run_tests");
    expect(r.warnings![0]).toContain("run_build");
    // Must name the consequence (false-green merge risk)
    expect(r.warnings![0]).toContain("not-configured");
  });

  it("emits no warnings when commands.json is written non-empty (recognized project type)", () => {
    const dir = repo("package.json"); // npm project → non-empty commands map
    const r = bootstrapConfig({ repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.warnings).toBeDefined();
    expect(r.warnings).toEqual([]);
  });

  it("emits no warnings when commands.json already existed (not freshly written)", () => {
    // Pre-write an empty commands.json — the bootstrapper skips writing it.
    const dir = repo(); // no manifest → 'none' project type
    fs.mkdirSync(path.join(dir, ".orchestrate"));
    fs.writeFileSync(path.join(dir, ".orchestrate", "commands.json"), "{}\n");

    const r = bootstrapConfig({ repoPath: dir });

    // File was already-present, not freshly written → no warning.
    expect(r.files!.commandsJson).toBe("already-present");
    expect(r.warnings).toEqual([]);
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

  it("maps a newly-listed 1M model id via the exact table", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({
      repoPath: dir,
      model: "claude-opus-4-8[1m]",
    });

    expect(r.contextWindowTokens).toBe(1000000);
    expect(r.contextWindowSource).toBe("model-table");
    const handoff = readConfig(dir, "handoff.json") as {
      watchdog: { contextWindowTokens: number };
    };
    expect(handoff.watchdog.contextWindowTokens).toBe(1000000);
  });

  it("parses a trailing [1m] suffix on an unlisted id to 1000000", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({
      repoPath: dir,
      model: "claude-future-x[1m]",
    });

    expect(r.contextWindowTokens).toBe(1000000);
    expect(r.contextWindowSource).toBe("model-suffix");
    const handoff = readConfig(dir, "handoff.json") as {
      watchdog: { contextWindowTokens: number };
    };
    expect(handoff.watchdog.contextWindowTokens).toBe(1000000);
  });

  it("parses a trailing [2m] suffix as N×1M (2000000)", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({
      repoPath: dir,
      model: "claude-future-x[2m]",
    });

    expect(r.contextWindowTokens).toBe(2000000);
    expect(r.contextWindowSource).toBe("model-suffix");
    const handoff = readConfig(dir, "handoff.json") as {
      watchdog: { contextWindowTokens: number };
    };
    expect(handoff.watchdog.contextWindowTokens).toBe(2000000);
  });

  it("does not misclassify an unrelated family id with no bracket", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({
      repoPath: dir,
      model: "claude-opus-4-8",
    });

    expect(r.contextWindowTokens).toBe(200000);
    expect(r.contextWindowSource).toBe("default");
    const handoff = readConfig(dir, "handoff.json") as {
      watchdog: { contextWindowTokens: number };
    };
    expect(handoff.watchdog.contextWindowTokens).toBe(200000);
  });

  it("sends a pathological [0m] suffix through to the default", () => {
    const dir = repo("package.json");
    const r = bootstrapConfig({
      repoPath: dir,
      model: "claude-future-x[0m]",
    });

    expect(Number.isInteger(r.contextWindowTokens)).toBe(true);
    expect(r.contextWindowTokens).toBe(200000);
    expect(r.contextWindowSource).toBe("default");
  });

  it("reaches every contextWindowSource value", () => {
    const explicit = bootstrapConfig({
      repoPath: repo("package.json"),
      model: "opus",
      contextWindowTokens: 500000,
    });
    expect(explicit.contextWindowSource).toBe("explicit");

    const table = bootstrapConfig({
      repoPath: repo("package.json"),
      model: "claude-sonnet-4-6[1m]",
    });
    expect(table.contextWindowSource).toBe("model-table");

    const suffix = bootstrapConfig({
      repoPath: repo("package.json"),
      model: "claude-future-y[1m]",
    });
    expect(suffix.contextWindowSource).toBe("model-suffix");

    const fallback = bootstrapConfig({
      repoPath: repo("package.json"),
      model: "some-future-model",
    });
    expect(fallback.contextWindowSource).toBe("default");
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

// ─── Native v2 routing defaults ───────────────────────────────────────────────

describe("bootstrapConfig — native v2 routing defaults (ADR-0015)", () => {
  it("writes a routing.json with version: 2 (no deprecation warning on fresh run)", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });

    const written = readConfig(dir, "routing.json") as { version?: number };
    expect(written.version).toBe(2);
  });

  it("produces no deprecation warning when the written routing.json is loaded", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });

    const raw = fs.readFileSync(
      path.join(dir, ".orchestrate", "routing.json"),
      "utf8"
    );
    const result = loadRoutingConfig(JSON.parse(raw));
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.warnings).toEqual([]);
    }
  });

  it("standard-tier investigator is haiku/standard (new pass — was null in v1)", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });

    const written = readConfig(dir, "routing.json") as {
      tiers?: { standard?: { investigator?: { model: string; variant: string } } };
    };
    expect(written.tiers?.standard?.investigator).toEqual({
      model: "haiku",
      variant: "standard",
    });
  });

  it("trivial-tier reviewer is sonnet/standard (deliberate cross-model merge gate)", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });

    const written = readConfig(dir, "routing.json") as {
      tiers?: { trivial?: { reviewer?: { model: string; variant: string } } };
    };
    expect(written.tiers?.trivial?.reviewer).toEqual({
      model: "sonnet",
      variant: "standard",
    });
  });

  it("trivial-tier implementer is haiku/standard", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });

    const written = readConfig(dir, "routing.json") as {
      tiers?: { trivial?: { implementer?: { model: string; variant: string } } };
    };
    expect(written.tiers?.trivial?.implementer).toEqual({
      model: "haiku",
      variant: "standard",
    });
  });

  it("complex-tier all roles are opus/deep (unchanged from v1)", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });

    const written = readConfig(dir, "routing.json") as {
      tiers?: {
        complex?: {
          investigator?: { model: string; variant: string };
          implementer?: { model: string; variant: string };
          reviewer?: { model: string; variant: string };
          "conflict-resolver"?: { model: string; variant: string };
        };
      };
    };
    const opusDeep = { model: "opus", variant: "deep" };
    expect(written.tiers?.complex?.investigator).toEqual(opusDeep);
    expect(written.tiers?.complex?.implementer).toEqual(opusDeep);
    expect(written.tiers?.complex?.reviewer).toEqual(opusDeep);
    expect(written.tiers?.complex?.["conflict-resolver"]).toEqual(opusDeep);
  });

  it("carries route:fable label entry with opus fallback (model=fable, variant=deep)", () => {
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });

    const written = readConfig(dir, "routing.json") as {
      labels?: {
        "route:fable"?: {
          roles: string[];
          set: { model: string; variant: string };
          fallback: { model: string; maxRetries: number };
        };
      };
    };
    const fable = written.labels?.["route:fable"];
    expect(fable).toBeDefined();
    expect(fable?.roles).toEqual(["implementer"]);
    expect(fable?.set).toEqual({ model: "fable", variant: "deep" });
    expect(fable?.fallback).toEqual({ model: "opus", maxRetries: 1 });
  });

  it("an existing v1 routing.json is NOT overwritten (idempotency)", () => {
    const dir = repo("package.json");
    fs.mkdirSync(path.join(dir, ".orchestrate"));
    const v1Content = JSON.stringify(
      {
        trivial: {
          investigator: null,
          implementer: { model: "sonnet", effort: "standard" },
          reviewer: { model: "sonnet", effort: "standard" },
          "conflict-resolver": { model: "sonnet", effort: "standard" },
        },
        standard: {
          investigator: null,
          implementer: { model: "sonnet", effort: "standard" },
          reviewer: { model: "opus", effort: "standard" },
          "conflict-resolver": { model: "opus", effort: "standard" },
        },
        complex: {
          investigator: { model: "opus", effort: "deep" },
          implementer: { model: "opus", effort: "deep" },
          reviewer: { model: "opus", effort: "deep" },
          "conflict-resolver": { model: "opus", effort: "deep" },
        },
        intraWaveConcurrency: "parallel",
        continuationBudget: 2,
      },
      null,
      2
    ) + "\n";
    fs.writeFileSync(
      path.join(dir, ".orchestrate", "routing.json"),
      v1Content
    );

    const r = bootstrapConfig({ repoPath: dir });

    expect(r.files!.routingJson).toBe("already-present");
    expect(
      fs.readFileSync(path.join(dir, ".orchestrate", "routing.json"), "utf8")
    ).toBe(v1Content);
  });

  it("an existing v2 routing.json is NOT overwritten (idempotency)", () => {
    const dir = repo("package.json");
    fs.mkdirSync(path.join(dir, ".orchestrate"));
    const v2Content = JSON.stringify(
      {
        version: 2,
        tiers: {
          trivial: {
            investigator: null,
            implementer: { model: "haiku", variant: "standard" },
            reviewer: { model: "sonnet", variant: "standard" },
            "conflict-resolver": { model: "sonnet", variant: "standard" },
          },
          standard: {
            investigator: { model: "haiku", variant: "standard" },
            implementer: { model: "sonnet", variant: "standard" },
            reviewer: { model: "opus", variant: "standard" },
            "conflict-resolver": { model: "opus", variant: "standard" },
          },
          complex: {
            investigator: { model: "opus", variant: "deep" },
            implementer: { model: "opus", variant: "deep" },
            reviewer: { model: "opus", variant: "deep" },
            "conflict-resolver": { model: "opus", variant: "deep" },
          },
        },
        labels: {
          "route:fable": {
            roles: ["implementer"],
            set: { model: "fable", variant: "deep" },
            fallback: { model: "opus", maxRetries: 1 },
          },
        },
        run: { intraWaveConcurrency: "parallel", continuationBudget: 2 },
      },
      null,
      2
    ) + "\n";
    fs.writeFileSync(
      path.join(dir, ".orchestrate", "routing.json"),
      v2Content
    );

    const r = bootstrapConfig({ repoPath: dir });

    expect(r.files!.routingJson).toBe("already-present");
    expect(
      fs.readFileSync(path.join(dir, ".orchestrate", "routing.json"), "utf8")
    ).toBe(v2Content);
  });

  it("template parity — templates/routing.json content matches DEFAULT_ROUTING_CONFIG", () => {
    // Resolve the template path relative to this test file.
    // test/ → orchestrate-mcp/ → orchestrate/ → templates/routing.json
    const templatePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "templates",
      "routing.json"
    );
    const templateParsed = JSON.parse(fs.readFileSync(templatePath, "utf8"));
    // Deep-equal check — same matrix, same labels, same run block, same version.
    expect(templateParsed).toEqual(DEFAULT_ROUTING_CONFIG);
  });

  it("bootstrapped routing.json content matches templates/routing.json (parity via written file)", () => {
    // Resolve the template path relative to this test file.
    const templatePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "templates",
      "routing.json"
    );
    const dir = repo("package.json");
    bootstrapConfig({ repoPath: dir });

    const templateParsed = JSON.parse(fs.readFileSync(templatePath, "utf8"));
    const writtenParsed = readConfig(dir, "routing.json");
    expect(writtenParsed).toEqual(templateParsed);
  });
});
