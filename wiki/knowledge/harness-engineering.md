# Harness Engineering

**Summary**: Harness engineering is the practice of building the infrastructure, configuration, and workflows that surround an AI model to make it reliable — the "operating system" of an autonomous coding agent. Evidence shows harness quality matters more than model choice.
**Sources**: harness-engineering.md, harnessengineering-building-the-operating-system-for-autonomous-agents.md, skill-issue-harness-engineering-for-coding-agents.md, building-agent-harness-martin-richards.md, effective-harnesses-long-running-agents.md
**Last updated**: 2026-05-01

---

## The Core Equation

The cleanest formulation, repeated across multiple independent practitioners:

```
coding agent = AI model + harness
```

A raw model is not an agent. It becomes one when a harness gives it state, tool execution, feedback loops, and enforceable constraints. Everything that is not the model itself is the harness. (source: skill-issue-harness-engineering-for-coding-agents.md)

The harness is deliberately invisible to the model. The model continues to reason and use tools as it always would — the harness silently ensures that what the model can do is bounded by what it should do.

## Harness > Model Choice: The Evidence

The most compelling case for investing in the harness comes from a 2026 LangChain benchmark: they improved their coding agent from **52.8% to 66.5%** on Terminal Bench 2.0 by changing only the harness, keeping the model fixed. Same model, better harness, better results. (source: building-agent-harness-martin-richards.md)

This finding tracks with independent observations across the field. As Mitchell Hashimoto put it:

> The models have improved to a point where which model you use matters less than how you use it. The gap between Claude, Gemini, and GPT shrinks with every release.

The corollary: a misconfigured harness with a great model still fails. Teams that blamed model quality for poor output were almost always looking at a configuration problem. (source: skill-issue-harness-engineering-for-coding-agents.md)

## What Harness Engineering Is

The term was coined by Mitchell Hashimoto in February 2026. His original framing was reactive: "anytime you find an agent makes a mistake, engineer a solution so it never makes that mistake again." Martin Richards broadened the definition: a harness is a set of skills, workflows, and methodology that teaches your agent how you think and how you build. (source: building-agent-harness-martin-richards.md)

HumanLayer frames harness engineering as a subset of [[context-engineering]] — specifically, the subset focused on leveraging harness configuration points to carefully manage the context windows of coding agents. (source: skill-issue-harness-engineering-for-coding-agents.md)

The harness answers questions that prompts cannot:

- How do we give the agent new capabilities beyond file I/O?
- How do we teach it things about our codebase not in training data?
- How do we add determinism beyond "CRITICAL: always do XYZ"?
- How do we prevent context windows from inflating with bad context?
- How do we increase task success rates beyond magic prompts?

## Independent Convergence

One of the most striking findings: the research-plan-implement pattern emerged independently across multiple organizations. (source: building-agent-harness-martin-richards.md)

- **HumanLayer** called it "RPI" (Research → Plan → Implement)
- **Jesse Vincent's Superpowers** (40k+ stars) landed on the same shape
- **Martin Richards' Atelier** implements the same loop through structured skills
- **Boris Tane's workflow** separates planning from execution as the single most important practice

The convergence says more about the pattern than any one implementation. The harness does not need to be complicated — it needs to exist.

## The Five Pillars of Context Engineering in the Harness

The harness is the implementation layer of [[context-engineering]]. The context window is the "desk" of the LLM — curating it contributes 90% of output quality versus only 10% for specific prompt wording. (source: harness-engineering.md)

Five pillars:

1. **Selection**: Every token must earn its place. Irrelevant data is not just waste — it is an active distractor. Implement Dynamic Tool Loading to prevent token bloat from unused tool definitions.

2. **Structuring**: Models exhibit positional bias ("lost in the middle" — see [[long-context-lost-in-middle]]). Use clear Markdown delimiters and temporal weighting to prioritize recent or critical data.

3. **Memory**: Systems must distinguish between core knowledge, conversation history, and ephemeral task data. Deploy rolling summarization to preserve semantic meaning without hoarding redundant tokens.

4. **Compression**: Larger windows are slower and prone to "context rot." Apply semantic compression to strip redundancy while preserving functional intent.

5. **Evaluation**: Measurement is the only path to improvement. Track context utilization and answer grounding to ensure the model uses provided data.

