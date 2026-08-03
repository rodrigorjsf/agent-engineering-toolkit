import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  resolveRouting,
  resolveRoutingFromConfig,
  routingConfigSchema,
  routingConfigSchemaV1,
  routingConfigSchemaV2,
  upgradeV1ToV2,
  loadRoutingConfig,
  applyLabels,
  resolveRoutingV2FromConfig,
  ROUTING_ROLES,
  tierRoutingSchemaV2,
  ensureSliceExecutorDefault,
  type RoutingConfig,
  type RoutingConfigV2,
  type TierRoutingV2,
  type LabelsConfig,
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

// ─── v2 schema (ADR-0015) ─────────────────────────────────────────────────────

/** A well-formed v2 config used as the baseline for the v2 schema tests. */
const VALID_CONFIG_V2: RoutingConfigV2 = {
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
  labels: {},
  run: { intraWaveConcurrency: "parallel", continuationBudget: 2 },
};

describe("routingConfigSchemaV2", () => {
  it("validates the new shape (version/tiers/labels/run)", () => {
    expect(routingConfigSchemaV2.safeParse(VALID_CONFIG_V2).success).toBe(true);
  });

  it("accepts variant: 'standard' and variant: 'deep'", () => {
    const parsed = routingConfigSchemaV2.parse(VALID_CONFIG_V2);
    expect(parsed.tiers.trivial.implementer.variant).toBe("standard");
    expect(parsed.tiers.complex.implementer.variant).toBe("deep");
  });

  it("rejects an invalid variant value", () => {
    const bad = {
      ...VALID_CONFIG_V2,
      tiers: {
        ...VALID_CONFIG_V2.tiers,
        trivial: {
          ...VALID_CONFIG_V2.tiers.trivial,
          implementer: { model: "haiku", variant: "bogus" },
        },
      },
    };
    expect(routingConfigSchemaV2.safeParse(bad).success).toBe(false);
  });

  it("rejects a v2 config whose version is not the literal 2", () => {
    expect(
      routingConfigSchemaV2.safeParse({ ...VALID_CONFIG_V2, version: 1 }).success
    ).toBe(false);
  });

  it("defaults labels to {} and run knobs when omitted", () => {
    const { labels: _l, run: _r, ...noLabelsOrRun } = VALID_CONFIG_V2;
    const parsed = routingConfigSchemaV2.parse(noLabelsOrRun);
    expect(parsed.labels).toEqual({});
    expect(parsed.run.intraWaveConcurrency).toBe("parallel");
    expect(parsed.run.continuationBudget).toBe(2);
  });

  it("validates a labels block with set + fallback", () => {
    const withLabel = {
      ...VALID_CONFIG_V2,
      labels: {
        "route:fable": {
          roles: ["implementer"],
          set: { model: "fable", variant: "deep" },
          fallback: { model: "opus", maxRetries: 1 },
        },
      },
    };
    expect(routingConfigSchemaV2.safeParse(withLabel).success).toBe(true);
  });

  it("still requires all three tiers under `tiers`", () => {
    const { complex: _c, ...missingTier } = VALID_CONFIG_V2.tiers;
    expect(
      routingConfigSchemaV2.safeParse({ ...VALID_CONFIG_V2, tiers: missingTier })
        .success
    ).toBe(false);
  });
});

// ─── v1 → v2 upgrade (explicit mapper) ────────────────────────────────────────

