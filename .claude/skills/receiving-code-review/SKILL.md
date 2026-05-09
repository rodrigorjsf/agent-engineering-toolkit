---
name: receiving-code-review
description: 'Process code-review feedback with technical rigor — verify before implementing, no performative agreement. Use when receiving PR review comments.'
argument-hint: <pr-number>[:review-id]
---

# Code Review Reception

## Overview

Code review requires technical evaluation, not emotional performance.

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort. Do not assume feedback is correct — evaluate it against the codebase and context first.

## The Response Pattern

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

## Forbidden Responses

**NEVER:**

- "You're absolutely right!" (explicit CLAUDE.md violation)
- "Great point!" / "Excellent feedback!" (performative)
- "Let me implement that now" (before verification)

**INSTEAD:**

- Restate the technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Just start working (actions > words)

## Handling Unclear Feedback

```
IF any item is unclear:
  STOP - do not implement anything yet
  ASK for clarification on unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

**Example:**

```
your human partner: "Fix 1-6"
You understand 1,2,3,6. Unclear on 4,5.

❌ WRONG: Implement 1,2,3,6 now, ask about 4,5 later
✅ RIGHT: "I understand items 1,2,3,6. Need clarification on 4 and 5 before proceeding."
```

## Source-Specific Handling

### From your human partner

- **Trusted** - implement after understanding
- **Still ask** if scope unclear
- **No performative agreement**
- **Skip to action** or technical acknowledgment

### From External Reviewers

```
BEFORE implementing:
  1. Check: Technically correct for THIS codebase?
  2. Check: Breaks existing functionality?
  3. Check: Reason for current implementation?
  4. Check: Works on all platforms/versions?
  5. Check: Does reviewer understand full context?

IF suggestion seems wrong:
  Push back with technical reasoning

IF can't easily verify:
  Say so: "I can't verify this without [X]. Should I [investigate/ask/proceed]?"

IF conflicts with your human partner's prior decisions:
  Stop and discuss with your human partner first
```

**your human partner's rule:** "External feedback - be skeptical, but check carefully"

## YAGNI Check for "Professional" Features

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage

  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  IF used: Then implement properly
```

**your human partner's rule:** "You and reviewer both report to me. If we don't need this feature, don't add it."

## Implementation Order

```
FOR multi-item feedback:
  1. Clarify anything unclear FIRST
  2. Then implement in this order:
     - Blocking issues (breaks, security)
     - Simple fixes (typos, imports)
     - Complex fixes (refactoring, logic)
  3. Test each fix individually
  4. Verify no regressions
```

## When To Push Back

Push back when:

- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Legacy/compatibility reasons exist
- Conflicts with your human partner's architectural decisions

**How to push back:**

- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests/code
- Involve your human partner if architectural

**Signal if uncomfortable pushing back out loud:** "Strange things are afoot at the Circle K"

## Acknowledging Correct Feedback

When feedback IS correct:

```
✅ "Fixed. [Brief description of what changed]"
✅ "Good catch - [specific issue]. Fixed in [location]."
✅ [Just fix it and show in the code]

❌ "You're absolutely right!"
❌ "Great point!"
❌ "Thanks for catching that!"
❌ "Thanks for [anything]"
❌ ANY gratitude expression
```

**Why no thanks:** Actions speak. Just fix it. The code itself shows you heard the feedback.

**If you catch yourself about to write "Thanks":** DELETE IT. State the fix instead.

## Gracefully Correcting Your Pushback

If you pushed back and were wrong:

```
✅ "You were right - I checked [X] and it does [Y]. Implementing now."
✅ "Verified this and you're correct. My initial understanding was wrong because [reason]. Fixing."

❌ Long apology
❌ Defending why you pushed back
❌ Over-explaining
```

State the correction factually and move on.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Performative agreement | State requirement or just act |
| Blind implementation | Verify against codebase first |
| Batch without testing | One at a time, test each |
| Assuming reviewer is right | Check if breaks things |
| Avoiding pushback | Technical correctness > comfort |
| Partial implementation | Clarify all items first |
| Can't verify, proceed anyway | State limitation, ask for direction |

## Real Examples

**Performative Agreement (Bad):**

```
Reviewer: "Remove legacy code"
❌ "You're absolutely right! Let me remove that..."
```

**Technical Verification (Good):**

```
Reviewer: "Remove legacy code"
✅ "Checking... build target is 10.15+, this API needs 13+. Need legacy for backward compat. Current impl has wrong bundle ID - fix it or drop pre-13 support?"
```

**YAGNI (Good):**

```
Reviewer: "Implement proper metrics tracking with database, date filters, CSV export"
✅ "Grepped codebase - nothing calls this endpoint. Remove it (YAGNI)? Or is there usage I'm missing?"
```

**Unclear Item (Good):**

```
your human partner: "Fix items 1-6"
You understand 1,2,3,6. Unclear on 4,5.
✅ "Understand 1,2,3,6. Need clarification on 4 and 5 before implementing."
```

## GitHub Thread Replies

When replying to inline review comments on GitHub, reply in the comment thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), not as a top-level PR comment.

## Non-Interactive Mode

