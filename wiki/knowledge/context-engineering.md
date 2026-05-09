# Context Engineering

**Summary**: The discipline of managing all context fed to an LLM — instructions, examples, retrieved data, tool outputs — to maximize signal density per token and minimize degradation from noise, staleness, and position effects.
**Sources**: research-context-engineering-comprehensive.md, research-context-rot-and-management.md, a-guide-to-agents.md, research-whitespace-and-formatting.md, advanced-context-engineering-coding-agents-dev.md, agents-md-is-a-liability-paddo.md, context-engineering-commercial-agents-jeremy-daly.md, context-engineering-most-important-skill-dev.md, context-stops-being-scarce-paddo.md, million-token-context-window-syntackle.md, pi-context-zone-github.md, shedding-dead-context-ryan-spletzer.md
**Last updated**: 2026-05-01

---

Context engineering has replaced "prompt engineering" as the dominant framing for working with LLMs. Where prompt engineering focuses on crafting a single input, context engineering manages the entire context window across turns, tools, and sessions.

## Core Principle

Every token must earn its place. The test: "Would removing this cause the agent to make mistakes?" If not, cut it. Irrelevant content actively harms reasoning — simple math accuracy drops from **0.92 → 0.68** with just 3,000 filler tokens (source: Levy et al., ACL 2024).

## The Token Budget

- Frontier LLMs follow ~**150–200 instructions** with consistency; smaller models handle fewer (source: Humanlayer research)
- Adding instruction N interacts with all existing instructions via **n² pairwise attention relationships** — context growth is superlinear in cognitive load
- Configuration files (CLAUDE.md, AGENTS.md) load on **every request** — bloat directly wastes budget
- Target under 200 lines per config file (~2,000–4,000 tokens)
- Comprehensive prompt compression achieves 4–20× reduction; naive minification destroys the structure compression preserves
- Practical threshold: reasoning quality degrades around **3,000 filler tokens** (Levy et al., ACL 2024)

## Position Effects (Lost in the Middle)

Performance follows a U-shaped curve across the context window:

| Position | Recall Quality                      | Recommendation                        |
| -------- | ----------------------------------- | ------------------------------------- |
| Start    | High (primacy effect)               | Critical instructions, system prompts |
| Middle   | 10–20% drop (Liu et al., TACL 2023) | Reference data, documents             |
| End      | High (recency effect)               | Queries, final instructions           |

Place long documents at the top and queries at the bottom — this exploits the primacy/recency effect and improves performance by ~30%.

## Four Strategies for Context Management

1. **[[progressive-disclosure]]** — Load instructions conditionally (skills, path-scoped rules, subagent summaries) instead of dumping everything into the main prompt
2. **Compaction** — Summarize accumulated context when nearing the window limit. The lightest-touch approach is **tool result clearing** (replacing verbose tool outputs with summaries). For conversations, ask the model to summarize. The simplest approach matches sophisticated alternatives.
3. **Structured note-taking** — Agent writes notes persisted outside the context window (JSON state files, progress.txt, git commits). The agent can reload specific notes on demand rather than carrying all history in context. This is [[prompt-engineering]]'s state tracking applied to context management.
4. **[[subagents]]** — Route complex research to isolated contexts; return only summaries (1,000–2,000 tokens) instead of tens of thousands of exploration tokens. JIT documentation is a variant: let the agent generate docs during planning, then use those docs (not the raw exploration) in execution.

### Choosing a Strategy

| Symptom                                   | Strategy               |
| ----------------------------------------- | ---------------------- |
| Context grows large across many turns     | Compaction             |
| Agent forgets earlier decisions           | Structured note-taking |
| Single task needs deep exploration        | Subagents              |
| Instructions compete with data for tokens | Progressive disclosure |

## The Dumb Zone

Context utilization directly affects reasoning quality. Three empirically validated zones exist:

| Zone | Context Utilization | Model Behavior |
|------|--------------------|-----------------| 
| **Smart** | 0–40% | Full reasoning capability, reliable output |
| **Warm** | 40–70% | Degraded attention, instructions start slipping |
| **Dumb** | 70%+ | Attention dilution, trajectory poisoning, unreliable |

The 40% threshold is validated across models. Even Opus 4.6, the most resilient model, shows measurable degradation above this point (source: pi-context-zone-github.md, advanced-context-engineering-coding-agents-dev.md).

