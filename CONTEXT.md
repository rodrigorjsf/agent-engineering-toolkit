# agent-engineering-toolkit

Multi-plugin marketplace where each distribution authors agent artifacts (skills, hooks, rules, subagents) for one specific agent platform. Plugins fall into two complementary roles per platform: an **initializer** that bootstraps platform-wide configuration for a project, and a **customizer** that creates and improves individual artifacts within that project.

## Language

### Distribution roles

**Initializer**:
A plugin that bootstraps the platform-wide configuration of a target project (one-shot setup of the rule/memory hierarchy).
_Avoid_: setup plugin, scaffolder

**Customizer**:
A plugin that creates and improves individual agent artifacts (skills, hooks, rules, subagents) inside a project that is already initialized.
_Avoid_: artifact builder, generator plugin

### Platforms and namespaces

**Claude Code distribution**:
The pair of plugins targeting the Claude Code platform — `agents-initializer` (initializer) + `agent-customizer` (customizer). Generated artifacts target `.claude/`.
_Avoid_: Claude flavor, Anthropic plugins

**Cursor distribution**:
The pair of plugins targeting Cursor — `cursor-initializer` (initializer) + `cursor-customizer` (customizer). Generated artifacts target `.cursor/`.
_Avoid_: Cursor flavor, IDE plugins

**Standalone distribution**:
The npx-installable skills under repo-root `skills/` that perform inline analysis without subagent delegation. Single distribution, no initializer/customizer split.
_Avoid_: CLI skills, plain skills

### Artifact vocabulary

**Artifact**:
One of four agent-platform configuration units — **Skill**, **Hook**, **Rule**, or **Subagent**.
_Avoid_: file, config, asset

**Skill** (Claude Code or Cursor sense):
A `SKILL.md`-rooted package with phases, references, and templates that teaches an agent how to perform a domain task.

**Hook**:
A platform-specific event handler that runs on lifecycle events. Claude Code and Cursor both have hooks, with different event models.

**Rule**:
A path- or pattern-scoped instruction file. In Claude Code, `.claude/rules/*.md` with `paths:` frontmatter. In Cursor, `.cursor/rules/*.mdc` with `description`/`alwaysApply`/`globs` frontmatter.

**Rules-first** (Cursor distribution stance):
Design posture of the Cursor distribution: `.cursor/rules/*.mdc` is the canonical surface for project conventions. AGENTS.md is recognized only as **legacy input** that the customizer's improve flow can migrate into modular rules — it is never generated.
_Avoid_: rules-only (rules-first leaves room for legacy migration; rules-only would mean ignoring AGENTS.md entirely)

**Subagent**:
A YAML-fronted agent definition spawned for delegated, isolated work. Claude Code uses `tools:`/`maxTurns:`; Cursor uses `readonly:`/`model: inherit`.

### Knowledge base vocabulary

**Wiki**:
The agent-maintained knowledge base under `wiki/knowledge/` — markdown pages compiled by an LLM from source documents in `docs/`, with an `index.md` table of contents and `log.md` operation log. Inspired by Karpathy's "LLM Knowledge Bases" pattern (see ADR-0004).
_Avoid_: RAG, vector store, knowledge graph

**Wiki page**:
A single `.md` file in `wiki/knowledge/` with frontmatter (Summary, Sources, Last updated) and `[[wiki-link]]` cross-references. One page per concept or per source-document summary.
_Avoid_: doc, article, note (these names are reserved for source documents in `docs/`)

**Source document**:
An immutable raw input under `docs/` (papers, vendor documentation, posts) ingested into the wiki. Never modified by agents — plays the role of Karpathy's `raw/` layer.
_Avoid_: raw, original (we keep the existing `docs/` name; renaming would break too many cross-references)

**Wiki-first lookup**:
The mandated knowledge-search order: `wiki/knowledge/index.md` → specific wiki page (via `[[link]]` or filename) → `docs/` source documents only as last resort. Replaces the prior RAG-first order (deleted in ADR-0004).
_Avoid_: wiki-only (the `docs/` fallback still exists for uncovered topics)

**Product-strict (Cursor distribution stance)**:
Branding rule for Cursor distribution artifacts: zero textual references to Claude Code, `.claude/`, `CLAUDE.md`, `tools:` whitelists, `maxTurns:`, `paths:` frontmatter, or any other Claude Code-specific construct. Vendor-neutral research (ETH study, "Lost in the Middle", "Effective Context Engineering") may be cited as "Industry Research" without product branding.
_Avoid_: claude-free, vendor-pure (these miss the product-vs-research distinction)

### HTML-structural body convention

