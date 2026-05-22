---
name: fixture-missing-hard-rules
description: "Fixture subagent with both HARD_RULES and RULES absent. Use when validating the canonical semantic-tag convention."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: hard-fail. Both <HARD_RULES> and the <RULES> alias are absent. -->

# Fixture Missing Hard Rules

One-sentence identity statement for the missing-hard-rules fixture.

<BEHAVIOUR
  avoid="modifying files"
  always="cite evidence">
- Do not modify any files — report only.
- Surface findings with source citations.
</BEHAVIOUR>

<PROCESS>

  <PHASE id="1" name="analysis">
  Scan the target files and collect findings.
  </PHASE>

  <PHASE id="2" name="compile-output">
  Format findings into the structured output format.
  </PHASE>

</PROCESS>
