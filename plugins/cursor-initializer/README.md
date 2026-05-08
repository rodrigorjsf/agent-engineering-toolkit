# cursor-initializer

Evidence-based rules-first initializer and optimizer for Cursor projects. Generates and improves `.cursor/rules/*.mdc` hierarchies using Cursor-native subagent analysis.

## Cost and Model Guidance

This plugin analyzes your entire codebase before generating or improving configuration files.
Execution cost scales with project size and scope — a large or complex project can be expensive to run.

**Recommended model:** a frontier reasoning model delivers the best analysis quality for this workload.
**Viable alternative:** a frontier balanced model with high effort produces decent results at lower cost.

**Usage pattern:** run each skill once per project, or when the codebase has changed significantly.
Not on every session.

The long-term benefit is that every future agent session becomes cheaper and more accurate after
the generated files are in place. Treat the first execution as a one-time investment — not routine work.

## Why This Plugin Exists

### The Problem with Auto-Generated Config Files

Industry Research — the ETH Zurich study ["Evaluating context files"](https://github.com/rodrigorjsf/agent-engineering-toolkit/blob/development/docs/general-llm/Evaluating-AGENTS-paper.pdf) (February 2026) — evaluated multiple coding agents across hundreds of real-world tasks:

| Setting | Task Success Impact | Cost Impact |
|---------|---------------------|-------------|
| No config file | Baseline | Baseline |
| LLM-generated config file | **-3% success rate** | **+20% cost** |
| Developer-written minimal file | **+4% success rate** | +19% cost |

**Key findings:**

- Auto-generated files repeat what the model already knows, wasting attention budget
- Unnecessary instructions make tasks harder — agents follow them even when irrelevant
- Directory listings don't help agents navigate — they actively harm context quality
- Minimal, developer-written files slightly improve performance by capturing non-obvious tooling specifics

### The Rules-First Solution

This plugin generates a Cursor-native `.cursor/rules/*.mdc` hierarchy that mimics what an experienced developer would write. The key idea: `.cursor/rules/` supports four orthogonal activation modes that map cleanly to one-concern-per-rule, so each piece of guidance loads only when it is relevant.

| Activation mode | Purpose |
|-----------------|---------|
| `alwaysApply: true` | Critical tooling and project-wide constraints needed on every conversation |
| `globs: [...]` | Pattern-relative conventions auto-attached when matching files enter context |
| `description: "..."` | Cross-cutting / domain rules pulled in by the agent when the topic matches |
| Manual (`@`-mention) | Reference content the user invokes by name |

This deviates from listing AGENTS.md as a primary surface: the Cursor distribution treats AGENTS.md only as **legacy input** that the `improve-cursor` skill can migrate non-destructively into modular rules. The plugin never generates AGENTS.md.

> **Note:** Use `cursor-initializer` to bootstrap or improve a project's `.cursor/rules/` hierarchy. AGENTS.md migration is a sub-flow inside `improve-cursor` — it runs only when the target project already has AGENTS.md.

## Industry Research

Vendor-neutral research that informs this plugin's design:

- **[Evaluating context files (ETH Zurich, Feb 2026)](https://github.com/rodrigorjsf/agent-engineering-toolkit/blob/development/docs/general-llm/Evaluating-AGENTS-paper.pdf)** — rigorous study of context-file effectiveness across multiple coding agents.
- **[Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)** — context rot, attention budget, and just-in-time retrieval principles applicable across platforms.
- **[Lost in the Middle (TACL 2023)](https://arxiv.org/abs/2307.03172)** — models perform worst on information buried in the middle of long contexts; place critical instructions at the beginning and end of each rule.
- **[A Complete Guide to AGENTS.md](https://github.com/rodrigorjsf/agent-engineering-toolkit/blob/development/docs/general-llm/a-guide-to-agents.md)** — the rules-first design adopts this guide's progressive-disclosure principles while moving them into Cursor's activation-mode system.

## Cursor Official Documentation

- **[Cursor Rules](https://github.com/rodrigorjsf/agent-engineering-toolkit/tree/development/docs/cursor/rules/)** — defines `.mdc` format, activation modes, and scoping conventions.
- **[Cursor Subagents](https://github.com/rodrigorjsf/agent-engineering-toolkit/tree/development/docs/cursor/subagents/)** — documents Cursor's native subagent format and `readonly` behavior.

- **[Cursor Rules](https://github.com/rodrigorjsf/agent-engineering-toolkit/tree/development/docs/cursor/rules/)** — defines `.mdc` format, activation modes, and scoping conventions.
- **[Cursor Subagents](https://github.com/rodrigorjsf/agent-engineering-toolkit/tree/development/docs/cursor/subagents/)** — documents Cursor's native subagent format and `readonly` behavior.

## Architecture

### Cursor-Native Subagents

The plugin uses Cursor's native subagent format — read-only, inheriting model from parent context:

| Subagent | Role | Used By |
|----------|------|---------|
| `codebase-analyzer` | Detects tech stack, package manager, build / test commands, non-standard patterns | All skills |
| `rule-domain-detector` | Walks the four-tier rule decomposition heuristic and proposes one rule per justified domain | `init-cursor` |
| `file-evaluator` | Assesses existing `.mdc` quality and, when AGENTS.md is present, classifies its content blocks by destination activation mode | `improve-cursor` |

Each agent file follows Cursor's native subagent format:

```yaml
---
name: codebase-analyzer
description: "Analyze a project's technical characteristics — tech stack, tooling, build/test commands, non-standard patterns. Use when initializing or improving Cursor rules."
model: inherit
readonly: true
---
```

Key design decisions:

- **`model: inherit`** — Cursor agents inherit model from parent context; no separate model selection
- **`readonly: true`** — boolean flag; agents cannot write files

### Activation Modes for Generated Rules

The plugin selects exactly one activation mode per generated rule, sourced from `rule-domain-detector`'s structured output:

| Mode | When Used | Example |
|------|-----------|---------|
| `alwaysApply: true` | Core conventions relevant to all files | Project-wide non-default tooling |
| `globs: ["*.test.ts"]` | Pattern-specific conventions | Testing conventions |
| `description: "..."` | Topic-attractor reference content | Domain knowledge blocks |

## Skills

### `init-cursor`

Initialize an optimized `.cursor/rules/*.mdc` hierarchy for your project.

**What it does:**

1. Launches `codebase-analyzer` to detect tech stack and tooling
2. Launches `rule-domain-detector` to walk the four-tier decomposition heuristic — (tier 1) tooling-non-obvious → (tier 2) file-pattern → (tier 3) monorepo-scope → (tier 4) on-demand cross-cutting / domain
3. For each justified rule, generates one `.cursor/rules/*.mdc` file using the activation-mode-specific template
4. Presents all files for review before writing

**Preflight check:** If `.cursor/rules/` already has rules, redirects to `improve-cursor`.

**Empty-set outcome:** For trivial single-package projects with no non-obvious tooling, the canonical passing output is **zero rules** — the project's tooling is fully covered by the agent's defaults.

### `improve-cursor`

Evaluate and improve existing `.cursor/rules/*.mdc` files; non-destructively migrate legacy AGENTS.md when present.

**What it does:**

1. Launches `file-evaluator` to assess `.mdc` quality and (when AGENTS.md is present) classify its content blocks by destination activation mode
2. Generates an improvement plan (removals → refactoring → mode optimization → automation migrations → additions)
3. If AGENTS.md is present, runs the **Phase Migrate AGENTS.md** sub-flow: applies only the new rule creations, leaves the original AGENTS.md intact, and notifies the user explicitly that they must remove it manually after validation
4. Presents changes with token-savings metrics before applying

**Cursor-specific checks:**

- Invalid frontmatter fields (only `description`, `alwaysApply`, `globs` are valid)
- Activation-mode optimization (converting `alwaysApply: true` rules to `globs:`-mode auto-attachment)
- Bloat, staleness, and contradiction detection across rules
- AGENTS.md block classification is conditional — runs only when the target project has AGENTS.md

## Installation

### Cursor IDE (Native Plugin System)

For local development and testing, load this repository through Cursor's local plugin directory:

```bash
# Clone the repository
git clone https://github.com/rodrigorjsf/agent-engineering-toolkit.git ~/src/agent-engineering-toolkit

# Register as a local Cursor plugin marketplace
mkdir -p ~/.cursor/plugins/local
ln -s ~/src/agent-engineering-toolkit ~/.cursor/plugins/local/agent-engineering-toolkit
```

Then restart Cursor (or run **Developer: Reload Window**). The repo root `.cursor-plugin/marketplace.json` exposes the `cursor-initializer` plugin.

## Usage

```bash
# Initialize Cursor rules from scratch
/cursor-initializer:init-cursor      # Generate .cursor/rules/*.mdc hierarchy

# Improve existing Cursor configuration
/cursor-initializer:improve-cursor   # Evaluate and optimize existing rules; migrate AGENTS.md non-destructively if present
```

## Anti-Patterns This Plugin Avoids

| Anti-Pattern | Evidence | What We Do Instead |
|--------------|----------|--------------------|
| One giant `alwaysApply: true` rule | Industry Research (ETH): -3% success, +20% cost | Per-domain rules with appropriate activation modes |
| Codebase overview in rules | Industry Research: "not effective at providing repository overview" | Omit entirely |
| `alwaysApply: true` for pattern-specific conventions | Wastes context on every file regardless of relevance | Convert to `globs:`-mode activation |
| Generating monolithic legacy context files | Reintroduces ball-of-mud growth | Decompose into one-concern-per-rule with activation modes |
| Loading everything upfront | Industry Research: "context rot" — attention degrades with token count | Maximize on-demand activation |
| Vague instructions | Industry Research: "Write clean code" is not actionable | Every instruction is specific and verifiable |

## Repository Structure

```
plugins/cursor-initializer/
├── .cursor-plugin/
│   └── plugin.json              # Plugin manifest (name, version, description)
├── skills/
│   ├── init-cursor/
│   │   ├── SKILL.md             # Delegates to codebase-analyzer + rule-domain-detector
│   │   ├── references/          # Evidence-based guidance files
│   │   └── assets/templates/    # Three activation-mode .mdc templates
│   └── improve-cursor/
│       ├── SKILL.md             # Delegates to file-evaluator
│       ├── references/
│       └── assets/templates/
└── agents/
    ├── codebase-analyzer.md     # Tech stack and tooling detection (Cursor-native format)
    ├── rule-domain-detector.md  # Four-tier rule decomposition
    └── file-evaluator.md        # .mdc quality + AGENTS.md block classification
```

## License

MIT