describe("upgradeV1ToV2 / loadRoutingConfig", () => {
  // The canonical on-disk v1 fixture: it OMITS continuationBudget and orders
  // intraWaveConcurrency: "sequential" first — the exact shape of the repo's
  // own live .orchestrate/routing.json before v2.
  const V1_ON_DISK = {
    intraWaveConcurrency: "sequential",
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
  };

  it("maps every tier's effort → variant", () => {
    const v1 = routingConfigSchemaV1.parse(V1_ON_DISK);
    const { config } = upgradeV1ToV2(v1);

    expect(config.version).toBe(2);
    expect(config.tiers.trivial.implementer).toEqual({
      model: "sonnet",
      variant: "standard",
    });
    expect(config.tiers.complex.implementer).toEqual({
      model: "opus",
      variant: "deep",
    });
    // A null investigator survives the upgrade as null.
    expect(config.tiers.trivial.investigator).toBeNull();
    expect(config.tiers.complex.investigator).toEqual({
      model: "opus",
      variant: "deep",
    });
  });

  it("preserves continuationBudget: 0 and intraWaveConcurrency: 'sequential' verbatim", () => {
    // A v1 file that explicitly sets continuationBudget: 0 with sequential.
    const v1raw = { ...V1_ON_DISK, continuationBudget: 0 };
    const result = loadRoutingConfig(v1raw);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.config.run.continuationBudget).toBe(0);
    expect(result.config.run.intraWaveConcurrency).toBe("sequential");
    // And the deprecation warning is present.
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("v1");
  });

  it("lifts the v1 default continuationBudget (2) into run when the key is omitted", () => {
    // V1_ON_DISK omits continuationBudget → v1 schema defaults it to 2.
    const result = loadRoutingConfig(V1_ON_DISK);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.config.run.continuationBudget).toBe(2);
    expect(result.config.run.intraWaveConcurrency).toBe("sequential");
  });

  it("does NOT silently reset run knobs (a naive v2 re-parse would)", () => {
    // The bug the explicit mapper guards against: re-parsing a v1 file under the
    // v2 schema strips the top-level knobs. The loader must preserve them.
    const naive = routingConfigSchemaV2.safeParse(V1_ON_DISK);
    expect(naive.success).toBe(false); // v1 shape is NOT valid v2 — caught loudly.

    const result = loadRoutingConfig(V1_ON_DISK);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // The knob survived rather than resetting to the parallel default.
    expect(result.config.run.intraWaveConcurrency).toBe("sequential");
  });

  it("attaches a deprecation warning on v1 upgrade", () => {
    const result = loadRoutingConfig(V1_ON_DISK);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("deprecated");
  });

  it("loads a v2 file directly with no warning", () => {
    const result = loadRoutingConfig(VALID_CONFIG_V2);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.warnings).toEqual([]);
    expect(result.config.run.intraWaveConcurrency).toBe("parallel");
  });

  it("returns a structured error for an unsupported version", () => {
    const result = loadRoutingConfig({ ...VALID_CONFIG_V2, version: 99 });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.errorMessage).toContain("version");
  });

  it("returns a structured error for a malformed v1 shape (never throws)", () => {
    const result = loadRoutingConfig({ trivial: {} });
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.errorMessage).toContain("v1");
  });
});

// ─── Label-override merge (pure) ──────────────────────────────────────────────

