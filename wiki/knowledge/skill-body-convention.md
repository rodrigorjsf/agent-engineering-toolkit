# Skill Body Convention

**Summary**: The project-internal contract for how `SKILL.md` and subagent definition files structure their body — markdown body wrapped around a closed canonical vocabulary of semantic XML tags (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>`/`<PHASE>`, and optional `<PREFLIGHT>`/`<REFERENCES>`/`<EXAMPLE>`/`<ANTI_PATTERN>`/`<OUTPUT>`/`<VALIDATION>`). Meta-skills that generate human-rich artifacts default to HTML files carrying the same tags so the same parse target serves humans and the next agent session.
**Sources**: docs/adr/0007-skill-body-semantic-tag-convention.md, CONTEXT.md (HTML-structural body convention block), docs/html-structure/thariq-html-effectiveness.md
**Last updated**: 2026-05-17

---

## Why this exists

Modern agents produce richer artifacts than markdown comfortably handles (per [[html-artifact-effectiveness]]), and in this repo those artifacts feed the *next* LLM session, not just a human reviewer. A closed semantic-tag vocabulary embedded in skill bodies and generated artifacts gives meta-skills, validators, and downstream agents one parse target. See ADR-0007 for the binding decision and rejected alternatives.

## File-format contract

| Surface                                  | File extension  | Frontmatter                                                  | Body                       |
| ---------------------------------------- | --------------- | ------------------------------------------------------------ | -------------------------- |
| Claude Code skill                        | `SKILL.md`      | YAML, per [[claude-code-skills]]                             | Markdown + semantic tags   |
| Claude Code subagent                     | `<name>.md`     | YAML, per [[claude-code-subagents]]                          | Markdown + semantic tags   |
| Cursor skill                             | `SKILL.md`      | YAML, per [[cursor-skills]]                                  | Markdown + semantic tags   |
| Cursor subagent                          | `<name>.md`     | YAML, per [[cursor-subagents]]                               | Markdown + semantic tags   |
| Standalone skill                         | `SKILL.md`      | YAML, per [[agent-skills-standard]]                          | Markdown + semantic tags   |
| Generated HTML artifact (plan/PRD/spec)  | `<name>.html`   | None (HTML5 `<head>` carries title + minimal `<style>`)      | HTML5 + semantic tags      |

YAML frontmatter is untouched — each platform's official spec continues to govern it.

### Recorded exceptions

- **`cursor-code-documentation` manual-only skills** (`plugins/cursor-code-documentation/skills/code-explain/SKILL.md`, `…/doc-generate/SKILL.md`) — authored per the `/writing-great-skills` methodology in **plain Markdown with no semantic-tag scaffold**, per ADR-0016 (`docs/adr/0016-cursor-code-documentation-rule-not-hook.md`). The decision is recorded there: the methodology's pruning discipline treats the tags as ceremony for these short, user-invoked command mirrors. The exception is scoped to these two skills only and does not generalize. Their quality gate validates them against the writing-great-skills authoring bar (frontmatter, human-facing description, an ordered process with checkable completion criteria), not against this vocabulary.

## Canonical tag vocabulary

### Mandatory tags

| Tag             | Required for                | Purpose                                                            |
| --------------- | --------------------------- | ------------------------------------------------------------------ |
| `<TRIGGER>`     | Skills only (optional in subagents) | Plain-language activation context — "use when X" cue        |
| `<BEHAVIOUR>`   | Skills + subagents          | Behavioural guidelines, mindset, posture                           |
| `<HARD_RULES>`  | Skills + subagents          | Inviolable constraints (NEVER / EVERY / ALWAYS rules)              |
| `<PROCESS>`     | Skills + subagents          | Container for the ordered phases                                   |
| `<PHASE>`       | Skills + subagents          | One execution step inside `<PROCESS>` (requires `id=` and `name=`) |

`<PROCESS>` must contain at least one `<PHASE>`. Subagents may omit `<TRIGGER>` because they are spawned by skills rather than user-invoked.

### Optional tags

| Tag              | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `<PREFLIGHT>`    | Checks that gate `<PROCESS>` (e.g., name-collision check)          |
| `<REFERENCES>`   | List of `references/*.md` files to load on demand                  |
| `<EXAMPLE>`      | Worked example illustrating a tag's content                        |
| `<ANTI_PATTERN>` | What to avoid; pairs naturally with `<BEHAVIOUR avoid="">`         |
| `<OUTPUT>`       | Output format contract (especially load-bearing in subagents)      |
| `<VALIDATION>`   | Self-validation loop description and acceptance criteria           |

### Standard attributes

All tags accept attributes; the closed set is:

- `avoid="..."` — short cue of what to avoid (free-text)
- `always="..."` — short cue of what to always do (free-text)
- `when="..."` — conditional activation cue (free-text)
- `name="..."` — block label (also `<PHASE name="...">`)
- `id="..."` — addressable identifier (mandatory on `<PHASE>`)
- `priority="hard|soft"` — distinguishes hard rules from soft guidelines

Non-canonical attributes are not rejected, but trigger a *warn* finding in validation (typo guard).

### Legacy `<RULES>` alias

The existing `<RULES>` tag in `plugins/agent-customizer/skills/create-skill/SKILL.md` and elsewhere is an alias of `<HARD_RULES>`. Tier-3 organic retrofit migrates each occurrence on next touch — no scheduled mass rename.

## Artifact format routing

When a meta-skill generates an output artifact, decide its format with this table:

| Artifact kind                                  | Default format | Reason                                            |
| ---------------------------------------------- | -------------- | ------------------------------------------------- |
| Plan, PRD, design spec                         | HTML           | Human-rich + agent-executable                     |
| Report (weekly status, research, explainer)    | HTML           | Human-rich + agent-executable                     |
| Prototype, custom editor, code-review writeup  | HTML           | Interactivity benefits from HTML                  |
| `SKILL.md`, subagent `.md`                     | Markdown       | Agent-loaded; spec-mandated                       |
| `AGENTS.md`, `CLAUDE.md`                       | Markdown       | Agent-loaded; spec-mandated                       |
| `.claude/rules/*.md`, `.cursor/rules/*.mdc`    | Markdown       | Agent-loaded; spec-mandated                       |
| `wiki/knowledge/*.md`                          | Markdown       | Agent-loaded by wiki-routing rule                 |
| `docs/adr/*.md`                                | Markdown       | Tooling-locked (ADR convention)                   |
| `CONTEXT.md`                                   | Markdown       | Tooling-locked (`grill-with-docs` reads it)       |
| `README.md`                                    | Markdown       | Tooling-locked (npm/GitHub renderers)             |
| Commit message, PR body, GitHub issue          | Markdown       | Tooling-locked (GitHub renderers)                 |
| Code comments                                  | Markdown-ish   | Tooling-locked (compiler/linter parses)           |

Explicit user override (`generate as markdown`) always wins over the default.

## HTML artifact baseline

The minimum skeleton for HTML artifacts:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{artifact-title}}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 1rem; line-height: 1.6; color: #1f2937; }
    BEHAVIOUR, HARD_RULES, PROCESS, PHASE, PREFLIGHT, REFERENCES, EXAMPLE, ANTI_PATTERN, OUTPUT, VALIDATION, TRIGGER { display: block; margin: 1rem 0; }
    TRIGGER { font-style: italic; color: #4b5563; }
    BEHAVIOUR { background: #f0f4ff; border-left: 4px solid #2563eb; padding: 1rem; border-radius: 4px; }
    HARD_RULES[priority="hard"] { background: #fef2f2; border-left: 4px solid #dc2626; padding: 1rem; border-radius: 4px; }
    PROCESS { border-top: 1px solid #e5e7eb; padding-top: 1rem; }
    PHASE { background: #fafafa; border: 1px solid #e5e7eb; padding: 1rem; margin: 0.5rem 0; border-radius: 4px; }
    PHASE::before { content: "Phase " attr(id) " — " attr(name); display: block; font-weight: 600; margin-bottom: 0.5rem; color: #111827; }
    ANTI_PATTERN { background: #fffbeb; border-left: 4px solid #d97706; padding: 1rem; border-radius: 4px; }
    OUTPUT { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 1rem; border-radius: 4px; }
    VALIDATION { background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 1rem; border-radius: 4px; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 3px; }
    pre { padding: 0.75rem; overflow-x: auto; }
  </style>
</head>
<body>
  <main>
    <h1>{{artifact-title}}</h1>
    <TRIGGER when="...">...</TRIGGER>
    <BEHAVIOUR avoid="..." always="...">...</BEHAVIOUR>
    <HARD_RULES priority="hard">...</HARD_RULES>
    <PROCESS>
      <PHASE id="1" name="...">...</PHASE>
    </PROCESS>
    <OUTPUT format="...">...</OUTPUT>
    <VALIDATION>...</VALIDATION>
  </main>
</body>
</html>
```

Custom tag names (`BEHAVIOUR`, `HARD_RULES`, etc.) are valid HTML5 — browsers treat unknown elements as inline by default, which the `display: block` rules upgrade.

## Validation strictness

Meta-skill self-validation loops apply these checks:

- **Hard-fail**: any mandatory tag missing; unbalanced open/close; malformed attribute syntax.
- **Warn**: attribute names outside the canonical set (typo guard for `avoid`, `always`, `when`, `name`, `id`, `priority`).
- **Silent**: absence of optional tags.

The loop runs at most 3 iterations before surfacing remaining failures to the user.

## Convention scope v1

Subject to the convention now: `plugins/*/skills/**`, `plugins/*/agents/**`, `skills/**`.

**Out of scope for v1**: `.claude/skills/**` and `.claude/agents/**` of this repo (project-meta skills). A follow-up PRD extends the convention to them if v1 succeeds.

## Retrofit tiers

- **Tier-1** (immediate, this PRD): 10 meta-skills (`create-skill`, `create-subagent`, `improve-skill`, `improve-subagent` in Claude Code customizer + Cursor customizer; `create-skill`, `improve-skill` in standalone) plus their `references/`, `assets/templates/`, validation criteria refs, and the three path-scoped rules (`.claude/rules/plugin-skills.md`, `standalone-skills.md`, `cursor-plugin-skills.md`).
- **Tier-2** (exemplars, this PRD): `plugins/agent-customizer/skills/create-rule/`, `plugins/agent-customizer/skills/create-hook/`, `plugins/cursor-customizer/skills/create-rule/`, `skills/init-agents/`, `plugins/agents-initializer/skills/init-claude/`.
- **Tier-3** (organic): the remaining ~13 in-scope skills migrate when next touched.

## Worked example — skill body

```markdown
---
name: my-skill
description: Does X when Y. Use when ...
allowed-tools: [Read, Edit]
model: sonnet
---

# My Skill

<TRIGGER when="user asks for X" />

<BEHAVIOUR
  avoid="make decisions without surfacing assumptions"
  always="ask before writing files">
- Surface assumptions first
- Prefer simplest path
- Keep changes surgical
</BEHAVIOUR>

<HARD_RULES priority="hard">
- NEVER inline reference content
- EVERY description: third-person, ~50 tokens
- EVERY skill body: <500 lines
</HARD_RULES>

<PROCESS>
  <PREFLIGHT name="name-collision-check">
    Check if a skill with the same name exists ...
  </PREFLIGHT>

  <PHASE id="1" name="analysis">
    Delegate to artifact-analyzer ...
  </PHASE>

  <PHASE id="2" name="generate">
    <REFERENCES load="on-demand">
      - skill-authoring-guide.md
      - behavioral-guidelines.md
    </REFERENCES>
    Read template, fill placeholders ...
  </PHASE>
</PROCESS>

<VALIDATION loop="max-iterations:3">
  Read skill-validation-criteria.md, loop until pass.
</VALIDATION>
```

## Related pages

- [[html-artifact-effectiveness]]
- [[claude-code-skills]]
- [[claude-code-subagents]]
- [[cursor-skills]]
- [[cursor-subagents]]
- [[agent-skills-standard]]
- [[skill-authoring]]
- [[progressive-disclosure]]
