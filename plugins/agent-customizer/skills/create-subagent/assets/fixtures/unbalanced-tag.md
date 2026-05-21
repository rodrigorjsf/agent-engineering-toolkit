---
name: fixture-unbalanced-tag
description: "Fixture subagent with an unbalanced PROCESS tag. Use when validating the canonical semantic-tag convention."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: hard-fail. <PROCESS> is opened but never closed. -->

# Fixture Unbalanced Tag

One-sentence identity statement for the unbalanced-tag fixture.

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

  <PHASE id="1" name="analysis">
  Scan the target files and collect findings.
  </PHASE>

  <PHASE id="2" name="compile-output">
  Format findings into the structured output format.
  </PHASE>

<!-- DEFECT: the <PROCESS> opening tag above has no matching </PROCESS> closing tag. -->
