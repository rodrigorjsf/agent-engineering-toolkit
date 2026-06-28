# Wiki Index

Total pages: **49**

---

## Foundational Concepts

| Page                       | Summary                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| [[context-engineering]]    | Token budget management, position effects, four context strategies        |
| [[context-rot]]            | Empirical degradation from 0.92→0.68 accuracy, three architectural causes |
| [[pi-context-zone]]        | Smart/Warm/Dumb zone framework — 40%/70% thresholds, model-by-model resilience |
| [[progressive-disclosure]] | Tiered loading (always/on-demand/invoked), ETH Zurich evidence            |
| [[prompt-engineering]]     | Paradigm inversion for reasoning models, CoT/ToT/ReAct techniques         |

## Agent Architecture

| Page                          | Summary                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| [[evaluating-agents-paper]]   | ETH Zurich 2026 study: minimal configs outperform comprehensive ones   |
| [[agent-workflows]]           | Fundamental loop, five core patterns, orchestration strategies, autonomy modes, dynamic workflows |
| [[subagents]]                 | Cross-platform subagent comparison, context firewall pattern           |
| [[agent-configuration-files]] | AGENTS.md, CLAUDE.md, .cursorrules patterns and hierarchy              |
| [[agent-best-practices]]      | Cross-platform guide: harness model, context management, anti-patterns |
| [[agent-protocols]]           | MCP + A2A as complementary standards, protocol comparison, decision framework |
| [[human-agent-collaboration]] | Fluid collaboration: dynamic role-flexible coordination, fluidity metrics |

## Claude Code Platform

| Page                      | Summary                                                       |
| ------------------------- | ------------------------------------------------------------- |
| [[claude-code-commands]]  | Complete slash command reference: built-in, bundled skills/workflows, MCP prompt commands, removed commands |
| [[claude-code-env-vars]]  | Full environment variable reference: auth, model config, feature toggles, observability, all variable groups |
| [[claude-code-mcp]]       | MCP integration: transport types, installation scopes, OAuth, plugin MCP servers, push channels, connectors |
| [[claude-code-tools]]     | Built-in tool catalog with permission rule formats, per-tool detail sections for 40+ tools |
| [[claude-code-skills]]    | SKILL.md format, frontmatter, string substitutions, locations |
| [[claude-code-hooks]]     | Lifecycle events, hook types, exit codes, matchers, /goal     |
| [[claude-code-plugins]]   | Plugin structure, manifest, distribution, namespacing, CLI commands |
| [[claude-code-memory]]    | CLAUDE.md hierarchy, path-scoped rules, imports, auto memory, claudeMdExcludes + start-dir caveat |
| [[claude-code-subagents]] | Definition format, frontmatter fields, fork mode; teams covered on [[claude-code-agent-teams]] |
| [[claude-code-agent-teams]] | Experimental multi-session teams: file-locked shared task list, point-to-point messaging, three team hooks, plan-approval, sizing |
| [[claude-code-workflows]] | Dynamic workflows: JS script orchestrates dozens–hundreds of subagents; plan-in-code, results in script variables off the main context |
| [[claude-code-worktrees]] | CLI-native git-worktree isolation: --worktree flag, base-branch selection, .worktreeinclude, change-aware cleanup, non-git VCS hooks |
| [[monorepo-large-codebase-setup]] | Scoping Claude Code in monorepos/large repos: start-dir semantics, sparsePaths, additionalDirectories, Read deny rules, claudeMdExcludes, per-directory layering |

## Cursor IDE Platform

| Page                 | Summary                                                   |
| -------------------- | --------------------------------------------------------- |
| [[cursor-rules]]     | Four activation modes, .mdc format, precedence hierarchy  |
| [[cursor-skills]]    | Agent Skills in Cursor, discovery directories, invocation |
| [[cursor-subagents]] | Foreground/background execution, model selection, nesting |
| [[cursor-plugins]]   | Marketplace distribution, manifest, team marketplaces     |
| [[cursor-hooks]]     | Hook events, command/prompt types, partner integrations   |
| [[cursor-mcp]]       | Three transports, OAuth, MCP Apps, tool approval          |
| [[cursor-tools]]     | Browser, search, terminal sandbox, worktrees              |

## Agentic Engineering

| Page                      | Summary                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| [[harness-engineering]]   | Harness as agent OS: five pillars, MCP gotchas, long-running agents, 52.8→66.5% evidence |
| [[rpi-workflow]]          | Research→Plan→Implement→Review, leverage model, FIC, fresh context per phase |
| [[spec-driven-development]] | Move ambiguity to spec review, three adoption levels, when to use vs RPI |
| [[human-layer]]           | HumanLayer/CodeLayer architecture, daemon orchestration, approval loop patterns |

## Agent Skills Standard

| Page                       | Summary                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| [[agent-skills-standard]]  | Open specification, frontmatter, progressive disclosure loading                                        |
| [[skill-authoring]]        | Eval-driven iteration, description optimization, script bundling                                       |
| [[skill-body-convention]]  | Project-internal canonical tag vocabulary, artifact format routing, HTML baseline (ADR-0007)           |

## API & Tooling

| Page                   | Summary                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| [[structured-outputs]] | JSON schema enforcement, strict tool use, tool_search for JIT discovery, 80%+ token savings |

## Research

| Page                              | Summary                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| [[persuasion-in-ai]]              | Seven persuasion principles with quantitative effect sizes      |
| [[multilingual-performance]]      | Tokenization disparities, English-thinking, Portuguese analysis |
| [[whitespace-and-formatting]]     | Formatting costs (1 token), structural quality improvements     |
| [[long-context-lost-in-middle]]   | U-shaped positional bias: performance peaks at start/end, degrades in middle |
| [[html-artifact-effectiveness]]   | Thariq 2026: HTML beats Markdown for rich human-rich + agent-executable artifacts |

## Compliance & Validation

| Page                               | Summary                                                              |
| ---------------------------------- | -------------------------------------------------------------------- |
| [[compliance-routing]]             | Decision table: scope → bundle → primary/forbidden sources → queries |
| [[validation-routing-claude]]      | Claude plugin scope: primary sources, forbidden sources, query guide |
| [[validation-routing-cursor]]      | Cursor plugin scope: primary sources, forbidden sources, query guide |
| [[validation-routing-standalone]]  | Standalone scope: primary sources, forbidden sources, query guide    |
