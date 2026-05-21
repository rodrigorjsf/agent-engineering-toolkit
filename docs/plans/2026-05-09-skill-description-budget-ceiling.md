# Skill Description Budget — Reduction & Enforcement

## Context

Claude Code 2.1.129+ enforces `skillListingBudgetFraction` (default `0.01` = 1% of context window) over the listing of all `SKILL.md` description metadata. When the listing exceeds the cap, low-priority descriptions are silently dropped — affected skills disappear from auto-invocation without runtime warning. On 200K-window models, the default budget is ≈2K tokens; raising to `0.02` (≈4K) costs ~3K tokens per session and burns rate limits faster.

Audit of this repo (2026-05-09) shows:

- 46 SKILL.md files across `.claude/skills/`, four plugin distributions, and the standalone `skills/` directory.
- 39/46 (85%) exceed 200 characters in `description:`.
- 17/46 (37%) exceed 300 characters.
- 25/46 (54%) are meta-skills that author other skills (`create-*`, `improve-*`, `init-*`, `write-a-skill`).

Source guidance (`docs/claude/skills-listing-budget.md` and `wiki/knowledge/skill-listing-budget.md`) recommends 100–150 chars, keyword-front-loaded, exception above 150 only when justified. ClaudeFast Code Kit averages 110–130 chars.

This plan introduces a project-level budget ceiling, encodes it across rules / ADR / glossary / authoring skills / review instructions, rewrites every over-budget description in the repo, and propagates the constraint prospectively to all future skill authoring work.

## Decisions

- **Target band** — sweet spot 110–150 chars; hard ceiling 200 chars; >200 requires explicit exception. Skills already <110 stay (no inflation).
- **Exception criteria** — permitted iff (1) skill triggers depend on enumerated user phrases/commands, (2) removing any trigger measurably degrades discovery, (3) justification stored as a custom YAML field **inside** the frontmatter (an HTML comment above `---` would break frontmatter parsing — confirmed against current repo files where `---` is always line 1), (4) absolute hard cap 400 chars even with exception. Exception field shape:
  ```yaml
  ---
  name: <skill-name>
  description: <up to 400 chars>
  description-budget-exception: <one-line reason; e.g. "enumerated trigger phrases required for discovery">
  ---
  ```
  YAML parsers tolerate unknown keys; existing frontmatter already uses non-standard keys (`paths:` in rule files, plugin-specific extensions in SKILL.md). The validator greps for `^description-budget-exception:` after the opening `---`.
- **Scope** — `description:` field of `SKILL.md` only. In: `.claude/skills/**`, `plugins/*/skills/**`, `skills/**`. Out: agents, hooks, rules (separate budgets, separate decision).
- **Enforcement** — two layers, no runtime hook:
  - Layer 1: canonical path-scoped rule + cross-references from existing distribution rules.
  - Layer 2: every authoring skill (`write-a-skill`, `create-skill` ×3, `improve-skill` ×3, `init-agents`/`init-claude`/`init-cursor`/`improve-agents`/`improve-claude`/`improve-cursor`) gains a self-validation step that rejects output if `description` > 200 chars and lacks the exception comment.
- **Canonical rule location** — new `.claude/rules/skill-description-budget.md` with `paths: ["**/SKILL.md"]`. Three existing rules (`plugin-skills.md`, `cursor-plugin-skills.md`, `standalone-skills.md`) cross-reference it; the schema-level `≤1024 chars` line stays (upstream Claude Code spec) and the new 200-char project ceiling is layered on top.
- **ADR-0007** — `docs/adr/0007-skill-description-budget-ceiling.md` records the trade-off (silent skill loss vs. per-session token cost), the chosen ceiling, and consequences for prospective authoring.
- **CONTEXT.md term** — adds "Skill description budget" glossary entry pointing at ADR-0007 and `[[skill-listing-budget]]`.
- **Commit ordering** — 18 atomic commits, dependency-aware (see Implementation Sequence below).
- **`/dream` cadence** — twice, bookended: after commit 4 and after commit 18.
- **Rewrite execution** — inline composition by main thread, batched per distribution, advisor() review per batch before commit.
- **Verification** — audit script + four quality-gate skills + advisor() final review + smoke test on `agent-customizer:create-skill`.

## Critical Files

### Created

- `.claude/rules/skill-description-budget.md` — canonical project rule.
- `docs/adr/0007-skill-description-budget-ceiling.md` — architectural decision record.

