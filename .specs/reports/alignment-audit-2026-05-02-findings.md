# Alignment Audit — Cross-Distribution Findings (2026-05-02)

**Audit date**: 2026-05-02
**Audit charter**: Verify scope alignment of every artifact (Claude → 100% Claude refs, Cursor → 100% Cursor refs, standalone → environment-agnostic per ADR-0005) and alignment with new doctrinal anchors: harness engineering, context engineering, progressive disclosure, smart zone (`[[pi-context-zone]]`), and HumanLayer methodology.
**Scope**: 6 distributions audited at Tier 2 (every SKILL.md, agent definition, reference, template, plus governance meta-docs). 200+ files read directly.
**Output convention**: Per-finding model from `.claude/rules/compliance-maintenance.md` — CF-NNN, file path, severity, dimension, rule source, finding, proposed fix.

---

## Headline Numbers

| Severity | Count | Distribution leaders |
|---|---|---|
| **P0 (blocker)** | **14** | governance (6), cursor-init (3), standalone (3), cursor-cust (2) |
| **P1 (must-fix)** | **27** | standalone (9), governance (6), claude-init (4), claude-cust (4), cursor-init (4), cursor-cust (0) |
| **P2 (should-fix)** | **15** | cursor-init (4), governance (3), claude-init (3), standalone (3), claude-cust (1), cursor-cust (1) |
| **P3 (improvement)** | **17** | claude-cust (4), claude-init (4), cursor-cust (4), standalone (2), cursor-init (2), governance (1) |
| **Decisions required** | **2** | CF-STANDALONE-016 (BG-vs-Hard-Rules ordering doctrine), CF-CURSOR-CUST-006 (Cost-and-Model-Guidance product naming exception) — see "Decisions Required" section below |
| **Total findings** | **73** | (1 withdrawn during audit, 1 informational) |

Files audited: ~257. Files passing (no findings of any severity): ~187.

---

## Cross-Cutting Patterns (Executive Summary)

### XC-1. ADR-0005 implementation deficit (P0 — root cause for the standalone scope's ambiguity)

ADR-0005 was decided four days ago but **none of its four mandated follow-ups have been applied**:
- `wiki/knowledge/validation-routing-standalone.md` lacks the "Layered scope" section (CF-GOV-001)
- `.claude/rules/standalone-skills.md` missing the platform-template bullet (CF-GOV-002)
- `docs/compliance/normative-source-matrix.md` `standalone-bundle` definition does not reference ADR-0005 (CF-GOV-003)
- "Common Validation Mistakes" entry not qualified for Claude-targeted-skill templates (CF-GOV-004)

**Consequence**: Every standalone audit produces ambiguous verdicts. The standalone subagent surfaced 3 P0 findings (CF-STANDALONE-002/003/004) that hinge on the layer-split interpretation; without the rules updated to formalize that interpretation, those findings sit between "ADR violation" and "rule violation."

### XC-2. Smart-zone budget overruns are systemic across initializers (P1 — D4)

| Skill | Aggregate (all references loaded) | vs 8K target |
|---|---|---|
| `improve-claude` (claude-init) | ~15.2K tokens | **1.9×** |
| `improve-cursor` (cursor-init) | ~14.5K tokens | **1.8×** |
| `improve-agents` (claude-init) | ~13.1K tokens | **1.6×** |
| `init-claude` (claude-init) | ~9.1K tokens | **1.1×** |
| `improve-skill` (claude-cust) | ~8.4K tokens | **1.05×** |
| `init-agents` (claude-init) | ~7.4K tokens | borderline |

Five of six initializer/improve skills exceed the 8K smart-zone ceiling. **Root cause is shared**: `automation-migration-guide.md`, `evaluation-criteria.md`, `progressive-disclosure-guide.md`, and `what-not-to-include.md` are 4×-replicated references all loaded together in a single phase.

### XC-3. Phase-loading violates the ≤2-refs-per-phase rule across every plugin distribution (P1/P2 — D3)

