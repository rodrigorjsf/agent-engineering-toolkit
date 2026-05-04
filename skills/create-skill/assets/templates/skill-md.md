---
name: [skill-name-kebab-case]
description: "[What this skill does and when to use it. Third person.]"
---
<!-- TEMPLATE: SKILL.md Entry Point
     Placement: .claude/skills/[skill-name]/SKILL.md or plugins/[plugin]/skills/[skill-name]/SKILL.md
     Rule: name ≤ 64 chars, lowercase letters/numbers/hyphens only
     Rule: description ≤ 1024 chars, third person, no XML tags
     Rule: Body under 500 lines
     Rule: Use references/ for evidence-based guidance
     Rule: Use assets/templates/ for output templates
     Rule: Progressive disclosure — load references per phase, not all upfront
     Rule: If analysis finds a monorepo or multi-service layout, generated phases must name the target service/workspace explicitly
-->

# [Skill Title]

[One-sentence purpose statement]

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- [Critical constraint 1]
- [Critical constraint 2]
</RULES>

## Process

### Preflight Check
<!-- CONDITIONAL: Check if artifact exists — redirect to improve if so -->

### Phase 1: [Analysis Phase Name]
<!-- Inline analysis steps go here -->

### Phase 2: [Generation Phase Name]
<!-- Read references, apply templates, and use project-relative paths/globs for the detected service/workspace -->

### Phase 3: Self-Validation
<!-- Read references/[type]-validation-criteria.md -->

### Phase 4: Present and Write
<!-- Show artifact with evidence citations, write on approval -->
