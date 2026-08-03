# agent-engineering-toolkit

Multi-plugin marketplace where each distribution authors agent artifacts (skills, hooks, rules, subagents) for one specific agent platform. Plugins fall into two complementary roles per platform: an **initializer** that bootstraps platform-wide configuration for a project, and a **customizer** that creates and improves individual artifacts within that project.

## Language

### Distribution roles

**Initializer**:
A plugin that bootstraps the platform-wide configuration of a target project (one-shot setup of the rule/memory hierarchy).
_Avoid_: setup plugin, scaffolder

**Customizer**:
A plugin that creates and improves individual agent artifacts (skills, hooks, rules, subagents) inside a project that is already initialized.
_Avoid_: artifact builder, generator plugin

**Deployable-behavior plugin**:
A plugin that *ships* working behavior consumed directly on install — a bundled rule plus skills — rather than *generating* artifacts into a target project. `cursor-code-documentation` is the first: installing it makes the **Document-as-you-code rule** active and the `code-explain`/`doc-generate` **Manual-only skills** available. A distinct plugin role from the initializer/customizer generators (see ADR-0016).
_Avoid_: behavior plugin, runtime plugin (deployable-behavior names the install-and-it-works contract)

### Platforms and namespaces

**Claude Code distribution**:
The pair of plugins targeting the Claude Code platform — `agents-initializer` (initializer) + `agent-customizer` (customizer). Generated artifacts target `.claude/`.
_Avoid_: Claude flavor, Anthropic plugins

**Cursor distribution**:
The pair of plugins targeting Cursor — `cursor-initializer` (initializer) + `cursor-customizer` (customizer). Generated artifacts target `.cursor/`.
_Avoid_: Cursor flavor, IDE plugins

**Standalone distribution**:
The npx-installable skills under repo-root `skills/` that perform inline analysis without subagent delegation. Single distribution, no initializer/customizer split.
_Avoid_: CLI skills, plain skills

### Artifact vocabulary

**Artifact**:
One of four agent-platform configuration units — **Skill**, **Hook**, **Rule**, or **Subagent**.
_Avoid_: file, config, asset

**Skill** (Claude Code or Cursor sense):
A `SKILL.md`-rooted package with phases, references, and templates that teaches an agent how to perform a domain task.

**Hook**:
A platform-specific event handler that runs on lifecycle events. Claude Code and Cursor both have hooks, with different event models.

**Rule**:
A path- or pattern-scoped instruction file. In Claude Code, `.claude/rules/*.md` with `paths:` frontmatter. In Cursor, `.cursor/rules/*.mdc` with `description`/`alwaysApply`/`globs` frontmatter.

**Rules-first** (Cursor distribution stance):
Design posture of the Cursor distribution: `.cursor/rules/*.mdc` is the canonical surface for project conventions. AGENTS.md is recognized only as **legacy input** that the customizer's improve flow can migrate into modular rules — it is never generated.
_Avoid_: rules-only (rules-first leaves room for legacy migration; rules-only would mean ignoring AGENTS.md entirely)

**Subagent**:
A YAML-fronted agent definition spawned for delegated, isolated work. Claude Code uses `tools:`/`maxTurns:`; Cursor uses `readonly:`/`model: inherit`.

### Cursor code-documentation vocabulary

