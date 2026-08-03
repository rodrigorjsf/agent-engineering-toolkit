# Orchestrate subagent advisor policy

**Status:** superseded (2026-08-02) — originally accepted 2026-05-22

## Superseded

This decision no longer holds, on both of its legs.

**Its mechanism never worked.** The premise below — that a restricted `tools:`
frontmatter withholds the `advisor` tool — was disproved empirically on Claude Code
2.1.220. The runtime injects `advisor` into every subagent regardless of `tools:`, and
the tool survives an explicit `disallowedTools: advisor`. Two independent probes
reported it, including one against `orchestrate:investigator-standard`, which does not
declare it. The frontmatter expressed an intention; it never produced an absence.

**Its intent is withdrawn.** Subagent advisor use is now accepted: enabling the advisor
feature is the operator's choice, so a subagent that calls it is acting within what the
operator switched on. There is no prohibition to enforce.

What remains true is the positive half — advisor passes at the **orchestrator boundary**
are unrestricted and useful. The `## Advisor policy` section in each definition, and its
word-for-word parity between the `-standard` and `-deep` variants, now record a
preference rather than a boundary; the parity requirement itself is unaffected.

The original text follows unchanged as the historical record.

---

All eight orchestrate subagents (`investigator`, `implementer`, `reviewer`, and
`conflict-resolver`, in both `-standard` and `-deep` variants) do **not** consult
an advisor. Advisor passes, when used, happen at the **orchestrator boundary** —
the driver session running the orchestrate skill — not inside any subagent. This
decision is expressed positively in every subagent definition, and the same
statement appears word-for-word in the `-standard` and `-deep` variant of each
role so the pair is guaranteed consistent.

## Context

Orchestrate subagents are spawned with a restricted `tools:` frontmatter that
does not grant an `advisor` tool. Their sandboxed environment (no Bash, no git)
further constrains what they can call. An instruction to "consult the advisor"
inside a subagent definition is therefore a dead letter — the tool is absent,
so the call never executes. Leaving the instruction in place creates
inconsistency: the text says one thing, the tool whitelist enforces another.
Additionally, policy asymmetry between the `-standard` and `-deep` variants of
the same role would cause the same work to behave differently depending on how
the orchestrator routes the issue tier, with no principled reason for the
divergence.

## Decision

- Subagents do not call an advisor. The `advisor` tool is intentionally absent
  from every subagent's `tools:` frontmatter.
- Every subagent definition carries an explicit, positive statement of this
  policy under its `## Advisor policy` section, so the decision is self-evident
  from the definition file itself rather than inferred from the absence of a
  tool.
- The statement is identical between the `-standard` and `-deep` variant of
  each role — the only deliberate difference between variants is model, effort,
  `maxTurns`, and the depth-of-pass instructions; the advisor policy is not a
  function of tier.
- Advisor use by the orchestrator (the driver session running the
  `orchestrate:orchestrate` skill) is unrestricted and outside this decision's
  scope — it is a different agent with a different tool set.

## Considered options

**Allow advisor calls inside subagents** — rejected: the `advisor` tool is not
in any subagent's `tools:` frontmatter, so an instruction to call it would be a
dead letter. Granting the tool would expand each subagent's blast radius and
increase per-slice cost; the investigator brief and the reviewer's judgment gate
already provide the quality checks a subagent might reach for the advisor to
supply.

**Express the policy only via the tool whitelist (no prose statement)** —
rejected: relying on omission is opaque. A developer reading a subagent
definition cannot tell whether the absence of an `advisor` tool is an oversight
or a deliberate decision. An explicit prose statement removes the ambiguity and
makes the policy verifiable without cross-referencing the frontmatter.

**Different policy between `-standard` and `-deep`** — rejected: the two variants
of a role exist to vary effort and model, not to change safety or quality-control
policies. Asymmetric advisor policy would create a class of behaviors that vary
by tier without a principled reason, and would surface as confusing inconsistency
when the same issue type routes to different variants.

## Consequences

- Every subagent definition gains an `## Advisor policy` section with a
  consistent one-sentence statement.
- The `-standard` and `-deep` variant of each role carry the identical statement
  for that section — reviewers can diff the two variants and expect zero
  divergence on advisor policy.
- `CONTEXT.md` glossary gains a **Subagent advisor policy** entry under
  `### Orchestrate run vocabulary` recording where the policy lives and what it
  says.
- Removing the prose does not change runtime behavior (the tool was already
  absent); adding it makes the policy explicit and auditable.
