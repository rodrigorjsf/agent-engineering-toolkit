# Claude Code Commands

**Summary**: Complete reference for slash commands available in Claude Code — built-in commands, bundled skills, bundled workflows, and MCP prompt commands — organized by workflow phase and full alphabetical listing.
**Sources**: claude-code-commands.md
**Last updated**: 2026-06-11

---

Commands control Claude Code from inside an active session. Type `/` to see every command available, or type `/` followed by letters to filter. A command is only recognized at the **start of a message**; any text that follows the command name is passed as arguments (source: claude-code-commands.md).

## Command types

The command namespace has three kinds of entries (source: claude-code-commands.md):

| Kind | Description | Example |
|------|-------------|---------|
| **Built-in** | Fixed CLI logic, behavior coded into the binary | `/clear`, `/model`, `/diff` |
| **Bundled skill** | Prompt handed to Claude — works like [[claude-code-skills]] you write yourself | `/code-review`, `/batch`, `/run` |
| **Bundled workflow** | Dynamic [[claude-code-workflows]] script that fans work out across many subagents | `/deep-research` |

MCP servers can also expose prompts as commands using the `/mcp__<server>__<prompt>` naming pattern — see [MCP prompt commands](#mcp-prompt-commands) below.

To add your own commands, author a skill in `.claude/skills/` or `~/.claude/skills/`. See [[claude-code-skills]].

> **Availability note**: Not every command appears for every user. Availability depends on your platform, plan, and environment. `/desktop` is macOS/Windows only; `/upgrade` only shows on Pro/Max plans (source: claude-code-commands.md).

## Commands across a typical workflow

### First session in a repo

- `/init` — Generate a starter `CLAUDE.md`; set `CLAUDE_CODE_NEW_INIT=1` for an interactive multi-phase flow that also sets up skills, hooks, and personal memory. See [[claude-code-memory]].
- `/memory` — Refine `CLAUDE.md` memory files and manage auto-memory. See [[claude-code-memory]].
- `/mcp` — Set up MCP server connections. See [[claude-code-mcp]].
- `/agents` — Configure [[claude-code-subagents]] the project needs.
- `/permissions` — Set tool approval rules.

### During a task

- `/plan [description]` — Enter plan mode before a large change.
- `/model [model]` — Switch the AI model; use left/right arrows to adjust effort level.
- `/effort [level|auto]` — Set effort level directly (`low`, `medium`, `high`, `xhigh`, `max`, `ultracode`).
- `/context [all]` — Visualize context usage as a colored grid; shows optimization suggestions.
- `/compact [instructions]` — Summarize the conversation to free up context.
- `/btw <question>` — Ask a quick side question without adding to the conversation history.

### Running work in parallel

- `/agents` — Manage subagent configurations. See [[claude-code-subagents]].
- `/tasks` — List background tasks running in the current session.
- `/background [prompt]` — Detach the current session to run as a background agent; alias `/bg`.
- `/batch <instruction>` — **[Skill]** Decompose a large change into 5–30 independent units, spawn one subagent per unit in an isolated [[claude-code-worktrees|git worktree]], and open PRs. Requires a git repository.
- `/fork <directive>` — Spawn a forked subagent that inherits the full conversation. See [[claude-code-subagents]].

### Before you ship

- `/diff` — Open an interactive diff viewer for uncommitted changes and per-turn diffs.
- `/code-review [level] [--fix] [--comment] [target]` — **[Skill]** Review the diff for correctness bugs and cleanups. Pass `--fix` to apply findings, `--comment` to post as GitHub PR comments, or `ultra` to run a deep cloud review. Effort levels: `low`, `medium`, `high`, `xhigh`, `max`, `ultra`.
- `/simplify [target]` — **[Skill]** (v2.1.154+) Review code for reuse/simplification/efficiency and apply fixes. Four parallel review agents. Does **not** hunt for bugs — use `/code-review` for that.
- `/review [PR]` — Review a pull request locally. For a deeper cloud-based review use `/code-review ultra`.
- `/security-review` — Analyze pending changes for security vulnerabilities (injection, auth, data exposure).

### Between sessions

- `/clear [name]` — Start a new conversation with empty context; previous conversation stays in `/resume`. Aliases: `/reset`, `/new`.
- `/resume [session]` — Resume a conversation by ID/name, or open the session picker. Background sessions appear marked with `bg`.
- `/branch [name]` — Create a branch of the current conversation to try a different direction.
- `/teleport` — Pull a Claude Code on the web session into this terminal; alias `/tp`.
- `/remote-control` — Make this session available for remote control from claude.ai; alias `/rc`.

### When something is wrong

- `/rewind` — Roll code and conversation back to a checkpoint, or summarize from a selected message. Aliases: `/checkpoint`, `/undo`.
- `/doctor` — Diagnose and verify the Claude Code installation; press `f` to fix reported issues.
- `/debug [description]` — **[Skill]** Enable debug logging mid-session and troubleshoot by reading the session debug log.
- `/feedback [report]` — Submit feedback or report a bug with session context attached. Aliases: `/bug`, `/share`.

## Full command reference

| Command | Type | Purpose |
|---------|------|---------|
| `/add-dir <path>` | Built-in | Add a working directory for file access this session. Most `.claude/` config is not discovered from the added path |
| `/advisor [model\|off]` | Built-in | Enable/disable the advisor tool (v2.1.98+). Accepts `opus`, `sonnet`, `fable`, or a full model ID |
| `/agents` | Built-in | Manage [[claude-code-subagents]] configurations |
| `/autofix-pr [prompt]` | Built-in | Spawn a cloud session to watch the current branch's PR and push fixes on CI failure or review comments. Requires `gh` CLI |
| `/background [prompt]` | Built-in | Detach session to run as a background agent. Alias: `/bg` |
| `/batch <instruction>` | **Skill** | Orchestrate large-scale parallel changes: research codebase, decompose into 5–30 units, spawn one subagent per unit in an isolated [[claude-code-worktrees\|worktree]] |
| `/branch [name]` | Built-in | Fork the conversation at this point; preserves original, switchable via `/resume` |
| `/btw <question>` | Built-in | Ask a side question without adding to conversation history |
| `/cd <path>` | Built-in | Move the session to a new working directory (v2.1.169+); prompt cache preserved, session relocated |
| `/chrome` | Built-in | Configure Claude in Chrome settings |
| `/claude-api [migrate\|managed-agents-onboard]` | **Skill** | Load Claude API reference material; `/claude-api migrate` upgrades model IDs and params; also auto-activates when code imports `anthropic` |
| `/clear [name]` | Built-in | Start new conversation; previous stays in `/resume`. Aliases: `/reset`, `/new` |
| `/code-review [level] [--fix] [--comment] [target]` | **Skill** | Review diff for bugs and cleanups. `--fix` applies findings; `--comment` posts as PR comments; `ultra` runs cloud multi-agent review (v2.1.154+: `/simplify` handles cleanup separately) |
| `/color [color\|default]` | Built-in | Set prompt bar color for the session. Colors: `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
| `/compact [instructions]` | Built-in | Summarize conversation to free context; pass focus instructions. See [[claude-code-memory]] |
| `/config` | Built-in | Open Settings: theme, model, output style, etc. Alias: `/settings` |
| `/context [all]` | Built-in | Visualize context usage as a colored grid with optimization suggestions |
| `/copy [N]` | Built-in | Copy last assistant response to clipboard; `/copy N` for the Nth-latest; shows picker for code blocks; `w` writes to file |
| `/cost` | Built-in | Alias for `/usage` |
| `/debug [description]` | **Skill** | Enable debug logging and troubleshoot by reading the session debug log |
| `/deep-research <question>` | **Workflow** | Fan out web searches, fetch and cross-check sources, synthesize a cited report |
| `/desktop` | Built-in | Continue session in the Claude Code Desktop app. macOS/Windows only. Alias: `/app` |
| `/diff` | Built-in | Interactive diff viewer for uncommitted changes and per-turn diffs |
| `/doctor` | Built-in | Diagnose Claude Code installation; press `f` to fix issues |
| `/effort [level\|auto]` | Built-in | Set effort level: `low`, `medium`, `high`, `xhigh`, `max`, `ultracode`. `ultracode` = xhigh reasoning + automatic workflow orchestration |
| `/exit` | Built-in | Exit CLI (attached background sessions detach, not stop). Alias: `/quit` |
| `/export [filename]` | Built-in | Export conversation as plain text to file or clipboard |
| `/fast [on\|off]` | Built-in | Toggle fast mode |
| `/feedback [report]` | Built-in | Submit feedback or bug report with session context. Aliases: `/bug`, `/share` |
| `/fewer-permission-prompts` | **Skill** | Scan transcripts for common read-only calls; add allowlist to `.claude/settings.json` |
| `/focus` | Built-in | Toggle focus view (last prompt + one-line tool summary + final response). Fullscreen only |
| `/fork <directive>` | Built-in | Spawn a forked subagent inheriting the full conversation (v2.1.161+); result returns to your conversation |
| `/goal [condition\|clear]` | Built-in | Set a session goal: Claude keeps working across turns until the condition is met. Uses a prompt-based Stop hook internally. See [[claude-code-hooks]] |
| `/heapdump` | Built-in | Write a JavaScript heap snapshot to `~/Desktop` for diagnosing high memory usage |
| `/help` | Built-in | Show help and available commands |
| `/hooks` | Built-in | View [[claude-code-hooks]] configurations for tool events |
| `/ide` | Built-in | Manage IDE integrations and show status |
| `/init` | Built-in | Initialize project with a `CLAUDE.md`. `CLAUDE_CODE_NEW_INIT=1` enables interactive flow with skills, hooks, and personal memory setup |
| `/insights` | Built-in | Generate a report analyzing Claude Code sessions: project areas, interaction patterns, friction points |
| `/install-github-app` | Built-in | Set up the Claude GitHub Actions app for a repository |
| `/install-slack-app` | Built-in | Install the Claude Slack app via browser OAuth |
| `/keybindings` | Built-in | Open keyboard shortcuts file |
| `/login` | Built-in | Sign in to Anthropic account |
| `/logout` | Built-in | Sign out from Anthropic account |
| `/loop [interval] [prompt]` | **Skill** | Run a prompt repeatedly while session stays open; omit interval for self-paced; omit prompt to run autonomous maintenance |
| `/mcp [reconnect <server>\|enable\|disable [...]]` | Built-in | Manage MCP server connections and OAuth. No argument opens interactive list. See [[claude-code-mcp]] |
| `/memory` | Built-in | Edit `CLAUDE.md` memory files, enable/disable auto-memory, view auto-memory entries. See [[claude-code-memory]] |
| `/mobile` | Built-in | Show QR code for the Claude mobile app. Aliases: `/ios`, `/android` |
| `/model [model]` | Built-in | Switch AI model and save as default. No argument opens picker; `s` on a row for session-only switch |
| `/permissions` | Built-in | Manage allow/ask/deny rules for tool permissions. Alias: `/allowed-tools` |
| `/plan [description]` | Built-in | Enter plan mode; pass description to start immediately |
| `/plugin [subcommand]` | Built-in | Manage [[claude-code-plugins]]. Subcommands: `list`, `install`, `enable`, `disable` |
| `/powerup` | Built-in | Discover Claude Code features through quick interactive lessons |
| `/privacy-settings` | Built-in | View and update privacy settings. Pro/Max subscribers only |
| `/radio` | Built-in | Open Claude FM lo-fi radio in browser |
| `/recap` | Built-in | Generate a one-line summary of the current session on demand |
| `/release-notes` | Built-in | View changelog in an interactive version picker |
| `/reload-plugins [--force]` | Built-in | Reload all active [[claude-code-plugins]] without restarting. `--force` bypasses prompt cache warning |
| `/reload-skills` | Built-in | Re-scan [[claude-code-skills]] directories so skills added or changed on disk become available (v2.1.152+) |
| `/remote-control` | Built-in | Make session available for remote control from claude.ai. Alias: `/rc` |
| `/remote-env` | Built-in | Choose the default environment for cloud agents |
| `/rename [name]` | Built-in | Rename the current session; auto-generates from conversation history if no name given |
| `/resume [session]` | Built-in | Resume a conversation by ID/name or open session picker. Background sessions marked `bg` (v2.1.144+). Alias: `/continue` |
| `/review [PR]` | Built-in | Review a pull request locally. For cloud multi-agent review use `/code-review ultra` |
| `/rewind` | Built-in | Rewind conversation and/or code to a previous point. Aliases: `/checkpoint`, `/undo` |
| `/run` | **Skill** | Launch and drive your project's app to see a change working in the running app (v2.1.145+) |
| `/run-skill-generator` | **Skill** | Write a per-project skill recording how to build and launch the app, so `/run` and `/verify` stop re-discovering it (v2.1.145+) |
| `/sandbox` | Built-in | Toggle sandbox mode. Supported platforms only |
| `/schedule [description]` | Built-in | Create/update/list/run routines on Anthropic-managed cloud infrastructure. Alias: `/routines` |
| `/scroll-speed` | Built-in | Adjust mouse wheel scroll speed interactively. Fullscreen rendering only |
| `/security-review` | Built-in | Analyze pending changes for security vulnerabilities |
| `/setup-bedrock` | Built-in | Configure Amazon Bedrock authentication, region, and model pins. Visible only when `CLAUDE_CODE_USE_BEDROCK=1` is set |
| `/setup-vertex` | Built-in | Configure Google Vertex AI authentication, project, region, and model pins. Visible only when `CLAUDE_CODE_USE_VERTEX=1` is set |
| `/simplify [target]` | **Skill** | Review changed code for cleanup opportunities and apply fixes (v2.1.154+). Four parallel review agents cover reuse, simplification, efficiency, and abstraction level. Does not hunt for correctness bugs |
| `/skills` | Built-in | List available [[claude-code-skills]]; press `t` to sort by token count; `Space` to hide a skill; `Enter` to save |
| `/stats` | Built-in | Alias for `/usage`. Opens on the Stats tab |
| `/status` | Built-in | Open Settings (Status tab) with version, model, account, connectivity info. Works while Claude is responding |
| `/statusline` | Built-in | Configure Claude Code's status line; describe what you want or run without arguments to auto-configure |
| `/stickers` | Built-in | Order Claude Code stickers |
| `/stop` | Built-in | Stop the current background session. Only available while attached to a background session |
| `/tasks` | Built-in | View and manage everything running in the background. Alias: `/bashes` |
| `/team-onboarding` | Built-in | Generate a team onboarding guide from the last 30 days of usage history. Returns a share link for Pro/Max/Team/Enterprise |
| `/teleport` | Built-in | Pull a Claude Code on the web session into this terminal. Alias: `/tp`. Requires claude.ai subscription |
| `/terminal-setup` | Built-in | Configure terminal keybindings for Shift+Enter and other shortcuts. Only visible in terminals that need it (VS Code, Cursor, Devin Desktop, Alacritty, Zed) |
| `/theme` | Built-in | Change color theme; includes auto, light/dark, colorblind-accessible, ANSI, and custom themes from `~/.claude/themes/` |
| `/tui [default\|fullscreen]` | Built-in | Set and relaunch into the terminal UI renderer with conversation intact |
| `/ultraplan <prompt>` | Built-in | Draft a plan, review in browser, then execute remotely or send back to terminal |
| `/ultrareview [PR]` | Built-in | Alias for `/code-review ultra`. Deep multi-agent cloud review. 3 free runs on Pro/Max, then usage credits required |
| `/upgrade` | Built-in | Open the upgrade page to switch plan tier |
| `/usage` | Built-in | Show session cost, plan usage limits, and activity stats. On paid plans: breakdown by skill, subagent, plugin, MCP server. Aliases: `/cost`, `/stats` |
| `/usage-credits` | Built-in | Configure usage credits to keep working when hitting a limit |
| `/verify` | **Skill** | Confirm a code change does what it should by building and running the app and observing the result (v2.1.145+) |
| `/voice [hold\|tap\|off]` | Built-in | Toggle voice dictation or enable in a specific mode. Requires claude.ai account |
| `/web-setup` | Built-in | Connect GitHub account to Claude Code on the web using local `gh` CLI credentials |
| `/workflows` | Built-in | Open the workflow progress view to watch, pause, resume, or save running/completed [[claude-code-workflows]] |

## MCP prompt commands

MCP servers can expose prompts that appear as commands in the `/` menu. These are dynamically discovered from connected servers and use the format:

```
/mcp__<server>__<prompt>
```

For example, a connected `memory` MCP server might expose `/mcp__memory__store`. See the `/mcp` command to manage server connections (source: claude-code-commands.md).

## Removed commands

| Command | Removed | Migration |
|---------|---------|-----------|
| `/pr-comments [PR]` | v2.1.91 | Ask Claude directly to view pull request comments |
| `/vim` | v2.1.92 | Use `/config` → Editor mode to toggle Vim/Normal editing |

## Bundled skills quick reference

Bundled skills listed separately from the full table for easy scanning (source: claude-code-commands.md):

| Skill command | Purpose |
|--------------|---------|
| `/batch` | Parallel large-scale codebase changes in isolated worktrees |
| `/claude-api` | Claude API reference loader + migration helper |
| `/code-review` | Diff review for correctness bugs; `--fix`, `--comment`, `ultra` variants |
| `/debug` | Debug logging + log analysis |
| `/fewer-permission-prompts` | Auto-populate allowlist from transcript analysis |
| `/loop` | Repeated prompt execution or autonomous maintenance |
| `/run` | Launch app and observe change in the running process |
| `/run-skill-generator` | Record per-project launch recipe for `/run`/`/verify` |
| `/simplify` | Cleanup-only review (no bug-hunting); applies fixes |
| `/verify` | Build + run + observe to confirm a change works |

## Related pages

- [[claude-code-skills]]
- [[claude-code-workflows]]
- [[claude-code-subagents]]
- [[claude-code-hooks]]
- [[claude-code-memory]]
- [[claude-code-plugins]]
- [[claude-code-worktrees]]
- [[claude-code-mcp]]
- [[agent-workflows]]
