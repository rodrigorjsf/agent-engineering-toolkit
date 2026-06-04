# Pre-grill triage comment

The canonical structure posted to each issue. The investigator fills it in and writes it to `.prime-issues/issue-<N>.md`; the main thread posts it verbatim.

## Rules

- **The disclaimer line is fixed and load-bearing.** It is the dedup marker — the main thread greps existing comments for the substring `Autonomous pre-grill triage` to avoid double-posting. Do not reword it.
- **Every section is always present.** If a section has nothing, write `_none identified_` — never drop the heading. A predictable shape lets the future griller scan fast.
- **Grounded, not generic.** Claims cite the file/line or the issue comment they came from. Anything not grounded is cut or explicitly marked `(hypothesis)`.
- **Adversarial, not cheerleading.** The doubts section must be willing to say the issue may not be worth doing.

## Template

```markdown
> *Autonomous pre-grill triage — AI-generated insights to seed a future grilling session. Not a decision.*

## Evidence

Grounded, cited findings about this issue against the current repo and docs. Cite `path:line` or the source comment. Mark anything unverified as `(hypothesis)`.

## Ambiguities

What is unclear, underspecified, or open to more than one reading in the issue as written.

## Honest doubts — impact & real value delivery

Adversarial assessment of whether this actually delivers value, and to whom. State the case *against* doing it, not just for. "This may not be worth it because X" is a valid and expected finding.

## Alternative approaches

At least 3 genuinely distinct approaches to the same underlying goal — not three phrasings of one idea. For each: the core idea, and what it trades off versus the others.

1. …
2. …
3. …

## Gotchas

Traps, hidden coupling, surprising constraints, or prior decisions that will bite an implementer.

## Points to clarify

Specific, actionable open questions — the kind a maintainer can answer in one line. Not "please provide more info".

## Other analytical lenses

Additional angles or biases worth probing that the sections above did not cover (e.g. cost-of-delay, reversibility, who is *not* asking for this, second-order effects).

## Suggested grilling agenda

The highest-leverage questions, ranked, to open a future grilling session with. Lead with the one that, if answered, collapses the most uncertainty.
```
