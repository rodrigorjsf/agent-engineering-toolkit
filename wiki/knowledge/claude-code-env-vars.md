# Claude Code Environment Variables

**Summary**: Complete reference for the environment variables that control Claude Code behavior — authentication, model selection, provider routing, feature toggles, timeouts, and observability — with precedence rules and settings-file scoping.
**Sources**: env-var-ref.md
**Last updated**: 2026-06-11

---

## Setting Variables

Variables can be set per-invocation in the shell, or durably in a `settings.json` file under the `env` key so they apply every time `claude` runs regardless of how it was launched (source: env-var-ref.md).

```json
{
  "env": {
    "API_TIMEOUT_MS": "1200000",
    "BASH_DEFAULT_TIMEOUT_MS": "300000"
  }
}
```

The settings file you choose controls scope:

| File | Applies to |
|---|---|
| `~/.claude/settings.json` | You, in every project |
| `.claude/settings.json` | Everyone in the project (commit this) |
| `.claude/settings.local.json` | You, in this project only (gitignore it) |
| Managed settings | Everyone in the organization |

## Precedence

When both an environment variable and a settings field control the same behavior, the environment variable takes precedence. For example:

- `ANTHROPIC_MODEL` overrides the `model` setting
- `CLAUDE_CODE_AUTO_CONNECT_IDE` overrides `autoConnectIde`
- `CLAUDE_CODE_EFFORT_LEVEL` overrides `/effort` and `effortLevel`
- `--model` and `/model` override `ANTHROPIC_MODEL`

Claude Code reads environment variables at startup; changes take effect on the next `claude` launch (source: env-var-ref.md).

---

## Variable Reference

Variables are grouped by functional category. A full alphabetical table is in the source document (source: env-var-ref.md).

### Authentication

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | API key sent as `X-Api-Key`. Overrides subscription in interactive mode (prompts once); always used in `-p` mode |
| `ANTHROPIC_AUTH_TOKEN` | Custom `Authorization` header value (prefixed with `Bearer `) |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth access token for Claude.ai auth; alternative to `/login` for SDK/automated environments |
| `CLAUDE_CODE_OAUTH_REFRESH_TOKEN` | OAuth refresh token; `claude auth login` exchanges it directly without a browser. Requires `CLAUDE_CODE_OAUTH_SCOPES` |
| `CLAUDE_CODE_OAUTH_SCOPES` | Space-separated OAuth scopes the refresh token was issued with |
| `ANTHROPIC_WORKSPACE_ID` | Workspace ID for workload identity federation when a federation rule spans multiple workspaces |

