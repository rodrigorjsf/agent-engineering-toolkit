---
paths:
  - "skills/*/SKILL.md"
---
# Standalone Skill Conventions

- All analysis must be inline — include explicit bash commands for each step
- Never reference `codebase-analyzer`, `scope-detector`, `file-evaluator`, `artifact-analyzer`, `skill-evaluator`, `hook-evaluator`, `rule-evaluator`, or `subagent-evaluator` agents
- No Task tool, no agent delegation — skills must work with any AI coding tool
- Skills must be fully self-contained
- Analysis phases read converted agent reference docs from `references/` (e.g., `references/codebase-analyzer.md`)
- Reference docs in `references/` are "follow these instructions" content — not executable scripts
- `references/` directory MUST exist alongside SKILL.md and contain evidence-based guidance files
- `assets/templates/` directory MUST exist alongside SKILL.md and contain output templates; validator-type or report-only standalone skills that do not generate templated artifacts MAY omit it
- Templates in `assets/templates/` MAY embed platform-specific format only if the skill's `name` declares that platform target. The skill's `name` field is the canonical platform-target declaration — aliasing to escape this scoping is itself a violation.
- Standalone skills MUST encode behavioral discipline: surface assumptions first, prefer the simplest complete path, keep changes surgical, and define explicit validation targets
- If standalone skills use persuasion patterns, they MUST state the ethical constraint that those patterns support legitimate work only and never bypass safeguards or refusals
- Self-validation phase MUST read `references/validation-criteria.md` and loop until all checks pass
- Reference files must be one level deep from SKILL.md — no nested `references/references/` paths
- Each skill bundles its own copies of shared references — no symlinks, no cross-directory references
- Standalone bundled-file references MUST use relative `references/...` and `assets/templates/...` paths — NEVER `${CLAUDE_SKILL_DIR}`
- When an intentionally shared reference is updated, update all intended copies in sync
- Standalone skills MUST NOT author hooks, subagents, path-scoped rules, or CLAUDE.md hierarchy. The standalone bundle authors only **skills** (SKILL.md packages) and **AGENTS.md**. See ADR-0006.
- SKILL.md `name` field: ≤64 chars, lowercase letters/numbers/hyphens only, no XML tags
- SKILL.md `description` field: non-empty, ≤1024 chars, third person, no XML tags
- SKILL.md body: under 500 lines

## Canonical Tag Vocabulary (skills/**/SKILL.md)

Every `SKILL.md` body (post-frontmatter) under `skills/**` MUST wrap its logical blocks in the canonical semantic-tag vocabulary:

**Mandatory tags** — hard-fail if any are missing:
- `<TRIGGER when="...">` or `<TRIGGER when="..." />` — plain-language activation cue; required for skills
- `<BEHAVIOUR avoid="..." always="...">` — behavioural guidelines, mindset, posture
- `<HARD_RULES priority="hard">` — inviolable constraints (NEVER / EVERY / ALWAYS); legacy `<RULES>` is an accepted alias (no migration required until next touch)
- `<PROCESS>` containing at least one `<PHASE id="N" name="X">` — ordered execution phases; `id=` is mandatory on every `<PHASE>`

**Optional tags** — absence is never a finding:
`<PREFLIGHT>`, `<REFERENCES>`, `<EXAMPLE>`, `<ANTI_PATTERN>`, `<OUTPUT>`, `<VALIDATION>`

**Closed attribute set**: `avoid=`, `always=`, `when=`, `name=`, `id=`, `priority=`. Non-canonical attribute names produce a *warn* finding (typo guard); they do not hard-fail.

**Validation strictness tiers** (deterministic — apply verbatim):

| Tier | Trigger | Action |
|------|---------|--------|
| Hard-fail | Any mandatory tag missing | Fix before proceeding |
| Hard-fail | Unbalanced tags (open without close, or close without open) | Fix before proceeding |
| Hard-fail | Malformed attribute syntax (missing quotes, stray `=`, unterminated quote) | Fix before proceeding |
| Warn | Non-canonical attribute name outside the closed set | Surface warning; do not block |
| Silent | Absence of any optional tag | No finding |

A self-closing tag (`<TRIGGER ... />`) counts as balanced. `<PHASE>` missing `id=` is a hard-fail.

## Artifact Format Routing (skills/**/SKILL.md)

When a standalone skill generates an output artifact, the default format is:

- **HTML** for human-rich agent-executable artifacts: plans, PRDs, design specs, reports, prototypes, code-review writeups, custom editors
- **Markdown** (mandatory) for: `SKILL.md`, `AGENTS.md`, `README.md`, `CONTEXT.md`, ADR files, commit messages, PR bodies, GitHub issues, code comments

Explicit user override (`generate as markdown`) always wins over the default.

Standalone skills that generate HTML artifacts MUST ship a baseline HTML skeleton under `assets/templates/` and carry the canonical semantic-tag scaffold (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` with `<PHASE>`) inside the HTML `<body>`.

## Validation Strictness

Meta-skill self-validation loops MUST:
1. Check all mandatory canonical tags are present and balanced
2. Hard-fail on missing mandatory tags, unbalanced tags, or malformed attribute syntax
3. Warn (do not block) on non-canonical attribute names
4. Run at most 3 iterations before surfacing remaining failures to the user
