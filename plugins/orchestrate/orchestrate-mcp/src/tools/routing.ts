import * as path from "path";
import * as fs from "fs";
import { z } from "zod";

// ─── Tiers, roles, efforts ────────────────────────────────────────────────────

/** Complexity tiers an issue is assessed into, low to high. */
export const COMPLEXITY_TIERS = ["trivial", "standard", "complex"] as const;
export type ComplexityTier = (typeof COMPLEXITY_TIERS)[number];

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
});

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
  };
}