### Provider Routing

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_USE_BEDROCK` | Route to Amazon Bedrock |
| `CLAUDE_CODE_USE_VERTEX` | Route to Google Vertex AI |
| `CLAUDE_CODE_USE_FOUNDRY` | Route to Microsoft Foundry |
| `CLAUDE_CODE_USE_MANTLE` | Use the Bedrock Mantle endpoint |
| `CLAUDE_CODE_USE_ANTHROPIC_AWS` | Use Claude Platform on AWS |
| `ANTHROPIC_BASE_URL` | Override API endpoint (proxy or gateway). Non-first-party host disables MCP tool search unless `ENABLE_TOOL_SEARCH=true` |
| `ANTHROPIC_BEDROCK_BASE_URL` | Override Bedrock endpoint URL |
| `ANTHROPIC_VERTEX_BASE_URL` | Override Vertex AI endpoint URL |
| `ANTHROPIC_FOUNDRY_BASE_URL` | Full base URL for Foundry resource |
| `ANTHROPIC_FOUNDRY_RESOURCE` | Foundry resource name; required when `ANTHROPIC_FOUNDRY_BASE_URL` is not set |
| `ANTHROPIC_VERTEX_PROJECT_ID` | GCP project ID for Vertex AI; overridden by `GCLOUD_PROJECT` or `GOOGLE_CLOUD_PROJECT` |
| `ANTHROPIC_AWS_BASE_URL` | Override Claude Platform on AWS endpoint |
| `ANTHROPIC_AWS_WORKSPACE_ID` | Required for Claude Platform on AWS; sent as `anthropic-workspace-id` header |
| `AWS_BEARER_TOKEN_BEDROCK` | Bedrock API key for authentication |
| `ANTHROPIC_BEDROCK_SERVICE_TIER` | Bedrock service tier: `default`, `flex`, or `priority` |
| `HTTP_PROXY` / `HTTPS_PROXY` | HTTP/HTTPS proxy server for network connections |
| `NO_PROXY` | Domains/IPs bypassing proxy |

Skip auth with: `CLAUDE_CODE_SKIP_BEDROCK_AUTH`, `CLAUDE_CODE_SKIP_VERTEX_AUTH`, `CLAUDE_CODE_SKIP_FOUNDRY_AUTH`, `CLAUDE_CODE_SKIP_MANTLE_AUTH`, `CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH` — for LLM gateways that sign requests themselves.

### Model Configuration

| Variable | Purpose |
|---|---|
| `ANTHROPIC_MODEL` | Model to use. Overridden by `--model` and `/model` |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Model for [[claude-code-subagents]]; see model-config docs |
| `CLAUDE_CODE_EFFORT_LEVEL` | Effort level: `low`, `medium`, `high`, `xhigh`, `max`, or `auto`. Takes precedence over `/effort` and `effortLevel` setting |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` / `ANTHROPIC_DEFAULT_HAIKU_MODEL` / `ANTHROPIC_DEFAULT_OPUS_MODEL` / `ANTHROPIC_DEFAULT_FABLE_MODEL` | Pin default model IDs per tier |
| `ANTHROPIC_CUSTOM_MODEL_OPTION` | Model ID added as a custom entry in the `/model` picker |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_NAME` | Display name for the custom model entry (defaults to model ID) |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION` | Display description for the custom model entry |
| `ANTHROPIC_SMALL_FAST_MODEL` | [DEPRECATED] Background Haiku-class model name |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | Override AWS region for the Haiku-class model on Bedrock |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` | Set to `1` to disable adaptive reasoning on Opus 4.6 / Sonnet 4.6; fall back to fixed `MAX_THINKING_TOKENS` budget |
| `CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP` | Prevent automatic remapping of Opus 4.0/4.1 to current Opus on Anthropic API |
| `MAX_THINKING_TOKENS` | Override extended thinking token budget; `0` disables thinking on Anthropic API (except Fable 5) |
| `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` | Set `1` to send effort parameter with every request, even for unrecognized model IDs (e.g. gateway aliases) |
| `CLAUDE_CODE_DISABLE_1M_CONTEXT` | Disable 1M context window variants in the model picker |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Maximum output tokens per request |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | Override assumed context window size; only takes effect when `DISABLE_COMPACT` is also set |
| `FALLBACK_FOR_ALL_PRIMARY_MODELS` | Make all models stop retrying on repeated overload when no fallback is configured |

`VERTEX_REGION_CLAUDE_*` variables override Vertex AI region per model (e.g. `VERTEX_REGION_CLAUDE_4_6_SONNET`). See source for the full list (source: env-var-ref.md).

### Timeouts and Retries

| Variable | Default | Purpose |
|---|---|---|
| `API_TIMEOUT_MS` | 600000 (10 min) | Timeout for API requests in ms; max 2147483647 |
| `API_FORCE_IDLE_TIMEOUT` | — | Override 5-minute idle timeout on streaming; `0` = disable, `1` = keep |
| `BASH_DEFAULT_TIMEOUT_MS` | 120000 (2 min) | Default timeout for long-running Bash commands |
| `BASH_MAX_TIMEOUT_MS` | 600000 (10 min) | Maximum timeout the model can set for Bash commands |
| `CLAUDE_CODE_MAX_RETRIES` | 10 | Number of retries for failed API requests |
| `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` | 600000 (10 min) | Stall timeout for background subagents; timer resets on each streaming event |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS` | — | Timeout before the streaming idle watchdog closes a stalled connection; minimum 5 min when set explicitly |
| `CLAUDE_ENABLE_STREAM_WATCHDOG` | — | Force-enable (`1`) or disable (`0`) the event-level streaming watchdog |
| `CLAUDE_ENABLE_BYTE_WATCHDOG` | — | Force-enable (`1`) or disable (`0`) the byte-level streaming watchdog |
| `CLAUDE_ENABLE_BYTE_WATCHDOG_BEDROCK` | off | Enable byte-level watchdog on Bedrock `vnd.amazon.eventstream` responses |