## The Dumb Zone

A model's advertised capacity (e.g., 200K tokens) is not its effective context window:

- **Smart Zone** (<40% utilization): Coherent, captures subtle logic errors
- **Dumb Zone** (>60% utilization): Performance degrades sharply

According to Chroma Research, degradation is driven not just by length but by the "distractor effect" — when there is low semantic similarity between the query and noise (failed attempts, verbose logs), reasoning ability collapses. This makes intentional compaction an architectural necessity, not an optimization. (source: harness-engineering.md, skill-issue-harness-engineering-for-coding-agents.md)

Avoiding the dumb zone is why every major harness pattern emphasizes fresh context windows between phases (see [[rpi-workflow]]) and [[claude-code-subagents]] as context firewalls.

## Harness Components

### AGENTS.md / CLAUDE.md

Deterministic system prompt injections — the agent's "employee handbook" with workflows, thresholds, and behavioral constraints. Critical requirement: these files must be human-crafted.

Evidence from an ETH Zurich study on 138 agentfiles: LLM-generated ones hurt performance while costing 20%+ more in reasoning tokens. Human-written ones helped only when concise, universally applicable, and avoiding codebase overview content (agents discover repository structure on their own). (source: skill-issue-harness-engineering-for-coding-agents.md)

HumanLayer keeps their CLAUDE.md under 60 lines. The principle: less is more. Too many conditional rules, heavy steering toward specific tools, and irrelevant context all degrade outcomes.

### MCP Servers: Too Many Tools Causes the Dumb Zone

MCP servers extend agent capabilities beyond file I/O. But their tool descriptions are injected into the system prompt — meaning every tool definition consumes tokens before the agent even starts working. (source: skill-issue-harness-engineering-for-coding-agents.md)

The critical failure mode: connecting too many MCP servers pushes the agent into the dumb zone at the start of a session, before any actual work begins. The entire "smart zone" is consumed by tool descriptions.

Practical prescriptions:
- If not actively using a server with many tools, disable it
- If an MCP server duplicates a well-known CLI (GitHub, Docker, databases), use the CLI — the model already knows how to use it from training data, and you gain composability with `grep` and `jq`
- Write context-efficient CLIs for frequently-used APIs rather than using verbose MCP responses

### Skills: Progressive Disclosure of Knowledge

[[claude-code-skills]] are "instruction modules" — knowledge activated only when relevant, protecting the initial prompt budget. The model does not see skill content until the skill is invoked.

Skills solve the problem of "blowing through the instruction budget before the agent starts working" by ensuring the agent only gets specific instructions, knowledge, or tools when it decides it needs them. (source: skill-issue-harness-engineering-for-coding-agents.md)

Skills are also how harness configurations get distributed to teams — battle-tested configurations deployed via repository-level config or installable via `npx skills add`.

### Sub-Agents: Context Firewalls

Sub-agents are commonly misunderstood. "Frontend engineer" sub-agents and "backend engineer" sub-agents do not produce better results — role delegation is not the value. The value is context control. (source: skill-issue-harness-engineering-for-coding-agents.md)

A sub-agent encapsulates an entire coding session's worth of intermediate work (glob results, file reads, grep output) in an isolated context window. None of that noise reaches the parent context. Only the condensed, high-relevance result flows back.

This is how agents maintain coherency across many sessions on hard problems. Breaking work into discrete tasks delegated to sub-agents is the mechanism for keeping the primary thread in the smart zone.

Sub-agents also enable cost control: use expensive models (Opus) for orchestration and planning in the parent thread, cheaper models (Sonnet, Haiku) for discrete sub-tasks that don't require full reasoning capability.

See also [[claude-code-subagents]] for implementation details.

### Hooks: Deterministic Control Flow

[[claude-code-hooks]] are user-defined scripts that execute at agent lifecycle events. They provide:

- **Verification**: Run typechecks on every agent stop to force mechanical correction before human review
- **Notifications**: Alert when agents finish or need attention
- **Approvals**: Automatically approve or deny tool calls based on rules more expressive than the default permissions model
- **Integrations**: Send Slack messages, create PRs, set up preview environments on completion

