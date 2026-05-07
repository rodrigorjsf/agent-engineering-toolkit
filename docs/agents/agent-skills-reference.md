Detailed reference for [.github/instructions/agent-skills.instructions.md](../../.github/instructions/agent-skills.instructions.md). Core file holds the authoritative checklist; this file holds the supporting depth.

# Agent Skills — Deep Reference

## What Are Agent Skills?

Agent Skills are self-contained folders with instructions and bundled resources that teach AI agents specialized capabilities. Unlike custom instructions (which define coding standards), skills enable task-specific workflows including scripts, templates, and reference data.

Key characteristics:
- **Portable:** Works across VS Code, Copilot CLI, and Copilot coding agent
- **Progressive loading:** Only loaded when relevant to the user's request
- **Resource-bundled:** Can include scripts, templates, examples alongside instructions
- **On-demand:** Activated automatically based on prompt relevance

## Directory Locations

| Location | Scope | Recommendation |
|----------|-------|----------------|
| `.github/skills/<skill-name>/` | Project/repository | Recommended |
| `.claude/skills/<skill-name>/` | Project/repository | Legacy, backward compat |
| `~/.github/skills/<skill-name>/` | Personal (user-wide) | Recommended |
| `~/.claude/skills/<skill-name>/` | Personal (user-wide) | Legacy |

Each skill must have its own subdirectory containing at minimum a `SKILL.md` file.

## Frontmatter Example

```yaml
---
name: webapp-testing
description: 'Toolkit for testing local web applications using Playwright. Use when asked to verify frontend functionality, debug UI behavior, capture browser screenshots, check for visual regressions, or view browser console logs. Supports Chrome, Firefox, and WebKit browsers.'
license: Complete terms in LICENSE.txt
---
```

## Writing High-Impact Descriptions

The `description` field is the PRIMARY mechanism for automatic skill discovery. Copilot reads ONLY `name` and `description` to decide whether to load a skill.

**Good description** (includes WHAT, WHEN, KEYWORDS):
```yaml
description: 'Toolkit for testing local web applications using Playwright. Use when asked
to verify frontend functionality, debug UI behavior, capture browser screenshots, check
for visual regressions, or view browser console logs. Supports Chrome, Firefox, WebKit.'
```

**Poor description** (fails discovery):
```yaml
description: 'Web testing helpers'
```
Fails because: no triggers, no keywords, no capabilities.

All skill descriptions share a limited portion of the available context window during discovery. Your description competes with every other installed skill for Copilot's attention. Keep descriptions concise and keyword-dense.

## Writing Each Body Section

### `## When to Use This Skill`

A bullet list of concrete scenarios that reinforce the description triggers:

```markdown
## When to Use This Skill

- User asks to test a web application in a browser
- User needs screenshots for visual regression testing
- User wants to debug frontend behavior with browser console logs
```

### `## Prerequisites`

Only include if the skill requires tools or config Copilot cannot assume are present. Include exact install commands:

```markdown
## Prerequisites

- [Playwright](https://playwright.dev/) installed: `npm install -D @playwright/test`
- Browser engine: `npx playwright install chromium`
```

### `## Step-by-Step Workflows`

Use numbered steps only for repeatable procedures where sequence matters. Steps should describe WHAT to accomplish, not hardcoded file paths — steps must be adaptable to different project structures:

```markdown
## Step-by-Step Workflows

### Deploy to Staging

1. Build the project: `npm run build`
2. Run pre-deploy validation: `npm run validate`
3. Deploy to staging: `npm run deploy -- --env staging`
4. Verify the health endpoint returns 200
```

For complex workflows (>5 steps), split into `references/` files and link to them.

**Flexible guidelines (prefer over rigid steps):**

```markdown
# Too rigid
1. Open the file at src/api/handlers.ts
2. Find the function named processOrder
3. Add a try-catch block around lines 45-60

# Flexible (better)
When fixing error handling in API handlers:
- Ensure all database operations have proper error handling
- Use the project's ErrorHandler utility (see ./references/error-handling.md)
- Log errors with enough context to debug in production
```

### `## Gotchas`

Proactive warnings that prevent mistakes before they happen. This is the highest-signal section.

```markdown
## Gotchas

- **Never** call `billing.charge()` without checking `user.hasPaymentMethod` first —
  the SDK throws an unrecoverable error instead of returning a failure.
- The `currency` field expects ISO 4217 codes, not display names.
  Copilot often writes "dollars" instead of "USD".
```

Bold the key constraint; explain why. Treat as a living section: every time Copilot produces a wrong result, add a gotcha.

