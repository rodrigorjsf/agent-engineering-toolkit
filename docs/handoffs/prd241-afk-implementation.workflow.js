// =============================================================================
// PRD #241 — orchestrate plugin hardening v2 — AFK implementation engine
// =============================================================================
//
// Engine: a single harness dynamic workflow (NOT the /orchestrate plugin — that
// plugin is the artifact being fixed; its capability tools no-op in worktrees
// until #237 lands, so we verify with Bash instead). Every git/gh/build/test
// action lives inside an agent() prompt because the workflow script itself has
// no shell/fs.
//
// Topology:
//   - One umbrella branch  orchestrate/umbrella-prd241  branched off development,
//     with ONE dedicated umbrella worktree (UMBRELLA_WT) for all umbrella-side
//     ops. The main tree is never checked out to the umbrella.
//   - One slice branch + worktree per sub-item, branched from origin/<umbrella>,
//     squash-merged back into the umbrella.
//   - Strictly SEQUENTIAL in the conflict-free wave order.
//
// RESILIENCE (added after run 1 crashed at slice 10 on a transient API overload):
//   - Every agent() call is wrapped in safeAgent(): a throw (transient
//     "API Error: Overloaded", or a subagent that ends without calling
//     StructuredOutput) becomes a GRACEFUL slice-failure, never an aborted run.
//     A single transient error must never kill the other 18 slices.
//   - IDEMPOTENT RE-RUN: pass `args.merged` = the slugs already merged into the
//     umbrella; the loop SKIPS those (pre-seeds them as dep-satisfying) and only
//     attempts the rest. Re-invoke repeatedly (recomputing args.merged from the
//     merged slice-PR head refs each pass) until all 19 are merged — resilience
//     is the idempotent OUTER loop, not per-call retries.
//   - Implementers DELETE any stale remote slice branch before pushing
//     (skip-merged guarantees the branch is unmerged → force is safe), so a
//     pushed-but-unmerged slice from a prior pass re-pushes cleanly.
//   - SUBAGENT_RULES: agents are told they are workflow subagents — do NOT run
//     the project completion protocol / advisor / code-review (that detour is
//     where run 1's overload struck); still verify via Bash; END on StructuredOutput.
//   - Finalize runs ONLY when all 19 are merged (convergence); otherwise the
//     pass reports remaining work and stops, leaving the held PR unopened.
//
// Pre-flight facts (verified by a backbone smoke-test):
//   - npm shim on PATH is broken in NON-INTERACTIVE bash (mise only activates in
//     interactive fish), so every agent repairs PATH via NPM_ENV before npm.
//   - A fresh `git worktree` checkout has NO node_modules, so npm ci is mandatory.
//   - The §11 spec lives at an ABSOLUTE path (HANDOFF), read from the main tree.
//
// AFK policy: slice PRs auto-merge into the umbrella; the FINAL umbrella→
// development PR is opened and the run STOPS — never auto-merged.
//
// Run from the repo root:
//   Workflow({scriptPath: "<this file>", args: { merged: ["237","236", ...] }})
// =============================================================================

export const meta = {
  name: 'prd241-afk-implementation',
  description: 'AFK-implement all of PRD #241 in worktrees (resilient/idempotent), auto-merge slices into one umbrella, hold the final umbrella→development PR for human approval',
  phases: [
    { title: 'Setup', detail: 'idempotent umbrella branch + dedicated umbrella worktree off development' },
    { title: 'Slices', detail: 'sequential per-item: implement → verify → review → fix → merge → re-validate (skips already-merged)' },
    { title: 'Finalize', detail: 'on convergence only: consolidated version cascade + open held umbrella→development PR' },
  ],
}

