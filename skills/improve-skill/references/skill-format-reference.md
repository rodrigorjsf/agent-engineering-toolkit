# Skill Format Reference

Technical specification for SKILL.md format, directory structure, variables, and discovery.
Source: skills/research-claude-code-skills-format.md, skills/extend-claude-with-skills.md

---

## Contents

- Frontmatter fields (open standard)
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

*If `name` is omitted, the host tool typically uses the directory name; if `description` is omitted, it uses the first paragraph.*

---

## Name Validation Rules

- 1–64 characters
- Only lowercase `a-z`, numbers, and hyphens (`-`)
- Must NOT start or end with `-`
- Must NOT contain consecutive `--`
- Must NOT contain reserved words: `anthropic`, `claude`
- Must match the parent directory name

*Source: skills/research-claude-code-skills-format.md lines 103-108*

---

## String Substitutions

Use these variables inside SKILL.md content:

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments passed when invoking the skill |
| `$ARGUMENTS[N]` or `$N` | Specific argument by 0-based index |
| `${CLAUDE_SESSION_ID}` | Current session ID (for logging, session-specific files) |

**Critical**: Use relative `references/` paths to reference bundled files (portable across all AI tools); not hardcoded absolute paths:

```
Read the bundled guide material for detailed context.
```

Dynamic context injection with `!` prefix runs shell commands before skill loads:

```
- Current branch: !`git branch --show-current`
```

*Source: skills/extend-claude-with-skills.md lines 201-210; skills/research-claude-code-skills-format.md lines 126-149*

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

*Source: skills/research-claude-code-skills-format.md lines 153-186; skills/extend-claude-with-skills.md lines 100-115*

---

## Progressive Disclosure Loading Model

| Level | What loads | When |
|-------|-----------|------|
| Startup | `name` + `description` (~100 tokens) | Every session, all model-invocable skills |
| Trigger | Full SKILL.md body | When skill is invoked (user or Claude) |
| On-demand | Supporting files in `references/`, `assets/` | Only when skill phases read them |

Keep SKILL.md under **500 lines**. Move detailed reference material to `references/` subdirectory. Explicitly reference supporting files from SKILL.md so Claude knows what to load and when.

*Source: skills/research-claude-code-skills-format.md lines 172-186*

---

## Skill Locations and Priority

| Location | Path | Scope |
|----------|------|-------|
| Enterprise | Managed settings | All org users |
| Personal | `~/.claude/skills/<name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<name>/SKILL.md` | This project only |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where plugin is enabled |

Priority: enterprise > personal > project. Plugin skills use `plugin-name:skill-name` namespace — no conflicts.

*Source: skills/extend-claude-with-skills.md lines 85-97; skills/research-claude-code-skills-format.md lines 189-200*