**Skill body convention**:
The structural pattern applied to the markdown body of every `SKILL.md` (after the YAML frontmatter) and every subagent definition file (after its YAML frontmatter). Logical blocks are wrapped in **Semantic tags** drawn from the **Canonical tag vocabulary**. YAML frontmatter is untouched — it continues to follow each platform's official spec.
_Avoid_: HTML skill format, skill-as-html (the file remains `.md` / `.mdc`; only the body uses semantic tagging)

**Semantic tag**:
A custom XML/HTML element embedded inside a skill body or HTML artifact to demarcate a logical block — e.g., `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>`, `<PHASE>`. May carry standard attributes: `avoid=`, `always=`, `when=`, `name=`, `id=`, `priority=`.
_Avoid_: custom tag, structured block (semantic tag is the contract name; the others are too generic)

**Canonical tag vocabulary**:
The fixed set of semantic tags this project recognizes. **Mandatory**: `<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` containing one or more `<PHASE id="N" name="X">`. **Optional**: `<PREFLIGHT>`, `<REFERENCES>`, `<EXAMPLE>`, `<ANTI_PATTERN>`, `<OUTPUT>`, `<VALIDATION>`. The existing legacy `<RULES>` tag is an alias of `<HARD_RULES>` and is migrated on touch.
_Avoid_: tag set, tag dictionary (vocabulary is the canonical noun)

**HTML artifact**:
A full HTML5 document generated by a skill as an output deliverable (plan, PRD, design spec, report, prototype, explorer, custom editor). Carries human-facing presentation (CSS, layout, navigation) AND embedded **Semantic tags** so the next LLM session can parse the same logical structure. NEVER used for skill or subagent definitions themselves — those remain markdown-with-semantic-tags.
_Avoid_: HTML output, HTML doc (artifact is the canonical noun in this project)

**Artifact format routing**:
The rule determining whether a skill's generated output file is HTML or markdown. **HTML-default** for human-rich AND agent-executable artifacts: plans, PRDs, design specs, reports, research explainers, prototypes, code-review writeups, custom editors. **Markdown-mandatory** for two reasons — *agent-loaded* (SKILL.md, AGENTS.md, CLAUDE.md, `.claude/rules/*.md`, `.cursor/rules/*.mdc`, `wiki/knowledge/*.md`) and *tooling-locked* (commit messages, PR bodies, GitHub issues, ADRs, CONTEXT.md, READMEs, code comments). Explicit user override (`generate as markdown`) always wins.
_Avoid_: HTML-by-default, output routing (artifact format routing is the precise term)

**Tier-1 / Tier-2 / Tier-3 retrofit**:
Phased rollout of the **Skill body convention** to existing artifacts. **Tier-1** (immediate, same PRD): the 10 meta-skills (`create-skill`, `create-subagent`, `improve-skill`, `improve-subagent` in Claude Code customizer + Cursor customizer, plus `create-skill`, `improve-skill` in standalone), their `references/` + `assets/templates/`, validation criteria refs, and the three path-scoped rules (`.claude/rules/plugin-skills.md`, `standalone-skills.md`, `cursor-plugin-skills.md`). **Tier-2** (5 exemplar skills retrofitted as living references — see Convention scope below). **Tier-3** (remaining ~11 plugin + ~2 standalone skills backfilled organically when next touched).
_Avoid_: phase-1/phase-2, wave-1/wave-2 (Tier names avoid collision with the `<PHASE>` tag inside skill bodies)

**Convention scope (Skill body convention v1)**:
This PRD applies the **Skill body convention** to two surfaces only: (1) `plugins/*/skills/**/SKILL.md` and `plugins/*/agents/*.md` across all four plugin distributions, and (2) `skills/**/SKILL.md` in the standalone distribution. **Out of scope for v1**: `.claude/skills/**/SKILL.md` and `.claude/agents/*.md` in this repo (project-meta skills). If v1 succeeds, a follow-up PRD extends the convention to `.claude/` project-meta skills.
_Avoid_: full-repo scope, all-skills scope (v1 is deliberately staged)

**Tier-2 exemplars (v1)**:
The five canonical retrofitted skills demonstrating the convention to LLM authors:
1. `plugins/agent-customizer/skills/create-rule/SKILL.md` — rule-artifact authoring, Claude Code
2. `plugins/agent-customizer/skills/create-hook/SKILL.md` — hook-artifact authoring, Claude Code
3. `plugins/cursor-customizer/skills/create-rule/SKILL.md` — `.mdc` rule authoring, Cursor parity
4. `skills/init-agents/SKILL.md` — initializer pattern, Standalone
5. `plugins/agents-initializer/skills/init-claude/SKILL.md` — initializer-plugin pattern, Claude Code
_Avoid_: top-5 by size, .claude exemplars (size is uncorrelated with pattern variety; .claude is out of scope per Convention scope)

