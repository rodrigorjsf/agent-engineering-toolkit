import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  resolveRouting,
  resolveRoutingFromConfig,
  routingConfigSchema,
  type RoutingConfig,
} from "../src/tools/routing.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** A well-formed routing config used as the baseline for the file-based tests. */
const VALID_CONFIG: RoutingConfig = {
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
};

/** Writes a project dir; `config` null skips the routing.json file entirely. */
function makeProject(config: unknown | string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-routing-"));
  if (config !== null) {
    fs.mkdirSync(path.join(dir, ".orchestrate"));
    const content =
      typeof config === "string" ? config : JSON.stringify(config, null, 2);
    fs.writeFileSync(path.join(dir, ".orchestrate", "routing.json"), content);
  }
  return dir;
}

const created: string[] = [];
function project(config: unknown | string | null): string {
  const dir = makeProject(config);
  created.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  created.length = 0;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("resolveRouting (pure)", () => {
  it("returns the per-role routing block for a tier", () => {
    expect(resolveRouting("complex", VALID_CONFIG)).toEqual(
      VALID_CONFIG.complex
    );
  });
});

describe("resolveRoutingFromConfig", () => {
  it("resolves a tier from a valid routing.json", () => {
    const dir = project(VALID_CONFIG);
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.tier).toBe("standard");
    expect(r.routing).toEqual(VALID_CONFIG.standard);
    expect(r.errorCode).toBeUndefined();
  });

  it("resolves a trivial and a complex issue to different model or effort", () => {
    const dir = project(VALID_CONFIG);
    const trivial = resolveRoutingFromConfig({ tier: "trivial", repoPath: dir });
    const complex = resolveRoutingFromConfig({ tier: "complex", repoPath: dir });

    expect(trivial.status).toBe("ok");
    expect(complex.status).toBe("ok");
    // The implementer differs across the two tiers.
    expect(trivial.routing!.implementer).not.toEqual(
      complex.routing!.implementer
    );
    expect(complex.routing!.implementer.effort).toBe("deep");
    expect(trivial.routing!.implementer.effort).toBe("standard");
  });

  it("returns a null investigator for low tiers and a non-null one for complex", () => {
    const dir = project(VALID_CONFIG);

    expect(
      resolveRoutingFromConfig({ tier: "trivial", repoPath: dir }).routing!
        .investigator
    ).toBeNull();
    expect(
      resolveRoutingFromConfig({ tier: "standard", repoPath: dir }).routing!
        .investigator
    ).toBeNull();
    expect(
      resolveRoutingFromConfig({ tier: "complex", repoPath: dir }).routing!
        .investigator
    ).not.toBeNull();
  });

  it("returns errorCode='CONFIG_NOT_FOUND' when routing.json is absent", () => {
    const dir = project(null);
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_NOT_FOUND");
  });

  it("returns errorCode='CONFIG_INVALID' for malformed JSON", () => {
    const dir = project("{ not valid json");
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_INVALID");
  });

  it("returns errorCode='CONFIG_INVALID' when a tier is missing", () => {
    const { complex, ...missingComplex } = VALID_CONFIG;
    const dir = project(missingComplex);
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_INVALID");
  });

  it("returns errorCode='CONFIG_INVALID' when a required role is missing", () => {
    const broken = {
      ...VALID_CONFIG,
      standard: { investigator: null, implementer: VALID_CONFIG.standard.implementer },
    };
    const dir = project(broken);
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_INVALID");
  });
});

describe("routingConfigSchema intraWaveConcurrency", () => {
  // A tiers-only object (no run-policy key) — the shape a pre-knob
  // routing.json has on disk. Built by dropping the key VALID_CONFIG now
  // carries, mirroring the destructure-and-ignore pattern used above for the
  // missing-tier case.
  const { intraWaveConcurrency: _drop, ...tiersOnly } = VALID_CONFIG;

  it("accepts intraWaveConcurrency: 'sequential'", () => {
    expect(
      routingConfigSchema.safeParse({
        ...VALID_CONFIG,
        intraWaveConcurrency: "sequential",
      }).success
    ).toBe(true);
  });

  it("rejects an invalid intraWaveConcurrency value", () => {
    expect(
      routingConfigSchema.safeParse({
        ...VALID_CONFIG,
        intraWaveConcurrency: "bogus",
      }).success
    ).toBe(false);
  });

  it("defaults intraWaveConcurrency to 'parallel' when omitted", () => {
    expect(routingConfigSchema.parse(tiersOnly).intraWaveConcurrency).toBe(
      "parallel"
    );
  });

  it("still requires the three tier blocks (knob is optional, tiers are not)", () => {
    const { complex: _complex, ...missingTier } = tiersOnly;
    expect(
      routingConfigSchema.safeParse({
        ...missingTier,
        intraWaveConcurrency: "sequential",
      }).success
    ).toBe(false);
  });
});

describe("routingConfigSchema continuationBudget (#234)", () => {
  // A config with no continuationBudget key — the shape a pre-knob routing.json
  // has on disk. Drop only continuationBudget so the three tiers remain.
  const { continuationBudget: _drop, ...noBudget } = VALID_CONFIG;

  it("resolves continuationBudget === 2 (the default) when the key is absent", () => {
    const dir = project(noBudget);
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.continuationBudget).toBe(2);
  });

  it("echoes an explicit continuationBudget verbatim", () => {
    const dir = project({ ...VALID_CONFIG, continuationBudget: 5 });
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.continuationBudget).toBe(5);
  });

  it("accepts continuationBudget: 0 (continuation disabled)", () => {
    const dir = project({ ...VALID_CONFIG, continuationBudget: 0 });
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.continuationBudget).toBe(0);
  });

  it("rejects a negative continuationBudget → CONFIG_INVALID", () => {
    const dir = project({ ...VALID_CONFIG, continuationBudget: -1 });
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_INVALID");
  });

  it("rejects a non-integer continuationBudget → CONFIG_INVALID", () => {
    const dir = project({ ...VALID_CONFIG, continuationBudget: 1.5 });
    const r = resolveRoutingFromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_INVALID");
  });
});
