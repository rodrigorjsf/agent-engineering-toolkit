---
paths:
  - "**/skills/*/SKILL.md"
  - "**/skills/*/references/**/*.md"
  - "**/skills/*/assets/**"
  - ".claude/skills/*/SKILL.md"
  - ".claude/skills/*/references/**/*.md"
  - ".claude/skills/*/assets/**"
---
# Skill Self-Containment

A skill is a self-contained package — its body, its `references/` directory, and its `assets/` directory must reference only files **inside that skill's directory**. The skill is the unit of distribution; everything it needs to do its job lives within it.

## Hard rules

- Inside `SKILL.md`, `references/**`, and `assets/**` of any skill (`.claude/skills/*`, `plugins/*/skills/*`, `skills/*`):
  - **NEVER** link to `.claude/rules/*.md`
  - **NEVER** link to `docs/adr/*.md`
  - **NEVER** link to `wiki/knowledge/*.md` or use `[[wiki-link]]` syntax
  - **NEVER** reference sibling skill paths (`plugins/agent-customizer/skills/create-skill/...` from inside another skill)
  - **NEVER** reference repo-root paths like `CONTEXT.md`, `CLAUDE.md`, `.github/instructions/...`
- Reference files inside the skill (`references/foo.md`) and bundled assets (`assets/templates/bar.md`) ARE allowed — those are intra-skill paths.
- The skill's domain content may **describe** repo-level artifacts (a rule that authors `.claude/rules/*` skills must mention `.claude/rules/`) — that is the topic of the skill, not a cross-skill link. Distinguish:
  - **Allowed:** "Generate a rule file at `.claude/rules/<name>.md` with the following frontmatter…" (instructional content describing the artifact the skill produces).
  - **Forbidden:** "See `.claude/rules/skill-description-budget.md` for details." (cross-document link out of the skill package).

## When a new repo-level artifact constrains skill behavior

When a new ADR, `.claude/rules/*` rule, or wiki page introduces a constraint that a skill must enforce, the constraint's content (rule text, threshold numbers, exception fields, decision criteria) goes **inline** inside the skill's references — copied, not linked. The repo-level artifact remains the canonical source for the rule's authorship history and for path-scoped autoload triggers; the skill carries its own complete copy of what it needs to know to do its job without leaving its own directory.

When the canonical artifact updates, propagate the inlined copy across every affected skill simultaneously (treat it as a parity-family update).

## Why

A skill is a unit of distribution. Plugin skills get bundled into a marketplace; standalone skills get npx-installed; project meta skills (`.claude/skills/*`) ship with the repo. A reference to `.claude/rules/...`, `docs/adr/...`, or `wiki/...` from inside the skill breaks every distribution path the skill might travel:

- The link target may not exist on the consumer's machine.
- The link breaks portability when the skill is copied between distributions.
- It creates implicit cross-skill coupling that bundle tooling cannot detect or fix.
- The reader of the skill cannot answer "what does this enforce?" without leaving the skill's directory.

Path-scoped rules with `paths:` globs and ADR/wiki cross-links between repo-level docs serve a different purpose — they auto-load when matching files are edited and provide the canonical history. That mechanism is independent of, and **not a substitute for**, inlining the rule's content into every skill that must enforce it.

## What is in scope vs out of scope for this rule

**In scope (covered by this rule's `paths:` glob):**
- `.claude/skills/*/SKILL.md` and its `references/`, `assets/`
- `plugins/*/skills/*/SKILL.md` and its `references/`, `assets/`
- `skills/*/SKILL.md` and its `references/`, `assets/`

**Out of scope (no skill-self-containment constraint):**
- `docs-drift-manifest.md` files at the bundle/plugin root — these are metadata files **about** the bundle, not part of any single skill's package, and their job is to record cross-doc provenance. They legitimately reference repo-level docs.
- `.github/instructions/*.instructions.md` — review criteria, not skill packages.
- `CLAUDE.md`, `CONTEXT.md`, `.claude/rules/*.md`, `docs/adr/*.md`, `wiki/knowledge/*.md` — these are the canonical repo-level surfaces and may freely cross-link each other.

## Reviewer / quality-gate enforcement

Before merging a PR that touches any in-scope path, run:

```sh
grep -rn -E '\.claude/rules/[a-z0-9-]+\.md|docs/adr/[0-9]+|wiki/knowledge/|\[\[' \
  .claude/skills/*/SKILL.md .claude/skills/*/references/ \
  plugins/*/skills/*/SKILL.md plugins/*/skills/*/references/ \
  skills/*/SKILL.md skills/*/references/ 2>/dev/null
```

Every match is a candidate violation. The reviewer must reclassify each as one of:

1. **Domain content** — the skill teaches about the artifact type whose path is mentioned (e.g., a rule-authoring skill describing `.claude/rules/*.md`). Allowed.
2. **Pre-existing reference** — to be tracked in a follow-up PR. Allowed for the current PR but recorded.
3. **Violation** — a cross-document link the PR introduced or modified. Must be inlined or removed before merge.

If no clear classification fits, default to violation and inline the content.
