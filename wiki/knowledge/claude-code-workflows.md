# Claude Code Dynamic Workflows

**Summary**: Dynamic workflows — a JavaScript script the runtime executes to orchestrate dozens–hundreds of subagents; the plan lives in code and intermediate results stay in script variables, off the main context.
**Sources**: dynamic-workflows.md
**Last updated**: 2026-06-04
---

A dynamic workflow is a JavaScript script that orchestrates [[claude-code-subagents]] at scale (source: dynamic-workflows.md). Claude writes the script for the task you describe, and a runtime executes it in the background while your session stays responsive (source: dynamic-workflows.md). Dynamic workflows are in research preview and require Claude Code v2.1.154 or later (source: dynamic-workflows.md). They are available on all paid plans, with Anthropic API access, and on Amazon Bedrock, Google Cloud Vertex AI, and Microsoft Foundry (source: dynamic-workflows.md).

Reach for a workflow when a task needs more agents than one conversation can coordinate, or when you want the orchestration codified as a script you can read and rerun (source: dynamic-workflows.md). Example tasks include a codebase-wide bug sweep, a 500-file migration, a research question whose sources need cross-checking against each other, and a hard plan worth drafting from several independent angles before committing to one (source: dynamic-workflows.md).

## The third orchestration primitive: who holds the plan

[[claude-code-subagents]] (subagents), [[claude-code-skills]] (skills), and workflows can all run a multi-step task; the difference is who holds the plan (source: dynamic-workflows.md). A subagent is a worker Claude spawns, and a skill is a set of instructions Claude follows — in both cases Claude decides turn by turn what runs next, and every result lands in Claude's context window (source: dynamic-workflows.md). A workflow is a script the runtime executes, so the script decides what runs next, and intermediate results live in script variables (source: dynamic-workflows.md).

With subagents and skills, Claude is the orchestrator; a workflow moves the plan into code, so the script holds the loop, the branching, and the intermediate results itself, and Claude's context holds only the final answer (source: dynamic-workflows.md). What is repeatable also differs: subagents make the worker definition repeatable and skills make the instructions repeatable, whereas a workflow makes the orchestration itself repeatable (source: dynamic-workflows.md). Subagents and skills handle a few delegated tasks per turn, while a workflow scales to dozens to hundreds of agents per run (source: dynamic-workflows.md). On interruption, subagents and skills restart the turn, while a workflow is resumable within the same session (source: dynamic-workflows.md). This placement of the orchestration loop in code makes dynamic workflows a [[context-engineering]] strategy, not just a scaling feature.

## Quality patterns, not just more agents

Moving the plan into code lets a workflow apply a repeatable quality pattern, not just run more agents (source: dynamic-workflows.md). A workflow can have independent agents adversarially review each other's findings before they are reported, or draft a plan from several angles and weigh them against each other, so the result is more trustworthy than a single pass (source: dynamic-workflows.md). This is the codified, rerunnable counterpart to the orchestration patterns described in [[agent-workflows]] and a concrete instance of [[harness-engineering]].

## Running a bundled workflow

Claude Code includes `/deep-research` as a built-in workflow for investigating a question across many sources (source: dynamic-workflows.md). It fans out web searches on a question across several angles, fetches and cross-checks the sources it finds, votes on each claim, and returns a cited report with claims that didn't survive cross-checking filtered out (source: dynamic-workflows.md). `/deep-research` requires the WebSearch tool to be available (source: dynamic-workflows.md). The cross-check-and-vote step pairs naturally with the verification framing in [[structured-outputs]].

Run `/workflows` at any time to list running and completed workflows, then select one to open its progress view, which shows each phase with its agent counts, token totals, and elapsed time (source: dynamic-workflows.md). You can drill into any phase to read its agents' prompts, recent tool calls, and results, pause or resume the run, stop an individual agent or the whole workflow, restart a running agent, or save the run's script as a command (source: dynamic-workflows.md). A one-line progress summary also appears in the task panel below the input box while a run is going (source: dynamic-workflows.md).

## Having Claude write a workflow

Claude writes a workflow for your task in two ways (source: dynamic-workflows.md). The first is to include the word `workflow` anywhere in your prompt: Claude Code highlights the word and Claude writes a workflow script for the task instead of working through it turn by turn (source: dynamic-workflows.md). If the keyword is highlighted when you didn't mean to trigger a workflow, press `alt+w` to ignore it for the prompt, or turn off the Workflow keyword trigger in `/config` (source: dynamic-workflows.md).

The second is `/effort ultracode`, a setting that combines `xhigh` reasoning effort with automatic workflow orchestration, so Claude plans a workflow for each substantive task instead of waiting for you to ask (source: dynamic-workflows.md). A single request can turn into several workflows in a row — for example one to understand the code, one to make the change, and one to verify it — which uses more tokens and takes longer than lower effort levels (source: dynamic-workflows.md). Ultracode lasts for the current session and resets when you start a new one (source: dynamic-workflows.md).

