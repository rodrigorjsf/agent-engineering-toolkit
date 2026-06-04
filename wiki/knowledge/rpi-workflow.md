# RPI Workflow

**Summary**: The Research-Plan-Implement (RPI) workflow structures AI coding work into three sequential phases, each producing a compacted artifact that serves as the clean starting context for the next phase — preventing the compounding confusion of unstructured "vibe coding."
**Sources**: research-plan-implement-rpi.md, research-plan-implement-review-tyler-burleigh.md, agentic-software-modernization-markus-harrer.md, harness-engineering.md, building-agent-harness-martin-richards.md
**Last updated**: 2026-05-01

---

## The Leverage Model

The core insight that drives the RPI workflow is a hierarchy of leverage:

- **Bad research** → thousands of bad lines of code
- **Bad plan** → hundreds of bad lines of code
- **Bad code** → one bad line of code

Reviewing roughly 400 lines of specs (200 research + 200 plan) provides more value than reviewing 2,000 lines of generated code, because errors caught earlier affect everything downstream. (source: research-plan-implement-rpi.md)

This is why the workflow places the heaviest human review burden at the research and plan phases — where intervention is cheapest and most impactful.

## Why Unstructured AI Coding Fails

Without structure, the pattern is consistent: the model produces something close but not right, the session becomes a series of corrections, the model carries forward bad assumptions, and the context window fills with failed attempts. (source: research-plan-implement-review-tyler-burleigh.md)

The fundamental bottleneck in AI-assisted development is not code generation speed — it is ensuring the model understands what to build before it starts building. The same convergent conclusion was reached independently at HumanLayer, Superpowers, Atelier, and Thoughtworks. (source: building-agent-harness-martin-richards.md)

## The Four Phases

### Phase 1: Research

**Goal**: Navigate the codebase, find definitions and information flow, surface relevant context.

**Output artifact**: `RESEARCH.md` (or `research_doc.md`) — approximately 200 lines.

The research phase begins with a fresh context window containing only the problem definition. [[subagents]] perform noisy operations (glob, grep, read) in isolated contexts, returning compacted summaries to prevent context pollution in the parent thread. (source: research-plan-implement-rpi.md)

What the research document captures:
- Problem summary
- Relevant files identified
- Information flow analysis (e.g., `parse() → validate() → execute_test()`)
- Key findings
- Recommended approach

**Human review checkpoint** (highest leverage): Verify correct understanding of codebase structure, relevant files identified, accurate information flow analysis, and no false assumptions. The cost of an error here is thousands of incorrectly architected lines of code downstream.

### Phase 2: Plan

**Goal**: Specify exactly which changes are needed and how to verify them.

**Output artifact**: `PLAN.md` + optionally `PLAN-CHECKLIST.md` — approximately 200 lines combined.

The plan phase starts with a clean context window containing only the research document and problem definition. No raw file contents or search results pollute the context. (source: research-plan-implement-rpi.md)

What the plan captures:
- Numbered sequential implementation steps
- Exact file modifications per step
- Function signatures and integration points
- Error handling approach
- Testing and verification procedures per step

**Human review checkpoint** (high leverage): Verify sound architectural approach, appropriate file modifications, complete testing strategy, and alignment with codebase conventions. The cost of an error here is hundreds of lines of code in wrong locations or wrong patterns.

Tyler Burleigh adds an annotation cycle at this phase — adding inline notes directly to the plan document, sending the agent back to update it, and repeating until aligned. "The plan becomes shared mutable state between you and the agent." (source: research-plan-implement-review-tyler-burleigh.md)

### Phase 3: Implement

**Goal**: Execute the plan in small phases, producing verifiable git commits.

**Output artifacts**: Code files + tests, committed incrementally per feature.

The implementation phase starts with a clean context window containing only the implementation plan. For complex tasks requiring multiple compaction cycles, the agent updates `progress.md` to track status across context resets. (source: research-plan-implement-rpi.md)

