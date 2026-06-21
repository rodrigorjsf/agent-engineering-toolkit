# cursor-code-documentation — an always-apply rule, not a hook, delivers document-as-you-code in Cursor

**Status:** accepted (2026-06-21)

The Claude Code `code-documentation` capability (documentation produced as the
agent codes, plus on-demand explain/generate commands) is ported to the Cursor
harness as a new **deployable-behavior plugin**, `cursor-code-documentation`.
The port's central question — what makes the agent document code automatically
— resolves to a Cursor **rule**, not a hook, against the user's initial hook
instinct, on live-verified evidence gathered 2026-06-21.

## Decision

- **Guidance via one always-apply rule, not a hook.** A single
  `.cursor/rules/*.mdc` with `alwaysApply: true`, language-agnostic and ≤30
  lines, names the language→format mapping (Javadoc for Java, JSDoc for JS/TS,
  docstrings for Python, header comments for shell, …) and relies on model
  knowledge rather than embedding per-language specifications. Verified against
  official docs and the Cursor forum: **no Cursor hook injects per-turn
  guidance into the system prompt.** `sessionStart`'s `additional_context` is
  Cursor-staff-confirmed broken (forum 158452) and is one-shot at session
  start even when fixed; `beforeSubmitPrompt` fires per-turn but can only block
  (its output is ignored beyond the `continue` flag); `afterFileEdit` is
  non-blocking, cannot feed anything back to the model, and unreliable on
  batch edits (forum 156065).
  A rule is the only reliable always-on per-turn injection surface.
- **Enforcement deferred, not abandoned.** No hook ships in v1. Two deferred
  paths are recorded: (a) `sessionStart` injection, gated on the upstream bug
  fix, and (b) a `stop`-hook self-review pass (a fixed `followup_message`
  asking the agent to confirm documentation coverage, bounded by `loop_limit`)
  as the working fallback should the rule prove leaky. `afterFileEdit` is
  explicitly rejected as an enforcement surface.
- **Two manual-only skills.** `code-explain` and `doc-generate`, each with
  `disable-model-invocation: true` (manual `/`-invocation only), authored via
  `/writing-great-skills`. They mirror the source plugin's *commands*. The
  rule owns automatic/inline documentation; the skills own deliberate,
  heavyweight operations. The source plugin's subagents are not ported.
- **A deployable-behavior Cursor plugin.** `cursor-code-documentation` is the
  first plugin in this marketplace that *ships* behavior (a bundled rule +
  skills consumed directly on install) rather than *generating* artifacts into
  a target project. It is a distinct plugin role from the initializer/
  customizer generators, and aligns with ADR-0001 (rules-first) and ADR-0003
  (Cursor skills default path).
- **A single quality-gate seam.** Validation reuses the existing quality-gate
  pattern (as in `cursor-customizer-quality-gate`), scaled to the plugin's
  three artifacts — one validation surface, not a six-phase clone.

## Considered options

- **A hook that injects documentation instructions into the system prompt
  (the user's initial premise) — rejected.** Not a real Cursor capability:
  `sessionStart` injection is broken and one-shot, `beforeSubmitPrompt` is
  block-only, `afterFileEdit` only runs after the fact and cannot feed the
  model. The hook cannot front-load per-turn guidance the way a rule does.
- **`sessionStart` injection used as "enforcement" — rejected.** It is broken
  today (a no-op), it is not enforcement (it injects text, it does not verify
  or block), and even when fixed it is redundant with the always-apply rule
  (one-shot at session start vs. every turn).
- **Per-language glob-scoped rules — deferred.** The model already knows each
  format; one ≤30-line always-apply rule covers every language, including
  newly created files, at negligible token cost. Per-language `globs` rules
  with enforced house-style are a recorded future upgrade, not v1.
- **An `afterFileEdit` enforcement hook — rejected.** Its script can modify
  files (its canonical use is a formatter), but it cannot block the edit,
  cannot feed anything back to the model to author meaningful documentation,
  and fires only for the first file in a batch edit — unfit for
  model-authored doc enforcement.
- **Auto-invocable explain/generate skills — rejected.** They would overlap
  the rule and risk spurious mid-edit firing; manual-only is the faithful
  command mirror and keeps the rule/skill role boundary clean.
- **Extending `cursor-customizer` (a generator) with a doc-automation
  generator skill — rejected.** Only a deployable-behavior plugin ships the
  rule and skills as live artifacts on install; a generator adds an extra
  generation step and is not plug-and-play.

## Consequences

- A new plugin directory, Cursor manifest, and top-level marketplace
  `plugins[]` entry are added; the version cascade applies (the plugin
  manifest carries a `version`, the marketplace entry carries none, and the
  marketplace top-level `metadata.version` is bumped to mirror the magnitude).
- The **deployable-behavior plugin** becomes a third plugin role in the domain
  model, alongside the initializer and customizer generators.
- The deferred enforcement path is recorded with its upstream blocker (Cursor
  forum 158452) so it can be enabled cleanly once the injection channel is
  fixed.
- The `docs/cursor` mirrors and `wiki/knowledge/cursor-*` pages are refreshed
  in the same session to correct the stale hook facts this decision depends on
  (the `sessionStart`-works claim, the missing `afterFileEdit` reliability
  caveat, the hook count, the rule-mode labels, the deprecated-not-rejected
  `globs` nuance, and Memories GA).
- PRD #335 carries the implementation; its single test seam is the plugin's
  quality-gate skill.