| Distribution | Phase 3 reference loads observed |
|---|---|
| claude-init | 3 / 4 / 4 / 5 references per Phase 3 |
| claude-cust | 3-4 references per Phase 2/3 across all 8 skills |
| cursor-init | 4 / 5 references per Phase 3 |

Every plugin skill bulk-loads 3-5 references in a single phase. This is **the exact "load everything upfront" anti-pattern** these skills themselves caution against (see anti-pattern table in plugin READMEs). Compounds XC-2 directly.

### XC-4. `improve-*` skills systematically miss the deletion-test principle (P1/P3 — D6)

The ETH paper's deletion-test ("Would removing this cause the agent to make mistakes?") is the canonical evidence for minimalism, yet:
- All 4 claude-cust `improve-*` evaluation-criteria miss it (CF-CLAUDE-CUST-003)
- All 4 cursor-cust `improve-*` skills miss it (CF-CURSOR-CUST-005)
- claude-init's `improve-claude` body lacks the −3% / +20% citation (CF-CLAUDE-INIT-007)

Improve-class skills should ground their bloat-removal logic in the ETH measurement; currently they default to softer phrasings ("remove only generic waste") that lack the empirical anchor.

### XC-5. Hook and subagent doctrine is missing from the customizer skills that teach those artifacts (P1 — D5)

The wiki's `[[harness-engineering]]` doctrine pages name two load-bearing rules that customizer skills must teach but currently don't:
- **Hook silent-on-success / verbose-on-failure** — missing from `create-hook`/`improve-hook` authoring guide (CF-CLAUDE-CUST-001). The "golden rule of hook output" is the difference between a hook that keeps the agent in the smart zone and one that floods it with passing-test logs.
- **Subagent context-firewall pattern** — missing from `create-subagent`/`improve-subagent` authoring guide (CF-CLAUDE-CUST-002). Without this framing, generated subagents will be sized as "frontend/backend role specialists" — the exact misuse case the wiki page calls out.

### XC-6. Behavioral Guidelines block parity is uneven across the surface (P1 — D5)

| Location | Status |
|---|---|
| init-cursor SKILL.md | **Duplicated** — block appears twice (CF-CURSOR-INIT-004) |
| improve-skill standalone template | **Missing** — generated skills lose the block (CF-STANDALONE-006) |
| `.claude/rules/cursor-plugin-skills.md` | **Bullet absent** — Cursor plugin parity gap (CF-GOV-009) |
| `.github/instructions/karpathy-guidelines.instructions.md` | **Not single-sourced** — three rules duplicate the four pillars (CF-GOV-009/015) |
| claude-init / claude-cust / cursor-cust SKILLs | Parity perfect ✓ |

### XC-7. Verbatim cross-distribution copies leak Claude product into Cursor scope (P0 — D1)

The drift manifests track byte-equivalence but bypass product-strict scrubbing:
- 8 copies of `prompt-engineering-strategies.md` in cursor-customizer cite `Claude 4.6`, `Opus 4.6`, "Think of Claude as…" (CF-CURSOR-CUST-001)
- 5 of 7 improve-cursor reference files still say "Anthropic Best Practices / Anthropic Engineering" (CF-CURSOR-INIT-002, 25+ instances)
- One reference cross-cites `plugins/agents-initializer/...` from inside the cursor bundle (CF-CURSOR-INIT-003)

**Root cause**: The "Verbatim copy" status in the docs-drift-manifest grants byte-equivalence parity but does not enforce vendor-neutralization. Either the canonical (in `agent-customizer`) becomes vendor-neutral, or the cursor side gets its own forked canonical.

### XC-8. Stale RAG references after ADR-0004's hard delete (P0 — D1)

- `docs/compliance/normative-source-matrix.md:122-123` still cites deleted `rule:rag-mcp-server` and `rule:rag-storage-search` (CF-GOV-006)
- `docs/compliance/artifact-audit-manifest.md:462-463,477` still cites deleted hook
- ADR-0004 was implemented (rules and hook deleted) but the compliance docs that reference them weren't swept

