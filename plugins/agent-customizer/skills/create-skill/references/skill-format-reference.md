# Skill Format Reference

Technical specification for SKILL.md format, directory structure, variables, and discovery.

---

## Contents

- Frontmatter fields (open standard + Claude Code extensions)
- Name validation rules
- String substitutions
- Directory structure
- Progressive disclosure loading model
- Skill locations and priority
- Plugin namespace and installation

---

## Frontmatter Fields

### Agent Skills Open Standard (portable across AI tools)

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Recommended* | Max 64 chars; lowercase letters, numbers, hyphens only |
| `description` | Recommended* | Max 1024 chars; what it does + when to use it |
| `license` | No | License name or path to LICENSE file |
| `compatibility` | No | Max 500 chars; environment requirements |
| `metadata` | No | Arbitrary key-value map (author, version, etc.) |
| `allowed-tools` | No | Space-delimited list of pre-approved tools (experimental) |

*In Claude Code: if `name` omitted, uses directory name; if `description` omitted, uses first paragraph.

### Claude Code Extensions (platform-specific)

| Field | Description |
|-------|-------------|
| `argument-hint` | Hint shown in autocomplete, e.g. `[issue-number]` or `[filename] [format]` |
| `disable-model-invocation` | `true` = user-only invocation; description removed from context |
| `user-invocable` | `false` = hidden from `/` menu; Claude invokes automatically only |
| `model` | Model override when skill is active |
| `effort` | Effort level: `low`, `medium`, `high`, `max` (Opus 4.6 only for `max`) |
| `context` | `fork` = run in isolated subagent with separate context |
| `agent` | Subagent type when `context: fork` (e.g., `Explore`, `Plan`, `general-purpose`) |
| `hooks` | Hooks scoped to this skill's lifecycle (see hooks documentation) |


---

## Name Validation Rules

- 1–64 characters
- Only lowercase `a-z`, numbers, and hyphens (`-`)
- Must NOT start or end with `-`
- Must NOT contain consecutive `--`
- Must match the parent directory name


---

## String Substitutions

Use these variables inside SKILL.md content:

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments passed when invoking the skill |
| `$ARGUMENTS[N]` or `$N` | Specific argument by 0-based index |
| `${CLAUDE_SESSION_ID}` | Current session ID (for logging, session-specific files) |
| `${CLAUDE_SKILL_DIR}` | Directory containing SKILL.md (use for bundled scripts/files) |

**Critical**: Always use `${CLAUDE_SKILL_DIR}` to reference bundled files, not hardcoded paths:

```
Read the bundled guide material for detailed context.
```

Dynamic context injection with `!` prefix runs shell commands before skill loads:

```
- Current branch: !`git branch --show-current`
```


---

## Directory Structure

```
my-skill/
├── SKILL.md                # Required: metadata + instructions (entry point)
├── references/             # Optional: reference docs loaded on demand
│   └── guide.md
├── assets/
│   └── templates/          # Optional: output templates
│       └── template.md
├── examples.md             # Optional: usage examples
└── scripts/                # Optional: executable scripts (not loaded, executed)
    └── helper.py
```

**Loading behavior:**

- `SKILL.md` loads when skill activates
- `references/` files load only when skill phases explicitly read them
- `scripts/` files are executed, not loaded into context


---

## Progressive Disclosure Loading Model

| Level | What loads | When |
|-------|-----------|------|
| Startup | `name` + `description` (~100 tokens) | Every session, all model-invocable skills |
| Trigger | Full SKILL.md body | When skill is invoked (user or Claude) |
| On-demand | Supporting files in `references/`, `assets/` | Only when skill phases read them |

Keep SKILL.md under **500 lines**. Move detailed reference material to `references/` subdirectory. Explicitly reference supporting files from SKILL.md so Claude knows what to load and when.


---

## Skill Locations and Priority

| Location | Path | Scope |
|----------|------|-------|
| Enterprise | Managed settings | All org users |
| Personal | `~/.claude/skills/<name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<name>/SKILL.md` | This project only |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where plugin is enabled |

Priority: enterprise > personal > project. Plugin skills use `plugin-name:skill-name` namespace — no conflicts.

