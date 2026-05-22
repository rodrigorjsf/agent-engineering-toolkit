---
name: fixture-missing-hard-rules
description: "Fixture skill with the mandatory HARD_RULES tag absent. Use when validating the canonical semantic-tag convention."
---
<!-- FIXTURE — expected verdict: hard-fail. Both <HARD_RULES> and its <RULES> alias are absent. -->

# Fixture Missing Hard Rules

One-sentence purpose statement for the missing-hard-rules fixture.

<TRIGGER when="validating the canonical semantic-tag convention" />

<BEHAVIOUR
  avoid="acting before surfacing assumptions"
  always="keep changes surgical">
- Surface assumptions first.
- Prefer the simplest path.
</BEHAVIOUR>

<PROCESS>

  <PHASE id="1" name="analysis">
  Delegate analysis to the registered evaluator agent.
  </PHASE>

  <PHASE id="2" name="generate">
  Read the template, fill the placeholders, generate the directory structure.
  </PHASE>

</PROCESS>
