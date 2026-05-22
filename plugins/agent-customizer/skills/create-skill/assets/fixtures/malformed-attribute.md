---
name: fixture-malformed-attribute
description: "Fixture skill with a malformed PHASE attribute. Use when validating the canonical semantic-tag convention."
---
<!-- FIXTURE — expected verdict: hard-fail. The <PHASE> name attribute value is missing its quotes. -->

# Fixture Malformed Attribute

One-sentence purpose statement for the malformed-attribute fixture.

<TRIGGER when="validating the canonical semantic-tag convention" />

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

  <PHASE id="1" name=analysis>
  DEFECT: the name attribute value above is unquoted — malformed attribute syntax.
  </PHASE>

  <PHASE id="2" name="generate">
  Read the template, fill the placeholders, generate the directory structure.
  </PHASE>

</PROCESS>
