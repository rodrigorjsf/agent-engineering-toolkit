---
name: fixture-compliant-without-trigger
description: "Fixture subagent exercising the compliant baseline with TRIGGER absent. Use when validating the subagent-specific TRIGGER-optional variant."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: pass. <TRIGGER> is absent — for subagents this is SILENT (not a hard-fail). All other mandatory tags are present, balanced, and use canonical attributes only. -->

# Fixture Compliant Without Trigger

One-sentence identity statement for the compliant-without-trigger fixture.

<BEHAVIOUR
  avoid="modifying files; surfacing low-confidence findings"
  always="cite evidence; report in structured format">
- Do not modify any files — report only.
- Surface findings with source citations.
</BEHAVIOUR>

<HARD_RULES priority="hard">
- NEVER modify files.
- EVERY finding must cite a specific source or file location.
</HARD_RULES>

<PROCESS>

  <PHASE id="1" name="analysis">
  Scan the target files and collect findings.
  </PHASE>

  <PHASE id="2" name="compile-output">
  Format findings into the structured output format.
  </PHASE>

</PROCESS>

<OUTPUT>
Return findings as a structured list with file paths and descriptions.
</OUTPUT>