**Document-as-you-code rule**:
The single always-apply `.cursor/rules/*.mdc` (≤30 lines, language-agnostic) that instructs the agent to add language-idiomatic inline documentation (Javadoc/JSDoc/docstrings/header comments/…) whenever it writes, modifies, or creates code. It names the language→format mapping and relies on model knowledge rather than embedding format specifications. It is the *only* reliable always-on per-turn injection surface in Cursor — no hook can do this (see ADR-0016).
_Avoid_: doc hook, auto-doc hook (it is a rule, not a hook — the distinction is the ADR's whole point)

**Deferred enforcement** (Cursor doc plugin):
The decision to ship no enforcement hook in v1 of `cursor-code-documentation`. The only candidate channel, `sessionStart.additional_context`, is broken upstream (Cursor forum 158452) and redundant with the **Document-as-you-code rule**; a `stop`-hook self-review pass is the recorded working fallback; `afterFileEdit` is rejected (its script can format but cannot block the edit or feed the model, plus a batch-edit reliability bug). The path is recorded and gated on the upstream fix — not abandoned.
_Avoid_: no enforcement, enforcement dropped (it is deferred-and-gated, not removed)

**Manual-only skill** (Cursor):
A Cursor skill with `disable-model-invocation: true`, invoked solely via `/name`. The plugin's `code-explain` and `doc-generate` are manual-only — the faithful mirror of the source plugin's *commands* — so heavyweight documentation operations never auto-fire mid-edit and never compete with the **Document-as-you-code rule**.
_Avoid_: command skill, on-demand skill (manual-only names the `disable-model-invocation` contract precisely)

### Knowledge base vocabulary

**Wiki**:
The agent-maintained knowledge base under `wiki/knowledge/` — markdown pages compiled by an LLM from source documents in `docs/`, with an `index.md` table of contents and `log.md` operation log. Inspired by Karpathy's "LLM Knowledge Bases" pattern (see ADR-0004).
_Avoid_: RAG, vector store, knowledge graph

**Wiki page**:
A single `.md` file in `wiki/knowledge/` with frontmatter (Summary, Sources, Last updated) and `[[wiki-link]]` cross-references. One page per concept or per source-document summary.
_Avoid_: doc, article, note (these names are reserved for source documents in `docs/`)

**Source document**:
An immutable raw input under `docs/` (papers, vendor documentation, posts) ingested into the wiki. Never modified by agents — plays the role of Karpathy's `raw/` layer.
_Avoid_: raw, original (we keep the existing `docs/` name; renaming would break too many cross-references)

**Wiki-first lookup**:
The mandated knowledge-search order: `wiki/knowledge/index.md` → specific wiki page (via `[[link]]` or filename) → `docs/` source documents only as last resort. Replaces the prior RAG-first order (deleted in ADR-0004).
_Avoid_: wiki-only (the `docs/` fallback still exists for uncovered topics)

**Product-strict (Cursor distribution stance)**:
Branding rule for Cursor distribution artifacts: zero textual references to Claude Code, `.claude/`, `CLAUDE.md`, `tools:` whitelists, `maxTurns:`, `paths:` frontmatter, or any other Claude Code-specific construct. Vendor-neutral research (ETH study, "Lost in the Middle", "Effective Context Engineering") may be cited as "Industry Research" without product branding.
_Avoid_: claude-free, vendor-pure (these miss the product-vs-research distinction)

### HTML-structural body convention

**Skill body convention**:
The structural pattern applied to the markdown body of every `SKILL.md` (after the YAML frontmatter) and every subagent definition file (after its YAML frontmatter). Logical blocks are wrapped in **Semantic tags** drawn from the **Canonical tag vocabulary**. YAML frontmatter is untouched — it continues to follow each platform's official spec.
_Avoid_: HTML skill format, skill-as-html (the file remains `.md` / `.mdc`; only the body uses semantic tagging)

**Semantic tag**:
A custom XML/HTML element embedded inside a skill body or HTML artifact to demarcate a logical block — e.g., `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>`, `<PHASE>`. May carry standard attributes: `avoid=`, `always=`, `when=`, `name=`, `id=`, `priority=`.
_Avoid_: custom tag, structured block (semantic tag is the contract name; the others are too generic)

**Canonical tag vocabulary**:
The fixed set of semantic tags this project recognizes. **Mandatory**: `<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` containing one or more `<PHASE id="N" name="X">`. **Optional**: `<PREFLIGHT>`, `<REFERENCES>`, `<EXAMPLE>`, `<ANTI_PATTERN>`, `<OUTPUT>`, `<VALIDATION>`. The existing legacy `<RULES>` tag is an alias of `<HARD_RULES>` and is migrated on touch.
_Avoid_: tag set, tag dictionary (vocabulary is the canonical noun)

**HTML artifact**:
A full HTML5 document generated by a skill as an output deliverable (plan, PRD, design spec, report, prototype, explorer, custom editor). Carries human-facing presentation (CSS, layout, navigation) AND embedded **Semantic tags** so the next LLM session can parse the same logical structure. NEVER used for skill or subagent definitions themselves — those remain markdown-with-semantic-tags.
_Avoid_: HTML output, HTML doc (artifact is the canonical noun in this project)

**Artifact format routing**:
The rule determining whether a skill's generated output file is HTML or markdown. **HTML-default** for human-rich AND agent-executable artifacts: plans, PRDs, design specs, reports, research explainers, prototypes, code-review writeups, custom editors. **Markdown-mandatory** for two reasons — *agent-loaded* (SKILL.md, AGENTS.md, CLAUDE.md, `.claude/rules/*.md`, `.cursor/rules/*.mdc`, `wiki/knowledge/*.md`) and *tooling-locked* (commit messages, PR bodies, GitHub issues, ADRs, CONTEXT.md, READMEs, code comments). Explicit user override (`generate as markdown`) always wins.
_Avoid_: HTML-by-default, output routing (artifact format routing is the precise term)

**Tier-1 / Tier-2 / Tier-3 retrofit**:
Phased rollout of the **Skill body convention** to existing artifacts. **Tier-1** (immediate, same PRD): the 10 meta-skills (`create-skill`, `create-subagent`, `improve-skill`, `improve-subagent` in Claude Code customizer + Cursor customizer, plus `create-skill`, `improve-skill` in standalone), their `references/` + `assets/templates/`, validation criteria refs, and the three path-scoped rules (`.claude/rules/plugin-skills.md`, `standalone-skills.md`, `cursor-plugin-skills.md`). **Tier-2** (5 exemplar skills retrofitted as living references — see Convention scope below). **Tier-3** (remaining ~11 plugin + ~2 standalone skills backfilled organically when next touched).
_Avoid_: phase-1/phase-2, wave-1/wave-2 (Tier names avoid collision with the `<PHASE>` tag inside skill bodies)

**Convention scope (Skill body convention v1)**:
This PRD applies the **Skill body convention** to two surfaces only: (1) `plugins/*/skills/**/SKILL.md` and `plugins/*/agents/*.md` across all four plugin distributions, and (2) `skills/**/SKILL.md` in the standalone distribution. **Out of scope for v1**: `.claude/skills/**/SKILL.md` and `.claude/agents/*.md` in this repo (project-meta skills). If v1 succeeds, a follow-up PRD extends the convention to `.claude/` project-meta skills.
_Avoid_: full-repo scope, all-skills scope (v1 is deliberately staged)

**Tier-2 exemplars (v1)**:
The five canonical retrofitted skills demonstrating the convention to LLM authors:
1. `plugins/agent-customizer/skills/create-rule/SKILL.md` — rule-artifact authoring, Claude Code
2. `plugins/agent-customizer/skills/create-hook/SKILL.md` — hook-artifact authoring, Claude Code
3. `plugins/cursor-customizer/skills/create-rule/SKILL.md` — `.mdc` rule authoring, Cursor parity
4. `skills/init-agents/SKILL.md` — initializer pattern, Standalone
5. `plugins/agents-initializer/skills/init-claude/SKILL.md` — initializer-plugin pattern, Claude Code
_Avoid_: top-5 by size, .claude exemplars (size is uncorrelated with pattern variety; .claude is out of scope per Convention scope)

**Marketplace version cascade (PRD completion gate)**:
Every PRD that ships changes to `plugins/*/skills/**` or `plugins/*/agents/**` MUST bump (1) the affected plugin's `plugin.json` version, (2) the root Claude marketplace manifest version, and (3) the Cursor marketplace entry only when its shape changes (per `feedback_plugin_versioning_cascade` in user memory). The version-bump commit is the final atomic commit of the PRD.
_Avoid_: implicit version bumps, defer-to-release-CI (the cascade is explicit and per-PRD)

**Validation strictness (Skill body convention v1)**:
The enforcement level for canonical-tag conformance inside meta-skill self-validation loops. **Hard-fail**: missing any mandatory tag (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` with at least one `<PHASE>`); unbalanced tags; malformed attribute syntax. For subagents, `<TRIGGER>` becomes optional. **Warn**: non-canonical attribute names (typos in `avoid`, `always`, `when`, `name`, `id`, `priority`). **Silent**: absence of optional tags (`<PREFLIGHT>`, `<REFERENCES>`, `<EXAMPLE>`, `<ANTI_PATTERN>`, `<OUTPUT>`, `<VALIDATION>`).
_Avoid_: all-warn, all-hard (the tiered model balances safety and false-positive rate)

**Quality-gate content scope (v1)**:
The four quality-gate skills in `.claude/skills/` (`agent-customizer-quality-gate`, `cursor-customizer-quality-gate`, `cursor-initializer-quality-gate`, `quality-gate`) are out of scope for **Skill body convention** body-format retrofit but in scope for **content** updates that teach them to assert the new convention against plugin/standalone targets. Their own bodies remain markdown without semantic tags until a follow-up PRD.
_Avoid_: quality-gate refactor, gate-body retrofit (only the *checked-for* clauses change in v1, not the gate's own body)

### Orchestrate run vocabulary

**Orchestration run**:
One end-to-end execution of the `orchestrate` plugin over a single backlog partition — dependency-ordered waves, slice worktrees, an umbrella branch, and a final integration pull request.
_Avoid_: job, batch, orchestration session

**Run partition**:
The subset of the `ready-for-agent` backlog one run owns — the child issues of a single parent PRD, selected by `/orchestrate <PRD#>`. A no-argument run owns the whole backlog as one partition.
_Avoid_: backlog slice, batch (slice is reserved for a single issue's work)

**Run directory**:
The per-run `.orchestrate/runs/<runId>/` directory holding that run's ephemeral state — the run-state checkpoint, the context-flag, and rendered HTML artifacts. Gitignored; the committed config files stay at the `.orchestrate/` top level.
_Avoid_: run folder, state dir

**runId format**:
A run's identifier in one of two minted forms — `prd<N>-<timestamp>` for a partitioned run scoped to PRD `<N>`'s children (`/orchestrate <PRD#>`), and `backlog-<timestamp>` for a no-argument whole-backlog run. The `prd<N>-` / `backlog-` prefix is durable, persisted in `run-state.json`, and is the match key the startup scan parses to decide which in-progress run a re-invocation resumes. It also flows into the **Run directory** path and the umbrella branch name, keeping two concurrent runs disjoint.
_Avoid_: timestamp id, run name (the prefix is load-bearing, not decoration)

**Driver session**:
The Claude Code session executing a run's orchestrator. Its `session_id` is recorded in `run-state.json` as the `driverSessionId` field — captured by the orchestrate `SessionStart` hook into `$ORCHESTRATE_SESSION_ID`, written on run start, and refreshed on resume (a successor session has a new `session_id`). The global `context-watchdog` matches `driverSessionId` against in-progress runs to bind itself to the correct run when several runs proceed concurrently; when it cannot disambiguate, or when `driverSessionId` is `null` (identity unavailable), it safely no-ops and the run loses only automatic context-handoff.
_Avoid_: orchestrator window, owner session

**Integration base**:
The branch every umbrella branch is cut from and every run's final pull request merges back into — `development` in this repository.
_Avoid_: main, master, trunk (the integration base is `development`, distinct from any release branch)

**Run cleanup**:
Removal of a concluded run's run directory, worktrees, and umbrella/slice branches — gated on that run's final integration pull request having been merged into the **Integration base**. Automatic start-of-run sweeps and `/orchestrate clean` (including `--force`) are **status-gated** — they never touch an `in-progress` run. `/orchestrate clean --failed <runId>` is the sanctioned **human-gated single-run override** that bypasses the status gate for one named crashed/`in-progress`-looking run (via the `reclaim_run` MCP tool), scoped by construction to that run and protected only by a mandatory interactive confirmation.
_Avoid_: purge, garbage collection, prune

**Pre-flight pass** (`/orchestrate preflight <PRD#>`):
The third orchestrate mode — alongside the normal run and **Run cleanup** — that performs a run's one-time setup (config bootstrap, backlog fetch, **Run partition**, wave planning, umbrella branch, and the first validated `run-state.json` checkpoint), then **probes the capability gate** — executing the install step and each configured verb once in a throwaway dependency-free detached checkout, and reporting each verb as passed, failed, broken configuration, or not configured — and then **stops before the wave loop**, leaving an `in-progress` run whose slices are all `pending` and `completedWaves: 0` — so the operator can review the partition, the wave plan, and what the gate will actually verify at the checkpoint before committing the expensive wave loop. The probe runs **after** the checkpoint is written, so a failing probe reports loudly without blocking resumption; it creates no branch and removes its checkout. A later `/orchestrate <PRD#>` in a fresh session resumes from that checkpoint via the unchanged exactly-one-match resume path — no new resume semantics. Its value is this **staged-inspection gate**, not token relocation (post-#293 the bootstrap residue it shifts is ~2% of a ~1M execution window). The pass is **detect-and-stop**: when a run already exists for PRD `<N>` it reports that run's state and stops rather than re-deriving scope, entering the wave loop, or creating a duplicate (so a concluded-but-uncleaned run blocks a re-bootstrap until `/orchestrate clean`). Distinct from the **Config bootstrapper** (`bootstrap_config`), which is only the first setup step of the pass; the pre-flight pass is the whole steps-1–6 setup that ends at the resumable checkpoint. The pass is an orchestrator mode, never a privileged subagent — see ADR-0014.
_Avoid_: bootstrap, bootstrap mode (bootstrap names the `bootstrap_config` config step, not the whole pre-flight pass)

**Backlog partitioner**:
The pure module (`src/tools/backlog-partitioner.ts`) that splits the fetched `ready-for-agent` backlog into the run's `slices` set and the resolved `parentIssue`. It is the single canonical answer to "which issues are slices, and which is the parent PRD". Two detection signals are applied in order: (1) parent-field reference — any issue named as another backlog issue's `Parent`; (2) the `PRD:` title heuristic — any backlog issue whose title starts with `PRD:` (case-insensitive), catching a parent PRD that child issues have not yet linked via their `Parent` field. The detected parent PRD is excluded from `slices` and surfaced as `parentIssue`; it is only a progress-comment target, never an implementation slice.
_Avoid_: backlog filter, issue splitter

**Parent PRD**:
The single parent issue detected by the **Backlog partitioner** for a run — either via parent-field reference or the `PRD:` title heuristic. Recorded as `parentIssue` in `run-state.json`. Its only role during a run is as the target for wave-progress comments (`gh issue comment <parentIssue>`); it is never enrolled as a slice. `null` when no parent is detected.
_Avoid_: umbrella issue, epic (epic is an unrelated concept)

**PRD: title heuristic**:
Secondary signal used by the **Backlog partitioner** when no explicit parent-field reference exists: any backlog issue whose title starts with `PRD:` (case-insensitive) is treated as the **Parent PRD**. Catches a decomposed PRD that appears in the backlog before child issues have been created or before children have their `Parent` field set.
_Avoid_: title matching, title filter

**filterToOneParentPrd**:
The exported function in `backlog-partitioner.ts` that narrows the full backlog to the child issues of a single parent PRD number (matching `parent === prdNumber`). Used to scope a `/orchestrate <PRD#>` run to one **Run partition**. The parent PRD issue itself is excluded from the result.
_Avoid_: backlog filter, PRD filter (too generic)

**Capability detector** (`detect-project` module):
A pure module in `orchestrate-mcp/src/tools/detect-project.ts` that inspects a repository root's top-level manifest files and returns the **Capability command map** for the detected project type. Input: a repository root path. Output: a command map or empty object. No side effects. Detection precedence: npm (`package.json`) > Cargo (`Cargo.toml`) > Python (`pyproject.toml`) > Maven (`pom.xml`) > Gradle (`build.gradle` / `build.gradle.kts`) > Make (`Makefile`) > none. A repository with no recognized manifest yields an empty map — never a fallback npm map.
_Avoid_: project sniffer, auto-configurator, manifest scanner

**Capability command map**:
A plain object with the four auto-detected capability verb keys (`tests`, `typecheck`, `build`, `lint`), each mapping to an argv array consumed directly by the orchestrate run tools. Produced by the **Capability detector**. The `install` verb is never included — that is a setup verb, not a capability verb. `commands.json` also accepts an optional, never-auto-detected `integration` capability verb: a heavy per-wave suite (e.g. Testcontainers/failsafe) the run tools execute once per wave against the umbrella tip, distinct from the four fast per-slice verbs. It is hand-authored only when a project ships such a suite and is **not** produced by the detector (`buildCommandsConfig` omits it). `commands.json` also accepts an optional non-capability `knownFailures` key: a list of substring/regex patterns the run tools match against the captured output of a *failing* capability command to annotate matched-vs-unmatched baseline failures (a best-effort hint); like `install` it is never executed and is not produced by the detector. For unrecognized project types the map is empty (`{}`).
_Avoid_: command config, verb table, command dictionary

**Config bootstrapper** (`bootstrap_config` MCP tool):
The integration module (`orchestrate-mcp/src/tools/bootstrap-config.ts`) that makes an orchestrate run set up its own `.orchestrate/` configuration. It composes the **Capability detector** to write a project-aware `commands.json`, derives `handoff.json`'s context-window size from the running model (passed as a tool input, since the MCP process cannot see the calling model — unknown or absent falls back to 200000), writes `routing.json` from shipped defaults, creates the **Run directory** parent `.orchestrate/runs/`, and idempotently appends `.orchestrate/runs/` to the target repository's `.gitignore`. Every step is individually idempotent — a committed config file is never overwritten.
_Avoid_: config generator, init tool, setup wizard

**Result envelope**:
The machine-checkable structured result every orchestrate subagent emits as the last of its turn — a fenced ` ```orchestrate-envelope ` JSON block conforming to a per-role schema (a `discriminatedUnion` on `role`). Worker roles (implementer, reviewer, conflict-resolver) carry `status`, `filesChanged`, `verification`, and `notes`; the read-only investigator carries a research brief and no `status`/`filesChanged`. It is the orchestrator's only source of a subagent's status and changed-file set — the orchestrator never parses subagent prose.
_Avoid_: result blob, subagent summary, return payload

**Capability gate**:
The orchestrator's own pre-merge run of `run_build` + `run_tests` on a slice worktree — section 3 step 5a — after a `passed` reviewer and before any commit, push, or GitHub state exists. Independent of the reviewer's `verification` self-report in the **Result envelope**: it is the deterministic final link in the `implementer → reviewer → orchestrator` trust chain. Runs exactly the two correctness verbs (`typecheck`/`lint` stay the reviewer's quality remit); `not-configured` is tolerated as a pass, while `failed`/`error` fails the slice.
_Avoid_: merge check, verification gate

**Empty-config false-green**:
The silent failure mode at the **Capability gate**: a project whose manifest the **Capability detector** does not recognize gets an empty `commands.json` (`{}`), every verb resolves to `not-configured`, the gate tolerates that as a pass, and a slice merges green although its `build`/`tests` never ran. The clean degradation is intentional — a missing capability is never wired to a guaranteed-to-fail command — so the defect is not the degradation but its *silence*: nothing tells the operator the gate became a no-op. The conceptual remedy is to make an empty config **loud** at bootstrap rather than to keep widening the detector.
_Avoid_: false-pass, silent-skip (false-green names the merge-state lie specifically — the slice reports green)

**Skeleton-first slice**:
A slice whose own work creates the project's build manifest — e.g. the first slice of a docs-first/TDD repo writes the initial `pom.xml`/`build.gradle`. Because the manifest is absent when the **Config bootstrapper** runs, a present-tense detector probe finds nothing at bootstrap; the manifest exists only in the worktrees of later slices. This is why bootstrap-time detection alone cannot gate such a repo, and why a loud **Empty-config false-green** signal — not merely a broader detector — is the general safeguard.
_Avoid_: bootstrap slice, scaffold slice (skeleton-first names the temporal property: the manifest is created by the work, not pre-existing)

**Implementer `incomplete` status**:
The third value of the implementer **Result envelope**'s `status` enum — alongside `completed` and `blocked`, and unique to the implementer role. It is the implementer's *graceful* turn-budget self-report: when the implementer foresees it cannot finish every acceptance criterion within its remaining turns, it stops cleanly and emits `status: "incomplete"` with the partial work recorded, rather than being cut off mid-sentence. Distinct from `blocked` (an unrecoverable obstacle — more turns would not help) and from a hard turn-limit cutoff (which truncates the envelope into an unclosed fence the **Envelope validator** reports `invalid`). A single `incomplete` does **not** FAIL the slice immediately: the envelope carries a `remainingWork` handoff, and the orchestrator re-spawns the implementer in the same preserved worktree — the bounded continue-in-place loop — until it returns `completed` or the run-wide continuation budget is exhausted. The slice FAILs from `incomplete` only when the budget runs out (resumable → `needs-info`) or a continuation makes no worktree progress (the no-progress guard → `needs-triage`). It is never a new `run-state.json` slice `state` value — the continuation counter and fingerprint are within-session loop state, never persisted.
_Avoid_: partial status, timed-out status (it is a proactive self-report, not a passively-observed timeout)

**Changeset scope check**:
The orchestrator's post-implementer verification, the `verify_changeset` MCP tool, run after every implementer returns and before a `completed` envelope is trusted. It inspects the slice worktree directly with `git status` and compares the implementer's declared `filesChanged` against what actually changed on disk, returning a `match` verdict — `matched`, `clean`, `mismatch`, `empty-but-declared` (the implementer's edits never landed), or `suspiciously-empty` (the work was under-reported). It is a cheap set comparison, not a semantic scope check: it never parses the issue body and never judges whether the changed files are the *right* files.
_Avoid_: scope validator, diff checker (it compares declared-vs-actual file sets, it does not validate semantic scope)

**Envelope validator**:
The deterministic `validate_envelope` MCP tool that classifies a subagent's returned text into exactly one of `valid` (a schema-conforming envelope for the expected role), `invalid` (an envelope was attempted but is truncated, malformed, or off-schema), or `missing` (no envelope block found). A truncated envelope is always reported `invalid`, never silently accepted.
_Avoid_: envelope parser, schema checker (validator is the contract name; it classifies, it does not merely parse)

**Worktree fallback**:
The orchestrator's recovery path, the `recover_changed_files` MCP tool, for when a subagent's **Result envelope** is missing or invalid: it inspects the slice worktree directly with `git status` and returns the full changed-file set (build artifacts included), treating the worktree as the source of truth. Applies to the implementer, reviewer, and conflict-resolver only — the read-only investigator leaves no worktree changes to recover.
_Avoid_: git-status recovery, changed-file scan (worktree fallback is the precise term — it is the fallback, not the primary path)

**Subagent advisor policy** (superseded):
Originally the decision that no orchestrate subagent consults an advisor, advisor passes belonging to the **orchestrator boundary** instead. Two findings superseded it. Mechanically it was never enforceable: the runtime injects the `advisor` tool into every subagent regardless of its `tools:` frontmatter, and the tool survives an explicit `disallowedTools: advisor`. In intent it no longer holds either — subagent advisor use is accepted, because enabling the advisor feature is the operator's choice, so a subagent that calls it stays within what the operator switched on. The `## Advisor policy` section in each definition, and its `-standard`/`-deep` parity, therefore record a preference rather than a boundary. See ADR-0009, pending a wording correction.
_Avoid_: no-advisor rule, advisor ban (there is no enforced prohibition — the frontmatter never produced one)

**Investigator scope guard**:
The standing constraint — expressed as a `## Scope-boundary guard` section in both `investigator-standard.md` and `investigator-deep.md` — that limits the investigator's brief to work traceable to the slice's acceptance criteria. Every item in `relevantFiles`, `approach`, and `notes` must trace to at least one acceptance criterion; work belonging to a sibling or downstream slice must be dropped. Enforced at the orchestrator boundary by a brief-scope diff: after `validate_envelope` returns `valid`, the orchestrator compares the brief against the acceptance criteria it supplied as the hard scope boundary, and treats an over-scoped brief as a failed investigation pass (the slice **FAILS** before the implementer runs).
_Avoid_: scope check, brief filter (the guard is a positive constraint on what the brief may contain, enforced at two points — inside the investigator definition and at the orchestrator boundary)

**Orchestrator judgment spine**:
The irreducible body of the orchestrate `SKILL.md` that remains after **MCP-first decomposition** — the roles & safety boundary, the two-axis complexity-tier assessment, wave-concurrency policy, the slice-executor briefing contract, failure-cause narration, the read boundary on slice-internal artifacts, and checkpoint/resume semantics. It is the residue that cannot be extracted to an `orchestrate-mcp` tool or a subagent because it is non-mechanizable orchestration judgment. The #275 procedural-prose relocation refined it to ~425 lines — down from the ~750 the decomposition first projected — but the ADR-0017 delegation then moved the intra-slice procedure out to the slice executor while adding the briefing contract, the structured envelope-recovery path, and the read boundary, leaving the spine at **542 lines of body**. It therefore *exercises* the documented over-cap exception recorded in ADR-0013, explicitly and at that measured figure, rather than merely holding it in reserve; the exception is orchestrate-specific (not generalized to other skills). Deterministic procedure is extracted to MCP tools (no execution-permission prompt); judgment-bearing procedure is relocated to on-demand `references/` (loaded only when its phase runs, outside the smart zone); only judgment stays in the always-loaded spine. See ADR-0013.
_Avoid_: orchestrator core, skill body (the spine is specifically what remains after extraction, not the whole file or its runtime)

**Routing variant**:
The `-standard` / `-deep` flavor of a subagent definition that per-role routing selects (`orchestrate:<role>-<variant>`). Renamed from `routing.json`'s legacy `effort` key precisely because it is **not** the **Subagent effort level** — it picks which definition file is spawned.
_Avoid_: effort (in routing context — the collision this rename removes), depth (tier names complexity; variant names the definition flavor)

**Subagent effort level**:
The real Claude Code `effort` frontmatter value (`low`/`medium`/`high`/`xhigh`/`max`) fixed in each subagent definition. It cannot be set per spawn invocation, so it lives in the definition file — never in `routing.json`.
_Avoid_: thinking budget, routing effort

**Routing label**:
A human-applied GitHub label (`route:*`) on a slice issue that overrides the **Resolved slice routing** for named roles — e.g. `route:fable` promotes the implementer to the premium model. The orchestrator may *suggest* a routing label in reports but never applies one; a label with no matching routing-config entry warns loudly, and two configured labels patching the same role is an error — never a silent merge.
_Avoid_: model label, tier label (tiers are orchestrator judgment; routing labels are human gates)

**Resolved slice routing**:
The per-slice routing outcome (model, variant, fallback) frozen into the `run-state.json` checkpoint when the slice is created. Routing labels are read exactly once, at slice creation — a resumed run routes from the checkpoint, never from live GitHub labels, preserving the resume invariant that a run never re-derives its own scope.
_Avoid_: live routing, label re-read

**Model fallback**:
The one-time re-spawn of a role on its configured fallback model after the premium model fails (safety-classifier refusal or model unavailability), recorded on the slice's **Resolved slice routing** and not counted against the continuation budget — continuation re-spawns the *same* model for incomplete work; fallback *swaps* the model.
_Avoid_: retry, continuation (different budget, different semantics)

**Slice executor**:
The subagent that owns one slice from end to end — investigation, implementation, review, and the **Capability gate** — and returns a single validated **Result envelope**. It sits between the orchestrator and the worker roles, which it spawns itself. It holds no git, forge, or tracker authority: everything downstream of a verified changeset (commit, push, pull request, merge, labels) stays with the orchestrator. It decides *how* a slice is produced, never *which* slice comes next — ordering and termination stay computed from the wave plan, and the briefing it returns for the following slice is advice, not selection. See ADR-0017.
_Avoid_: task-executor (task collides with the harness's own task tools, and **slice** is the reserved noun for one issue's work), dispatcher, coordinator

**Slice progress record**:
The per-slice record a **Slice executor** writes at each completed stage, and the anchor an interrupted slice resumes from. It preserves the resume granularity that per-transition `subState` writes give today, now that one executor spawn spans several stages. The executor owns the record and reads it back to resume itself; the orchestrator never opens it, obtaining its contents only through a dedicated MCP tool when an envelope is missing or invalid — the same structured-recovery path as the **Worktree fallback**. It also carries the once-only **Model fallback** guard, which is why that guard survives a handoff without living in the orchestrator's checkpoint.
_Avoid_: slice state, slice checkpoint (the run-state checkpoint is the orchestrator's; this record is the executor's)

**Read guard**:
The plugin-level `PreToolUse` **Hook** that mechanically denies the orchestrator a read of a slice-internal artifact — the **Slice progress record** and the slice report — and returns a reason naming the correct behaviour instead. It tells the orchestrator from a subagent by the agent identity the hook event carries, is scoped to `Read` and `Bash`, and is a silent no-op with no run in progress. It is **defence in depth for the prose rule, never a replacement**: policy can disable plugin hooks, and `@`-referenced files reach the model without any tool call at all, so the boundary stated in the orchestrator's own instructions stays load-bearing. See ADR-0017.
_Avoid_: read block, permission rule (a permission rule was the rejected alternative — it would restrict the executor too and carries no corrective message)

**Failure class**:
The closed enum a **Slice executor** returns naming *why* a slice failed, alongside the prose failure reason. It exists because the layer holding the evidence and the layer holding tracker authority are no longer the same one: the executor observes the failure and classifies it, and the orchestrator maps the class to a triage label and writes it. Classification follows the evidence; labelling policy stays with the single writer.
_Avoid_: failure reason (that is the prose companion, not the enum), error code

## Relationships

- A **Distribution** owns at most one **Initializer** and at most one **Customizer**.
- An **Initializer** generates platform-wide files; a **Customizer** generates individual **Artifacts** of the four supported types.
- The **Claude Code distribution** and the **Cursor distribution** are siblings — same conceptual roles, different platform formats and conventions.
- A **Deployable-behavior plugin** ships its **Artifacts** (a rule plus skills) for direct consumption on install, where the **Initializer** and **Customizer** instead *generate* artifacts into a target project. The three roles coexist within one **Distribution**.
- A **Source document** in `docs/` is summarized into one **Wiki page** in `wiki/knowledge/`; one Source document may also seed multiple concept Wiki pages with `[[wiki-link]]` cross-references.
- The **Wiki** is the canonical knowledge surface for agents; **Source documents** are searched only when the wiki lacks coverage.
- The **Standalone distribution** sources from the cross-platform standard alone (platform-agnostic docs, filtered to skills and AGENTS.md authoring); plugin distributions source from their platform's docs plus the standard. See ADR-0006.
- A **Skill body convention** is composed of one or more **Semantic tags** drawn from the **Canonical tag vocabulary**.
- A **Semantic tag** is a syntactic construct; the **Canonical tag vocabulary** is the closed set this project recognizes.
- An **HTML artifact** carries one or more **Semantic tags** plus presentation chrome (CSS, layout, navigation) — the tags make it agent-parseable; the chrome makes it human-readable.
- **Artifact format routing** decides between an **HTML artifact** and a markdown artifact based on whether the consumer is *agent-loaded* / *tooling-locked* (markdown) or *human-rich + agent-executable* (HTML).
- **Tier-1**, **Tier-2**, and **Tier-3 retrofit** carve up the set of files subject to **Convention scope (v1)** by urgency, not by location.
- An **Orchestration run** owns exactly one **Run partition** and writes its ephemeral state to exactly one **Run directory**.
- Sibling **Orchestration runs** in the same repository must own disjoint **Run partitions** — one parent PRD's children each.
- A **Driver session** executes exactly one **Orchestration run**; the context-watchdog binds a run by matching the **Driver session** identity recorded in run-state.
- **Run cleanup** acts on an **Orchestration run** only after its final pull request has merged into the **Integration base** — except the human-gated `/orchestrate clean --failed <runId>` override, which reclaims one crashed run by bypassing that status gate under interactive confirmation.
- A **Pre-flight pass** writes the first validated checkpoint of an **Orchestration run** and stops before the wave loop; a later `/orchestrate <PRD#>` resumes that run via the unchanged exactly-one-match path. The pass is **detect-and-stop** — it reports and refuses when a run for that PRD already exists, so it never re-derives an existing **Run partition** nor enters the wave loop itself.
- Every orchestrate subagent returns exactly one **Result envelope**; the **Envelope validator** classifies it, and the orchestrator acts only on that classification — never on subagent prose.
- The **Worktree fallback** runs only when the **Envelope validator** reports a worker subagent's **Result envelope** `invalid` or `missing` — it never substitutes for a `valid` envelope.
- The **Changeset scope check** runs after every implementer returns a `valid` `completed` envelope — it cross-checks the declared `filesChanged` against the worktree before the orchestrator trusts the result; the **Worktree fallback** instead runs only when the envelope itself was `invalid` or `missing`.
- The **Implementer `incomplete` status** is the graceful counterpart to a hard turn-limit cutoff: the cutoff truncates the envelope into an `invalid` classification that FAILs the slice at once, while `incomplete` is a clean, schema-conforming self-report that drives the bounded continue-in-place loop — re-spawning the implementer in the same worktree with its `remainingWork` until `completed` or the continuation budget is exhausted. It FAILs the slice only on budget exhaustion (`needs-info`) or the no-progress guard (`needs-triage`).
- The **Orchestrator judgment spine** is what survives **MCP-first decomposition** of the orchestrate `SKILL.md`: deterministic procedure leaves to `orchestrate-mcp` tools, judgment-bearing procedure to on-demand `references/`, and only non-mechanizable judgment remains in the always-loaded body. Native Claude Code orchestration features (dynamic workflows, goals, agent teams, worktrees) were evaluated as an alternative execution path and **not adopted** — each is inferior to or architecturally mismatched with the spine's bespoke, durable, slice-scoped core (see ADR-0013).

## Example dialogue

> **Dev:** "If I want to create a new path-scoped rule inside an already-set-up Cursor project, which plugin runs?"
> **Domain expert:** "The **Cursor customizer** — `cursor-customizer:create-rule`. The **Cursor initializer** would only run on a project without existing Cursor configuration."

> **Dev:** "I'm authoring a new SKILL.md. Where does the `## Hard Rules` heading go now that we have the new **Skill body convention**?"
> **Domain expert:** "It moves inside a `<HARD_RULES priority=\"hard\">` block — that's a **Semantic tag** from the **Canonical tag vocabulary**. The skill body stays markdown; only the section boundary changes from a heading to a tag the validator can address."

> **Dev:** "When `create-skill` generates a new skill whose job is to produce an implementation plan, does the *plan* end up as `.md` or `.html`?"
> **Domain expert:** "HTML — that's the default per **Artifact format routing** for a human-rich AND agent-executable artifact. The generated HTML carries the same **Canonical tag vocabulary** inside, so the next session parses it the same way it parses a SKILL.md body. The skill itself stays `SKILL.md`."

> **Dev:** "Can I run `/orchestrate` in two windows against the same repository?"
> **Domain expert:** "Yes — as long as each is an **Orchestration run** over a distinct **Run partition**. Pass `/orchestrate <PRD#>` per window so each owns one parent PRD's children. With no argument a run takes the whole backlog as a single partition, and a second concurrent run would collide on it."

## Flagged ambiguities

- "Cursor CLI" was used by the user to mean the full Cursor distribution surface (IDE + CLI share the `.cursor/rules/` system). Resolved: in this repo, **Cursor distribution** covers both surfaces — they consume the same artifact files.
- "knowledge base" was historically used to mean the RAG vector store registered as the `rag-knowledge-base` MCP server. Resolved as of ADR-0004: **Wiki** is the canonical knowledge base; the RAG layer is deleted.
- "HTML in skill body" was used by the user to mean *both* (a) the semantic-tag-inside-markdown pattern and (b) replacing `SKILL.md` with `.html` files. Resolved during grilling (ADR-0007): only (a) is adopted; **Skill body convention** keeps `SKILL.md` as a `.md` file (Agent Skills spec compliance) and embeds tags inside the markdown body.
- Legacy `<RULES>` tag (currently used in `plugins/agent-customizer/skills/create-skill/SKILL.md` and elsewhere) is treated as an alias of canonical `<HARD_RULES>`. Tier-3 organic retrofit migrates each occurrence on next touch; no scheduled mass rename.
- "two orchestrations" was used to mean two concurrent **Orchestration runs** in the *same* repository — resolved: each run must own a disjoint **Run partition** (one parent PRD's children); same-repo runs over an unpartitioned backlog collide on the identical issue set.
- "merged into main/master" was used for the **Run cleanup** gate — resolved: the gate is the run's final pull request merged into the **Integration base** (`development`), not a release branch. The plugin name and its directory are spelled `orchestrate` / `.orchestrate` (not `orquestrate`).
- "bootstrap" was used to mean *both* the `bootstrap_config` step (writes `.orchestrate/` config) and the whole one-time pre-flight setup (steps 1–6, ending at the resumable checkpoint) — issue #286 used the second sense. Resolved during grilling: "bootstrap" / **Config bootstrapper** names only the config step; the whole setup pass is the **Pre-flight pass** (`/orchestrate preflight <PRD#>`), a distinct mode word chosen to avoid overloading `bootstrap_config` and to stay clear of the `prime-issues` namespace.
- "use the native dynamic-workflows / goals / worktrees features in orchestrate" was the user's hypothesis for shrinking the orchestrator's context footprint and using the native runtime — resolved during grilling (ADR-0013): native features are evaluated and **not adopted**. Each is inferior to or architecturally mismatched with orchestrate's durable, slice-scoped, checkpoint-backed core (worktrees are session-scoped / per-subagent-ephemeral vs. the run's slice-scoped-shared worktree; goals evaluate only the conversation surface and cannot ride `spawn_successor`'s single positional prompt; dynamic workflows reset on session exit and are redundant with the envelope-only delegation orchestrate already does; agent teams are experimental, env-gated, and do not resume in-process). Context reduction comes from **MCP-first decomposition** into the **Orchestrator judgment spine**, not from native adoption. The "alternative, not replacement" requirement is satisfied by adopting zero (nothing to capability-detect or alternate).
- "task-executor" was the proposed name for a subagent owning one slice end to end, and "LOOP END / LOOP CONTINUE" its return status — both resolved during grilling (ADR-0017). The role is the **Slice executor**: "task" collides with the harness's own task tools, while **slice** is already this glossary's reserved noun for one issue's work. The loop vocabulary was dropped because termination is computed from wave exhaustion, not declared by the executor — a `loop-end` status would encode an authority the executor does not hold, so it returns the existing envelope statuses describing the *slice* instead. Two further premises of the same proposal were **falsified empirically**, not merely renamed: subagents *can* spawn subagents (the repository's vendor mirror said otherwise and was re-synced), and `effort` is *not* parametrizable per spawn (it is frontmatter-only, which is why the **Routing variant** pair exists).
- "a Cursor hook that injects documentation instructions into the system prompt" was the user's initial mechanism for document-as-you-code — resolved during grilling (ADR-0016) against live-verified evidence: **no Cursor hook injects per-turn system-prompt guidance**. `sessionStart.additional_context` is broken (forum 158452) and one-shot even when fixed; `beforeSubmitPrompt` can only block; `afterFileEdit` only runs after the fact and cannot feed the model. The always-apply **Document-as-you-code rule** is the mechanism; enforcement via hook is **deferred-and-gated**, not adopted in v1.
