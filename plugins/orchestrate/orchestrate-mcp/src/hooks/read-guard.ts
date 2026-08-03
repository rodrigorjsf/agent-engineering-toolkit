import * as path from "path";

// ─── Read guard — the orchestrator's slice-artifact read boundary ─────────────
//
// ADR-0017 gives the slice-executor delegation layer a read boundary: the
// orchestrator learns a slice's outcome from the executor's result envelope,
// never by opening the slice's own artifacts. That boundary buys the whole
// context saving the delegation layer exists for, and until now it was prose
// only — and prose guards erode late in a long run, which is exactly when the
// saving matters most.
//
// This module is the mechanical half. It decides, for one `PreToolUse` hook
// event, whether a tool call is the orchestrator reaching for a slice-internal
// artifact. It is DEFENCE IN DEPTH, not a dependency: the prose rule in
// `references/run-state.md` stays load-bearing, for the reasons in "Honest
// limitations" below. A later refactor must not delete it on the grounds that
// this hook covers it.
//
// PURE by construction — no filesystem access, no `process.cwd()`. The active
// run is discovered in the CLI entry point (`read-guard-cli.ts`) via
// `run-discovery.ts` and passed in, exactly as `context-watchdog-cli.ts` calls
// `findActiveRunForSession` rather than the watchdog module doing it. `cwd` is
// likewise an ARGUMENT: a bare `path.resolve` would silently fall back to the
// hook PROCESS's working directory and stop matching every relative path a
// Bash command carries.
//
// ─── What it guards, and what it deliberately does not ───────────────────────
//
// Deny requires ALL of:
//
//   1. No `agent_id` on the event — see "identity" below.
//   2. An active run id — with none, every path is allowed (AC4).
//   3. The resolved path sits DIRECTLY IN `<cwd>/.orchestrate/runs/<runId>/`
//      and its basename matches {@link GUARDED_BASENAME}.
//
// Clause 3 is narrower than the run directory ON PURPOSE. The same directory
// holds `run-state.json` — the orchestrator's OWN checkpoint, which it reads
// and writes at every slice — plus `context-flag.json`, `spawn-log.jsonl` and
// three rendered `.html` artifacts (`run-dir.ts`). A run-directory-wide rule
// would break every run, silently, and only in the field. Containment is by
// `path.dirname` equality rather than a prefix test, because `runs/<id>` is a
// string prefix of `runs/<id>-suffix`; that also neutralises `..` traversal.
//
// The basename pattern is structural rather than literal because the issue
// number is part of the contract: the record is deliberately per-slice, not
// per-run (`run-dir.ts`), so a parallel wave's siblings never clobber each
// other, and `run-dir.ts` declares the `slice-<issue>-progress.json` filename
// a PUBLIC CONTRACT rather than an implementation detail.
//
// ─── Identity: `agent_id`, not `agent_type` ──────────────────────────────────
//
// The vendor hook reference (`docs/claude-code/hooks/claude-hook-reference-doc.md`,
// the "when running with --agent or inside a subagent" input table) documents
// `agent_id` as "present only when the hook fires inside a subagent call. Use
// this to distinguish subagent hook calls from main-thread calls." `agent_type`
// is ALSO present when the session itself runs with `--agent`, so it can be
// non-empty on a main thread and is the wrong discriminator.
//
// This is an ALLOW-BY-PRESENCE test, and the asymmetry is worth naming: if the
// platform ever stopped emitting `agent_id`, this guard would over-block every
// subagent rather than under-block the orchestrator — the UNSAFE direction
// relative to "never blocks a call it did not intend to block". It cannot be
// fixed from inside the hook; the citation above is here so the dependency is
// visible, and the retained prose rule is the designed fallback either way.
// An empty string is treated as absent, the same guard `context-watchdog-cli.ts`
// applies to `session_id`.
//
// ─── The deny contract ───────────────────────────────────────────────────────
//
// {@link denyPayload} returns the exact wire object. Per the vendor mirror,
// `PreToolUse` returns its decision inside `hookSpecificOutput`; the top-level
// `decision`/`reason` fields are DEPRECATED for this event. Only a `deny`
// decision's reason is shown to Claude ("for allow and ask, shown to the user
// but not Claude; for deny, shown to Claude"), which is why the reason — not
// just the refusal — carries the correction. The alternative blocking
// mechanism, exit 2 with stderr, also blocks, but presents as an ERROR rather
// than a policy decision and breaks this package's uniform exit-0 discipline:
// do not "simplify" toward it. Silence plus exit 0 is the documented no-op.
//
// ─── Honest limitations ──────────────────────────────────────────────────────
//
// Six, all real, none closable here:
//
//   - The Bash arm is a HEURISTIC over a command string, not a sandbox. It
//     covers the enumerated read verbs and redirection sources. It does not
//     cover a base64-encoded path, a path held in a shell variable, a
//     `find -exec`, a heredoc body, or an alias. It closes the routes a model
//     reaches for by default; it does not make evasion impossible.
//   - The subcommand split is TEXTUAL and quote-blind, which cuts both ways.
//     A separator inside a quoted argument splits the command anyway, so
//     `grep -E "PASS|FAIL" <guarded-path>` becomes `grep -E "PASS` plus
//     `FAIL" <guarded-path>`, whose first token is not a read verb, and the
//     read is ALLOWED — verified, and not a contrived shape. Deliberately not
//     fixed: a quote-aware splitter buys a little coverage and risks false
//     denies, and under-blocking is this module's declared safe direction.
//   - The same blindness runs the OTHER way, and this list would be dishonest
//     without it. A quoted argument that happens to contain a separator
//     followed by `<read-verb> <guarded-path>` — a `gh pr create --body`
//     narrating `"did X; cat …/slice-7-report.md and moved on"` — is denied
//     even though nothing is read. It is the only known over-block, it takes a
//     command that both names an artifact and describes reading it, and the
//     deny reason at least explains itself; rephrasing clears it.
//   - The `Read` arm compares the LEXICALLY resolved path, never the link
//     target: a symlink outside the run directory pointing at a guarded
//     artifact is allowed. Resolving links would mean `fs` in a module that is
//     pure by construction (see above), and would still not close the Bash arm.
//   - `@`-references bypass it entirely. The mirror is explicit: "PreToolUse
//     runs only when Claude calls a tool. Files you reference with @ in your
//     prompt are added without any tool call ... so no PreToolUse hook fires
//     for them, INCLUDING hooks matching Read." The documented closure — a
//     `Read` deny rule — is precisely the alternative ADR-0017 rejected, since
//     permission rules apply to the whole session and would restrict the
//     executor too. This hole is larger than any Bash-heuristic gap.
//   - The identity inversion described above.
//   - Run discovery fails OPEN. `findActiveRunForSession` returns null both
//     when no run is in progress AND when two or more runs are in progress and
//     the session cannot be disambiguated — so the guard can no-op MID-RUN
//     under concurrent runs, not only when idle. It also returns null when the
//     session's `cwd` is a subdirectory that has no `.orchestrate/runs/` (#374,
//     not fixed here). Every one of those is an ALLOW, which is the safe
//     direction: the guard is weaker there, never wrong there.

