---
name: fixture-rules-alias
description: "Fixture skill using the legacy RULES alias instead of HARD_RULES. Use when validating the canonical semantic-tag convention."
---
<!-- FIXTURE — expected verdict: pass. Uses the legacy <RULES> tag, which is an accepted alias of <HARD_RULES>; all else compliant. -->

# Fixture Rules Alias

One-sentence purpose statement for the rules-alias fixture.

<TRIGGER when="validating the canonical semantic-tag convention" />

<BEHAVIOUR
  avoid="acting before surfacing assumptions"
  always="keep changes surgical">
- Surface assumptions first.
- Prefer the simplest path.
</BEHAVIOUR>

<RULES>
- NEVER inline reference content in the SKILL.md body.
- EVERY skill body stays under 500 lines.
</RULES>

<PROCESS>

  <PHASE id="1" name="analysis">
  Read references/artifact-analyzer.md and follow its analysis instructions.
  </PHASE>

  <PHASE id="2" name="generate">
  Read the template, fill the placeholders, generate the directory structure.
  </PHASE>

</PROCESS>
