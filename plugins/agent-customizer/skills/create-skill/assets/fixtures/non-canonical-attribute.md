---
name: fixture-non-canonical-attribute
description: "Fixture skill with a non-canonical attribute name. Use when validating the canonical semantic-tag convention."
---
<!-- FIXTURE — expected verdict: warn. <BEHAVIOUR> carries a non-canonical `mood=` attribute; all mandatory tags are present and balanced, so it passes otherwise. -->

# Fixture Non-Canonical Attribute

One-sentence purpose statement for the non-canonical-attribute fixture.

<TRIGGER when="validating the canonical semantic-tag convention" />

<BEHAVIOUR
  avoid="acting before surfacing assumptions"
  always="keep changes surgical"
  mood="optimistic">
- Surface assumptions first.
- Prefer the simplest path.
</BEHAVIOUR>

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