/** The two slice-internal artifacts, matched structurally on any issue number. */
const GUARDED_BASENAME = /^slice-\d+-(progress\.json|report\.md)$/;

/**
 * Shell commands that READ a file's contents. Enumerated rather than inferred:
 * the alternative — denying whenever a guarded path merely APPEARS in a command
 * string — would refuse `echo`, a commit message, or a `gh issue comment` that
 * names the artifact without opening it, which is a false deny in the middle of
 * a live run. `source` and `.` are here because they read a file to execute it.
 */
const READ_VERBS = new Set([
  "cat",
  "head",
  "tail",
  "less",
  "more",
  "bat",
  "sed",
  "awk",
  "grep",
  "rg",
  "jq",
  "od",
  "xxd",
  "strings",
  "nl",
  "wc",
  "source",
  ".",
]);

/** The normalised hook event this module decides on. */
export interface ReadGuardInput {
  /** The event's `tool_name`. */
  toolName?: string;
  /** The event's `tool_input` — `file_path` for `Read`, `command` for `Bash`. */
  toolInput?: Record<string, unknown>;
  /** The event's `agent_id`. Absent or empty means the main thread. */
  agentId?: string;
  /** The event's `cwd`. Relative paths are resolved against it. */
  cwd?: string;
  /** The run this session drives, resolved by the CLI. Absent means no run. */
  activeRunId?: string;
}

/** Deny with a reason shown to Claude, or take no decision at all. */
export type ReadGuardDecision =
  | { decision: "none" }
  | { decision: "deny"; reason: string };

/** The `PreToolUse` deny object, exactly as the platform expects it. */
export interface PreToolUseDenyPayload {
  hookSpecificOutput: {
    hookEventName: "PreToolUse";
    permissionDecision: "deny";
    permissionDecisionReason: string;
  };
}

/**
 * The reason a denied read carries back to the model. Pinned as an exported
 * constant so the hook and its tests cannot drift apart, and written as an
 * INSTRUCTION rather than a refusal: it is the only thing the model is told
 * about what to do instead, so it names both routes — the envelope's own
 * fields for the outcome, and the structured-recovery tool for the record.
 */