### XC-9. CONTEXT.md drift vs shipped code (P1 — D1)

- `CONTEXT.md:24` calls cursor-customizer "planned" but the plugin shipped with full manifest, 8 skills, and 6 agents (CF-GOV-013)
- The normative-source-matrix scope registry is missing cursor-customizer entirely (CF-GOV-005). A future cursor-customizer audit run would find no bundle definition.

### XC-10. DESIGN-GUIDELINES.md self-duplication (P1 — D2/D6)

The 453-line document warning against context poisoning has 75 lines of duplicated content (Guidelines 13/14/15 repeated wholesale at lines 254-326 and 329-401), including a stale ETH paper file path (CF-GOV-008/016).

### XC-11. Standalone bundle has neutral skills laundering Claude-only architecture (P1 — D1, ADR-0005)

Six standalone skills (`create-rule`, `create-hook`, `create-subagent`, and the three `improve-*` siblings) declare neutral names but their bodies and templates teach Claude-only artifact architecture (`paths:` frontmatter, `.claude/settings.json`, `.claude/agents/`). Per ADR-0005's authority chain, neutral skill names mandate neutral templates — but Claude rules/hooks/subagents are platform-specific by definition, so neutral content is impossible. **Either rename to `create-claude-rule` etc. (declaring platform target) or relocate.** (CF-STANDALONE-001)

### XC-12. Always-loaded duplication and broad globs inflate dead context (P1/P2 — D3/D4)

- Root `CLAUDE.md § Knowledge Lookup` duplicates `.claude/rules/wiki-routing.md` content
- `wiki-routing.md` uses `paths: - "**/*.md"` — the project's own `rules.instructions.md` flags this exact anti-pattern
- 7 of 21 `.github/instructions/*.md` files exceed the 4,000-char Copilot review cap; the largest (CI/CD best-practices) is 13.5× over

---

## Per-Distribution Findings

### Distribution: `claude-init` (`plugins/agents-initializer/`)

11 findings, 47 files audited, 31 passing.

- **CF-CLAUDE-INIT-001** (P1, D4) — `improve-claude` smart-zone budget: 15.2K tokens vs 8K target. Split `automation-migration-guide.md`; collapse `evaluation-criteria.md` ↔ `validation-criteria.md` rubric overlap.
- **CF-CLAUDE-INIT-002** (P1, D4) — `improve-agents` smart-zone budget: 13.1K tokens. Same root cause and fix as CF-001; additionally extract Phase 5 "structured card" into a reference.
- **CF-CLAUDE-INIT-003** (P1, D4) — `init-claude` smart-zone budget: 9.1K tokens. Trim `progressive-disclosure-guide.md` ↔ `claude-rules-system.md` CLAUDE.md-hierarchy duplication.
- **CF-CLAUDE-INIT-004** (P1, D3+D4) — All four skills load 3-5 references in a single Phase 3. Restructure into Phase 3a/3b/3c with explicit "drop previous-phase refs" instruction.
- **CF-CLAUDE-INIT-005** (P2, D2+D4) — Duplicated `### Exclusion Actions` block in `what-not-to-include.md` × 4 copies (lines 28-38 vs 40-50, byte-identical). Pure copy-paste residue surviving parity sync.
- **CF-CLAUDE-INIT-006** (P2, D2) — `## Contents` TOC missing on `what-not-to-include.md`. Resolved by CF-005 fix.
- **CF-CLAUDE-INIT-007** (P3, D6) — `improve-claude/SKILL.md:3` description doesn't cite ETH research; body line 12 also misses the −3% / +20% figure (other 3 skills cite it).
- **CF-CLAUDE-INIT-008** (P3, D3+D5) — `improve-agents` writes `.claude/rules/` artifacts via template but never loads `claude-rules-system.md` reference. Either drop the migration or import the reference.
- **CF-CLAUDE-INIT-009** (P3, D1) — Plugin manifest `author` missing `email` field per `[[claude-code-plugins]]` schema.
- **CF-CLAUDE-INIT-010** (P2, D2+D4) — `evaluation-criteria.md` and `validation-criteria.md` overlap on Hard Limits rubric in both `improve-*` skills; ~2,400 chars of duplicated load.
- **CF-CLAUDE-INIT-011** (P3, D2) — `improve-claude/SKILL.md` Phase 5 inlines a 44-line "structured card" duplicated structurally with `improve-agents`. Extract to shared reference.

