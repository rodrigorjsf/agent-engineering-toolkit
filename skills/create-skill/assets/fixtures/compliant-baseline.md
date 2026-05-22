---
name: fixture-compliant-baseline
description: "Fixture skill exercising the compliant baseline. Use when validating the canonical semantic-tag convention."
---
<!-- FIXTURE — expected verdict: pass. All mandatory tags present, balanced, canonical attributes only. -->

# Fixture Compliant Baseline

One-sentence purpose statement for the baseline fixture.

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

  <PHASE id="1" name="analysis">
  Read references/artifact-analyzer.md and follow its analysis instructions.
  </PHASE>

  <PHASE id="2" name="generate">
  Read the template, fill the placeholders, generate the directory structure.
  </PHASE>

</PROCESS>

<VALIDATION>
Read the validation criteria and loop until all checks pass.
</VALIDATION>
