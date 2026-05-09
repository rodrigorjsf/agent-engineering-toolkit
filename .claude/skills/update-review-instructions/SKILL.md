---
name: update-review-instructions
description: 'Generate/update GitHub Copilot review instructions in `.github/instructions/` from `.claude/rules/` and skill structures. Stays under 4K char limit.'
---

# Update Review Instructions

Generate or update `.github/instructions/*.instructions.md` files that guide GitHub Copilot code review for this project. Each file targets a specific project scope with review guidelines derived from the project's own documented conventions.

## Why This Matters

GitHub Copilot code review reads instruction files from the PR's base branch. Without project-specific instructions, reviews miss convention violations unique to this codebase (cross-distribution parity, progressive disclosure compliance, agent delegation patterns). Each instruction file has a hard 4,000 character limit for code review.

## Hard Rules

<RULES>
- **NEVER** exceed 4,000 characters per instruction file (GitHub Copilot code review hard limit)
- **ALWAYS** include YAML frontmatter with `applyTo` glob pattern
- **ALWAYS** derive review guidelines from the project's own convention sources
- **NEVER** include vague quality directives ("be more accurate", "ensure quality")
- **NEVER** reference external URLs in instructions (Copilot does not follow links)
- **EVERY** guideline must be specific, actionable, and verifiable in a code review
- **PRIORITIZE** highest-impact rules first (critical → high → medium) — lost-in-the-middle effect applies
</RULES>

## Process

### Scope Selection

Present the user with available scopes. Read `${CLAUDE_SKILL_DIR}/references/scope-registry.md` for the complete scope registry.

Display the scopes as a numbered list and ask the user to select one or more. If the user names a scope not in the registry, analyze the project to determine appropriate `applyTo` patterns and convention sources for the custom scope.

### Phase 1: Convention Extraction

For the selected scope, gather all applicable conventions:

1. **Read `.claude/rules/` files** whose `paths:` patterns overlap with the scope's `applyTo` pattern
2. **Read `DESIGN-GUIDELINES.md`** sections relevant to the scope's artifact type
3. **Read `plugins/agents-initializer/CLAUDE.md`** for plugin-specific conventions (if scope touches plugin paths)
4. **Read existing instruction file** (if updating) to identify what's already covered
5. **Scan actual files** matching the scope pattern to identify real conventions not yet documented

Compile a deduplicated list of conventions with their sources.

### Phase 2: Instruction Drafting

Read `${CLAUDE_SKILL_DIR}/references/instruction-writing-guide.md` for format and quality standards.

Draft the instruction file following these principles:

1. **YAML frontmatter first**: `applyTo` with the scope's glob pattern
2. **Title**: `# {Scope Name} Review Guidelines`
3. **Group by concern**: Use `##` headings for each review concern area
4. **Imperative directives**: "Flag any...", "Check for...", "Verify that..."
5. **Concrete examples**: Include code snippets showing correct AND incorrect patterns when helpful
6. **Priority ordering**: Critical rules first, nice-to-haves last
7. **Common Issues section**: End with a bullet list of the most likely defects

### Phase 3: Budget Validation

Measure the character count of the drafted file:

```bash
wc -c < .github/instructions/{scope}.instructions.md
```

If over 4,000 characters:
1. Remove the lowest-priority items
2. Compress verbose explanations into terse directives
3. Remove examples if the directive is clear without them
4. Re-measure until under 4,000 characters

If under 2,000 characters, consider whether important conventions were missed in Phase 1.

### Phase 4: Present and Apply

1. Show the complete instruction file content
2. Highlight what changed (if updating an existing file)
3. Show character count and remaining budget
4. Apply after user confirmation

If creating a new scope, also update `${CLAUDE_SKILL_DIR}/references/scope-registry.md` to include the new scope.