// ── Constants ────────────────────────────────────────────────────────────────
const BASE = 'development'
const UMBRELLA = 'orchestrate/umbrella-prd241'
const REPO = '/home/rodrigo/Workspace/agent-engineering-toolkit'
const HANDOFF = REPO + '/docs/handoffs/HANDOFF_ORCHESTRATE_PRD241_IMPLEMENTATION.md'
const MCP = 'plugins/orchestrate/orchestrate-mcp'
const UMBRELLA_WT = '/tmp/prd241-umbrella'
const WT_ROOT = '/tmp/prd241-worktrees'
const NPM_ENV = 'export PATH="$(dirname "$(readlink -f "$(command -v node)")"):$PATH"'
const VERIFY = 'npm ci && npm run build && npm run typecheck && npm test'

// Injected into every subagent prompt — keeps run-1's failure mode from recurring.
const SUBAGENT_RULES = `You are a WORKFLOW SUBAGENT, not an interactive human-driven session. Do NOT run any project "Implementation Completion Protocol", advisor() pass, /code-review, /verify, /dream, or memory step — those are for human sessions and only waste your turn (run 1 crashed exactly there, on a transient API overload during a stray "advisor pass"). You DO still verify your own work with the Bash build/test commands specified below — that is mandatory and non-negotiable. Your VERY LAST action MUST be the StructuredOutput tool call returning your result. Even if you hit a transient error (e.g. "API Error: Overloaded"), recover and still END by calling StructuredOutput with your best-known status — NEVER end your turn without it.`

const ORDER = [
  { id: '#237',      issue: 237, src: true,  deps: [] },
  { id: '#236',      issue: 236, src: true,  deps: [] },
  { id: '#231-P2.4', issue: 231, src: false, deps: [] },
  { id: '#230-P1.1', issue: 230, src: true,  deps: [] },
  { id: '#230-P1.2', issue: 230, src: false, deps: ['#236', '#230-P1.1'] },
  { id: '#239',      issue: 239, src: true,  deps: [] },
  { id: '#232-A.1',  issue: 232, src: false, deps: ['#230-P1.2'] },
  { id: '#228',      issue: 228, src: false, deps: [] },
  { id: '#231-P2.1', issue: 231, src: false, deps: [] },
  { id: '#230-P1.3', issue: 230, src: false, deps: ['#237'] },
  { id: '#233',      issue: 233, src: true,  deps: [] },
  { id: '#231-P2.3', issue: 231, src: true,  deps: [] },
  { id: '#231-P2.5', issue: 231, src: true,  deps: ['#237'] },
  { id: '#238',      issue: 238, src: true,  deps: [] },
  { id: '#240',      issue: 240, src: true,  deps: [] },
  { id: '#232-A.2',  issue: 232, src: true,  deps: ['#239', '#240'] },
  { id: '#235',      issue: 235, src: true,  deps: ['#237', '#230-P1.3'] },
  { id: '#231-P2.2', issue: 231, src: true,  deps: ['#237'] },
  { id: '#234',      issue: 234, src: true,  deps: ['#230-P1.2'] },
]

const CHILD_ISSUES = [228, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240]

function slug(id) { return id.replace(/[#.]/g, '').toLowerCase() }
function sliceBranch(item) { return 'orchestrate/prd241-' + slug(item.id) }
function wtPath(item) { return WT_ROOT + '/' + slug(item.id) }

const SLICE_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['merged', 'failed'] },
    sliceBranch: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    verification: { type: 'string', description: 'the Bash commands run and their green/red outcome, quoted' },
    notes: { type: 'string' },
    rootCause: { type: 'string', description: 'on failure: verified|hypothesis + claim + evidence (per #239)' },
  },
  required: ['status', 'sliceBranch', 'verification'],
}

// ── Resilience wrapper ───────────────────────────────────────────────────────
// A thrown agent() (harness StructuredOutput-miss, transient API overload, etc.)
// becomes a graceful failed result so ONE error never aborts the whole run.
async function safeAgent(prompt, opts) {
  try {
    const r = await agent(prompt, opts)
    if (r == null) return { status: 'failed', sliceBranch: '', verification: '', notes: 'agent returned null (skipped)', rootCause: 'verified: agent produced no result' }
    return r
  } catch (e) {
    const msg = String(e && e.message ? e.message : e).slice(0, 300)
    log(`⚠ agent ${opts && opts.label} threw — treating as graceful failure: ${msg}`)
    return { status: 'failed', sliceBranch: '', verification: '', notes: `harness/agent error: ${msg}`, rootCause: 'verified: the agent threw or ended without StructuredOutput (e.g. transient API overload); the slice will be retried on the next idempotent re-run' }
  }
}

