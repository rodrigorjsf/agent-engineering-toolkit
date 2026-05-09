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

**Skill description budget**:
The character ceiling on the `description:` field of every `SKILL.md` in this repository, enforced to keep total skill metadata within Claude Code's `skillListingBudgetFraction` default (1% of context). Target band: 110–150 chars; hard ceiling: 200 chars; exception up to 400 chars with `description-budget-exception:` frontmatter field. See ADR-0007 and `[[skill-listing-budget]]`.
_Avoid_: description limit, description cap (these miss the budget-fraction connection)

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

## Relationships

- A **Distribution** owns at most one **Initializer** and at most one **Customizer**.
- An **Initializer** generates platform-wide files; a **Customizer** generates individual **Artifacts** of the four supported types.
- The **Claude Code distribution** and the **Cursor distribution** are siblings — same conceptual roles, different platform formats and conventions.
- A **Source document** in `docs/` is summarized into one **Wiki page** in `wiki/knowledge/`; one Source document may also seed multiple concept Wiki pages with `[[wiki-link]]` cross-references.
- The **Wiki** is the canonical knowledge surface for agents; **Source documents** are searched only when the wiki lacks coverage.
- The **Standalone distribution** sources from the cross-platform standard alone (platform-agnostic docs, filtered to skills and AGENTS.md authoring); plugin distributions source from their platform's docs plus the standard. See ADR-0006.

## Example dialogue

> **Dev:** "If I want to create a new path-scoped rule inside an already-set-up Cursor project, which plugin runs?"
> **Domain expert:** "The **Cursor customizer** — `cursor-customizer:create-rule`. The **Cursor initializer** would only run on a project without existing Cursor configuration."

## Flagged ambiguities

- "Cursor CLI" was used by the user to mean the full Cursor distribution surface (IDE + CLI share the `.cursor/rules/` system). Resolved: in this repo, **Cursor distribution** covers both surfaces — they consume the same artifact files.
- "knowledge base" was historically used to mean the RAG vector store registered as the `rag-knowledge-base` MCP server. Resolved as of ADR-0004: **Wiki** is the canonical knowledge base; the RAG layer is deleted.
