# Improvement Card Template

Phase 5 output format — present each improvement using this structure.
Source: improve-agents/SKILL.md:151-160 (extracted to reduce SKILL.md body size).

---

## Phase 5 Output Order

**1. Summary header** by category:
- Removals (bloat / stale / duplicates / contradictions)
- Refactoring (scope / domain / consolidation)
- Automation Migrations (hooks / rules / skills / subagents)
- Redundancy Eliminations
- Additions
- Validation summary: iteration count, final root line count, file-count delta, what each iteration fixed

**2. Per-suggestion structured card** in priority order (Removals → Refactoring → Automation Migrations → Redundancy Eliminations → Additions):

```
**WHAT**: Specific content and current location (file:lines)
**WHY**: Evidence-based justification with source reference
**TOKEN IMPACT**: Estimated tokens saved from always-loaded context
**OPTIONS**:
- **Option A** (recommended): Primary action
- **Option B**: Alternative action
- **Option C**: Keep as-is — "Preserve in current location. Trade-off: continues consuming ~X tokens per session"
```

Wait for the user's option selection on each suggestion before proceeding. If "Keep as-is", preserve in exact current location.

**3. Apply approved changes** (Option A or B) in dependency order. After each, verify all files <200 lines and no orphaned references.

**4. Final metrics**: total lines before → after; files before → after; estimated token savings; suggestions applied X of Y (Z deferred).
