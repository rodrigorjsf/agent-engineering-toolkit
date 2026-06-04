# Operation Log

---

## 2026-06-04 — Ingest: 5 new Claude Code vendor docs + lint fixes

Summarize: Pages created (4): claude-code-agent-teams, claude-code-workflows, monorepo-large-codebase-setup, claude-code-worktrees. Source: goals.md ingested as extends only (no new page — it is a session-scoped Stop-hook wrapper). Pages extended: claude-code-subagents (Agent Teams section demoted to a stub pointing at the canonical page; corrected the stale "broadcast" claim → point-to-point, and "two team hooks" → three), agent-workflows, claude-code-hooks, claude-code-memory (fixed subdirectory-load claim for the start-from-subdir case; added claudeMdExcludes), subagents, context-engineering, claude-code-skills, skill-authoring, claude-code-plugins, agent-configuration-files. Lint fixes applied: resolved the pi-context-zone orphan (backlinks from context-engineering + harness-engineering); corrected the rpi-workflow ↔ harness-engineering dumb-zone threshold mis-attribution (40% from markus-harrer vs 60% from harness-engineering, now attributed separately); added ## Related pages to the four Compliance & Validation routing pages. Index updated 41 → 45. Sources: agent-teams.md, dynamic-workflows.md, goals.md, monorepos-and-large-repos.md, parallel-sessions-worktrees.md.

**Lint pass (same run).** Mechanical checks over 41 pages (deterministic, ground truth): P0 dangling links 0, dead index entries 0, pages missing from index 0; P1 orphan 1 (pi-context-zone — fixed), format 4 (routing pages lacked `## Related pages` — fixed); P2 asymmetric backlinks ~120 (expected noise, one-way prose mentions are allowed — not acted on). Reasoning checks (8 topical clusters): 1 contradiction found and fixed (rpi-workflow ↔ harness-engineering dumb-zone threshold mis-attribution); 7 of 8 clusters clean. Post-write re-lint over all 45 pages: 0 P0, 0 orphans, 0 format violations; all 16 intended bidirectional pairs resolve both ways.

**Lint findings deferred (not acted on — future work):**
- *Citation-sparse pages (13):* agent-skills-standard, compliance-routing, context-rot, cursor-mcp, cursor-subagents, evaluating-agents-paper, multilingual-performance, persuasion-in-ai, skill-body-convention, validation-routing-claude/cursor/standalone, whitespace-and-formatting — no inline `(source:)` markers (page-level heuristic, low confidence; synthesized concept pages legitimately cite via `**Sources**:` frontmatter only). Verify or accept as-is per page.
- *Concept-gap candidates for future ingest (no source doc yet — would be synthesis pages):* tool-calling/tool-use (recurs across 11 pages, only the schema-constrained slice is owned by structured-outputs), agent-evaluation/benchmarking (14 pages cite evals; no page owns the methodology — evaluating-agents-paper is one specific study), context-compaction (9 pages; only touched by context-engineering), permission/sandbox model (9+ pages; gating model described per-tool, never as one concept). Promotion candidates (well-homed today, split only if cluster grows): A2A (section of agent-protocols), constrained-decoding (section of structured-outputs).

---

## 2026-05-21 — Update: subagent pages reflect current Claude Code facts

**Pages updated (2):** `claude-code-subagents.md`, `subagents.md`

**Source:** `creating-custom-subagents.md` (Anthropic "Create custom subagents" page, refetched)

**Changes to `claude-code-subagents.md`:**
- Frontmatter table: added `color` (display color: red/blue/green/yellow/purple/orange/pink/cyan) and `initialPrompt` (auto-submitted first user turn when run as the main session agent) rows.
- `effort` row: added `xhigh`; availability is now "available levels depend on the model" (dropped stale model-specific claims).
- `permissionMode` row: added `auto` value (background classifier reviews commands) and the `default` value; full set is now default/acceptEdits/auto/dontAsk/bypassPermissions/plan.
- `model` row: added `claude-opus-4-7` as the full-ID example.
- `skills` row: clarified it preloads full skill content into context at startup (not merely "available skills").
- Built-in subagents table: removed the `Bash` row (no longer documented); added `statusline-setup` and `claude-code-guide` to reconcile with the live "Other" tab.
- Locations table: rebuilt as a 5-row priority table with the new "Managed settings" scope at priority 1 (highest), pushing CLI flag / project / user / plugin down.
- Effort Levels table: added `xhigh`; availability column changed to "available levels depend on the model".
- New "Fork Mode (Experimental)" subsection: forks inherit the full parent conversation, enabled via `CLAUDE_CODE_FORK_SUBAGENT=1`, `/fork` command, experimental, requires Claude Code v2.1.117+.
- Added inline `(source: creating-custom-subagents.md)` citations to all touched sections.

**Changes to `subagents.md` (Claude Code parts only — Cursor facts untouched):**
- Cross-Platform Comparison "Effort" row: added `xhigh`.
- "Effort Levels (Claude Code Only)" table: added `xhigh`; availability wording changed to "available levels depend on the model".
- "Built-in Subagents" list: dropped the cross-platform `Bash/Terminal` line; `Bash` is now scoped to Cursor only; added Claude Code helper agents `statusline-setup` and `claude-code-guide`.

**Index updated:** `claude-code-subagents` summary now mentions fork mode. Page count unchanged (41).

