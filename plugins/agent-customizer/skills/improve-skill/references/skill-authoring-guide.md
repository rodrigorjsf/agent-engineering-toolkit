# Skill Authoring Guide

Evidence-based guidance for creating effective Claude Code skills (SKILL.md files).
Source: skills/skill-authoring-best-practices.md, skills/extend-claude-with-skills.md, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md`

---

## Contents

- Core principles (conciseness, degrees of freedom, multi-model testing)
- Skill structure (frontmatter fields, naming, descriptions)
- Progressive disclosure patterns (references, assets, on-demand loading)
- Anti-patterns (what to avoid in skill authoring)
- Invocation control (disable-model-invocation, user-invocable)

---

## Core Principles

**Conciseness is the primary principle.** The context window is a shared resource. At startup, only `name` + `description` load for all skills; SKILL.md loads when triggered; supporting files load only on demand. Challenge every piece of content with the deletion test (see `skill-evaluation-criteria.md`): would removing this cause mistakes? If not, cut it. "Claude is already very smart — only add context it doesn't have." (skill-authoring-best-practices.md)

**Behavioral discipline** and **safe persuasion** patterns — see `behavioral-guidelines.md`.

**Degrees of freedom** — match specificity to task fragility. High freedom (text instructions) when multiple approaches are valid; medium (pseudocode or parameterized scripts) when a preferred pattern exists; low (exact scripts, no parameters) when operations are fragile and consistency is critical. Analogy: a robot on a narrow bridge vs. an open field.

**Test with all models you plan to use** — Haiku may need more detail, Sonnet should run cleanly, Opus may need less to avoid over-explanation.

*Source: skills/skill-authoring-best-practices.md lines 11-145*

---

## Skill Structure and Frontmatter

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Recommended | Lowercase, numbers, hyphens; max 64 chars; no "anthropic" or "claude" |
| `description` | Recommended | What it does + when to use it; max 1024 chars; third person |
| `disable-model-invocation` | No | `true` = user-only invocation; description not in context |
| `user-invocable` | No | `false` = Claude-only; hidden from `/` menu |
| `allowed-tools` | No | Tools Claude can use without prompting during skill |
| `model` | No | Override model for this skill |
| `effort` | No | `low`/`medium`/`high`/`max`; overrides session effort |
| `context` | No | `fork` = run in isolated subagent context |
| `agent` | No | Subagent type when `context: fork` is set |
| `hooks` | No | Hooks scoped to this skill's lifecycle |
| `argument-hint` | No | Autocomplete hint, e.g. `[issue-number]` |

Directory layout (`SKILL.md` + `references/`, `assets/templates/`, `scripts/`) and platform extensions detail live in `skill-format-reference.md`.

*Source: skills/extend-claude-with-skills.md lines 169-199*

---

## Naming and Descriptions

**Naming** — prefer gerund form (`processing-pdfs`, `analyzing-data`). Avoid generic names (`helper`, `utils`, `tools`, `data`, `files`).

**Descriptions** — write in third person ("Processes Excel files...", not "I can help you..." or "You can use this..."). Include (1) what it does, (2) when to use it, (3) specific trigger terms for matching.

*Source: skills/skill-authoring-best-practices.md lines 168-250*

---

## Progressive Disclosure Patterns

SKILL.md is the index; detailed content lives in supporting files loaded on demand. Apply two patterns: (1) reference the bundled guide material from each phase rather than inlining its content, and (2) load only the references needed for the current phase, not all at once. Loading-model levels are tabulated in `skill-format-reference.md` § Progressive Disclosure Loading Model.

*Source: skills/skill-authoring-best-practices.md lines 251-300; skills/extend-claude-with-skills.md lines 223-246*

---

## Invocation Control

Default: both user and Claude can invoke; description always loaded. `disable-model-invocation: true` makes the skill user-only and removes the description from context — use it for side-effect workflows (commit, deploy, send-message). `user-invocable: false` hides the skill from `/` while keeping it available to Claude — use it for background knowledge.

*Source: skills/extend-claude-with-skills.md lines 248-283*

---

## Anti-Patterns

Avoid generic descriptions ("helps with data" — be specific about what + when), inlining all reference content in SKILL.md (move to `references/`), and hardcoded file paths (use `${CLAUDE_SKILL_DIR}` for bundled files). General prompting anti-patterns (vague instructions, contradictions, lost-in-the-middle) live in `prompt-engineering-strategies.md`.

*Source: skills/skill-authoring-best-practices.md lines 800-1100*
