import * as path from "path";
import * as fs from "fs";
import { z } from "zod";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───
//
// `.orchestrate/handoff.json` configures the context-handoff feature: the
// context-watchdog hook's threshold and the successor-session launcher. Every
// field carries a `.default()`, so the file may be absent entirely, present but
// empty (`{}`), or partial — it always resolves to a complete config.

/** Context-watchdog tuning — when to raise the handoff flag. */
export const watchdogConfigSchema = z.object({
  thresholdPercent: z
    .number()
    .min(1)
    .max(100)
    .default(40)
    .describe(
      "Raise the handoff flag once estimated context usage reaches this " +
        "percentage of the context window. Default 40 — deliberately " +
        "conservative so the run has room to finish a slice and hand off."
    ),
  contextWindowTokens: z
    .number()
    .int()
    .positive()
    .default(200000)
    .describe(
      "Total context window the percentage is measured against. Default " +
        "200000 — raise to 1000000 for a 1M-context session."
    ),
});

/**
 * One terminal launcher entry. `argv[0]` is the executable; the remaining
 * tokens are its arguments. Any token may contain the `{claudeCommand}` or
 * `{repoPath}` placeholders, substituted when the launch command is built.
 */
export const terminalEntrySchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("Human-readable terminal id, surfaced in the launch result."),
  argv: z
    .array(z.string())
    .min(1)
    .describe(
      "The launch argv. argv[0] is the executable. Tokens may contain the " +
        "{claudeCommand} and {repoPath} placeholders."
    ),
});

/** Successor-session launcher config. */
export const successorConfigSchema = z.object({
  claudeArgs: z
    .array(z.string())
    .default(["--remote-control", "orchestrate-successor", "--permission-mode", "auto"])
    .describe(
      "Arguments passed to the `claude` CLI for the successor session. The " +
        "default starts an interactive session with Remote Control enabled " +
        "(name 'orchestrate-successor') in auto permission mode."
    ),
  resumePrompt: z
    .string()
    .default("/orchestrate")
    .describe(
      "The initial prompt for the successor session — appended after " +
        "claudeArgs as the final, positional argument so it is never " +
        "consumed as the Remote Control session name."
    ),
  terminals: z
    .array(terminalEntrySchema)
    .default([
      {
        name: "windows-terminal",
        argv: [
          "wt.exe",
          "new-tab",
          "--title",
          "orchestrate-successor",
          "wsl.exe",
          "--",
          "bash",
          "-lc",
          "{claudeCommand}",
        ],
      },
      {
        name: "warp",
        argv: ["warp-terminal", "--", "bash", "-lc", "{claudeCommand}"],
      },
    ])
    .describe(
      "Ordered fallback chain of terminals. The launcher tries each in turn " +
        "and stops at the first that spawns. The default targets a WSL2 " +
        "environment: Windows Terminal first, Warp second."
    ),
});

/** Schema for `.orchestrate/handoff.json` — both sections optional. */
export const handoffConfigSchema = z.object({
  watchdog: watchdogConfigSchema.default({}),
  successor: successorConfigSchema.default({}),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type WatchdogConfig = z.infer<typeof watchdogConfigSchema>;
export type TerminalEntry = z.infer<typeof terminalEntrySchema>;
export type SuccessorConfig = z.infer<typeof successorConfigSchema>;
export type HandoffConfig = z.infer<typeof handoffConfigSchema>;

// ─── Loader ───────────────────────────────────────────────────────────────────

/** Returns the first non-empty trimmed line of a (possibly multi-line) string. */
function firstLine(message: string): string {
  const line = message
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? message.trim();
}

/**
 * Loads `.orchestrate/handoff.json` from `repoPath` and resolves it to a
 * complete {@link HandoffConfig}. Never throws: a missing file resolves to
 * defaults silently; a malformed file resolves to defaults with a `warning`
 * the caller can surface.
 */
export function loadHandoffConfig(repoPath: string): {
  config: HandoffConfig;
  warning: string | null;
} {
  const configPath = path.join(repoPath, ".orchestrate", "handoff.json");
  const defaults = handoffConfigSchema.parse({});

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch {
    return { config: defaults, warning: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      config: defaults,
      warning:
        `.orchestrate/handoff.json is not valid JSON (${firstLine(
          err instanceof Error ? err.message : String(err)
        )}) — built-in defaults were used instead.`,
    };
  }

  const result = handoffConfigSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      config: defaults,
      warning:
        `.orchestrate/handoff.json does not match the expected shape ` +
        `(${detail}) — built-in defaults were used instead.`,
    };
  }

  return { config: result.data, warning: null };
}
