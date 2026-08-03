import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ─── The parity family ────────────────────────────────────────────────────────
//
// Every subagent role in this plugin ships as a `-standard`/`-deep` pair. The
// two files of a pair are a "parity family" in this repo's own sense (see
// .claude/rules/compliance-maintenance.md): their shared prose must stay
// byte-identical, so a fix applied to one variant can never silently miss the
// other.
//
// ADR-0009 fixes what a pair is ALLOWED to differ in: "the only deliberate
// difference between variants is model, effort, `maxTurns`, and the
// depth-of-pass instructions". That sentence is the spec this test encodes.
//
// The comparison is therefore DENY-list shaped, not allow-list shaped: every
// `## ` section is compared unless it is named below as deliberately
// variant-specific. An allowlist would silently exempt any section nobody
// remembered to add to it — `## Scope-boundary guard`, shared byte-identically
// by both investigator variants, was exactly that miss.
//
//   - `## What you receive` is EXCLUDED. It carries depth-of-pass content and
//     diverges by design — `implementer-deep` and `reviewer-deep` each add an
//     investigator-brief bullet their standard variants deliberately lack.
//   - `## Deep effort` is EXCLUDED. It exists only in the deep variant by
//     construction.
//
// Both exclusions are deliberate. A future reader who wonders why they are
// exempt should read ADR-0009:58-60 before removing them.

// Sections a pair is allowed to differ in, or to carry in one variant only.
const VARIANT_SPECIFIC_SECTIONS = new Set([
  "## What you receive",
  "## Deep effort",
]);

// Sections every pair must CARRY in both variants. Presence is asserted
// separately from equality: a comparison over "sections found in both" is
// vacuously green when a section is missing from both.
const PARITY_SECTIONS = [
  "## What you do",
  "## Boundaries",
  "## Advisor policy",
  "## What you return",
];

// Fields whose values MUST differ between the two variants of a pair. This is
// also the mechanical check that each variant pins its own effort level, which
// cannot be set per spawn.
const DIVERGENT_FRONTMATTER = ["model", "effort", "maxTurns"];

// Fields whose values MUST be byte-identical between the two variants.
const IDENTICAL_FRONTMATTER = ["tools"];

// List-valued fields that must resolve to the same entries in both variants.
// `skills:` is here because a variant that preloads a different procedure —
// or misspells the one it means to preload — reads as configured and behaves
// as if it were not: Claude Code skips an unresolvable skill silently.
const IDENTICAL_FRONTMATTER_LISTS = ["skills"];

// test/ → orchestrate-mcp/ → orchestrate/ → agents/
const agentsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "agents"
);

/** Split a definition into its YAML frontmatter block and its markdown body. */
function splitDefinition(raw: string): { frontmatter: string; body: string } {
  // Strip a trailing CR before comparing: a checkout under `core.autocrlf=true`
  // materialises these files with CRLF endings even though the blobs are LF, and
  // an exact `=== "---"` there makes every definition unparseable. That failure is
  // not loud where it matters — the sibling matcher-consistency suite would build
  // an EMPTY shipped-name set and then pass vacuously, which is the one outcome a
  // guard must never have.
  const lines = raw.split("\n").map((line) => line.replace(/\r$/, ""));
  if (lines[0] !== "---") {
    throw new Error("definition does not open with a '---' frontmatter fence");
  }
  const closing = lines.indexOf("---", 1);
  if (closing === -1) {
    throw new Error("definition has no closing '---' frontmatter fence");
  }
  return {
    frontmatter: lines.slice(1, closing).join("\n"),
    body: lines.slice(closing + 1).join("\n"),
  };
}

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
 * Read one list-valued frontmatter field, accepting either YAML form — the
 * block list (`skills:` then `  - entry` lines) both slice-executor variants
 * use, or an inline comma-separated scalar. Returns undefined when the key is
 * absent, so "neither variant declares it" stays distinguishable from "both
 * declare an empty list".
 */
function frontmatterList(
  frontmatter: string,
  key: string
): string[] | undefined {
  const lines = frontmatter.split("\n");
  const index = lines.findIndex((line) =>
    new RegExp(`^${key}:([ \\t]|$)`).test(line)
  );
  if (index === -1) return undefined;

  const inline = lines[index].slice(key.length + 1).trim();
  if (inline !== "") {
    return inline
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "");
  }

  const entries: string[] = [];
  for (const line of lines.slice(index + 1)) {
    const match = line.match(/^[ \t]+-[ \t]+(.*)$/);
    if (!match) break;
    entries.push(match[1].trim());
  }
  return entries;
}

/**
 * Map each `## ` heading in a body to its content, where a section runs from
 * its heading to the NEXT `## ` heading — not to the next allowlisted heading.
 * Slicing to the next allowlisted heading would make `## Advisor policy` in
 * every deep variant swallow the deep-only `## Deep effort` section that
 * follows it, and every existing pair would fail.
 */