### `## Troubleshooting`

Reactive fixes for known issues. Present as symptom → solution pairs:

```markdown
## Troubleshooting

| Issue | Solution |
|-------|----------|
| Plugin won't connect | Check servers running (`npm run start:all`) |
| Browser blocks localhost | Allow local network access or try different browser |
| Tool execution times out | Ensure plugin UI is open and shows "Connected" |
```

### `## References`

Links to bundled `references/` files using relative paths:

```markdown
## References

- [API Reference](./references/api_reference.md)
- [Workflow Setup](./references/workflow-setup.md)
```

## Bundled Resources — Deep Detail

### Directory Structure

```
.github/skills/my-skill/
├── SKILL.md              # Required: Main instructions
├── LICENSE.txt           # Recommended: Apache 2.0 typical
├── scripts/              # Executable automation
│   ├── helper.py
│   └── helper.ps1
├── references/           # Documentation loaded into context
│   ├── api_reference.md
│   └── workflow-setup.md
├── assets/               # Static files used AS-IS in output
│   ├── baseline.png
│   └── report-template.html
└── templates/            # Starter code the AI agent modifies
    ├── scaffold.py
    └── config.template
```

### Assets vs Templates

**Assets** — static resources consumed unchanged:
- `logo.png` embedded into a generated document
- `report-template.html` copied as output format
- `custom-font.ttf` applied to text rendering

**Templates** — starter code the AI agent actively modifies:
- `scaffold.py` where the AI inserts logic
- `config.template` where the AI fills in values
- `hello-world/` directory the AI extends with new features

Rule: if the AI reads and builds upon the file → `templates/`. If the file is used AS-IS → `assets/`.

### Referencing Resources

Use relative paths in SKILL.md:

```markdown
Run the [helper script](./scripts/helper.py) to automate common tasks.
See [API reference](./references/api_reference.md) for documentation.
Use the [scaffold](./templates/scaffold.py) as a starting point.
```

### LICENSE.txt

Download the Apache 2.0 license text from https://www.apache.org/licenses/LICENSE-2.0.txt and save as `LICENSE.txt`. Update the copyright year and owner in the appendix section.

### When to Bundle Scripts

Bundle scripts when:
- The same code would be rewritten repeatedly by the agent
- Deterministic reliability is critical (file manipulation, API calls)
- Complex logic benefits from pre-testing rather than generation each time
- The operation has a self-contained purpose that can evolve independently
- Testability matters — scripts can be unit tested and validated

### Script Language Selection

| Language | Use Case |
|----------|----------|
| Python | Complex automation, data processing |
| PowerShell Core | Cross-platform Windows/Linux scripting |
| Node.js | JavaScript-based tooling |
| Bash/Shell | Simple automation tasks |

## Progressive Loading Architecture

| Level | What Loads | When |
|-------|------------|------|
| 1. Discovery | `name` and `description` only | Always (lightweight) |
| 2. Instructions | Full `SKILL.md` body | When request matches description |
| 3. Resources | Scripts, examples, docs | Only when Copilot references them |

Install many skills without consuming context; only relevant content loads per task.

## Common Patterns

### Parameter Table Pattern

```markdown
| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--input` | Yes | - | Input file or URL to process |
| `--action` | Yes | - | Action to perform |
| `--verbose` | No | `false` | Enable verbose output |
```

### Workflow Execution Pattern with TODO

Create a TODO list when executing multi-step workflows for traceability:

```markdown
## TODO
- [ ] Step 1: Configure environment — see [workflow-setup.md](./references/workflow-setup.md#environment)
- [ ] Step 2: Build project — see [workflow-setup.md](./references/workflow-setup.md#build)
- [ ] Step 3: Deploy to staging — see [workflow-deployment.md](./references/workflow-deployment.md#staging)
- [ ] Step 4: Run validation — see [workflow-deployment.md](./references/workflow-deployment.md#validation)
```

This allows resuming workflows if interrupted.

### Progressive Disclosure for Large Skills

If SKILL.md exceeds ~200 lines, split detailed content into subdirectories:

```markdown
## Reference Files

- `references/api.md` — complete function signatures and return types
- `references/error-codes.md` — every error code this service can return
- `scripts/validate.sh` — run this after changes to verify correctness

Read these files as needed. Do not read them all upfront.
```

## Related Resources

- [Agent Skills Specification](https://agentskills.io/)
- [VS Code Agent Skills Documentation](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [Awesome Copilot Skills](https://github.com/github/awesome-copilot/blob/main/docs/README.skills.md)
