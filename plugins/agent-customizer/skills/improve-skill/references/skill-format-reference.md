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

The Agent Skills open-standard fields and Claude Code platform extensions are tabulated in `skill-authoring-guide.md`. This file specifies the deeper format constraints (name validation, substitutions, directory layout, loading model, locations).

---

## Name Validation Rules

- 1–64 characters
- Only lowercase `a-z`, numbers, and hyphens (`-`)
- Must NOT start or end with `-`
- Must NOT contain consecutive `--`
- Must match the parent directory name


---

## String Substitutions

Skill body variables: `$ARGUMENTS` (all invocation args), `$ARGUMENTS[N]` / `$N` (specific arg by 0-based index), `${CLAUDE_SESSION_ID}` (for logging), `${CLAUDE_SKILL_DIR}` (skill directory — always use this for bundled file references, never hardcoded paths). Dynamic context with the `!` prefix runs shell commands at load time, e.g. `- Current branch: !` + `` `git branch --show-current` ``.


---

## Directory Structure

A skill directory contains `SKILL.md` (required entry point), `references/` for on-demand reference docs, `assets/templates/` for output templates, optional `examples.md`, and optional `scripts/` for executables (executed, not loaded into context). `references/` files load only when skill phases explicitly read them.


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

