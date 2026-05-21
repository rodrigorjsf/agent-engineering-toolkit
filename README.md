# Agent Engineering Toolkit

A multi-plugin marketplace providing evidence-based agent artifact engineering. Instead of auto-generating one bloated configuration file, this toolkit creates **minimal, scoped files** following progressive disclosure principles — proven by research to outperform comprehensive auto-generated configurations. Ships as Claude Code and Cursor distributions — each an Initializer/Customizer pair — plus a standalone distribution compatible with any AI coding tool.

## Cost and Model Guidance

These plugins analyze your entire codebase before generating or improving configuration files.
Execution cost scales with project size and scope — a large or complex project can be expensive to run.

**Recommended model:** Claude Opus delivers the best analysis quality for this workload.
**Viable alternative:** Claude Sonnet with High effort produces decent results at lower cost.

**Usage pattern:** run each skill once per project, or when the codebase has changed significantly.
Not on every session.

The long-term benefit is that every future agent session becomes cheaper and more accurate after
the generated files are in place. Treat the first execution as a one-time investment — not routine work.

## Distributions

| Distribution | Platform | Install Path | Full Documentation |
|---|---|---|---|
| `agents-initializer` | Claude Code | Native plugin system | [plugins/agents-initializer/README.md](plugins/agents-initializer/README.md) |
| `agent-customizer` | Claude Code | Native plugin system | [plugins/agent-customizer/README.md](plugins/agent-customizer/README.md) |
| `orchestrate` | Claude Code | Native plugin system | [plugins/orchestrate/README.md](plugins/orchestrate/README.md) |
| `cursor-initializer` | Cursor IDE | Native plugin system | [plugins/cursor-initializer/README.md](plugins/cursor-initializer/README.md) |
| `cursor-customizer` | Cursor IDE | Native plugin system | [plugins/cursor-customizer/README.md](plugins/cursor-customizer/README.md) |
| Standalone | Any AI tool | `npx skills add` / manual | [skills/README.md](skills/README.md) |

## Research Foundation

### Academic Research

- **[Evaluating AGENTS study](docs/general-llm/Evaluating-AGENTS-paper.pdf)** (ETH Zurich, Feb 2026) — The first rigorous study of context file effectiveness. LLM-generated files reduce performance by 3%; developer-written minimal files improve it by 4%.

### Anthropic Official Documentation