### Distribution: `claude-cust` (`plugins/agent-customizer/`)

9 findings, 62 files audited, 53 passing.

- **CF-CLAUDE-CUST-001** (P1, D5) — `hook-authoring-guide.md` missing the harness-engineering golden rule: success silent, failure verbose. Add "Hook Output Discipline" subsection citing `[[harness-engineering]]:133`.
- **CF-CLAUDE-CUST-002** (P1, D5) — `subagent-authoring-guide.md` missing the context-firewall framing. Replace "When to Use Subagents" intro with the firewall paragraph citing `[[harness-engineering]]:112-122`.
- **CF-CLAUDE-CUST-003** (P1, D6) — All four `*-evaluation-criteria.md` files miss the deletion-test principle. Add "Deletion Test" section to each citing `[[evaluating-agents-paper]]`.
- **CF-CLAUDE-CUST-004** (P1, D4) — `improve-skill` aggregate references at 33,746 chars / ~8.4K tokens — over budget. Trim by ~2K chars: collapse `behavioral-guidelines.md` (162 lines) ↔ SKILL.md guidelines block; merge evaluation/validation hard-limit tables.
- **CF-CLAUDE-CUST-005** (P2, D3) — All 8 SKILL.md files load 3-4 references in Phase 2 / Phase 3. Split into "Load context" + "Apply patterns" mini-phases.
- **CF-CLAUDE-CUST-006** (P3, D2) — Hard Rules cite the 200-line ceiling but not the 100-line TOC requirement. Append explicit TOC bullet.
- **CF-CLAUDE-CUST-007** (P3, D2) — `skill-validation-criteria.md:67-69` has duplicated step "4." in Validation Loop Instructions (both copies, byte-identical). Renumber second to "5.".
- **CF-CLAUDE-CUST-008** (P3, D2) — README.md Cost-and-Model-Guidance placement compliant — informational only, no action.
- **CF-CLAUDE-CUST-009** (P3, D5) — All 6 plugin agents declare `tools: Read, Grep, Glob, Bash` without read-only Bash discipline in body, contradicting the rule the same plugin teaches.

### Distribution: `cursor-init` (`plugins/cursor-initializer/`)

12 findings (1 withdrawn), 27 files audited, 12 passing.