export const READ_GUARD_DENY_REASON =
  "orchestrate: the orchestrator does not open slice-internal artifacts. Use " +
  "the slice-executor envelope's own fields for the slice's outcome, and pass " +
  "reportPath forward without opening it. If the envelope is missing or " +
  "invalid, recover the progress record's contents through the " +
  "recover_slice_progress MCP tool, which derives the path from (runId, issue) " +
  "and returns validated structured data.";

/** Wraps a reason in the `PreToolUse` deny contract. */
export function denyPayload(reason: string): PreToolUseDenyPayload {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

/** Strip one layer of surrounding single or double quotes from a shell token. */
function unquote(token: string): string {
  const match = token.match(/^(["'])(.*)\1$/);
  return match ? match[2] : token;
}

/** Does this candidate resolve to a guarded artifact of the active run? */
function isGuardedPath(candidate: string, cwd: string, runDir: string): boolean {
  if (candidate === "") return false;
  const resolved = path.resolve(cwd, candidate);
  return (
    path.dirname(resolved) === runDir &&
    GUARDED_BASENAME.test(path.basename(resolved))
  );
}

/**
 * Does this command string read a guarded artifact?
 *
 * The command is split into subcommands on `&&`, `||`, `;`, `|` and newlines,
 * mirroring how the platform's own `if`-field matching checks each subcommand
 * rather than only the first. Within a subcommand, leading `VAR=value`
 * assignments are stripped — again matching the platform — and then two arms
 * fire: an enumerated read verb applied to a guarded path, or a redirection
 * whose source is one. `<<` is excluded so a heredoc marker is not read as a
 * redirection source.
 */
function bashReadsGuardedPath(
  command: string,
  cwd: string,
  runDir: string
): boolean {
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const tokens = segment.trim().split(/\s+/).filter((t) => t !== "");
    if (tokens.length === 0) continue;

    // Redirection is not a verb: `< file` has no command in front of it.
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let candidate: string | undefined;
      if (token === "<") candidate = tokens[i + 1];
      else if (token.startsWith("<") && !token.startsWith("<<")) {
        candidate = token.slice(1);
      }
      if (candidate !== undefined && isGuardedPath(unquote(candidate), cwd, runDir)) {
        return true;
      }
    }

    let start = 0;
    while (start < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[start])) {
      start++;
    }
    if (start >= tokens.length) continue;
    // A verb may be invoked by path (`/bin/cat`); `.` basenames to itself,
    // while `./script.sh` basenames to `script.sh` and is correctly not a verb.
    if (!READ_VERBS.has(path.basename(unquote(tokens[start])))) continue;
    for (const token of tokens.slice(start + 1)) {
      if (isGuardedPath(unquote(token), cwd, runDir)) return true;
    }
  }
  return false;
}

/**
 * Decide whether one `PreToolUse` event is the orchestrator opening a
 * slice-internal artifact. Returns `{ decision: "none" }` for everything else
 * — including every tool other than `Read` and `Bash`, which `hooks.json`'s
 * `Read|Bash` matcher already keeps away from this handler, and which is also
 * what leaves the `recover_slice_progress` MCP tool untouched.
 *
 * Never throws. A malformed or unexpected event takes no decision.
 */
export function decideReadGuard(input: ReadGuardInput): ReadGuardDecision {
  const none: ReadGuardDecision = { decision: "none" };
  try {
    // A subagent — the executor and its workers — reads its own artifacts.
    if (typeof input.agentId === "string" && input.agentId.length > 0) {
      return none;
    }
    const runId = input.activeRunId;
    if (typeof runId !== "string" || runId.length === 0) return none;
    if (typeof input.cwd !== "string" || input.cwd.length === 0) return none;
    const toolInput = input.toolInput;
    if (typeof toolInput !== "object" || toolInput === null) return none;

    const cwd = input.cwd;
    const runDir = path.resolve(cwd, ".orchestrate", "runs", runId);

    if (input.toolName === "Read") {
      const filePath = toolInput.file_path;
      if (typeof filePath === "string" && isGuardedPath(filePath, cwd, runDir)) {
        return { decision: "deny", reason: READ_GUARD_DENY_REASON };
      }
      return none;
    }

    if (input.toolName === "Bash") {
      const command = toolInput.command;
      if (
        typeof command === "string" &&
        bashReadsGuardedPath(command, cwd, runDir)
      ) {
        return { decision: "deny", reason: READ_GUARD_DENY_REASON };
      }
      return none;
    }

    return none;
  } catch {
    // A guard that throws is worse than a guard that misses.
    return none;
  }
}