describe("applyLabels", () => {
  const tier: TierRoutingV2 = VALID_CONFIG_V2.tiers.standard;

  const labels: LabelsConfig = {
    "route:fable": {
      roles: ["implementer"],
      set: { model: "fable", variant: "deep" },
      fallback: { model: "opus", maxRetries: 1 },
    },
    "route:opus-review": {
      roles: ["reviewer"],
      set: { model: "opus", variant: "deep" },
    },
    // A second label that ALSO patches implementer — used for conflict tests.
    "route:opus-impl": {
      roles: ["implementer"],
      set: { model: "opus", variant: "deep" },
    },
  };

  it("applies the override to the named role only, leaving others untouched", () => {
    const r = applyLabels(tier, ["route:fable"], labels);

    expect(r.error).toBeUndefined();
    expect(r.routing.implementer).toEqual({ model: "fable", variant: "deep" });
    // Every other role is unchanged from the tier baseline.
    expect(r.routing.reviewer).toEqual(tier.reviewer);
    expect(r.routing["conflict-resolver"]).toEqual(tier["conflict-resolver"]);
    expect(r.routing.investigator).toEqual(tier.investigator);
  });

  it("does not mutate the input tier routing", () => {
    const before = JSON.parse(JSON.stringify(tier));
    applyLabels(tier, ["route:fable"], labels);
    expect(tier).toEqual(before);
  });

  it("applies two non-conflicting labels to their distinct roles", () => {
    const r = applyLabels(tier, ["route:fable", "route:opus-review"], labels);

    expect(r.error).toBeUndefined();
    expect(r.routing.implementer).toEqual({ model: "fable", variant: "deep" });
    expect(r.routing.reviewer).toEqual({ model: "opus", variant: "deep" });
  });

  it("returns a structured error when two labels patch the same role", () => {
    const r = applyLabels(tier, ["route:fable", "route:opus-impl"], labels);

    expect(r.error).toBeDefined();
    expect(r.error).toContain("implementer");
    expect(r.error).toContain("route:fable");
    expect(r.error).toContain("route:opus-impl");
    // On conflict the routing is returned unchanged (no partial application).
    expect(r.routing).toEqual(tier);
  });

  it("returns a structured warning for a route:* label absent from config", () => {
    const r = applyLabels(tier, ["route:unknown"], labels);

    expect(r.error).toBeUndefined();
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toContain("route:unknown");
    // Never a silent no-op: routing is untouched but the warning is loud.
    expect(r.routing).toEqual(tier);
  });

  it("resolves and returns the per-label fallback spec", () => {
    const r = applyLabels(tier, ["route:fable"], labels);

    expect(r.fallbacks).toEqual([
      {
        role: "implementer",
        label: "route:fable",
        fallback: { model: "opus", maxRetries: 1 },
      },
    ]);
  });

  it("returns no fallback for a label without one", () => {
    const r = applyLabels(tier, ["route:opus-review"], labels);
    expect(r.fallbacks).toEqual([]);
  });

  it("is a no-op (no error, no warning) when no labels are applied", () => {
    const r = applyLabels(tier, [], labels);
    expect(r.error).toBeUndefined();
    expect(r.warnings).toEqual([]);
    expect(r.fallbacks).toEqual([]);
    expect(r.routing).toEqual(tier);
  });
});

// ─── resolveRoutingV2FromConfig (handler-level tests) ─────────────────────────