- **CF-CURSOR-INIT-001** (P0, D1) — `plugins/cursor-initializer/CLAUDE.md` exists in product-strict Cursor scope. Delete; migrate any unique content to `.claude/rules/cursor-plugin-skills.md`.
- **CF-CURSOR-INIT-002** (P0, D1) — `improve-cursor` reference files contain "Anthropic" product branding (25+ instances across 5 files). Vendor-neutralize to "Industry Research" matching init-cursor.
- **CF-CURSOR-INIT-003** (P0, D1) — `improve-cursor/references/what-not-to-include.md:26` cites `plugins/agents-initializer/skills/init-agents/SKILL.md` from inside a Cursor product-strict bundle. Replace with `docs/`-anchored attribution.
- **CF-CURSOR-INIT-004** (P1, D2+D5) — `init-cursor/SKILL.md:21-28` and `:30-37` duplicate the entire Behavioral Guidelines block.
- **CF-CURSOR-INIT-005** (P1, D2) — `improve-cursor/SKILL.md:200-206` duplicates Phase 4 paragraphs verbatim (~600 chars of pure noise).
- **CF-CURSOR-INIT-006** (P2, D2) — `improve-cursor/references/validation-criteria.md:64,66` duplicates "Quality calibration" rule.
- **CF-CURSOR-INIT-007** (P2, D2) — `README.md:62-68` duplicates "Cursor Rules / Cursor Subagents" link group.
- **CF-CURSOR-INIT-008** (P1, D4) — `improve-cursor` smart-zone aggregate ~14.5K tokens / 58 KB vs 8K target. Linked to CF-005 / CF-006 fixes plus rubric collapse.
- **CF-CURSOR-INIT-009** (P1, D3) — Phase 3 loads 4-5 references in both skills. Split into 3a/3b/3c.
- **CF-CURSOR-INIT-010** (P2, D2) — `improve-cursor/references/validation-criteria.md` (102 lines) lacks `## Contents` TOC.
- **CF-CURSOR-INIT-011** (P3, D1+D5) — `agents/codebase-analyzer.md:3` description still mentions AGENTS.md, contradicting the plugin's "never generates AGENTS.md" stance.
- **CF-CURSOR-INIT-012** (P2, D5+D6) — `improve-cursor/references/progressive-disclosure-guide.md` describes AGENTS.md generation as primary flow despite rules-first charter. Rewrite.
- **CF-CURSOR-INIT-013** (P3, D2+D5) — `domain-doc.md` template ships in both skills' `assets/templates/` but neither SKILL.md references it. Delete.

### Distribution: `cursor-cust` (`plugins/cursor-customizer/`)

7 findings (1 withdrawn after re-verification), 56 files audited, 47 passing.

- **CF-CURSOR-CUST-001** (P0, D1+D6) — All 8 copies of `prompt-engineering-strategies.md` carry verbatim Claude product references (`Claude 4.6`, `Opus 4.6`, "Think of Claude as…"). Either fork the cursor canonical or vendor-neutralize the agent-customizer source.
- **CF-CURSOR-CUST-002** (P0, D1) — `agents/hook-evaluator.md:40` says "PascalCase Claude Code names that have no Cursor analogue". Reword to "PascalCase event names from other agent platforms".
- **CF-CURSOR-CUST-004** (P3, D1) — `agents/skill-evaluator.md:51` rejects `${...}` substitutions generically; could explicitly name `${CLAUDE_SKILL_DIR}` as illustrative without product-strict violation.
- **CF-CURSOR-CUST-005** (P3, D6) — All 4 `improve-*` evaluation-criteria miss explicit ETH deletion-test citation. Add one sentence per file.
- **CF-CURSOR-CUST-006** — **Decision required** (see Decisions Required section).
- **CF-CURSOR-CUST-007** (P3, D1) — `plugins/cursor-customizer/CLAUDE.md` exists; content is product-strict-clean inside but filename is a Claude construct. Either rename to `CONVENTIONS.md` or document as repo-internal-tooling exception.
- **CF-CURSOR-CUST-008** (informational, D2) — `behavioral-guidelines.md` 162-line file has TOC ✓.

### Distribution: `standalone` (`skills/`)

17 findings, 109 files audited, ~25 passing. (Of 17, one is reclassified as a **decision required** — see CF-STANDALONE-016 in the Decisions Required section.)

