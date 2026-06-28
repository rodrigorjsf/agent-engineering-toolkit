---
name: code-explain
description: Explains a selected piece of existing code as a structured walkthrough — overview, key concepts, and a step-by-step breakdown — for developer understanding.
disable-model-invocation: true
---

# Code Explain

**Explain** the code the developer points at — what it does, the concepts it leans on, and how it runs, step by step — for a reader seeing it fresh. This skill only *explains*: it reads code and produces understanding. It never generates, documents, or edits code; the moment the task becomes producing or changing code, it has left this skill — documentation is `/doc-generate`.

Ground every claim in the source: cite the actual identifiers, branches, and calls, and never invent behaviour for context you cannot see. Raise bugs or improvements only when the developer asks — the goal is understanding, not a quality review.

## Process

1. **Lock the target.** A selected or pasted block is the target as-is; a file path or symbol name means read that file and locate the function, class, or module; if nothing is identifiable, ask — do not guess. *Done when* the target code is in hand and any context assumptions (language, framework, unseen imports) are noted for the output.

2. **Read it fully.** Extract the facts the explanation rests on: the entry point and its signature, the referenced identifiers that affect behaviour, the non-obvious control flow (early returns, error handling, async, closures), and the return value and side effects. *Done when* every behaviour-affecting branch and identifier is accounted for — not a partial skim.

3. **Write the three sections.** This is the explanation's authoritative shape:
   - **Overview** — one to three sentences: what the code does and where it fits.
   - **Key Concepts** — the language features, patterns, or domain ideas a reader must grasp to follow it, each defined in a sentence or two *as used here*; only concepts the code actually uses.
   - **Step-by-Step Breakdown** — the execution in order, one logical step per bullet, each citing a real identifier, covering every behaviour-affecting branch, ending on the return value or side effects.

   *Done when* all three sections are non-empty and every step names something from the source.

4. **Present and stop.** Render the three sections as Markdown headings (`## Overview`, `## Key Concepts`, `## Step-by-Step Breakdown`), with any context-assumption note italicised above the Overview. Offer to expand a section — and nothing else; do not offer to refactor, fix, or document. *Done when* the developer has the explanation and a single follow-up offer scoped to deepening it.