### Output Limits

| Variable | Purpose |
|---|---|
| `BASH_MAX_OUTPUT_LENGTH` | Max characters in Bash output before saving to file and sending path |
| `TASK_MAX_OUTPUT_LENGTH` | Max characters in subagent output before truncation (default 32000, max 160000) |
| `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` | Override token limit for file reads |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Max output tokens per request |
| `MAX_MCP_OUTPUT_TOKENS` | Max tokens in MCP tool responses (default 25000; warning above 10000) |
| `MAX_STRUCTURED_OUTPUT_RETRIES` | Retries when model response fails `--json-schema` validation in `-p` mode (default 5) |

### Feature Toggles — Disable

Variables beginning with `CLAUDE_CODE_DISABLE_` turn off specific capabilities. Common ones:

| Variable | Disables |
|---|---|
| `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` | Skills and workflows shipped with Claude Code |
| `CLAUDE_CODE_DISABLE_WORKFLOWS` | [[claude-code-workflows]] dynamic workflows |
| `CLAUDE_CODE_DISABLE_AGENT_VIEW` | Background agents and agent view; equivalent to `disableAgentView` setting |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | Background task functionality including `run_in_background` parameter |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Auto memory (set to `0` to force-enable even in `--bare` mode) |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | Loading any CLAUDE.md files |
| `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` | Built-in git commit/PR instructions from system prompt |
| `CLAUDE_CODE_DISABLE_ATTACHMENTS` | `@`-syntax file attachments (sent as plain text instead) |
| `CLAUDE_CODE_DISABLE_FAST_MODE` | Fast mode |
| `CLAUDE_CODE_DISABLE_THINKING` | Omits `thinking` parameter from requests (compatibility for proxies that reject it) |
| `CLAUDE_CODE_DISABLE_ADVISOR_TOOL` | Advisor tool; `/advisor` command and `advisorModel` become unavailable (v2.1.98+) |
| `CLAUDE_CODE_DISABLE_CRON` | Scheduled tasks; the `/loop` skill becomes unavailable |
| `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING` | File checkpointing; `/rewind` cannot restore code changes |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | "How is Claude doing?" session quality surveys |
| `CLAUDE_CODE_DISABLE_MOUSE` | Mouse tracking in fullscreen rendering |
| `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` | Fullscreen rendering (falls back to classic main-screen renderer) |
| `CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL` | Virtual scrolling in fullscreen rendering |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` | Automatic terminal title updates |
| `CLAUDE_CODE_DISABLE_POLICY_SKILLS` | Loading skills from system-wide managed skills directory |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` | Strips `anthropic-beta` headers and beta tool-schema fields |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Equivalent to setting `DISABLE_AUTOUPDATER`, `DISABLE_FEEDBACK_COMMAND`, `DISABLE_ERROR_REPORTING`, and `DISABLE_TELEMETRY` |
| `DISABLE_TELEMETRY` / `DO_NOT_TRACK` | Telemetry opt-out |
| `DISABLE_AUTOUPDATER` | Background updates (manual `claude update` still works) |
| `DISABLE_UPDATES` | All updates including manual `claude update` |
| `DISABLE_COMPACT` | All compaction (auto and `/compact`) |
| `DISABLE_AUTO_COMPACT` | Auto-compaction only; manual `/compact` still available |
| `DISABLE_PROMPT_CACHING` | Prompt caching for all models |

### Context and Compaction

| Variable | Purpose |
|---|---|
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Percentage (1–100) of context capacity at which auto-compaction triggers (default ~95%) |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | Context capacity in tokens used for compaction calculations; decouples compaction threshold from status line `used_percentage` |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | Override assumed context window size (requires `DISABLE_COMPACT` to take effect) |

