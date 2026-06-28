/**
 * Routing module — model/variant selection per complexity tier (ADR-0015).
 *
 * Two schema generations coexist here, deliberately:
 *
 * - The **legacy / v1** surface ({@link roleConfigSchema},
 *   {@link tierRoutingSchema}, {@link routingConfigSchema}, {@link resolveRouting},
 *   {@link resolveRoutingFromConfig}) keys per-role config on `effort`
 *   (`standard`|`deep`) and carries the run-policy knobs
 *   (`intraWaveConcurrency`, `continuationBudget`) at the top level. This is the
 *   shape on disk in pre-v2 `.orchestrate/routing.json` files and the shape the
 *   current `index.ts` `resolve_routing` handler and `bootstrap_config`
 *   defaults read. It is retained UNCHANGED so those consumers stay green while
 *   the v2 layer lands in a separate slice.
 *
 * - The **v2** surface ({@link routingConfigSchemaV2} and friends) introduced by
 *   ADR-0015 renames the per-role key `effort` → `variant` (it selects which
 *   subagent definition file is spawned — `-standard` vs `-deep` — and was never
 *   the API effort parameter), groups the run-policy knobs under a `run` block,
 *   and adds a generic `labels` block for the label-gated premium lane. A
 *   `version: 2` discriminator distinguishes it from v1.
 *
 * v1 files upgrade to v2 in memory through an EXPLICIT field-by-field mapper
 * ({@link upgradeV1ToV2}) rather than a naive re-parse: zod strips unknown keys,
 * so re-parsing a v1 file under the v2 schema would silently drop
 * `intraWaveConcurrency`/`continuationBudget` and reset them to defaults. The
 * version-dispatch loader ({@link loadRoutingConfig}) routes by the `version`
 * field. Label overrides merge through pure functions ({@link applyLabels}) that
 * return structured data — they never throw.
 */
import * as path from "path";
import * as fs from "fs";
import { z } from "zod";

// ─── Tiers, roles, efforts ────────────────────────────────────────────────────

/** Complexity tiers an issue is assessed into, low to high. */
export const COMPLEXITY_TIERS = ["trivial", "standard", "complex"] as const;
export type ComplexityTier = (typeof COMPLEXITY_TIERS)[number];

/** The per-role subagent variants. Renamed from the legacy `effort` key in v2. */
export const ROLE_VARIANTS = ["standard", "deep"] as const;
export type RoleVariant = (typeof ROLE_VARIANTS)[number];

/** The four pipeline roles a label override may patch. */
export const ROUTING_ROLES = [
  "investigator",
  "implementer",
  "reviewer",
  "conflict-resolver",
] as const;
export type RoutingRole = (typeof ROUTING_ROLES)[number];

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

/** Per-role routing: which model to spawn with, and which effort variant. */
const roleConfigSchema = z.object({
  model: z
    .string()
    .min(1)
    .describe("Model id to spawn the role's subagent with (e.g. 'sonnet', 'opus')."),
  effort: z
    .enum(["standard", "deep"])
    .describe(
      "Effort variant of the subagent to spawn — selects the '-standard' or " +
        "'-deep' subagent definition."
    ),
});

/**
 * Routing for one complexity tier. `investigator` may be `null` — that tier
 * skips the investigation pass. The other three roles always run, so their
 * config is required.
 */
const tierRoutingSchema = z.object({
  investigator: roleConfigSchema.nullable(),
  implementer: roleConfigSchema,
  reviewer: roleConfigSchema,
  "conflict-resolver": roleConfigSchema,
});

/**
 * Schema for `.orchestrate/routing.json` — one routing block per complexity
 * tier. All three tiers must be present.
 */