The golden rule of hook output: **success should be silent; failures should be verbose.** Verbose success logs (4,000 lines of passing tests) flood the context window and push the agent into the dumb zone. The harness must swallow successful logs and surface only error traces. (source: harness-engineering.md, skill-issue-harness-engineering-for-coding-agents.md)

## Long-Running Agent Pattern

Complex tasks requiring work across hours or days require specialized harness architecture. Two-part solution from Anthropic research: (source: effective-harnesses-long-running-agents.md)

### Initializer Agent

Runs only on first session. Sets up:
- `init.sh` to run the development server
- `feature_list.json` with every required feature marked initially as failing
- `claude-progress.txt` tracking what agents have done
- Initial git commit showing what files were added

The feature list uses JSON rather than Markdown — models are less likely to inappropriately overwrite JSON. Features are updated only by changing a `passes` field; deletion is explicitly prohibited.

### Coding Agent (Every Subsequent Session)

Each coding session starts with orientation:
1. Run `pwd` to locate working directory
2. Read git logs and progress files
3. Read feature list and select highest-priority incomplete feature
4. Run `init.sh` to start dev server and verify basic functionality

The coding agent works on one feature at a time, commits with descriptive messages after each feature, and writes progress summaries. This incremental approach prevents the tendency to "one-shot" everything, which causes context exhaustion mid-implementation.

### Failure Modes and Solutions

| Problem | Solution |
|---------|----------|
| Agent declares project done too early | Feature list file with explicit pass/fail status per feature |
| Agent leaves bugs or undocumented progress | Progress notes file + git commit at end of every session |
| Agent marks features done without proper testing | End-to-end testing with browser automation; only mark passing after verification |
| Agent has to figure out how to run the app | `init.sh` written by initializer agent |

## Back-Pressure and Verification

The agent's likelihood of successfully solving a problem correlates directly with its ability to verify its own work. This is back-pressure: deterministic feedback that forces the agent to iterate until correct. (source: skill-issue-harness-engineering-for-coding-agents.md)

High-leverage verification mechanisms:
- **LSP integration**: Language Server Protocol plugins (pyright, gopls, rust-analyzer) for real-time type-error detection
- **Static analysis**: Ruff, mypy, Pyright running automatically
- **Unit and integration tests** with coverage reporting
- **Browser automation** (Playwright) for end-to-end testing of web apps

All verification must be context-efficient — verbose output from passing tests creates distractor noise that degrades reasoning quality.

## Agentic Software Modernization Context

Legacy codebases (COBOL, RPG, undocumented brownfield systems) compound the harness challenge. Stanford research shows a clear correlation: in "dirty" environments (high entropy, technical debt), AI produces more errors and can accelerate technical debt. In clean environments (high test coverage, good modularity, typing), AI can autonomously drive a large share of sprint tasks. (source: agentic-software-modernization-markus-harrer.md)

The entropy problem: when AI agents work within existing low-quality codebases, produced code mirrors the low standards of the existing environment — a death spiral of automated technical debt creation.

The harness prescription for modernization:
- Invest in codebase hygiene before scaling AI (rename cryptic variables, refactor toward known patterns)
- Use RPI workflow strictly — never let the agent code immediately
- Use critic agents (separate read-only agents that evaluate and score generated code)
- Maintain traceability links from new code to original line numbers in legacy code
- Practice active context compaction (summarize → new session → feed summary) when agents go off-track

## What Does Not Work

From HumanLayer's experience: (source: skill-issue-harness-engineering-for-coding-agents.md)

- Designing the ideal harness configuration upfront before hitting real failures
- Installing dozens of skills and MCP servers "just in case"
- Running the entire test suite (5+ minutes) at the end of every session
- Micro-optimizing which sub-agents can access which tools (causes tool thrash, worse results)

What works: start simple, add configuration only when the agent actually fails, distribute battle-tested configurations to the whole team.

## Related pages

- [[context-engineering]]
- [[rpi-workflow]]
- [[claude-code-skills]]
- [[claude-code-hooks]]
- [[claude-code-subagents]]
- [[claude-code-memory]]
- [[agent-best-practices]]
- [[progressive-disclosure]]
- [[subagents]]
- [[long-context-lost-in-middle]]
- [[spec-driven-development]]
- [[human-layer]]
- [[pi-context-zone]]