Key prescriptions during implementation:
- Work on one feature or step at a time
- Run tests after each step
- Commit to git after each feature with descriptive messages
- Update progress file before context reset
- Use git worktrees for parallel feature execution without file conflicts

**Human review checkpoint** (lowest leverage): Code review of the cumulative changes. By this stage, the obvious problems are fixed and reviewers focus on what only a human would catch.

### Phase 4: Review (in extended workflows)

Some practitioners add an explicit review phase. The coding agent (or a separate reviewer model) reviews all changes on the branch holistically — catching issues that only emerge when pieces come together. Optionally followed by a refactoring pass saving findings to `REFACTOR_PLAN.md`. (source: research-plan-implement-review-tyler-burleigh.md)

## Fresh Context Windows Between Phases

The most operationally important rule: **start a new session for each phase.**

Starting fresh means the model does not carry forward misunderstandings, failed attempts, or stale assumptions from the previous phase. Each phase receives a clean context at 10-15% utilization with only the relevant artifact as input. (source: research-plan-implement-rpi.md)

This is the mechanism behind Frequent Intentional Compaction (FIC) — the meta-pattern that wraps RPI. Phase transitions are explicit compaction boundaries: the agent is forced to produce a correctly-scoped artifact before proceeding.

Context optimization targets:
- **40-60% target utilization** during active work within each phase
- Start each phase at 10-15% utilization
- Use [[subagents]] within phases for noisy operations that would otherwise inflate the parent context

## The Connection to the Dumb Zone

Without phase structure, a single long session accumulates noise:
1. File reads, search results, intermediate reasoning
2. Failed attempts and correction cycles
3. Verbose test output and build logs
4. The entire context window fills past 40% utilization

Past that threshold, model reasoning starts to degrade toward what the [[harness-engineering]] literature calls the "dumb zone" — though that source pins the sharp-degradation threshold higher, at >60% utilization; the ~40% figure here comes from agentic-software-modernization-markus-harrer.md. Fresh context windows per phase are the structural prevention mechanism. (source: agentic-software-modernization-markus-harrer.md, harness-engineering.md)

## Written Artifacts as Shared Truth

The artifacts produced between phases (RESEARCH.md, PLAN.md) are not just hand-off notes — they are the shared ground truth between human and agent. (source: research-plan-implement-review-tyler-burleigh.md)

Without them:
- Context is lost between sessions
- The model re-infers intent every time
- Human review has no anchor point
- Corrections from one session don't persist to the next

With them:
- The human can review and annotate before the next phase begins
- The agent has an authoritative reference throughout implementation
- Progress tracking across many sessions is possible
- Multiple agents can share understanding of the same task

## Multi-Model Scaling

RPI enables deliberate model assignment by phase complexity: (source: research-plan-implement-review-tyler-burleigh.md)

| Phase | Task character | Model recommendation |
|-------|---------------|---------------------|
| Research | Synthesis, judgment | Strongest available model |
| Plan | Architecture decisions | Strongest available model |
| Implement | Largely mechanical (guided by detailed plan) | Faster, cheaper model |
| Review | Synthesis, judgment | Different model from implementer |

The review-with-different-model pattern: models trained on different data with different architectures produce largely uncorrelated errors. Using one model to implement and a different model to review catches mistakes neither would catch reviewing their own work. (source: research-plan-implement-review-tyler-burleigh.md)

## Automation and Autonomy Scaling

The level of safe autonomy depends on plan detail: (source: research-plan-implement-review-tyler-burleigh.md)

| Plan detail | Safe autonomy level |
|------------|---------------------|
| High-level goal | Human-in-the-loop for every step |
| Phased plan with architecture decisions made | Autonomous per phase, review between phases |
| Detailed plan with file paths and function signatures | Autonomous implementation, human reviews PR |
| Exact specifications with test cases | Fully autonomous with automated verification |

A more automated workflow uses a human review gate only at the plan approval step, then an autonomous implementation loop where a reviewer agent (different model) iterates with the implementer until satisfied, with the human only reviewing the final PR.

