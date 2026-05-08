<!-- TEMPLATE: hook-config.md
     Placement: .cursor/hooks.json (JSON with version field and event-keyed hook arrays).
     Hooks require Cursor; do NOT generate for standalone distribution.
     Events: sessionStart, sessionEnd, preToolUse, postToolUse, postToolUseFailure,
     subagentStart, subagentStop, beforeShellExecution, afterShellExecution,
     beforeMCPExecution, afterMCPExecution, beforeReadFile, afterFileEdit,
     beforeSubmitPrompt, preCompact, stop, afterAgentResponse, afterAgentThought.
     Source: automation-migration-guide.md — Mechanism Comparison.
     MIGRATION: only suggest hooks for HOOK_CANDIDATE (deterministic enforcement).
     Emit raw JSON only — no Markdown headings, tables, prose, or code fences in the generated `.cursor/hooks.json`.
-->

{
  "version": 1,
  "hooks": {
    "[HOOK_EVENT]": [
      { "command": "[path/to/script.sh or inline command]" }
    ]
  }
}
