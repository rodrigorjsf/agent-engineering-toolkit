---
name: fixture-missing-behaviour
description: "Fixture skill with the mandatory BEHAVIOUR tag absent. Use when validating the canonical semantic-tag convention."
---
<!-- FIXTURE — expected verdict: hard-fail. The mandatory <BEHAVIOUR> tag is absent. -->

# Fixture Missing Behaviour

One-sentence purpose statement for the missing-behaviour fixture.

<TRIGGER when="validating the canonical semantic-tag convention" />

<HARD_RULES priority="hard">
- NEVER inline reference content in the SKILL.md body.
- EVERY skill body stays under 500 lines.
</HARD_RULES>

<PROCESS>

  <PHASE id="1" name="analysis">
  Delegate analysis to the registered evaluator agent.
  </PHASE>

  <PHASE id="2" name="generate">
  Read the template, fill the placeholders, generate the directory structure.
  </PHASE>

</PROCESS>
