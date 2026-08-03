import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ─── Hook-matcher consistency ─────────────────────────────────────────────────
//
// A hook matcher that names an agent type which no shipped definition provides
// reads as configured and behaves as if it were not: Claude Code simply never
// matches it, silently, forever. That is the same failure class the parity
// suite guards for `skills:` — a misspelling that looks like configuration.
//
// The invariant this file encodes:
//
//   For every hook event whose matcher filters AGENT TYPE, every agent name in
//   that matcher must correspond to a shipped definition under
//   `plugins/orchestrate/agents/`, compared against the PLUGIN-SCOPED
//   identifier `orchestrate:<frontmatter-name>` — never the bare frontmatter
//   name.
//
// Two facts pin the shape, both from the vendor hook reference mirror
// (`docs/claude-code/hooks/claude-hook-reference-doc.md`):
//
//   - Only `SubagentStart` and `SubagentStop` match on agent type. Every other
//     matcher-bearing event — `PreToolUse` included, which is what the read
//     guard adds — matches on TOOL NAME. So this invariant is currently
//     VACUOUSLY GREEN over the shipped file, and would stay decorative if it
//     were only ever run against that file.
//   - For a subagent shipped by a plugin, the agent identity is the
//     plugin-scoped identifier (`my-plugin:reviewer`), not the bare frontmatter
//     name.
//
// The vacuity is designed away the same way `agent-variant-parity.test.ts`
// handles its own ("a comparison over sections found in both is vacuously
// green when a section is missing from both"): the checker is a pure function
// exercised against RED fixtures first, and only then against the real file.
// The bare-name fixture is the load-bearing one — without it this suite does
// not encode the plugin-scoping half of the invariant at all.
//
// The checker lives here rather than in `src/hooks/read-guard.ts`: it has
// nothing to do with the read decision and would ship as dead bytes inside
// `dist/read-guard.js`.

/** Hook events whose `matcher` filters agent type rather than tool name. */
const AGENT_TYPE_MATCHER_EVENTS = new Set(["SubagentStart", "SubagentStop"]);

/** The plugin name every shipped subagent identity is scoped by. */
const PLUGIN_NAME = "orchestrate";

// test/ → orchestrate-mcp/ → orchestrate/
const pluginDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const agentsDir = path.join(pluginDir, "agents");
const hooksJsonPath = path.join(pluginDir, "hooks", "hooks.json");

/**
 * Read one top-level scalar frontmatter field. Returns undefined when the key
 * is absent, so a missing field is reported as such rather than as a mismatch.
 */
function frontmatterField(
  frontmatter: string,
  key: string
): string | undefined {
  for (const line of frontmatter.split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/);
    if (match && match[1] === key) return match[2].trim();
  }
  return undefined;
}

/**
 * Discover every shipped subagent's identity by READING the directory — never
 * a hardcoded list, which would go stale exactly when a definition is added or
 * renamed, the moment this check matters most. The identity is the definition's
 * `name:` frontmatter field, not its filename.
 */
function shippedAgentNames(): string[] {
  const names: string[] = [];
  for (const file of fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"))) {
    const raw = fs.readFileSync(path.join(agentsDir, file), "utf8");
    // Strip a trailing CR: under `core.autocrlf=true` these files are checked out
    // with CRLF endings even though the blobs are LF. Without this the `continue`
    // below skips EVERY definition, and the checks that consume this set then
    // compare against an empty one — passing while asserting nothing, which is
    // exactly the silently-never-fires guard this suite exists to prevent.
    const lines = raw.split("\n").map((line) => line.replace(/\r$/, ""));
    if (lines[0] !== "---") continue;
    const closing = lines.indexOf("---", 1);
    if (closing === -1) continue;
    const name = frontmatterField(lines.slice(1, closing).join("\n"), "name");
    if (name !== undefined && name !== "") names.push(name);
  }
  if (names.length === 0) {
    // Fail loudly rather than let every consumer assert against an empty set.
    throw new Error(
      `no agent definitions parsed from ${agentsDir} — the shipped-name set is ` +
        "empty, so any consistency check over it would pass vacuously"
    );
  }
  return names.sort();
}