- **[Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)** — Defines "context rot" and the attention budget concept.
- **[CLAUDE.md Memory Documentation](https://docs.anthropic.com/en/docs/claude-code/memory)** — Recommends under 200 lines per file.
- **[Best Practices](https://docs.anthropic.com/en/docs/claude-code/best-practices)** — *"If Claude already does something correctly without the instruction, delete it."*
- **[Lost in the Middle](https://arxiv.org/abs/2307.03172)** (TACL 2023) — Models perform worst on information buried in the middle of long contexts.

### Practitioner Guides

- **[A Complete Guide to AGENTS.md](docs/general-llm/a-guide-to-agents.md)** — Progressive disclosure patterns, monorepo support, domain files.

For a full evidence-to-implementation mapping, see **[DESIGN-GUIDELINES.md](DESIGN-GUIDELINES.md)**.

## Installation

### Claude Code — agents-initializer

```bash
/plugin marketplace add rodrigorjsf/agent-engineering-toolkit
/plugin install agents-initializer@agent-engineering-toolkit
```

→ See [plugins/agents-initializer/README.md](plugins/agents-initializer/README.md) for scope flags and full options.

### Claude Code — agent-customizer

```bash
/plugin marketplace add rodrigorjsf/agent-engineering-toolkit
/plugin install agent-customizer@agent-engineering-toolkit
```

→ See [plugins/agent-customizer/README.md](plugins/agent-customizer/README.md) for scope flags and full options.

### Claude Code — orchestrate

```bash
/plugin marketplace add rodrigorjsf/agent-engineering-toolkit
/plugin install orchestrate@agent-engineering-toolkit
```

→ See [plugins/orchestrate/README.md](plugins/orchestrate/README.md) for prerequisites and the configuration reference.

### Cursor IDE — cursor-initializer

```bash
git clone https://github.com/rodrigorjsf/agent-engineering-toolkit.git ~/src/agent-engineering-toolkit
mkdir -p ~/.cursor/plugins/local
ln -s ~/src/agent-engineering-toolkit ~/.cursor/plugins/local/agent-engineering-toolkit
```

→ See [plugins/cursor-initializer/README.md](plugins/cursor-initializer/README.md) for full setup instructions.

### Cursor IDE — cursor-customizer

```bash
git clone https://github.com/rodrigorjsf/agent-engineering-toolkit.git ~/src/agent-engineering-toolkit
mkdir -p ~/.cursor/plugins/local
ln -s ~/src/agent-engineering-toolkit ~/.cursor/plugins/local/agent-engineering-toolkit
```

→ See [plugins/cursor-customizer/README.md](plugins/cursor-customizer/README.md) for full setup instructions.

### npx skills add — Standalone

```bash
npx skills add rodrigorjsf/agent-engineering-toolkit -g
```

→ See [skills/README.md](skills/README.md) for per-tool install options and manual installation.

## Repository Structure

```text
agent-engineering-toolkit/
├── .claude-plugin/
│   └── marketplace.json             # Marketplace catalog (Claude Code plugin system)
├── .cursor-plugin/
│   └── marketplace.json             # Marketplace catalog (Cursor plugin system)
├── plugins/
│   ├── agents-initializer/          # Claude Code plugin — AGENTS.md and CLAUDE.md init/improve
│   │   ├── .claude-plugin/plugin.json
│   │   ├── README.md                # Full plugin documentation
│   │   ├── skills/                  # 4 skills: init-agents, init-claude, improve-agents, improve-claude
│   │   └── agents/                  # 3 subagents: codebase-analyzer, scope-detector, file-evaluator
│   ├── cursor-initializer/          # Cursor IDE plugin — rules-first .cursor/rules/*.mdc init/improve (legacy AGENTS.md migration only)
│   │   ├── .cursor-plugin/plugin.json
│   │   ├── README.md                # Full plugin documentation
│   │   ├── skills/                  # 2 skills: init-cursor, improve-cursor
│   │   └── agents/                  # 3 subagents (Cursor-native format)
│   ├── cursor-customizer/           # Cursor IDE plugin — single-artifact CRUD (rules, hooks, skills, subagents)
│   │   ├── .cursor-plugin/plugin.json
│   │   ├── README.md                # Full plugin documentation
│   │   ├── docs-drift-manifest.md   # Registry: reference files → source docs
│   │   ├── agents/                  # artifact-analyzer + per-type evaluators (Cursor-native format)
│   │   └── skills/                  # 8 skills: create-{type} and improve-{type}
│   ├── agent-customizer/            # Claude Code plugin — artifact creation and improvement
│   │   ├── .claude-plugin/plugin.json
│   │   ├── README.md                # Full plugin documentation
│   │   ├── docs-drift-manifest.md   # Registry: reference files → 12 source docs
│   │   ├── agents/                  # 6 subagents: artifact-analyzer, evaluators, drift-checker
│   │   └── skills/                  # 8 skills: create-{type} and improve-{type}
│   └── orchestrate/                 # Claude Code plugin — autonomous backlog orchestration
│       ├── .claude-plugin/plugin.json
│       ├── .mcp.json                # Registers the orchestrate-mcp server
│       ├── README.md                # Full plugin documentation
│       ├── hooks/                   # context-watchdog PostToolUse hook
│       ├── skills/                  # 1 skill: orchestrate
│       ├── agents/                  # 8 subagents: {investigator,implementer,reviewer,conflict-resolver}-{standard,deep}
│       ├── templates/               # commands.json, routing.json, handoff.json
│       └── orchestrate-mcp/         # MCP server (worktree, capability, routing, render, search tools)
├── skills/                          # Standalone distribution — npx skills add compatible
│   ├── README.md                    # Full standalone documentation
│   └── {init,improve}-{agents,claude,skill,hook,rule,subagent}/
├── docs/                            # Research and reference corpus
│   ├── claude-code/                 # Claude Code specific docs
│   ├── cursor/                      # Cursor IDE specific docs
│   ├── general-llm/                 # Cross-tool research and guides
│   ├── shared/                      # Cross-tool standards (Agent Skills)
│   └── analysis/                    # Deep extraction analysis
├── DESIGN-GUIDELINES.md             # Evidence-to-implementation mapping
└── LICENSE
```

> **Two separate skill sets by design:**
> `plugins/*/skills/` — **plugin skills** delegate analysis to isolated subagents, keeping the orchestrating context clean. Require the platform's plugin system.
> `skills/` — **standalone skills** perform all analysis inline. Compatible with any AI coding tool.

## Contributing

Development conventions are enforced by `.claude/rules/` — path-scoped rules load automatically when editing matching files:

- `plugin-skills.md` — plugin skill authoring constraints (delegation, validation, limits)
- `cursor-plugin-skills.md` — Cursor plugin constraints (.mdc format, readonly agents)
- `standalone-skills.md` — standalone skill constraints (inline analysis, distribution awareness)
- `agent-files.md` — subagent file requirements (frontmatter, model, tools)
- `readme-files.md` — README structure and cost-warning requirements

See `DESIGN-GUIDELINES.md` for the evidence base behind each convention.

## License

MIT
