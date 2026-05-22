# Claude Code Plugins

**Summary**: Distributable packages that bundle skills, agents, hooks, MCP/LSP servers, commands, and background monitors into a single installable unit with namespace isolation — the primary mechanism for sharing Claude Code extensions across teams and the community.
**Sources**: claude-create-plugin-doc.md, analysis-claude-create-plugin-doc.md, research-claude-code-skills-format.md
**Last updated**: 2026-05-22

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

| Field         | Required | Description                                                                                                  |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `name`        | Yes      | Unique identifier (determines namespace prefix)                                                              |
| `description` | Yes      | What the plugin does — shown in the plugin manager                                                           |
| `version`     | No       | Semantic version. If omitted on a git-distributed plugin, the commit SHA is used and every commit is a new version |
| `author`      | No       | `{name, email}` — helpful for attribution                                                                    |
| `skills`      | No       | Skill directory references                                                                                   |
| `agents`      | No       | Agent definitions                                                                                            |
| `hooks`       | No       | Hook configurations                                                                                          |
| `mcpServers`  | No       | MCP server definitions                                                                                       |
| `lspServers`  | No       | LSP server definitions                                                                                       |

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

Monitor entries also support a `when` trigger and variable substitution (see the plugins reference).

## Default Settings

A plugin can ship a `settings.json` at its root to apply default configuration when enabled. Only the `agent` and `subagentStatusLine` keys are honored. Setting `agent` activates one of the plugin's custom agents as the main thread — applying its system prompt, tool restrictions, and model — letting a plugin change how Claude Code behaves by default. `settings.json` takes priority over `settings` declared in `plugin.json`; unknown keys are silently ignored.

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
