# Orchestrate subagent advisor policy

**Status:** accepted (2026-05-22)

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
