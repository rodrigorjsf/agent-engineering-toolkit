---
name: [skill-name-kebab-case]
description: "[What this skill does and when to use it. Third person.]"
---
<!-- TEMPLATE: SKILL.md Entry Point
     Placement: skills/[skill-name]/SKILL.md
     Rule: name ≤ 64 chars, lowercase letters/numbers/hyphens only
     Rule: description ≤ 1024 chars, third person, no XML tags
     Rule: Body under 500 lines
     Rule: Use relative references/ paths for evidence-based guidance
     Rule: Use relative assets/templates/ paths for output templates
     Rule: Progressive disclosure — load references per phase, not all upfront
     Rule: If analysis finds a monorepo or multi-service layout, generated phases must name the target service/workspace explicitly
     Rule: The body wraps logical blocks in the canonical semantic-tag vocabulary.
           Mandatory: <TRIGGER>, <BEHAVIOUR>, <HARD_RULES>, <PROCESS> with one or more <PHASE id name>.
           Optional: <PREFLIGHT>, <REFERENCES>, <EXAMPLE>, <ANTI_PATTERN>, <OUTPUT>, <VALIDATION>.
           Closed attribute set: avoid=, always=, when=, name=, id=, priority=.
     Rule: YAML frontmatter is untouched — do NOT duplicate the <TRIGGER> cue into description
     Rule: Standalone skills MUST NOT author hooks, subagents, path-scoped rules, or CLAUDE.md hierarchy
-->

# [Skill Title]

[One-sentence purpose statement]

<TRIGGER when="[plain-language activation cue — mirror the 'Use when ...' phrase from the description]" />

<BEHAVIOUR
  avoid="make decisions without surfacing assumptions; add speculative scope"
  always="surface assumptions first; keep changes surgical">
- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.
</BEHAVIOUR>

<HARD_RULES priority="hard">
- [Critical constraint 1]
- [Critical constraint 2]
</HARD_RULES>

<PROCESS>

  <PREFLIGHT name="artifact-collision-check">
  <!-- CONDITIONAL: Check if artifact exists — redirect to improve if so -->
  </PREFLIGHT>

  <PHASE id="1" name="[analysis-phase-name]">
  Read `references/artifact-analyzer.md` and follow its analysis instructions.
  <!-- If monorepo, record the target service/workspace for use in subsequent phases -->
  </PHASE>

  <PHASE id="2" name="[generation-phase-name]">
  <!-- Read references, apply templates, and use project-relative paths/globs for the detected service/workspace -->
  </PHASE>

  <PHASE id="3" name="self-validation">
  Read `references/skill-validation-criteria.md` and execute its **Validation Loop Instructions** against the generated skill.
  Maximum 3 iterations. Do not proceed to Phase 4 until ALL criteria pass.
  </PHASE>

  <PHASE id="4" name="present-and-write">
  Show artifact with evidence citations. Ask for confirmation. Write on approval.
  </PHASE>

</PROCESS>

<VALIDATION loop="max-iterations:3">
Read `references/skill-validation-criteria.md`, loop until all hard limits, quality checks, and canonical semantic-tag strictness tiers pass.
</VALIDATION>
