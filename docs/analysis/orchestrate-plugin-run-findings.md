# Orchestrate Plugin — Run Findings Log

**Purpose.** This document records every error, defect, friction point, and
improvement opportunity observed while running the `orchestrate` plugin
end to end. It is an incremental log: new findings are appended as the run
progresses. It exists to feed a later improvement plan for the orchestrate
plugin — so each entry captures the *symptom*, the *root cause*, the
*mitigation applied to keep the run going*, and a *concrete recommendation*.

## Run context

| Field | Value |
|-------|-------|
| Plugin | `orchestrate` v1.0.1 (`~/.claude/plugins/cache/agent-engineering-toolkit/orchestrate/1.0.1`) |
| Invoked | `/orchestrate:orchestrate` (no arguments) |
| Repository | `agent-engineering-toolkit` (multi-plugin marketplace of Markdown skills) |
| Run id | `20260521-201015` |
| Date | 2026-05-21 |
| Backlog | PRD #143 decomposed into 9 slices (#144–#152) |
| Umbrella branch | `orchestrate/umbrella-20260521-201015` |
| Orchestrator model | Opus 4.7 (1M context) |
| Waves | 7 — `[[144],[145,146],[147],[148,149],[150],[151],[152]]` |

## Severity legend

- **High** — would corrupt the run or its output if not caught (wrong work
  produced, data loss, unrecoverable state).
- **Medium** — blocks or degrades the run until a workaround is applied;
  recoverable but costs time and requires operator judgement.
- **Low** — quality or ergonomics issue; run proceeds, but the result or the
  operator experience is worse than it should be.

Each finding also notes whether it is a **plugin defect** (bug in code or
shipped templates), a **skill-instruction defect** (the `SKILL.md` text is
wrong or incomplete), or a **design gap** (the plugin behaves as written, but
the design leaves a sharp edge).

---

## F-001 — Orchestrate config files absent; plugin offers no bootstrap

- **Severity:** Medium
- **Type:** Design gap
- **Phase:** Section 1 — prerequisites / fresh-run setup

