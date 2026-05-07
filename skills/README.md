# Standalone Skills

Portable agent configuration skills for `npx skills add` and manual installation. Works with Claude Code, VS Code Copilot, Cursor, Windsurf, and any AI coding tool that supports the Agent Skills standard. All analysis is performed inline — no subagent delegation required.

## Cost and Model Guidance

These skills analyze your entire codebase before generating or improving configuration files.
Execution cost scales with project size and scope — a large or complex project can be expensive to run.

**Recommended model:** Claude Opus delivers the best analysis quality for this workload.
**Viable alternative:** Claude Sonnet with High effort produces decent results at lower cost.

**Usage pattern:** run each skill once per project, or when the codebase has changed significantly.
Not on every session.

The long-term benefit is that every future agent session becomes cheaper and more accurate after
the generated files are in place. Treat the first execution as a one-time investment — not routine work.

## Why This Distribution Exists

### The Problem with Auto-Generated Config Files

The ETH Zurich study ["Evaluating AGENTS.md"](https://github.com/rodrigorjsf/agent-engineering-toolkit/blob/development/docs/general-llm/Evaluating-AGENTS-paper.pdf) (February 2026) evaluated multiple coding agents across hundreds of real-world tasks:

| Setting | Task Success Impact | Cost Impact |
|---------|-------------------|-------------|
| No config file | Baseline | Baseline |
| LLM-generated config file | **-3% success rate** | **+20% cost** |
| Developer-written minimal file | **+4% success rate** | +19% cost |

**Key findings:**

- Auto-generated files repeat what the model already knows, wasting attention budget
- Unnecessary instructions make tasks harder — agents follow them even when irrelevant
- Directory listings don't help agents navigate — they actively harm context quality
- Minimal, developer-written files slightly improve performance by capturing non-obvious tooling specifics

### The Evidence-Based Solution

These skills generate files that mimic what an experienced developer would write:

1. **Minimal root file** (15–40 lines) — one-sentence description, package manager, build commands
2. **Per-scope files** (10–30 lines) — only for genuinely distinct contexts (monorepo packages, services)
3. **Domain files** (`docs/TESTING.md`, `docs/BUILD.md`) — only when non-standard patterns are detected
4. **Hard limit: 200 lines per file** — per Anthropic's recommendation

> **Scope note:** This distribution includes `init-agents`, `init-claude`, `improve-agents`, `improve-claude`, plus `create-skill` and `improve-skill`. Path-scoped rule, hook, and subagent authoring are platform-specific and live exclusively in the matching plugin distributions (`agent-customizer` for Claude, `cursor-customizer` for Cursor) — see ADR-0006.

## Documentation Base

### Academic Research

- **[Evaluating AGENTS study](https://github.com/rodrigorjsf/agent-engineering-toolkit/blob/development/docs/general-llm/Evaluating-AGENTS-paper.pdf)** (ETH Zurich, Feb 2026) — Rigorous study of context file effectiveness across multiple coding agents.

### Anthropic Official Documentation

- **[Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)** — Defines "context rot" and the attention budget concept.
- **[CLAUDE.md Memory Documentation](https://docs.anthropic.com/en/docs/claude-code/memory)** — Recommends under 200 lines per file. Describes the hierarchical configuration system.
- **[Best Practices](https://docs.anthropic.com/en/docs/claude-code/best-practices)** — *"If Claude already does something correctly without the instruction, delete it."*
- **[Lost in the Middle](https://arxiv.org/abs/2307.03172)** (TACL 2023) — Models perform worst on information buried in the middle of long contexts.

### Practitioner Guides

- **[A Complete Guide to AGENTS.md](https://github.com/rodrigorjsf/agent-engineering-toolkit/blob/development/docs/general-llm/a-guide-to-agents.md)** — Progressive disclosure patterns, monorepo support, domain files.

## Architecture

### Inline Analysis

Unlike the Claude Code plugin (`agents-initializer`) which delegates analysis to isolated subagents, these standalone skills perform all codebase analysis inline using direct file reads and bash commands. This makes them compatible with any AI tool — no plugin system or subagent support required.

The generated output is identical in quality and structure to the plugin distributions. The difference is only in execution mechanism:

| Distribution | Analysis Method | Platform Requirement |
|---|---|---|
| `plugins/agents-initializer/` | Subagent delegation | Claude Code plugin system |
| `skills/` (this directory) | Inline bash analysis | Any AI coding tool |

## Skills

### `init-agents`

Initialize an optimized AGENTS.md file hierarchy for your project.

**What it does:**

1. Analyzes your tech stack and tooling inline (no subagent delegation)
2. Identifies distinct project contexts and scopes
3. Generates minimal per-scope AGENTS.md files with progressive disclosure pointers
4. Presents all files for review before writing

**Preflight check:** If `AGENTS.md` already exists, redirects to `improve-agents`.

**What it generates:**

- Root `AGENTS.md` — project essentials only
- Subdirectory `AGENTS.md` files — one per detected scope
- Domain files (`docs/TESTING.md`, `docs/BUILD.md`) — only when non-standard patterns exist

### `init-claude`

Initialize an optimized CLAUDE.md hierarchy with `.claude/rules/` for your project.

**Same as `init-agents` but also:**

- Generates `.claude/rules/*.md` path-scoped rules for file-pattern-specific conventions
- Leverages Claude Code's on-demand loading for subdirectory CLAUDE.md files
- Maximizes on-demand loading, minimizes always-loaded content

**Preflight check:** If `CLAUDE.md` already exists, redirects to `improve-claude`.

### `improve-agents`

Evaluate and improve existing AGENTS.md files.

**What it checks:**

- Files over 200 lines
- Bloat indicators (directory listings, obvious conventions, vague instructions)
- Stale references (paths that don't exist, commands not in package.json)
- Contradictions between files
- Missing scope-specific files and progressive disclosure opportunities

### `improve-claude`

Evaluate and improve existing CLAUDE.md files and `.claude/rules/`.

**Same as `improve-agents` but also:**

- Evaluates `.claude/rules/` files for missing path-scoping
- Converts pattern-specific rules from CLAUDE.md to path-scoped `.claude/rules/`
- Reports always-loaded vs on-demand token distribution

## Installation

### npx skills add

```bash
# Install all skills globally (available in all projects)
npx skills add rodrigorjsf/agent-engineering-toolkit -g

# Install all skills for the current project only
npx skills add rodrigorjsf/agent-engineering-toolkit

# Install for specific AI tools
npx skills add rodrigorjsf/agent-engineering-toolkit --agent cursor copilot

# Install only specific skills
npx skills add rodrigorjsf/agent-engineering-toolkit --skill init-claude improve-claude

# List available skills before installing
npx skills add rodrigorjsf/agent-engineering-toolkit --list
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/rodrigorjsf/agent-engineering-toolkit.git /tmp/agent-engineering-toolkit

# For Claude Code (project-level)
mkdir -p .claude/skills
cp -r /tmp/agent-engineering-toolkit/skills/* .claude/skills/

# For Claude Code (user-level, all projects)
cp -r /tmp/agent-engineering-toolkit/skills/* ~/.claude/skills/

# For VS Code / GitHub Copilot
mkdir -p .agents/skills
cp -r /tmp/agent-engineering-toolkit/skills/* .agents/skills/

# Clean up
rm -rf /tmp/agent-engineering-toolkit
```

For the native Claude Code and Cursor plugin distributions, use the plugin installation flows in their respective READMEs instead of copying `plugins/*/skills/` manually — the plugin variants depend on their surrounding plugin layout (agents, manifests, and namespacing).

## Usage

```bash
# Without namespace (user-scope install or manual copy)
/init-agents          # Initialize AGENTS.md hierarchy
/init-claude          # Initialize CLAUDE.md + .claude/rules/ hierarchy
/improve-agents       # Improve existing AGENTS.md files
/improve-claude       # Improve existing CLAUDE.md + rules
```

## Anti-Patterns This Plugin Avoids

| Anti-Pattern | Evidence | What We Do Instead |
|--------------|----------|-------------------|
| One giant comprehensive file | ETH paper: -3% success, +20% cost | Hierarchical progressive disclosure |
| Codebase overview sections | ETH paper: "not effective at providing repository overview" | Omit entirely |
| Directory/file structure listings | Guide: "File paths change constantly... actively poisons context" | Describe capabilities, not structure |
| Standard language conventions | Anthropic: "If Claude already does it correctly, delete it" | Only non-obvious tooling |
| Loading everything upfront | Anthropic: "Context rot" — attention degrades with token count | Maximize on-demand loading |
| Vague instructions | Guide: "Write clean code" is not actionable | Every instruction is specific and verifiable |

## Repository Structure

```
skills/
├── init-agents/
│   ├── SKILL.md             # Inline analysis, no subagent delegation
│   ├── references/          # Evidence-based guidance files
│   └── assets/templates/    # Output templates
├── init-claude/
│   ├── SKILL.md
│   ├── references/
│   └── assets/templates/
├── improve-agents/
│   ├── SKILL.md
│   ├── references/
│   └── assets/templates/
├── improve-claude/
│   ├── SKILL.md
│   ├── references/
│   └── assets/templates/
├── create-skill/            # Agent-customizer standalone variant
└── improve-skill/
```

## License

MIT
