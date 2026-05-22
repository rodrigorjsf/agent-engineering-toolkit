---
paths:
  - "plugins/agents-initializer/skills/*/references/*.md"
  - "plugins/cursor-initializer/skills/*/references/*.md"
  - "plugins/cursor-customizer/skills/*/references/*.md"
  - "plugins/agent-customizer/skills/*/references/*.md"
  - "plugins/orchestrate/skills/*/references/*.md"
  - "skills/*/references/*.md"
---
# Reference File Conventions

- Files over 100 lines MUST include a `## Contents` table of contents after the title block
- Maximum 200 lines per reference file
- Content must be framed as "read as instructions" — not as executable scripts
- Reference files MUST be self-contained — no `Source:` attribution lines, and no inline citations (file paths, line ranges, or external document names) pointing to documents outside the skill's own bundle; a reference file may only mention sibling files inside its own skill directory
- Identical-content parity applies only to explicitly shared references and same-platform copies
- Platform-specific references may reuse filenames when their content is intentionally platform-native
- No nested references — reference files must not import or reference other reference files
