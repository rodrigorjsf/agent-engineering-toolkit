# Claude Code Skills

**Summary**: Custom instruction packages that extend Claude Code's capabilities through SKILL.md files with YAML frontmatter — following the Agent Skills open standard with Claude-specific extensions for model selection, tool restriction, and context forking.
**Sources**: extend-claude-with-skills.md, research-claude-code-skills-format.md, analysis-extend-claude-with-skills.md, analysis-research-claude-code-skills-format.md
**Last updated**: 2026-05-22

---

## Skill Format

Every skill is a directory containing at minimum a `SKILL.md` file:

```
my-skill/
├── SKILL.md           (required — YAML frontmatter + instructions)
├── references/        (optional — detailed reference material)
├── assets/            (optional — templates, examples, data)
└── scripts/           (optional — executable helpers)
```

### YAML Frontmatter

All fields are optional; only `description` is recommended (source: extend-claude-with-skills.md):

| Field                      | Required    | Description                                                                          |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `name`                     | No          | Display name; defaults to directory name. Lowercase, numbers, hyphens, max 64 chars  |
| `description`              | Recommended | What + when. Combined with `when_to_use`, truncated at 1,536 chars in the listing    |
| `when_to_use`              | No          | Extra trigger context; appended to `description`, counts toward the 1,536-char cap   |
| `disable-model-invocation` | No          | `true` = manual only (for destructive ops); also blocks preload into subagents       |
| `user-invocable`           | No          | `false` = hidden from the `/` menu (background knowledge only)                       |
| `allowed-tools`            | No          | Pre-approve tools while the skill is active (does not restrict availability)         |
| `model`                    | No          | sonnet, opus, haiku, full ID, or `inherit`                                           |
| `effort`                   | No          | `low`, `medium`, `high`, `xhigh`, `max` — available levels depend on the model       |
| `context`                  | No          | `fork` = isolated subagent execution                                                 |
| `agent`                    | No          | Subagent type for `context: fork` — Explore, Plan, general-purpose, or custom        |
| `argument-hint`            | No          | Placeholder text shown during autocomplete                                           |
| `arguments`                | No          | Named positional arguments for `$name` substitution                                  |
| `paths`                    | No          | Glob patterns that limit auto-activation to matching files                           |
| `shell`                    | No          | `bash` (default) or `powershell` for inline `` !`command` `` blocks                  |
| `hooks`                    | No          | Lifecycle hook definitions                                                           |

### String Substitutions

- `$ARGUMENTS` / `$ARGUMENTS[N]` / `$N` — User-provided arguments (`$N` is shorthand for `$ARGUMENTS[N]`)
- `$name` — Named argument declared in the `arguments` frontmatter list
- `${CLAUDE_SESSION_ID}` — Current session identifier
- `${CLAUDE_EFFORT}` — Current effort level (`low`/`medium`/`high`/`xhigh`/`max`)
- `${CLAUDE_SKILL_DIR}` — Skill directory path (the SKILL.md's own subdirectory, even for plugin skills)
- `` !`<command>` `` — Dynamic context (runs shell command before sending to Claude); use a ` ```! ` fenced block for multi-line commands

## Skill Locations

1. **Plugin skills** — `<plugin>/skills/` (namespaced: `plugin-name:skill-name`)
2. **Project skills** — `.claude/skills/`
3. **Personal skills** — `~/.claude/skills/`

## Progressive Disclosure

| Tier                             | Loaded When       | Budget        |
| -------------------------------- | ----------------- | ------------- |
| Metadata (name, description)     | Session start     | ~100 tokens   |
| Instructions (SKILL.md body)     | Skill activated   | <5,000 tokens |
| Resources (references/, assets/) | Explicitly loaded | On-demand     |

## Bundled Skills

Claude Code includes a set of bundled skills available in every session: `/code-review`, `/batch`, `/debug`, `/loop`, and `/claude-api` (source: extend-claude-with-skills.md). Unlike most built-in commands — which execute fixed logic — bundled skills are **prompt-based**: they give Claude detailed instructions and let it orchestrate using its tools. Invoke them like any other skill, with `/` followed by the name.

### Run-and-verify triad

Three additional bundled skills (Claude Code v2.1.145+) launch your app and confirm changes against the running app instead of just tests:

| Skill                  | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `/run`                 | Launch and drive your app to see a change working                                |
| `/verify`              | Build and run your app to confirm a change works, without falling back to tests  |
| `/run-skill-generator` | Record a per-project launch recipe so `/run` and `/verify` stop re-discovering it |

`/run` and `/verify` infer the launch from project type and `README`/`package.json`/`Makefile`; `/run-skill-generator` captures the recipe as a project skill at `.claude/skills/run-<name>/` when the launch needs more than a standard start (database, env file, multi-step build).

## Invocation

- **Manual**: Type `/skill-name` in chat
- **Auto**: Claude decides based on description match
- **Plugin**: `/plugin-name:skill-name [arguments]`

## Key Practices

- Keep SKILL.md under **500 lines** (~5,000 tokens)
- Use `disable-model-invocation: true` for side-effect tasks (deploy, commit)
- Move large API docs to `references/` files, referenced from SKILL.md
- Test skills both ways: auto-invocation and manual with `/`
- Don't use skills for settings — use CLAUDE.md instead

## Related pages

- [[agent-skills-standard]]
- [[skill-authoring]]
- [[claude-code-plugins]]
- [[cursor-skills]]
- [[progressive-disclosure]]
