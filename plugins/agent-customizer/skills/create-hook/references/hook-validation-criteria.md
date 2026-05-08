# Hook Validation Criteria

Quality checklist for generated and improved Claude Code hook configurations.
Source: hooks/claude-hook-reference-doc.md, hooks/automate-workflow-with-hooks.md

---

## Hard Limits (Auto-fail if violated)

Any hook violating these criteria must be fixed before proceeding:

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| JSON structure | Valid JSON; no syntax errors | hooks/claude-hook-reference-doc.md |
| Event name | From recognized 22-event list | hooks/claude-hook-reference-doc.md lines 22-46 |
| Handler type | `command`, `http`, `prompt`, or `agent` only | hooks/claude-hook-reference-doc.md lines 249-257 |
| `command` path | Script file exists and is executable *(validation-phase check; during staleness evaluation, relative paths are treated as plausible — see hook-evaluation-criteria.md)* | hooks/automate-workflow-with-hooks.md |
| Exit code behavior | Exit 2 effect is event-dependent — see full table in hook reference | Blocks execution on exit 2: PreToolUse, PermissionRequest, UserPromptSubmit, Stop, SubagentStop, TeammateIdle, TaskCompleted, ConfigChange, Elicitation, ElicitationResult. Any non-zero exit code fails creation (not just exit 2): WorktreeCreate. Shows stderr only (non-blocking): PostToolUse, PostToolUseFailure, Notification, SubagentStart, SessionStart, SessionEnd, PreCompact, PostCompact. Failures logged in debug mode only (not shown to user): WorktreeRemove. Exit code ignored: StopFailure, InstructionsLoaded. |

*Source: hooks/claude-hook-reference-doc.md "Exit code 2 behavior per event" table*

---

## Quality Checks (All must pass)

- [ ] Event type matches intent (PreToolUse for blocking, PostToolUse for observation)
- [ ] Matcher is specific (not `"*"` for blocking hooks)
- [ ] Error handling defined: exit 2 with meaningful stderr for blockable events; non-blockable events should provide informative stderr
- [ ] Silent success uses exit 0 (not leaving stderr output that confuses verbose mode)
- [ ] Successful runs produce no stdout/stderr output (silent success)
- [ ] Secrets not hardcoded in any hook configuration field (`command` strings, `headers`, URLs, or other values) — use environment variables
- [ ] `command` hook used for deterministic checks (not `agent` for simple regex checks)
- [ ] `prompt` or `agent` hook used only when judgment is genuinely required
- [ ] Evidence citations present: hook configuration documents why this event/handler/matcher was chosen, referencing hook-events-reference.md. **Note for JSON `command` hooks:** JSON has no comment syntax; evidence for event/matcher choices should be in the task card or improvement plan — not in the JSON itself. This criterion applies to `prompt` and `agent` hook instruction blocks where inline documentation is possible.
- [ ] Prompt engineering strategy applied: hook follows zero-shot approach (no examples in hook configs; deterministic command hooks over prompt/agent hooks)

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Existing blocking behavior not weakened (exit 2 not changed to exit 0)
- [ ] Matcher not broadened unintentionally (specific regex not replaced with `"*"`)
- [ ] Valid hooks not removed while fixing structure

**Structural:**

- [ ] Hook location remains appropriate (settings.json scope matches intended sharing)
- [ ] Multiple hooks for same event not consolidated if they serve different purposes

**Citation Traceability:**

- [ ] Every change made during improvement cites the specific evaluator finding ID (e.g., `V1`, `V3`) from Phase 1/2 analysis output that motivated the change — not just a generic reference to hook documentation

---

## Validation Loop Instructions

Execute this loop for each generated or improved hook:

1. Evaluate the hook against ALL criteria above
2. If ANY criterion fails: identify the specific failure, fix the hook, restart evaluation
3. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only proceed to writing hooks when ALL criteria pass

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.
