# HTML Artifact Effectiveness

**Summary**: Thariq's argument (May 2026) that HTML beats Markdown as the output format for the rich artifacts modern agents produce — plans, PRDs, specs, design files, reports, prototypes — because of higher information density, visual clarity, ease of sharing, two-way interactivity, and data-ingestion fit with Claude Code's whole-context reach. Caveat: the post warns against turning the practice into a generic `/html` skill; the value comes from knowing what each artifact should *do*.
**Sources**: docs/html-structure/thariq-html-effectiveness.md, https://thariqs.github.io/html-effectiveness
**Last updated**: 2026-05-17

---

## Core argument

Markdown became dominant for agent-to-human communication because it is simple, portable, and editable. As agents grew more capable, Markdown started showing its limits: documents past ~100 lines stop being read; rich visualisations get faked with ASCII or even unicode-shaded "colors"; shareable links require external services because browsers do not render `.md` natively. Thariq prefers HTML because it carries strictly more representational range — tables, design tokens via CSS, illustrations via SVG, runnable interactions via JS — and renders natively wherever a browser exists (source: docs/html-structure/thariq-html-effectiveness.md, "Why HTML?" section).

The piece distinguishes the format from the model: Claude.ai and Claude Design can produce HTML too, but Claude Code's value-add is its **context reach** — codebase, MCPs, browser, git history — which lets an HTML artifact aggregate everything the agent can see (source: same, "Data Ingestion" subsection).

## Where HTML wins (the use-case map)

| Use case                           | Examples in the post                                                       |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Specs / planning / exploration     | 6-variant onboarding-screen comparison; thorough implementation plans      |
| Code review and understanding      | Annotated PR diffs with margin comments; module maps; streaming logic dive |
| Design and prototyping             | Slider-driven button animation; design-system tokens; component variants   |
| Reports, research, learning        | Token-bucket rate-limiter explainer; weekly status; incident timelines     |
| Custom editing interfaces          | Drag/drop ticket triage; feature-flag form; side-by-side prompt tuner      |

Common patterns across the examples: scannable visual hierarchy, interactive controls that beat plain text, **export-back-to-prompt buttons** that close the loop into the next agent session, inline SVG/charts to avoid context-switching, minimal chrome (source: example gallery at https://thariqs.github.io/html-effectiveness).

## Honest costs (the post's FAQ)

- **Token cost**: HTML uses more tokens than Markdown. Thariq's claim: the higher reading rate (humans actually read 500-line HTML files where they skim 100-line Markdown) outweighs the token premium, and Opus 4.7's 1M context window absorbs the difference comfortably.
- **Generation time**: HTML can take 2–4× longer to generate than Markdown.
- **Version control**: HTML diffs are noisy compared to Markdown — explicitly called out as "one of the biggest downsides".
- **Visual taste**: matching company aesthetics requires a design-system reference HTML file to feed forward (the "frontend design plugin" is one shortcut).

## The anti-pattern warning

> "I'm a little bit afraid that people will read this article and turn it into a `/html` skill or something. While there might be some value in that, I want to emphasize that you don't need to do much to get Claude to do this. You can just ask it to 'make a HTML file' or 'make a HTML artifact'." (source: docs/html-structure/thariq-html-effectiveness.md, "How to Get Started" section)

The point is artifact-shape literacy, not a workflow command. The trick is knowing what the artifact should *do*: explore options, expose sliders, render diffs, export back to prompt.

## How this repo applies the lesson

This project extends Thariq's reading in one direction he did not address: in our pipeline, generated artifacts are *also* agent-targets — the next LLM session executes the plan, parses the PRD, or follows the spec. So HTML must serve two consumers: humans (CSS, layout, diagrams) and agents (parseable structure). The [[skill-body-convention]] page documents the resulting canonical semantic-tag vocabulary embedded inside both `SKILL.md` bodies (markdown) and generated HTML artifacts. ADR-0007 records the binding decision. The Artifact format routing rule (`CONTEXT.md`) determines per-artifact whether HTML or Markdown is the default.

## Related pages

- [[skill-body-convention]]
- [[claude-code-skills]]
- [[skill-authoring]]
- [[progressive-disclosure]]
- [[whitespace-and-formatting]]
