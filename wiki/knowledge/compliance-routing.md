# Compliance Routing

**Summary**: Decision table mapping every validator scope to its named source bundle, primary directories, forbidden sources, and entry points — derived from the normative-source-matrix.
**Sources**: docs/compliance/normative-source-matrix.md
**Last updated**: 2026-05-02

---

> **Derived view** — This page is a compact routing reference for validators. The authoritative definitions live in the normative source matrix (`docs/compliance/normative-source-matrix.md`). If those definitions change, this page must be updated to match.

Before loading any platform-specific conventions, identify your validation scope below and read the matching scope-specific page (`[[validation-routing-claude]]`, `[[validation-routing-cursor]]`, `[[validation-routing-standalone]]`). Each scope-specific page lists the primary entry points to read first; this prevents loading forbidden sources and reduces retrieval noise.

---

## Routing Decision Table

| Scope | Named Bundle | Primary Source Dirs | Forbidden Sources |
|-------|-------------|---------------------|-------------------|
| Claude Code plugins (`agents-initializer`, `agent-customizer`) | `claude-plugin-bundle` | `docs/claude-code/`, `docs/general-llm/`, `docs/shared/` | All `docs/cursor/**`, all `CURSOR-*` sources |
| Cursor IDE plugins (`cursor-initializer`, `cursor-customizer`) | `cursor-plugin-bundle` | `docs/cursor/`, `docs/general-llm/`, `docs/shared/` | All `docs/claude-code/**`, all `CLAUDE-*` sources |
| Standalone skills (`skills/`) | `standalone-bundle` | `docs/shared/`, `docs/general-llm/`, `skills/` | All `docs/claude-code/**`, all `docs/cursor/**`, all `CLAUDE-*`, all `CURSOR-*`, hook/subagent-specific guidance |
| Repository governance | `governance-bundle` | `DESIGN-GUIDELINES.md`, `docs/claude-code/memory/`, `docs/general-llm/` | Completed PRPs, historical plans, `next-steps.md` |
| Claude Code plugins (agent-customizer only) | `agent-customizer-bundle` (extends `claude-plugin-bundle`) | All `claude-plugin-bundle` sources + `docs/claude-code/hooks/`, `.github/instructions/rules.instructions.md` | All `docs/cursor/**` |

---

## Primary Entry Points per Scope

### Claude Code plugin scope

Read first:
- `wiki/knowledge/claude-code-skills.md` — SKILL.md format, frontmatter
- `wiki/knowledge/claude-code-subagents.md` — agent definitions
- `wiki/knowledge/claude-code-plugins.md` — plugin structure and manifest
- `plugins/agents-initializer/skills/` — concrete SKILL.md examples in this repo

### Cursor IDE plugin scope

Read first:
- `wiki/knowledge/cursor-rules.md` — `.mdc` format and activation modes
- `wiki/knowledge/cursor-skills.md` — Cursor skill invocation
- `wiki/knowledge/cursor-plugins.md` — manifest and bundling
- `plugins/cursor-initializer/skills/` — concrete SKILL.md examples in this repo

### Standalone skills scope

Read first:
- `wiki/knowledge/agent-skills-standard.md` — open specification
- `wiki/knowledge/skill-authoring.md` — authoring best practices
- `skills/` — concrete SKILL.md examples in this repo

### Repository governance scope

Read first:
- `wiki/knowledge/evaluating-agents-paper.md` — ETH Zurich minimal-config evidence
- `wiki/knowledge/claude-code-memory.md` — CLAUDE.md hierarchy and progressive disclosure
- `DESIGN-GUIDELINES.md` at the repo root

---

## Scope-Specific Pages

For a detailed routing guide including entry points, validation paths, and common gotchas:

- [[validation-routing-claude]] — Claude Code plugin validation
- [[validation-routing-cursor]] — Cursor IDE plugin validation
- [[validation-routing-standalone]] — Standalone skills validation
