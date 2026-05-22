# Cursor Plugins

**Summary**: Distributable packages that bundle rules, skills, agents, commands, hooks, and MCP servers for Cursor IDE — discoverable through the Cursor Marketplace with team/enterprise distribution groups, auto-discovery from default directories, and a submission/review pipeline.
**Sources**: plugins.md, plugin-full-reference.md
**Last updated**: 2026-05-22

---

## Plugin Structure

```
my-plugin/
├── .cursor-plugin/
│   └── plugin.json        (manifest — required)
├── rules/                  (auto-discovered .md/.mdc/.markdown files)
├── skills/                 (auto-discovered SKILL.md directories)
├── agents/                 (auto-discovered .md/.mdc/.markdown files)
├── commands/               (auto-discovered .md/.mdc/.markdown/.txt files)
├── hooks/
│   └── hooks.json          (hook event definitions)
├── mcp.json                (MCP server definitions)
├── assets/                 (logos and static assets)
├── scripts/                (hook and utility scripts)
└── README.md
```

A `SKILL.md` at the plugin root is treated as a single-skill plugin, but only if there is no `skills/` directory and no manifest `skills` field (source: plugin-full-reference.md).

## Manifest (plugin.json)

Only `name` is required — a lowercase kebab-case identifier that starts and ends with an alphanumeric character (source: plugin-full-reference.md). All other fields are optional.

| Field                                                          | Required | Description                                                             |
| -------------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `name`                                                         | Yes      | kebab-case identifier                                                   |
| `description`                                                  | No       | What the plugin does                                                    |
| `version`                                                      | No       | Semantic version                                                        |
| `author`                                                       | No       | `{name, email}`                                                         |
| `homepage` / `repository` / `license`                          | No       | URLs and license identifier                                             |
| `logo`                                                         | No       | Relative repo path (resolves to a `raw.githubusercontent.com` URL) or absolute URL |
| `keywords`                                                     | No       | Discovery tags                                                          |
| `rules`, `agents`, `skills`, `commands`, `hooks`, `mcpServers` | No       | Explicit component paths (auto-discovered from default dirs if omitted) |

When a manifest field **is** specified, it **replaces** folder discovery for that component — the default folder is not also scanned (source: plugin-full-reference.md).

## Distribution

| Channel              | Audience     | Access                     |
| -------------------- | ------------ | -------------------------- |
| **Marketplace**      | Public       | cursor.com/marketplace     |
| **Community**        | Public       | cursor.directory           |
| **Team Marketplace** | Organization | Dashboard settings         |
| **Local**            | Developer    | `~/.cursor/plugins/local/` |

Every marketplace plugin is manually reviewed before listing, must be open source, and each update is reviewed before publishing (source: plugins.md).

### Team Distribution

When a plugin is assigned to a distribution group it is set **Required** (auto-installed for everyone in that group) or **Optional** (each developer chooses) (source: plugins.md). Distribution groups can be driven by SCIM-synced identity-provider groups. Teams plans allow 1 team marketplace; Enterprise plans allow unlimited.

## Using the workspaceOpen Hook

A `workspaceOpen` hook can return plugin paths to load on workspace open, which is useful when the set of plugins depends on the workspace itself (source: plugins.md). The hook script registers plugin paths via the `pluginPaths` output array — see [[cursor-hooks]] for the App-lifecycle hook category and its schema.

## Multi-Plugin Repositories

Use `.cursor-plugin/marketplace.json` at the repo root. Required fields are `name`, `owner`, and `plugins` (max 500 entries) (source: plugin-full-reference.md):

```json
{
  "name": "my-marketplace",
  "owner": {"name": "...", "email": "..."},
  "metadata": {"description": "...", "pluginRoot": "plugins/"},
  "plugins": [
    {"name": "plugin-a", "source": "plugin-a"},
    {"name": "plugin-b", "source": "plugin-b"}
  ]
}
```

For each entry, the parser looks for `<source>/.cursor-plugin/plugin.json`; if found, the per-plugin manifest is merged with the marketplace entry, with manifest values taking precedence (source: plugin-full-reference.md).

## Local Development

- Load locally: copy or symlink into `~/.cursor/plugins/local/my-plugin`, then restart Cursor or run **Developer: Reload Window**
- Symlink for faster iteration: `ln -s /path/to/my-plugin ~/.cursor/plugins/local/my-plugin`
- Template: `github.com/cursor/plugin-template`
- Submit: `cursor.com/marketplace/publish`

## Submission Checklist

- Valid `.cursor-plugin/plugin.json` manifest with a unique kebab-case `name`
- Clear `description` and a `README.md`
- All rules, skills, agents, and commands carry proper frontmatter
- Logo committed to the repo and referenced by relative path (if provided)
- All manifest paths relative and valid (no `..`, no absolute paths)
- Tested locally
- For multi-plugin repos: `.cursor-plugin/marketplace.json` at the repo root with unique plugin names

## Hooks Reference

Plugins ship hooks via `hooks/hooks.json`. Available events span Agent hooks, Tab hooks, and the App-lifecycle `workspaceOpen` hook (source: plugin-full-reference.md). See [[cursor-hooks]] for the full event list and configuration schema.

## Related pages

- [[claude-code-plugins]]
- [[cursor-rules]]
- [[cursor-skills]]
- [[cursor-hooks]]
- [[cursor-mcp]]