### Subagents and Parallelism

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Max parallel read-only tools and subagents (default 10) |
| `CLAUDE_CODE_MAX_TURNS` | Cap agentic turns; overridden by `--max-turns` when both are set |
| `TASK_MAX_OUTPUT_LENGTH` | Max characters in subagent output before truncation |
| `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` | Stall timeout for background subagents |
| `CLAUDE_CODE_FORK_SUBAGENT` | Set `1` to make forked subagents the model's default; `0` to disable |
| `CLAUDE_AUTO_BACKGROUND_TASKS` | Set `1` to force-enable automatic backgrounding of long-running tasks |
| `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS` | Set `1` to disable built-in subagent types (Explore, Plan) in `-p` mode |
| `CLAUDE_AGENT_SDK_MCP_NO_PREFIX` | Set `1` to skip `mcp__<server>__` prefix on SDK-created MCP server tool names |
| `CLAUDE_CODE_EXIT_AFTER_STOP_DELAY` | Time in ms to wait after query loop becomes idle before auto-exiting (SDK/automated use) |

### Hooks and Shell Integration

These variables are set automatically in hook subprocesses or configure hook behavior. See [[claude-code-hooks]] for full hook documentation.

| Variable | Set By | Purpose |
|---|---|---|
| `CLAUDECODE` | Claude Code | Set to `1` in all subprocesses spawned by Claude Code (Bash, hooks, MCP stdio servers, tmux); use to detect subprocess context |
| `CLAUDE_CODE_SESSION_ID` | Claude Code | Current session ID in Bash, hook, and MCP subprocesses; updated on `/clear` |
| `CLAUDE_ENV_FILE` | Claude Code / hooks | Path to a shell script run before each Bash command; used by `SessionStart`, `Setup`, `CwdChanged`, and `FileChanged` hooks to persist env vars |
| `CLAUDE_EFFORT` | Claude Code | Active effort level for the turn: `low`, `medium`, `high`, `xhigh`, `max`; only set when model supports effort parameter |
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | User | Override time budget for `SessionEnd` hooks (default 1.5s, auto-raised to highest per-hook `timeout` up to 60s) |
| `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` | User | Max consecutive `Stop`/`SubagentStop` blocks before override (default 8; `0` = no cap) |
| `CLAUDE_CODE_SHELL` | User | Override automatic shell detection |
| `CLAUDE_CODE_SHELL_PREFIX` | User | Command prefix that wraps all shell commands Claude spawns (Bash, hooks, status line, MCP stdio) |
| `CLAUDE_CODE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | User | Return to original working directory after each Bash/PowerShell command in main session |

### Plugin Management

See [[claude-code-plugins]] for plugin structure and distribution documentation.

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_PLUGIN_CACHE_DIR` | Override plugins root directory (defaults to `~/.claude/plugins`) |
| `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` | Timeout for git operations during plugin install/update (default 120000) |
| `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` | Set `1` to clone GitHub shorthand sources over HTTPS instead of SSH |
| `CLAUDE_CODE_PLUGIN_SEED_DIR` | Read-only plugin seed directories (`:` or `;` separated) for container images |
| `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` | Set `1` to keep existing cache when `git pull` fails (offline/airgapped) |
| `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL` | Skip automatic addition of official plugin marketplace on first run |
| `CLAUDE_CODE_SYNC_PLUGIN_INSTALL` | Set `1` in `-p` mode to wait for plugin install before first query |
| `CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS` | Timeout for synchronous plugin installation |
| `FORCE_AUTOUPDATE_PLUGINS` | Force plugin updates even when `DISABLE_AUTOUPDATER` is set |
| `CLAUDE_CODE_ENABLE_BACKGROUND_PLUGIN_REFRESH` | Set `1` to refresh plugin state at turn boundaries in non-interactive mode after background install |

### Skills Sync

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_SYNC_SKILLS` | Set `1` to download claude.ai skills before first query and resync every 10 min (non-interactive `-p` mode only) |
| `CLAUDE_CODE_SYNC_SKILLS_INSTALL_TIMEOUT_MS` | Timeout for mid-session skills resync (default 30000) |
| `CLAUDE_CODE_SYNC_SKILLS_WAIT_TIMEOUT_MS` | Timeout for first query to wait on initial skills sync (default 5000) |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET` | Override character budget for skill metadata shown to the Skill tool |

### MCP Configuration