/** A v1 on-disk config — used to test the transparent upgrade path. */
const V1_CONFIG_FOR_V2_HANDLER: RoutingConfig = {
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

/**
 * A v2 on-disk config with a labels block for testing label overrides.
 * Carries an explicit `slice-executor` entry per tier (mirroring that tier's
 * `implementer`) so it is a COMPLETE, current-schema fixture — the
 * "no warnings" assertions elsewhere in this suite stay true. The dedicated
 * `V2_CONFIG_PREDATING_SLICE_EXECUTOR` fixture below is the one that omits it,
 * for testing the back-compat default-fill path.
 */
const V2_CONFIG_WITH_LABELS: RoutingConfigV2 = {
  version: 2,
  tiers: {
    trivial: {
      investigator: null,
      implementer: { model: "haiku", variant: "standard" },
      reviewer: { model: "sonnet", variant: "standard" },
      "conflict-resolver": { model: "sonnet", variant: "standard" },
      "slice-executor": { model: "haiku", variant: "standard" },
    },
    standard: {
      investigator: { model: "haiku", variant: "standard" },
      implementer: { model: "sonnet", variant: "standard" },
      reviewer: { model: "opus", variant: "standard" },
      "conflict-resolver": { model: "opus", variant: "standard" },
      "slice-executor": { model: "sonnet", variant: "standard" },
    },
    complex: {
      investigator: { model: "opus", variant: "deep" },
      implementer: { model: "opus", variant: "deep" },
      reviewer: { model: "opus", variant: "deep" },
      "conflict-resolver": { model: "opus", variant: "deep" },
      "slice-executor": { model: "opus", variant: "deep" },
    },
  },
  labels: {
    "route:fable": {
      roles: ["implementer"],
      set: { model: "fable", variant: "deep" },
      fallback: { model: "opus", maxRetries: 1 },
    },
    "route:opus-review": {
      roles: ["reviewer"],
      set: { model: "opus", variant: "deep" },
    },
    // Conflicts with route:fable on implementer.
    "route:opus-impl": {
      roles: ["implementer"],
      set: { model: "opus", variant: "deep" },
    },
  },
  run: { intraWaveConcurrency: "parallel", continuationBudget: 3 },
};

/** Drops a tier's `slice-executor` entry, keeping every other field intact. */
function omitSliceExecutor(tier: TierRoutingV2): TierRoutingV2 {
  const { "slice-executor": _dropped, ...rest } = tier;
  return rest;
}

/**
 * `V2_CONFIG_WITH_LABELS`, but with the `slice-executor` entry stripped from
 * every tier — the shape a routing.json written before #356 has on disk. Used
 * only to test the back-compat default-fill path
 * ({@link ensureSliceExecutorDefault}); every other test uses the complete
 * fixture above.
 */
const V2_CONFIG_PREDATING_SLICE_EXECUTOR: RoutingConfigV2 = {
  ...V2_CONFIG_WITH_LABELS,
  tiers: {
    trivial: omitSliceExecutor(V2_CONFIG_WITH_LABELS.tiers.trivial),
    standard: omitSliceExecutor(V2_CONFIG_WITH_LABELS.tiers.standard),
    complex: omitSliceExecutor(V2_CONFIG_WITH_LABELS.tiers.complex),
  },
};

describe("resolveRoutingV2FromConfig", () => {
  it("resolves a tier from a v1 routing.json (transparent upgrade), output uses variant not effort", () => {
    const dir = project(V1_CONFIG_FOR_V2_HANDLER);
    const r = resolveRoutingV2FromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.tier).toBe("standard");
    // Output uses variant, not effort.
    expect(r.routing!.implementer).toEqual({ model: "sonnet", variant: "standard" });
    expect(r.routing!.reviewer).toEqual({ model: "opus", variant: "standard" });
    // No effort key in output.
    expect((r.routing!.implementer as Record<string, unknown>)["effort"]).toBeUndefined();
  });

  it("includes a v1-deprecation warning when loading a v1 config", () => {
    const dir = project(V1_CONFIG_FOR_V2_HANDLER);
    const r = resolveRoutingV2FromConfig({ tier: "trivial", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.warnings!.length).toBeGreaterThan(0);
    expect(r.warnings![0]).toContain("v1");
  });

  it("returns no warnings and uses variant when loading a v2 config without labels", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.warnings).toEqual([]);
    expect(r.routing!.implementer.variant).toBe("standard");
    expect(r.continuationBudget).toBe(3);
  });

  it("applies a label override to the named role, outputs variant", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({
      tier: "standard",
      repoPath: dir,
      labels: ["route:fable"],
    });

    expect(r.status).toBe("ok");
    expect(r.routing!.implementer).toEqual({ model: "fable", variant: "deep" });
    // Other roles unchanged.
    expect(r.routing!.reviewer).toEqual(V2_CONFIG_WITH_LABELS.tiers.standard.reviewer);
  });

  it("resolves and returns the fallback spec when the label carries one", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({
      tier: "standard",
      repoPath: dir,
      labels: ["route:fable"],
    });

    expect(r.status).toBe("ok");
    expect(r.fallbacks).toEqual([
      {
        role: "implementer",
        label: "route:fable",
        fallback: { model: "opus", maxRetries: 1 },
      },
    ]);
  });

  it("returns empty fallbacks when the label carries no fallback", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({
      tier: "standard",
      repoPath: dir,
      labels: ["route:opus-review"],
    });

    expect(r.status).toBe("ok");
    expect(r.fallbacks).toEqual([]);
  });

  it("returns status='error' with errorCode='LABEL_CONFLICT' on same-role conflict", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({
      tier: "standard",
      repoPath: dir,
      labels: ["route:fable", "route:opus-impl"],
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("LABEL_CONFLICT");
    expect(r.errorMessage).toContain("implementer");
    expect(r.errorMessage).toContain("route:fable");
    expect(r.errorMessage).toContain("route:opus-impl");
  });

  it("returns a structured warning for a route:* label absent from config", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({
      tier: "standard",
      repoPath: dir,
      labels: ["route:unknown-label"],
    });

    expect(r.status).toBe("ok");
    expect(r.warnings!.some((w) => w.includes("route:unknown-label"))).toBe(true);
    // Routing is untouched (the original tier routing for standard applies).
    expect(r.routing!.implementer).toEqual(V2_CONFIG_WITH_LABELS.tiers.standard.implementer);
  });

  it("silently ignores non-route:* labels (no warning produced for ordinary GitHub labels)", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({
      tier: "standard",
      repoPath: dir,
      labels: ["bug", "enhancement", "needs-triage"],
    });

    expect(r.status).toBe("ok");
    // No warnings from the ordinary labels — they are filtered out before applyLabels.
    expect(r.warnings).toEqual([]);
  });

  it("returns empty fallbacks and no warnings when no labels are passed", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({ tier: "complex", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.fallbacks).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("returns errorCode='CONFIG_NOT_FOUND' when routing.json is absent", () => {
    const dir = project(null);
    const r = resolveRoutingV2FromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_NOT_FOUND");
  });

  it("returns errorCode='CONFIG_INVALID' for malformed JSON", () => {
    const dir = project("{ not valid json");
    const r = resolveRoutingV2FromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("CONFIG_INVALID");
  });

  it("echoes the continuationBudget from the v2 run block", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({ tier: "trivial", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.continuationBudget).toBe(3);
  });
});

