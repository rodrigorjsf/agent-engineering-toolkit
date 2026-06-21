---
name: code-explain
description: "Produces a structured educational explanation of existing code on demand — overview, key concepts, and step-by-step breakdown. Invoked manually via /code-explain; the model never auto-invokes this skill."
disable-model-invocation: true
---

# Code Explain

Delivers a clear, structured explanation of existing code selected by the developer. Covers what the code does, the concepts it relies on, and how it executes step by step. This is an educational operation on EXISTING code — it does not generate, modify, or document code.

<TRIGGER when="developer invokes /code-explain on a function, class, module, or code snippet they want to understand" />

<BEHAVIOUR
  avoid="generating, modifying, or documenting code; auto-invoking without explicit developer request; guessing intent when the target is ambiguous"
  always="explain only what is present; surface assumptions about the code's context before explaining; keep explanations structured and grounded in the actual code">
- **Explain what exists** — describe the code as written, not what it could or should be.
- **Surface assumptions first** — if the target scope is ambiguous (e.g. a partial snippet without imports), state what is assumed about context before proceeding.
- **Structure every explanation** — always produce the three-part format: overview, key concepts, step-by-step breakdown.
- **Stay educational** — the goal is developer understanding, not code quality critique or improvement suggestions.
- **Manual-only invocation** — this skill is invoked exclusively via `/code-explain`. The `disable-model-invocation: true` frontmatter key enforces this: the model will not auto-invoke this skill based on conversation context.
</BEHAVIOUR>

<HARD_RULES priority="hard">
- **NEVER** generate, edit, or refactor code — this skill explains EXISTING code only
- **NEVER** auto-invoke — the developer must explicitly run `/code-explain`
- **NEVER** produce documentation comments or doc-string output — that is the `/doc-generate` skill
- **NEVER** critique code quality, suggest improvements, or flag bugs unless the developer explicitly asks
- **ALWAYS** produce all three explanation sections: overview, key concepts, step-by-step breakdown
- **ALWAYS** base the explanation on the actual code provided — do not speculate about missing context
- **ALWAYS** treat `disable-model-invocation: true` as authoritative — this skill runs only when explicitly invoked
</HARD_RULES>

<PROCESS>

  <PREFLIGHT name="scope-confirmation">
  Confirm what the developer wants explained:

  - If the developer selected or pasted a specific code block, use that as the target.
  - If the invocation references a file path or function name, read the relevant section.
  - If the target is ambiguous (e.g. no code selected, no path given), ask the developer to specify the target before proceeding.

  State any assumptions about context (language runtime, framework, imported types not visible in the snippet) at the top of the explanation output.
  </PREFLIGHT>

  <PHASE id="1" name="read-target-code">
  Read the target code in full. If a file path was provided, read the relevant file and locate the target function, class, or module. If a snippet was pasted inline, use it directly.

  Identify:
  - The entry point and its signature
  - All imported or referenced identifiers that affect behavior
  - Any non-obvious control flow (early returns, exception handling, async patterns, closures)
  - The output or side effects the code produces
  </PHASE>

  <PHASE id="2" name="produce-structured-explanation">
  Generate the structured explanation in three sections:

  **Overview**
  One to three sentences describing what the code does, its purpose, and where it fits in the broader system (if determinable from context). Write for a developer who has not read this code before.

  **Key Concepts**
  List the language features, patterns, or domain concepts a reader must understand to follow the code. For each concept, provide a one- to two-sentence definition scoped to how it is used here. Examples: closures, generators, dependency injection, event loop, memoization, algebraic data types. Do not define concepts the code does not actually use.

  **Step-by-Step Breakdown**
  Walk through the code execution in order, one logical step per bullet. Reference actual line content (variable names, function calls, conditions) so the developer can follow along in the source. Cover all branches that affect behavior. End with what the code returns or what side effects it produces.
  </PHASE>

  <PHASE id="3" name="present-explanation">
  Present the structured explanation using this format:

  ```
  ## Overview
  <one to three sentences>

  ## Key Concepts
  - **<concept>**: <definition scoped to this code>
  ...

  ## Step-by-Step Breakdown
  1. <step referencing actual code>
  2. <step>
  ...
  ```

  After presenting:
  - Ask if the developer wants any section expanded or any concept explained in more depth.
  - Do NOT offer to refactor, fix, or document the code — stay in explanation mode.
  </PHASE>

</PROCESS>

<OUTPUT format="markdown-sections">
Three mandatory sections in order: **Overview**, **Key Concepts**, **Step-by-Step Breakdown**. Each section uses the heading level and format shown in Phase 3. Assumptions about missing context appear as a brief italicised note before the Overview section.
</OUTPUT>

<VALIDATION loop="max-iterations:1">
Before presenting the output, verify:
- All three sections are present and non-empty.
- The step-by-step breakdown references actual identifiers from the code (not generic descriptions).
- No code generation, modification, or documentation has been included.
- No improvement suggestions or bug reports appear unless the developer explicitly requested them.

If any check fails, revise the relevant section and re-check before presenting.
</VALIDATION>
