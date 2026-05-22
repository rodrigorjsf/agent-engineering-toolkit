---
name: fixture-missing-phase
description: "Fixture subagent with PROCESS present but containing zero PHASE elements. Use when validating the canonical semantic-tag convention."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: hard-fail. <PROCESS> is present but contains zero <PHASE> elements. -->

# Fixture Missing Phase

One-sentence identity statement for the missing-phase fixture.

<BEHAVIOUR
  avoid="modifying files"
  always="cite evidence">
- Do not modify any files — report only.
- Surface findings with source citations.
</BEHAVIOUR>

<HARD_RULES priority="hard">
- NEVER modify files.
- EVERY finding must cite a specific source or file location.
</HARD_RULES>

<PROCESS>
<!-- DEFECT: <PROCESS> is present but contains no <PHASE> elements. -->
</PROCESS>