**Marketplace version cascade (PRD completion gate)**:
Every PRD that ships changes to `plugins/*/skills/**` or `plugins/*/agents/**` MUST bump (1) the affected plugin's `plugin.json` version, (2) the root Claude marketplace manifest version, and (3) the Cursor marketplace entry only when its shape changes (per `feedback_plugin_versioning_cascade` in user memory). The version-bump commit is the final atomic commit of the PRD.
_Avoid_: implicit version bumps, defer-to-release-CI (the cascade is explicit and per-PRD)

**Validation strictness (Skill body convention v1)**:
The enforcement level for canonical-tag conformance inside meta-skill self-validation loops. **Hard-fail**: missing any mandatory tag (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` with at least one `<PHASE>`); unbalanced tags; malformed attribute syntax. For subagents, `<TRIGGER>` becomes optional. **Warn**: non-canonical attribute names (typos in `avoid`, `always`, `when`, `name`, `id`, `priority`). **Silent**: absence of optional tags (`<PREFLIGHT>`, `<REFERENCES>`, `<EXAMPLE>`, `<ANTI_PATTERN>`, `<OUTPUT>`, `<VALIDATION>`).
_Avoid_: all-warn, all-hard (the tiered model balances safety and false-positive rate)

**Quality-gate content scope (v1)**:
The four quality-gate skills in `.claude/skills/` (`agent-customizer-quality-gate`, `cursor-customizer-quality-gate`, `cursor-initializer-quality-gate`, `quality-gate`) are out of scope for **Skill body convention** body-format retrofit but in scope for **content** updates that teach them to assert the new convention against plugin/standalone targets. Their own bodies remain markdown without semantic tags until a follow-up PRD.
_Avoid_: quality-gate refactor, gate-body retrofit (only the *checked-for* clauses change in v1, not the gate's own body)

### Orchestrate run vocabulary

**Orchestration run**:
One end-to-end execution of the `orchestrate` plugin over a single backlog partition — dependency-ordered waves, slice worktrees, an umbrella branch, and a final integration pull request.
_Avoid_: job, batch, orchestration session

**Run partition**:
The subset of the `ready-for-agent` backlog one run owns — the child issues of a single parent PRD, selected by `/orchestrate <PRD#>`. A no-argument run owns the whole backlog as one partition.
_Avoid_: backlog slice, batch (slice is reserved for a single issue's work)

**Run directory**:
The per-run `.orchestrate/runs/<runId>/` directory holding that run's ephemeral state — the run-state checkpoint, the context-flag, and rendered HTML artifacts. Gitignored; the committed config files stay at the `.orchestrate/` top level.
_Avoid_: run folder, state dir

**Driver session**:
The Claude Code session executing a run's orchestrator. Its identity is recorded in the run's run-state so the global context-watchdog binds the correct run when several runs proceed concurrently.
_Avoid_: orchestrator window, owner session

**Integration base**:
The branch every umbrella branch is cut from and every run's final pull request merges back into — `development` in this repository.
_Avoid_: main, master, trunk (the integration base is `development`, distinct from any release branch)

**Run cleanup**:
Removal of a concluded run's run directory, worktrees, and umbrella/slice branches — gated on that run's final integration pull request having been merged into the **Integration base**.
_Avoid_: purge, garbage collection, prune

**Capability detector** (`detect-project` module):
A pure module in `orchestrate-mcp/src/tools/detect-project.ts` that inspects a repository root's top-level manifest files and returns the **Capability command map** for the detected project type. Input: a repository root path. Output: a command map or empty object. No side effects. Detection precedence: npm (`package.json`) > Cargo (`Cargo.toml`) > Python (`pyproject.toml`) > Make (`Makefile`) > none. A repository with no recognized manifest yields an empty map — never a fallback npm map.
_Avoid_: project sniffer, auto-configurator, manifest scanner

**Capability command map**:
A plain object with the four fixed capability verb keys (`tests`, `typecheck`, `build`, `lint`), each mapping to an argv array consumed directly by the orchestrate run tools. Produced by the **Capability detector**. The `install` verb is never included — that is a setup verb, not a capability verb. For unrecognized project types the map is empty (`{}`).
_Avoid_: command config, verb table, command dictionary

## Relationships

- A **Distribution** owns at most one **Initializer** and at most one **Customizer**.
- An **Initializer** generates platform-wide files; a **Customizer** generates individual **Artifacts** of the four supported types.
- The **Claude Code distribution** and the **Cursor distribution** are siblings — same conceptual roles, different platform formats and conventions.
- A **Source document** in `docs/` is summarized into one **Wiki page** in `wiki/knowledge/`; one Source document may also seed multiple concept Wiki pages with `[[wiki-link]]` cross-references.
- The **Wiki** is the canonical knowledge surface for agents; **Source documents** are searched only when the wiki lacks coverage.
- The **Standalone distribution** sources from the cross-platform standard alone (platform-agnostic docs, filtered to skills and AGENTS.md authoring); plugin distributions source from their platform's docs plus the standard. See ADR-0006.
- A **Skill body convention** is composed of one or more **Semantic tags** drawn from the **Canonical tag vocabulary**.
- A **Semantic tag** is a syntactic construct; the **Canonical tag vocabulary** is the closed set this project recognizes.
- An **HTML artifact** carries one or more **Semantic tags** plus presentation chrome (CSS, layout, navigation) — the tags make it agent-parseable; the chrome makes it human-readable.
- **Artifact format routing** decides between an **HTML artifact** and a markdown artifact based on whether the consumer is *agent-loaded* / *tooling-locked* (markdown) or *human-rich + agent-executable* (HTML).
- **Tier-1**, **Tier-2**, and **Tier-3 retrofit** carve up the set of files subject to **Convention scope (v1)** by urgency, not by location.
- An **Orchestration run** owns exactly one **Run partition** and writes its ephemeral state to exactly one **Run directory**.
- Sibling **Orchestration runs** in the same repository must own disjoint **Run partitions** — one parent PRD's children each.
- A **Driver session** executes exactly one **Orchestration run**; the context-watchdog binds a run by matching the **Driver session** identity recorded in run-state.
- **Run cleanup** acts on an **Orchestration run** only after its final pull request has merged into the **Integration base**.

## Example dialogue

> **Dev:** "If I want to create a new path-scoped rule inside an already-set-up Cursor project, which plugin runs?"
> **Domain expert:** "The **Cursor customizer** — `cursor-customizer:create-rule`. The **Cursor initializer** would only run on a project without existing Cursor configuration."

> **Dev:** "I'm authoring a new SKILL.md. Where does the `## Hard Rules` heading go now that we have the new **Skill body convention**?"
> **Domain expert:** "It moves inside a `<HARD_RULES priority=\"hard\">` block — that's a **Semantic tag** from the **Canonical tag vocabulary**. The skill body stays markdown; only the section boundary changes from a heading to a tag the validator can address."

> **Dev:** "When `create-skill` generates a new skill whose job is to produce an implementation plan, does the *plan* end up as `.md` or `.html`?"
> **Domain expert:** "HTML — that's the default per **Artifact format routing** for a human-rich AND agent-executable artifact. The generated HTML carries the same **Canonical tag vocabulary** inside, so the next session parses it the same way it parses a SKILL.md body. The skill itself stays `SKILL.md`."

> **Dev:** "Can I run `/orchestrate` in two windows against the same repository?"
> **Domain expert:** "Yes — as long as each is an **Orchestration run** over a distinct **Run partition**. Pass `/orchestrate <PRD#>` per window so each owns one parent PRD's children. With no argument a run takes the whole backlog as a single partition, and a second concurrent run would collide on it."

## Flagged ambiguities

- "Cursor CLI" was used by the user to mean the full Cursor distribution surface (IDE + CLI share the `.cursor/rules/` system). Resolved: in this repo, **Cursor distribution** covers both surfaces — they consume the same artifact files.
- "knowledge base" was historically used to mean the RAG vector store registered as the `rag-knowledge-base` MCP server. Resolved as of ADR-0004: **Wiki** is the canonical knowledge base; the RAG layer is deleted.
- "HTML in skill body" was used by the user to mean *both* (a) the semantic-tag-inside-markdown pattern and (b) replacing `SKILL.md` with `.html` files. Resolved during grilling (ADR-0007): only (a) is adopted; **Skill body convention** keeps `SKILL.md` as a `.md` file (Agent Skills spec compliance) and embeds tags inside the markdown body.
- Legacy `<RULES>` tag (currently used in `plugins/agent-customizer/skills/create-skill/SKILL.md` and elsewhere) is treated as an alias of canonical `<HARD_RULES>`. Tier-3 organic retrofit migrates each occurrence on next touch; no scheduled mass rename.
- "two orchestrations" was used to mean two concurrent **Orchestration runs** in the *same* repository — resolved: each run must own a disjoint **Run partition** (one parent PRD's children); same-repo runs over an unpartitioned backlog collide on the identical issue set.
- "merged into main/master" was used for the **Run cleanup** gate — resolved: the gate is the run's final pull request merged into the **Integration base** (`development`), not a release branch. The plugin name and its directory are spelled `orchestrate` / `.orchestrate` (not `orquestrate`).