- **CF-STANDALONE-001** (P1, D1+D6) — Six neutral-named skills (`create-rule`, `create-hook`, `create-subagent`, three `improve-*` siblings) teach Claude-only architecture. Per ADR-0005 authority chain, neutral names mandate neutral templates. Rename to `create-claude-rule` etc., or relocate.
- **CF-STANDALONE-002** (P0, D1) — `improve-agents` body-layer references contaminated with `.claude/rules/`, `paths:`, hook-migration tables, `.claude/CLAUDE.md` enumeration. Fork references; produce neutral counterparts for `improve-agents`.
- **CF-STANDALONE-003** (P0, D1) — `init-agents/references/what-not-to-include.md:24,32-50` directs migration to Claude hooks and `.claude/rules/`. Strip Hook row; replace with AGENTS.md-compatible targets.
- **CF-STANDALONE-004** (P0, D1) — `improve-agents/assets/templates/claude-rule.md` and `skill.md` embed Claude-only frontmatter despite cross-platform AGENTS.md target. Delete from improve-agents templates.
- **CF-STANDALONE-005** (P1, D1+D5) — `create-skill`/`improve-skill` templates embed "Delegate to appropriate subagent" comment. Replace with "Run inline analysis…".
- **CF-STANDALONE-006** (P1, D5+D3) — `improve-skill/assets/templates/skill-md.md` missing the Behavioral Guidelines block that `create-skill` template includes. Insert.
- **CF-STANDALONE-007** (P1, D1+D5) — `skill-evaluation-criteria.md:42` and `skill-validation-criteria.md:39-40` assert plugin-doctrine inside standalone bundle references. Delete.
- **CF-STANDALONE-008** (P1, D1) — `init-agents`/`improve-agents` validation-criteria contain CLAUDE.md-specific structural checks. Strip.
- **CF-STANDALONE-009** (P1, D1+D5) — `automation-migration-guide.md` Mechanism Comparison table includes Hook + Subagent rows in standalone copies. Strip mechanisms forbidden by `.claude/rules/standalone-skills.md:22`.
- **CF-STANDALONE-010** (P1, D1) — `skill-format-reference.md` "Claude Code Extensions" section in `create-skill`/`improve-skill` (platform-neutral by name). Move out of neutral-skill references.
- **CF-STANDALONE-011** (P1, D1) — `artifact-analyzer.md` 8 verbatim copies enumerate Claude-only paths (`.claude/agents/**`, `.claude/settings.json`, `.claude-plugin/plugin.json`). Fork into `artifact-analyzer-claude.md` (Claude-targeted) and `artifact-analyzer-skills.md` (open Agent Skills standard only).
- **CF-STANDALONE-012** (P1, D1) — `improve-agents/SKILL.md:122-124` instructs loading Claude-only templates. Remove the migration mechanism.
- **CF-STANDALONE-013** (P2, D2) — `file-evaluator.md` 201 lines (1 over limit) in two copies. Trim trailing blank.
- **CF-STANDALONE-014** (P2, D2) — Same `### Exclusion Actions` duplicate as CF-CLAUDE-INIT-005, present in 4 standalone copies of `what-not-to-include.md`.
- **CF-STANDALONE-015** (P2, D5) — `skill-validation-criteria.md:39` asserts plugin-doctrine as standalone validation rule. Delete.
- **CF-STANDALONE-016** — **Decision required** (see Decisions Required section).
- **CF-STANDALONE-017** (P3, D2) — `skills/README.md` mentions Cursor and Cursor plugin — borderline acceptable, see `.claude/rules/readme-files.md`.

### Distribution: `governance` (repo-level meta-docs)

16 findings, ~58 files audited, 32 passing.

