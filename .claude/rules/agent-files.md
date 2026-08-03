---
paths:
  - "plugins/agents-initializer/agents/*.md"
  - "plugins/agent-customizer/agents/*.md"
  - ".claude/agents/*.md"
  - ".claude/agents/**/*.md"
---
# Agent File Conventions
- YAML frontmatter required: `name`, `description`, `tools`, `model`, `maxTurns`
- `model: sonnet` by default — deviations require justification (e.g., `pr-comment-resolver` uses a different model)
- `tools:` default to read-only (`Read, Grep, Glob, Bash`) — new agent types may require additional tools when justified
- `maxTurns:` defaults: 15 for codebase/scope agents, 20 for evaluator agents — adjust per agent when justified
- Prompt must request structured output format
- Agents spawn other agents only when `Agent` is listed in `tools:` — omit it unless the agent's role is to delegate
