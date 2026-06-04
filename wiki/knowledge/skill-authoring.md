# Skill Authoring

**Summary**: Evidence-based practices for creating effective agent skills — covering the "start from real expertise" principle, context budgeting, progressive disclosure structure, eval-driven iteration, description optimization for trigger accuracy, and script bundling conventions.
**Sources**: skill-authoring-best-practices.md, agentskills-best-practices.md, agentskills-evaluating-skills.md, agentskills-optimizing-descriptions.md, agentskills-using-scripts.md, monorepos-and-large-repos.md
**Last updated**: 2026-06-04

---

## Starting Point: Real Expertise

Skills must encode real knowledge, not LLM-generated generic content:

- Extract from hands-on tasks: steps that worked, corrections made, I/O formats
- Synthesize from existing artifacts: runbooks, API specs, code reviews, git history, failure cases
- Challenge every line: **"Would the agent get this wrong without this instruction?"**
- Assume the agent already knows common tools (HTTP, databases, migrations)

## Content Budget

| Element                       | Target                          |
| ----------------------------- | ------------------------------- |
| SKILL.md body                 | Under 500 lines (~5,000 tokens) |
| Metadata (name + description) | ~100 tokens                     |
| Reference files               | On-demand, 1 level deep         |

## Structure Patterns

### Gotchas Section

Keep in SKILL.md for pre-task reading. Document non-obvious edge cases and environment-specific facts.

### Templates

- Inline for short, universal templates
- In `assets/` for longer or conditional templates

### Checklists

Explicit progress tracking with dependencies.

### Validation Loops

Do work → run validator → fix issues → repeat until passing.

### Plan-Validate-Execute

For batch/destructive operations: create plan → validate against source of truth → execute.

## Instruction Specificity

Match specificity to task fragility:

| Task Type                        | Approach                          |
| -------------------------------- | --------------------------------- |
| Flexible (many valid approaches) | High freedom, broad guidance      |
| Fragile (one correct approach)   | Low freedom, prescriptive scripts |

Provide **defaults with escape hatches**, not feature menus.

## Eval-Driven Iteration

### Test Cases

- Start with 2–3 test cases; expand after first results
- Each case: `prompt` (realistic), `expected_output` (human description), optional `files`
- Run both **with and without** skill to establish baseline
- Store test cases in `evals/evals.json` inside the skill directory

### Assertions

- Verifiable statements: specific, observable, countable
- Good: "Output file is valid JSON", "Chart has labeled axes", "Report includes ≥3 recommendations"
- Bad: "Output is good" (too vague), "Uses exact phrase X" (too brittle)
- Remove assertions that always pass in both configs (they inflate scores without measuring skill value)
- Study assertions that pass with skill but fail without (clearest value signal)

### Grading Outputs