### Edited (rules + docs canon)

- `.claude/rules/plugin-skills.md` — append cross-reference line.
- `.claude/rules/cursor-plugin-skills.md` — append cross-reference line.
- `.claude/rules/standalone-skills.md` — append cross-reference line.
- `CONTEXT.md` — add glossary term.
- `wiki/knowledge/skill-listing-budget.md` — note the 110/150/200 project ceiling and link ADR-0007.
- `wiki/knowledge/index.md` — refresh entry summary if needed; append `wiki/knowledge/log.md` entry.
- `.github/instructions/skill-files.instructions.md` — surface the 200-char ceiling as review criterion.
- `.github/instructions/agent-skills.instructions.md` — same.

### Edited (authoring skills self-validation — Layer 2)

For each, extend the existing self-validation phase in `SKILL.md` (and any explicit `references/skill-validation-criteria.md`) to check the description budget rule:

- `.claude/skills/write-a-skill/SKILL.md`
- `plugins/agent-customizer/skills/create-skill/SKILL.md` + `references/skill-validation-criteria.md`
- `plugins/agent-customizer/skills/improve-skill/SKILL.md`
- `plugins/cursor-customizer/skills/create-skill/SKILL.md` + `references/skill-validation-criteria.md`
- `plugins/cursor-customizer/skills/improve-skill/SKILL.md`
- `skills/create-skill/SKILL.md` + `references/skill-validation-criteria.md`
- `skills/improve-skill/SKILL.md`
- `plugins/agents-initializer/skills/init-agents/SKILL.md` + `init-claude/SKILL.md` + `improve-agents/SKILL.md` + `improve-claude/SKILL.md`
- `plugins/cursor-initializer/skills/init-cursor/SKILL.md` + `improve-cursor/SKILL.md`
- `skills/init-agents/SKILL.md` + `improve-agents/SKILL.md`

Note the parity family: the three `references/skill-validation-criteria.md` copies (agent-customizer, cursor-customizer, standalone) must stay character-identical except for distribution-specific path examples — per `.claude/rules/compliance-maintenance.md`.

### Edited (description rewrites — 39 SKILL.md files)

Every SKILL.md flagged OVER (22) or WAY-OVER (17) in the audit. List preserved in `.claude/plans/.../audit-2026-05-09.md` (generated as scratchpad during execution, not committed).

## Reused Patterns / Existing Utilities

- `wiki/knowledge/skill-listing-budget.md` already documents the budget mechanic — the new rule cites it instead of redefining the math.
- `wiki/knowledge/claude-code-skills.md` already has frontmatter rules — new rule defers to it for `name`/`description` syntax and only adds the project ceiling.
- `docs/adr/0006-distribution-content-boundary.md` is the structural precedent for cross-distribution authoring rules — ADR-0007 follows the same template.
- `.claude/rules/compliance-maintenance.md` already requires parity families to stay in sync — applies automatically to the three `skill-validation-criteria.md` copies once they're updated.
- Existing `karpathy-guidelines.instructions.md` referenced from `skill-files.instructions.md` already pushes "concise" — new instruction line strengthens this with the explicit 200-char ceiling.

## Implementation Sequence

Execute in order. Run `advisor()` at the start of each major phase (rule canon, meta-skill update, rewrites). Run `/dream` after commit 4 and after commit 18.

### Phase A — Canonical Surface (commits 1–4)

1. **`docs(adr): add ADR-0007 skill description budget ceiling`** — `docs/adr/0007-skill-description-budget-ceiling.md`.
2. **`docs(context): add skill description budget glossary term`** — `CONTEXT.md`.
3. **`feat(rules): add skill-description-budget.md rule`** — `.claude/rules/skill-description-budget.md`.
4. **`fix(rules): cross-reference budget rule from skill rules`** — `plugin-skills.md`, `cursor-plugin-skills.md`, `standalone-skills.md`.

→ `/dream` checkpoint #1.

### Phase B — Meta-skill Self-Validation (commits 5–10)

For each, add a validation step to existing self-validation phase: refuse output if `description` > 200 chars without an exception comment.

