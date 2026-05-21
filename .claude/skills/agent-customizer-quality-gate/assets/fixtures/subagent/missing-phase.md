---
name: fixture-missing-phase
description: "Fixture subagent whose PROCESS contains zero PHASE elements. Use when validating the canonical semantic-tag convention."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: hard-fail. <PROCESS> is present but contains zero <PHASE> elements. -->

# Fixture Missing Phase

One-sentence identity statement for the missing-phase fixture.

<TRIGGER when="validating the canonical semantic-tag convention" />

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
The process container holds no phases — this is the defect under test.
</PROCESS>
