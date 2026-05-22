---
name: fixture-missing-process
description: "Fixture skill with the mandatory PROCESS tag absent. Use when validating the canonical semantic-tag convention."
---
<!-- FIXTURE — expected verdict: hard-fail. The mandatory <PROCESS> tag is absent. -->

# Fixture Missing Process

One-sentence purpose statement for the missing-process fixture.

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
