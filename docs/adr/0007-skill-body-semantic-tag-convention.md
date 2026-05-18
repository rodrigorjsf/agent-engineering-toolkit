# Skill body semantic-tag convention

**Status:** accepted (2026-05-17)

Skill bodies (and subagent bodies) in plugin distributions and the standalone distribution carry their logical blocks inside a fixed canonical vocabulary of semantic XML tags embedded in the markdown body. YAML frontmatter is untouched; the file extension stays `.md` (or `.mdc` for Cursor where applicable). Skills that generate human-rich AND agent-executable output artifacts (plans, PRDs, design specs, reports, prototypes) default to producing HTML files carrying the same canonical tags, so the next session can both render the artifact visually and parse it programmatically.

## Context

Thariq's *"The Unreasonable Effectiveness of HTML"* (`docs/html-structure/thariq-html-effectiveness.md`, ingested as `wiki/knowledge/html-artifact-effectiveness.md`) argues that markdown has become a restrictive format for the rich artifacts modern agents produce — plans, PRDs, design specs, reports — because the information density, visual clarity, and shareability of HTML beat markdown for human consumption. The user extended the observation: in this repo, artifacts skills generate are *agent-executable* too — the next LLM session reads the plan/PRD/spec and runs it. So the HTML format must serve two consumers at once: humans (CSS, layout, diagrams) and agents (parseable structure). The same logic flows backward to the skill body itself: today's `<RULES>` tag in `create-skill` and `<what-to-do>` / `<supporting-info>` tags in `grill-with-docs` already prove the value of addressable semantic blocks, but the vocabulary is fragmented per skill. A canonical tag set lets meta-skills and validators reason structurally over any skill or subagent body, and lets generated HTML artifacts inherit the same vocabulary so authoring tools, validators, and downstream agents share one parse target.

## Decision

- **Skill body convention** — every `SKILL.md` body (post-frontmatter) under `plugins/*/skills/**` and `skills/**`, and every subagent definition body under `plugins/*/agents/**`, wraps logical blocks in **Canonical tag vocabulary** elements. Mandatory: `<TRIGGER>` (skills only), `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` containing one or more `<PHASE id="N" name="X">`. Optional: `<PREFLIGHT>`, `<REFERENCES>`, `<EXAMPLE>`, `<ANTI_PATTERN>`, `<OUTPUT>`, `<VALIDATION>`. Standard attributes: `avoid=`, `always=`, `when=`, `name=`, `id=`, `priority=`.
- **YAML frontmatter unchanged** — each platform's official spec (Anthropic Agent Skills, Cursor skills) continues to govern frontmatter.
- **Artifact format routing** — meta-skills that generate human-rich AND agent-executable artifacts (plans, PRDs, design specs, reports, research explainers, prototypes, code-review writeups, custom editors) default to HTML output carrying the same canonical tags. Markdown remains mandatory for *agent-loaded* files (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/rules/*.md`, `.cursor/rules/*.mdc`, `wiki/knowledge/*.md`, `docs/adr/*.md`) and *tooling-locked* files (commit messages, PR bodies, GitHub issues, `CONTEXT.md`, READMEs, code comments). Explicit user override (`generate as markdown`) always wins.
- **Convention scope v1** — only `plugins/*/skills/**`, `plugins/*/agents/**`, and `skills/**` are subject to this convention in v1. The `.claude/skills/**` and `.claude/agents/**` of this repo are out of scope; a follow-up PRD extends the convention to them if v1 succeeds.
- **Retrofit tiers** — Tier-1: 10 meta-skills + their references/templates/validation criteria + three path-scoped rules updated immediately. Tier-2: 5 exemplar skills retrofitted as living references (see `CONTEXT.md` for the canonical list). Tier-3: remaining ~13 in-scope skills migrate organically when next touched.
- **Validation strictness** — meta-skill self-validation loops hard-fail on missing mandatory tags, unbalanced tags, or malformed attribute syntax; warn on non-canonical attribute names; stay silent on absence of optional tags.

## Considered options (rejected)

**Replace SKILL.md with full HTML files (.html)** — interpreted maximally, "HTML structural pattern in skill bodies" could mean shipping HTML files in place of `SKILL.md`. Rejected: breaks the open Agent Skills standard (YAML frontmatter + markdown body), breaks the Claude Code plugin loader's discovery logic, and contradicts the explicit warning in Thariq's post against the "/html skill" anti-pattern. Thariq's argument is for output artifacts, not for skill definitions consumed by LLMs.

**Keep markdown-only with ad-hoc tags per skill** — accept the current fragmented state (`<RULES>` in some skills, `<what-to-do>` in others, plain headings elsewhere). Rejected because the lack of a closed vocabulary makes structural validation impossible, prevents meta-skills from reasoning over skill bodies, and creates an open-ended drift surface where each new skill invents its own tag names.

**Restrict the convention to Claude Code distribution only** — leave Cursor and standalone untouched. Rejected because the tag vocabulary is platform-agnostic (only the YAML frontmatter varies per platform), and divergence between distributions would force the meta-skill `create-skill` to ship three structurally different templates instead of one. Cursor's product-strict stance (ADR-0001) and the standalone bundle's content-source boundary (ADR-0006) are both satisfied by a vendor-neutral tag set.

**Sweep all 85 files (skills + subagents) in one retrofit PR** — apply the convention everywhere at once. Rejected because a ~100-file PR is unreviewable, leaves no fallback if validation surfaces blocking issues mid-migration, and the Tier-1+Tier-2+Tier-3 staging captures the same long-term outcome with a fraction of the per-PR risk.

**Apply the convention to `.claude/skills/**` in this same PRD** — include this repo's project-meta skills in v1 scope. Rejected (user direction, mid-grilling) to keep v1 deliverable bounded and learn from plugin/standalone migration first; a follow-up PRD extends scope once v1 settles.

## Consequences

- The three path-scoped rules `.claude/rules/plugin-skills.md`, `.claude/rules/standalone-skills.md`, and `.claude/rules/cursor-plugin-skills.md` gain clauses mandating the Canonical tag vocabulary and Artifact format routing on covered files.
- The four `.claude/skills/`-resident quality-gate skills receive *content* updates (new checks against plugin/standalone targets) but their own bodies stay markdown without semantic tags until a follow-up PRD.
- Two new wiki pages — `skill-body-convention.md` (project-internal reference) and `html-artifact-effectiveness.md` (Thariq summary) — register in `wiki/knowledge/index.md` and `wiki/knowledge/log.md`.
- Marketplace version cascade: every plugin whose skills change bumps its `plugin.json` and the root Claude marketplace manifest version; the Cursor marketplace entry bumps only when entry shape changes (per memory note `feedback_plugin_versioning_cascade`).
- This PRD itself is the bootstrap markdown PRD; *subsequent* PRDs in this repo default to HTML per the new Artifact format routing rule.
