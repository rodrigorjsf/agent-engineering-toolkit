# Hook Validation Criteria

Quality checklist for generated and improved Cursor hook configurations.

---

## Contents

- Hard limits (auto-fail)
- Quality checks (event/intent fit, matcher specificity, error handling, secrets)
- Security gap checks (command injection, path traversal, secret exposure)
- Improve-operation additions (preservation, citation traceability)
- Validation loop instructions

---

## Hard Limits (Auto-fail if violated)

Any hook violating these criteria must be fixed before proceeding:

| Criterion | Threshold |
|-----------|-----------|
| JSON structure | Valid JSON; `version` present; `hooks` is an object |
| Event name | From the Cursor-native event vocabulary in `hook-events-reference.md`; reject any name not on that list (in particular, PascalCase event names that have no Cursor analogue) |
| Handler type | `command` (default) or `prompt` only |
| `command` path | Plausible relative to the configuration scope's working directory (project root for project hooks; `~/.cursor/` for user hooks); absolute paths must point to an existing executable |
| Matcher applicability | Matcher set only on events whose matcher field is documented in `hook-events-reference.md` |
| Exit-code semantics | `0` = success, `2` = block; other non-zero exits fail open by default — security-critical blocking hooks must set `failClosed: true` |


---

## Quality Checks (All must pass)

- [ ] Event matches intent — block-capable event used for blocking intent (`preToolUse`, `beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile`, `beforeSubmitPrompt`, `subagentStart`); observation-only event used for non-blocking intent (`postToolUse`, `afterShellExecution`, `afterMCPExecution`, `afterFileEdit`, `sessionStart`, `sessionEnd`, `preCompact`, `afterAgentResponse`, `afterAgentThought`)
- [ ] Matcher is specific — blocking hooks do not omit the matcher when the event supports one and the intent targets a specific tool, subagent type, or command pattern
- [ ] Matcher uses a regex value valid for the event's matcher field (per `hook-events-reference.md`)
- [ ] Error handling defined — exit `2` with meaningful stderr for blocking intent; `failClosed: true` set on security-critical blocking hooks (`beforeMCPExecution`, `beforeShellExecution`, `beforeReadFile`)
- [ ] Silent success — exit `0` does not leave spurious stderr output
- [ ] `command` hook used for deterministic checks (not `prompt` for simple regex checks)
- [ ] `prompt` hook used only when natural-language judgment is genuinely required
- [ ] Evidence citations present — the task card or improvement plan documents why this event/handler/matcher was chosen, referencing `hook-events-reference.md`. **Note:** JSON has no comment syntax; for `command` hooks, evidence lives in the task card / improvement plan, not in the hooks file itself
- [ ] Prompt-engineering strategy applied — zero-shot only; no few-shot examples in the hook configuration

---

## Security Gap Checks (All must pass)

- [ ] **Command injection** — `command` strings do not interpolate raw stdin fields without quoting; the documented hook script reads stdin into a variable and quotes every variable expansion (`"$VAR"`, never bare `$VAR`)
- [ ] **Path traversal** — when the hook receives a `file_path` from stdin, the script rejects values containing `..` segments before opening or executing
- [ ] **Secret exposure in logs** — `afterShellExecution`, `afterMCPExecution`, and any audit hook that forwards `output` / `result_json` redacts known secret patterns (API keys, tokens, passwords) before logging or transmitting them
- [ ] **Hardcoded secrets** — no literal credentials anywhere in the hook configuration (`command` strings, prompt text, headers, or other fields); environment variables (referenced via `$VAR` and quoted at use sites) are the only acceptable source
- [ ] **Workspace anchoring** — file paths used inside hook scripts derive from `CURSOR_PROJECT_DIR` rather than being hardcoded

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Existing blocking behavior not weakened (exit `2` not changed to exit `0`; `failClosed: true` not silently flipped to `false`)
- [ ] Matcher not broadened unintentionally (a specific regex not replaced with a permissive one)
- [ ] Valid hooks not removed while fixing structure

**Structural:**

- [ ] Hook location remains appropriate (project vs user scope matches intended sharing)
- [ ] Multiple hooks for the same event not consolidated if they serve distinct purposes

**Citation Traceability:**

- [ ] Every change made during improvement cites the specific evaluator finding (e.g., `V1`, `V3`) from the Phase 1 evaluation output that motivated the change — not just a generic reference to documentation

---

## Validation Loop Instructions

Execute this loop for each generated or improved hook:

1. Evaluate the hook against ALL criteria above
2. If ANY criterion fails: identify the specific failure, fix the hook, restart evaluation
3. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only proceed to writing hooks when ALL criteria pass

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.
