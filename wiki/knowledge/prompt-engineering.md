# Prompt Engineering

**Summary**: Comprehensive techniques for crafting effective LLM inputs, ranging from basic clarity principles to advanced reasoning strategies — with the critical insight that advanced reasoning models invert conventional wisdom about few-shot examples and explicit chain-of-thought.
**Sources**: prompt-engineering-guide.md, claude-prompting-best-practices.md, analysis-prompt-engineering-guide.md, analysis-claude-prompting-best-practices.md
**Last updated**: 2026-05-22

---

## The Paradigm Inversion

Advanced reasoning models (o1, R1, GPT-5) perform **worse** with classic techniques:

- Few-shot examples can **hurt** by constraining internal reasoning
- Explicit "think step by step" is counterproductive (model already thinks internally)
- Zero-shot outperforms few-shot on reasoning tasks for these models

| Model Tier                    | Few-shot        | Explicit CoT    | Best Approach                     |
| ----------------------------- | --------------- | --------------- | --------------------------------- |
| **Reasoning** (o1, R1, GPT-5) | Harmful         | Harmful         | Zero-shot, no examples            |
| **Frontier** (Claude, GPT-4)  | Beneficial      | Beneficial      | Few-shot CoT + XML tags           |
| **Mid-tier** (<100B params)   | Very beneficial | Very beneficial | Extensive few-shot + explicit CoT |

## Prompting Claude Opus 4.7

The current Claude lineup is **Claude Opus 4.7, Claude Opus 4.6, Claude Sonnet 4.6, and Claude Haiku 4.5** (source: claude-prompting-best-practices.md). Opus 4.7 is the most capable generally available model and performs well out of the box on existing Opus 4.6 prompts; the behaviors below most often need tuning.

- **Response length** is calibrated to judged task complexity rather than a fixed verbosity — shorter on lookups, longer on open-ended analysis. Tune with prompts if your product depends on a fixed style; positive concision examples beat negative instructions.
- **Effort parameter** — start at the new `xhigh` level for coding and agentic use cases; use a minimum of `high` for intelligence-sensitive work. Opus 4.7 respects effort strictly, especially at the low end: at `low`/`medium` it scopes work to exactly what was asked. If reasoning looks shallow, raise effort rather than prompting around it.
- **Tool-use triggering** — Opus 4.7 uses tools less often and reasons more. Raising effort (`high`/`xhigh`) is the lever to increase tool usage, especially in agentic search and coding.
- **More literal instruction following** — it interprets prompts literally and will not silently generalize an instruction from one item to another. State scope explicitly ("apply to every section, not just the first").
- **Tone** is more direct and opinionated, with less validation-forward phrasing and fewer emoji than Opus 4.6.
- **Subagent spawning** — Opus 4.7 spawns fewer subagents by default; give explicit guidance when more are desirable.
- **Code-review harnesses** tuned for earlier models may show lower measured recall, because Opus 4.7 follows "only report high-severity" instructions more faithfully — a harness effect, not a capability regression. Tell the finding stage its job is coverage, not filtering.

## Core Techniques

### Chain-of-Thought (CoT)

- PaLM 540B on GSM8K: **17.9% → 58.1%** (+3.2×); with Self-Consistency: **83.9%**
- Modern models: Llama 3.1 405B **96.8%**, GPT-4o **96.1%**, Claude 3.5 Sonnet **96.4%**
- Token cost: 2–3× more than direct prompting; up to 600% for complex reasoning
- CoT only helps models >100B params; smaller models produce "fluent but illogical" reasoning

### Tree of Thoughts (ToT)

- Game of 24: CoT **4%** vs. ToT **74%** (18.5× improvement)
- Requires 5–20× more API calls — use only for tasks where exploration matters

### Self-Consistency

- Sample multiple reasoning paths and majority-vote the answer
- Improvements: +17.9% on GSM8K, +11% on SVAMP, +12.2% on AQuA

### ReAct (Reasoning + Acting)

- ALFWorld: **+34% absolute** success rate over imitation/RL
- Foundation for agentic tool use: Thought → Action → Observation loop

### Consolidated Benchmarks

| Technique         | Benchmark          | Baseline → Improved | Multiplier |
| ----------------- | ------------------ | ------------------- | ---------- |
| CoT               | GSM8K (PaLM 540B)  | 17.9% → 58.1%       | 3.2×       |
| CoT + SC          | GSM8K (Flan-PaLM)  | 58.1% → 83.9%       | —          |
| Self-Consistency  | GSM8K              | +17.9% over CoT     | —          |
| Self-Consistency  | SVAMP              | +11% over CoT       | —          |
| Self-Consistency  | AQuA               | +12.2% over CoT     | —          |
| ToT               | Game of 24 (GPT-4) | 4% → 74%            | 18.5×      |
| ReAct             | ALFWorld           | +34% absolute       | —          |
| Step-Back         | Various            | +7–27% over CoT     | —          |
| Emotion prompting | 45 tasks           | >10% average        | —          |
| Graph of Thoughts | Sorting tasks      | +62% over ToT       | −31% cost  |

