# Operation Log

---

## 2026-05-02 — Ingest: pi-context-zone (Smart/Warm/Dumb zone framework)

**Page added (1):** `pi-context-zone.md` — 99 lines.

**Source compiled:** `docs/context-engineering/pi-context-zone-github.md` (Dex Horthy's HumanLayer Smart/Warm/Dumb zone framework, 40%/70% thresholds, MRCR v2 model-by-model resilience data).

**Why:** Q1/Q2 of the 2026-05-02 alignment-audit grilling round established the smart-zone framework as one of five doctrinal anchors for the audit. The framework was previously embedded only inside `[[context-engineering]] § Dumb Zone` and `[[harness-engineering]] § The Dumb Zone`; promoting it to a dedicated page provides a stable, citable wiki anchor for audit findings and prevents drift across the two embedding pages.

**Cross-references:** Page links into `[[context-engineering]]`, `[[context-rot]]`, `[[harness-engineering]]`, `[[progressive-disclosure]]`, `[[long-context-lost-in-middle]]`, `[[rpi-workflow]]`, `[[claude-code-subagents]]`. Index updated under "Foundational Concepts" between `[[context-rot]]` and `[[progressive-disclosure]]`. Total wiki pages: 38 → 39.

---

## 2026-05-02 — RAG → Wiki migration (ADR-0004)

**Pages updated (4):** `compliance-routing.md`, `validation-routing-claude.md`, `validation-routing-cursor.md`, `validation-routing-standalone.md`.

**Change:** Removed `search_docs(...)` invocations and "Recommended Search Queries" sections. Replaced with "Direct Read Paths" pointing at wiki pages first, then `docs/` fallback, then concrete in-repo examples — aligned with the new wiki-first lookup contract in `.claude/rules/wiki-routing.md`.

**Why:** Per ADR-0004, the RAG MCP server (`rag-knowledge-base`) is deleted; agents now navigate the wiki by `[[link]]`/slug rather than semantic search.

---

## 2026-05-01 — Batch ingest: new docs directories

**Source directories scanned:**

- `docs/agent-protocols/` (6 files)
- `docs/agentic-engineering/` (5 files)
- `docs/context-engineering/` (9 files)
- `docs/harness-engineering/` (3 files)
- `docs/human-layer-project/` (1 file)
- `docs/long-context-research/` (1 file synthesized from 4 variants)
- `docs/spec-driven-development/` (1 file synthesized)
- `docs/structured-outputs/` (4 files)
- `docs/tool-calling/` (4 files)
- `docs/claude/` (2 files)

**Excluded:** `docs/agents/` (project-internal operational docs), `claude-cookbook-anthropic.md` (API reference, no conceptual content), `docs/claude/prompting-best-practices.md` (absorbed into existing prompt-engineering.md)

**Pages created (8):**

| Page | Sources | Key content |
|------|---------|-------------|
| `agent-protocols.md` | 5 files | MCP + A2A ecosystem, M×N problem, ACP merger, ANP, decision framework |
| `human-agent-collaboration.md` | 1 file | Fluid collaboration, dynamic roles, intertwinement/fluidity metrics |
| `harness-engineering.md` | 5 files | Harness as OS, 52.8→66.5% evidence, five pillars, long-running agent patterns |
| `rpi-workflow.md` | 3 files | Research→Plan→Implement→Review, leverage model, FIC, phase artifacts |
| `long-context-lost-in-middle.md` | 1 file | U-shaped positional bias, empirical benchmark data |
| `spec-driven-development.md` | 1 file | SDD methodology, three adoption levels, tooling landscape |
| `structured-outputs.md` | 5 files | JSON schema enforcement, strict tool use, tool_search, programmatic tool calling |
| `human-layer.md` | 1 file | HumanLayer/CodeLayer architecture, approval loops, daemon orchestration |

**Pages updated (4):**

| Page | What was added |
|------|----------------|
| `context-engineering.md` | Dumb zone (40% threshold), dead context, memory scopes/types, 1M token caveats |
| `progressive-disclosure.md` | Phase-based loading, index-first pattern, context trigger system |
| `agent-best-practices.md` | Harness > model choice evidence, MCP server gotchas |
| `subagents.md` | Context firewall pattern, FIC-based compaction role |

**Index updated:** Added sections "Agentic Engineering" (4 pages) and "API & Tooling" (1 page); expanded "Agent Architecture" (+2 pages); expanded "Research" (+1 page). Count: 30 → 38.

---

## 2026-04-19 — Phase 8: RAG & wiki hardening

**Source**: `docs/compliance/normative-source-matrix.md` (bundle definitions at lines 261-306)

**Pages created:** 4 routing pages under `Compliance & Validation`

- `compliance-routing.md` — master routing decision table (scope → bundle → sources → queries)
- `validation-routing-claude.md` — Claude plugin scope routing guide
- `validation-routing-cursor.md` — Cursor plugin scope routing guide
- `validation-routing-standalone.md` — Standalone scope routing guide

**wiki/knowledge/ added to RAG `docs` collection** via `rag.config.yaml` update. Reindexed via `uv run --project rag python -m rag index --config rag.config.yaml`.

**Pages updated:** `index.md` — added `## Compliance & Validation` section; count updated 26 → 30.

---

## 2026-04-18 — Batch ingest from docs/

**Source directories scanned:**

- `docs/analysis/` (16 files)
- `docs/claude-code/` (9 files)
- `docs/cursor/` (13 files)
- `docs/general-llm/` (10 files)
- `docs/shared/` (8 files)
- `docs/compliance/` (4 files + reports)

**Pages created:** 26 content pages + index.md + log.md

**Categories:**

- Foundational Concepts: 4 pages (context-engineering, context-rot, progressive-disclosure, prompt-engineering)
- Agent Architecture: 5 pages (evaluating-agents-paper, agent-workflows, subagents, agent-configuration-files, agent-best-practices)
- Claude Code Platform: 5 pages (skills, hooks, plugins, memory, subagents)
- Cursor IDE Platform: 7 pages (rules, skills, subagents, plugins, hooks, mcp, tools)
- Agent Skills Standard: 2 pages (agent-skills-standard, skill-authoring)
- Research: 3 pages (persuasion-in-ai, multilingual-performance, whitespace-and-formatting)

**Method:** Parallel explore agents extracted structured knowledge from all source docs; pages synthesized as concept-oriented knowledge (not 1:1 source summaries) with cross-references via `[[knowledge-links]]`.

**Excluded:** `docs/plans/` (historical design documents per project convention)

---

## 2026-04-18 — Depth expansion pass

**Reason:** Initial batch ingest pages were unconsciously capped at ~60-113 lines due to reference file conventions bleeding into wiki authoring. Wiki pages have no line limit per wiki/CLAUDE.md.

**Pages expanded (10 of 26):**

| Page                        | Before | After | Key additions                                                                                |
| --------------------------- | ------ | ----- | -------------------------------------------------------------------------------------------- |
| claude-code-hooks.md        | 83     | 266   | Complete 22-event lifecycle table, advanced control patterns, async hooks, security patterns |
| skill-authoring.md          | 113    | 181   | Eval-driven iteration, description optimization, script conventions, multi-model testing     |
| claude-code-subagents.md    | 89     | 168   | Agent Teams (experimental), effort levels, session-scoped hooks, team sizing                 |
| claude-code-plugins.md      | 96     | 153   | Namespace isolation, marketplace format, plugin security constraints, $ARGUMENTS             |
| cursor-mcp.md               | 83     | 144   | Full protocol capabilities, OAuth detail, tool approval, MCP Apps                            |
| prompt-engineering.md       | 71     | 119   | Quantitative benchmarks table, token budget, automated optimization, Reflexion               |
| multilingual-performance.md | 74     | 113   | High-overhead languages, internal English thinking, self-translate strategy, Sabiá-2         |
| subagents.md                | 65     | 102   | System prompt structure, 10 anti-patterns, confidence filtering, community patterns          |
| evaluating-agents-paper.md  | 59     | 90    | Per-model data table, AGENTBENCH methodology, tool mention effects                           |
| context-engineering.md      | 59     | 76    | Implementation strategies detail, Ball of Mud anti-pattern, instruction budget               |

**Total:** 2138 → 2758 lines (+29%), 16 pages unchanged (already adequate)
