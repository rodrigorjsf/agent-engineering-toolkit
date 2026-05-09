# Progressive Disclosure

**Summary**: An information architecture principle applied to LLM context management — load only what's needed for the current task, organized in tiers from always-loaded to on-demand to invoked, dramatically reducing token waste and improving agent focus.
**Sources**: a-guide-to-agents.md, Evaluating-AGENTS-paper.md, research-agent-workflows-and-patterns.md, research-context-engineering-comprehensive.md, progressive-disclosure-ai-agents.md
**Last updated**: 2026-05-01

---

Progressive disclosure is the single most impactful technique for managing agent configuration. The [[evaluating-agents-paper]] found that large, comprehensive configuration files *reduce* task success by ~3% while increasing costs by 20%+. Minimal, well-structured configurations outperform comprehensive ones.

## The Problem: Configuration Bloat

- Typical overgrown AGENTS.md: **600+ words, 9.7 sections** (AGENTBENCH data)
- All tokens in config files load on **every request**, regardless of relevance
- Frontier LLMs follow ~150–200 instructions consistently; beyond that, compliance degrades
- LLM-generated context files perform better when they are the **only** documentation (implies redundancy problem)

## Three Loading Tiers

| Tier          | Loaded When                         | Content                                                      | Budget                       |
| ------------- | ----------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| **Always**    | Every request                       | Project description, build commands, critical invariants     | 15–40 lines (root CLAUDE.md) |
| **On-demand** | When matching files are touched     | Language-specific rules, component patterns, API conventions | 10–30 lines per rule file    |
| **Invoked**   | Explicitly called or auto-triggered | Full workflow instructions, reference material, templates    | Up to 500 lines per skill    |

## Implementation by Platform

### Claude Code

- **Root CLAUDE.md** → Always loaded (target: 15–40 lines)
- **`.claude/rules/`** → Path-scoped rules with glob patterns; load only when matching files are read
- **Skills (SKILL.md)** → Invoked by name or auto-triggered by description match. Skill metadata (name + description) is the "Always" tier; `skillListingBudgetFraction` (default `0.01`) caps the total — exceeding ~15–25 skills causes silent description truncation and breaks auto-invocation. See [[skill-listing-budget]].
- **[[claude-code-subagents]]** → Isolated context windows, return only summaries

### Cursor IDE

- **`.cursor/rules/*.mdc`** → Four activation modes: Always Apply, Apply Intelligently, Apply to Specific Files (globs), Apply Manually
- **Skills** → Auto-discovered or manually invoked with `/skill-name`
- **[[cursor-subagents]]** → Foreground (blocking) or background (async) execution

## Ideal Target: The Minimal Config

The ideal AGENTS.md/CLAUDE.md is a **one-liner project description + package manager + build commands** (<10 tokens). Everything else belongs in scoped files:

```
This is a TypeScript React app. Use pnpm. Run tests with pnpm test.
```

Domain-specific rules go in separate files (e.g., `.claude/rules/typescript.md` with `paths: ["**/*.ts"]`).

## Monorepo Pattern

- Root config describes overall structure and shared conventions
- Package-level configs contain package-specific guidelines
- Agents navigate hierarchies efficiently without bloating the main prompt

## Evidence

The [[evaluating-agents-paper]] (ETH Zurich, 2026) measured:

- LLM-generated context: **−0.5% to −3%** success rate vs. no context, with **20–23% cost increase**
- Developer-provided context: **+4% average** success rate vs. no context
- Context files encourage broader exploration but don't improve direction-finding

## Phase-Based Loading

Rather than pre-loading all context for a task, phase-based loading exposes content dynamically as the task progresses through phases. This aligns context with the current phase of work rather than the entire anticipated task.

Four implementation patterns (source: progressive-disclosure-ai-agents.md):

1. **Index-first loading** — Load a lightweight table of contents first; fetch full sections only when a query matches. Prevents loading 50,000 tokens of documentation when only a 500-token section is relevant.
2. **Scout pattern** — A lightweight read-only subagent previews the task space and returns a summary; the main agent loads detail only for relevant areas.
3. **Phase-based loading** — Research phase loads broad context; implementation phase loads only the spec and relevant code; review phase loads test results. Each phase starts with a fresh, minimal context.
4. **Skill files without embedded references** — SKILL.md files contain only phase definitions and pointers; reference files are loaded on-demand by phase instruction, not bundled into the skill.

### Context Trigger System

A trigger system conditionalizes context loading:

1. **Condition detection** — Agent identifies which task phase or content type is active (e.g., "processing payment logic")
2. **Fetch** — Agent retrieves the matching reference file (e.g., `rules/payments.md`)
3. **Scoping** — Fetched content is marked as phase-local and removed after the phase completes

This allows a 50,000-token knowledge base to present as a ~2,000-token effective load per interaction.

## Related pages

- [[context-engineering]]
- [[context-rot]]
- [[skill-listing-budget]]
- [[evaluating-agents-paper]]
- [[agent-configuration-files]]
- [[claude-code-memory]]
- [[cursor-rules]]
- [[harness-engineering]]
- [[rpi-workflow]]
