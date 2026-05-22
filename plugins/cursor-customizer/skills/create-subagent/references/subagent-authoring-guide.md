# Subagent Authoring Guide

Evidence-based guidance for creating effective Cursor subagent definitions.

---

## Contents

- When to use a subagent (vs skill, hook, rule)
- Subagent file structure and locations
- System prompt structure (effective patterns)
- Frontmatter posture (the four-key contract)
- Description field (the routing signal)
- Anti-patterns (Cursor-documented failures)
- Verification-agent pattern

---

## When to Use a Subagent

Subagents are for **isolated, specialized work** that should not pollute the parent agent's context window.

| Use a subagent when | Use a skill when |
|---------------------|------------------|
| Context isolation needed for long research | The task is single-purpose (generate, format, lint) |
| Running multiple workstreams in parallel | The task completes in one shot |
| The task needs specialized expertise across many steps | You don't need a separate context window |
| You want an independent verification of work | You want a quick, repeatable action |

If the task is single-purpose (generate a changelog, format imports), prefer a skill or slash command — a subagent is overkill.


---

## Subagent File Structure and Locations

A subagent is a Markdown file with YAML frontmatter stored in an agents directory.

| Scope | Location |
|-------|----------|
| Project subagent | `.cursor/agents/{name}.md` |
| Plugin-scoped subagent | `plugins/{plugin}/agents/{name}.md` |
| User subagent | `~/.cursor/agents/{name}.md` |

Project subagents take precedence over user subagents when names conflict.

The customizer generates into the project or plugin paths only.


---

## System Prompt Structure

Effective subagent system prompts follow this 5-part pattern:

1. **Role definition** — "You are a [specific role] specializing in [domain]."
2. **Constraints** — Explicit list of what the subagent does NOT do (no file modification, no scope drift, etc.).
3. **Process steps** — Numbered: read context → analyze → compile findings → return output.
4. **Output format** — Exact structure the subagent must return, with concrete header / table / section names.
5. **Self-verification** — A checklist the subagent runs before returning results.

Keep prompts focused. Each subagent should have a single clear responsibility — avoid generic "helper" agents.


---

## Frontmatter Posture (the Four-Key Contract)

Generated subagents use **exactly four** frontmatter keys: `name`, `description`, `model`, `readonly`. Nothing else.

```yaml
---
name: security-reviewer
description: "Security specialist. Use when implementing auth, payments, or handling sensitive data."
model: inherit
readonly: true
---
```

- `model: inherit` — the subagent runs on the same model as the parent agent. The customizer never embeds a literal model alias or a specific model ID.
- `readonly: true` — the subagent runs with restricted write permissions. Generated subagents are analysis and evaluator roles; they report findings, they don't mutate project state.

For full schema details and rejection rules, see `subagent-config-reference.md` and `subagent-validation-criteria.md`.


---

## Description Field (the Routing Signal)

The `description` field is the only signal Cursor's agent uses to decide whether to delegate to your subagent automatically.

- **Be specific.** Name the role and the trigger context.
- **Include a "Use when..." trigger phrase.** Examples: "Use when implementing authentication flows.", "Use after tasks are marked done.".
- **Use proactive trigger language sparingly.** Phrases like "use proactively" or "always use for" can encourage automatic delegation but should match a real, specific trigger.
- **Stay under 1024 characters.** Long descriptions dilute the routing signal.

Bad: "Helps with code." (too generic — Cursor cannot decide when to delegate)
Good: "Validates completed work. Use after tasks are marked done to confirm implementations are functional."


---

## Anti-Patterns

| Anti-Pattern | Consequence | Fix |
|--------------|-------------|-----|
| Vague description ("helps with code") | Cursor cannot decide when to delegate | Name the role and the trigger context |
| Too many subagents (50+ generic helpers) | Cursor wastes time choosing among them | Start with 2-3 focused subagents |
| 2,000-word system prompts | Slower runtime, harder to maintain | Be specific and direct |
| Subagent for a single-purpose task | Skill or slash command would be cheaper | Use a skill instead |
| Aggressive trigger language ("CRITICAL: MUST always...") | Overtriggering for unrelated requests | Use normal "Use when..." phrasing |
| Generic "you are a helpful AI" prompt | Defeats the purpose of a subagent | Define a specific role and process |
| Duplicating a slash-command capability | Adds complexity without benefit | Use the slash command directly |


---

## Verification-Agent Pattern

A common high-value subagent role: independently validate that work claimed as complete actually works.

```yaml
---
name: verifier
description: "Validates completed work. Use after tasks are marked done to confirm implementations are functional."
model: inherit
readonly: true
---

You are a skeptical validator. Your job is to verify that work claimed as complete actually works.

When invoked:
1. Identify what was claimed to be completed.
2. Check that the implementation exists and is functional.
3. Run relevant verification steps (read-only).
4. Look for edge cases that may have been missed.

Report:
- What was verified and passed.
- What was claimed but incomplete or broken.
- Specific issues that need to be addressed.

Do not accept claims at face value. Test everything you can without modifying state.
```

Useful for: validating end-to-end behavior before marking tickets complete; catching partially implemented functionality; ensuring tests actually pass (not just that test files exist).

