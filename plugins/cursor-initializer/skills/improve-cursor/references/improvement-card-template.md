# Improvement Card Template

Phase 5 output format. Source: improve-cursor/SKILL.md (extracted to reduce SKILL.md body size).

---

## Phase 5 Output Order

**1. Summary header** by category (include Migration row only if sub-flow ran):

- Removals (bloat / stale / duplicates / contradictions)
- Refactoring (rule conversion / activation-mode fix / consolidation)
- Automation Migrations (hooks / rules / skills / subagents)
- Redundancy Eliminations
- Additions
- Migration sub-flow (only if it ran): new rules created from AGENTS.md, discarded blocks
- Validation summary: iteration count, file-count delta, rule-count delta, what each iteration fixed

**2. Per-suggestion structured card** in priority order (Removals → Refactoring → Automation Migrations → Redundancy Eliminations → Additions → Migration sub-flow):

```
**WHAT**: Specific content and current location (file:lines)
**WHY**: Evidence-based justification with source reference
**TOKEN IMPACT**: Estimated tokens saved from always-loaded context
**OPTIONS**:
- **Option A** (recommended): Primary action
- **Option B**: Alternative action
- **Option C**: Keep as-is — "Preserve in current location. Trade-off: continues consuming ~X tokens per session"
```

Wait for the user's option selection on each suggestion. If "Keep as-is", preserve in exact current location.

**3. Aggregate token-impact**: always-loaded tokens before → after; on-demand tokens before → after; total tokens removed; deferred count.

**4. Apply approved changes** (Option A or B) in dependency order. Migration sub-flow writes new rule files but NEVER touches the original AGENTS.md. After each change, verify: `.mdc` files <200 lines; no orphan references; frontmatter valid (only `description`, `alwaysApply`, `globs`).

**5. Final metrics**: total lines before → after across `.cursor/rules/`; always-loaded lines before → after; rules before → after; estimated token savings per session; suggestions applied X of Y (Z deferred). If sub-flow ran, confirm AGENTS.md untouched and the manual-removal notification was presented.
