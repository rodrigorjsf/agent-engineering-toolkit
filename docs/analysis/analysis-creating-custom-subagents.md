# Analysis: Creating Custom Subagents in Claude Code

> **Status**: Current
> **Source document**: [creating-custom-subagents.md](https://docs.anthropic.com/en/docs/claude-code/subagents)
> **Analysis date**: 2025-06-01
> **Scope**: Custom subagent creation, configuration, and usage — context isolation, tool control, memory, hooks, worktree isolation, and orchestration patterns

---

## 1. Executive Summary

Anthropic's official document on custom subagents is the central reference for creating, configuring, and using specialized AI assistants within Claude Code. Subagents are defined as Markdown files with YAML frontmatter, stored in `agents/` directories with variable scope (session via CLI, project, user, or plugin). Each subagent operates in its own context window with a custom system prompt, restricted tool access, and independent permissions. Only two fields are required: `name` and `description`.

The fundamental mechanism is context isolation: subagents receive ONLY their system prompt (the markdown body) plus basic environment details — they do not receive the full Claude Code system prompt or the parent conversation history. This preserves the main context while enabling specialized work. Claude automatically decides when to delegate based on the `description` field and conversation context, but can be forced via @-mention (`@"code-reviewer (agent)"`) or configured as a session-wide agent (`claude --agent code-reviewer`).

Configuration capabilities are extensive: model selection (`haiku`, `sonnet`, `opus`, `inherit`), skill preloading, scoped MCP servers, lifecycle hooks, persistent memory (user/project/local), git worktree isolation, turn limit (`maxTurns`), effort level, and foreground or background execution. The most important restriction is that subagents cannot spawn other subagents, preventing infinite nesting.

---

## 2. Key Concepts and Mechanisms

### 2.1 Built-in Subagents

| Subagent | Model | Tools | Purpose |
|----------|-------|-------|---------|
| **Explore** | Haiku | Read-only (no Write/Edit) | Codebase search and analysis |
| **Plan** | Inherit | Read-only (no Write/Edit) | Research for planning mode |
| **general-purpose** | Inherit | All | Complex research, multi-step operations |
| **Bash** | Inherit | Terminal commands | Commands in separate context |
| **Claude Code Guide** | Haiku | -- | Questions about Claude Code features |

### 2.2 Scope Hierarchy

```
Priority 1 (highest):  Managed settings (organization-wide, deployed by admins)
Priority 2:            --agents CLI flag (single session, JSON)
Priority 3:            .claude/agents/ (project, versionable)
Priority 4:            ~/.claude/agents/ (user, all projects)
Priority 5 (lowest):   Plugin agents/ (where plugin is enabled)
```

When multiple subagents share the same name, the highest priority one wins.

### 2.3 Subagent File Format

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

The frontmatter defines metadata and configuration. The body becomes the system prompt that guides the subagent's behavior.

### 2.4 Supported Frontmatter Fields

| Field | Required | Description | Default |
|-------|----------|-------------|---------|
| `name` | Yes | Unique identifier (lowercase letters and hyphens) | -- |
| `description` | Yes | When Claude should delegate to this subagent | -- |
| `tools` | No | Allowed tools (allowlist) | Inherits all |
| `disallowedTools` | No | Denied tools (denylist) | -- |
| `model` | No | Model: `sonnet`, `opus`, `haiku`, full ID, or `inherit` | `inherit` |
| `permissionMode` | No | Permission mode | `default` |
| `maxTurns` | No | Agentic turn limit | -- |
| `skills` | No | Skills preloaded into the subagent's context | -- |
| `mcpServers` | No | MCP servers scoped to the subagent | -- |
| `hooks` | No | Scoped lifecycle hooks | -- |
| `memory` | No | Persistent memory: `user`, `project`, or `local` | -- |
| `background` | No | `true` to always run in background | `false` |
| `effort` | No | Effort level: `low`, `medium`, `high`, `xhigh`, `max` (available levels depend on the model) | Inherits from session |
| `isolation` | No | `worktree` for isolated git worktree | -- |
| `color` | No | Display color in the task list and transcript (`red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`) | -- |
| `initialPrompt` | No | Auto-submitted as the first user turn when run as the main session agent (via `--agent` or the `agent` setting) | -- |

### 2.5 Tool Control

**Allowlist** (only these tools):

```yaml
tools: Read, Grep, Glob, Bash
```

**Denylist** (all except these):

```yaml
disallowedTools: Write, Edit
```

**Spawnable subagent restriction** (only for `--agent` mode):

```yaml
tools: Agent(worker, researcher), Read, Bash
```

Interaction rule: if both `tools` and `disallowedTools` are defined, `disallowedTools` is applied first, then `tools` is resolved against the remaining pool.

### 2.6 Scoped MCP Servers

```yaml
mcpServers:
  # Inline definition: scoped only to this subagent
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
  # Reference by name: reuses already configured server
  - github
```

Inline definitions connect on subagent start and disconnect on finish. This prevents MCP tool descriptions from consuming context in the main conversation.

### 2.7 Persistent Memory

```yaml
memory: project  # Stores in .claude/agent-memory/<name>/
```

| Scope | Location | When to Use |
|-------|----------|-------------|
| `user` | `~/.claude/agent-memory/<name>/` | Cross-project learning |
| `project` | `.claude/agent-memory/<name>/` | Specific knowledge, versionable |
| `local` | `.claude/agent-memory-local/<name>/` | Specific but not committable |

When enabled: the system prompt includes read/write instructions, the first 200 lines of `MEMORY.md` are included, and Read/Write/Edit tools are automatically enabled.

### 2.8 Lifecycle Hooks

**In the subagent's frontmatter** (local scope):

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
```

**In settings.json** (project scope):

```json
{
  "hooks": {
    "SubagentStart": [
      { "matcher": "db-agent", "hooks": [{ "type": "command", "command": "./scripts/setup-db.sh" }] }
    ],
    "SubagentStop": [
      { "hooks": [{ "type": "command", "command": "./scripts/cleanup.sh" }] }
    ]
  }
}
```

### 2.9 Execution Modes

| Mode | Behavior | Permissions |
|------|----------|------------|
| **Foreground** | Blocks main conversation | Prompts passed to user |
| **Background** | Runs concurrently | Pre-approved; auto-denies the rest |

`Ctrl+B` to background a running task.

---

## 3. Points of Attention

### 3.1 The Subagent Context Gap

**The most critical point.** Subagents do NOT receive:

- The full Claude Code system prompt
- The parent conversation history
- Skills from the parent session (must be listed explicitly in the `skills` field)

They receive ONLY:

- Their system prompt (markdown body)
- Basic environment details (working directory)
- CLAUDE.md and project memory (via normal message flow)

**Implication**: The system prompt must be self-sufficient. All necessary context must be in the prompt or gathered via tools.

### 3.2 Anti-Nesting Restriction

Subagents CANNOT spawn other subagents. If a workflow requires nested delegation, use Skills or chain subagents from the main conversation.

### 3.3 Tool Description Cost

Even unused tools consume context via their descriptions. Restricting tools to the minimum necessary is an attention budget optimization.

### 3.4 Security Permissions in Plugins

Plugin subagents do NOT support `hooks`, `mcpServers`, or `permissionMode`. These fields are ignored on loading. To use them, copy the agent file to `.claude/agents/` or `~/.claude/agents/`.

### 3.5 Auto-Compaction

Subagents support auto-compaction at ~95% capacity. Configurable via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`. Compaction events are logged in transcripts: `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`.

### 3.6 Impact of `description` on Delegation

The `description` field is the only routing signal Claude uses to decide when to delegate. Vague descriptions cause inconsistent or excessive delegation. Descriptions with phrases like "Use proactively after..." or "Use when encountering..." significantly improve routing accuracy.

---

## 4. Use Cases and Scope

### 4.1 When to Use Subagents

| Scenario | Recommendation |
|----------|---------------|
| Operations that generate verbose output (tests, logs) | Subagent — isolates output from the main context |
| Code review with tool restrictions | Read-only subagent |
| Independent parallel research | Multiple subagents in parallel |
| Multi-step workflows with validation | Subagent chaining |
| Specialized domain (SQL, security) | Subagent with focused prompt |
| Risky operations (large refactoring) | Subagent with `isolation: worktree` |

### 4.2 When NOT to Use Subagents

| Scenario | Alternative |
|----------|------------|
| Frequent iteration with back-and-forth | Main conversation |
| Phases that share extensive context | Main conversation |
| Quick, targeted changes | Main conversation |
| Quick question about something already in context | `/btw` |
| Reusable prompts in main context | Skills |
| Workers that need to communicate | Agent Teams |

### 4.3 Decision Criteria for Model

| Task | Recommended Model | Justification |
|------|-------------------|---------------|
| Code exploration/search | `haiku` | Fast, read-only, does not require deep reasoning |
| Code review | `sonnet` | Quality/speed balance |
| Architecture decisions | `opus` | Complex trade-off analysis |
| Debugging | `sonnet` | Needs tools + reasoning, speed matters |
| Simple file operations | `haiku` | Mechanical, routine tasks |

---

## 5. Applicability to Agent Infrastructure

### 5.1 Skills

- **Skills that delegate to subagents**: The `context: fork` field in skills creates an isolated subagent. The `agent` field specifies which subagent configuration to use (Explore, Plan, general-purpose, or custom). This is the bridge between skills and subagents.
- **Skill preloading in subagents**: The `skills` field in frontmatter injects the full content of skills into the subagent's context at startup. It is the inverse of `context: fork` — here the subagent controls the system prompt and loads skill content.
- **Plugin-provided skills**: Plugin subagents load skills normally, but with security restrictions (no hooks, mcpServers, permissionMode).

**Example of a skill that delegates to a subagent**:

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:
1. Find relevant files using Glob and Grep
2. Read and analyze the code
3. Summarize findings with specific file references
```

**Example of a subagent that loads skills**:

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---

Implement API endpoints. Follow the conventions and patterns from the preloaded skills.
```

### 5.2 Hooks

- **Hooks in frontmatter**: `PreToolUse`, `PostToolUse`, `Stop` (converted to `SubagentStop` at runtime). Execute only while the subagent is active.
- **Hooks in settings.json**: `SubagentStart` and `SubagentStop` with matchers by agent type. Execute in the main session.
- **Hook types**: `command` (shell), `http` (POST), `prompt` (Claude evaluation), `agent` (verifier subagent)
- **Conditional guardrails**: `PreToolUse` + validation scripts for fine control (e.g., allow only SELECT queries)
- **Memory-triggered hooks**: No direct support, but `PostToolUse` hooks on the "Write|Edit" matcher can detect writes to memory directories

### 5.3 Subagents

- **Orchestration**: Hub-and-spoke model — subagents report to the caller, not to each other
- **Delegation**: Automatic (via description) or explicit (via @-mention or `--agent`)
- **Result synthesis**: Result returns to main context; Claude synthesizes
- **Parallel execution**: Multiple subagents can run in parallel (foreground or background)
- **Worktree isolation**: `isolation: worktree` creates an isolated repository copy; automatic cleanup if no changes
- **Resumption**: `SendMessage` with agent ID allows resuming subagents with full history
- **Chaining**: Subagents in sequence where each result feeds the next

### 5.4 Rules

- **Rules in subagent context**: `.claude/rules/` are loaded normally via CLAUDE.md
- **Path-scoped rules**: Activated when the subagent reads files matching the pattern
- **Plugin-scoped rules**: Plugin rules are loaded by the subagent normally
- **`@path` import**: Works normally within the subagent's context

### 5.5 Memory

- **Persistent subagent memory**: Three scopes (user, project, local) with `MEMORY.md` as index
- **First 200 lines**: Loaded at subagent startup, just like auto memory from the main session
- **Curation**: If `MEMORY.md` exceeds 200 lines, the subagent receives instructions to curate
- **Cross-session**: Memory persists between sessions, building an incremental knowledge base
- **Practical tip**: Include instructions in the prompt such as "Consult your memory before starting" and "Save what you learned when finishing"

---

## 6. Applicability of the Prompt Engineering Guide

### 6.1 CoT for Subagent Reasoning Chains

Subagents benefit from CoT in the system prompt, especially for analysis tasks. The recommended format:

```markdown
When invoked:
1. Gather context — run git diff and explore the codebase
2. Analyze — apply the review checklist
3. Reason step by step about each issue found
4. Verify — confirm that your conclusions are supported by evidence
5. Report — format findings with priority and fix examples
```

CoT is particularly effective with the `sonnet` model for reviews and debugging. With `haiku`, keep CoT minimal to avoid wasting tokens. With `opus`, prefer general instructions ("think thoroughly") which produce superior reasoning compared to prescriptive steps.

### 6.2 ReAct for Subagents with Tool Access

Subagents with tool access (Bash, Read, Grep) naturally operate in the ReAct pattern. The system prompt should encourage the cycle:

```markdown
## Process
1. **Think** about what you need to investigate
2. **Act** using the available tools (Read, Grep, Bash)
3. **Observe** the results
4. **Repeat** until you have sufficient information for a grounded conclusion
```

### 6.3 Tree of Thoughts for Exploration Subagents

For exploration subagents (`Explore` or custom), distributed ToT can be implemented via multiple parallel subagents, each exploring a different path:

```text
Research the authentication, database, and API modules in parallel using separate subagents
```

The main agent synthesizes the results as the evaluation step of ToT.

### 6.4 Self-Consistency for Validation Across Multiple Subagents

Running the same review subagent multiple times (with temperature >0) and comparing results implements Self-Consistency. Issues reported by multiple runs have higher confidence. Cost: multiplied by the number of runs.

### 6.5 Reflexion for Iterative Subagent Improvement

The combination of chained subagents implements Reflexion:

```text
1. Use code-reviewer to find issues
2. Use debugger to fix the issues found
3. Use code-reviewer again to validate the fixes
```

`PostToolUse` hooks can automate the reflection: after each edit, run linter or tests.

### 6.6 Least-to-Most for Task Decomposition Across Subagents

Decompose a complex task into subtasks and delegate each to a subagent:

```text
First use the Explore agent to map the architecture
Then use the planner agent to create a plan based on the mapping
Finally use the developer agent to implement the plan
```

Each subagent receives the result from the previous one, implementing progressive decomposition.

---

## 7. Correlations with Core Documents

### With "Orchestrate Teams of Claude Code Sessions"

Direct complementarity. Subagents operate in a hub-and-spoke model; agent teams in a peer-to-peer model. Subagents are cheaper (summarized results returned) but without inter-worker communication. The decision between both depends on the need for communication between workers.

### With "Research: Subagent Best Practices"

The research document deepens everything the official documentation presents: tool patterns, community examples, anti-patterns, prompt engineering for system prompts. The information on Confidence-Based Filtering and the anti-patterns section are unique contributions from the research that complement the official documentation.

### With "How Claude Remembers a Project"

Subagent memory is a special case of auto memory: same mechanism (MEMORY.md + topic files, first 200 lines), but with specific scopes (user/project/local). The CLAUDE.md hierarchy works normally within the subagent's context. Path-scoped rules in `.claude/rules/` are activated as the subagent navigates the codebase.

### With "Create Plugins"

Plugins can contain agents in `agents/`. The main restriction is that plugin agents do NOT support `hooks`, `mcpServers`, or `permissionMode` for security reasons. To use these fields, the agent must be copied to `.claude/agents/`. The `agent` field in the plugin's `settings.json` activates an agent as the main thread.

### With "Research: LLM Context Optimization"

The subagent context isolation concept is a direct implementation of LangChain's "Isolate" strategy (separate contexts of different agents to avoid cross-contamination). The recommendation to restrict tools to the minimum necessary is an application of the "attention budget" principle — tool descriptions consume context even when unused.

---

## 8. Strengths and Limitations

### Strengths

1. **Configuration flexibility**: 16 frontmatter fields cover most scenarios
2. **Context isolation**: Protects the main conversation from verbose output
3. **Scope hierarchy**: CLI > project > user > plugin allows granular override
4. **Scoped MCP servers**: Plugin tools stay out of the main context
5. **Persistent memory**: Cross-session accumulated knowledge per subagent
6. **Worktree isolation**: Safety for risky operations
7. **Multiple invocation methods**: Natural language, @-mention, --agent, settings
8. **Subagent resumption**: SendMessage with agent ID preserves full history
9. **Auto-compaction**: Prevents context overflow in long-running subagents

### Limitations

1. **No nesting**: Subagents cannot spawn other subagents
2. **Context gap**: Do not receive the parent conversation history
3. **Skills not inherited**: Must be listed explicitly
4. **Plugin restrictions**: No hooks, mcpServers, or permissionMode in plugin agents
5. **Result in main context**: Many subagents with detailed results can pollute the context
6. **Background auto-deny**: Background subagents auto-deny non-pre-approved permissions
7. **Startup cost**: Subagents start from scratch, needing time to gather context

---

## 9. Practical Recommendations

### 9.1 Project Subagent Template

```markdown
---
name: project-reviewer
description: >-
  Code review specialist for [project]. Use proactively after code changes.
  Checks quality, security, and adherence to project conventions.
tools: Read, Grep, Glob, Bash
model: sonnet
memory: project
maxTurns: 20
---

You are a senior code reviewer for [project name].

## Your Role
- Review code changes for quality, security, and maintainability
- Check adherence to project conventions documented in CLAUDE.md
- Consult your memory for patterns and issues discovered in previous reviews

## Process
1. **Gather context** -- Run `git diff --staged` and `git diff`
2. **Read memory** -- Check agent memory for known patterns
3. **Review** -- Apply checklist to all changed files
4. **Report** -- Format findings by priority (Critical > High > Medium)
5. **Update memory** -- Save new patterns or recurring issues

## Confidence Filter
- Report issues only if >80% confident
- Skip stylistic preferences unless they violate project conventions
- Consolidate similar issues
```

### 9.2 Chaining Pattern for Complex Workflows

```text
# Step 1: Research
Use the explore subagent to analyze the authentication module architecture

# Step 2: Planning
Based on the findings, use the planner subagent to create a refactoring plan

# Step 3: Implementation
Use the developer subagent to implement the first phase of the plan

# Step 4: Validation
Use the code-reviewer subagent to review the implementation
```

### 9.3 Cost Optimization

1. Use `haiku` for exploration and search (built-in Explore already does this)
2. Use `sonnet` as default for general work
3. Reserve `opus` only for complex architecture decisions
4. Restrict tools to the minimum necessary (reduces tool description tokens)
5. Set `maxTurns` to prevent runaway agents
6. Use inline MCP servers to avoid tool descriptions in the main context

### 9.4 Security

1. Use `permissionMode: plan` for subagents that should only observe
2. Use `permissionMode: dontAsk` for subagents that should fail gracefully
3. Implement `PreToolUse` hooks for risky command validation
4. Use `isolation: worktree` for large refactorings
5. Never use `bypassPermissions` without explicit need and understanding of the risks
