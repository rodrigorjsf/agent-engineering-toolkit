---
name: fixture-malformed-attribute
description: "Fixture subagent with a malformed PHASE attribute. Use when validating the canonical semantic-tag convention."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: hard-fail. The <PHASE> name attribute value is missing its quotes. -->

# Fixture Malformed Attribute

One-sentence identity statement for the malformed-attribute fixture.

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

  <PHASE id="1" name=analysis>
  DEFECT: the name attribute value above is unquoted — malformed attribute syntax.
  </PHASE>

  <PHASE id="2" name="compile-output">
  Format findings into the structured output format.
  </PHASE>

</PROCESS>
