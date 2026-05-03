# Hook Evaluation Criteria

Scoring rubric for assessing existing Cursor hook configurations before improvement.
Source: docs/cursor/hooks/hooks-guide.md

---

## Contents

- Hard limits table (JSON validity, recognized events, valid matchers)
- Bloat indicators table (overly broad matchers, redundant hooks)
- Staleness indicators table (deprecated event names, invalid tools)
- Quality assessment (event selection, error handling, security)
- Quality score rubric (5-dimension scoring 1-10)
- Evaluation output template

---

## Hard Limits Table

| Criterion | Threshold |
|-----------|-----------|
| JSON configuration | Valid JSON; `version` present; `hooks` is an object |
| Event name | From the Cursor-native event vocabulary in `hook-events-reference.md` |
| Handler type | `command` (default) or `prompt` |
| Matcher field | Valid regex string or empty / omitted |
| Command path | Absolute paths must resolve to an existing executable; relative paths (e.g., `.cursor/hooks/*.sh`) are plausible relative to the configuration scope's working directory and must not be flagged INVALID |

A hook configuration violating any hard limit is flagged **INVALID** regardless of intent.

*Source: docs/cursor/hooks/hooks-guide.md "Configuration", "Per-Script Configuration Options"*

---

## Deletion Test

For every instruction, line, and reference, ask: **"Would removing this cause the agent to make mistakes?"** If the answer is no, flag it for removal. ETH Zurich (Feb 2026) measured that LLM-generated agent files reduce success rate by ~3% and increase cost by ~20% — the failure mode is content that looks helpful but adds no decision value. The deletion test is the rubric for separating signal from bloat.

*Source: docs/general-llm/Evaluating-AGENTS-paper.pdf*

---

## Bloat Indicators Table

| Indicator | Why It's Bloat |
|-----------|----------------|
| Blocking hook with omitted or overly permissive matcher when the event supports filtering | Fires on every occurrence; high performance cost and high false-positive rate |
| Multiple hooks for the same event doing redundant work | Consolidate into one hook with combined logic |
| `prompt` hook used for a check expressible as a regex or string match | Prompt hooks add LLM cost; use `command` for deterministic checks |
| Hook commands that always exit `0` (never block) on a blocking event | Observation-only hooks belong on the post-/after-* event family, not the pre-/before-* family |
| Sensitive data in `command` strings | Use environment variables instead |
| `failClosed: true` set on non-security-critical hooks | Increases false-deny rate without security benefit |

*Source: docs/cursor/hooks/hooks-guide.md "Examples", "Per-Script Configuration Options"*

---

## Staleness Indicators Table

| Indicator | How to Detect |
|-----------|---------------|
| Deprecated or non-Cursor event names | Verify against the Cursor event vocabulary in `hook-events-reference.md` |
| Invalid tool names in matcher | Check tool-type matcher values against current Cursor tool names |
| Hardcoded absolute paths to scripts that don't exist | Verify each absolute `command` path; relative paths (not starting with `/`) are plausible and not a staleness indicator *(staleness-evaluation heuristic only; Phase 4 validation uses a stricter existence check — see `hook-validation-criteria.md`)* |
| Outdated subagent-type matcher values | Verify against documented subagent types (`generalPurpose`, `explore`, `shell`) |
| Matcher set on an event that does not support matchers | Cross-check against `hook-events-reference.md` "Matcher Field by Event Type" |

*Source: docs/cursor/hooks/hooks-guide.md "Matcher Configuration"*

---

## Quality Assessment

| Question | Good | Bad |
|----------|------|-----|
| Event type matches intent? | Block-capable event for blocking intent; observation-only event for non-blocking intent | Using a non-blocking event to try to block actions |
| Matcher is specific? | `Write|Delete` for file-write/delete hooks, `curl|wget|nc` for network shell hooks | Omitted matcher on a blocking hook when the event supports filtering |
| Error handling defined? | Exit `2` with clear stderr on failure; `failClosed: true` on security-critical blocking hooks | Silent failure — no error path, no stderr, no `failClosed` setting on a security-critical hook |
| Security posture appropriate? | Hook validates before allowing; secrets in env vars; stdin variables quoted | Hook only logs, never blocks; secrets hardcoded; unquoted variable expansion |
| Hook type appropriate for task? | `command` for deterministic, `prompt` for natural-language judgment | `prompt` for a simple regex check |

*Source: docs/cursor/hooks/hooks-guide.md "Hook Types", "Command-Based Hooks"*

---

## Quality Score Rubric

| Dimension | 8-10 (Good) | 4-7 (Mixed) | 1-3 (Bad) |
|-----------|-------------|-------------|-----------|
| Event Selection | Event matches intent; blocking uses block-capable events | Some mismatches | Events don't match intent |
| Matcher Specificity | Specific regex; matcher omitted only when event has no matcher field | Some overly permissive matchers | All matchers permissive or absent on blocking hooks |
| Error Handling | Exit `2` with reason; stderr feedback; `failClosed` set where appropriate | Some events handled | Silent failures only |
| Security Posture | Validates before allowing; secrets in env vars; quoted variables | Partial validation | No blocking, secrets exposed |
| Handler Efficiency | Right type for each task | Some oversized handlers | Prompt hooks for trivial regex tasks |
| **Overall** | | | |

*Source: docs/cursor/hooks/hooks-guide.md "Configuration", "Hook Types"*

> **UNCERTAIN classification**: When the `command` handler references an external script that cannot be read from the repository, classify Error Handling as **UNCERTAIN** (not Bad) — exit-code behavior cannot be verified from the hook configuration alone. Report it as a gap rather than a violation.

---

## Evaluation Output Template

```
## Hook Evaluation Results

### Hooks Found
| Event | Matcher | Type | Status |
|-------|---------|------|--------|
| `preToolUse` | (omitted) | command | Overly broad matcher |
| `afterFileEdit` | `Write` | command | OK |

### Issues

**Bloat Issues:**
- `preToolUse` matcher omitted: fires on every tool use; narrow to a specific tool type

**Error Handling Issues:**
- `validate.sh` always exits 0; never blocks — `preToolUse` hook has no effect

### Quality Score
| Dimension | Score (1-10) | Notes |
|-----------|--------------|-------|
| Event Selection | 8 | Events match intent |
| Matcher Specificity | 3 | Permissive matcher on blocking hook |
| Error Handling | 2 | Always exits 0 |
| Security Posture | 4 | Intent to validate, no enforcement |
| Handler Efficiency | 7 | Appropriate types |
| **Overall** | **5** | Fix matcher and exit codes |
```