export const routingConfigSchema = z.object({
  trivial: tierRoutingSchema,
  standard: tierRoutingSchema,
  complex: tierRoutingSchema,
  intraWaveConcurrency: z
    .enum(["parallel", "sequential"])
    .optional()
    .default("parallel")
    .describe(
      "Run-wide policy: how to process the independent slices within one " +
        "wave. 'parallel' (default) spawns all processable slices at once " +
        "and integrates them sequentially. 'sequential' processes slices one " +
        "at a time in issue-id ascending order, refreshing the umbrella base " +
        "between each so slice N branches from base+slice1..N-1 — guaranteed " +
        "conflict-free, at the cost of serializing the wave. Optional; the " +
        "three tier blocks remain required."
    ),
  continuationBudget: z
    .number()
    .int()
    .min(0)
    .default(2)
    .describe(
      "How many times the orchestrator may re-spawn the implementer in the " +
        "same worktree after an 'incomplete' envelope (re-spawns BEYOND the " +
        "initial run). 0 disables continuation (incomplete FAILs immediately, " +
        "the legacy behavior). Defaults to 2."
    ),
});

/**
 * Explicit v1 schema for upgrade. An alias of {@link routingConfigSchema} — the
 * legacy config schema already parses the tier blocks AND the top-level
 * run-policy keys (`intraWaveConcurrency`, `continuationBudget`), so it is the
 * field-faithful v1 parser the upgrade path needs. Naming it `…V1` makes the
 * version-dispatch code self-documenting; it is the SAME schema object.
 */
export const routingConfigSchemaV1 = routingConfigSchema;

export const resolveRoutingInputSchema = z.object({
  tier: z
    .enum(COMPLEXITY_TIERS)
    .describe(
      "The complexity tier the orchestrator assessed the issue into. " +
        "'trivial' = a small, localized change; 'standard' = an ordinary " +
        "feature or fix; 'complex' = broad, cross-cutting, or high-risk work."
    ),
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the project root holding .orchestrate/routing.json. Defaults " +
        "to the MCP server process's current working directory — callers " +
        "should pass it explicitly."
    ),
});

export const resolveRoutingOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the tier resolved; 'error' = routing.json " +
        "is missing or malformed."
    ),
  tier: z
    .enum(COMPLEXITY_TIERS)
    .optional()
    .describe("The tier that was resolved. Present when status='ok'."),
  routing: tierRoutingSchema
    .optional()
    .describe(
      "The resolved per-role routing for the tier. `investigator` is null " +
        "when this tier skips the investigation pass. Present when status='ok'."
    ),
  errorCode: z
    .enum(["CONFIG_NOT_FOUND", "CONFIG_INVALID"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'. " +
        "'CONFIG_NOT_FOUND' = no .orchestrate/routing.json; 'CONFIG_INVALID' " +
        "= it is malformed JSON or does not match the expected shape."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='error'."
    ),
  continuationBudget: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "The resolved continuation budget for this run — how many implementer " +
        "re-spawns are allowed after an 'incomplete' envelope. Present when " +
        "status='ok'."
    ),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type RoutingConfig = z.infer<typeof routingConfigSchema>;
export type TierRouting = z.infer<typeof tierRoutingSchema>;
export type ResolveRoutingInput = z.infer<typeof resolveRoutingInputSchema>;
export type ResolveRoutingOutput = z.infer<typeof resolveRoutingOutputSchema>;

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Resolves the per-role routing for one complexity tier from a validated
 * routing config. Pure — no I/O. Every tier key is present by construction of
 * {@link routingConfigSchema}, so this is a total lookup.
 */
export function resolveRouting(
  tier: ComplexityTier,
  config: RoutingConfig
): TierRouting {
  return config[tier];
}

/** Returns the first non-empty trimmed line of a (possibly multi-line) string. */
function firstLine(message: string): string {
  const line = message
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? message.trim();
}

/**
 * Loads `.orchestrate/routing.json`, validates it, and resolves the routing for
 * `input.tier`. Never throws — every failure mode is a structured result.
 */
