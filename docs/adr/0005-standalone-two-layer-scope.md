# Standalone scope is two-layer: agnostic prose, platform-targeted templates

The standalone distribution (`skills/`) hosts skills like `init-claude` and `improve-claude` whose explicit purpose is to generate Claude Code-format artifacts (`.claude/rules/*.md` with `paths:` frontmatter, `CLAUDE.md` hierarchy). The previous wording in `wiki/knowledge/validation-routing-standalone.md` listed `paths:` in any generated rule file and references to platform-specific files as forbidden contamination signals — under a literal reading those skills failed compliance by definition, contradicting the explicit catalog in `skills/README.md`. We resolve the contradiction by formally splitting the standalone-bundle into two compliance layers: the **skill body** (SKILL.md prose, references) must remain platform-agnostic and source only from `SHARED-*` and `GENERAL-*` IDs; the **templates** (`assets/templates/`) MAY embed platform-specific format **iff** the skill's `name` declares the target platform (e.g. `init-claude` is allowed `CLAUDE-*` template content, `init-agents` is allowed cross-platform AGENTS.md format, a hypothetical platform-neutral skill must keep its templates platform-neutral too).

## Why two layers, not one

We considered three readings:

1. **Mechanism-only** — forbid only Claude harness mechanisms (Task tool, named agents, `${CLAUDE_SKILL_DIR}`) inside the skill runtime; allow anything in prose as long as it serves output. Rejected: reviewers can't tell signal from leak when a skill's prose freely names `.claude/rules/`, subagents, or `${CLAUDE_SKILL_DIR}` "for output."
2. **Strict** — forbid every Claude reference, including templates. Rejected: deletes `init-claude`, `improve-claude`, and arguably `init-agents` from `skills/`, breaking the explicit user-facing contract in `skills/README.md`.
3. **Two-layer** — split skill prose from template artifacts; agnostic prose, platform-targeted templates conditional on the skill's declared target. Adopted.

## Authority chain

- The skill body remains bound to `standalone-bundle` Tier 2/3 sources: `SHARED-SKILLS-STD`, `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES`, `GENERAL-AGENTS-GUIDE`. Mention of Claude harness mechanisms (Task tool, agent delegation, `${CLAUDE_SKILL_DIR}`) in prose remains a contamination finding.
- Templates under `assets/templates/` are scoped by the skill's declared platform target. A skill named `init-<platform>` or `improve-<platform>` may use `<PLATFORM>-*` source IDs for template authority. A platform-neutral skill (e.g. `create-skill` targeting the open Agent Skills standard) keeps templates neutral.
- The skill's `name` field is the canonical declaration of platform target; aliasing or workaround naming to escape this scoping is itself a finding.

## Required follow-ups

- Update `wiki/knowledge/validation-routing-standalone.md` to add an explicit "Layered scope" section and rewrite the contamination signal list so output-template contamination signals are scoped to neutral skills only.
- Update `.claude/rules/standalone-skills.md` with one new bullet: templates in `assets/templates/` MAY embed platform-specific format only if the skill's `name` declares that platform target.
- Update `docs/compliance/normative-source-matrix.md` `standalone-bundle` definition to reference this two-layer split.
- The `validation-routing-standalone` "Common Validation Mistakes" entry "checking that `.claude/rules/` are referenced by standalone skills — they should NOT be" must be qualified: applies only to skill prose and to neutral-skill templates, not to Claude-targeted-skill templates.

## Why now

The contradiction was latent until the Q1 grilling round of the May 2026 alignment audit surfaced it. Locking the interpretation as an ADR before the audit produces findings prevents every standalone audit verdict from being ambiguous between a strict-rule failure and an as-built feature.