function sectionsOf(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (heading !== null) sections.set(heading, buffer.join("\n").trim());
  };

  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) {
      flush();
      heading = line.trim();
      buffer = [];
    } else if (heading !== null) {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

/** Discover `<role>-standard.md` / `<role>-deep.md` pairs by reading the directory. */
function discoverPairs(): string[] {
  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  return files
    .filter((f) => f.endsWith("-standard.md"))
    .map((f) => f.slice(0, -"-standard.md".length))
    .filter((role) => files.includes(`${role}-deep.md`))
    .sort();
}

const pairs = discoverPairs();

describe("agent variant parity", () => {
  it("parity — every role in agents/ ships both a -standard and a -deep variant", () => {
    // Only variant-suffixed files participate. A future single-variant
    // definition is a different question from pair divergence, and failing
    // here would report it under a message about parity.
    const variantFiles = fs
      .readdirSync(agentsDir)
      .filter((f) => /-(standard|deep)\.md$/.test(f));
    const roles = new Set(
      variantFiles.map((f) => f.replace(/-(standard|deep)\.md$/, ""))
    );
    expect(pairs.length).toBeGreaterThan(0);
    // No role may ship only one half of a pair.
    expect(pairs.slice().sort()).toEqual([...roles].sort());
  });

  it("parity — the slice-executor role is present as a discovered pair", () => {
    // The pair discovery above is generic; this pins the role this suite was
    // written for so a rename cannot quietly drop it from the parity family.
    expect(pairs).toContain("slice-executor");
  });

  for (const role of pairs) {
    describe(role, () => {
      const standard = splitDefinition(
        fs.readFileSync(path.join(agentsDir, `${role}-standard.md`), "utf8")
      );
      const deep = splitDefinition(
        fs.readFileSync(path.join(agentsDir, `${role}-deep.md`), "utf8")
      );
      const standardSections = sectionsOf(standard.body);
      const deepSections = sectionsOf(deep.body);

      it(`parity — ${role}: every shared section is present in both variants`, () => {
        for (const heading of PARITY_SECTIONS) {
          // Assert presence explicitly: a comparison over "sections found in
          // both" is vacuously green when a section is missing from both.
          expect(
            standardSections.has(heading),
            `${role}-standard.md is missing the "${heading}" section`
          ).toBe(true);
          expect(
            deepSections.has(heading),
            `${role}-deep.md is missing the "${heading}" section`
          ).toBe(true);
        }
      });

      it(`parity — ${role}: both variants carry the same set of shared sections`, () => {
        // A section that exists in one variant and not the other is the same
        // silent miss as one whose text drifted — the fix applied to one half
        // of the pair never reached the other.
        const shared = (sections: Map<string, string>) =>
          [...sections.keys()]
            .filter((heading) => !VARIANT_SPECIFIC_SECTIONS.has(heading))
            .sort();
        expect(
          shared(deepSections),
          `the shared section set differs between the ${role} variants`
        ).toEqual(shared(standardSections));
      });

      it(`parity — ${role}: shared sections are byte-identical across the pair`, () => {
        // Every section present in both variants is compared unless it is
        // named variant-specific — no section is exempt merely by being
        // absent from a hand-maintained allowlist.
        const compared = [...standardSections.keys()].filter(
          (heading) =>
            !VARIANT_SPECIFIC_SECTIONS.has(heading) && deepSections.has(heading)
        );
        expect(
          compared.length,
          `no comparable sections found for ${role}`
        ).toBeGreaterThan(0);
        for (const heading of compared) {
          expect(
            deepSections.get(heading),
            `"${heading}" diverges between ${role}-standard.md and ${role}-deep.md`
          ).toBe(standardSections.get(heading));
        }
      });

      it(`parity — ${role}: the tools list is byte-identical across the pair`, () => {
        for (const key of IDENTICAL_FRONTMATTER) {
          const standardValue = frontmatterField(standard.frontmatter, key);
          const deepValue = frontmatterField(deep.frontmatter, key);
          expect(standardValue, `${role}-standard.md has no "${key}:"`).toBeDefined();
          expect(deepValue, `${role}-deep.md has no "${key}:"`).toBeDefined();
          expect(
            deepValue,
            `"${key}:" diverges between the ${role} variants`
          ).toBe(standardValue);
        }
      });

      it(`parity — ${role}: preloaded skills are identical across the pair`, () => {
        for (const key of IDENTICAL_FRONTMATTER_LISTS) {
          const standardValue = frontmatterList(standard.frontmatter, key);
          const deepValue = frontmatterList(deep.frontmatter, key);
          // Neither declaring the field is a legitimate state — the four
          // worker roles preload nothing. One declaring it and the other not
          // is not, and toEqual against undefined reports that directly.
          expect(
            deepValue,
            `"${key}:" diverges between the ${role} variants`
          ).toEqual(standardValue);
        }
      });

      it(`parity — ${role}: model, effort and maxTurns are pinned and differ by variant`, () => {
        // The routing variants exist to carry different depth-of-pass settings,
        // and `effort` cannot be set per spawn — it must be pinned in each
        // definition. Equal values would mean the two variants are the same
        // agent under two names.
        for (const key of DIVERGENT_FRONTMATTER) {
          const standardValue = frontmatterField(standard.frontmatter, key);
          const deepValue = frontmatterField(deep.frontmatter, key);
          expect(standardValue, `${role}-standard.md has no "${key}:"`).toBeDefined();
          expect(deepValue, `${role}-deep.md has no "${key}:"`).toBeDefined();
          expect(
            deepValue,
            `"${key}:" is identical across the ${role} variants; it must differ`
          ).not.toBe(standardValue);
        }
      });

      it(`parity — ${role}: neither variant uses frontmatter that plugin subagents ignore`, () => {
        // `permissionMode`, `mcpServers` and `hooks` are silently ignored when a
        // subagent is loaded from a plugin, so a definition that sets one reads
        // as configured while behaving as if it were not.
        for (const [variant, parsed] of [
          ["standard", standard],
          ["deep", deep],
        ] as const) {
          for (const key of ["permissionMode", "mcpServers", "hooks"]) {
            expect(
              frontmatterField(parsed.frontmatter, key),
              `${role}-${variant}.md sets "${key}:", which plugin subagents ignore`
            ).toBeUndefined();
          }
        }
      });
    });
  }
});
