# Repository-Global Validation Protocol

> **Scope**: Repository-global artifacts — files that span all plugin distributions and are not
> owned by any single plugin quality gate.
> **Use when**: Making changes to `.claude/rules/`, `.claude/hooks/`, `.github/instructions/`,
> root `CLAUDE.md`, `DESIGN-GUIDELINES.md`, or `docs/compliance/`.
> **Automation level**: Manual — no dedicated automated gate exists for this scope.

## Contents

1. [What Falls in This Scope](#1-what-falls-in-this-scope)
2. [Rules and Hooks Checklist](#2-rules-and-hooks-checklist)
3. [Review Instructions Checklist](#3-review-instructions-checklist)
4. [CLAUDE.md and DESIGN-GUIDELINES.md Checklist](#4-claudemd-and-design-guidelinesmd-checklist)
5. [Compliance Docs Checklist](#5-compliance-docs-checklist)
6. [Cross-Scope Impact Triage](#6-cross-scope-impact-triage)

---

## 1. What Falls in This Scope

| Artifact Type | Path Pattern | Owner |
|---------------|-------------|-------|
| Path-scoped rules | `.claude/rules/*.md` | repository-global |
| Hook configurations | `.claude/hooks/` | repository-global |
| GitHub review instructions | `.github/instructions/*.instructions.md` | repository-global |
| Root CLAUDE.md | `CLAUDE.md` | repository-global |
| Design guidelines | `DESIGN-GUIDELINES.md` | repository-global |
| Compliance docs | `docs/compliance/` | repository-global |
| Wiki knowledge pages | `wiki/knowledge/` | repository-global |

**Not in this scope:** Plugin-owned artifacts under `plugins/*/` are validated by their
respective plugin quality gate (quality-gate, agent-customizer-quality-gate,
cursor-initializer-quality-gate). Overlap: `.claude/rules/` that govern plugin conventions
are in scope for both scopes — check both.

---

## 2. Rules and Hooks Checklist

For each `.claude/rules/*.md` file changed:

- [ ] **Frontmatter present** — file starts with `---\npaths:\n  - "..."` YAML block
- [ ] **Paths non-empty** — `paths:` array has at least one pattern; no bare `**` or `**/*` pattern
- [ ] **Pattern is specific** — glob matches only the intended files; too-broad patterns waste context
- [ ] **Direct assertions only** — content uses imperatives ("MUST", "do X"), not prose explanations
- [ ] **No duplication** — content does not repeat information already in `CLAUDE.md` or another rule
- [ ] **Single concern** — file focuses on one artifact type or convention area

For each `.claude/hooks/` entry changed:

- [ ] **Exit codes correct** — blocking hooks exit 2 for abort, 0 for allow; non-blocking always exit 0
- [ ] **Tool filtering present** — hook targets specific tool events, not all events
- [ ] **No secret values** — hook scripts contain no hardcoded tokens, keys, or credentials

---

## 3. Review Instructions Checklist

For each `.github/instructions/*.instructions.md` file changed:

- [ ] **`applyTo:` frontmatter present** — file starts with `---\napplyTo: "..."\n---`
- [ ] **`applyTo:` glob is specific** — matches only the file types the instructions apply to
- [ ] **Under 4000 characters** — hard limit for Copilot code review instructions
- [ ] **Review-oriented content** — instructions describe what to CHECK (not what to do when writing)
- [ ] **No duplication with rules** — review instructions and `.claude/rules/` may overlap but should not repeat identical text

---

## 4. CLAUDE.md and DESIGN-GUIDELINES.md Checklist

For root `CLAUDE.md` changes:

- [ ] **Line budget** — root CLAUDE.md targets ≤ 40 lines; above 40, justify each addition
- [ ] **No domain-specific rules** — content that applies only to specific file patterns belongs in `.claude/rules/`, not CLAUDE.md
- [ ] **No duplication with plugin CLAUDE.md files** — root content applies to all contributors; plugin-specific content belongs in `plugins/*/CLAUDE.md`
- [ ] **Passes removal test** — every line passes "Would removing this cause the agent to make mistakes?"

For `DESIGN-GUIDELINES.md` changes:

- [ ] **Source citation present** — every guideline cites a published source (paper, official docs, practitioner guide)
- [ ] **"In practice" section** — each guideline has an "In practice" section explaining the implementation
- [ ] **"Implemented in" traceability** — each guideline identifies the specific artifacts that implement it

---

<!-- RAG rules and reindex hook removed per ADR-0004. -->

## 5. Compliance Docs Checklist

For `docs/compliance/` changes:

- [ ] **Finding model unchanged or expanded** — never remove or narrow CF-NNN fields; additions are allowed
- [ ] **Gate coverage map current** — if a new scope or gate is added, update `artifact-audit-manifest.md` Quality Gate Coverage Map section
- [ ] **Cross-references consistent** — any document citing another compliance doc uses the correct current filename

---

## 6. Cross-Scope Impact Triage

When a repository-global change may affect plugin scopes, run the applicable plugin gate:

| Change Made | Follow-Up Gate Required |
|-------------|------------------------|
| `.claude/rules/plugin-skills.md` updated | Run `quality-gate` |
| `.claude/rules/cursor-plugin-skills.md` updated | Run `cursor-initializer-quality-gate` |
| `.claude/rules/agent-files.md` updated | Run both `quality-gate` and `cursor-initializer-quality-gate` |
| `.claude/rules/reference-files.md` updated | Run all three plugin gates |
| `.github/instructions/skill-files.instructions.md` updated | Run `quality-gate` and `cursor-initializer-quality-gate` |
| `.github/instructions/agent-definitions.instructions.md` updated | Run all three plugin gates |
| `DESIGN-GUIDELINES.md` section updated | Run gate(s) for affected principle scope |
| `docs/compliance/finding-model-and-validator-protocol.md` updated | No automated gate — manually verify open CF-NNN records still conform |
