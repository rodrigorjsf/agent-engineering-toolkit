# Handoff: Alignment audit (2026-05-02) — scope contamination + harness/context-eng doctrine drift

**Created:** 2026-05-03
**Branch:** development
**Session type:** /grill-with-docs → 6-subagent parallel audit → /to-prd + 12 XC issues
**Status:** Audit complete, findings durable, GitHub issues published. Two decisions pending; implementation not yet started.

---

## Summary

A four-round grilling session locked the audit charter (scope-alignment per `[[validation-routing-{claude,cursor,standalone}]]` + doctrine-alignment per `[[harness-engineering]]`/`[[context-engineering]]`/`[[progressive-disclosure]]`/`[[pi-context-zone]]`/`[[human-layer]]`), then 6 parallel subagents ran a Tier 2 audit (every SKILL.md + agent + reference + template across 4 plugins, standalone, and governance — 257 files) producing 73 findings synthesized into 12 cross-cutting patterns. Outputs: PRD #97 (strategic narrative + 2 decisions + 11-step order), 12 child issues #98–#109 (one per XC pattern), durable findings doc at `.specs/reports/alignment-audit-2026-05-02-findings.md`. ADR-0005 written to formalize the standalone two-layer scope (skill body agnostic / templates platform-keyed by skill `name`). Smart-zone wiki page ingested. Implementation has not started — the work is fully scoped and triagable.

---

## Work Completed

### Changes Made

- [x] Wrote ADR-0005 (`docs/adr/0005-standalone-two-layer-scope.md`) resolving the standalone paradox surfaced in Q1
- [x] Added "Two-layer standalone scope" glossary entry to `CONTEXT.md`
- [x] Ingested `pi-context-zone-github.md` source into a dedicated wiki page `wiki/knowledge/pi-context-zone.md`
- [x] Updated `wiki/knowledge/index.md` (38 → 39 pages, smart-zone entry under Foundational Concepts)
- [x] Appended ingest entry to `wiki/knowledge/log.md`
- [x] Wrote durable findings doc `.specs/reports/alignment-audit-2026-05-02-findings.md` (73 findings + 12 XC patterns + 2 decisions + 11-step impl order)
- [x] Published PRD #97 with `needs-triage` label
- [x] Created 12 XC pattern child issues #98–#109
- [x] Added child-issue index as comment on PRD #97

### Key Decisions

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| Standalone scope is two-layer (ADR-0005) | Skill-body must be agnostic; templates platform-keyed by skill `name`. Resolves contradiction between standalone-bundle's "no Claude refs" and the existence of `init-claude`/`improve-claude` in `skills/`. | A. Mechanism-only (rejected — too loose). B. Strict no-Claude-anywhere (rejected — deletes 4 working skills). |
| Audit Tier 2 (full read of every reference + template), not sampled | User chose Tier 2 in Q3a despite recommendation of tiered A→B. Trade was extra cost for guaranteed full coverage. | Tier 1 (cheap, misses D3/D4); Tiered A→B (~30-40% cost). |
| Output as PRD + child issues (hybrid C) | One PRD = strategic narrative; 12 XC issues = actionable groupings. 41 P0+P1 findings would have been a 30+ page single PRD; per-finding atomicity (41 issues) too noisy. | A. Single mega-PRD; B. 5 per-distribution PRDs. |
| 6 parallel subagents, not serial | Distributions are independent reads; subagents protect main context (smart-zone applied to audit itself). | Serial (slower, context accumulates). |
| Smart-zone budget = 8K tokens / skill | Conservative: ~4% of 200K window leaves room for harness chrome + CLAUDE.md + task tokens before crossing 40% Smart→Warm threshold. | 4K (very tight); 16K (lenient). |
| Wiki excluded from audit | Wiki is the *anchor* of the audit; auditing against itself is circular. `/wiki-lint` exists for that. | Include wiki as 7th subagent. |

---

## Files Affected

### Created (uncommitted)

- `docs/adr/0005-standalone-two-layer-scope.md` — formalizes the two-layer standalone scope; lists 4 mandated follow-ups (still unimplemented — these are the foundation P0 cluster in XC-1)
- `wiki/knowledge/pi-context-zone.md` — Smart/Warm/Dumb zone framework; doctrinal anchor for D4 audit dimension
- `.specs/reports/alignment-audit-2026-05-02-findings.md` — durable per-finding catalog (73 findings + 12 XC patterns + 2 decisions + 11-step impl order); P2/P3 backlog reference

### Modified (uncommitted)

