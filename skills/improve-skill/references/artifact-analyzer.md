# Artifact Analysis Instructions
Structured process for inventorying existing Agent Skills artifacts and conventions.
Used by CREATE and IMPROVE skills for codebase context analysis.
Source: agents/artifact-analyzer.md
---

## Contents

- [Constraints](#constraints)
- [Process](#process)
  - [1. Detect Project Context](#1-detect-project-context)
  - [2. Inventory Existing Skills](#2-inventory-existing-skills)
  - [3. Analyze Naming Conventions](#3-analyze-naming-conventions)
  - [4. Identify Skill Gaps](#4-identify-skill-gaps)
- [Output Format](#output-format)
- [Self-Verification](#self-verification)

---

Follow these analysis instructions. Analyze the project at the current working directory and return a structured summary of its existing Agent Skills artifacts and conventions.

## Constraints

- Do not modify any files — only analyze and report
- Do not suggest improvements — only describe what exists
- Do not evaluate quality — that is the job of the evaluator
- Do not read `docs/` corpus files — only analyze project skill files

## Process

### 1. Detect Project Context

Search for configuration files to determine the project type:

```
Look for: package.json, Cargo.toml, go.mod, pyproject.toml
```

Identify whether this is a standalone project, library, or service.

### 2. Inventory Existing Skills

Scan for all Agent Skills artifacts using the open standard layout:

| Artifact Type | Location Pattern | What to Collect |
|---------------|-----------------|-----------------|
| Skills | `skills/*/SKILL.md` | names, descriptions, phase count |

Read each `SKILL.md` to capture:
- `name` and `description` frontmatter fields
- Number of phases defined in the body
- Whether `references/` files are cited explicitly

### 3. Analyze Naming Conventions

Extract patterns from existing skill names:

- Skill naming: verb-noun format? (e.g., `create-skill`, `init-agents`)
- Kebab-case uniformity across all skills

### 4. Identify Skill Gaps

Based on the inventory, identify what skill types are missing:

- Skill verbs present (create, improve, init, etc.) vs missing coverage
- Skill nouns present (skill, rule, hook, etc.) vs missing counterparts

## Output Format

Return your analysis in exactly this format:

```
## Artifact Analysis Results

### Project Type
- Type: [standalone | library | service]

### Existing Skills
| Name | Location | Phase Count |
|------|----------|-------------|
| [name] | [path] | [number] |

### Naming Conventions
- Skill naming pattern: [description]

### Skill Gaps
- [Description of missing skill types or "None identified"]
```

## Self-Verification

Before returning results:

1. Every skill listed actually exists in the codebase — verified by reading
2. Phase counts confirmed by reading SKILL.md body for `### Phase` headings
3. Output follows the exact format specified above
4. No improvement suggestions included — report only describes what exists
