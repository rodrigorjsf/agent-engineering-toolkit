# Pi Context Zone

**Summary**: The Smart/Warm/Dumb zone framework for context utilization — Dex Horthy's empirically validated thresholds (40%, 70%) where reasoning quality cliffs occur, with model-by-model resilience data and prescriptions for staying in the smart zone.
**Sources**: pi-context-zone-github.md, harnessengineering-building-the-operating-system-for-autonomous-agents.md, advanced-context-engineering-coding-agents-dev.md
**Last updated**: 2026-05-02

---

The "context zone" framework names what the [[context-rot]] research measures: LLMs do not degrade gracefully as context fills — they hit cliffs. The framework was popularized by Dex Horthy (HumanLayer) after analyzing 100,000+ developer sessions and was made visually concrete by `pi-context-zone`, a Pi coding agent extension that renders the zone as a footer health bar (source: pi-context-zone-github.md).

## The Three Zones

| Zone | Context Used | Behavior |
|------|-------------|----------|
| 🧠 **Smart** | 0 – 40% | Peak reasoning. Follows instructions, catches edge cases, accurate tool selection. (source: pi-context-zone-github.md) |
| ⚠️ **Warm** | 40 – 70% | Degrading. F1 scores drop ~45%. Instruction drift, shallow pattern matching, starts relying on pre-training over the actual context. (source: pi-context-zone-github.md) |
| 🧟 **Dumb** | 70%+ | Broken. Hallucination rates spike to 40%. Infinite debug loops. Confidently wrong. Auto-compaction triggers here but is lossy. (source: pi-context-zone-github.md) |

The 40% threshold is validated across models — even the most resilient frontier model (Opus 4.6) shows measurable degradation above it (source: advanced-context-engineering-coding-agents-dev.md, harnessengineering-building-the-operating-system-for-autonomous-agents.md). Treating "smart zone ends at 40%" as the universal default is conservative but safe.

## Model-Specific Resilience (March 2026)

The dumb zone threshold varies by model. The MRCR v2 (8-needle) benchmark — Multi-Round Coreference Resolution, the gold standard for measuring **reasoning quality** (not just retrieval) under long context — gives the resilience picture:

| Model | Context Window | MRCR @ 128K | MRCR @ 256K | MRCR @ 1M | Smart Zone Ends |
|-------|---------------|-------------|-------------|-----------|----------------|
| Claude Opus 4.6 | 1M | ~94% | 93% | **78%** | ~70% (most resilient) |
| Claude Sonnet 4.6 | 1M | — | — | 65% | ~50–60% |
| GPT-5.4 | 1M | 86% | 79% | 37% | ~30–40% |
| Gemini 3.1 Pro | 2M | 85% | ~50% | 26% | ~25–30% |
| MiniMax M2.1 | 1M | ~73% | — | ~32% | ~30–40% |
| Grok 3 | 1M | — | — | — | ~50% (severe distractor susceptibility) |
| DeepSeek V3 | 128K | **95%** | N/A | N/A | Near 100% (within its window) |
| Llama 4 Scout | 10M | — | — | — | Unknown (no MRCR published) |

(source: pi-context-zone-github.md)

Opus 4.6's Context Compaction architecture genuinely resists context rot better than any other frontier model — 78% reasoning accuracy at 1M tokens vs. GPT-5.4's 37% and Gemini 3.1's 26%. But even Opus degrades. The 40% rule is conservative and works as a universal default across providers.

## What Causes Context Rot

Four mechanisms drive zone degradation (source: pi-context-zone-github.md, harnessengineering-building-the-operating-system-for-autonomous-agents.md):

1. **Attention dilution.** Transformer attention is a fixed budget. More tokens = less focus per token. Adding instruction N interacts with all existing instructions via n² pairwise attention relationships — context growth is superlinear in cognitive load.
2. **Lost in the middle.** Models remember the beginning and end of context but forget the middle (U-shaped retrieval curve). See [[long-context-lost-in-middle]] for the foundational research.
3. **Trajectory poison.** Conversation history accumulates the model's own mistakes and corrections. The model learns to predict more mistakes from this self-reinforcing distribution.
4. **KV cache compression.** At high utilization, models compress older context, losing the "why" behind decisions while keeping shallow facts.

The "distractor effect" — Chroma Research finding that low semantic similarity between the query and surrounding noise (failed attempts, verbose logs) collapses reasoning quality more than length alone does — sits on top of these four mechanisms (source: harnessengineering-building-the-operating-system-for-autonomous-agents.md).

## Staying in the Smart Zone

When the zone bar turns yellow (warm) or red (dumb), three mechanisms restore reasoning quality (source: pi-context-zone-github.md):

1. **Compact** — Trigger `/compact` or let auto-compaction handle it. Note that auto-compaction at the dumb-zone threshold is already lossy; intentional compaction earlier is preferable.
2. **New session** — Start fresh with a clean context. The [[rpi-workflow]] (Research → Plan → Implement) is structured precisely so each phase begins in the smart zone.
3. **Sub-agents** — Delegate heavy exploration to isolated contexts; only condensed summaries return to the parent thread. See [[claude-code-subagents]] for the context-firewall pattern.

These three mechanisms are why every mature [[harness-engineering|harness]] pattern emphasizes fresh context windows between phases and sub-agents as context firewalls.

## Defaults That Work Across Models

The `pi-context-zone` extension uses model-agnostic defaults derived from this framework (source: pi-context-zone-github.md):

| Setting | Value | Rationale |
|---------|-------|-----------|
| Smart → Warm | 40% | Dex Horthy's inflection point, validated across models |
| Warm → Dumb | 70% | Where hallucination rates spike and auto-compaction triggers |

These thresholds are intentionally model-agnostic. While Opus 4.6 can push further into the warm zone without degrading, the 40% default works across all providers and is the safe assumption when an agent's runtime model is not known in advance.

## Implication for Skill and Harness Design

The smart zone framework establishes a hard upper bound on what an artifact may load. A skill that — when all its references and templates are loaded — pushes a working context above 40% utilization on its own is a skill that **starts the agent in the warm zone before any task work begins**. Practical prescriptions (source: harnessengineering-building-the-operating-system-for-autonomous-agents.md):

- Skill bundles should support [[progressive-disclosure|progressive disclosure]] — references loaded by phase, not eagerly.
- "Dead context" (instruction and tool overhead consumed before any work begins) is the single most common reason agents start in the warm zone. Audit it first.
- Verbose tool outputs (4,000-line passing test logs) push the agent into the dumb zone mid-session. Hooks must swallow successful logs and surface only error traces.
- MCP tool descriptions inflate the system prompt. If a server is not actively in use, disable it — its tool definitions consume tokens before the agent starts working.

## Related pages

- [[context-engineering]]
- [[context-rot]]
- [[harness-engineering]]
- [[progressive-disclosure]]
- [[long-context-lost-in-middle]]
- [[rpi-workflow]]
- [[claude-code-subagents]]