### Approving the plan before it runs

In the CLI, the per-run prompt shows the planned phases with options to run it, run it and skip the prompt for that workflow in the project from now on, view the raw script, or cancel (source: dynamic-workflows.md). Whether you see this prompt depends on your permission mode: in Default and accept-edits modes you are prompted every run unless you chose "don't ask again" for that workflow; in Auto mode you are prompted on first launch only, and it is skipped entirely when ultracode is on; under Bypass permissions, `claude -p`, and the Agent SDK the run starts immediately with no prompt (source: dynamic-workflows.md).

Your permission mode controls only the launch prompt — the subagents the workflow spawns always run in `acceptEdits` mode and inherit your tool allowlist regardless of the session's mode, and file edits are auto-approved (source: dynamic-workflows.md). Shell commands, web fetches, and MCP tools that aren't in your allowlist can still prompt you mid-run, so adding the commands the agents need to your allowlist before a long run avoids interruptions (source: dynamic-workflows.md). This `acceptEdits`-plus-allowlist behavior is the Claude-Code-specific runtime contract for the worker subagents described in [[claude-code-subagents]].

### Saving a workflow for reuse

When Claude writes a workflow for a task you'll repeat, you can save that run's script as a command by selecting the run in `/workflows` and pressing `s` (source: dynamic-workflows.md). The save dialog offers two locations: `.claude/workflows/` in your project, shared with everyone who clones the repo, or `~/.claude/workflows/` in your home directory, available in every project but visible only to you (source: dynamic-workflows.md). The workflow then runs as `/<name>` in future sessions, and if a project workflow and a personal workflow share a name, the project one runs (source: dynamic-workflows.md).

## How a workflow runs

The workflow runtime executes the script in an isolated environment, separate from your conversation, so intermediate results stay in script variables instead of landing in Claude's context (source: dynamic-workflows.md). The runtime tracks each agent's result as the run progresses, which is what makes a run resumable within the same session (source: dynamic-workflows.md).

### Behavior and limits

The runtime applies several constraints (source: dynamic-workflows.md). A run takes no mid-run user input — only agent permission prompts can pause it — so for sign-off between stages you run each stage as its own workflow (source: dynamic-workflows.md). The workflow script itself has no direct filesystem or shell access; only its spawned agents read, write, and run commands, while the script coordinates them (source: dynamic-workflows.md). A run uses up to 16 concurrent agents, fewer on machines with limited CPU cores, to bound local resource use (source: dynamic-workflows.md). A run is capped at 1,000 agents total to prevent runaway loops (source: dynamic-workflows.md).

### Resuming after a pause

If you stop a run, you can resume it: agents that already completed return their cached results, and the rest run live (source: dynamic-workflows.md). Resume a paused run from `/workflows` by selecting it and pressing `p`, or ask Claude to relaunch the workflow with the same script (source: dynamic-workflows.md). Resume works only within the same Claude Code session — if you exit Claude Code while a workflow is running, the next session starts the workflow fresh (source: dynamic-workflows.md).

### Cost

A workflow spawns many agents, so a single run can use meaningfully more tokens than working through the same task in conversation, and runs count toward your plan's usage and rate limits like any other session (source: dynamic-workflows.md). You can stop a running workflow from `/workflows` at any time without losing completed work (source: dynamic-workflows.md). Every agent in a workflow uses your session's model unless the script routes a stage to a different one, so checking `/model` before a large run and asking Claude to use a smaller model for stages that don't need the strongest one both control cost (source: dynamic-workflows.md).

## Turning workflows off

Workflows are available in the CLI, the Desktop app, the IDE extensions, non-interactive mode with `claude -p`, and the Agent SDK, and the same disable settings apply on every surface (source: dynamic-workflows.md). To turn them off for yourself, toggle Dynamic workflows off in `/config`, set `"disableWorkflows": true` in `~/.claude/settings.json`, or set `CLAUDE_CODE_DISABLE_WORKFLOWS=1` (source: dynamic-workflows.md). To turn them off for a whole organization, set `"disableWorkflows": true` in managed settings or use the toggle on the Claude Code admin settings page (source: dynamic-workflows.md). When workflows are disabled, the bundled workflow commands are unavailable, the `workflow` keyword no longer triggers a run, and `ultracode` is removed from the `/effort` menu (source: dynamic-workflows.md).

## Related pages

- [[agent-workflows]]
- [[subagents]]
- [[claude-code-subagents]]
- [[context-engineering]]
- [[harness-engineering]]
- [[structured-outputs]]
- [[claude-code-commands]] — the `/workflows` and `/deep-research` commands are the interactive entry points for dynamic workflows
- [[claude-code-tools]] — the Workflow tool entry and its permission requirement
