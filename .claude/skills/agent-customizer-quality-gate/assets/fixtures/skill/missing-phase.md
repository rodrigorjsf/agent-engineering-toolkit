---
name: fixture-missing-phase
description: "Fixture skill whose PROCESS contains zero PHASE elements. Use when validating the canonical semantic-tag convention."
---
<!-- FIXTURE — expected verdict: hard-fail. <PROCESS> is present but contains zero <PHASE> elements. -->

# Fixture Missing Phase

One-sentence purpose statement for the missing-phase fixture.

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
The process container holds no phases — this is the defect under test.
</PROCESS>