5. **`fix(plugin/agent-customizer): self-validate description budget`** — touches the four create-/improve- SKILL.md and `references/skill-validation-criteria.md`.
6. **`fix(plugin/cursor-customizer): self-validate description budget`** — same shape; preserve parity-family character-identical content.
7. **`fix(plugin/agents-initializer): self-validate description budget`** — init-agents, init-claude, improve-agents, improve-claude.
8. **`fix(plugin/cursor-initializer): self-validate description budget`** — init-cursor, improve-cursor.
9. **`fix(skills): self-validate description budget (standalone)`** — create-skill, improve-skill, init-agents, improve-agents + parity reference.
10. **`fix(.claude/skills): self-validate description budget (project meta)`** — `.claude/skills/write-a-skill/SKILL.md`.

### Phase C — Description Rewrites (commits 11–16)

For each batch, the main thread:
  i.  composes new description preserving all trigger keywords from the original;
  ii. verifies length 110–200 (or attaches exception comment with `cap=400`);
  iii. produces the diff for the batch;
  iv. calls `advisor()` to look for lost triggers / weak keyword density;
  v.  applies Edit and commits.

11. **`fix(.claude/skills): trim descriptions to budget`** — 17 project skills (`wiki-lint`, `wiki-ingest`, `setup-matt-pocock-skills`, `cursor-customizer-quality-gate`, `quality-gate`, `agent-customizer-quality-gate`, `update-review-instructions`, `cursor-initializer-quality-gate`, `improve-codebase-architecture`, `diagnose`, `grill-with-docs`, `caveman` [263 chars], `to-issues`, `receiving-code-review`, `grill-me`, `triage`, `tdd`).
12. **`fix(plugin/agent-customizer): trim skill descriptions to budget`** — 5 skills (`create-skill`, `improve-subagent`, `create-subagent`, `improve-hook`, `improve-skill`).
13. **`fix(plugin/cursor-customizer): trim skill descriptions to budget`** — 8 skills (`improve-subagent`, `create-rule`, `improve-rule`, `create-subagent`, `improve-hook`, `create-skill`, `improve-skill`, `create-hook`).
14. **`fix(plugin/agents-initializer): trim skill descriptions to budget`** — 4 skills (`init-agents`, `init-claude`, `improve-claude`, `improve-agents`).
15. **`fix(plugin/cursor-initializer): trim skill descriptions to budget`** — 2 skills (`init-cursor`, `improve-cursor`).
16. **`fix(skills): trim standalone skill descriptions to budget`** — 4 skills (`improve-agents`, `init-agents`, `improve-skill`, `create-skill`).

Total Phase C: **40 SKILL.md files** rewritten. (Original audit table had a triage bucketing error and missed caveman due to multi-line scalar parsing; this list reflects the Python YAML re-audit.)

### Phase D — Documentation Surfaces (commits 17–18)

17. **`docs(wiki): note 200-char project ceiling`** — `wiki/knowledge/skill-listing-budget.md`, `wiki/knowledge/index.md`, `wiki/knowledge/log.md`.
18. **`docs(github): update review-instruction files for budget rule`** — `.github/instructions/skill-files.instructions.md`, `agent-skills.instructions.md`.

→ `/dream` checkpoint #2.

## Description Rewrite Heuristic

Used during Phase C to compose each new description. Applied uniformly:

1. Keep verb that names the action ("Reviews", "Generates", "Audits", "Triages").
2. List 1–3 trigger keywords (the user-typed phrases that should match), separated by commas.
3. State the WHEN with a "Use when…" clause naming the most common scenario in ≤8 words.
4. Drop marketing prose, feature lists, and adjectives ("comprehensive", "thorough", "detailed", "robust").
5. Drop redundant restatements of the skill name.
6. Keep technical artifact names (e.g., `SKILL.md`, `.claude/rules/`, `CLAUDE.md`) verbatim.
7. Front-load the most distinctive keyword in the first 50 chars.
8. Verify char count via Python YAML (the same script used in Verification — single-line awk misses `description: >` multi-line scalars used by skills like `caveman`):
   ```sh
   python3 -c "import yaml,re,sys; t=open('SKILL.md').read(); m=re.match(r'^---\n(.*?)\n---', t, re.S); fm=yaml.safe_load(m.group(1)); print(len(fm['description']))"
   ```

If composed result exceeds 200 chars and shorter formulations measurably lose trigger keywords, add the exception field **inside** the frontmatter:
```yaml
---
name: <skill>
description: <up to 400 chars>
description-budget-exception: <one-line reason>
---
```
Never place an HTML comment above the opening `---` — every existing SKILL.md has `---` on line 1, and a leading comment would break frontmatter parsing.

