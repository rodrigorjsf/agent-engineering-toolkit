---
name: doc-generate
description: Generates documentation for selected existing code — API reference, README section, or inline doc-strings — derived strictly from the code as written.
disable-model-invocation: true
---

# Doc Generate

**Generate** documentation for the code the developer points at, in the form they ask for — API reference, README section, or inline doc-strings — derived strictly from the code as written. This skill produces documentation; it never explains concepts in tutorial form (that is `/code-explain`) and never edits the implementation it documents.

Generate, never invent: every documented parameter, return, error, and behaviour must trace to the source — if it is not in the code, it is not in the docs.

## Process

1. **Lock target and form.** The *target* is a selected block, file path, or symbol name; if none is identifiable, ask. The *form* is API docs, a README section, or inline doc-strings; if unspecified, ask which is needed. *Done when* both the target code and the artifact form are fixed and any context assumptions are noted for the output.

2. **Read the target.** Extract what the documentation must reflect: the public interface (exported names, signatures, parameter names and types, return types), the preconditions / invariants / error conditions the code surfaces, the side effects or mutations, and any existing doc-comments to update rather than duplicate. *Done when* every public-facing identifier the chosen form will document is captured.

3. **Generate the confirmed form.** Each form has one authoritative spec:
   - **API docs** — per exported symbol: a one-sentence purpose; each parameter (name, type, description); the return type and meaning; errors raised if surfaced; a minimal example only when the signature alone is unclear.
   - **README section** — a heading naming the component; a short paragraph on what it does and when to use it; an import/install note if relevant; a primary-use code example; links to related docs only if those already exist.
   - **Inline doc-strings** — the language-native format (JSDoc, Python docstring, …): a summary line; one entry per parameter; a return entry; entries for documented errors; concise, never restating implementation logic.

   *Done when* every public identifier from step 2 is documented and nothing documented is absent from the code.

4. **Present and stop.** Render the artifact in a fenced code block with the matching language marker (`markdown` for API docs and README sections; the target language for inline doc-strings), with any context-assumption note italicised above it. Offer to adjust scope, add examples, or switch form — not to explain or change the code. *Done when* the developer has the artifact and a single follow-up offer scoped to documentation.