// ── Agent prompts ────────────────────────────────────────────────────────────
function implementerPrompt(item) {
  const branch = sliceBranch(item)
  const wt = wtPath(item)
  return `${SUBAGENT_RULES}

You are the IMPLEMENTER for PRD #241 sub-item ${item.id}, in an AFK run that integrates each slice into the umbrella branch ${UMBRELLA}.

1. SPEC. Read this item's full spec from the ABSOLUTE path ${HANDOFF} — find the section headed "${item.id}". Implement EXACTLY its target files, steps, and acceptance criteria (including the docs-in-sync surfaces). Do not exceed scope. If the spec and the decision ledger ever disagree, the ledger wins.
   SCOPE CARVE-OUT (overrides the spec): do NOT bump plugins/orchestrate/.claude-plugin/plugin.json or .claude-plugin/marketplace.json versions, and do NOT add a "Closes #N" trailer. The version cascade is consolidated into ONE final bump owned by the finalizer (handoff §8); issue-closing happens via the final umbrella PR (§7). Skip any version-bump / issue-close step the spec lists.

2. WORKTREE. Create the slice worktree from the CURRENT umbrella tip. Run from the repo root; idempotent for re-runs:
     git fetch origin ${UMBRELLA}
     git worktree remove --force ${wt} 2>/dev/null || true
     git branch -D ${branch} 2>/dev/null || true
     git worktree add -b ${branch} ${wt} origin/${UMBRELLA}
   Branch from origin/${UMBRELLA} (the remote-tracking ref) — always current, never conflicts with a checkout.

3. CHANGES. Make the code/doc changes in ${wt}.

4. VERIFY with BASH (NOT the plugin's MCP capability tools — they no-op pre-#237). The npm shim on PATH is broken in non-interactive bash (mise not activated), so repair PATH first; a fresh worktree has NO node_modules so install is MANDATORY:
     ${NPM_ENV}
     cd ${wt}/${MCP} && ${VERIFY}
   ${item.src ? 'This item touches src/ → after a GREEN build the regenerated dist/ is part of the slice; git add it.' : 'This item is doc/config-only → no dist/ rebuild.'}

5. EVIDENCE. Capture the actual command output — a green claim must map to a real run this turn.

6. COMMIT + PUSH. Commit on ${branch} with message "${item.id}: <summary>" (NO Closes trailer). A prior failed pass may have left a stale remote branch; clear it first (safe — an unmerged slice branch only), then push:
     git push origin --delete ${branch} 2>/dev/null || true
     git push -u origin ${branch}

7. RETURN sliceBranch="${branch}", the changed-file list, and the quoted verification. If you cannot finish or verification stays red, return status=failed with a structured rootCause (verified|hypothesis + evidence), leaving the worktree ${wt} on disk. Remember: your final action is the StructuredOutput call — always.`
}

function reviewerPrompt(item, impl) {
  const branch = sliceBranch(item)
  const wt = wtPath(item)
  return `${SUBAGENT_RULES}

You are the REVIEWER for PRD #241 sub-item ${item.id}. The implementer reported: ${JSON.stringify(impl).slice(0, 1200)}.

The slice worktree ALREADY EXISTS at ${wt} — cd into it; do NOT run "git worktree add".
Read the spec section "${item.id}" from the ABSOLUTE path ${HANDOFF} and the slice diff (git diff origin/${UMBRELLA}...${branch}). Verify:
 (a) every acceptance criterion is met, including docs-in-sync surfaces — EXCEPT the version cascade and "Closes #N", deferred to the finalizer (§7–§8): do NOT fail for a missing version bump/close trailer; DO flag it out-of-scope if the implementer added one;
 (b) in-scope (no edits beyond the spec);
 (c) re-run verification via Bash from the worktree and confirm green:
       ${NPM_ENV}
       cd ${wt}/${MCP} && ${VERIFY}
 (d) for src/ items, dist/ was rebuilt and staged/committed.
Return status=merged only if all hold; otherwise status=failed with the specific gaps in notes. Echo sliceBranch="${branch}".`
}