When running in CI or any other non-interactive environment with no human available:

- Scope work to the specific review when a review ID is provided in the argument (`<pr-number>:<review-id>`)
- Do not pause waiting for clarification
- Reclassify any `DEFER` item to `SKIP` with the reason `Needs human decision in non-interactive mode`
- If the `pr-comment-resolver` agent is unavailable in the current environment, perform the same reply-and-resolve work inline

## PR Comment Analysis Workflow

When invoked with a PR argument, run this automated workflow end-to-end.

### Phase 1: Fetch PR Comments

```bash
# Resolve repo from git remote
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
RAW_ARGUMENTS=$ARGUMENTS
PR="${RAW_ARGUMENTS%%:*}"
REVIEW_ID=""

if [[ "$RAW_ARGUMENTS" == *:* ]]; then
  REVIEW_ID="${RAW_ARGUMENTS#*:}"
fi

# Fetch inline review comments
if [[ -n "$REVIEW_ID" ]]; then
  gh api repos/$REPO/pulls/$PR/reviews/$REVIEW_ID/comments --paginate
else
  gh api repos/$REPO/pulls/$PR/comments --paginate
fi

# Fetch review-level summaries (for context)
gh api repos/$REPO/pulls/$PR/reviews --paginate
```

Collect every fetched comment. Note the `id`, `user.login`, `user.type`, `path`, `line`, and `body` for each.

If `REVIEW_ID` is set, do NOT expand scope to older reviews unless the current review payload is incomplete or clearly references an unresolved earlier thread that must be handled together.

### Phase 2: Triage Each Comment

Build a triage table BEFORE touching any code. For each comment:

1. Read the file and line(s) referenced by the comment
2. Evaluate using the criteria in this skill: YAGNI check, technical correctness, compatibility, context
3. Assign a verdict:

| Verdict | Meaning |
|---------|---------|
| `FIX` | Real problem confirmed in codebase — implement |
| `SKIP` | Not a real problem, incorrect assumption, YAGNI, or out of scope |
| `DEFER` | Ambiguous — needs human decision before acting |

Do NOT implement anything during triage. Finish the full table first.

If any comment is `DEFER`:

- In interactive mode: stop and present the deferred items to the user before proceeding.
- In non-interactive mode: reclassify it to `SKIP` with the reason `Needs human decision in non-interactive mode`, then continue.

### Phase 3: Implement Fixes

For each `FIX` verdict, in priority order (blocking → simple → complex):

1. Apply the fix
2. Verify no regressions
3. Commit atomically — one logical change per commit, following Git Conventions

Record the commit SHA for each fix.

### Phase 4: Publish Comment Resolutions

After ALL commits are done, build a resolution payload — one entry per comment:

```
comment_id | action | commit_sha | reason
```

If the `pr-comment-resolver` agent is available in the current environment, invoke it with `run_in_background: true`. Pass the following as the task:

```
REPO: {owner/repo}
PR: {pr_number}
RESOLUTIONS:
{the full resolution table above}
```

**Do NOT await the result.** The agent runs in the background and handles all GitHub comment replies and thread resolutions. Continue immediately to Phase 5.

If the agent is unavailable, perform the same work inline in this session:

1. Split `REPO` into `owner` and `repo` first:
   ```bash
   owner=$(echo "$REPO" | cut -d/ -f1)
   repo=$(echo "$REPO" | cut -d/ -f2)
   ```
2. Reply to each inline review comment in its thread using `gh api repos/$owner/$repo/pulls/$PR/comments/$comment_id/replies -f body="$reply_body"`
3. Resolve thread node IDs with GraphQL:
   ```bash

   gh api graphql -f query='
   query($owner: String!, $repo: String!, $pr: Int!) {
     repository(owner: $owner, name: $repo) {
       pullRequest(number: $pr) {
         reviewThreads(first: 100) {
           nodes {
             id
             isResolved
             comments(first: 1) {
               nodes { databaseId }
             }
           }
         }
       }
     }
   }' -f owner="$owner" -f repo="$repo" -F pr=$PR
   ```
4. Map each `comment_id` in your resolution table to a thread node ID using `databaseId`, then resolve each thread:
   ```bash
   gh api graphql -f query='
   mutation($threadId: ID!) {
     resolveReviewThread(input: {threadId: $threadId}) {
       thread { isResolved }
     }
   }' -f threadId="$thread_node_id"
   ```
5. Skip and continue if a single reply or thread resolution fails
6. Keep replies factual and brief:
   - `FIX`: `Fixed in {commit_sha}. {brief description}.`
   - `SKIP`: `Evaluated — skipping. {reason}`
   - `DEFER`: `Deferred for human review. {reason}`

### Phase 5: Report to User

```
PR #{PR} analysis complete.

Triage: {total} comments — {fix_count} fixed, {skip_count} skipped, {defer_count} deferred
Commits: {list of commit SHAs with one-line descriptions}
Skipped: {list of skipped items with brief reasons}
Comment resolver: dispatched in background or completed inline
```

## The Bottom Line

**External feedback = suggestions to evaluate, not orders to follow.**

Verify. Question. Then implement.

No performative agreement. Technical rigor always.