export function resolveRoutingFromConfig(
  input: ResolveRoutingInput
): ResolveRoutingOutput {
  const cwd = input.repoPath ?? process.cwd();
  const configPath = path.join(cwd, ".orchestrate", "routing.json");

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch {
    return {
      status: "error",
      errorCode: "CONFIG_NOT_FOUND",
      errorMessage:
        `No .orchestrate/routing.json found in ${cwd}. Copy the orchestrate ` +
        `plugin's templates/routing.json to .orchestrate/routing.json.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: "error",
      errorCode: "CONFIG_INVALID",
      errorMessage: `.orchestrate/routing.json is not valid JSON: ${firstLine(
        err instanceof Error ? err.message : String(err)
      )}`,
    };
  }

  const config = routingConfigSchema.safeParse(parsed);
  if (!config.success) {
    const detail = config.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      status: "error",
      errorCode: "CONFIG_INVALID",
      errorMessage: `.orchestrate/routing.json does not match the expected shape: ${detail}`,
    };
  }

  return {
    status: "ok",
    tier: input.tier,
    routing: resolveRouting(input.tier, config.data),
    continuationBudget: config.data.continuationBudget,
  };
}

// ─── v2 schema (ADR-0015) ─────────────────────────────────────────────────────

/**
 * Per-role routing, v2 shape: which model to spawn with, and which subagent
 * `variant` (`standard`|`deep`). `variant` REPLACES the legacy `effort` key —
 * it selects the `-standard`/`-deep` subagent definition file and was never the
 * API effort parameter.
 */
export const roleConfigSchemaV2 = z.object({
  model: z
    .string()
    .min(1)
    .describe("Model id to spawn the role's subagent with (e.g. 'sonnet', 'opus')."),
  variant: z
    .enum(ROLE_VARIANTS)
    .describe(
      "Subagent variant to spawn — selects the '-standard' or '-deep' subagent " +
        "definition file. Renamed from the legacy v1 `effort` key."
    ),
});

/**
 * Routing for one complexity tier, v2 shape. `investigator` may be `null` — that
 * tier skips the investigation pass. The other three roles always run.
 */
export const tierRoutingSchemaV2 = z.object({
  investigator: roleConfigSchemaV2.nullable(),
  implementer: roleConfigSchemaV2,
  reviewer: roleConfigSchemaV2,
  "conflict-resolver": roleConfigSchemaV2,
});

/** Per-label model fallback: one re-spawn as `{model}` on a spawn failure. */
export const labelFallbackSchema = z.object({
  model: z
    .string()
    .min(1)
    .describe("Model id to re-spawn with when the label's primary model fails."),
  maxRetries: z
    .number()
    .int()
    .min(0)
    .describe(
      "How many times to re-spawn with the fallback model before giving up."
    ),
});

/**
 * One `route:*` label override. `roles` names which roles the override applies
 * to; `set` is the `{model, variant}` patch applied to each named role; the
 * optional `fallback` is resolved and returned alongside the patched routing.
 */
export const labelSpecSchema = z.object({
  roles: z
    .array(z.enum(ROUTING_ROLES))
    .min(1)
    .describe("The roles this label override patches. At least one."),
  set: roleConfigSchemaV2.describe(
    "The {model, variant} patch applied to every role named in `roles`."
  ),
  fallback: labelFallbackSchema
    .optional()
    .describe("Optional model-fallback spec resolved and returned on a match."),
});

/** The generic `labels` block — a record of `route:*` name → override spec. */
export const labelsConfigSchema = z
  .record(z.string().min(1), labelSpecSchema)
  .describe(
    "Generic label-override map. Keys are routing label names (e.g. " +
      "'route:fable'); values patch named roles with a {model, variant} set " +
      "and an optional fallback."
  );

/** The run-wide policy block — the v1 top-level knobs, grouped under `run`. */
export const runConfigSchema = z.object({
  intraWaveConcurrency: z
    .enum(["parallel", "sequential"])
    .optional()
    .default("parallel")
    .describe(
      "Run-wide policy: how to process the independent slices within one wave. " +
        "'parallel' (default) or 'sequential'. Lifted from the v1 top-level key."
    ),
  continuationBudget: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(2)
    .describe(
      "How many times the orchestrator may re-spawn the implementer in the " +
        "same worktree after an 'incomplete' envelope. 0 disables continuation. " +
        "Defaults to 2. Lifted from the v1 top-level key."
    ),
});

/**
 * Schema for a v2 `.orchestrate/routing.json`. Carries an explicit
 * `version: 2` discriminator, the per-tier `tiers` block, the generic `labels`
 * override map, and the run-policy `run` block.
 */
export const routingConfigSchemaV2 = z.object({
  version: z
    .literal(2)
    .describe("Schema version discriminator. Always 2 for the v2 shape."),
  tiers: z
    .object({
      trivial: tierRoutingSchemaV2,
      standard: tierRoutingSchemaV2,
      complex: tierRoutingSchemaV2,
    })
    .describe("Per-complexity-tier routing. All three tiers required."),
  labels: labelsConfigSchema
    .optional()
    .default({})
    .describe("Label-override map; empty by default."),
  run: runConfigSchema
    .optional()
    .default({})
    .describe("Run-wide policy block; knob defaults apply when omitted."),
});

// ─── v2 TS types ──────────────────────────────────────────────────────────────

export type RoleConfigV2 = z.infer<typeof roleConfigSchemaV2>;
export type TierRoutingV2 = z.infer<typeof tierRoutingSchemaV2>;
export type LabelFallback = z.infer<typeof labelFallbackSchema>;
export type LabelSpec = z.infer<typeof labelSpecSchema>;
export type LabelsConfig = z.infer<typeof labelsConfigSchema>;
export type RunConfig = z.infer<typeof runConfigSchema>;
export type RoutingConfigV2 = z.infer<typeof routingConfigSchemaV2>;

// ─── v1 → v2 upgrade (explicit, field-by-field) ───────────────────────────────

/** Result of an in-memory v1→v2 upgrade: the config plus any deprecation notes. */
export interface UpgradeResult {
  config: RoutingConfigV2;
  warnings: string[];
}

/** Maps one v1 per-role block (`effort`) to a v2 one (`variant`). */
function upgradeRole(role: { model: string; effort: RoleVariant }): RoleConfigV2 {
  return { model: role.model, variant: role.effort };
}

/** Maps one v1 tier block to a v2 tier block, role by role. */
function upgradeTier(tier: TierRouting): TierRoutingV2 {
  return {
    investigator: tier.investigator ? upgradeRole(tier.investigator) : null,
    implementer: upgradeRole(tier.implementer),
    reviewer: upgradeRole(tier.reviewer),
    "conflict-resolver": upgradeRole(tier["conflict-resolver"]),
  };
}

/**
 * Upgrades a parsed-and-validated v1 routing config to the v2 shape in memory,
 * field by field. Pure. Maps each tier's `effort` → `variant`, lifts the
 * top-level `intraWaveConcurrency`/`continuationBudget` into the `run` block
 * VERBATIM (no re-defaulting — the v1 schema already applied its defaults), sets
 * `version: 2`, and seeds an empty `labels` map. Returns a single deprecation
 * warning alongside the upgraded config.
 *
 * This is the field-by-field mapper that a naive re-parse under
 * {@link routingConfigSchemaV2} must NOT replace: zod strips unknown keys, so
 * re-parsing the v1 top-level run knobs under v2 would drop them silently.
 */
export function upgradeV1ToV2(v1: RoutingConfig): UpgradeResult {
  const config: RoutingConfigV2 = {
    version: 2,
    tiers: {
      trivial: upgradeTier(v1.trivial),
      standard: upgradeTier(v1.standard),
      complex: upgradeTier(v1.complex),
    },
    labels: {},
    run: {
      intraWaveConcurrency: v1.intraWaveConcurrency,
      continuationBudget: v1.continuationBudget,
    },
  };
  return {
    config,
    warnings: [
      "routing.json uses the deprecated v1 schema (no `version` field). It was " +
        "upgraded to v2 in memory: per-role `effort` → `variant`, and the " +
        "top-level `intraWaveConcurrency`/`continuationBudget` keys moved under " +
        "a `run` block. Re-bootstrap or migrate the file to silence this warning.",
    ],
  };
}

// ─── Version-dispatch loader ──────────────────────────────────────────────────

/** Outcome of loading + normalizing a routing config to the v2 shape. */
export type LoadRoutingResult =
  | { status: "ok"; config: RoutingConfigV2; warnings: string[] }
  | { status: "error"; errorMessage: string };

/** Maps a zod error's issues to a single `path: message; …` detail string. */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/**
 * Normalizes a parsed (JSON-decoded) routing object to the v2 shape, dispatching
 * on its `version` field. Pure — no I/O. A missing `version` is treated as v1:
 * the object is parsed with the EXPLICIT v1 schema and upgraded via
 * {@link upgradeV1ToV2}, attaching a deprecation warning. `version: 2` is parsed
 * directly with {@link routingConfigSchemaV2}. Any other `version` value, or a
 * shape mismatch, is a structured error — never a throw.
 */
export function loadRoutingConfig(parsed: unknown): LoadRoutingResult {
  const version =
    parsed && typeof parsed === "object" && "version" in parsed
      ? (parsed as { version: unknown }).version
      : undefined;

  if (version === undefined) {
    // v1: parse with the explicit v1 schema, then upgrade in memory.
    const v1 = routingConfigSchemaV1.safeParse(parsed);
    if (!v1.success) {
      return {
        status: "error",
        errorMessage: `routing.json does not match the v1 schema: ${formatIssues(
          v1.error
        )}`,
      };
    }
    const upgraded = upgradeV1ToV2(v1.data);
    return {
      status: "ok",
      config: upgraded.config,
      warnings: upgraded.warnings,
    };
  }

  if (version === 2) {
    const v2 = routingConfigSchemaV2.safeParse(parsed);
    if (!v2.success) {
      return {
        status: "error",
        errorMessage: `routing.json does not match the v2 schema: ${formatIssues(
          v2.error
        )}`,
      };
    }
    return { status: "ok", config: v2.data, warnings: [] };
  }

  return {
    status: "error",
    errorMessage: `routing.json has an unsupported \`version\`: ${JSON.stringify(
      version
    )}. Supported versions: 1 (no \`version\` field) and 2.`,
  };
}

// ─── v2 tool input/output schemas ─────────────────────────────────────────────

/**
 * Input schema for the v2 `resolve_routing` tool. Adds optional `labels` —
 * the slice issue's GitHub labels, passed verbatim by the orchestrator.
 * Only labels with a `route:` prefix (or any label present in the `labels`
 * config block) are forwarded to `applyLabels`; the rest are silently ignored.
 */
export const resolveRoutingV2InputSchema = z.object({
  tier: z
    .enum(COMPLEXITY_TIERS)
    .describe(
      "The complexity tier the orchestrator assessed the issue into. " +
        "'trivial' = a small, localized change; 'standard' = an ordinary " +
        "feature or fix; 'complex' = broad, cross-cutting, or high-risk work."
    ),
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the project root holding .orchestrate/routing.json. Defaults " +
        "to the MCP server process's current working directory — callers " +
        "should pass it explicitly."
    ),
  labels: z
    .array(z.string())
    .optional()
    .describe(
      "The slice issue's GitHub labels, passed verbatim. Only labels present " +
        "in routing.json's `labels` block or matching the `route:` prefix are " +
        "applied as overrides; all others are ignored."
    ),
});