function fixerPrompt(item, problem) {
  const branch = sliceBranch(item)
  const wt = wtPath(item)
  return `${SUBAGENT_RULES}

You are the FIXER for PRD #241 sub-item ${item.id}. A prior step failed: ${problem.slice(0, 1500)}.

The slice worktree ALREADY EXISTS at ${wt} — cd into it; do NOT run "git worktree add". Repair the specific failure (review gap, red build/test, missing dist/ rebuild) WITHOUT expanding scope beyond the spec ("${item.id}" at ${HANDOFF}). Re-verify via Bash until green:
     ${NPM_ENV}
     cd ${wt}/${MCP} && ${VERIFY}
Re-stage dist/ if src/ changed, commit on ${branch}, and push (git push). Return status=merged with the quoted green verification and sliceBranch="${branch}", or status=failed with a structured rootCause if unfixable.`
}

function integratePrompt(item, impl) {
  const branch = sliceBranch(item)
  const wt = wtPath(item)
  return `${SUBAGENT_RULES}

You are the INTEGRATOR for PRD #241 sub-item ${item.id}. The slice branch ${branch} passed review and is pushed to origin.

1. MERGE into the umbrella (INTERNAL umbrella merge — auto-merge is fine; only the FINAL umbrella→development PR is human-gated). First check whether it is already integrated: if "gh pr view ${branch} --json state -q .state" is MERGED, or origin/${UMBRELLA} already contains ${branch}'s commits, SKIP to step 2. Otherwise:
     gh pr create --base ${UMBRELLA} --head ${branch} --title "${item.id}: slice" --body "Internal umbrella slice for PRD #241 ${item.id}." 2>/dev/null || true
     for i in 1 2 3; do gh pr merge ${branch} --squash --admin --delete-branch && break || sleep 5; done
   (The local-branch-delete may warn if a worktree holds it — ignore; the squash-merge itself is what matters.)

2. SYNC the umbrella in its DEDICATED worktree (do NOT touch the main tree):
     ${NPM_ENV}
     cd ${UMBRELLA_WT} && git fetch origin ${UMBRELLA} && git reset --hard origin/${UMBRELLA}

3. POST-MERGE VALIDATION on the umbrella worktree:
     cd ${UMBRELLA_WT}/${MCP} && ${VERIFY}
   ${item.src
      ? `Then rebuild dist/ and commit ONLY if it actually changed (the implementer already built dist/ on the slice, so this is normally a determinism no-op — an empty commit must NOT fail the step):
     cd ${UMBRELLA_WT}
     git add -A
     git diff --cached --quiet || git commit -m "${item.id}: rebuild dist on umbrella"
     git push origin ${UMBRELLA}`
      : `If any local umbrella commit was made, push it: cd ${UMBRELLA_WT} && git push origin ${UMBRELLA}.`}

4. ON MERGE CONFLICT or POST-MERGE VALIDATION RED: report status=failed with the failing output / conflicting files in notes (the orchestrator spawns a conflict-resolver / fixer). Do NOT force anything.

5. ON A CLEAN MERGE: remove the slice worktree and delete the local slice branch, then return status=merged with the quoted post-merge validation outcome:
     git worktree remove --force ${wt} 2>/dev/null || true
     git branch -D ${branch} 2>/dev/null || true
   Echo sliceBranch="${branch}".`
}

