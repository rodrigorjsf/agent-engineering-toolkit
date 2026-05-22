---
name: fixture-missing-process
description: "Fixture subagent with the mandatory PROCESS tag absent. Use when validating the canonical semantic-tag convention."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: hard-fail. The mandatory <PROCESS> tag is absent. -->

# Fixture Missing Process

One-sentence identity statement for the missing-process fixture.

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