// ─── slice-executor role (ADR-0017, #356) ─────────────────────────────────────

describe("ROUTING_ROLES", () => {
  it("includes slice-executor alongside the original four pipeline roles", () => {
    expect(ROUTING_ROLES).toEqual([
      "investigator",
      "implementer",
      "reviewer",
      "conflict-resolver",
      "slice-executor",
    ]);
  });
});

describe("tierRoutingSchemaV2 slice-executor field", () => {
  const tier = VALID_CONFIG_V2.tiers.standard;

  it("still validates when slice-executor is absent (back-compat)", () => {
    expect(tierRoutingSchemaV2.safeParse(tier).success).toBe(true);
  });

  it("accepts an explicit slice-executor entry", () => {
    const withExecutor = {
      ...tier,
      "slice-executor": { model: "opus", variant: "deep" },
    };
    const parsed = tierRoutingSchemaV2.safeParse(withExecutor);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data["slice-executor"]).toEqual({
        model: "opus",
        variant: "deep",
      });
    }
  });

  it("rejects an explicit null for slice-executor — it is never skippable, unlike investigator", () => {
    const withNull = { ...tier, "slice-executor": null };
    expect(tierRoutingSchemaV2.safeParse(withNull).success).toBe(false);
  });
});

describe("ensureSliceExecutorDefault", () => {
  it("returns the tier unchanged, no warning, when slice-executor is already present", () => {
    const tier = {
      ...VALID_CONFIG_V2.tiers.complex,
      "slice-executor": { model: "opus", variant: "deep" as const },
    };
    const r = ensureSliceExecutorDefault(tier, "complex");

    expect(r.warning).toBeUndefined();
    expect(r.routing["slice-executor"]).toEqual({
      model: "opus",
      variant: "deep",
    });
  });

  it("defaults slice-executor to the tier's own implementer entry when absent", () => {
    const tier = VALID_CONFIG_V2.tiers.standard; // implementer: sonnet/standard
    const r = ensureSliceExecutorDefault(tier, "standard");

    expect(r.routing["slice-executor"]).toEqual(tier.implementer);
    expect(r.warning).toBeDefined();
    expect(r.warning).toContain("slice-executor");
    // The warning must name the tier so an aggregated run report is attributable.
    expect(r.warning).toContain("standard");
  });

  it("defaults differ per tier, mirroring each tier's own implementer", () => {
    const trivial = ensureSliceExecutorDefault(
      VALID_CONFIG_V2.tiers.trivial,
      "trivial"
    );
    const complex = ensureSliceExecutorDefault(
      VALID_CONFIG_V2.tiers.complex,
      "complex"
    );

    expect(trivial.routing["slice-executor"]).toEqual(
      VALID_CONFIG_V2.tiers.trivial.implementer
    );
    expect(complex.routing["slice-executor"]).toEqual(
      VALID_CONFIG_V2.tiers.complex.implementer
    );
    expect(trivial.routing["slice-executor"]).not.toEqual(
      complex.routing["slice-executor"]
    );
  });

  it("does not mutate the input tier", () => {
    const tier = VALID_CONFIG_V2.tiers.trivial;
    const before = JSON.parse(JSON.stringify(tier));
    ensureSliceExecutorDefault(tier, "trivial");
    expect(tier).toEqual(before);
  });
});