## Self-Validation Step (Layer 2)

Inserted into the self-validation phase of every authoring skill. Body template (in English, per repo CLAUDE.md):

```markdown
### Description budget self-check

Before writing the SKILL.md, validate the proposed `description:` field:

1. Measure character length (handle `description: >` and `description: |`
   multi-line scalars by parsing YAML, not single-line awk).
2. If > 200 chars: confirm enumerated trigger phrases are required for
   discovery AND add the field inside the frontmatter (NOT as an HTML
   comment above `---`, which would break parsing):
   `description-budget-exception: <one-line reason>`
3. Hard fail and rewrite if length > 400 chars under any condition.
4. Front-load the most distinctive keyword in the first 50 characters.
5. Reference: `.claude/rules/skill-description-budget.md`,
   wiki [[skill-listing-budget]], ADR-0007.
```

The exact wording lives in the new rule and is referenced (not duplicated) by each authoring skill, except where a skill's own conventions require a localized version (parity-family copies in `references/skill-validation-criteria.md`).

## Verification

Acceptance gates — all must pass before PR is merged:

1. **Audit re-run** — after commit 16. Use Python YAML (handles `description: >` and `description: |` multi-line scalars correctly; pure awk misses them):
   ```sh
   for f in $(find .claude/skills plugins/*/skills skills -name SKILL.md); do
     python3 - "$f" <<'PY'
   import sys, re, yaml
   p = sys.argv[1]
   t = open(p).read()
   m = re.match(r'^---\n(.*?)\n---', t, re.S)
   if not m: print('NO-FRONTMATTER', p); sys.exit()
   fm = yaml.safe_load(m.group(1)) or {}
   d = fm.get('description', '')
   if len(d) > 200 and 'description-budget-exception' not in fm:
     print('FAIL', len(d), p)
   PY
   done
   ```
   Expected: zero `FAIL` lines and zero `NO-FRONTMATTER` lines.

2. **Quality-gate skills** — after Phase B and Phase C complete:
   - `/agent-customizer-quality-gate`
   - `/cursor-customizer-quality-gate`
   - `/cursor-initializer-quality-gate`
   - `/quality-gate` (agents-initializer)

   Expected: zero P0/P1 findings related to description budget.

3. **Smoke test on authoring skill** — after Phase B:
   - Invoke `agent-customizer:create-skill` with a deliberately-bloated 280-char description; expect rejection + rewrite prompt.
   - Repeat with a 130-char description; expect acceptance.

4. **`advisor()` final review** — before opening PR, with full diff in context. Probes: lost triggers in any rewritten description, ADR-0007 alignment, drift between agent-customizer / cursor-customizer parity-family files, wiki/CONTEXT cross-link integrity.

5. **Compound-engineering code review** — `/compound-engineering:ce-code-review` per repo CLAUDE.md "Implementation Completion Protocol"; resolve P0/P1 findings before stopping.

## Out of Scope

- Caveman skills, `claude-api`, and other user-global skills under `~/.claude/skills/` — outside repo, separate decision.
- Hook command descriptions, agent-file `description:` fields, `.cursor/rules/*.mdc` descriptions — separate budgets, separate plan.
- Raising `skillListingBudgetFraction` above `0.01` in repo `.claude/settings.json` — explicitly avoided; the design point of this plan is to fit under the default budget.
- Automated PostToolUse hook for runtime enforcement — explicitly avoided per Q4; authoring discipline is enforced at the skill-authoring layer instead.

## Risk & Rollback

- **Lost triggers.** Mitigation: per-batch advisor() review in Phase C; final advisor() before PR. If a trigger is lost post-merge, append it back via a single `fix(skill): restore trigger keyword` commit.
- **Parity drift.** Mitigation: edit parity-family `references/skill-validation-criteria.md` files in lockstep within each Phase B commit; lint via `.claude/rules/compliance-maintenance.md` checks.
- **Schema collision.** Risk: a future Claude Code release tightens `description` schema (e.g., from 1024 to 256 chars). Mitigation: ADR-0007 documents both the upstream schema (1024) and the project ceiling (200) as separate concepts; if upstream tightens, only ADR-0007 needs amending.
- **Rollback.** Each commit is atomic. Reverting commits 11–16 alone restores the old descriptions. Reverting commits 5–10 disables the validator without affecting rewritten descriptions. Reverting commits 1–4 removes the canonical rule but the rewrites are still benign.