/** One resolved label fallback as returned in the v2 output. */
export const resolvedFallbackOutputSchema = z.object({
  role: z
    .enum(ROUTING_ROLES)
    .describe("The role this fallback applies to."),
  label: z
    .string()
    .describe("The label name that contributed this fallback."),
  fallback: labelFallbackSchema.describe(
    "The model-fallback spec to use when the primary model fails."
  ),
});

/**
 * Output schema for the v2 `resolve_routing` tool. Uses `variant` (not
 * `effort`); carries per-label fallbacks and structured label warnings.
 */
export const resolveRoutingV2OutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe(
      "Outcome discriminant. 'ok' = the tier resolved; 'error' = routing.json " +
        "is missing, malformed, or has a conflicting label override."
    ),
  tier: z
    .enum(COMPLEXITY_TIERS)
    .optional()
    .describe("The tier that was resolved. Present when status='ok'."),
  routing: tierRoutingSchemaV2
    .optional()
    .describe(
      "The resolved per-role routing for the tier (v2: uses `variant`, not " +
        "`effort`). `investigator` is null when this tier skips the " +
        "investigation pass. Present when status='ok'."
    ),
  continuationBudget: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "The resolved continuation budget for this run — how many implementer " +
        "re-spawns are allowed after an 'incomplete' envelope. Present when " +
        "status='ok'."
    ),
  fallbacks: z
    .array(resolvedFallbackOutputSchema)
    .optional()
    .describe(
      "Resolved label fallback specs for the tier. Each entry names the role, " +
        "the label that contributed it, and the fallback model spec. Present " +
        "when status='ok'; empty array when no labels carry a fallback."
    ),
  warnings: z
    .array(z.string())
    .optional()
    .describe(
      "Structured warnings — v1 deprecation notices and unconfigured `route:*` " +
        "label warnings. Present when status='ok'; empty array when clean."
    ),
  errorCode: z
    .enum(["CONFIG_NOT_FOUND", "CONFIG_INVALID", "LABEL_CONFLICT"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'. " +
        "'CONFIG_NOT_FOUND' = no .orchestrate/routing.json; 'CONFIG_INVALID' " +
        "= it is malformed JSON or does not match the expected shape; " +
        "'LABEL_CONFLICT' = two applied labels both patch the same role."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe(
      "Cleaned, human-readable failure description. Present when status='error'."
    ),
});