describe("applyLabels carries slice-executor through untouched when not targeted", () => {
  it("leaves a pre-filled slice-executor entry unchanged when no label targets it", () => {
    const tier: TierRoutingV2 = {
      ...VALID_CONFIG_V2.tiers.standard,
      "slice-executor": { model: "sonnet", variant: "standard" },
    };
    const r = applyLabels(tier, ["route:fable"], {
      "route:fable": {
        roles: ["implementer"],
        set: { model: "fable", variant: "deep" },
      },
    });

    expect(r.error).toBeUndefined();
    expect(r.routing["slice-executor"]).toEqual(tier["slice-executor"]);
  });
});

describe("resolveRoutingV2FromConfig — slice-executor (#356)", () => {
  it("resolves slice-executor for all three tiers from a config that declares it explicitly", () => {
    const withExecutor: RoutingConfigV2 = {
      ...V2_CONFIG_WITH_LABELS,
      tiers: {
        trivial: {
          ...V2_CONFIG_WITH_LABELS.tiers.trivial,
          "slice-executor": { model: "haiku", variant: "standard" },
        },
        standard: {
          ...V2_CONFIG_WITH_LABELS.tiers.standard,
          "slice-executor": { model: "sonnet", variant: "standard" },
        },
        complex: {
          ...V2_CONFIG_WITH_LABELS.tiers.complex,
          "slice-executor": { model: "opus", variant: "deep" },
        },
      },
    };
    const dir = project(withExecutor);

    const trivial = resolveRoutingV2FromConfig({ tier: "trivial", repoPath: dir });
    const standard = resolveRoutingV2FromConfig({ tier: "standard", repoPath: dir });
    const complex = resolveRoutingV2FromConfig({ tier: "complex", repoPath: dir });

    expect(trivial.status).toBe("ok");
    expect(standard.status).toBe("ok");
    expect(complex.status).toBe("ok");
    expect(trivial.routing!["slice-executor"]).toEqual({
      model: "haiku",
      variant: "standard",
    });
    expect(standard.routing!["slice-executor"]).toEqual({
      model: "sonnet",
      variant: "standard",
    });
    expect(complex.routing!["slice-executor"]).toEqual({
      model: "opus",
      variant: "deep",
    });
    // No slice-executor warning when the config already declares it.
    expect(
      trivial.warnings!.some((w) => w.includes("slice-executor"))
    ).toBe(false);
  });

  it("defaults slice-executor to the implementer entry with a warning when the config predates the role", () => {
    const dir = project(V2_CONFIG_PREDATING_SLICE_EXECUTOR);
    const r = resolveRoutingV2FromConfig({ tier: "standard", repoPath: dir });

    expect(r.status).toBe("ok");
    expect(r.routing!["slice-executor"]).toEqual(
      V2_CONFIG_PREDATING_SLICE_EXECUTOR.tiers.standard.implementer
    );
    expect(r.warnings!.some((w) => w.includes("slice-executor"))).toBe(true);
  });

  it("a route:* label naming slice-executor patches it, overriding the tier's explicit entry", () => {
    const withLabel: RoutingConfigV2 = {
      ...V2_CONFIG_WITH_LABELS,
      labels: {
        ...V2_CONFIG_WITH_LABELS.labels,
        "route:strong-exec": {
          roles: ["slice-executor"],
          set: { model: "opus", variant: "deep" },
        },
      },
    };
    const dir = project(withLabel);
    const r = resolveRoutingV2FromConfig({
      tier: "trivial",
      repoPath: dir,
      labels: ["route:strong-exec"],
    });

    expect(r.status).toBe("ok");
    expect(r.routing!["slice-executor"]).toEqual({
      model: "opus",
      variant: "deep",
    });
  });

  // The two tests below pin the ORDER of ensureSliceExecutorDefault vs
  // applyLabels. Both use the fixture that omits the role, so the default-fill
  // path actually runs — the test above uses a config that declares it
  // explicitly, so no default is derived there.
  it("a route:* label naming slice-executor beats the implementer-derived default", () => {
    const withLabel: RoutingConfigV2 = {
      ...V2_CONFIG_PREDATING_SLICE_EXECUTOR,
      labels: {
        ...V2_CONFIG_PREDATING_SLICE_EXECUTOR.labels,
        "route:strong-exec": {
          roles: ["slice-executor"],
          set: { model: "opus", variant: "deep" },
        },
      },
    };
    const dir = project(withLabel);
    const r = resolveRoutingV2FromConfig({
      tier: "trivial",
      repoPath: dir,
      labels: ["route:strong-exec"],
    });

    expect(r.status).toBe("ok");
    expect(r.routing!["slice-executor"]).toEqual({
      model: "opus",
      variant: "deep",
    });
    // Not the passive default the fill would otherwise have produced.
    expect(r.routing!["slice-executor"]).not.toEqual(
      V2_CONFIG_PREDATING_SLICE_EXECUTOR.tiers.trivial.implementer
    );
  });

  it("a label patching only implementer does not drag the defaulted slice-executor with it", () => {
    const dir = project(V2_CONFIG_PREDATING_SLICE_EXECUTOR);
    const r = resolveRoutingV2FromConfig({
      tier: "standard",
      repoPath: dir,
      labels: ["route:fable"],
    });

    expect(r.status).toBe("ok");
    expect(r.routing!.implementer).toEqual({ model: "fable", variant: "deep" });
    // The default is seeded from the CONFIGURED implementer, before the label
    // patched it — route:fable names only `implementer`. Reversing the order of
    // the default-fill and the label pass would make this fable/deep instead.
    expect(r.routing!["slice-executor"]).toEqual(
      V2_CONFIG_PREDATING_SLICE_EXECUTOR.tiers.standard.implementer
    );
  });

  it("two labels both patching slice-executor is a structured LABEL_CONFLICT error, no precedence rule", () => {
    const withConflict: RoutingConfigV2 = {
      ...V2_CONFIG_WITH_LABELS,
      labels: {
        ...V2_CONFIG_WITH_LABELS.labels,
        "route:exec-a": {
          roles: ["slice-executor"],
          set: { model: "opus", variant: "deep" },
        },
        "route:exec-b": {
          roles: ["slice-executor"],
          set: { model: "sonnet", variant: "standard" },
        },
      },
    };
    const dir = project(withConflict);
    const r = resolveRoutingV2FromConfig({
      tier: "trivial",
      repoPath: dir,
      labels: ["route:exec-a", "route:exec-b"],
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("LABEL_CONFLICT");
    expect(r.errorMessage).toContain("slice-executor");
    expect(r.errorMessage).toContain("route:exec-a");
    expect(r.errorMessage).toContain("route:exec-b");
  });

  it("an unconfigured route:* label naming slice-executor still produces the generic structured warning", () => {
    const dir = project(V2_CONFIG_WITH_LABELS);
    const r = resolveRoutingV2FromConfig({
      tier: "trivial",
      repoPath: dir,
      labels: ["route:no-such-executor-label"],
    });

    expect(r.status).toBe("ok");
    expect(
      r.warnings!.some((w) => w.includes("route:no-such-executor-label"))
    ).toBe(true);
  });
});
