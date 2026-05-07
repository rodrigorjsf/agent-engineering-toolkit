# Distribution-content boundary

**Status:** accepted (2026-05-04)

A plugin distribution sources from its target platform's docs plus the cross-platform standard; the standalone distribution sources from the standard alone.

The "cross-platform standard" is platform-agnostic documentation (context engineering, general harness, general-LLM filtered) — the subset that fits for **skills** (open Agent Skills format) and **AGENTS.md** as the supported output forms.

Concepts whose output forms are platform-attached — Hooks, Subagents, path-scoped Rules with platform-specific frontmatter, CLAUDE.md hierarchy — are not in the standard. Standalone skills must not author them.

## Context

The toolkit ships three distributions (see `CONTEXT.md` for canonical definitions):

- **Claude Code distribution** — the `agents-initializer` + `agent-customizer` plugin pair, targeting the Claude Code platform. Artifacts live under `.claude/`.
- **Cursor distribution** — the `cursor-initializer` + `cursor-customizer` plugin pair, targeting Cursor IDE. Artifacts live under `.cursor/`.
- **Standalone distribution** — the npx-installable `skills/` bundle. Performs inline analysis without subagent delegation; no initializer/customizer split.

Each distribution draws on a different content source. Plugin distributions are justified in consuming platform-specific documentation because their output is intentionally platform-attached. The standalone bundle has no such justification: it claims to be portable, yet several of its skills were generating Claude Code-native output forms (`CLAUDE.md` hierarchy, `.claude/rules/*.md` with `paths:` frontmatter). ADR-0005 attempted to resolve the resulting compliance contradiction by splitting standalone scope into two layers (agnostic prose, platform-targeted templates). That two-layer reading preserved `init-claude` and `improve-claude` in the bundle. This ADR supersedes that preservation by articulating the upstream principle: the standalone bundle's content sources do not include platform-specific documentation, and therefore no standalone skill may author platform-attached output forms, regardless of how the template layer is named.

## The boundary

| Distribution | Sources from | Output forms |
|---|---|---|
| Claude Code plugin (`agents-initializer`, `agent-customizer`) | Claude Code platform docs + cross-platform standard | Skills, AGENTS.md, Hooks, Subagents, Rules (`.claude/rules/`), CLAUDE.md hierarchy |
| Cursor plugin (`cursor-initializer`, `cursor-customizer`) | Cursor platform docs + cross-platform standard | Skills, Hooks, Rules (`.cursor/rules/*.mdc`), Subagents |
| Standalone bundle (`skills/`) | Cross-platform standard only | Skills (SKILL.md packages), AGENTS.md |

## Consequences

Every standalone skill that generates a platform-attached output form fails the test under this boundary. Eight skills are affected:

**Six deleted in issue #117:**

- `create-rule` — generated `.claude/rules/*.md` with `paths:` frontmatter. Plugin equivalent: `plugins/agent-customizer/skills/create-rule/`.
- `improve-rule` — evaluated and rewrote Claude Code path-scoped rules. Plugin equivalent: `plugins/agent-customizer/skills/improve-rule/`.
- `create-hook` — generated Claude Code hook configurations (`settings.json` entries). Plugin equivalent: `plugins/agent-customizer/skills/create-hook/`.
- `improve-hook` — evaluated and rewrote Claude Code hooks. Plugin equivalent: `plugins/agent-customizer/skills/improve-hook/`.
- `create-subagent` — generated `.claude/agents/*.md` subagent definitions. Plugin equivalent: `plugins/agent-customizer/skills/create-subagent/`.
- `improve-subagent` — evaluated and rewrote Claude Code subagent definitions. Plugin equivalent: `plugins/agent-customizer/skills/improve-subagent/`.

**Two deferred to XC-12/Final:**

- `init-claude` — bootstraps `CLAUDE.md` hierarchy and `.claude/rules/` for a project. Plugin equivalent: `plugins/agents-initializer/skills/init-claude/`.
- `improve-claude` — evaluates and improves existing `CLAUDE.md` and `.claude/rules/`. Plugin equivalent: `plugins/agents-initializer/skills/improve-claude/`.

The surviving standalone skills — `init-agents`, `improve-agents`, `create-skill`, `improve-skill` — author only cross-platform output forms (AGENTS.md and SKILL.md packages) and are unaffected by this boundary.

## Considered options (rejected)

**Union-of-platforms** — the standalone bundle could include any platform's concepts under generic names (e.g., "init-project" covering CLAUDE.md and AGENTS.md and `.cursor/rules/` setup). Rejected because the output forms remain platform-attached regardless of what the skill is called. A skill that generates `CLAUDE.md` hierarchy is a Claude Code skill, independent of its name.

**Claude-as-default** — the standalone bundle covers Claude Code natively (on the grounds that Claude Code is the reference runtime for this repo). Rejected because it makes Cursor and other platforms second-class citizens inside the nominally "portable" bundle. The standalone bundle's portability claim is its purpose; privileging one platform hollows that claim.

**Output-form-only skills** — allow platform-attached concepts if the output is wrapped generically (e.g., a skill that authors "project memory" which happens to be `CLAUDE.md`). Rejected because rename without reframe still produces hollow content. The skill body must teach to the output form, and once the output form is platform-attached the body inevitably imports platform-specific knowledge. This is the lesson from ADR-0005: the two-layer split attempted exactly this wrapping and still required knowledge sources (`CLAUDE-*` IDs) that are not in the cross-platform standard.

## Why now

ADR-0005 recorded the two-layer split as a pragmatic resolution to a compliance contradiction surfaced during the May 2026 alignment audit. The § Follow-up section of that ADR then documented per-family disposition decisions (rules: reframe; hooks/subagents: deprecate) as effects of applying the split. This ADR identifies the underlying cause: the standalone bundle's content-source constraint was never formally stated. The per-family outcomes in ADR-0005 § Follow-up are effects of this boundary, not independent decisions. Locking the principle here prevents future skills from being added to the standalone bundle without a clear test to apply.
