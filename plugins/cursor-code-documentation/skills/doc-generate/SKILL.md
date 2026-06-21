---
name: doc-generate
description: "Produces documentation artifacts for targeted code or modules on demand — API docs, README sections, and inline doc-strings. Invoked manually via /doc-generate; the model never auto-invokes this skill."
disable-model-invocation: true
---

# Doc Generate

Generates documentation artifacts for code selected by the developer. Produces the requested form — API reference, README section, or inline doc-strings — based on the actual code read at invocation time. This is a deliberate generation operation on EXISTING code — it does not explain, refactor, or modify the underlying implementation.

<TRIGGER when="developer invokes /doc-generate on a function, class, module, or file they want documented" />

<BEHAVIOUR
  avoid="explaining code concepts in tutorial form; modifying implementation code; auto-invoking without explicit developer request; guessing the target scope when it is ambiguous"
  always="produce documentation that reflects the actual code; confirm the requested artifact form before generating; defer explanation requests to /code-explain">
- **Document what exists** — derive all documentation from the code as written; do not invent behavior or parameters.
- **Confirm the artifact form** — if the developer has not specified the output form (API docs, README section, inline doc-strings), ask before generating.
- **Stay in generation mode** — this skill produces documentation text; it does not explain concepts, critique quality, or suggest refactors.
- **Defer explanation** — if the developer asks to understand what the code does, redirect them to `/code-explain`.
- **Manual-only invocation** — this skill is invoked exclusively via `/doc-generate`. The `disable-model-invocation: true` frontmatter key enforces this: the model will not auto-invoke this skill based on conversation context.
</BEHAVIOUR>

<HARD_RULES priority="hard">
- **NEVER** modify, refactor, or generate implementation code — this skill produces documentation artifacts only
- **NEVER** auto-invoke — the developer must explicitly run `/doc-generate`
- **NEVER** produce tutorial-style explanations of how the code works — that is the `/code-explain` skill
- **NEVER** invent parameters, return types, or behavior not present in the actual code
- **ALWAYS** read the target code before generating any documentation
- **ALWAYS** produce documentation that is accurate to the code at the time of invocation
- **ALWAYS** treat `disable-model-invocation: true` as authoritative — this skill runs only when explicitly invoked
</HARD_RULES>

<PROCESS>

  <PREFLIGHT name="scope-confirmation">
  Confirm what the developer wants documented and in what form:

  - If the developer specified a file path, function name, or class, use that as the target.
  - If a code block was pasted or selected, use it directly.
  - If the target is ambiguous (e.g. no code selected, no path given), ask the developer to specify before proceeding.
  - If the artifact form is not specified (API docs, README section, or inline doc-strings), ask which form is needed before generating.

  State any assumptions about context (language, framework, imported types not visible in the snippet) in a brief note at the top of the output.
  </PREFLIGHT>

  <PHASE id="1" name="read-target-code">
  Read the target code in full. If a file path was provided, read the relevant file and locate the target function, class, or module. If a snippet was pasted inline, use it directly.

  Identify:
  - Public interface: exported names, function signatures, parameter names and types, return types
  - Any preconditions, invariants, or error conditions surfaced in the code
  - Side effects or mutations the code produces
  - Any existing documentation comments that can be incorporated or updated
  </PHASE>

  <PHASE id="2" name="generate-documentation-artifact">
  Generate the documentation artifact in the form confirmed during preflight. Apply the rules for the selected form:

  **API Docs**
  For each exported function, class, or interface:
  - One-sentence summary of purpose
  - Parameters: name, type, description for each
  - Return value: type and description
  - Errors or exceptions raised, if surfaced in the code
  - A minimal usage example when the signature alone is insufficient

  **README Section**
  - A heading that identifies the module or component
  - One short paragraph describing what it does and when to use it
  - Installation or import instructions if relevant
  - A code example demonstrating the primary use case
  - Links to related API docs or further reading if those artifacts already exist

  **Inline Doc-strings**
  Use the language-native format (JSDoc for JavaScript/TypeScript, docstring for Python, etc.):
  - Summary line
  - `@param` / `:param` entries for each parameter
  - `@returns` / `:returns` entry for the return value
  - `@throws` / `:raises` entries for documented error conditions
  - Keep each entry concise; do not reproduce implementation logic
  </PHASE>

  <PHASE id="3" name="present-artifact">
  Present the generated documentation artifact in a fenced code block using the appropriate language marker (e.g. `markdown`, `ts`, `py`).

  After presenting:
  - Ask if the developer wants to adjust scope, add examples, or generate a different artifact form for the same target.
  - Do NOT offer to explain the code or suggest implementation changes — stay in generation mode.
  </PHASE>

</PROCESS>

<OUTPUT format="fenced-code-block">
The generated documentation artifact in a fenced code block. The language marker matches the artifact form: `markdown` for README sections, the target language (e.g. `ts`, `py`) for inline doc-strings, and `markdown` for API docs prose. Assumptions about missing context appear as a brief italicised note before the fenced block.
</OUTPUT>

<VALIDATION loop="max-iterations:1">
Before presenting the output, verify:
- The artifact form matches what the developer requested.
- All public-facing identifiers (function names, parameter names, return types) in the documentation match the actual code.
- No implementation logic has been reproduced verbatim — documentation describes behavior, not internals.
- No tutorial explanations or concept definitions have been included.
- No implementation code has been generated or modified.

If any check fails, revise the relevant section and re-check before presenting.
</VALIDATION>