/**
 * A matcher entry is a PLAIN NAME when, after its optional `^`/`$` anchors are
 * stripped, nothing regex-significant remains. Anything else — `.*`, a
 * character class, an alternation group — is a deliberate pattern rather than
 * a name, and is SKIPPED rather than reported: a checker that failed on `.*`
 * would produce a false failure on the two matchers this plugin already ships.
 */
function plainNameOf(entry: string): string | null {
  const stripped = entry.trim().replace(/^\^/, "").replace(/\$$/, "").trim();
  if (stripped === "") return null;
  return /^[A-Za-z0-9_:-]+$/.test(stripped) ? stripped : null;
}

/**
 * Every agent name a matcher names. Alternation accepts BOTH `|` and `,` —
 * splitting on only one separator would silently skip half the entries of a
 * comma-separated matcher, which is a false GREEN, the direction that matters.
 */
function matcherNames(matcher: string): string[] {
  return matcher
    .split(/[|,]/)
    .map(plainNameOf)
    .filter((entry): entry is string => entry !== null);
}

/**
 * Returns one violation string per agent name that a matcher names and no
 * shipped definition provides. An empty array means the file is consistent.
 */
export function validateAgentMatchers(
  hooksJson: unknown,
  shippedScopedNames: Set<string>
): string[] {
  const violations: string[] = [];
  if (typeof hooksJson !== "object" || hooksJson === null) return violations;
  const hooks = (hooksJson as Record<string, unknown>).hooks;
  if (typeof hooks !== "object" || hooks === null) return violations;

  for (const [event, blocks] of Object.entries(
    hooks as Record<string, unknown>
  )) {
    if (!AGENT_TYPE_MATCHER_EVENTS.has(event)) continue;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      const matcher =
        typeof block === "object" && block !== null
          ? (block as Record<string, unknown>).matcher
          : undefined;
      if (typeof matcher !== "string") continue;
      for (const name of matcherNames(matcher)) {
        if (!shippedScopedNames.has(name)) {
          violations.push(
            `${event} matcher names "${name}", which no shipped agent definition provides`
          );
        }
      }
    }
  }
  return violations;
}

const shippedNames = shippedAgentNames();
// The identity a hook event carries for a PLUGIN subagent is the scoped form,
// never the bare frontmatter name. Building the set bare — the obvious reading
// — produces a checker that passes every fixture except the one that matters.
const shippedScopedNames = new Set(
  shippedNames.map((name) => `${PLUGIN_NAME}:${name}`)
);

/** A `hooks.json` shape carrying one agent-type matcher. */
function hooksJsonWithSubagentMatcher(matcher: string): unknown {
  return {
    hooks: {
      SubagentStart: [
        {
          matcher,
          hooks: [{ type: "command", command: "node noop.js", timeout: 5 }],
        },
      ],
    },
  };
}

describe("shippedAgentNames", () => {
  it("discovers the plugin's agent definitions from the directory", () => {
    // Guards the checker's own input: an empty set would make every fixture
    // below "violate", and the real file trivially consistent-looking only
    // because nothing was compared.
    expect(shippedNames.length).toBeGreaterThan(0);
    expect(shippedNames).toContain("reviewer-deep");
    expect(shippedNames).toContain("slice-executor-standard");
  });
});

