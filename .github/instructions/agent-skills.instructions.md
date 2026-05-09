---
description: 'Guidelines for creating high-quality Agent Skills for GitHub Copilot'
applyTo: '**/skills/**/SKILL.md'
---

# Agent Skills File Guidelines

## Frontmatter (Required)

Every `SKILL.md` must open with YAML frontmatter:

```yaml
---
name: webapp-testing
description: 'Toolkit for testing local web applications using Playwright. Use when asked to verify frontend functionality, debug UI behavior, or capture browser screenshots. Supports Chrome, Firefox, and WebKit.'
---
```

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | Lowercase, hyphens, max 64 characters |
| `description` | Yes | 10–1024 chars (upstream); project ceiling ≤ 200 chars, target 110–150; exceptions > 200 require `description-budget-exception:` field (hard cap 400). See ADR-0007. |
| `license` | No | SPDX identifier or reference to `LICENSE.txt` |

## Description Rules (Critical)

Copilot reads ONLY `name` and `description` during discovery. A vague description means the skill is never loaded.

- Include **WHAT** it does (capabilities), **WHEN** to use it (triggers/scenarios), and **KEYWORDS** users would type.
- Be concise and keyword-dense — verbose descriptions waste shared context budget.
- Bad: `'Web testing helpers'` — no triggers, no keywords.

## Body Structure

Recommended sections (skip irrelevant ones):

- `## When to Use This Skill` — bullet list of concrete scenarios
- `## Prerequisites` — only if external tools/config are required; include exact install commands
- `## Step-by-Step Workflows` — numbered steps for repeatable procedures where sequence matters
- `## Gotchas` — proactive warnings about non-obvious behavior, API quirks, common traps (bold the constraint; explain why)
- `## Troubleshooting` — symptom → solution table for known issues
- `## References` — relative links to bundled `references/` files or external docs

## Body Content Rules

- Teach only what Copilot would NOT know from training data — skip standard language syntax and well-documented APIs.
- Use imperative mood: "Run", "Create", "Configure".
- Keep body under 500 lines; split detailed content into `references/` files at ~200 lines.
- Large workflows (>5 steps): move to `references/` subdirectory and link from SKILL.md.
- For open-ended tasks, provide decision criteria — not rigid numbered steps.

## Bundled Resources

| Folder | Purpose | AI modifies? |
|--------|---------|-------------|
| `references/` | Docs the AI reads to inform decisions | Reads only |
| `templates/` | Starter code the AI actively modifies | Yes |
| `assets/` | Static files used AS-IS in output | No |
| `scripts/` | Executable automation | Executes only |

- `references/` and `templates/` are loaded into context when referenced; `assets/` is not.
- Use relative paths for all resource references: `./references/api_reference.md`.
- Scripts: use cross-platform languages (Python, PowerShell Core, Node.js); include `--help` documentation; handle errors gracefully; never store credentials; document network operations.

## Security

- Scripts rely on existing credential helpers — no credential storage in skill files.
- Use `--force` flags only for destructive operations; warn before irreversible actions.

## Validation Checklist

- [ ] Frontmatter has valid `name` (lowercase, hyphens, ≤64 chars) and `description`
- [ ] Description states WHAT, WHEN, and relevant KEYWORDS; concise
- [ ] Body teaches content Copilot would not know from training data
- [ ] `## Gotchas` section present when skill involves non-obvious behavior or API quirks
- [ ] Body under 500 lines; complex workflows split into `references/`
- [ ] Scripts include help documentation and error handling
- [ ] All resource paths are relative; no absolute paths
- [ ] No hardcoded credentials or secrets

For deep guidance, see [docs/agents/agent-skills-reference.md](../../docs/agents/agent-skills-reference.md).