**Symptom.** The target repository had no `.orchestrate/` directory at all —
no `commands.json`, no `routing.json`, no `handoff.json`. The skill's
prerequisites state the project "should have committed" `commands.json` and
`routing.json` (from the plugin's `templates/`), but the skill provides no
mechanism to get them there.

**Cause.** The orchestrate plugin ships the three templates under its own
`templates/` directory but has no install/bootstrap step: no setup
subcommand, no first-run detection, and the skill does not offer to copy
them. Any first-ever run on a repo hits this. The skill *tolerates* missing
config (documented fallbacks) but tolerating is not the same as bootstrapping.

**Mitigation.** Manually created `.orchestrate/`, copied `routing.json`
verbatim from the template, copied `handoff.json` with one edit (see F-002),
and deliberately omitted `commands.json` (see F-003).

**Recommendation.** Add a real bootstrap path: either a `/orchestrate-init`
subcommand, or have the skill detect the missing `.orchestrate/` directory on
a fresh run and offer to copy the templates (project-type-aware — see F-003).
Document the templates' filesystem location and an exact copy command in the
skill prerequisites.

---

## F-002 — `handoff.json` template hardcodes a 200k context window

- **Severity:** Medium
- **Type:** Plugin defect (shipped template) / design gap (watchdog)
- **Phase:** Section 1 — config setup

**Symptom.** The `handoff.json` template sets
`watchdog.contextWindowTokens: 200000`. The orchestrator session runs on
Opus 4.7 with a 1M-token context window. With `thresholdPercent: 40`, the
context-watchdog would write the handoff flag at roughly 80k tokens — under
10% of the real window — forcing a successor session every one or two slices
and shredding the run into many short-lived sessions.

**Cause.** The template assumes a fixed 200k-token model. The value is a
static config constant, not derived from the actual running model's context
window.

**Mitigation.** Edited `contextWindowTokens` to `1000000` before installing,
so the watchdog trips near a realistic ~400k tokens.

**Recommendation.** The context-watchdog should read the actual model context
window at runtime instead of trusting a static config value; failing that,
the skill should set `contextWindowTokens` from the detected model during
bootstrap. At minimum, document loudly that this value must match the
operator's model or handoffs will fire far too early.

---

## F-003 — `commands.json` template is npm-only; breaks non-JS repos

- **Severity:** Medium
- **Type:** Plugin defect (shipped template)
- **Phase:** Section 1 — config setup

**Symptom.** The `commands.json` template hardcodes `npm test`,
`npm run typecheck`, `npm run build`, `npm run lint`. The target repository is
a Markdown skill marketplace with no `package.json` anywhere in the tree.
Installing the template verbatim would make every capability tool
(`run_tests`, `run_typecheck`, `run_build`, `run_lint`) spawn a failing `npm`
process on every slice.

**Cause.** The template is hardwired to the JavaScript/npm ecosystem with no
project-type detection. The plugin assumes its target is an npm project.

**Mitigation.** Deliberately did NOT install `commands.json`. With the file
absent, the capability tools return `not-configured`, which the skill
explicitly tolerates as a clean degradation. Real per-slice verification on
this repo comes from each meta-skill's own fixture-corpus validation loop, not
the generic capability tools — so nothing of value was lost.

**Recommendation.** Make the template project-type-aware: detect
`package.json` / `Cargo.toml` / `pyproject.toml` / `Makefile` / none, and emit
the matching commands (or an empty object). Ship `commands.json` empty or
fully commented by default. Key principle: a `not-configured` capability is
safe; a capability wired to a command that always errors is worse than none.

---

## F-004 — Backlog query does not exclude the parent PRD

- **Severity:** High
- **Type:** Skill-instruction defect / design gap
- **Phase:** Section 1, steps 2–3 — read the backlog

**Symptom.** `gh issue list --label ready-for-agent --state open` returned
**10** issues: the 9 implementable slices (#144–#152) **plus #143, the parent
PRD itself**, which also carries the `ready-for-agent` label. The skill's
backlog definition is "every open issue with the `ready-for-agent` label",
which would enrol #143 as a tenth slice.

**Cause.** The skill identifies the parent PRD from each slice's `Parent:`
section in order to set `parentIssue`, but it never excludes an issue that is
*itself* named as that parent. A PRD that is labelled `ready-for-agent` and
has been decomposed into child slices is, to the query, indistinguishable
from a slice.

**Impact if unmitigated.** An implementer subagent would receive the entire
PRD #143 body and attempt to build all nine workstreams inside one worktree —
duplicating every slice's work and guaranteeing umbrella-merge conflicts. This
is the most dangerous finding so far: it silently produces wrong, conflicting
work rather than failing loudly.

**Mitigation.** Excluded #143 from the `slices` set; recorded it only as
`parentIssue: 143`. It still receives per-wave progress comments. Flagged for
manual re-triage at run end (the orchestrator must not relabel issues outside
its documented tracker protocol).

**Recommendation.** Add an explicit backlog-filtering step: any issue that is
named in another backlog issue's `Parent:` section is a PRD, not a slice —
exclude it from `slices` and use it as `parentIssue`. Optionally also exclude
issues whose title begins with `PRD:` as a secondary heuristic.

---

## F-005 — `create_worktree` internal `git fetch` fails with an empty command

- **Severity:** Medium
- **Type:** Plugin defect (MCP server)
- **Phase:** Section 3, step 1 — create worktree (slice #144)

**Symptom.** `create_worktree` returned `status: "ok"` but
`fetchStatus: "failed"` with
`fetchError: "error: cannot run : No such file or directory"`. The error
string has an empty token between `run` and `:` — the fetch subprocess was
spawned with an empty/unresolved git executable path.

**Cause.** Inside the MCP server process, the `git fetch` attempted before
branching resolves the git binary to an empty string — most likely a PATH
inheritance or git-path resolution bug in the MCP server's environment. The
worktree creation itself still succeeded because the `baseRef`
(`orchestrate/umbrella-20260521-201015`) was a local branch that needed no
fetch.

**Impact if unmitigated.** For a worktree whose `baseRef` is a remote-tracking
branch that genuinely needs a fresh fetch, the stale local ref would be used
silently. `fetchStatus: "failed"` is surfaced in the response, but it is easy
for an orchestrator to overlook a non-`error` status field.

**Mitigation.** None required this run: the orchestrator runs `git fetch
origin` itself at section 1 startup, and the umbrella branch was created and
pushed seconds before the worktree call. Documented for plugin follow-up.

**Recommendation.** Fix git-binary resolution in the MCP server's
`create_worktree` fetch path — use an absolute git path or ensure PATH is
inherited correctly by the spawned process. Add a regression test asserting
`fetchStatus: "ok"` in a normal environment.

---

## F-006 — Subagent type names require the `orchestrate:` plugin namespace

- **Severity:** Medium
- **Type:** Skill-instruction defect
- **Phase:** Section 3, step 3 — spawn investigator (slice #144)

**Symptom.** The skill says "spawn the `investigator-<effort>` subagent".
Spawning with `subagent_type: "investigator-deep"` failed:
`Agent type 'investigator-deep' not found`. The registered agent types are
plugin-namespaced: `orchestrate:investigator-deep`,
`orchestrate:implementer-deep`, `orchestrate:reviewer-deep`,
`orchestrate:conflict-resolver-deep` (and the `-standard` variants).

**Cause.** The skill instructions use the bare agent name throughout the Roles
section and sections 2–3. When orchestrate is installed as a plugin, its
bundled subagents register under the `orchestrate:` namespace. The skill text
was written as though the agents were un-namespaced.

**Impact if unmitigated.** The first spawn of every role fails. An
orchestrator that does not realise the names are namespaced would treat this
as an unrecoverable error and stop the run.

**Mitigation.** Retried every subagent spawn with the `orchestrate:` prefix.
All subsequent spawns use the namespaced form.

**Recommendation.** Update the skill — Roles section and sections 2–3 — to
spell the subagent types as `orchestrate:investigator-<effort>` etc., or add
an explicit note that the plugin namespace prefix must be prepended when
orchestrate runs as an installed plugin.

---

## F-007 — Investigator subagent pulled sibling-slice scope into its brief

- **Severity:** Medium
- **Type:** Design gap (subagent prompt / orchestrator contract)
- **Phase:** Section 3, steps 3→4 — investigate then implement (slice #144)

**Symptom.** The `investigator-deep` brief for slice #144 (the tracer slice)
listed a "version cascade" step — bump `plugin.json` and the root marketplace
manifest — in both its `relevantFiles` and its suggested `approach`. Version
cascade is the exclusive scope of slice #152 ("Marketplace version cascade —
final atomic commit"), a separate slice blocked by all eight predecessors.
Issue #144's acceptance criteria contain no version-bump requirement.

**Cause.** The investigator read the binding spec (ADR-0007, CONTEXT.md),
which describe the *whole* PRD including the version cascade, and folded a
downstream slice's work into the tracer slice. The investigator prompt handed
it issue #144's body but did not give it the boundaries of the sibling slices,
so it had no signal that version bumping belonged elsewhere.

**Impact if unmitigated.** The implementer would bump versions inside slice
#144, creating a merge conflict with slice #152 and violating the
repository's atomic-commit-by-concern rule.

**Mitigation.** The orchestrator cross-checked the investigator brief against
#144's actual acceptance criteria, caught the over-scope, and added an
explicit "CRITICAL SCOPE CORRECTION" block to the implementer prompt telling
it to ignore the version-cascade step and touch no version/marketplace files.
The implementer confirmed it touched none.

**Recommendation.** Two complementary fixes: (a) the skill should instruct the
orchestrator to pass each slice's own acceptance criteria to the investigator
as the hard scope boundary; (b) the investigator subagent prompt should carry
a standing guard — "this issue's acceptance criteria are the complete scope;
do not pull in work from sibling or downstream slices". As a general rule, the
orchestrator must diff every subagent brief against the issue's ACs before
forwarding it downstream.

---

## F-008 — Local umbrella ref goes stale; next wave's worktrees miss prior slices

- **Severity:** High
- **Type:** Plugin defect / design gap (compounds F-005)
- **Phase:** Section 2 wave loop → Section 3 step 1 — create Wave 1 worktrees (#145, #146)

**Symptom.** After slice #144's PR squash-merged into the **remote** umbrella
branch, the orchestrator created the Wave 1 worktrees (#145, #146) with
`create_worktree` and `baseRef: "orchestrate/umbrella-20260521-201015"`.
Because `create_worktree`'s internal `git fetch` fails (F-005), it branched
from the **local** umbrella ref — still at the pre-#144 commit `081b4b8` (the
original `development` tip). The remote umbrella was at `2bf4bd2` (post-#144).
The Wave 1 worktrees were missing slice #144's entire merged contribution.

**Cause.** Two compounding issues. (1) F-005 — `create_worktree`'s internal
fetch is broken, so it never refreshes the umbrella. (2) The skill's section 3
step 1 says branch from `orchestrate/umbrella-<runId>` (the local branch name)
and implicitly assumes `create_worktree`'s fetch keeps it current. Nothing in
the orchestrator loop fast-forwards the local umbrella ref after a slice
merges into the *remote* umbrella. So every wave after wave 0 cuts its
worktrees from a stale base.

**Impact if unmitigated.** High. Each wave's slices would be implemented
against a base missing every prior wave's work. Dependent slices — #145 and
#146 are both `blocked-by #144` — would be built without the very work they
depend on. On merge into the umbrella, the result is either silent loss of
the prior slice's changes in overlapping regions, or spurious conflicts. The
dependency graph would be structurally violated even though the wave ordering
itself is correct. This is the kind of defect that produces a plausible-looking
but wrong final result.

**Mitigation.** Detected by noticing `fetchStatus: "failed"` and reasoning
that the remote umbrella had advanced past the local ref after the #144 merge.
Fixed by: `git fetch origin`, then
`git branch -f orchestrate/umbrella-<runId> origin/orchestrate/umbrella-<runId>`
to fast-forward the local ref; then removing the two stale worktrees, deleting
their slice branches, and recreating them from the now-fresh local umbrella.
Verified each new worktree's HEAD equals the post-#144 squash-merge commit
`2bf4bd2`. Going forward, the orchestrator runs
`git fetch origin && git branch -f orchestrate/umbrella-<runId> origin/orchestrate/umbrella-<runId>`
at the start of every wave, before creating that wave's worktrees.

**Recommendation.** (1) Fix F-005 so `create_worktree`'s internal fetch works.
(2) Independently of F-005, the skill MUST add an explicit step at the start
of every wave (section 2): fetch and fast-forward the local umbrella ref to
the remote before creating the wave's worktrees — correctness must not depend
on `create_worktree`'s internal fetch. (3) Alternatively, the skill should
pass the remote-tracking ref (`origin/orchestrate/umbrella-<runId>`) as
`baseRef` after an orchestrator-level fetch. As shipped, the design has a
silent-data-loss failure mode that only an observant orchestrator caught.

---

## F-009 — Implementer subagent returned without its contracted structured report

- **Severity:** Medium
- **Type:** Design gap (subagent output contract / orchestrator robustness)
- **Phase:** Section 3 step 4 — implementer for slice #149 (Wave 3)

**Symptom.** `implementer-149` (`orchestrate:implementer-standard`) performed all
its work — 21 files created/modified in the worktree — but its returned message
ended mid-sentence ("Verificação final da `standalone-skills.md` para confirmar
o conteúdo:") with no `status` / `filesChanged` / `notes` structured report.
The orchestrate skill's section 3 step 4 depends on the implementer returning
`status` (to detect `blocked`) and `filesChanged` (to know what to stage).

**Cause.** The subagent's final turn was truncated — it narrated a verification
step and the response ended before it emitted the structured report. The
orchestrate implementer subagent has no enforced output schema; "return
status/filesChanged/notes" is a prompt instruction, not a structural guarantee,
so a truncated or prematurely-ended turn silently drops the contract.

**Impact if unmitigated.** The orchestrator cannot determine whether the slice
succeeded or which files to stage. A naive orchestrator might mark the slice
`failed` (losing completed work) or stall waiting for a report that never comes.

**Mitigation.** Two-pronged. (1) Inspected the worktree directly with
`git status --short` to recover the actual changeset independent of the agent's
report. (2) Resumed the agent via `SendMessage` (still resumable by agent ID)
asking only for the structured report; it returned the full `status: completed`
+ 21-file `filesChanged` + `notes` on resume. Note: `SendMessage` by agent
*name* failed — `No agent named 'implementer-149' is currently addressable` —
only the agent *ID* worked, even though the SendMessage tool documentation says
to address teammates by name and never by UUID. That name/ID inconsistency is a
secondary friction worth fixing.

**Recommendation.** (1) The orchestrate subagents (implementer, reviewer,
investigator) should return a machine-checkable structured result — a fenced
JSON block or a tool-call-shaped return — so truncation is detectable and the
orchestrator never parses prose. (2) The skill should instruct the orchestrator
to fall back to `git status` in the worktree when a subagent's report is missing
`filesChanged`, treating the worktree as the source of truth. (3) Resolve the
`SendMessage` name-vs-ID inconsistency so a completed-but-resumable agent is
addressable by the name the orchestrator assigned it.

---

## F-010 — Implementer subagents call advisor() despite explicit instruction not to

- **Severity:** Low
- **Type:** Design gap (subagent instruction adherence)
- **Phase:** Section 3 step 4 — implementers for #145, #146, #149

**Symptom.** The implementer prompts explicitly said "Do NOT call advisor() —
that is orchestration-level." The `implementer-standard` subagents for #145,
#146, and #149 each called `advisor()` anyway (their notes cite advisor
guidance). The `implementer-deep` for #144 honored the instruction.

**Cause.** Either the implementer subagent's own definition instructs an advisor
pass, or the standard-effort (sonnet) variant adheres less strictly to negative
prompt instructions than the deep (opus) variant. An orchestrator-supplied
prompt cannot reliably suppress the behavior.

**Impact.** Low — the advisor calls were harmless and in one case (#145 HTML
colors) improved the result. But each extra advisor call adds latency and token
cost; across a large backlog this compounds, and it blurs the
orchestration-level / implementer-level separation the skill intends.

**Mitigation.** None needed — outcomes were fine. Documented only.

**Recommendation.** Decide deliberately whether implementer subagents SHOULD
consult the advisor. If yes, bake it into their definition and stop telling them
not to. If no, move the prohibition into the subagent definition itself (more
authoritative than an orchestrator-supplied prompt). Either way, make the
`-standard` and `-deep` variants behave consistently.

---

## F-011 — implementer-standard maxTurns (50) too low; silent mid-work truncation

- **Severity:** High
- **Type:** Plugin defect (subagent config) — concrete root cause behind F-009
- **Phase:** Section 3 step 4 — implementer for slice #151 (Wave 5)

**Symptom.** `implementer-151` (`orchestrate:implementer-standard`) was
force-stopped after 63 tool-uses **mid-work** — it had completed only 1 of the
4 quality-gate skills the slice requires (`agent-customizer-quality-gate`) and
had just started the second gate's fixtures. It ended its message mid-sentence
("Agora vou criar os fixtures para `cursor-customizer-quality-gate`…") with no
structured report and no `blocked` signal. The slice was left roughly 30 %
implemented.

**Cause.** `implementer-standard.md` pins `maxTurns: 50`. Slice #151 touches
four separate quality-gate skills, each needing a SKILL.md content edit, a
criteria-reference edit, and a fixture corpus — far more editing than 50 turns
allows. The agent was silently truncated at the turn ceiling. Unlike a
`blocked` return, a maxTurns cutoff produces **no status signal** — the
orchestrator cannot distinguish "agent finished" from "agent ran out of turns"
without inspecting the worktree itself.

**Relationship to F-009.** This is the concrete root cause behind the F-009
class of symptom. F-009 (slice #149) was the same `-standard` variant ending
without its structured report — there the work happened to be complete; here
the work itself was truncated. Same defect, worse outcome.

**Impact if unmitigated.** A standard-tier slice that happens to touch many
files or targets is silently half-implemented. An orchestrator that trusted the
(absent) report, or did not inspect the worktree, would either commit a partial
slice or fail it — losing the partial work and shipping a broken convention
gate.

**Mitigation.** Inspected the worktree with `git status` — found only 1 of 4
gates done (2 files modified + 2 `assets/` dirs partially created). Resumed the
agent via `SendMessage` (a resume grants a fresh 50-turn budget) with an
explicit efficiency instruction: use ONE shared golden fixture corpus across
all four gates instead of per-gate duplicate copies — shrinking the remaining
work enough to fit a second budget.

**Recommendation.** (1) Raise `implementer-standard`'s `maxTurns`, or make it
scope-aware — a slice touching N targets needs a budget proportional to N.
(2) A maxTurns cutoff MUST surface as an explicit `status: incomplete` (or
`blocked`) result, never a silent mid-sentence stop — the orchestrator needs to
detect truncation without worktree forensics. (3) The orchestrator should, as a
standing rule, run `git status` on every worktree after the implementer returns
and compare the changeset against the issue's expected scope before trusting
completion. (4) Tier assessment should account for turn budget, not just
conceptual difficulty: a slice that fans out across many independent targets
(like #151's four gates) may warrant the `complex` tier purely to get the
larger turn budget and an investigator pass, even when each individual edit is
simple.

---

## Non-plugin observations (surfaced during the run, not orchestrate defects)

These were discovered while running orchestrate but are defects in the
*target repository's content*, not in the orchestrate plugin. They are logged
here only so the context is not lost; they belong in a PRD-content follow-up,
not the plugin improvement plan.

### O-001 — Wiki worked example uses attributes outside its own closed set

The implementer for #144 flagged that
`wiki/knowledge/skill-body-convention.md`'s worked example uses
`<REFERENCES load="on-demand">` and `<VALIDATION loop="max-iterations:3">`,
but `load=` and `loop=` are not in the closed attribute set documented on the
same page. This internal inconsistency in the PRD #143 source material
produces warn-tier (non-blocking) validation findings. It should be reconciled
by a content follow-up to the wiki page.

---

## Run outcome

The run completed successfully — all 9 slices passed, 0 failed, 0 skipped, final
integration PR #180 opened. Every finding below was either worked around by the
orchestrator or was non-blocking. **No finding stopped the run**, but several
(F-004, F-008, F-011) would have produced wrong or incomplete output if the
orchestrator had not actively detected and corrected them — they are silent
failure modes, dangerous precisely because the run still *looks* successful.

### Findings summary

| ID | Severity | Type | One-line |
|----|----------|------|----------|
| F-001 | Medium | Design gap | No bootstrap for `.orchestrate/` config files |
| F-002 | Medium | Plugin defect | `handoff.json` hardcodes a 200k context window |
| F-003 | Medium | Plugin defect | `commands.json` template is npm-only |
| F-004 | High | Skill defect | Backlog query does not exclude the parent PRD |
| F-005 | Medium | Plugin defect | `create_worktree` internal `git fetch` fails (empty command) |
| F-006 | Medium | Skill defect | Subagent types need the `orchestrate:` namespace prefix |
| F-007 | Medium | Design gap | Investigator pulled sibling-slice scope into its brief |
| F-008 | High | Plugin defect | Local umbrella ref goes stale; wave worktrees miss prior slices |
| F-009 | Medium | Design gap | Implementer returned without its structured report |
| F-010 | Low | Design gap | Implementers call `advisor()` despite instruction not to |
| F-011 | High | Plugin defect | `implementer-standard` maxTurns (50) too low; silent truncation |

Three findings are **High severity** and should anchor the improvement plan:
F-004 (parent PRD pollutes the backlog), F-008 (stale umbrella ref — silent
data loss across waves), and F-011 (turn-limit truncation — silent incomplete
work). All three share a theme: **the plugin's failure modes are silent** — the
run continues and reports success while producing wrong or partial output. The
highest-leverage improvement is making each of these fail loudly instead.

F-005 is the lowest-effort high-value fix (one git-path resolution bug) and it
is the root cause that makes F-008 dangerous — fixing F-005 de-risks F-008.

*Log status: CLOSED — run `20260521-201015` complete.*
