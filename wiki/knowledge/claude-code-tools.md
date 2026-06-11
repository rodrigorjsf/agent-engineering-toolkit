# Claude Code Tools

**Summary**: Catalog of every built-in tool available to Claude Code, including permission requirements, per-tool behavior details, and the rule-format syntax used in permissions, hooks, and subagent definitions.
**Sources**: tools-ref.md
**Last updated**: 2026-06-11

---

Claude Code ships with a fixed set of built-in tools. Tool names are the exact strings used in permission rules, subagent `tools` fields, and hook matchers — see [[claude-code-hooks]], [[claude-code-subagents]], and [[claude-code-skills]] for where each surface accepts them (source: tools-ref.md). Custom tools are added via MCP servers; reusable prompt-based extensions use the `Skill` tool and the [[claude-code-skills]] system instead of adding new tool entries (source: tools-ref.md).

## Built-in Tool Catalog

| Tool | Description | Permission Required |
|:---|:---|:---|
| `Agent` | Spawns a subagent with its own context window. See [Agent tool](#agent-tool) | No |
| `AskUserQuestion` | Asks multiple-choice questions to gather requirements or clarify ambiguity | No |
| `Bash` | Executes shell commands. See [Bash tool](#bash-tool) | Yes |
| `CronCreate` | Schedules a recurring or one-shot prompt within the current session; session-scoped, restored on `--resume`/`--continue` if unexpired | No |
| `CronDelete` | Cancels a scheduled task by ID | No |
| `CronList` | Lists all scheduled tasks in the session | No |
| `Edit` | Makes targeted edits to specific files. See [Edit tool](#edit-tool) | Yes |
| `EnterPlanMode` | Switches to plan mode to design an approach before coding | No |
| `EnterWorktree` | Creates an isolated git worktree and switches into it; from within a worktree only the `path` form targeting `.claude/worktrees/` is available. See [[claude-code-worktrees]] | No |
| `ExitPlanMode` | Presents a plan for approval and exits plan mode | Yes |
| `ExitWorktree` | Exits a worktree session and returns to the original directory; not available to subagents that already run in their own working directory. See [[claude-code-worktrees]] | No |
| `Glob` | Finds files by name pattern. See [Glob tool](#glob-tool) | No |
| `Grep` | Searches file contents for patterns. See [Grep tool](#grep-tool) | No |
| `ListMcpResourcesTool` | Lists resources exposed by connected MCP servers | No |
| `LSP` | Code intelligence via language servers: definitions, references, type errors. See [LSP tool](#lsp-tool) | No |
| `Monitor` | Runs a command in the background and feeds each output line back to Claude. See [Monitor tool](#monitor-tool) | Yes |
| `NotebookEdit` | Modifies Jupyter notebook cells. See [NotebookEdit tool](#notebookedit-tool) | Yes |
| `PowerShell` | Executes PowerShell commands natively. See [PowerShell tool](#powershell-tool) | Yes |
| `PushNotification` | Sends a desktop notification; phone push when Remote Control is connected. Not available on Amazon Bedrock, Google Vertex AI, or Microsoft Foundry | No |
| `Read` | Reads file contents with line numbers. See [Read tool](#read-tool) | No |
| `ReadMcpResourceTool` | Reads a specific MCP resource by URI | No |
| `RemoteTrigger` | Creates, updates, runs, and lists Routines on claude.ai; backs the `/schedule` command. Requires Pro/Max/Team/Enterprise on Anthropic only — not available on Bedrock, Vertex, or Foundry | No |
| `ScheduleWakeup` | Reschedules the next iteration of a self-paced `/loop`; called by Claude, not users. Not available on Bedrock, Vertex, or Foundry | No |
| `SendMessage` | Sends a message to an agent team teammate or resumes a subagent by ID. Only available when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. See [[claude-code-agent-teams]] | No |
| `ShareOnboardingGuide` | Uploads `ONBOARDING.md` and returns a share link; called from `/team-onboarding`. Requires Pro/Max/Team/Enterprise on Anthropic | Yes |
| `Skill` | Executes a skill within the main conversation. See [[claude-code-skills]] | Yes |
| `TaskCreate` | Creates a new task in the task list | No |
| `TaskGet` | Retrieves full details for a specific task | No |
| `TaskList` | Lists all tasks with their current status | No |
| `TaskOutput` | **(Deprecated)** Retrieves output from a background task — prefer `Read` on the task's output file path | No |
| `TaskStop` | Kills a running background task by ID | No |
| `TaskUpdate` | Updates task status, dependencies, or details; can delete tasks | No |
| `TeamCreate` | Creates an agent team with multiple teammates. Only available when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. See [[claude-code-agent-teams]] | No |
| `TeamDelete` | Disbands an agent team and cleans up teammate processes. Only available when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | No |
| `TodoWrite` | Manages the session task checklist. Disabled by default as of v2.1.142 in favor of `TaskCreate`/`TaskGet`/`TaskList`/`TaskUpdate`. Re-enable with `CLAUDE_CODE_ENABLE_TASKS=0` | No |
| `ToolSearch` | Searches for and loads deferred tools when MCP tool search is enabled | No |
| `WaitForMcpServers` | Waits for MCP servers still connecting in background; only appears when tool search is disabled (since `ToolSearch` handles the wait when enabled). Requires v2.1.142+ | No |
| `WebFetch` | Fetches content from a URL. See [WebFetch tool](#webfetch-tool) | Yes |
| `WebSearch` | Performs web searches. See [WebSearch tool](#websearch-tool) | Yes |
| `Workflow` | Runs a dynamic workflow script that orchestrates subagents in background. See [[claude-code-workflows]] | Yes |
| `Write` | Creates or overwrites files. See [Write tool](#write-tool) | Yes |

(source: tools-ref.md)

## Permission Rule Formats

All configuration surfaces that accept tool names use the `ToolName(specifier)` format (source: tools-ref.md):

- `permissions.allow` / `permissions.deny` in settings
- `--allowedTools` / `--disallowedTools` CLI flags
- Subagent `tools` / `disallowedTools` frontmatter
- Skill `allowed-tools` frontmatter
- Hook `if` condition fields

Several tools share a specifier format — one rule type covers a group (source: tools-ref.md):

| Rule Format | Covers | Specifier Type |
|:---|:---|:---|
| `Bash(npm run *)` | `Bash`, `Monitor` | Command pattern |
| `PowerShell(Get-ChildItem *)` | `PowerShell` | Command pattern |
| `Read(~/secrets/**)` | `Read`, `Grep`, `Glob`, `LSP` | Path pattern |
| `Edit(/src/**)` | `Edit`, `Write`, `NotebookEdit` | Path pattern |
| `Skill(deploy *)` | `Skill` | Skill name pattern |
| `Agent(Explore)` | `Agent` | Subagent type |
| `WebFetch(domain:example.com)` | `WebFetch` | Domain |
| `WebSearch` | `WebSearch` | No specifier (bare name only) |

An `Edit(...)` allow rule also grants read access to the same path, so no matching `Read(...)` rule is needed (source: tools-ref.md). Tools not listed in the table above (e.g. `ExitPlanMode`, `ShareOnboardingGuide`) accept only the bare tool name with no specifier (source: tools-ref.md).

Hook `matcher` fields use bare tool names, not the parenthesized rule format. See [[claude-code-hooks]] for matcher-pattern rules.

## Agent Tool

The `Agent` tool spawns a [[claude-code-subagents|subagent]] in a separate context window. The parent receives only the final text result — no intermediate tool calls or outputs (source: tools-ref.md). To cap turns, set `maxTurns` in the subagent definition (source: tools-ref.md).

Tool inheritance for named subagents (source: tools-ref.md):

- **Neither `tools` nor `disallowedTools` set**: inherits every tool available to the parent
- **`tools` only**: gets only the listed tools
- **`disallowedTools` only**: gets every parent tool except the listed ones
- **Both set**: `disallowedTools` takes precedence — a tool in both is removed

Launching the subagent does not itself prompt for permission. **Foreground subagents** show permission prompts as they run; **background subagents** do not — they auto-deny any call that would otherwise prompt and keep going (source: tools-ref.md). The same `Agent` tool also launches forked subagents when fork mode is enabled; see [[claude-code-subagents]] for fork behavior.

## Bash Tool

Each Bash command runs in a separate process with the following persistence rules (source: tools-ref.md):

- **Working directory**: `cd` in the main session carries over to later Bash commands as long as it stays inside the project directory or an `additionalDirectories` path. Subagent sessions never carry working directory across commands. If `cd` lands outside allowed directories, Claude Code resets to the project directory and appends `Shell cwd was reset to <dir>`. Set `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1` to disable carry-over and start every Bash command in the project directory.
- **Environment variables**: do not persist — `export` in one command is not available in the next.
- **Aliases and shell functions**: available. Claude Code sources `~/.zshrc`, `~/.bashrc`, or `~/.profile` at session start and applies the resulting aliases, functions, and shell options to every Bash command.

Two limits apply per command (source: tools-ref.md):

- **Timeout**: 2 minutes by default; Claude can request up to 10 minutes per command via the `timeout` parameter. Override with `BASH_DEFAULT_TIMEOUT_MS` and `BASH_MAX_TIMEOUT_MS`.
- **Output length**: 30,000 characters by default. When exceeded, the full output is saved to a file and Claude receives the path plus a short preview. Raise the limit with `BASH_MAX_OUTPUT_LENGTH` up to a hard ceiling of 150,000 characters.

For long-running processes, Claude can set `run_in_background: true` to start as a background task and continue working. List and stop background tasks with `/tasks` (source: tools-ref.md).

Activate virtualenv or conda environments before launching Claude Code. To persist environment variables across Bash commands, set `CLAUDE_ENV_FILE` to a shell script, or use a SessionStart hook — see [[claude-code-hooks]] (source: tools-ref.md).

## Edit Tool

`Edit` performs exact string replacement using `old_string` and `new_string`. No regex or fuzzy matching (source: tools-ref.md).

Three checks must pass in order (source: tools-ref.md):

1. **Read-before-edit**: Claude must have read the file in the current conversation, and the file must not have changed on disk since that read.
2. **Match**: `old_string` must appear in the file exactly as written — a single character of whitespace difference causes a miss.
3. **Uniqueness**: `old_string` must appear exactly once. For multiple occurrences, Claude either supplies more surrounding context to pin one occurrence, or sets `replace_all: true`.

Viewing a file with Bash also satisfies read-before-edit when the command is `cat`, `head`, `tail`, `sed -n 'X,Yp'`, `grep`, `egrep`, or `fgrep` on a single file with no pipes or redirects. Piped output and other Bash commands do not count (source: tools-ref.md).

## Glob Tool

`Glob` finds files by name pattern using standard glob syntax including `**` for recursive matching (source: tools-ref.md):

- `**/*.js` — all `.js` files at any depth
- `src/**/*.ts` — all `.ts` files under `src/`
- `*.{json,yaml}` — `.json` and `.yaml` files in the current directory

Results are sorted by modification time and capped at 100 files; Claude sees a truncation flag if the cap is hit (source: tools-ref.md).

Glob does **not** respect `.gitignore` by default — it finds gitignored files alongside tracked ones. This differs from [Grep](#grep-tool) which skips gitignored files. To make Glob respect `.gitignore`, set `CLAUDE_CODE_GLOB_NO_IGNORE=false` (source: tools-ref.md).

## Grep Tool

`Grep` searches file contents using [ripgrep](https://github.com/BurntSushi/ripgrep) regex syntax, not POSIX grep (source: tools-ref.md). Metacharacters need escaping (e.g., `interface\{\}` for Go's `interface{}`).

Three output modes (source: tools-ref.md):

- `files_with_matches`: file paths only — the default
- `content`: matching lines with file path and line number
- `count`: match count per file

Scope results with `glob` (e.g. `**/*.tsx`) or `type` (e.g. `py`, `rust`). Set `multiline: true` to match across line boundaries (source: tools-ref.md).

Grep respects `.gitignore` — gitignored files are skipped. To search a gitignored file, Claude passes its path directly (source: tools-ref.md).

## LSP Tool

`LSP` gives Claude code intelligence from a running language server. After each file edit it automatically reports type errors and warnings so Claude can fix issues without a separate build step (source: tools-ref.md). Direct navigation operations include:

- Jump to a symbol's definition
- Find all references to a symbol
- Get type information at a position
- List symbols in a file
- Search for a symbol by name across the workspace
- Find implementations of an interface
- Trace call hierarchies

The tool is inactive until a code-intelligence plugin for the language is installed via [[claude-code-plugins]] (source: tools-ref.md).

## Monitor Tool

The `Monitor` tool requires Claude Code v2.1.98 or later (source: tools-ref.md).

`Monitor` lets Claude watch something in the background and react when it changes — without pausing the conversation. Use cases include tailing a log file for errors, polling a PR or CI job for status changes, watching a directory for file changes, or tracking output from any long-running script (source: tools-ref.md).

Claude writes a small watch script, runs it in the background, and receives each output line as it arrives. Stop a monitor by asking Claude to cancel it or by ending the session (source: tools-ref.md).

Monitor uses the same permission rules as Bash — `allow`/`deny` patterns for Bash apply here too (source: tools-ref.md). It is **not** available on Amazon Bedrock, Google Vertex AI, or Microsoft Foundry, and is also unavailable when `DISABLE_TELEMETRY` or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set (source: tools-ref.md).

[[claude-code-plugins]] can declare monitors that start automatically when the plugin is active (source: tools-ref.md).

## NotebookEdit Tool

`NotebookEdit` modifies a Jupyter notebook one cell at a time, targeting cells by `cell_id`. It does not perform string replacement across the notebook the way `Edit` does on plain files (source: tools-ref.md).

Three edit modes (source: tools-ref.md):

- `replace`: overwrite the cell's source — the default
- `insert`: add a new cell after the target; with no `cell_id`, adds at the start; requires `cell_type` set to `code` or `markdown`
- `delete`: remove the target cell

Permission rules use the `Edit(...)` path format. A rule like `Edit(notebooks/**)` covers NotebookEdit calls on files in that directory (source: tools-ref.md).

## PowerShell Tool

The `PowerShell` tool lets Claude run PowerShell commands natively (source: tools-ref.md). On Windows without Git Bash, it is enabled automatically; with Git Bash installed, it is rolling out progressively. On Linux, macOS, and WSL, it is opt-in.

Enable via environment variable or settings (source: tools-ref.md):

```json
{
  "env": {
    "CLAUDE_CODE_USE_POWERSHELL_TOOL": "1"
  }
}
```

Linux/macOS/WSL require PowerShell 7+ (`pwsh`). On Windows, Claude Code auto-detects `pwsh.exe` (PS 7+) with fallback to `powershell.exe` (PS 5.1). Claude Code spawns PowerShell with `-ExecutionPolicy Bypass` at process scope only — enterprise Group Policy `MachinePolicy`/`UserPolicy` still applies. To respect the machine's effective execution policy, set `CLAUDE_CODE_POWERSHELL_RESPECT_EXECUTION_POLICY=1` (source: tools-ref.md).

The same working-directory reset behavior as the Bash tool applies, including `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` (source: tools-ref.md).

Additional shell-selection settings (source: tools-ref.md):

- `"defaultShell": "powershell"` in `settings.json`: routes interactive `!` commands through PowerShell
- `"shell": "powershell"` on individual command hooks: runs that hook in PowerShell (works regardless of `CLAUDE_CODE_USE_POWERSHELL_TOOL`)
- `shell: powershell` in skill frontmatter: runs inline `` !`command` `` blocks in PowerShell

**Known preview limitations**: PowerShell profiles are not loaded; sandboxing is not supported on Windows (source: tools-ref.md).

## Read Tool

`Read` takes an absolute file path and returns contents with line numbers (source: tools-ref.md). When a whole-file read exceeds the token limit, Read returns the first page with a `PARTIAL view` notice and guidance on how to read more with `offset` and `limit` (source: tools-ref.md).

Supported file types beyond plain text (source: tools-ref.md):

- **Images** (PNG, JPG, etc.): returned as visual content; large images are resized/recompressed to fit model image-size limits
- **PDFs**: short files read whole; files longer than 10 pages require a `pages` range parameter (e.g. `"1-5"`), up to 20 pages per call
- **Jupyter notebooks** (`.ipynb`): all cells with outputs — code, markdown, and visualizations

Read only reads files, not directories. Claude uses `ls` via Bash to list directory contents (source: tools-ref.md).

## WebFetch Tool

`WebFetch` takes a URL and an extraction prompt, fetches the page, converts HTML responses to Markdown, then runs the extraction prompt against the content using a small, fast model. Claude receives the model's answer, not the raw page (source: tools-ref.md).

This makes WebFetch **lossy by design** — the extraction prompt determines what reaches Claude. A result that says a page doesn't mention something may only mean the prompt didn't ask about it. Fetch again with a more specific prompt, or use `curl` via Bash for the unprocessed page (source: tools-ref.md).

Key behaviors (source: tools-ref.md):

- HTTP URLs are auto-upgraded to HTTPS
- Large pages are truncated to a fixed character limit before processing
- Responses are cached for 15 minutes — repeated fetches of the same URL return quickly
- Redirects to a different host: WebFetch returns a text result naming the original and redirect target instead of following; Claude then fetches the new URL with a second call

WebFetch prompts the first time it reaches a new domain (in default and `acceptEdits` modes), except for a built-in set of pre-approved documentation domains. Add `WebFetch(domain:example.com)` to `allow` to skip the prompt for a domain (source: tools-ref.md). A `WebFetch(domain:...)` rule in `deny`/`ask`/`allow` takes precedence over the pre-approved set (source: tools-ref.md).

Sends `User-Agent` beginning with `Claude-User` and an `Accept` header that prefers Markdown (source: tools-ref.md).

## WebSearch Tool

`WebSearch` runs a query against Anthropic's web search backend and returns result titles and URLs. It does not fetch the pages — Claude follows up with WebFetch to read them (source: tools-ref.md).

The tool may issue up to eight backend searches per call, refining internally before returning results. Claude can scope results with `allowed_domains` or `blocked_domains` — the two lists cannot be combined in a single call (source: tools-ref.md). The search backend is not configurable; to use a different provider, connect an MCP server that exposes a search tool (source: tools-ref.md).

WebSearch permission rules take no specifier — a bare `WebSearch` entry in `allow` or `deny` is the only form (source: tools-ref.md).

Availability: WebSearch is available on the Claude API and Microsoft Foundry. On Google Cloud Vertex AI it works with Claude 4 models. Amazon Bedrock does not expose the server-side web search tool (source: tools-ref.md).

## Write Tool

`Write` creates a new file or overwrites an existing one with the full content provided. It does not append or merge (source: tools-ref.md).

If the target path already exists, Claude must have read that file at least once in the current conversation before overwriting it — a Write to an unread existing file fails with an error. This constraint does not apply to new files. The same Bash commands that satisfy the read-before-edit requirement for `Edit` (cat, head, tail, sed, grep) also satisfy it for `Write` (source: tools-ref.md).

For partial changes to an existing file, Claude uses `Edit` instead of `Write` (source: tools-ref.md).

## Checking Available Tools

The exact tool set depends on provider, platform, and settings. To check what's loaded in a running session (source: tools-ref.md):

```text
What tools do you have access to?
```

For exact MCP tool names, run `/mcp` (source: tools-ref.md).

> **Note**: The advisor tool is a server tool that the API runs, not a tool Claude Code implements. It has no name you can reference in permission rules or hook matchers (source: tools-ref.md).

## Related pages

- [[claude-code-hooks]]
- [[claude-code-subagents]]
- [[claude-code-skills]]
- [[claude-code-plugins]]
- [[claude-code-workflows]]
- [[claude-code-worktrees]]
- [[claude-code-agent-teams]]
- [[claude-code-mcp]]
