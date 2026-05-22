---
name: [agent-name-kebab-case]
description: "[When Claude should delegate to this agent. Include 'Use when...' trigger.]"
tools: [comma-separated tool list, e.g., Read, Grep, Glob, Bash]
model: [sonnet | haiku | opus | inherit]
maxTurns: [15 for analysis agents, 20 for evaluator agents]
---
<!-- TEMPLATE: Subagent Definition
     Placement: .claude/agents/[name].md or plugins/[plugin]/agents/[name].md
     Rule: name and description are REQUIRED fields
     Rule: tools restricts to allowlist — omit to inherit all
     Rule: model: sonnet for most agents, haiku only for narrow read-only lookup agents, opus for complex reasoning
     Rule: Plugin agents CANNOT use hooks, mcpServers, or permissionMode
     Rule: Agents cannot spawn other agents
     Rule: If scope spans multiple services or workspaces, name them explicitly in the prompt
     Rule: <TRIGGER> is optional — omit if the subagent is always spawned by skills, not user-invoked
     Rule: Mandatory body tags: <BEHAVIOUR>, <HARD_RULES>, <PROCESS> with at least one <PHASE id="N" name="X">
-->

# [Agent Name]

[One-sentence identity statement; name target services/workspaces when scope is multi-service]

<!-- Optional: include <TRIGGER> if this subagent can also be user-invoked -->
<!-- <TRIGGER when="[activation condition]" /> -->

<BEHAVIOUR
  avoid="[what to avoid — e.g., modifying files; surfacing low-confidence findings]"
  always="[what to always do — e.g., cite evidence; report in structured format]">
- [Behavioural guideline 1]
- [Behavioural guideline 2]
- Do not modify any files — report only.
</BEHAVIOUR>

<HARD_RULES priority="hard">
- **NEVER** [inviolable constraint 1 — e.g., "modify files"]
- **NEVER** [inviolable constraint 2 — e.g., "spawn other subagents"]
- **EVERY** finding must cite a specific source or file location
- **EVERY** output must match the Output Format below exactly
</HARD_RULES>

<PROCESS>

  <PHASE id="1" name="[first-step]">
  [What to analyze/detect/evaluate in this step]
  </PHASE>

  <PHASE id="2" name="[second-step]">
  [How to process findings — filtering, categorizing, structuring]
  </PHASE>

  <PHASE id="3" name="[compile-output]">
  [How to compile and format the final structured output]
  </PHASE>

</PROCESS>

<OUTPUT>

```
[Exact structure the agent must return — headers, tables, sections]
```

</OUTPUT>

<VALIDATION>
Before returning output, verify:
1. [Self-check 1 — e.g., "All findings cite a file path or source doc"]
2. [Self-check 2 — e.g., "No files were modified"]
3. [Self-check 3 — e.g., "Output matches the required format exactly"]
</VALIDATION>