- **CF-GOV-001** (P0, D1+D6) — ADR-0005 follow-up #1: `validation-routing-standalone.md` lacks "Layered scope" section. Add section; rewrite contamination signals.
- **CF-GOV-002** (P0, D1+D3) — ADR-0005 follow-up #2: `.claude/rules/standalone-skills.md` missing platform-template bullet.
- **CF-GOV-003** (P0, D1+D6) — ADR-0005 follow-up #3: `normative-source-matrix.md` `standalone-bundle` not updated.
- **CF-GOV-004** (P0, D1) — ADR-0005 follow-up #4: "Common Validation Mistakes" entry not qualified for Claude-targeted-skill templates.
- **CF-GOV-005** (P0, D1) — `cursor-customizer` distribution missing from normative-source-matrix Scope Registry, Normative Matrix block, `cursor-plugin-bundle` definition, and `compliance-routing` wiki. Add.
- **CF-GOV-006** (P0, D1) — `normative-source-matrix.md:122-123` and `artifact-audit-manifest.md:462-463,477` cite RAG rules and hook deleted by ADR-0004.
- **CF-GOV-007** (P1, D1) — `.claude/skills/` declared in root `CLAUDE.md:28` but missing from normative-source-matrix Scope Registry.
- **CF-GOV-008** (P1, D2+D6) — `DESIGN-GUIDELINES.md` Guidelines 13/14/15 duplicated wholesale at lines 254-326 vs 329-401 (~75 lines), plus stale `docs/Evaluating-AGENTS-paper.pdf` path in duplicate.
- **CF-GOV-009** (P1, D5+D3) — Behavioral discipline statement duplicated across 3 rules with wording drift; missing entirely from `.claude/rules/cursor-plugin-skills.md`. Single-source via `karpathy-guidelines.instructions.md`.
- **CF-GOV-010** (P1, D4+D3) — `.claude/rules/wiki-routing.md` glob `**/*.md` is overly broad — auto-attaches on every markdown edit across the repo.
- **CF-GOV-011** (P1, D2) — 7 instruction files exceed 4,000-char Copilot review cap (largest 13.5×). Split into core + supporting reference.
- **CF-GOV-012** (P2, D3+D6) — Root `CLAUDE.md § Knowledge Lookup` duplicates `.claude/rules/wiki-routing.md` content (always-loaded + auto-attached overlap).
- **CF-GOV-013** (P1, D1) — `CONTEXT.md:24` calls cursor-customizer "(planned)" but plugin shipped weeks ago. Remove qualifier.
- **CF-GOV-014** (P2, D3+D6) — DESIGN-GUIDELINES.md Self-Application Record stale; predates ADR-0004.
- **CF-GOV-015** (P2, D5) — `skill-files.instructions.md:19` says "equivalent to the Karpathy guidelines" without single-sourcing the canonical file.
- **CF-GOV-016** (P3, D6) — Stale `docs/Evaluating-AGENTS-paper.pdf` path in DESIGN-GUIDELINES (subsumed by CF-GOV-008).

---

## Decisions Required (not tasks)

These two items surfaced during the audit but are **decisions an implementer cannot pick up** — they require a doctrine choice from the project owner. They are deliberately separated from the severity-ordered finding list to prevent ambiguity ("which option am I supposed to do?").

### DEC-1 — Behavioral Guidelines vs Hard Rules ordering across all standalone SKILL.md files

- **Surfaced from**: CF-STANDALONE-016 (originally P3, D2)
- **Files affected**: All 12 standalone SKILL.md files (`skills/*/SKILL.md`)
- **Observation**: Every standalone SKILL.md places `## Behavioral Guidelines` block BEFORE `## Hard Rules`. The audit charter's D2 dimension cites "Hard Rules at top" as a primacy criterion, but the standalone rule's behavioral-discipline mandate (`.claude/rules/standalone-skills.md:15`) implicitly puts behavioral discipline early.
- **Decision needed**:
  - **Option A** — Reorder all 12 SKILL.md files so `## Hard Rules` comes first (after H1 + intro), with `## Behavioral Guidelines` second. Update `create-skill`/`improve-skill` templates to match. Propagates to all future generated skills.
  - **Option B** — Update audit doctrine (and the D2 dimension definition for future audits) to clarify that Hard Rules and Behavioral Guidelines have equal "top" priority, and current ordering is acceptable. No code changes; document the doctrine update.
- **Recommendation**: Option B. Behavioral discipline addresses *how the agent reasons*; Hard Rules address *what it must do*. Reasoning posture should be primed first because it shapes the interpretation of every subsequent rule. Cross-cutting consistency across all 12 standalone skills suggests this was an intentional choice; updating the doctrine is cheaper than reordering 12 files plus templates.

### DEC-2 — Cursor README Cost-and-Model-Guidance block product naming