// ─── v2 TS types ──────────────────────────────────────────────────────────────

export type ResolveRoutingV2Input = z.infer<typeof resolveRoutingV2InputSchema>;
export type ResolveRoutingV2Output = z.infer<typeof resolveRoutingV2OutputSchema>;

// ─── v2 resolver (I/O + orchestration) ───────────────────────────────────────

/**
 * Loads `.orchestrate/routing.json` via the version-dispatch loader, resolves
 * the routing for `input.tier`, and applies any configured label overrides.
 * Never throws — every failure mode is a structured result.
 *
 * Label filtering: only labels present in routing.json's `labels` block OR
 * matching the `route:` prefix are forwarded to `applyLabels`. All others are
 * silently dropped so ordinary GitHub labels (`bug`, `enhancement`, etc.) do
 * not produce spurious warnings.
 */
export function resolveRoutingV2FromConfig(
  input: ResolveRoutingV2Input
): ResolveRoutingV2Output {
  const cwd = input.repoPath ?? process.cwd();
  const configPath = path.join(cwd, ".orchestrate", "routing.json");

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch {
    return {
      status: "error",
      errorCode: "CONFIG_NOT_FOUND",
      errorMessage:
        `No .orchestrate/routing.json found in ${cwd}. Copy the orchestrate ` +
        `plugin's templates/routing.json to .orchestrate/routing.json.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: "error",
      errorCode: "CONFIG_INVALID",
      errorMessage: `.orchestrate/routing.json is not valid JSON: ${firstLine(
        err instanceof Error ? err.message : String(err)
      )}`,
    };
  }

  const loadResult = loadRoutingConfig(parsed);
  if (loadResult.status === "error") {
    return {
      status: "error",
      errorCode: "CONFIG_INVALID",
      errorMessage: loadResult.errorMessage,
    };
  }

  const { config, warnings: loaderWarnings } = loadResult;
  const tierRouting = config.tiers[input.tier];
  const labelsConfig = config.labels ?? {};

  // Filter the raw label list to those that are configured OR have the route:
  // prefix. This prevents ordinary GitHub labels from producing spurious
  // "unconfigured" warnings while still catching route:* typos.
  const relevantLabels = (input.labels ?? []).filter(
    (name) => name.startsWith("route:") || name in labelsConfig
  );

  const labelResult = applyLabels(tierRouting, relevantLabels, labelsConfig);
  if (labelResult.error) {
    return {
      status: "error",
      errorCode: "LABEL_CONFLICT",
      errorMessage: labelResult.error,
    };
  }

  return {
    status: "ok",
    tier: input.tier,
    routing: labelResult.routing,
    continuationBudget: config.run.continuationBudget,
    fallbacks: labelResult.fallbacks,
    warnings: [...loaderWarnings, ...labelResult.warnings],
  };
}

// ─── Label-override merge (pure) ──────────────────────────────────────────────

/** The resolved fallback for a tier's routing after label application. */
export interface ResolvedFallback {
  role: RoutingRole;
  label: string;
  fallback: LabelFallback;
}

/** Structured result of applying label overrides to one tier's routing. */
export interface ApplyLabelsResult {
  routing: TierRoutingV2;
  warnings: string[];
  fallbacks: ResolvedFallback[];
  error?: string;
}

/**
 * Applies the configured `route:*` label overrides named in `labelNames` to a
 * tier's routing. PURE — returns structured data, never throws.
 *
 * Semantics (ADR-0015 guardrails):
 * - An override patches ONLY the roles it names; every other role is untouched.
 * - Two configured labels patching the SAME role is a loud, structured error
 *   (`error` set) — there is no precedence rule. The original routing is
 *   returned unchanged in that case.
 * - A `route:*` label present on the slice but ABSENT from the config produces a
 *   structured warning (never a silent no-op).
 * - Each applied label's optional `fallback` spec is resolved and returned in
 *   `fallbacks`, tagged with the role and label it came from.
 */
export function applyLabels(
  tierRouting: TierRoutingV2,
  labelNames: string[],
  labelsConfig: LabelsConfig
): ApplyLabelsResult {
  const warnings: string[] = [];
  const fallbacks: ResolvedFallback[] = [];
  // Clone so the input is never mutated.
  const routing: TierRoutingV2 = {
    investigator: tierRouting.investigator
      ? { ...tierRouting.investigator }
      : null,
    implementer: { ...tierRouting.implementer },
    reviewer: { ...tierRouting.reviewer },
    "conflict-resolver": { ...tierRouting["conflict-resolver"] },
  };

  // Track which label first patched each role to detect same-role conflicts.
  const patchedBy = new Map<RoutingRole, string>();

  for (const labelName of labelNames) {
    const spec = labelsConfig[labelName];
    if (!spec) {
      warnings.push(
        `Label '${labelName}' is present on the slice but absent from ` +
          `routing.json's \`labels\` block — it had no effect. Add it to the ` +
          `config or remove the label.`
      );
      continue;
    }

    for (const role of spec.roles) {
      const prior = patchedBy.get(role);
      if (prior !== undefined) {
        return {
          routing: tierRouting,
          warnings,
          fallbacks: [],
          error:
            `Conflicting label overrides: both '${prior}' and '${labelName}' ` +
            `patch the role '${role}'. There is no precedence rule — resolve ` +
            `the conflict in routing.json (each role may be patched by at most ` +
            `one applied label).`,
        };
      }
      patchedBy.set(role, labelName);
      routing[role] = { ...spec.set };
      if (spec.fallback) {
        fallbacks.push({ role, label: labelName, fallback: spec.fallback });
      }
    }
  }

  return { routing, warnings, fallbacks };
}
