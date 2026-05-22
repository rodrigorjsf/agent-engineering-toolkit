# Skill Authoring Guide

Evidence-based guidance for creating Cursor SKILL.md packages that conform to the Agent Skills open standard.

---

## Contents

- Core principles (portable, version-controlled, actionable, progressive)
- Discovery model (where Cursor finds skills)
- Skill directory structure (the four optional subdirectories)
- SKILL.md frontmatter (the six recognised fields)
- Naming and descriptions
- Progressive disclosure patterns
- Bundled paths and script invocation
- Disabling automatic invocation
- Anti-patterns

---

## Core Principles

A skill is a portable, version-controlled package that teaches an agent how to perform a domain task. Four properties define the standard:

- **Portable** — skills work across any agent that supports the Agent Skills standard.
- **Version-controlled** — skills are stored as files and tracked in the repository, or installed via repository links.
- **Actionable** — skills can include scripts, templates, and references that agents act on using their tools.
- **Progressive** — skills load resources on demand, keeping context usage efficient.

**Conciseness is the primary principle.** At startup, only `name` + `description` are loaded for all discovered skills. The full `SKILL.md` body loads when the skill is invoked. Supporting files load only on demand when the body explicitly references them.

Challenge each piece of content:

- "Does the agent really need this explanation?"
- "Can I assume the agent knows this already?"
- "Does this paragraph justify its token cost?"

**Behavioral discipline** — every skill should make assumptions explicit, prefer the simplest complete path, keep changes surgical, and define clear validation targets before concluding.

**Safe persuasion** — use warm-up phases, curated references, explicit limits, and cited standards to improve compliance with legitimate work. Never use persuasion framing to bypass safeguards, refusals, or scope boundaries.


---

## Discovery Model

Cursor automatically discovers skills from these directories at startup:

| Location | Scope |
|----------|-------|
| `.agents/skills/` | Project-level (open-standard, portable) |
| `.cursor/skills/` | Project-level (Cursor-specific) |
| `~/.cursor/skills/` | User-level (global) |

The agent is presented with available skills and decides when they are relevant based on context. Skills can also be invoked manually by typing `/` in the agent chat and searching for the skill name.


---

## Skill Directory Structure

Each skill is a folder whose entry point is `SKILL.md`. Optional sibling directories carry on-demand resources:

```
my-skill/
├── SKILL.md           # required entry point
├── scripts/           # executable code the agent can run
├── references/        # additional documentation loaded on demand
└── assets/            # static resources (templates, images, data files)
```

Keep `SKILL.md` focused — move detailed reference material into `references/`. The agent loads supporting files progressively, only when the body of `SKILL.md` directs it to.


---

## SKILL.md Frontmatter

Each skill begins with YAML frontmatter. The Agent Skills standard recognises six fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill identifier. Lowercase letters, numbers, and hyphens only. Must match the parent folder name. |
| `description` | Yes | What the skill does and when to use it. Used by the agent to determine relevance. |
| `license` | No | License name or reference to a bundled license file. |
| `compatibility` | No | Environment requirements (system packages, network access, etc.). |
| `metadata` | No | Arbitrary key-value mapping for additional metadata. |
| `disable-model-invocation` | No | When `true`, the skill is only included when explicitly invoked via `/skill-name`. |

No other fields are part of the standard. Adding fields outside this set introduces foreign-platform dialect and breaks portability.


---

## Naming and Descriptions

**Naming** — kebab-case, lowercase letters/numbers/hyphens only, must match the parent folder. Prefer verb-noun or gerund forms (`deploy-app`, `processing-pdfs`). Avoid generic stems like `helper`, `utils`, `tools`.

**Descriptions** — always third person. The description is read by the agent to decide whether the skill is relevant.

- Good: "Deploys the application to staging or production environments. Use when deploying code or when the user mentions deployment, releases, or environments."
- Bad: "I can help you deploy the application."
- Bad: "You can use this to deploy."

Include three things in every description: (1) what it does, (2) when to use it, (3) the trigger terms an agent might match against.


---

## Progressive Disclosure

`SKILL.md` is the index; detailed content lives in supporting files loaded on demand.

**Pattern 1 — phased reference loads:**

```
## Phase 1: Analyze
Read references/criteria.md for the evaluation rubric.
```

**Pattern 2 — keep references focused:**
Each reference file has one job and is cited explicitly from the phase that needs it. Do not load every reference in Phase 1.

Keep `SKILL.md` under 500 lines. Move detail to `references/`. Reference supporting files explicitly so the agent knows what they contain.


---

## Bundled Paths and Script Invocation

When `SKILL.md` references a bundled file (script, template, reference), use a **relative path from the skill root**:

```
Run the deployment script: scripts/deploy.sh <environment>
```

```
Read references/skill-format-reference.md for the format specification.
```

Do not use string-substitution variables to refer to bundled files; the relative-path convention is what the Agent Skills standard guarantees portable across implementations.

Scripts can be written in any language the agent can execute (Bash, Python, JavaScript, etc.). They should be self-contained, include helpful error messages, and handle edge cases gracefully.


---

## Disabling Automatic Invocation

By default, skills are automatically applied when the agent determines they are relevant. Set `disable-model-invocation: true` to make a skill behave like a traditional slash command — the skill is only included when the user explicitly types `/skill-name` in chat.

Use this for workflows with side effects (commit, deploy, send-message) or for skills the user wants to gate manually.


---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Explaining what the agent already knows | Wastes tokens; dilutes attention | Delete it |
| Generic descriptions ("helps with data") | Poor skill discovery | Be specific about what + when + triggers |
| Inlining reference content in SKILL.md | Context bloat on every invocation | Move to `references/` subdirectory |
| Hardcoded absolute or project-relative paths | Goes stale; breaks portability | Use relative paths from skill root |
| Foreign-platform frontmatter fields | Breaks Agent Skills portability | Restrict to the six standard fields |
| Contradictions between phases | Agent picks one arbitrarily | Review all phases for consistency |
| Loading every reference in Phase 1 | Defeats progressive disclosure | Load each reference only in the phase that needs it |

