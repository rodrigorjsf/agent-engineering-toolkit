<!-- TEMPLATE: Hook Configuration Snippet (from automation migration)
     Placement: merge into `.claude/settings.json` under `hooks` — NOT a standalone file.
     Hooks require Claude Code; do NOT generate for standalone distribution.
     Use `matcher` to scope hooks to specific tools (glob-style tool name matching).
     Hook events (22 total): PreToolUse, PostToolUse, Stop, SessionStart, UserPromptSubmit, plus 17 others.
     Source: automation-mechanism-comparison.md — Mechanism Comparison.
-->

<!-- `command` — deterministic enforcement, no LLM judgment. Zero context cost. 100% enforcement. -->
{
  "hooks": {
    "[PreToolUse|PostToolUse|Stop|SessionStart|UserPromptSubmit]": [
      {
        "matcher": "[tool-name-pattern]",
        "hooks": [
          { "type": "command", "command": "[path/to/script.sh or inline command]" }
        ]
      }
    ]
  }
}

<!-- `prompt` — single-turn LLM judgment. Returns {"ok": true} or {"ok": false, "reason": "..."}. Default: Haiku. -->
{
  "hooks": {
    "[PreToolUse|PostToolUse|Stop]": [
      {
        "hooks": [
          { "type": "prompt", "prompt": "[Describe check. Respond {\"ok\": false, \"reason\": \"...\"} if condition is not met.]" }
        ]
      }
    ]
  }
}

<!-- `agent` — multi-turn LLM verification with tools. Same ok/reason format. Timeout 60s default, ≤50 turns. -->
{
  "hooks": {
    "[PreToolUse|PostToolUse|Stop]": [
      {
        "hooks": [
          { "type": "agent", "prompt": "[Describe what to verify. Agent can read files and run commands.]", "timeout": 60 }
        ]
      }
    ]
  }
}