**Why:** Anthropic's official "Create custom subagents" page changed substantially; two wiki pages held stale subagent facts (missing fields, stale effort availability, removed `Bash` built-in, no Managed settings scope, no fork mode).

---

## 2026-05-17 — Ingest: html-artifact-effectiveness (Thariq HTML post)

**Page created (1):** `html-artifact-effectiveness.md`

**Source:** docs/html-structure/thariq-html-effectiveness.md, https://thariqs.github.io/html-effectiveness

**Why:** New source document arrived; user requested deep analysis, cross-linking, and wiki ingestion as part of the grilling session that produced ADR-0007. Captures Thariq's argument for HTML over Markdown for human-rich artifacts, the use-case map, honest costs, and the explicit anti-pattern warning against a generic `/html` skill.

---

## 2026-05-17 — Page created: skill-body-convention (project-internal contract)

**Page created (1):** `skill-body-convention.md`

**Why:** ADR-0007 introduced a closed canonical semantic-tag vocabulary for skill and subagent bodies plus an Artifact format routing rule for generated artifacts. The new wiki page is the searchable canonical reference for skill authors (`skill-authoring` covers domain-agnostic best practices; this new page covers this project's body-shape contract). Cross-links: `[[html-artifact-effectiveness]]`, `[[claude-code-skills]]`, `[[cursor-skills]]`, `[[agent-skills-standard]]`, `[[skill-authoring]]`.

---

## 2026-05-03 — Update: compliance-routing (register cursor-customizer scope)

**Page updated (1):** `compliance-routing.md`

**Changes:**
- Updated Routing Decision Table row for Cursor IDE plugins: expanded from `cursor-initializer` only to `cursor-initializer`, `cursor-customizer`, and updated the label to plural "Cursor IDE plugins". Both Cursor plugins now route to `cursor-plugin-bundle`.

**Why:** CF-GOV-005 (issue #106 / XC-9) — `cursor-customizer` shipped but was absent from all scope-tracking artifacts.

---

## 2026-05-03 — Update: validation-routing-standalone (ADR-0005 follow-ups)

**Page updated (1):** `validation-routing-standalone.md`

**Changes:**
- Added `## Layered scope` section after "Source Authority", documenting the two-layer split from ADR-0005: skill body layer (SKILL.md prose + references) must be platform-agnostic (`SHARED-*`/`GENERAL-*` only); template layer (`assets/templates/`) MAY embed platform-specific format if the skill `name` declares that target. The `name` field is canonical — aliasing to escape scoping is itself a violation.
- Rewrote contamination signal list to scope `${CLAUDE_SKILL_DIR}`, `paths:`, `globs:` bullets to "skill body or neutral-skill templates" rather than blanket-forbidding everywhere.
- Qualified the "Common Validation Mistakes" bullet about `.claude/rules/` references: applies to skill prose and neutral-skill templates only; Claude-targeted-skill templates (`init-claude`/`improve-claude`) MAY reference `.claude/rules/` per ADR-0005.

**Why:** CF-GOV-001 and CF-GOV-004 mandated follow-ups from ADR-0005 (issues #98 / XC-1).

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

---

## 2026-05-22 — Claude & Cursor docs re-sync

**Reason:** The vendor-doc mirrors under `docs/claude/`, `docs/claude-code/`, and `docs/cursor/` were re-synced against current upstream after ~3 weeks of drift (see ADR-0010 — these mirrors are now living, not immutable). The 10 wiki pages compiled from them were refreshed to match.

**Pages refreshed (10):**

| Page                   | Key updates                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| claude-code-hooks.md   | 7 new hook events (Setup, UserPromptExpansion, PostToolBatch, PermissionDenied, TaskCreated, CwdChanged, FileChanged), Windows PowerShell tool, `mcp_tool` hook type |
| claude-code-memory.md  | `CLAUDE.local.md` layer, "When to add to CLAUDE.md", reordered load-order table                      |
| claude-code-plugins.md | Background monitors, default settings, community-marketplace rename                                  |
| claude-code-skills.md  | Bundled-skills set refreshed (`/code-review` added, `/simplify` dropped), new frontmatter fields      |
| prompt-engineering.md  | "Prompting Claude Opus 4.7" section, `effort` parameter, adaptive thinking, prefill deprecation       |
| cursor-hooks.md        | `workspaceOpen` App-lifecycle hook, Hook categories framing                                          |
| cursor-plugins.md      | `workspaceOpen` hook usage, Hooks reference; Extension API removed upstream                           |
| cursor-rules.md        | Glob pattern examples subsection                                                                     |
| cursor-skills.md       | `paths` frontmatter field, file-scoping, nested directories, `/migrate-to-skills`                     |
| cursor-tools.md        | Terminal AppArmor 0.6.0 + Landlock v3 + auto-run renames; worktrees Agents-Window restructure         |

**Note:** `docs/claude/claude-interaction-guide.md` and `docs/claude/prompting-best-practices.md` were deleted — Anthropic consolidated its prompt-engineering pages upstream into one page; `docs/claude-code/claude-prompting-best-practices.md` is the surviving single mirror. The earlier log reference to the now-deleted file is left intact as historical record.

**Method:** Two parallel subagents refreshed the 10 pages from the re-synced source docs following the `wiki-ingest` compile methodology; `**Sources**` lines reconciled against `docs/analysis/`.