- Each assertion gets **PASS** or **FAIL** with specific evidence (quote the output, don't just opine)
- Use LLM grading for subjective assertions, scripts for mechanical checks (valid JSON, row count)
- **Blind comparison**: present both with/without outputs to an LLM judge without revealing which is which — catches holistic quality differences beyond individual assertions

### The Iteration Loop

1. Give eval signals (failed assertions + human feedback + execution transcripts) to an LLM
2. LLM proposes skill improvements — **generalize** from feedback, don't patch specific test cases
3. Review and apply changes
4. Rerun all test cases in a new `iteration-<N+1>/` directory
5. Grade and aggregate results
6. Human review — record specific, actionable feedback
7. Repeat until feedback is consistently empty or no meaningful improvement between iterations

### Improvement Principles

- **Generalize from feedback** — fixes should address underlying issues broadly, not add narrow patches
- **Keep the skill lean** — fewer, better instructions outperform exhaustive rules
- **Explain the why** — reasoning-based instructions ("Do X because Y causes Z") outperform rigid directives
- **Bundle repeated work** — if every test run writes a similar helper script, bundle it in `scripts/`

## Description Optimization

The description carries the **entire triggering burden** — if it doesn't match, the agent won't load the skill. At startup, agents load only `name` + `description` (~100 tokens) for each available skill. Only when a task matches does the full SKILL.md enter context.

### Eval Query Design

- Aim for **~20 queries**: 8–10 should-trigger, 8–10 should-not-trigger
- **Should-trigger**: vary phrasing (formal/casual), explicitness (named domain vs. implied need), and complexity
- **Should-not-trigger**: focus on **near-misses** — queries sharing keywords but needing different skills. "Write a fibonacci function" tests nothing; "update formulas in my Excel budget" tests boundary precision
- Include realistic context: file paths, personal context, casual language, typos

### Optimization Process

1. Split queries: **60% train / 40% validation** — proportional should/shouldn't in each set
2. Run each query **N times** (3 minimum) — compute trigger rate per query
3. A should-trigger query passes if trigger rate > 0.5; should-not-trigger passes if < 0.5
4. Identify train-set failures; revise description to generalize (not to match specific query keywords)
5. Re-evaluate on both train and validation sets
6. Select the iteration with **highest validation pass rate** (may not be the last iteration)
7. Final check: 5–10 fresh queries never seen during optimization

Five iterations is usually enough. If performance plateaus, try a structurally different description framing rather than incremental tweaks.

### Description Writing Tips

- Use **imperative phrasing**: "Use when..." not "This skill helps..."
- Focus on **user intent**, not implementation details
- Be **explicitly pushy** about contexts where skill applies — "even if they don't mention 'CSV' or 'analysis'"
- Avoid adding specific keywords from failed queries — that's **overfitting**
- Stay under the **1024-character** hard limit (descriptions tend to grow during optimization)

## Script Conventions

### One-Off Commands

Use existing package runners with pinned versions:

- `uvx ruff@0.8.0 check .` (Python)
- `npx eslint@9 --fix .` (Node.js)
- `deno run npm:eslint@9 -- --fix .` (Deno)

### Bundled Scripts

Self-contained with inline dependencies — no separate manifest or install step:

- **Python**: PEP 723 inline metadata (`# /// script` + `# dependencies = [...]`); run with `uv run script.py`
- **Deno**: `npm:` and `jsr:` import specifiers with version pinning (`npm:cheerio@1.0.0`); auto-resolves
- **Bun**: Auto-installs missing packages when no `node_modules` exists; TypeScript works natively
- **Ruby**: `bundler/inline` for gem declarations directly in the script

### Script Interface Rules

- **No interactive prompts** — agents run non-interactive shells; blocking on TTY input hangs indefinitely
- Accept input via CLI flags, env vars, or stdin
- Implement `--help` — primary way agents learn a script's interface
- Structured output (JSON/CSV) to stdout; diagnostics to stderr
- `--dry-run` flag for destructive operations
- **Meaningful exit codes** for different failure types (not found, invalid args, auth failure) — document in `--help`
- **Idempotent**: "create if not exists" over "create and fail on duplicate" — agents may retry
- Predictable output size — many harnesses truncate at 10–30K characters

## Multi-Model Testing

Test skills across model tiers to calibrate instruction specificity:

| Model Tier                | Test Question                                      | Implication                                             |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| **Haiku** (small/fast)    | Does it have enough guidance to complete the task? | If Haiku struggles, instructions may be too sparse      |
| **Sonnet** (balanced)     | Are instructions clear and efficient?              | The primary target for most skills                      |
| **Opus** (large/powerful) | Are you over-explaining things it already knows?   | Unnecessary instructions waste tokens on capable models |

A skill that works on Sonnet but fails on Haiku needs more explicit guidance. A skill where Opus follows instructions literally that were meant as guidelines may be over-constraining.

## Reference File Organization

- Keep references **one level deep** from SKILL.md — all reference files link directly from SKILL.md
- Claude may `head -100` nested references instead of reading completely — losing critical information
- For files over 100 lines, include a **table of contents** at the top so Claude sees the full scope even in partial reads
- Organize by **domain** (finance.md, sales.md, product.md) not by type (schemas.md, queries.md) — the agent loads only what each task requires

When the user asks about revenue, Claude reads SKILL.md, sees the reference to `reference/finance.md`, and reads just that file. Other reference files consume **zero context tokens** until needed.

## Metadata Cost

The `name` + `description` fields cost ~**100 tokens** and load at startup for **every installed skill**. With 100+ skills installed, metadata alone consumes 10,000+ tokens.

| Example                                                                        | Tokens | Quality                                  |
| ------------------------------------------------------------------------------ | ------ | ---------------------------------------- |
| `description: Helps with documents`                                            | ~5     | Too vague — won't trigger correctly      |
| `description: Analyze CSV and tabular data...even if they don't mention "CSV"` | ~50    | Good — specific triggers, broad coverage |
| `description: [150-word paragraph covering every edge case]`                   | ~150   | Over-specified — wastes startup budget   |

Target **~50 tokens** for description — enough for precise triggering, low enough to scale across many skills.

## Large-Repo Skill Hygiene

When a repo accumulates many skills — e.g. a monorepo where every touched subdirectory's `.claude/skills/` accumulate "into the hundreds" — descriptions get shortened, so lead each description with the request keywords that should trigger it (source: monorepos-and-large-repos.md). Retire dead skills: use OTEL `skill_activated` telemetry and inspect the `invocation_trigger` field to find skills that are never activated and remove them (source: monorepos-and-large-repos.md). See [[monorepo-large-codebase-setup]] for per-directory skill placement and scoping by start directory.

## Related pages

- [[agent-skills-standard]]
- [[claude-code-skills]]
- [[cursor-skills]]
- [[monorepo-large-codebase-setup]]
- [[persuasion-in-ai]]
- [[progressive-disclosure]]
