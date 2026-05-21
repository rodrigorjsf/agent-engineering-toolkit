---
name: fixture-missing-trigger
description: "Fixture skill with the mandatory TRIGGER tag absent. Use when validating the canonical semantic-tag convention."
---
<!-- FIXTURE — expected verdict: hard-fail. The mandatory <TRIGGER> tag is absent. -->

# Fixture Missing Trigger

One-sentence purpose statement for the missing-trigger fixture.

<BEHAVIOUR
  avoid="acting before surfacing assumptions"
  always="keep changes surgical">
- Surface assumptions first.
- Prefer the simplest path.
</BEHAVIOUR>

<HARD_RULES priority="hard">
- NEVER inline reference content in the SKILL.md body.
- EVERY skill body stays under 500 lines.
</HARD_RULES>

<PROCESS>

  <PHASE id="1" name="analysis">
  Read references/artifact-analyzer.md and follow its analysis instructions.
  </PHASE>

  <PHASE id="2" name="generate">
  Read the template, fill the placeholders, generate the directory structure.
  </PHASE>

</PROCESS>
