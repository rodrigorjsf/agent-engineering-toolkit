# Fixture Corpus — Skill Body Convention (Subagent Variant, Shared)

> **Shared corpus redirect** — the canonical golden fixture files live at:
> `.claude/skills/agent-customizer-quality-gate/assets/fixtures/subagent/`
>
> The semantic-tag convention body rules are platform-agnostic (per ADR-0007 and
> `wiki/knowledge/skill-body-convention.md`). Tag vocabulary and strictness tiers
> are identical for Claude Code subagents and Cursor subagents — only the YAML
> frontmatter differs by platform. Since the check targets only the body (post-
> frontmatter content), the same fixtures serve both platforms.
>
> **To run the Canonical Semantic-Tag Convention subagent-body check for this gate:**
> read fixtures from `.claude/skills/agent-customizer-quality-gate/assets/fixtures/subagent/`
> and use the MANIFEST.md there for the expected verdicts.

This covers `plugins/cursor-customizer/agents/**/*.md` bodies.
The expected verdict table is in the shared MANIFEST at the path above.

Note: Cursor subagents use `model: inherit` and `readonly: true` frontmatter (no `tools:`
or `maxTurns:`). The fixture frontmatter in the shared corpus uses Claude Code conventions,
but the body validation (which is what these checks test) is identical across platforms.
