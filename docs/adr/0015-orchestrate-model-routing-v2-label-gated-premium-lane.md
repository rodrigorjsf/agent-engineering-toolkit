# orchestrate model routing v2 — label-gated premium lane, variant rename, per-slice resolved routing

**Status:** accepted (2026-06-11)

With four Anthropic models in play (Haiku 4.5, Sonnet 4.6, Opus 4.8, Fable 5),
`routing.json` moves to a **v2 schema** and the routing model gains three
load-bearing properties: a **label-gated premium lane** instead of a fourth
complexity tier, a **variant/effort split** that removes a naming collision,
and **per-slice resolved routing** persisted into the run-state checkpoint so
resume stays a pure function of the checkpoint.

## Decision

- **Schema v2 with a `version` discriminator.** `tiers` (trivial/standard/
  complex, per-role `{model, variant}`), `labels` (generic `route:*` override
  map with per-role `set` + optional `fallback`), and `run`
  (`intraWaveConcurrency`, `continuationBudget`). The per-role key `effort` is
  renamed **`variant`** (`standard`|`deep`): it selects which subagent
  definition file is spawned and was never the API effort parameter. v1 files
  (no `version` field) keep working through an **explicit v1 schema + mapper**
  — a full parse of the old shape including the top-level run-policy keys,
  then a field-by-field upgrade in memory with a deprecation warning. A naive
  re-parse under the v2 schema is forbidden: zod strips unknown keys, which
  would silently reset `intraWaveConcurrency`/`continuationBudget` to
  defaults. `bootstrap_config`'s defaults and `templates/routing.json` are
  updated to write v2 natively so new installs are not born deprecated.
- **Default tier matrix.** trivial: implementer **haiku**, reviewer **sonnet**
  (kept deliberately as a cross-model merge gate — haiku is risky as the sole
  reviewer on a mis-tiered slice), conflict-resolver sonnet. standard:
  investigator **haiku** (a new pass; was `null`), implementer sonnet,
  reviewer opus, conflict-resolver opus. complex: unchanged, all opus `-deep`.
  Evidence: Haiku 4.5 ≈ Sonnet-class on bounded 1–2-file edits and codebase
  exploration (Claude Code's Explore subagent runs Haiku in production) at
  ~1/3 the cost, but weaker on multi-file/architectural judgment.
- **Fable 5 is a label-gated implementer-only lane, not a tier.** A human
  applies the `route:fable` routing label during grooming; the orchestrator
  may suggest it in reports but never applies it. At ~2.6x Opus effective
  cost ($10/$50 sticker plus ~30% tokenizer inflation), the spend decision
  stays with a human. **Security/cyber-flavored slices are excluded from the
  label's documented semantics**: Fable 5's safety classifiers refuse benign
  security work frequently — even on repository context alone — and its
  advertised bug-finding gains explicitly exclude the security domain.
- **Model fallback.** Any failure of a fable-spawned implementer (classifier
  refusal, retention-policy 400, invalid envelope) triggers exactly one
  re-spawn as opus `-deep` in the same worktree, recorded on the slice and
  **not** counted against `continuationBudget` (continuation = same model,
  incomplete work; fallback = model swap).
- **Per-slice resolved routing.** The routing outcome (model, variant,
  fallback) is resolved once at slice creation — labels read exactly once —
  and persisted into `run-state.json`. A resumed run routes from the
  checkpoint, never from live GitHub labels; otherwise a label edited between
  checkpoint and resume either silently changes routing mid-run or re-applies
  a label a human deliberately removed, and an un-persisted fallback can loop
  a deterministic refusal across context handoffs. `validate_run_state` and
  the resume matrix learn the new fields.
- **Label-mechanism guardrails.** A `route:*` label present on an issue but
  absent from the config produces a loud warning (never a silent no-op); two
  configured labels patching the same role is a loud error (no precedence
  rule).
- **Explicit subagent effort levels.** The Claude Code Agent tool has no
  per-invocation `effort` parameter, so real effort lives only in definition
  frontmatter: `-deep` variants keep `effort: xhigh`;
  investigator/implementer/conflict-resolver `-standard` get `medium` and
  reviewer-standard gets `high` (the merge-gate judgment role). **Gated on an
  empirical spike first**: implementer-standard and investigator-standard are
  also the files spawned with `model: haiku`, and haiku supports no effort —
  if frontmatter effort + haiku spawn errors rather than degrading, those two
  files stay effort-free and only the never-haiku files get explicit effort.

## Considered options

- **Fourth `critical` tier (rejected).** Tiers are orchestrator judgment; a
  judgment-reachable premium tier lets the model self-promote to the most
  expensive model. The label keeps the spend decision human and auditable.
- **Orchestrator applies the label itself (rejected).** Same self-promotion
  problem one step removed.
- **Real effort values in `routing.json` (rejected).** Unenforceable promise —
  effort cannot be set at spawn time, only in frontmatter.
- **Re-reading labels on resume (rejected).** Breaks the resume invariant
  that a run never re-derives its own scope.
- **Deferring the Fable lane (rejected, adversarial-review suggestion).** The
  "mostly falls back" risk projection rests on security-workload refusal
  data, and security is excluded from the lane; the lane is opt-in,
  human-gated, fallback-protected, and the per-slice persistence it needs is
  required for the label mechanism anyway.
- **Subagent-driven pre-flight (out of scope, premise dissolved).** The
  originally proposed "auto-preflight via subagent" front was verified
  against shipped 1.5.0 behavior: run mode already performs setup inline and
  resumes a pre-flighted run automatically. ADR-0014 stands.

## Consequences

- `resolve_routing` output contract changes (`variant` rename, new `fallback`
  slot, optional `labels` input) — its consumers (`index.ts` summary builder,
  the slice-pipeline spawn sites) update in lockstep, `orchestrate-mcp`
  **`dist/` is rebuilt and committed** (tests run `src/`, the bundle ships),
  and the plugin version cascade (plugin.json, marketplace entry, top-level
  mirror) bumps minor.
- `run-state.json` slice schema gains the resolved-routing fields; the resume
  re-validate matrix gains a fallback-aware row.
- Default standard-tier cost profile changes: a new haiku investigator pass
  runs on every standard slice, and trivial implementation moves to haiku.