function conflictResolverPrompt(item, problem) {
  const branch = sliceBranch(item)
  return `${SUBAGENT_RULES}

You are the UMBRELLA-RECOVERY agent for PRD #241 sub-item ${item.id}. Integrating it into ${UMBRELLA} failed: ${problem.slice(0, 1500)}.

Work in the DEDICATED umbrella worktree ${UMBRELLA_WT} (do NOT touch the main tree). First sync it: ${NPM_ENV}; cd ${UMBRELLA_WT} && git fetch origin ${UMBRELLA} ${branch} && git reset --hard origin/${UMBRELLA}. Then diagnose and fix:
 - MERGE CONFLICT (the slice never merged): squash-merge the slice locally and resolve honoring BOTH the prior umbrella content and this slice's spec ("${item.id}" at ${HANDOFF}):
       git merge --squash origin/${branch}    # resolve conflicts, then: git add -A && git commit
 - POST-MERGE INTEGRATION BREAK (slice merged but umbrella now red): repair on the umbrella without scope creep.
Then re-verify via Bash until green:
     cd ${UMBRELLA_WT}/${MCP} && ${VERIFY}
Rebuild + stage dist/ if src/ changed (guard empty commits: git add -A; git diff --cached --quiet || git commit -m "${item.id}: umbrella recovery"). Commit the resolved state, then PUSH (mandatory — the next slice fetches the umbrella tip):
     cd ${UMBRELLA_WT} && git push origin ${UMBRELLA}
Return status=merged with the quoted green verification, or status=failed with a structured rootCause if unrecoverable.`
}

// ── Slice cycle (sequential) ─────────────────────────────────────────────────
async function runSlice(item) {
  const impl = await safeAgent(implementerPrompt(item), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `impl:${item.id}` })
  if (impl.status === 'failed') {
    log(`SLICE ${item.id}: implementer FAILED — ${impl.rootCause || impl.notes}`)
    return { item, status: 'failed', stage: 'implement', detail: impl }
  }

  let review = await safeAgent(reviewerPrompt(item, impl), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `review:${item.id}` })
  for (let attempt = 0; attempt < 2 && review.status === 'failed'; attempt++) {
    log(`SLICE ${item.id}: review failed (attempt ${attempt + 1}) — invoking fixer`)
    const fix = await safeAgent(fixerPrompt(item, review.notes || review.verification || ''), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `fix:${item.id}:${attempt + 1}` })
    if (fix.status === 'failed') { return { item, status: 'failed', stage: 'fix', detail: fix } }
    review = await safeAgent(reviewerPrompt(item, fix), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `review:${item.id}:r${attempt + 1}` })
  }
  if (review.status === 'failed') { return { item, status: 'failed', stage: 'review', detail: review } }

  let integ = await safeAgent(integratePrompt(item, impl), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `merge:${item.id}` })
  for (let attempt = 0; attempt < 2 && integ.status === 'failed'; attempt++) {
    log(`SLICE ${item.id}: integration failed (attempt ${attempt + 1}) — resolving`)
    const fix = await safeAgent(conflictResolverPrompt(item, integ.notes || integ.verification || ''), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `conflict:${item.id}:${attempt + 1}` })
    if (fix.status === 'failed') { return { item, status: 'failed', stage: 'integrate', detail: fix } }
    integ = await safeAgent(integratePrompt(item, impl), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `merge:${item.id}:r${attempt + 1}` })
  }
  if (integ.status === 'failed') { return { item, status: 'failed', stage: 'integrate', detail: integ } }

  log(`SLICE ${item.id}: MERGED into ${UMBRELLA} ✓`)
  return { item, status: 'merged', verification: integ.verification }
}

