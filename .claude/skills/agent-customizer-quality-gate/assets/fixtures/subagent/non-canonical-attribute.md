---
name: fixture-non-canonical-attribute
description: "Fixture subagent with a non-canonical attribute name. Use when validating the canonical semantic-tag convention."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: warn. <BEHAVIOUR> carries a non-canonical `mood=` attribute; all mandatory tags are present and balanced, so it passes otherwise. -->

# Fixture Non-Canonical Attribute

One-sentence identity statement for the non-canonical-attribute fixture.

<TRIGGER when="validating the canonical semantic-tag convention" />

<BEHAVIOUR
  avoid="modifying files; surfacing low-confidence findings"
  always="cite evidence; report in structured format"
  mood="optimistic">
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