## Structural Techniques

- **XML tags**: Unambiguous content delimiters for Claude (`<instructions>`, `<context>`, `<query>`)
- **Structured output**: Two-stage approach (free reasoning first → constrained formatting) improves accuracy from **48% → 61%**
- **Role specification**: Specific credentialed personas outperform generic helpers (authority principle from [[persuasion-in-ai]])
- **Emotion prompting**: >10% improvement across 45 tasks with zero implementation cost
- **Step-Back prompting**: 7–27% improvement over CoT depending on task

## Claude-Specific Practices

- Place long documents at the **top** of prompts (improves performance by ~30%)
- Ask Claude to **quote relevant parts** before analyzing long documents
- Use explicit action directives: "Change this function" not "Can you suggest changes?"
- Maximize parallel tool calling with explicit instructions
- Wrap content types in XML tags (`<instructions>`, `<context>`, `<input>`); include 3–5 diverse `<example>` blocks for few-shot steering

### Adaptive Thinking and the `effort` Parameter

Claude 4.6 and 4.7 models use **adaptive thinking** (`thinking: {type: "adaptive"}`), where Claude dynamically decides when and how much to think based on the `effort` parameter and query complexity (source: claude-prompting-best-practices.md). It replaces manual extended thinking with `budget_tokens`, which is still functional on Opus 4.6 / Sonnet 4.6 but **deprecated** — prefer lowering `effort` or capping with `max_tokens`.

The `effort` parameter has five levels: `max`, `xhigh` (new — best for coding/agentic), `high`, `medium`, `low`. Configure via `output_config: {effort: "high"}`. At `max`/`xhigh` set a large `max_tokens` budget (start at 64k). Sonnet 4.6 defaults to `high` effort; Sonnet 4.5 had no effort parameter.

### Prefilling Is Deprecated

Starting with Claude 4.6 models, **prefilled responses on the last assistant turn are no longer supported** — such requests return an HTTP 400 error (source: claude-prompting-best-practices.md). Migrate: use [[structured-outputs]] or tool calling to constrain format; use direct system-prompt instructions to eliminate preambles; move continuations into the user message. Earlier models still support prefills, and adding assistant messages elsewhere in the conversation is unaffected.

## State Tracking Patterns

Agentic systems need external state management since context windows are ephemeral:

- **Structured files**: JSON feature lists, progress.txt, TODO trackers — persisted outside context
- **Git history**: Commits as checkpoints; agent can recover state from diff history
- **Least-to-Most decomposition**: Break complex tasks into subtasks, solve sequentially, each building on prior results

These patterns connect to [[context-engineering]] compaction strategies — state tracking is context management applied to multi-step workflows.

## Token Budget Sweet Spot

- Reasoning degrades around **3,000 tokens** of prompt (Levy et al., ACL 2024)
- Sweet spot: **150–300 words** of prompt text
- CoT token cost: **35–600%** more than direct prompting
- Chain of Draft (CoD) alternative: matches CoT accuracy using only **~7.6% of tokens**
- TALE-EP reduces CoT tokens by **67%** with **59% cost reduction** while maintaining performance
- Practical cost comparison: optimized prompting saves **~$706/day vs. $3,000/day** for naive approaches at scale

## Automated Prompt Optimization

Manual prompt engineering has diminishing returns. Automated techniques outperform human-crafted prompts:

| System                      | Result                                                         | Source            |
| --------------------------- | -------------------------------------------------------------- | ----------------- |
| **APE** (Zhou et al., 2022) | Human-level or better on **24/24 Instruction Induction tasks** | ICLR 2023         |
| **OPRO** (DeepMind)         | **+8% GSM8K**, **+50% Big-Bench Hard**                         | Yang et al., 2024 |
| **DSPy** (Stanford)         | **46.2% → 64.0%** accuracy via systematic prompt programming   | Khattab et al.    |

The pattern: use LLMs to generate, evaluate, and refine prompts in an automated loop — this is meta-[[prompt-engineering]].

## Reflexion Pattern

Generate → evaluate → refine, applied to agent behavior across episodes:

1. **Generate**: Agent attempts a task
2. **Evaluate**: Outcome is assessed (test results, correctness checks)
3. **Refine**: Agent reflects on failures and adjusts approach for next attempt

This is the Evaluator-Optimizer workflow from Anthropic's agent patterns — the same generate-evaluate-refine loop can be applied to [[skill-authoring]] instead of runtime behavior.

## Related pages

- [[context-engineering]]
- [[persuasion-in-ai]]
- [[whitespace-and-formatting]]
- [[agent-workflows]]