- **Surfaced from**: CF-CURSOR-CUST-006 (originally P2, D1) and applies equally to `plugins/cursor-initializer/README.md`
- **Files affected**: `plugins/cursor-customizer/README.md:12-13`, `plugins/cursor-initializer/README.md:12-13`, `.github/instructions/readme-files.instructions.md` (the convention source)
- **Observation**: `.claude/rules/readme-files.md` mandates a verbatim "Cost and Model Guidance" block from `.github/instructions/readme-files.instructions.md`. That block names "Claude Opus" and "Claude Sonnet" by product. Strict reading of ADR-0002 (product-strict) makes this a Claude reference inside a Cursor README.
- **Decision needed**:
  - **Option A** — Update `.github/instructions/readme-files.instructions.md` to ship a Cursor-specific variant of the block using vendor-neutral framing ("frontier reasoning model" / "frontier balanced model"), and propagate the variant to both Cursor plugin READMEs.
  - **Option B** — Carve an explicit exception in ADR-0002 stating that Cursor plugin READMEs MAY name Anthropic products by name in the Cost-and-Model-Guidance block because Claude Code remains the most common harness end-users will run these plugins in.
- **Recommendation**: Option A. ADR-0002's product-strict policy is load-bearing for the Cursor distribution's identity; weakening it via exceptions risks rule erosion. Vendor-neutral framing serves users running other harnesses (Cursor IDE itself, GitHub Copilot, etc.) and avoids implying these are Anthropic-only artifacts.

---

## Recommended Implementation Order

Recommended fix order, top-down:

1. **Foundation — close ADR-0005 / ADR-0004 governance drift** (4 P0 GOV findings + RAG sweep). Without these, every standalone audit verdict remains ambiguous and stale ADRs accumulate.
2. **Cursor-customizer scope registry** (CF-GOV-005). Until it's in the matrix, the distribution can't be audited at all.
3. **Cursor product-strict cleanup** (CF-CURSOR-INIT-001/002/003, CF-CURSOR-CUST-001/002). The product-strict policy from ADR-0002 must be load-bearing.
4. **Standalone layer-split realignment** (CF-STANDALONE-001 rename + 002-012 reference fork + template strip). Largest cluster of fixes; enabled by step 1.
5. **Smart-zone budget reductions** (XC-2 cluster). Plugin initializers are the highest-impact.
6. **Phase-loading pattern fix** (XC-3 cluster). Same root cause as XC-2.
7. **Hook + subagent doctrine adds** (CF-CLAUDE-CUST-001/002). One-time additions to authoring guides.
8. **Behavioral Guidelines parity sweep** (XC-6 cluster).
9. **Improve-* deletion-test grounding** (XC-4 cluster).
10. **DESIGN-GUIDELINES self-duplication** (CF-GOV-008). Easy delete, large impact on doc-tool poisoning.
11. Remaining P2/P3 cleanup.

---

## Sources & Cross-References

- Wiki anchors: `[[validation-routing-claude]]`, `[[validation-routing-cursor]]`, `[[validation-routing-standalone]]`, `[[compliance-routing]]`, `[[context-engineering]]`, `[[progressive-disclosure]]`, `[[harness-engineering]]`, `[[pi-context-zone]]`, `[[evaluating-agents-paper]]`, `[[human-layer]]`
- Project rules: `.claude/rules/{plugin-skills,cursor-plugin-skills,standalone-skills,reference-files,agent-files,cursor-agent-files,readme-files,wiki-routing,compliance-maintenance,plugin-versioning}.md`
- ADRs: `docs/adr/{0001-cursor-distribution-rules-first,0002-product-strict-research-foundation,0003-cursor-skills-default-path,0004-wiki-first-knowledge-base-replaces-rag,0005-standalone-two-layer-scope}.md`
- Compliance: `docs/compliance/{normative-source-matrix,finding-model-and-validator-protocol,regression-prevention-workflow,artifact-audit-manifest,repository-global-validation-protocol}.md`
- Drift manifests: `plugins/{agents-initializer,agent-customizer,cursor-customizer}/docs-drift-manifest.md`, `skills/docs-drift-manifest.md`