describe("validateAgentMatchers", () => {
  it("reports a matcher naming an agent with no shipped definition", () => {
    expect(
      validateAgentMatchers(
        hooksJsonWithSubagentMatcher(`${PLUGIN_NAME}:no-such-agent`),
        shippedScopedNames
      )
    ).toHaveLength(1);
  });

  it("reports a BARE agent name even when a definition carries that frontmatter name", () => {
    // The load-bearing case. `reviewer-deep` IS a shipped definition's `name:`,
    // but the identity a hook event carries for a plugin subagent is
    // `orchestrate:reviewer-deep`. A matcher spelled bare therefore matches
    // nothing at runtime while looking entirely correct in review.
    expect(shippedNames).toContain("reviewer-deep");
    const violations = validateAgentMatchers(
      hooksJsonWithSubagentMatcher("reviewer-deep"),
      shippedScopedNames
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("reviewer-deep");
  });

  it("accepts a correctly scoped name, anchored or bare of anchors", () => {
    for (const matcher of [
      `${PLUGIN_NAME}:reviewer-deep`,
      `^${PLUGIN_NAME}:reviewer-deep$`,
    ]) {
      expect(
        validateAgentMatchers(
          hooksJsonWithSubagentMatcher(matcher),
          shippedScopedNames
        ),
        `"${matcher}" is a valid identity`
      ).toEqual([]);
    }
  });

  it("splits alternation on both `|` and `,`", () => {
    // Splitting on only one separator would skip the other's entries entirely
    // — a false green, the direction that matters.
    for (const matcher of [
      `${PLUGIN_NAME}:reviewer-deep|nope-a`,
      `${PLUGIN_NAME}:reviewer-deep,nope-b`,
    ]) {
      expect(
        validateAgentMatchers(
          hooksJsonWithSubagentMatcher(matcher),
          shippedScopedNames
        ),
        `"${matcher}" hides one bad entry`
      ).toHaveLength(1);
    }
  });

  it("skips a non-trivial regex rather than reporting it as a bad name", () => {
    for (const matcher of [".*", `^${PLUGIN_NAME}:(reviewer|implementer)-.*$`]) {
      expect(
        validateAgentMatchers(
          hooksJsonWithSubagentMatcher(matcher),
          shippedScopedNames
        ),
        `"${matcher}" is a pattern, not a name`
      ).toEqual([]);
    }
  });

  it("ignores events whose matcher filters tool name, not agent type", () => {
    // `PreToolUse` matches on tool name, so `Read|Bash` is not a claim about
    // any agent and must never be reported.
    expect(
      validateAgentMatchers(
        { hooks: { PreToolUse: [{ matcher: "Read|Bash", hooks: [] }] } },
        shippedScopedNames
      )
    ).toEqual([]);
  });

  it("never throws on a malformed or empty configuration", () => {
    for (const value of [null, undefined, {}, { hooks: null }, 42, "x"]) {
      expect(() => validateAgentMatchers(value, shippedScopedNames)).not.toThrow();
      expect(validateAgentMatchers(value, shippedScopedNames)).toEqual([]);
    }
  });
});

describe("the shipped hooks.json", () => {
  const shipped = JSON.parse(fs.readFileSync(hooksJsonPath, "utf8"));

  it("names no agent type without a shipped definition", () => {
    expect(validateAgentMatchers(shipped, shippedScopedNames)).toEqual([]);
  });

  it("registers the read guard as a PreToolUse hook", () => {
    const blocks = shipped.hooks?.PreToolUse;
    expect(Array.isArray(blocks)).toBe(true);
    const entries = blocks.flatMap((b: { hooks?: unknown[] }) => b.hooks ?? []);
    expect(
      entries.some((e: { command?: string }) =>
        (e.command ?? "").includes("read-guard.js")
      )
    ).toBe(true);
  });

  it("scopes the read guard to Read and Bash, not to every tool", () => {
    // AC6 at the wiring level. `.*` would put the handler in front of every
    // call — including the `recover_slice_progress` MCP tool the deny reason
    // points at as the structured alternative.
    const block = shipped.hooks.PreToolUse.find(
      (b: { hooks?: { command?: string }[] }) =>
        (b.hooks ?? []).some((e) => (e.command ?? "").includes("read-guard.js"))
    );
    expect(block.matcher).toBe("Read|Bash");
  });

  it("does not run the read guard asynchronously", () => {
    // An async PreToolUse hook cannot block. Copying the watchdog's
    // `"async": true` would silently defeat the deny while every unit test
    // above stayed green — the defect no module test can see.
    const entries = shipped.hooks.PreToolUse.flatMap(
      (b: { hooks?: { command?: string; async?: boolean }[] }) => b.hooks ?? []
    ).filter((e: { command?: string }) =>
      (e.command ?? "").includes("read-guard.js")
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.async).toBeUndefined();
    }
  });
});
