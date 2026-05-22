# Skill Format Reference

Technical specification for Cursor SKILL.md format, frontmatter, directory structure, and discovery model.

---

## Contents

- Frontmatter fields (the Agent Skills open standard)
- Name validation rules
- Bundled-path convention (relative paths from skill root)
- Directory structure
- Progressive disclosure loading model
- Skill discovery locations and scope

---

## Frontmatter Fields

The Agent Skills standard, as adopted by Cursor, recognises exactly six frontmatter fields. No other fields are part of the standard.

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | Lowercase letters, numbers, hyphens only; max 64 chars; must match parent folder name |
| `description` | Yes | Max 1024 chars; what it does + when to use it; third person; no XML tags |
| `license` | No | License name or path to a bundled license file |
| `compatibility` | No | Environment requirements (system packages, network access, etc.) |
| `metadata` | No | Arbitrary key-value mapping (author, version, etc.) |
| `disable-model-invocation` | No | `true` = skill only included when explicitly invoked via `/skill-name` |

Frontmatter fields outside this set are foreign-platform dialect and must not appear in Cursor SKILL.md files.


---

## Name Validation Rules

- 1–64 characters
- Only lowercase `a-z`, numbers, and hyphens (`-`)
- Must NOT start or end with `-`
- Must NOT contain consecutive `--`
- Must match the parent directory name exactly


---

## Bundled-Path Convention

When `SKILL.md` references a bundled file (script, template, reference), use a **relative path from the skill root**:

```
Run the deployment script: scripts/deploy.sh <environment>
```

```
Read references/skill-format-reference.md for the format specification.
```

```
Apply the template at assets/templates/config.yaml.
```

This convention is what the Agent Skills standard guarantees portable across implementations. Do not use string-substitution variables, absolute paths, or project-relative paths for bundled files — relative paths from the skill root are the only portable form.


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
└── scripts/                # Optional: executable scripts the agent can run
    └── deploy.sh
```

**Loading behaviour:**

- `SKILL.md` loads when the skill activates.
- `references/` files load only when the skill body explicitly directs the agent to read them.
- `assets/` files load only when the skill body explicitly directs the agent to use them.
- `scripts/` files are executed by the agent, not loaded into context.


---

## Progressive Disclosure Loading Model

| Level | What loads | When |
|-------|-----------|------|
| Startup | `name` + `description` for every discovered skill | Every session |
| Trigger | Full SKILL.md body | When the skill is invoked (user or agent) |
| On-demand | Files in `references/`, `assets/`, and any other bundled directories | Only when the skill body directs the agent to read or use them |

Keep SKILL.md under **500 lines**. Move detailed reference material to the `references/` subdirectory. Explicitly reference supporting files from SKILL.md so the agent knows what to load and when.


---

## Skill Discovery Locations and Scope

Cursor automatically loads skills from these directories:

| Location | Path | Scope |
|----------|------|-------|
| Project (open standard) | `.agents/skills/<name>/SKILL.md` | This project — portable across Agent Skills implementations |
| Project (Cursor-native) | `.cursor/skills/<name>/SKILL.md` | This project — Cursor-specific |
| User (global) | `~/.cursor/skills/<name>/SKILL.md` | All projects on this machine |

When the same skill name exists in multiple locations, Cursor's own resolution rules apply. For new skills, choose `.cursor/skills/` when the skill is Cursor-specific and `.agents/skills/` when the skill should also be discoverable by other Agent Skills consumers.