// ── Phase 1: Setup (idempotent — safe across re-runs) ────────────────────────
phase('Setup')
const setup = await safeAgent(
  `${SUBAGENT_RULES}

Set up / refresh the AFK umbrella for PRD #241 using Bash + gh from the repo root. Do NOT modify any tracked file. Fully idempotent — never reset an umbrella that already carries merged slices:

1. git fetch origin ${BASE} ${UMBRELLA}
2. Ensure the umbrella branch exists on the remote (create from origin/${BASE} only if absent):
     git ls-remote --heads origin ${UMBRELLA} | grep -q ${UMBRELLA} || { git branch ${UMBRELLA} origin/${BASE} 2>/dev/null || true; git push -u origin ${UMBRELLA}; }
3. Clean any stale worktrees from a prior/crashed run (remove the dirs, then prune git's dangling registrations — no fragile shell loop needed):
     git worktree remove --force ${UMBRELLA_WT} 2>/dev/null || true
     rm -rf ${WT_ROOT} 2>/dev/null || true
     git worktree prune
4. Create a FRESH dedicated umbrella worktree at the REMOTE tip (all umbrella-side ops run here; the main tree stays on ${BASE}):
     git branch -f ${UMBRELLA} origin/${UMBRELLA} 2>/dev/null || git branch ${UMBRELLA} origin/${UMBRELLA}
     git worktree add ${UMBRELLA_WT} ${UMBRELLA}
5. Prime deps so umbrella-side validation is fast: ${NPM_ENV}; cd ${UMBRELLA_WT}/${MCP} && npm ci.
6. Report the umbrella tip SHA (git -C ${UMBRELLA_WT} rev-parse HEAD).`,
  { phase: 'Setup', label: 'umbrella-setup' }
)
log(`Umbrella ready: ${String(setup && setup.notes ? setup.notes : setup).slice(0, 200)}`)

// ── Phase 2: Slices (idempotent: skip already-merged, attempt the rest) ───────
phase('Slices')
// Discover already-merged slices from GROUND TRUTH (gh), not from args plumbing
// (args can arrive stringified or absent — run 2 did a full re-run because of that).
// This makes every re-run self-correcting regardless of how args is delivered.
const DISCOVER_SCHEMA = { type: 'object', additionalProperties: false, properties: { mergedSlugs: { type: 'array', items: { type: 'string' } } }, required: ['mergedSlugs'] }
const disc = await safeAgent(
  `${SUBAGENT_RULES}

READ-ONLY task. List the slug of every slice already squash-merged into ${UMBRELLA}. Run exactly this from the repo root and return its JSON-array output as mergedSlugs:
  gh pr list --base ${UMBRELLA} --state merged --json headRefName --jq '[.[].headRefName | sub("orchestrate/prd241-";"")]'
Example return: {"mergedSlugs":["237","236","230-p11"]}. Modify nothing; your final action is StructuredOutput.`,
  { schema: DISCOVER_SCHEMA, phase: 'Slices', label: 'discover-merged' }
)
let argObj = args
if (typeof argObj === 'string') { try { argObj = JSON.parse(argObj) } catch (e) { argObj = {} } }
const argMerged = (argObj && Array.isArray(argObj.merged)) ? argObj.merged : []
const discMerged = (disc && Array.isArray(disc.mergedSlugs)) ? disc.mergedSlugs : []
const mergedSlugs = new Set([...discMerged, ...argMerged])
log(`Skip-set (already merged — ${discMerged.length} from gh + ${argMerged.length} from args): ${[...mergedSlugs].join(', ') || '(none — full run)'}`)

const done = new Set() // ids merged (pre-seeded + merged this pass) — satisfies deps
const bad = new Set()  // ids failed/skipped this pass — dependents skip
for (const item of ORDER) { if (mergedSlugs.has(slug(item.id))) done.add(item.id) }

const results = []
for (const item of ORDER) {
  if (done.has(item.id)) {
    results.push({ item, status: 'merged', preexisting: true })
    continue
  }
  const unmetDeps = (item.deps || []).filter((d) => !done.has(d))
  if (unmetDeps.length > 0) {
    log(`⤼ ${item.id} SKIPPED — unmet dependency: ${unmetDeps.join(', ')}`)
    results.push({ item, status: 'skipped', reason: `unmet dependency: ${unmetDeps.join(', ')}` })
    bad.add(item.id)
    continue
  }
  const r = await runSlice(item)
  results.push(r)
  if (r.status === 'merged') { done.add(item.id) }
  else { bad.add(item.id); log(`⚠ ${item.id} FAILED at ${r.stage}; preserved. Dependents will be skipped this pass.`) }
}