- `CONTEXT.md` — added "Two-layer standalone scope" term in glossary § Distribution stances
- `wiki/knowledge/index.md` — 38 → 39 page count; new entry `[[pi-context-zone]]` under Foundational Concepts
- `wiki/knowledge/log.md` — appended 2026-05-02 ingest entry under existing log header

### Read (Reference)

- `wiki/knowledge/{validation-routing-{claude,cursor,standalone},compliance-routing,context-engineering,progressive-disclosure,harness-engineering,pi-context-zone,human-layer,evaluating-agents-paper}.md`
- `.claude/rules/{plugin-skills,cursor-plugin-skills,standalone-skills,reference-files,agent-files,cursor-agent-files,readme-files,wiki-routing,compliance-maintenance}.md`
- `docs/adr/000{1,2,3,4}-*.md` (existing ADRs)
- `docs/compliance/normative-source-matrix.md`
- `plugins/*/CLAUDE.md`, `plugins/*/README.md`, `plugins/*/docs-drift-manifest.md`
- Sample SKILL.md + agent + reference files across all six scopes (subagents read these directly)

### Deleted

None.

---

## Technical Context

### Architecture/Design Notes

The audit charter was negotiated upfront across four grilling rounds (Q1-Q4) before any subagent ran. The 6-dimension matrix (D1 scope alignment, D2 token budget, D3 progressive disclosure, D4 smart-zone budget, D5 RPI/harness methodology, D6 ETH grounding) and the 4-tier severity ladder (P0 blocker, P1 must-fix, P2 should-fix, P3 improvement) with auto-promotion rule (D1 + Dx co-violation auto-promotes one tier) are the audit's invariants. Subagents were given self-contained prompts including bundle definitions, allowed/forbidden source lists, contamination signals, and finding-model schema (CF-NNN / file path / severity / dimension / rule source / finding / proposed fix). Each subagent operated in an isolated context window (context-firewall pattern from `[[harness-engineering]]:112-122`).