See [[claude-code-mcp]] for full MCP integration documentation.

| Variable | Purpose |
|---|---|
| `MCP_TIMEOUT` | MCP server startup timeout (default 30000 ms) |
| `MCP_TOOL_TIMEOUT` | MCP tool execution timeout (default ~28 hours; per-server `timeout` in `.mcp.json` overrides) |
| `MCP_CONNECT_TIMEOUT_MS` | How long blocking MCP startup waits before snapshotting the tool list (default 5000) |
| `MCP_CONNECTION_NONBLOCKING` | Controls whether startup waits for MCP servers; default non-blocking since v2.1.142 |
| `MCP_SERVER_CONNECTION_BATCH_SIZE` | Max local (stdio) MCP servers to connect in parallel at startup (default 3) |
| `MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE` | Max remote (HTTP/SSE) MCP servers to connect in parallel (default 20) |
| `ENABLE_TOOL_SEARCH` | Controls MCP tool search / deferred tool loading (`true`, `auto`, `auto:N`, `false`) |
| `MAX_MCP_OUTPUT_TOKENS` | Max tokens in MCP tool responses (default 25000) |
| `CLAUDE_CODE_MCP_ALLOWLIST_ENV` | Set `1` to spawn stdio MCP servers with only a safe baseline env plus the server's configured `env` |
| `MCP_CLIENT_SECRET` | OAuth client secret for MCP servers requiring pre-configured credentials |
| `MCP_OAUTH_CALLBACK_PORT` | Fixed port for OAuth redirect callback when adding an MCP server |
| `ENABLE_CLAUDEAI_MCP_SERVERS` | Set `false` to disable claude.ai MCP servers in Claude Code (enabled by default for logged-in users) |

### Prompt Caching

| Variable | Purpose |
|---|---|
| `DISABLE_PROMPT_CACHING` | Disable caching for all models |
| `DISABLE_PROMPT_CACHING_SONNET` / `_HAIKU` / `_OPUS` / `_FABLE` | Disable caching per model tier |
| `ENABLE_PROMPT_CACHING_1H` | Request 1-hour cache TTL instead of default 5 min (API key / Bedrock / Vertex / Foundry) |
| `FORCE_PROMPT_CACHING_5M` | Force 5-min TTL even when 1-hour would otherwise apply |
| `CLAUDE_CODE_ATTRIBUTION_HEADER` | Set `0` to omit attribution block from system prompt (improves prompt-cache hit rates for LLM gateways) |

