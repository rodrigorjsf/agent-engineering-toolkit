# Orchestration skeleton

A known-good Workflow fan-out for the investigation phase. Adapt it — do not re-derive it
from scratch. The comments encode lessons that are expensive to relearn.

## Division of labor

- **Main thread (before Workflow):** scope + dedup via `gh` (ground truth), then build a
  clean array of issue payloads `{ number, title, body, comments, labels }`. The Workflow
  script cannot run `gh` (no shell/filesystem APIs in the script body), so it must receive
  ready-made payloads via `args`.
- **Workflow:** orientation digest agent → fan-out one investigator per issue. Each writes
  its analysis to a temp file and returns a tiny pointer.
- **Main thread (after Workflow):** post + label + dedup + cleanup, serially. See
  [AFK-GUARDRAILS.md](AFK-GUARDRAILS.md).

## Why pointers, not analyses

Investigators return a tiny `{issue, path, status, summary}` object, never the analysis
text. The markdown lives on disk in `.prime-issues/issue-<N>.md`. This keeps N full
analyses out of the orchestrator's context window (anti context-rot) — the single most
important property of this design.

## Skeleton

```javascript
export const meta = {
  name: 'prime-issues-investigate',
  description: 'Fan out one pre-grill triage investigator per open issue',
  phases: [
    { title: 'Orient', detail: 'map repo + docs once' },
    { title: 'Investigate', detail: 'one investigator per issue, writes temp file' },
  ],
}

// args arrives stringified or absent depending on the caller — parse defensively.
const issues = Array.isArray(args) ? args : JSON.parse(args || '[]')

// Tiny FLAT schema. Heavy nested schemas + heavy reading make agents skip
// StructuredOutput — keep it flat and small. The analysis is NOT a field here.
const POINTER = {
  type: 'object',
  additionalProperties: false,
  properties: {
    issue:   { type: 'number' },
    path:    { type: 'string' },
    status:  { type: 'string', enum: ['ok', 'failed'] },
    summary: { type: 'string' },
  },
  required: ['issue', 'path', 'status', 'summary'],
}

// An agent that ends WITHOUT calling StructuredOutput aborts every sibling. safeAgent
// converts any throw into a 'failed' pointer so one bad issue never kills the batch.
async function safeAgent(prompt, opts) {
  try {
    return await agent(prompt, { schema: POINTER, phase: 'Investigate', ...opts })
  } catch (e) {
    return { issue: opts._issue, path: opts._path, status: 'failed', summary: String(e).slice(0, 200) }
  }
}

phase('Orient')
const digest = await agent(
  'Produce the compact repo + docs orientation digest. Probe README, CONTEXT.md, docs/, ' +
  'docs/adr, wiki/, manifests in order; return paths + one-liners, not file contents.',
  { label: 'orient', phase: 'Orient' }
)

phase('Investigate')
const pointers = await parallel(issues.map((iss) => () => {
  const tmp = `.prime-issues/issue-${iss.number}.md`
  const prompt = [
    INVESTIGATOR_ROLE,            // from INVESTIGATOR-PROMPT.md, with digest + issue interpolated
    `\n## Repository orientation (shared digest)\n${digest}`,
    `\n## The issue\nNumber: ${iss.number}\nTitle: ${iss.title}\n` +
      `Labels: ${(iss.labels || []).join(', ')}\nBody:\n${iss.body}\n` +
      `Comments:\n${(iss.comments || []).join('\n---\n')}`,
    `\n## Output\nWrite the full analysis to ${tmp}. Return ONLY the pointer ` +
      `{issue:${iss.number}, path:"${tmp}", status, summary}. Do not end your turn ` +
      `without returning the structured pointer.`,
  ].join('\n')
  return safeAgent(prompt, { label: `issue-${iss.number}`, _issue: iss.number, _path: tmp })
}))

return pointers  // tiny array; main thread posts from the temp files these point to
```

## Concurrency

`parallel()` here is the simple choice: one stage (investigate), all results collected for
the serial posting phase. The runtime caps concurrent agents (~`min(16, cores-2)`); passing
all issues is fine — excess queue and drain. For very large backlogs the cap is the natural
throttle; no manual batching needed.