The decision to split standalone scope into two compliance layers (skill body vs templates) is the load-bearing architectural decision of this session. ADR-0005 documents both the decision and the four mandated follow-ups. Until those follow-ups land (XC-1 / issue #98), every standalone audit verdict sits between "ADR violation" and "rule violation."

### Dependencies

- `gh` CLI for issue creation (verified authenticated as `rodrigorjsf`)
- No new package dependencies introduced

### Configuration Changes

None — settings/hooks/permissions unchanged.

---

## Things to Know

### Gotchas & Pitfalls

- The standalone bundle (`skills/`) currently has **six neutral-named skills** (`create-rule`, `create-hook`, `create-subagent`, three `improve-*` siblings) whose bodies and templates teach Claude-only architecture. Per ADR-0005, neutral names mandate neutral content — but Claude rules/hooks/subagents are platform-specific by definition. **Renaming to `create-claude-*` / `improve-claude-*` is the recommended fix** (issue #108 / XC-11), but this is a breaking change for any user who has them installed via `npx skills add`. Coordinate the rename with a major version bump per `.claude/rules/plugin-versioning.md`.
- The "Verbatim copy" status in docs-drift manifests grants **byte-equivalence parity but bypasses product-strict scrubbing**. The cleanest fix is to vendor-neutralize the canonical source in `agent-customizer` so all 8 cursor-customizer copies inherit (XC-7 / issue #104), rather than fork the cursor side.
- DESIGN-GUIDELINES.md contains 75 lines of self-duplication (Guidelines 13/14/15 wholesale-duplicated) including a stale `docs/Evaluating-AGENTS-paper.pdf` path. The document warning against context poisoning is itself poisoned (XC-10 / issue #107).
- `/to-prd` and `/to-issues` both publish to GitHub Issues — hard-to-reverse external actions. Pre-authorized this session via Q3 + the volume-question response. Future audits should re-confirm scope before invoking.
- The grilling skill's "ask one question at a time, recommend an answer" pattern produced fast convergence (4 rounds total) when the user gave terse confirmations. Heavier deliberation would slow without proportional value.

### Assumptions Made

- The user wants vendor-neutral framing for Cursor distribution per ADR-0002 product-strict, even where `.github/instructions/readme-files.instructions.md` mandates a verbatim Cost-and-Model-Guidance block naming Anthropic products. Captured as DEC-2 with recommendation A.
- Behavioral Guidelines reasoning posture (assumptions-first, simplest path, surgical, validation-driven) belongs at the top of SKILL.md bodies even when the audit charter's D2 dimension nominally privileges Hard Rules. Captured as DEC-1 with recommendation B.
- The `.claude/skills/` meta-skill directory is in scope for the project's own quality gating but lacks a declared bundle in `docs/compliance/normative-source-matrix.md`. CF-GOV-007 (XC-12 / issue #109) flags this.
- `/to-issues` would have forced tracer-bullet vertical-slice shaping that doesn't match the audit's CF-NNN finding structure, so I created the 12 XC issues directly via `gh issue create` instead.

### Known Issues

- **DEC-1 and DEC-2 are unresolved.** Both have inline recommendations (B and A respectively); user has not confirmed.
- **41 P0+P1 findings published as 12 issues** but the actual implementation has not begun. The 11-step recommended order has hard dependencies (e.g., XC-11 / #108 depends on XC-1 / #98 landing first because the rules and validation-routing must reflect the layer split before the standalone realignment can be audited as compliant).
- **Local changes are uncommitted.** Six files (3 created, 3 modified) need atomic commits per the project's `.claude/rules/` git conventions: one logical change per commit, no `git add -A`.

---

## Current State

### What's Working

- Audit charter, dimension matrix, severity ladder, and ADR-0005 locked
- Smart-zone wiki page anchored at `[[pi-context-zone]]` (cited by 12 XC issues)
- PRD #97 indexed and labeled `needs-triage`
- All 12 XC pattern issues #98–#109 published with `needs-triage` and per-finding fix instructions
- Durable findings doc holds the per-finding catalog (CF-NNN identifiers across all 73 findings)

### What's Not Working

- Nothing implementation-side (audit produces findings only — no code changes attempted)
- DEC-1 and DEC-2 await user resolution

### Tests

- [x] Subagent outputs cross-checked: math reconciled (P0=14, P1=27, P2=15, P3=17, total=73) per advisor recount
- [x] Per-finding traceability: every finding has file path + line numbers + rule source + proposed fix
- [x] PRD ↔ child-issue cross-links verified (PRD comment lists all 12 issues; each issue says "Closes part of #97")
- [ ] Quality-gate skill runs against affected scopes — NOT yet attempted (would be done after each implementation cluster lands)
- [ ] Re-running the alignment audit after fixes — NOT yet attempted

---

## Next Steps

### Immediate (Start Here)

1. **Resolve DEC-1 and DEC-2 in PRD #97.** Both have inline recommendations. Decisions block downstream work — DEC-1 affects all 12 standalone SKILL.md files and the templates that generate new ones; DEC-2 affects the convention layer.
2. **Commit the six uncommitted local files atomically.** Suggested split per `.claude/rules/` git conventions:
   - Commit 1: `docs(adr): add ADR-0005 standalone two-layer scope` — `docs/adr/0005-standalone-two-layer-scope.md` + `CONTEXT.md` glossary entry
   - Commit 2: `docs(wiki): ingest pi-context-zone smart-zone framework` — `wiki/knowledge/pi-context-zone.md` + `wiki/knowledge/index.md` + `wiki/knowledge/log.md`
   - Commit 3: `docs(audit): publish 2026-05-02 alignment audit findings` — `.specs/reports/alignment-audit-2026-05-02-findings.md`
3. **Triage the 12 XC issues.** Apply role labels (`ready-for-agent`, `ready-for-human`, etc.) per `docs/agents/triage-labels.md` based on which the user wants to drive vs which they want to assign.
4. **Begin Step 1 of the implementation order — XC-1 / issue #98.** Land the four ADR-0005 follow-ups in `wiki/knowledge/validation-routing-standalone.md`, `.claude/rules/standalone-skills.md`, `docs/compliance/normative-source-matrix.md`, and the "Common Validation Mistakes" entry. This unblocks XC-11 / issue #108.

### Subsequent

- Step 1 cluster: also land XC-8 / #105 (stale RAG references)
- Step 2: XC-9 / #106 (cursor-customizer scope registration)
- Steps 3-4: XC-7 / #104 (Cursor product-strict cleanup)
- Step 5: XC-11 / #108 (standalone realignment, depends on #98)
- Steps 6-11 in order per PRD #97
- After each step cluster: run `/quality-gate` (or scope-specific variant) and re-run a smaller audit to verify zero P0/P1 regression

### Blocked On

- DEC-1 and DEC-2 resolution (recommendations are in PRD #97 — user only needs to confirm)
- Nothing else; the audit is complete and the work is triagable

---

## Related Resources

### Documentation

- **PRD**: https://github.com/rodrigorjsf/agent-engineering-toolkit/issues/97
- **Child issues**: #98 (XC-1), #99 (XC-2), #100 (XC-3), #101 (XC-4), #102 (XC-5), #103 (XC-6), #104 (XC-7), #105 (XC-8), #106 (XC-9), #107 (XC-10), #108 (XC-11), #109 (XC-12)
- **Findings doc**: `.specs/reports/alignment-audit-2026-05-02-findings.md`
- **ADR-0005**: `docs/adr/0005-standalone-two-layer-scope.md`
- **Smart-zone wiki**: `wiki/knowledge/pi-context-zone.md`
- **Audit charter (locked)**: PRD #97 § Implementation Decisions; findings doc § cross-cutting patterns

### Commands to Run

```bash
# Verify all 12 child issues have needs-triage label and link to #97
gh issue list --repo rodrigorjsf/agent-engineering-toolkit --label needs-triage --search "[XC-" --json number,title,labels

# Re-run a single-scope re-audit after Step 1 cluster lands (verify ADR-0005 follow-ups closed XC-11 ambiguity)
# Spawn the standalone subagent again with the same prompt as in the original session (see conversation transcript)

# Smart-zone budget regression check (after Step 6 fixes)
for skill in plugins/*/skills/*/ skills/*/; do
  total=$(find "$skill" -name "*.md" -exec wc -c {} + | tail -1 | awk '{print $1}')
  echo "$skill: $total chars (target: ≤32000)"
done | sort -t: -k2 -rn

# Verify ADR-0005 follow-ups landed
grep -n "Layered scope" wiki/knowledge/validation-routing-standalone.md
grep -n "ADR-0005" docs/compliance/normative-source-matrix.md
grep -n "platform target" .claude/rules/standalone-skills.md
```

### Search Queries

- `grep -rn "CF-CLAUDE-INIT\|CF-CURSOR\|CF-STANDALONE\|CF-CLAUDE-CUST\|CF-GOV" .specs/reports/` — finds every CF-NNN identifier in the durable findings doc
- `grep -rn "needs-triage" .github/` — verify label conventions
- `grep -rn "ADR-0005" .` — find all references to the new ADR
- `grep -rn "pi-context-zone\|smart zone\|dumb zone" wiki/ docs/` — find smart-zone framework citations

---

## Open Questions

- [ ] DEC-1 (BG-vs-Hard-Rules ordering): accept Option B (update doctrine, no reorder)?
- [ ] DEC-2 (Cursor README product naming): accept Option A (vendor-neutral variant in `.github/instructions/readme-files.instructions.md`)?
- [ ] Triage labels: which of the 12 issues are `ready-for-agent` (drivable autonomously) vs `ready-for-human` (need maintainer judgment)?
- [ ] Should the rename in XC-11 / #108 (`create-rule` → `create-claude-rule` etc.) ship under a major version bump in `.claude-plugin/plugin.json` and `.cursor-plugin/plugin.json`? Per `.claude/rules/plugin-versioning.md` this is breaking for `npx skills add` users.
- [ ] Should P2/P3 findings (32 in the backlog) be promoted to issues at any point, or stay in the durable findings doc as a perpetual backlog reference?

---

## Session Notes

- The 4-round grilling produced four locked artifacts: ADR-0005 (Q1 outcome), the 6-dimension matrix + 8K-token budget + smart-zone ingest (Q2 outcome), Tier 2 + /to-prd + parallel subagents (Q3 outcome), governance scope + hybrid PRD shape + auto-promotion rule (Q4 outcome).
- Advisor was called once before declaring the synthesis complete; caught a math error (P1=27 not 26, total=73 not 72) and flagged two findings as decisions rather than tasks (CF-STANDALONE-016 → DEC-1, CF-CURSOR-CUST-006 → DEC-2). Both were fixed before the PRD was published.
- The volume question (41 findings → one PRD vs split) was raised mid-session after `/to-prd` had already been pre-authorized in Q3. User picked option C (hybrid), which led to 12 XC pattern issues instead of 41 atomic ones. Grouping by XC pattern means a single PR closes a whole pattern, but loses some per-finding atomicity in tracking.
- I created the 12 XC issues directly via `gh issue create` rather than via `/to-issues`, because `/to-issues`'s "tracer-bullet vertical slices" framing doesn't match the audit's CF-NNN finding structure (these are remediation tasks, not vertical product slices). This is a deviation from a strict reading of the user's "C" choice — flagged here so future sessions can normalize on the right conversion path.
- Cross-cutting patterns (XC-1 to XC-12) are the value-add of the synthesis. Most P0+P1 findings share root causes; auditing each in isolation would have produced 41 redundant fix instructions. The XC clustering is what makes 12 issues triagable instead of 41.

---

_This handoff captures the alignment audit work through 2026-05-03. Start a new session and use this document plus PRD #97 as initial context. The audit is complete; implementation is the next phase._