Two mechanisms explain dumb zone degradation: **attention dilution** (finite attention spread across more tokens leaves less per instruction) and **trajectory poisoning** (errors and irrelevant tokens from early turns bias future generations in the same session).

The practical implication: **intentional compaction is mandatory**, not optional. When context reaches ~40%, compact or start fresh — do not push through. See [[rpi-workflow]] for phase-based compaction.

### Dead Context

"Dead context" is instruction and tool overhead that consumes tokens before any work begins. A 200K context window can have 40%+ consumed by plugins, skills, and CLAUDE.md on load — before a single task token (source: shedding-dead-context-ryan-spletzer.md).

Audit dead context:
- Scope plugins per project, not globally
- Remove skills not relevant to current work — Claude Code v2.1.129+ enforces a `skillListingBudgetFraction` cap (default 1% of context window, ~2,000 tokens on Sonnet 4.6); skills over the budget lose descriptions silently, breaking auto-invocation. See [[skill-listing-budget]].
- Test effective budget with a bare context first
- IFScale benchmark: at 500 instructions, agents follow only ~68% and skip 1 in 3 (source: agents-md-is-a-liability-paddo.md)

## Large Context Windows and Their Limits

The 1M context window (now flat-priced for Opus 4.6 / Sonnet 4.6) does not eliminate context engineering. The lost-in-middle problem persists at scale:

| Context Size | Opus 4.6 Accuracy |
|--------------|-------------------|
| 256K         | ~92%              |
| 1M           | ~78%              |

A 14-point drop in reasoning accuracy occurs at 1M even with explicit long-context training (source: million-token-context-window-syntackle.md). Positional encoding (RoPE) creates recency bias regardless of window size.

The practical effect: longer uninterrupted sessions are now viable (pushing the first compaction event further out), but **context engineering remains mandatory**. More tokens available ≠ better outcomes. Selective, structured loading still outperforms context stuffing. See [[long-context-lost-in-middle]] for the foundational research.

## Memory Scopes and Types (Production Systems)

For multi-tenant agent systems, context must be partitioned by scope to avoid bleed:

| Scope | Content | Lifetime |
|-------|---------|---------|
| **Global** | Platform-wide policies, security constraints | Permanent |
| **Tenant** | Organization preferences, integrations | Persistent |
| **User** | Personal settings, history | Persistent |
| **Session** | Current task context, active facts | Ephemeral |

Memory types within each scope:

- **Policy** — rules and constraints (e.g., "never expose PII")
- **Preference** — behavioral settings (e.g., "output in JSON")
- **Fact** — domain knowledge (e.g., "customer X uses plan Y")
- **Episodic** — event history (e.g., "last login was Monday")
- **Trace** — execution records for debugging and audit

The canonical source of truth is the **event log + structured memory**. The retrieval index is an acceleration layer, not the source of truth. Separating these prevents stale retrievals from corrupting state (source: context-engineering-commercial-agents-jeremy-daly.md).

## The 'Ball of Mud' Anti-Pattern

A common failure mode (documented in Anthropic's agent guide): the agent misbehaves → you add a rule → it misbehaves differently → you add another rule → the config becomes an unmaintainable mess. Auto-generated files compound this problem because they start large and rules only accumulate.

The fix is the **deletion test**: regularly review every instruction and ask "Would removing this cause the agent to make mistakes?" If removing it has no effect, it was noise. This connects directly to the [[evaluating-agents-paper]]'s finding that LLM-generated context files hurt performance.

## Formatting: Structure Over Minimalism

Whitespace is nearly free. A blank line costs 1 token (same as 4× blank lines). Structural formatting measurably improves output:

| Format           | Token Cost vs. Plain Text | Value                     |
| ---------------- | ------------------------- | ------------------------- |
| Markdown headers | +81%                      | Clear section boundaries  |
| XML tags         | +165%                     | Unambiguous delimiters    |
| YAML vs. JSON    | YAML saves ~30%           | Lower overhead for config |

Well-formatted 1,000-token prompt beats a wall-of-text 900-token prompt. Cut content, not formatting.

## Related pages

- [[context-rot]]
- [[progressive-disclosure]]
- [[skill-listing-budget]]
- [[prompt-engineering]]
- [[whitespace-and-formatting]]
- [[multilingual-performance]]
- [[long-context-lost-in-middle]]
- [[harness-engineering]]
- [[rpi-workflow]]
