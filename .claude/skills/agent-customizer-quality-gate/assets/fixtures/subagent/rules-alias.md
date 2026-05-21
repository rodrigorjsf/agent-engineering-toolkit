---
name: fixture-rules-alias
description: "Fixture subagent using the legacy RULES alias instead of HARD_RULES. Use when validating the canonical semantic-tag convention."
tools: Read, Grep, Glob
model: sonnet
maxTurns: 15
---
<!-- FIXTURE — expected verdict: pass. Uses the legacy <RULES> tag, which is an accepted alias of <HARD_RULES>; all else compliant. The gate additionally reports this as an informational <HARD_RULES> alias candidate — not a violation. -->

# Fixture Rules Alias

One-sentence identity statement for the rules-alias fixture.

<TRIGGER when="validating the canonical semantic-tag convention" />

<BEHAVIOUR
  avoid="modifying files; surfacing low-confidence findings"
  always="cite evidence; report in structured format">
- Do not modify any files — report only.
- Surface findings with source citations.
</BEHAVIOUR>

<RULES>
- NEVER modify files.
- EVERY finding must cite a specific source or file location.
</RULES>

<PROCESS>

  <PHASE id="1" name="analysis">
  Scan the target files and collect findings.
  </PHASE>

  <PHASE id="2" name="compile-output">
  Format findings into the structured output format.
  </PHASE>

</PROCESS>
