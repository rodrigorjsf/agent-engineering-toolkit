# Claude Code Plugins

**Summary**: Distributable packages that bundle skills, agents, hooks, MCP/LSP servers, commands, and background monitors into a single installable unit with namespace isolation — the primary mechanism for sharing Claude Code extensions across teams and the community.
**Sources**: claude-create-plugin-doc.md, plugin-ref.md, analysis-claude-create-plugin-doc.md, research-claude-code-skills-format.md, monorepos-and-large-repos.md
**Last updated**: 2026-06-11

---

## Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json     (manifest — required)
├── skills/             (Agent Skills, as <name>/SKILL.md)
├── agents/             (Custom subagents)
├── hooks/
│   └── hooks.json      (Hook definitions)
├── commands/           (Legacy flat markdown commands — use skills/ for new plugins)
├── monitors/
│   └── monitors.json   (Background monitors)
├── bin/                (Executables added to the Bash PATH while enabled)
├── settings.json       (Default configuration)
├── .mcp.json           (MCP servers)
├── .lsp.json           (LSP servers)
└── README.md           (Documentation)
```

> **Critical**: Components go at the plugin root, **not** inside `.claude-plugin/`. Only `plugin.json` lives inside `.claude-plugin/`.

## Plugin.json Manifest

The manifest is **optional**. If omitted, Claude Code auto-discovers components in default locations and derives the plugin name from the directory name. Use a manifest when you need to provide metadata or custom component paths. The only required field when a manifest is present is `name` (source: plugin-ref.md).

Unrecognized top-level fields are silently ignored — you can keep metadata from another ecosystem (VS Code, npm `package.json`, MCPB/DXT) in the same file. `claude plugin validate --strict` treats unrecognized fields as errors.

### Required field

| Field  | Required | Description                                       |
| ------ | -------- | ------------------------------------------------- |
| `name` | Yes      | Unique kebab-case identifier (namespace prefix)   |

### Metadata fields

| Field           | Required | Description                                                                                                                                      |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `displayName`   | No       | Human-readable name in `/plugin` UI. May contain spaces and any casing. Falls back to `name`. Requires v2.1.143+ (source: plugin-ref.md)        |
| `description`   | No       | What the plugin does — shown in the plugin manager                                                                                               |
| `version`       | No       | Semantic version. If omitted, the commit SHA is used and every commit is a new version                                                           |
| `author`        | No       | `{name, email, url}` — attribution                                                                                                               |
| `homepage`      | No       | Documentation URL                                                                                                                                |
| `repository`    | No       | Source code URL                                                                                                                                  |
| `license`       | No       | License identifier                                                                                                                               |
| `keywords`      | No       | Discovery tags array                                                                                                                             |
| `defaultEnabled`| No       | `false` to ship a plugin that installs disabled (user must opt in with `plugin enable`). Requires v2.1.154+. Earlier versions ignore this and enable on install (source: plugin-ref.md) |

### Component path fields

| Field                   | Type               | Behavior                                                             |
| ----------------------- | ------------------ | -------------------------------------------------------------------- |
| `skills`                | string or array    | **Adds to** the default `skills/` directory                          |
| `commands`              | string or array    | **Replaces** default `commands/`                                     |
| `agents`                | string or array    | **Replaces** default `agents/`                                       |
| `hooks`                 | string/array/object | Own merge rules                                                     |
| `mcpServers`            | string/array/object | Own merge rules                                                     |
| `lspServers`            | string/array/object | LSP server configurations                                           |
| `outputStyles`          | string or array    | **Replaces** default `output-styles/`                                |
| `experimental.themes`   | string or array    | **Replaces** default `themes/`                                       |
| `experimental.monitors` | string or array    | Background monitors (see below)                                      |
| `userConfig`            | object             | User-configurable values prompted at enable time                     |
| `channels`              | array              | Message channel declarations (Telegram, Slack, Discord style)        |
| `dependencies`          | array              | Other plugins this plugin requires, with optional semver constraints |

All paths must be relative to the plugin root and start with `./`. When the manifest specifies a path, a warning appears if the default directory also exists but is now ignored (v2.1.140+).

## Namespacing

Plugin components are automatically namespaced using the `name` field from `plugin.json` to prevent conflicts when multiple plugins are installed:

| Component | Invocation Pattern          | Example                  |
| --------- | --------------------------- | ------------------------ |
| Skills    | `/plugin-name:skill-name`   | `/code-tools:lint-check` |
| Commands  | `/plugin-name:command-name` | `/code-tools:format`     |

This means two plugins can safely have skills with the same name — each is scoped by its plugin prefix. The plugin name from `plugin.json` determines the prefix.

## `$ARGUMENTS` Placeholder

Skills in plugins can use `$ARGUMENTS` to capture text the user provides after the skill name:

```
/my-plugin:hello Alex
```

In this example, `"Alex"` becomes `$ARGUMENTS` inside the SKILL.md body. This enables parameterized skill invocation.

## Background Monitors

Background monitors let a plugin watch logs, files, or external status and notify Claude as events arrive (source: claude-create-plugin-doc.md). Claude Code starts each monitor automatically when the plugin is active — no instruction needed. Add a `monitors/monitors.json` file at the plugin root with an array of monitor entries; each stdout line from a monitor's `command` is delivered to Claude as a notification during the session:

```json
[
  {
    "name": "error-log",
    "command": "tail -F ./logs/error.log",
    "description": "Application error log"
  }
]
```

Monitor entries also support a `when` trigger: `"always"` (default — starts at session start and on plugin reload) or `"on-skill-invoke:<skill-name>"` (starts the first time the named skill in this plugin is dispatched). Variable substitution is available: `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}`, `${user_config.*}`, and env vars. Monitors run only in interactive CLI sessions, unsandboxed at the same trust level as hooks. Requires v2.1.105+ (source: plugin-ref.md). Disabling a plugin mid-session does not stop already-running monitors; they stop at session end.

## User Configuration

The `userConfig` field in `plugin.json` declares values Claude Code prompts for when the plugin is enabled. Each key is a valid identifier; the value object has required fields `type` (one of `string`, `number`, `boolean`, `directory`, `file`), `title`, and `description`, plus optional `sensitive` (masked + keychain storage), `required`, `default`, `multiple` (array of strings for `string` type), and `min`/`max` (for `number`). Values are available in hook commands, MCP/LSP configs, and monitor commands as `${user_config.KEY}`, and non-sensitive values can also be substituted in skill and agent content. All values are also exported to plugin subprocesses as `CLAUDE_PLUGIN_OPTION_<KEY>` environment variables (source: plugin-ref.md).

## Default Settings

A plugin can ship a `settings.json` at its root to apply default configuration when enabled. Only the `agent` and `subagentStatusLine` keys are honored. Setting `agent` activates one of the plugin's custom agents as the main thread — applying its system prompt, tool restrictions, and model — letting a plugin change how Claude Code behaves by default. `settings.json` takes priority over `settings` declared in `plugin.json`; unknown keys are silently ignored.

## Themes

Plugins can ship color themes in `themes/` that appear in `/theme` alongside built-in presets. A theme is a JSON file with a `base` preset (`"dark"` or `"light"`) and a sparse `overrides` map of color tokens. Themes are an experimental component (`experimental.themes` in the manifest). Selecting a plugin theme persists the selection as `custom:<plugin-name>:<slug>`. Plugin themes are read-only; pressing `Ctrl+E` on one in `/theme` copies it to `~/.claude/themes/` for editing (source: plugin-ref.md).

## Code-Intelligence and LSP Plugins

Code-intelligence plugins that ship an LSP server (e.g. `typescript-lsp@claude-plugins-official`) let Claude replace brute-force file scans with language-server lookups — go-to-definition, find-references, and symbol search instead of reading whole trees (source: monorepos-and-large-repos.md). Enable them repo-wide via `enabledPlugins` so every contributor gets the same code intelligence (source: monorepos-and-large-repos.md). They require the language-server binary installed on each machine plus network access to the plugin host — GitHub by default, or an internal Git host on restricted networks (source: monorepos-and-large-repos.md).

LSP server optional fields beyond `command` and `extensionToLanguage` (source: plugin-ref.md):

| Field                   | Description                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `args`                  | Command-line arguments                                                                    |
| `transport`             | `stdio` (default) or `socket`                                                             |
| `env`                   | Environment variables for the server process                                              |
| `initializationOptions` | Options passed during initialization                                                      |
| `settings`              | Settings via `workspace/didChangeConfiguration`                                           |
| `diagnostics`           | `false` to keep code navigation but suppress automatic diagnostic injection after edits   |
| `startupTimeout`        | Max ms to wait for server startup                                                         |
| `maxRestarts`           | Maximum restart attempts before giving up                                                 |

Available official LSP plugins: `pyright-lsp` (Python/Pyright), `typescript-lsp` (TypeScript LS), `rust-analyzer-lsp` (Rust).

Plugins (and MCP code-search/RAG servers) also centralize project conventions when per-directory `CLAUDE.md` layering stops scaling — when files drift, go stale, or have no root owner — by moving conventions into on-demand mechanisms rather than always-loaded memory (source: monorepos-and-large-repos.md). Plugin skills use the `plugin-name:skill-name` namespace, so conventions packaged this way never collide across installed plugins (source: monorepos-and-large-repos.md). See [[monorepo-large-codebase-setup]] for scoping Claude to the part of a large tree a task touches.

## Installation Scopes

When you install a plugin, you choose a scope (source: plugin-ref.md):

| Scope     | Settings file                   | Use case                                                  |
| --------- | ------------------------------- | --------------------------------------------------------- |
| `user`    | `~/.claude/settings.json`       | Personal plugins across all projects (default)            |
| `project` | `.claude/settings.json`         | Team plugins shared via version control                   |
| `local`   | `.claude/settings.local.json`   | Project-specific plugins, gitignored                      |
| `managed` | Managed policy settings         | Org-wide plugins (read-only, admin-controlled update only) |

## Skills-Directory Plugins

Any folder under a skills directory that contains a `.claude-plugin/plugin.json` manifest is loaded as a plugin named `<name>@skills-dir` on the next session, with no marketplace and no install step. Scaffold one with `claude plugin init` (source: plugin-ref.md).

A skills directory tree can contain three distinct things:

| What you have | What it is |
| ------------- | ---------- |
| `<skills-dir>/foo/SKILL.md` with no manifest | A plain skill named `foo` |
| `<skills-dir>/foo/.claude-plugin/plugin.json` | A plugin `foo@skills-dir` |
| `<plugin>/skills/bar/SKILL.md` | A skill `bar` packaged inside a plugin |

Project-scope skills-directory plugins (`<cwd>/.claude/skills/`) load only after the workspace trust dialog and have restrictions: MCP servers need per-server approval, LSP servers require workspace trust, and background monitors do not load. Personal-scope plugins (`~/.claude/skills/`) have none of these restrictions.

## Plugin Caching and File Resolution

Marketplace plugins are copied to the plugin cache (`~/.claude/plugins/cache`) rather than used in-place. Each installed version is a separate directory. Previous version directories are kept for 7 days after update/uninstall (grace period for concurrent sessions), then cleaned up automatically. Glob and Grep tools skip orphaned version directories (source: plugin-ref.md).

Installed plugins cannot reference files outside their directory (`../shared-utils` paths fail). Within a marketplace, symlinks within the plugin's own directory are preserved as relative symlinks; symlinks to sibling plugins in the same marketplace are dereferenced (target content copied); symlinks outside the marketplace are skipped for security.

## CLI Commands Reference

```
claude plugin init <name> [--with skills,agents,hooks,mcp,lsp,output-style,channel] [-f]
claude plugin install <plugin> [-s user|project|local]
claude plugin uninstall <plugin> [-s scope] [--keep-data] [--prune]
claude plugin prune [-s scope] [--dry-run]
claude plugin enable <plugin> [-s scope]
claude plugin disable <plugin> [-s scope]
claude plugin update <plugin> [-s scope] [--all]
claude plugin list [-s scope] [--json]
claude plugin details <plugin>
claude plugin tag <plugin> <tag>
claude plugin validate <plugin> [--strict]
```

Key behaviors (source: plugin-ref.md):
- `plugin init` scaffolds at `~/.claude/skills/<name>/` and loads as `<name>@skills-dir` automatically
- `plugin uninstall` deletes the plugin's `${CLAUDE_PLUGIN_DATA}` directory by default; use `--keep-data` to preserve
- `plugin prune` (alias `autoremove`) removes auto-installed dependencies no longer required by any installed plugin; requires v2.1.121+
- `plugin disable` fails when another enabled plugin depends on the target; the error message includes a chained command to disable dependents first
- `plugin validate --strict` treats unrecognized manifest fields as errors (useful in CI)

## Distribution

### Three-Layer Extensibility

1. **Standalone skills** — Individual SKILL.md directories
2. **Plugins** — Bundled packages of skills, agents, hooks, monitors
3. **Marketplaces** — Catalogs of plugins (`.claude-plugin/marketplace.json`)

### Installation Sources

- Relative file path
- GitHub repository (e.g., `owner/repo`)
- Git URL with optional subdirectory
- npm package

### Community Marketplace

Anthropic maintains two public marketplaces (source: claude-create-plugin-doc.md):

- **`claude-plugins-official`** — a curated set maintained by Anthropic, available automatically in every Claude Code installation. Curated at Anthropic's discretion; there is no application process, and the submission form does not add plugins here.
- **`claude-community`** — the public community marketplace where third-party submissions land after review. Users add it with `/plugin marketplace add anthropics/claude-plugins-community` and install from it as `@claude-community`.

Submit for community-marketplace review via the in-app forms at `claude.ai/settings/plugins/submit` or `platform.claude.com/plugins/submit`. Run `claude plugin validate` locally before submitting — the review pipeline runs the same check plus automated safety screening. Approved plugins are pinned to a specific commit SHA in the `anthropics/claude-plugins-community` catalog; CI bumps the pin as you push new commits, and the public catalog syncs nightly, so there can be a delay between approval and the plugin appearing in `marketplace.json`.

## Environment Variables

| Variable                | Scope                   | Description                                                       |
| ----------------------- | ----------------------- | ----------------------------------------------------------------- |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin runtime          | Plugin installation directory (use for referencing bundled files) |
| `${CLAUDE_PLUGIN_DATA}` | Plugin runtime          | Persistent data directory for plugin state                        |
| `$CLAUDE_PROJECT_DIR`   | Hooks                   | Project root directory                                            |
| `$CLAUDE_ENV_FILE`      | SessionStart hooks only | Path to write `export` statements for persistent env vars         |

## Plugin Security Constraints

Agents bundled in plugins operate in a restricted security context:

| Frontmatter Field | Behavior in Plugin Context |
| ----------------- | -------------------------- |
| `hooks`           | **Silently ignored**       |
| `mcpServers`      | **Silently ignored**       |
| `permissionMode`  | **Silently ignored**       |

These restrictions prevent published plugins from escalating privileges. **Workaround**: Copy the agent file to `.claude/agents/` or `~/.claude/agents/` to use these fields outside the plugin sandbox.

## Development Workflow

### Local Testing

1. Create plugin structure with manifest
2. Test locally: `claude --plugin-dir ./my-plugin`
3. Reload without restarting: `/reload-plugins`
4. Use `--plugin-dir` multiple times for multi-plugin testing

### Override Behavior

A local plugin (loaded via `--plugin-dir`) overrides a marketplace plugin with the same name — except for managed force-enabled plugins set by organization admins.

### Debugging

- Check plugin structure matches the expected layout
- Test components individually (skills, hooks, agents)
- Verify namespace doesn't conflict with other installed plugins
- Check `/plugins` output to see loaded plugin list

## Key Practices

- Use semantic versioning for releases
- Include README.md with installation and usage instructions
- Test with other plugins to ensure no namespace conflicts
- Use skills directory (not commands) for new capabilities
- Keep plugin `name` short and descriptive — it becomes the namespace prefix
- Test all components together via `--plugin-dir` before publishing

## Related pages

- [[claude-code-skills]]
- [[claude-code-hooks]]
- [[claude-code-subagents]]
- [[cursor-plugins]]
- [[agent-skills-standard]]
- [[monorepo-large-codebase-setup]]
- [[claude-code-commands]] — `/plugin` and `/reload-plugins` are the interactive plugin management entry points
- [[claude-code-env-vars]] — `CLAUDE_CODE_PLUGIN_CACHE_DIR`, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, `CLAUDE_CODE_PLUGIN_PREFER_HTTPS`, `CLAUDE_CODE_PLUGIN_SEED_DIR`, `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL`, `CLAUDE_CODE_SYNC_PLUGIN_INSTALL`, and `FORCE_AUTOUPDATE_PLUGINS` are documented there
- [[claude-code-mcp]] — plugin MCP servers auto-connect on session start; see the MCP page for transport and authentication details
- [[claude-code-tools]] — `ListMcpResourcesTool`, `ReadMcpResourceTool`, `ToolSearch`, `WaitForMcpServers`, and the Monitor tool's plugin-declared monitors feature