### Security and Sandboxing

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | Set `1` to strip credentials from subprocess environments (Bash, hooks, MCP stdio); on Linux also runs Bash in isolated PID namespace |
| `CLAUDE_CODE_SCRIPT_CAPS` | JSON object limiting how many times specific scripts may be invoked per session (requires `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`) |
| `CLAUDE_CODE_SAFE_MODE` | Set `1` to start in safe mode: no CLAUDE.md, skills, plugins, hooks, MCP servers, auto memory; equivalent to `--safe-mode` |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` | Disable non-streaming fallback when streaming fails mid-stream (prevents duplicate tool execution via proxy) |
| `CLAUDE_CODE_PERFORCE_MODE` | Set `1` for Perforce-aware write protection (blocks write if target lacks owner-write bit) |
| `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` | Set by host platforms to prevent user settings from overriding provider routing |
| `CLAUDE_CODE_POWERSHELL_RESPECT_EXECUTION_POLICY` | Set `1` to stop bypassing PowerShell execution policy when spawning hooks and tools |

### Observability (OpenTelemetry)

Requires `CLAUDE_CODE_ENABLE_TELEMETRY=1` to activate. Standard OTLP exporter variables (`OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_METRIC_EXPORT_INTERVAL`, `OTEL_RESOURCE_ATTRIBUTES`) are also supported (source: env-var-ref.md).

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Set `1` to enable OpenTelemetry data collection |
| `CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS` | Timeout for flushing pending OTel spans on shutdown (default 5000) |
| `CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS` | Timeout for OTel exporter to finish on shutdown (default 2000) |
| `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` | Interval for refreshing dynamic OTel headers (default 1740000 / 29 min) |
| `CLAUDE_CODE_PROPAGATE_TRACEPARENT` | Set `1` to propagate W3C trace context to proxy, Bash, and hooks (v2.1.152+) |
| `OTEL_LOG_RAW_API_BODIES` | Emit API request/response JSON as log events; `1` = inline (truncated at 60 KB), `file:<dir>` = to disk |
| `OTEL_LOG_TOOL_CONTENT` | Set `1` to include tool input/output content in OTel spans |
| `OTEL_LOG_TOOL_DETAILS` | Set `1` to include tool arguments and MCP server names in traces |
| `OTEL_LOG_USER_PROMPTS` | Set `1` to include user prompt text in traces (redacted by default) |
| `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` | Set `false` to exclude account UUID from metrics (default: included) |
| `OTEL_METRICS_INCLUDE_SESSION_ID` | Set `false` to exclude session ID from metrics (default: included) |
| `OTEL_METRICS_INCLUDE_VERSION` | Set `true` to include Claude Code version in metrics (default: excluded) |
| `OTEL_METRICS_INCLUDE_ENTRYPOINT` | Set `true` to include session entrypoint in metrics (default: excluded; v2.1.152+) |
| `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES` | Set `false` to exclude `OTEL_RESOURCE_ATTRIBUTES` keys from metric datapoint labels (default: included; v2.1.161+) |
| `CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL` | Set `1` to route survey ratings to OTel instead of Anthropic when nonessential traffic is blocked |

### Agent Teams

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Set `1` to enable experimental agent teams |
| `CLAUDE_CODE_TEAM_NAME` | Name of the agent team this teammate belongs to; set automatically on team members |

See [[claude-code-agent-teams]] for full documentation.

### Cloud Sessions

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_REMOTE` | Set automatically to `true` when running as a cloud session |
| `CLAUDE_CODE_REMOTE_SESSION_ID` | Set automatically in cloud sessions; use to link artifacts back to the session transcript |
| `CCR_FORCE_BUNDLE` | Set `1` to force `claude --remote` to bundle and upload the local repo even when GitHub access is available |

### Configuration and Paths

| Variable | Purpose |
|---|---|
| `CLAUDE_CONFIG_DIR` | Override configuration directory (default `~/.claude`); all settings, credentials, history, and plugins stored here |
| `CLAUDE_CODE_TMPDIR` | Override temp directory for internal temp files |
| `CLAUDE_CODE_DEBUG_LOGS_DIR` | Override debug log file path (note: a file path, not a directory) |
| `CLAUDE_CODE_DEBUG_LOG_LEVEL` | Minimum log level written to debug log: `verbose`, `debug` (default), `info`, `warn`, `error` |
| `DEBUG` | Set `1` to enable debug mode (equivalent to `--debug`); truthy: `1`, `true`, `yes`, `on` only |
| `CLAUDE_CODE_GLOB_HIDDEN` | Set `false` to exclude dotfiles from Glob tool results |
| `CLAUDE_CODE_GLOB_NO_IGNORE` | Set `false` to make Glob respect `.gitignore` patterns |
| `CLAUDE_CODE_GLOB_TIMEOUT_SECONDS` | Glob tool file discovery timeout (default 20s; 60s on WSL) |

### Developer Experience

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_NEW_INIT` | Set `1` to run `/init` as an interactive multi-phase setup flow |
| `CLAUDE_CODE_NO_FLICKER` | Set `1` to enable fullscreen rendering (reduces flicker, flat memory in long sessions) |
| `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` | Set `1` to disable fullscreen rendering and use classic main-screen renderer |
| `CLAUDE_CODE_ACCESSIBILITY` | Set `1` to keep native terminal cursor visible (for screen magnifiers like macOS Zoom) |
| `CLAUDE_CODE_HIDE_CWD` | Set `1` to hide working directory in startup logo (useful for screenshares) |
| `IS_DEMO` | Set `1` for demo mode: hides email/org from header, skips onboarding |
| `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION` | Set `false` to disable grayed-out prompt suggestions |
| `CLAUDE_CODE_SYNTAX_HIGHLIGHT` | Set `false` to disable syntax highlighting in diff output |
| `CLAUDE_CODE_SCROLL_SPEED` | Mouse wheel scroll multiplier in fullscreen rendering (1–20) |
| `CLAUDE_CODE_NATIVE_CURSOR` | Set `1` to show terminal's own cursor at the input caret |
| `CLAUDE_CODE_TMUX_TRUECOLOR` | Set `1` to allow 24-bit truecolor inside tmux |
| `CLAUDE_CODE_SIMPLE` | Set `1` to run with minimal system prompt and only Bash/file tools; equivalent to `--bare` |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` | Set `1` for shorter system prompt; `0`/`false`/`no`/`off` to opt out |
| `CLAUDE_CODE_GIT_BASH_PATH` | Windows only: path to Git Bash `bash.exe` |
| `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` | Set `1` to load memory files from `--add-dir` directories |

