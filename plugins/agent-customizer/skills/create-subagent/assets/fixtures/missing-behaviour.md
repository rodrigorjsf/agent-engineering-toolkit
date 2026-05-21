---
name: fixture-missing-behaviour
description: "Fixture subagent with the mandatory BEHAVIOUR tag absent. Use when validating the canonical semantic-tag convention."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: hard-fail. The mandatory <BEHAVIOUR> tag is absent. -->

# Fixture Missing Behaviour

One-sentence identity statement for the missing-behaviour fixture.

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
