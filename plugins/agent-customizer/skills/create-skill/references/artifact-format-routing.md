# Artifact Format Routing

Evidence-based routing rule for deciding whether a skill's generated output artifact
should default to HTML or Markdown.

---

## Routing Table

When `create-skill` generates a new skill, the new skill's output format is
determined by the artifact kind that new skill produces:

| Artifact kind                                  | Default format | Reason                                            |
| ---------------------------------------------- | -------------- | ------------------------------------------------- |
| Plan, PRD, design spec                         | HTML           | Human-rich + agent-executable                     |
| Report (weekly status, research, explainer)    | HTML           | Human-rich + agent-executable                     |
| Prototype, custom editor, code-review writeup  | HTML           | Interactivity benefits from HTML                  |
| `SKILL.md`, subagent `.md`                     | Markdown       | Agent-loaded; spec-mandated                       |
| `AGENTS.md`, `CLAUDE.md`                       | Markdown       | Agent-loaded; spec-mandated                       |
| `.claude/rules/*.md`, `.cursor/rules/*.mdc`    | Markdown       | Agent-loaded; spec-mandated                       |
| `wiki/knowledge/*.md`                          | Markdown       | Agent-loaded by wiki-routing rule                 |
| `docs/adr/*.md`                                | Markdown       | Tooling-locked (ADR convention)                   |
| `CONTEXT.md`                                   | Markdown       | Tooling-locked (`grill-with-docs` reads it)       |
| `README.md`                                    | Markdown       | Tooling-locked (npm/GitHub renderers)             |
| Commit message, PR body, GitHub issue          | Markdown       | Tooling-locked (GitHub renderers)                 |
| Code comments                                  | Markdown-ish   | Tooling-locked (compiler/linter parses)           |

Explicit user override (`generate as markdown`) always wins over the default.

---

## How to classify

During Phase 2 (generate-skill), before choosing the output template:

1. **Identify the output artifact kind** — ask: "What does this new skill produce?
   A plan/PRD/spec/report? Or a platform config file (SKILL.md, rule, ADR)?"

2. **Apply the routing table above.** The left column describes the artifact kind;
   the Default format column gives the verdict.

3. **Check for explicit override.** If the user said "generate as markdown" (or
   equivalent phrasing like "output markdown", "use .md", "markdown format"), the
   override wins regardless of the routing table verdict.

4. **Act on the verdict:**
   - **HTML default** → use `${CLAUDE_SKILL_DIR}/assets/templates/html-artifact-skeleton.html`
     as the output template for the new skill. Instruct the new skill to carry the
     canonical semantic tags (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>`
     with one or more `<PHASE id name>`, plus relevant optional tags `<OUTPUT>`,
     `<VALIDATION>`) inside the HTML `<body>`. Copy or reference the skeleton into
     the new skill's `assets/templates/` directory.
   - **Markdown default** → use the standard `${CLAUDE_SKILL_DIR}/assets/templates/skill-md.md`
     template (or a Markdown template appropriate to the artifact type).
   - **Explicit override** → apply the user's stated format regardless of the table.

---

## HTML skeleton location

The HTML baseline skeleton lives at:

```
${CLAUDE_SKILL_DIR}/assets/templates/html-artifact-skeleton.html
```

It is a valid HTML5 document with:
- `<meta charset>` and `<meta name="viewport">`
- Scoped CSS targeting each semantic tag (`BEHAVIOUR`, `HARD_RULES`, `PHASE`, `OUTPUT`,
  `VALIDATION`, `ANTI_PATTERN`, etc.) with adaptive colors (light and dark mode via
  CSS custom properties and `@media (prefers-color-scheme: dark)`)
- Placeholder `{{artifact-title}}` in `<title>` and `<h1>`
- A `<main>` block containing the canonical semantic-tag scaffold

When generating a new HTML-defaulting skill, copy this skeleton into the new skill's
`assets/templates/` directory (e.g., as `<artifact-type>.html`). Replace
`{{artifact-title}}` with the artifact name appropriate to the new skill.

---

## Canonical semantic tags in HTML artifacts

Generated HTML artifacts MUST carry the canonical semantic tags inside the HTML body.
The same vocabulary that governs `SKILL.md` bodies applies:

**Mandatory tags (HTML artifact)**:
- `<TRIGGER when="...">` — plain-language activation context
- `<BEHAVIOUR avoid="..." always="...">` — behavioural guidelines
- `<HARD_RULES priority="hard">` — inviolable constraints
- `<PROCESS>` containing at least one `<PHASE id="N" name="...">` — ordered execution steps

**Optional tags (HTML artifact)**:
- `<PREFLIGHT>`, `<REFERENCES>`, `<EXAMPLE>`, `<ANTI_PATTERN>`, `<OUTPUT>`, `<VALIDATION>`

**Closed attribute set**: `avoid=`, `always=`, `when=`, `name=`, `id=`, `priority=`.

These tags are valid HTML5 — browsers treat unknown elements as inline by default;
the CSS in the skeleton promotes each to `display: block` with semantic styling.

---

## Why HTML for human-rich artifacts

HTML artifacts serve two consumers: humans (CSS layout, diagrams, interactive controls)
and the next LLM session (parseable semantic-tag structure). The dual-consumer design
is why this project's HTML artifacts embed canonical semantic tags — the same parse
target serves both.

Markdown past ~100 lines stops being read; rich visualisations get faked with ASCII;
HTML renders natively in any browser without extra tooling. For agent-loaded and
tooling-locked files the tradeoffs reverse: spec compliance, diffability, and
renderer compatibility make Markdown mandatory.