## 1M Context Window Strategies Within Phases

Extended context models are best used strategically within specific RPI phases: (source: research-plan-implement-review-tyler-burleigh.md)

- **Deep research sessions**: Exploring large, unfamiliar codebases where many files must be read to understand structure
- **Complex multi-file refactors**: Where the model needs to reason across many files simultaneously
- **Long debugging sessions**: Where the evidence trail spans many files

The caution: a bigger context window does not make the model better at finding the relevant information — it makes the haystack bigger. Better context window isolation through [[subagents]] is often more effective than extending context length.

## RPI in Agentic Software Modernization

The RPI workflow is particularly critical for legacy codebase modernization (COBOL-to-Java, etc.). (source: agentic-software-modernization-markus-harrer.md)

The central constraint: legacy systems contain millions of lines — impossible to fit in a context window. The RPI workflow addresses this through surgical context management:

**Research phase** for modernization:
- Analyze only the relevant subset of the existing codebase
- Use software analytics to analyze at scale before engaging the agent
- Enrich the codebase summary with metadata (outdated parts, no-go areas, code that fits current system ideas)

**Plan phase** for modernization:
- Create deterministic change recipes when possible (rule-based search-and-replace rather than generative coding)
- Scope down activities to minimize non-determinism
- Compress intent so the implementation agent receives precise instructions

**Why this matters**: If the plan is non-existent, wrong, or vague, 1,000 lines of generated legacy migration code are worthless and tedious to review. Human intelligence invested at the research and planning steps creates alignment before the massive generated output exists. (source: agentic-software-modernization-markus-harrer.md)

Additional practices for legacy contexts:
- Iterative refinement loops with critic agents (engineer delivers → critic evaluates → engineer improves)
- Traceability links: new code comments linking back to exact line numbers in original legacy code
- Codebase hygiene first: rename cryptic variables, refactor toward known patterns before scaling AI

## Living Spec vs. Waterfall

RPI is not waterfall. Backflow is expected and designed for: (source: building-agent-harness-martin-richards.md)

- Review the research, annotate it, loop with the agent until the spec is right
- Implementation can find gaps in the plan and push back
- When gaps appear, update the plan and continue
- The spec is a living document, not a frozen contract

What separates it from rigid spec-driven development is this tolerance for iteration. The discipline of producing compacted artifacts at each phase boundary is what matters — not following a fixed sequence.

## Progress Compaction for Complex Implementation

For implementations requiring many context windows, the agent maintains a `progress.md` file: (source: research-plan-implement-rpi.md)

```
Goal: [what we're building]
Completed Steps: [✓ Step 1, ✓ Step 2...]
Current Step: [→ Step N currently in progress]
Remaining Steps: [Step N+1, Step N+2...]
Current Issue: [any blocking problem]
```

This file serves as the "boot state" for the next context window — the agent reads it to understand exactly where to resume without needing to re-infer state from git history alone.

## Principles Summary

Key principles distilled across sources: (source: research-plan-implement-review-tyler-burleigh.md)

- AI agents are fallible and cut corners — build in review cycles and expect to catch errors
- Fresh context windows prevent compounding confusion
- Written artifacts are the source of truth, not session memory
- Separate research, planning, and implementation to prevent premature coding
- Small phases reduce blast radius — a bug in Phase 1 doesn't silently propagate through Phases 2-5
- Your time is expensive, tokens are cheap — optimize for output quality, not token efficiency
- Let AI review before you do — by the time you look at it, the obvious problems should be fixed
- Git commits after each phase are your safety net — you can always revert

## Related pages

- [[harness-engineering]]
- [[context-engineering]]
- [[subagents]]
- [[claude-code-subagents]]
- [[spec-driven-development]]
- [[agent-workflows]]
- [[agent-best-practices]]
- [[progressive-disclosure]]
- [[long-context-lost-in-middle]]
- [[human-layer]]
- [[human-agent-collaboration]]