### Task List

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_ENABLE_TASKS` | Controls Task tools vs legacy `TodoWrite` tool; set `0` to revert to `TodoWrite` (Task tools default since v2.1.142) |
| `CLAUDE_CODE_TASK_LIST_ID` | Share a task list across sessions; set the same ID in multiple instances |

### SDK / Non-Interactive Mode

| Variable | Purpose |
|---|---|
| `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` | Set `1` to automatically resume if the previous session ended mid-turn |
| `CLAUDE_CODE_RESUME_PROMPT` | Override the continuation message injected on resume (default: `Continue from where you left off.`) |
| `CLAUDE_CODE_SKIP_PROMPT_HISTORY` | Set `1` to skip writing prompt history and transcripts; sessions do not appear in `--resume` |
| `CLAUDE_CODE_ENABLE_AUTO_MODE` | Set `1` to enable auto mode on Bedrock, Vertex AI, and Foundry (v2.1.158+) |
| `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY` | Set `1` to populate `/model` picker from gateway's `/v1/models` endpoint |

### Deprecations and Removed Variables

| Variable | Status |
|---|---|
| `ANTHROPIC_SMALL_FAST_MODEL` | Deprecated; use `ANTHROPIC_DEFAULT_HAIKU_MODEL` |
| `ENABLE_PROMPT_CACHING_1H_BEDROCK` | Deprecated; use `ENABLE_PROMPT_CACHING_1H` |
| `CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE` | Removed in v2.1.160 (no-op) |
| `CLAUDE_CODE_ENABLE_OPUS_4_7_FAST_MODE` | Removed in v2.1.142 |
| `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE` | Removed in v2.1.170 |

---

## Key Interaction Patterns

### Combining auth and provider flags

`CLAUDE_CODE_USE_BEDROCK=1` enables the Bedrock provider; add `CLAUDE_CODE_SKIP_BEDROCK_AUTH=1` for gateway deployments that sign requests for you. The same pattern applies to Vertex, Foundry, and Mantle (source: env-var-ref.md).

### LLM gateway setup

Point `ANTHROPIC_BASE_URL` at your proxy, then tune:
- `CLAUDE_CODE_ATTRIBUTION_HEADER=0` — improves prompt-cache hit rates
- `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING=1` — enable streaming if proxy supports it
- `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` — suppress headers that certain proxies reject
- `ENABLE_TOOL_SEARCH=false` — load all tools upfront if proxy does not support `tool_reference`

### Safe mode for configuration debugging

`CLAUDE_CODE_SAFE_MODE=1` (or `--safe-mode`) prevents CLAUDE.md, skills, plugins, hooks, MCP servers, and auto memory from loading. Managed settings policy still applies. Useful for isolating a broken configuration without affecting other sessions (source: env-var-ref.md).

### Container / CI environments

```bash
# Synchronous plugin install before first query
CLAUDE_CODE_SYNC_PLUGIN_INSTALL=1
CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS=60000

# Skip prompt history for ephemeral sessions
CLAUDE_CODE_SKIP_PROMPT_HISTORY=1

# Disable interactive UI elements
CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

---

## Related pages

- [[claude-code-hooks]]
- [[claude-code-plugins]]
- [[claude-code-memory]]
- [[claude-code-subagents]]
- [[claude-code-workflows]]
- [[claude-code-mcp]]
- [[claude-code-agent-teams]]
- [[agent-protocols]]