const mergedThisPass = results.filter((r) => r.status === 'merged' && !r.preexisting).map((r) => r.item.id)
const allMergedIds = ORDER.filter((it) => done.has(it.id)).map((it) => it.id)
const failed = results.filter((r) => r.status === 'failed').map((r) => `${r.item.id}@${r.stage}`)
const skipped = results.filter((r) => r.status === 'skipped').map((r) => `${r.item.id}(${r.reason})`)
const converged = allMergedIds.length === ORDER.length
log(`Pass done: ${allMergedIds.length}/${ORDER.length} merged total (${mergedThisPass.length} this pass), ${failed.length} failed, ${skipped.length} skipped`)

// ── Phase 3: Finalize — ONLY on convergence ──────────────────────────────────
if (!converged) {
  const remaining = ORDER.filter((it) => !done.has(it.id)).map((it) => slug(it.id))
  log(`NOT CONVERGED — ${remaining.length} slice(s) remain: ${remaining.join(', ')}. Re-invoke with updated args.merged to retry.`)
  return { converged: false, mergedTotal: allMergedIds.length, mergedThisPass, failed, skipped, remainingSlugs: remaining, mergedSlugs: ORDER.filter((it) => done.has(it.id)).map((it) => slug(it.id)) }
}

phase('Finalize')
const fullyDone = CHILD_ISSUES.filter((n) => {
  const subs = ORDER.filter((it) => it.issue === n)
  return subs.length > 0 && subs.every((it) => done.has(it.id))
})
const partial = CHILD_ISSUES.filter((n) => !fullyDone.includes(n))
const closes = fullyDone.map((n) => `Closes #${n}`).join('\n')
const finalize = await safeAgent(
  `${SUBAGENT_RULES}

You are FINALIZING the PRD #241 AFK run on the umbrella ${UMBRELLA}. All 19 sub-items are merged. Work in the dedicated umbrella worktree ${UMBRELLA_WT}.

1. SYNC: ${NPM_ENV}; cd ${UMBRELLA_WT} && git fetch origin ${UMBRELLA} && git reset --hard origin/${UMBRELLA}.

2. CONSOLIDATED VERSION CASCADE (ONE bump for the whole PRD — the per-slice specs deferred this here to avoid 15 serialized bumps). Bump plugins/orchestrate/.claude-plugin/plugin.json and the root .claude-plugin/marketplace.json orchestrate entry + its top-level version (mirror the magnitude; a feature release → MINOR bump unless a breaking change shipped — for this PRD: plugin 1.2.0→1.3.0, marketplace orchestrate entry 1.2.0→1.3.0, top-level 1.6.0→1.7.0). The Cursor marketplace entry carries no orchestrate version field — leave it. Then rebuild dist/ once and commit + push:
     cd ${UMBRELLA_WT}/${MCP} && npm ci && npm run build
     cd ${UMBRELLA_WT} && git add -A && git commit -m "chore(orchestrate): consolidated version cascade for PRD #241 (1.2.0→1.3.0)" && git push origin ${UMBRELLA}

3. OPEN THE FINAL PR from ${UMBRELLA} into ${BASE} and DO NOT MERGE IT. The body MUST contain these auto-close trailers verbatim (ONLY fully-implemented issues):
${closes || '(none)'}
   ${partial.length ? `Do NOT add Closes for these PARTIALLY-implemented issues: ${partial.map((n) => '#' + n).join(', ')}.` : 'All 12 child issues are fully implemented.'}
   Then a summary: all 19 sub-items merged; note the recovery (run 1 crashed at #230-P1.3 on a transient API overload; recovered via idempotent re-run); and a one-line note that the reviewer should expect ONE large combined diff (the AFK safety valve).

4. Report the final PR URL. STOP — never merge it.`,
  { phase: 'Finalize', label: 'finalize-and-hold-pr' }
)

return { converged: true, merged: allMergedIds, closedOnMerge: fullyDone, leftOpen: partial, finalPR: String(finalize && finalize.notes ? finalize.notes : finalize) }
