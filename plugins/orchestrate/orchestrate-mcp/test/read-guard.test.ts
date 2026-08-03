import { describe, it, expect } from "vitest";
import {
  decideReadGuard,
  denyPayload,
  READ_GUARD_DENY_REASON,
  type ReadGuardInput,
} from "../src/hooks/read-guard.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
//
// The guard's whole job is a decision about a hook event, so the event's field
// names are the contract under test. They are spelled in exactly ONE place —
// the builders below — so a platform rename is one edit rather than a sweep,
// and so a wrong guess (`path` instead of `file_path` for `Read`) fails loudly
// here rather than producing a module that parses cleanly and denies nothing.
//
// `file_path` for `Read` and `command` for `Bash` are the vendor-documented
// `tool_input` shapes; see the module's own doc comment for the citation.

const CWD = "/repo";
const RUN_ID = "prd352-20260803-015333";
const RUN_DIR = `${CWD}/.orchestrate/runs/${RUN_ID}`;

/** The `tool_input` a `Read` call carries. */
function readInput(filePath: string): Record<string, unknown> {
  return { file_path: filePath, offset: 0, limit: 200 };
}

/** The `tool_input` a `Bash` call carries. */
function bashInput(command: string): Record<string, unknown> {
  return { command, description: "a command", timeout: 120000 };
}

/**
 * A hook-event-derived guard input with the main-thread defaults: an active
 * run, the repo root as `cwd`, and NO `agent_id` (which is what "main thread"
 * means — the field is emitted only inside a subagent call).
 */
function hookEvent(overrides: Partial<ReadGuardInput> = {}): ReadGuardInput {
  return {
    toolName: "Read",
    toolInput: readInput(`${RUN_DIR}/slice-361-report.md`),
    cwd: CWD,
    activeRunId: RUN_ID,
    ...overrides,
  };
}

describe("READ_GUARD_DENY_REASON", () => {
  it("names the envelope as the primary route to the slice's outcome", () => {
    // Half of AC2: the deny reason is the ONLY instruction the model receives
    // about what to do instead, so it must name the correct behaviour and not
    // merely refuse.
    expect(READ_GUARD_DENY_REASON).toContain("envelope");
    expect(READ_GUARD_DENY_REASON).toContain("reportPath");
  });

  it("names the structured-recovery tool as the fallback route", () => {
    expect(READ_GUARD_DENY_REASON).toContain("recover_slice_progress");
  });
});

describe("denyPayload", () => {
  it("emits the PreToolUse hookSpecificOutput contract, not the deprecated top-level fields", () => {
    // Pins the WIRE contract. A module that returned the deprecated top-level
    // `decision`/`reason` would satisfy every decision test above while
    // producing a hook the platform ignores.
    const payload = denyPayload("because");
    expect(payload).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "because",
      },
    });
    expect(payload).not.toHaveProperty("decision");
    expect(payload).not.toHaveProperty("reason");
  });
});

describe("decideReadGuard — identity", () => {
  it("denies a main-thread Read of a slice report", () => {
    const result = decideReadGuard(hookEvent());
    expect(result.decision).toBe("deny");
    // Both clauses of AC2, asserted separately: the decision AND the reason.
    expect(result).toEqual({
      decision: "deny",
      reason: expect.stringContaining("envelope"),
    });
    expect(
      result.decision === "deny" ? result.reason : ""
    ).toContain("recover_slice_progress");
  });

  it("denies a main-thread Read of a slice progress record", () => {
    const result = decideReadGuard(
      hookEvent({ toolInput: readInput(`${RUN_DIR}/slice-361-progress.json`) })
    );
    expect(result.decision).toBe("deny");
  });

  it("allows the same read from a subagent, identified by agent_id", () => {
    // AC3. `agent_id` is emitted only inside a subagent call, which is what
    // makes it — and not `agent_type` — the discriminator.
    expect(decideReadGuard(hookEvent({ agentId: "sub-abc123" }))).toEqual({
      decision: "none",
    });
  });

  it("treats an empty agent_id as absent, so it still denies", () => {
    expect(decideReadGuard(hookEvent({ agentId: "" })).decision).toBe("deny");
  });
});

describe("decideReadGuard — no run in progress", () => {
  it("is a silent no-op for a guarded path when no run is active", () => {
    // AC4. Also covers the run-discovery paths that yield no runId at all:
    // a cwd outside the run's repo, and two concurrent runs that cannot be
    // disambiguated.
    expect(decideReadGuard(hookEvent({ activeRunId: undefined }))).toEqual({
      decision: "none",
    });
  });

  it("is a silent no-op when the active run id is empty", () => {
    expect(decideReadGuard(hookEvent({ activeRunId: "" }))).toEqual({
      decision: "none",
    });
  });

  it("is a silent no-op for a guarded Bash read when no run is active", () => {
    expect(
      decideReadGuard(
        hookEvent({
          activeRunId: undefined,
          toolName: "Bash",
          toolInput: bashInput(`cat ${RUN_DIR}/slice-361-report.md`),
        })
      )
    ).toEqual({ decision: "none" });
  });

  it("is a silent no-op when cwd is unavailable", () => {
    expect(decideReadGuard(hookEvent({ cwd: undefined }))).toEqual({
      decision: "none",
    });
  });
});

describe("decideReadGuard — path scoping", () => {
  it("allows run-state.json, the orchestrator's own checkpoint", () => {
    // The single most dangerous over-block available: the orchestrator reads
    // and writes this file at every slice, so a run-directory-wide rule would
    // break every run — silently, and only in the field.
    expect(
      decideReadGuard(
        hookEvent({ toolInput: readInput(`${RUN_DIR}/run-state.json`) })
      )
    ).toEqual({ decision: "none" });
  });

  it.each(["dashboard.html", "graph.html", "report.html"])(
    "allows the rendered %s artifact in the run directory",
    (name) => {
      expect(
        decideReadGuard(
          hookEvent({ toolInput: readInput(`${RUN_DIR}/${name}`) })
        )
      ).toEqual({ decision: "none" });
    }
  );

  it("allows the run directory's other bookkeeping files", () => {
    for (const name of ["context-flag.json", "spawn-log.jsonl"]) {
      expect(
        decideReadGuard(
          hookEvent({ toolInput: readInput(`${RUN_DIR}/${name}`) })
        ),
        `${name} must not be guarded`
      ).toEqual({ decision: "none" });
    }
  });

  it("allows a guarded basename that lives outside the active run directory", () => {
    // The rule is scoped to the run directory, not to the filename: an
    // executor's own worktree copy, or another run's directory, is not this
    // guard's business.
    expect(
      decideReadGuard(
        hookEvent({
          toolInput: readInput(`${CWD}/notes/slice-361-report.md`),
        })
      )
    ).toEqual({ decision: "none" });
  });

  it("allows a guarded basename in a DIFFERENT run's directory", () => {
    expect(
      decideReadGuard(
        hookEvent({
          toolInput: readInput(
            `${CWD}/.orchestrate/runs/backlog-20260101-000000/slice-361-report.md`
          ),
        })
      )
    ).toEqual({ decision: "none" });
  });

  it("is not fooled by a run directory whose name merely PREFIXES the active one", () => {
    // `runs/<id>` is a prefix of `runs/<id>-suffix`, so a startsWith-based
    // containment check would deny a path this run does not own.
    expect(
      decideReadGuard(
        hookEvent({
          toolInput: readInput(`${RUN_DIR}-suffix/slice-361-report.md`),
        })
      )
    ).toEqual({ decision: "none" });
  });

  it("denies any issue number, not just the one this slice was written for", () => {
    for (const issue of ["1", "361", "99999"]) {
      expect(
        decideReadGuard(
          hookEvent({
            toolInput: readInput(`${RUN_DIR}/slice-${issue}-progress.json`),
          })
        ).decision,
        `slice-${issue}-progress.json must be guarded`
      ).toBe("deny");
    }
  });

  it("resolves a relative path against the supplied cwd", () => {
    // The cwd is passed IN. A bare path.resolve would fall back to the hook
    // PROCESS's cwd and silently stop matching every relative path.
    expect(
      decideReadGuard(
        hookEvent({
          toolInput: readInput(
            `.orchestrate/runs/${RUN_ID}/slice-361-report.md`
          ),
        })
      ).decision
    ).toBe("deny");
  });

  it("resolves traversal segments before deciding", () => {
    expect(
      decideReadGuard(
        hookEvent({
          toolInput: readInput(
            `${RUN_DIR}/nested/../slice-361-report.md`
          ),
        })
      ).decision
    ).toBe("deny");
  });

  it("allows a guarded basename nested BELOW the run directory", () => {
    // Both artifacts sit directly in the run directory; a nested lookalike is
    // not one of them.
    expect(
      decideReadGuard(
        hookEvent({
          toolInput: readInput(`${RUN_DIR}/nested/slice-361-report.md`),
        })
      )
    ).toEqual({ decision: "none" });
  });
});

describe("decideReadGuard — tool scoping", () => {
  it("takes no decision on the structured-recovery MCP tool", () => {
    // AC9. The recovery tool's input carries a `repoPath`, so a module that
    // keyed off "any path-shaped string in tool_input" would deny the very
    // escape hatch the deny reason points at.
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "mcp__plugin_orchestrate_orchestrate__recover_slice_progress",
          toolInput: { repoPath: CWD, runId: RUN_ID, issue: 361 },
        })
      )
    ).toEqual({ decision: "none" });
  });

  it.each(["Edit", "Write", "Grep", "Glob", "Agent", "TodoWrite"])(
    "takes no decision on an unrelated tool (%s)",
    (toolName) => {
      // AC6 at the module level; `hooks.json`'s matcher is the other half and
      // is asserted in test/hook-matcher-consistency.test.ts.
      expect(
        decideReadGuard(hookEvent({ toolName, toolInput: { path: RUN_DIR } }))
      ).toEqual({ decision: "none" });
    }
  );

  it("takes no decision when the tool name is absent", () => {
    expect(decideReadGuard(hookEvent({ toolName: undefined }))).toEqual({
      decision: "none",
    });
  });
});

describe("decideReadGuard — malformed input", () => {
  it("never throws on a missing or wrongly-typed tool_input", () => {
    // AC7. A hook that throws is a hook that breaks the session.
    const inputs: ReadGuardInput[] = [
      hookEvent({ toolInput: undefined }),
      hookEvent({ toolInput: {} }),
      hookEvent({ toolInput: { file_path: 42 as unknown as string } }),
      hookEvent({ toolInput: { file_path: "" } }),
      hookEvent({ toolName: "Bash", toolInput: {} }),
      hookEvent({ toolName: "Bash", toolInput: { command: null } }),
      {},
    ];
    for (const input of inputs) {
      expect(() => decideReadGuard(input)).not.toThrow();
      expect(decideReadGuard(input)).toEqual({ decision: "none" });
    }
  });
});

// ─── The Bash arm ─────────────────────────────────────────────────────────────
//
// A stated heuristic, not a sandbox. The deny-tests below enumerate the read
// verbs the module claims to cover; the allow-tests are equally load-bearing,
// because a false deny in the middle of a live run is the AC7 failure that
// actually costs something.

const READ_VERBS = [
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
];

describe("decideReadGuard — Bash reads", () => {
  it.each(READ_VERBS)("denies `%s` applied to a guarded path", (verb) => {
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(`${verb} ${RUN_DIR}/slice-361-report.md`),
        })
      ).decision,
      `\`${verb}\` on a guarded path must be denied`
    ).toBe("deny");
  });

  it("denies a quoted guarded path", () => {
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(`cat "${RUN_DIR}/slice-361-report.md"`),
        })
      ).decision
    ).toBe("deny");
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(`cat '${RUN_DIR}/slice-361-progress.json'`),
        })
      ).decision
    ).toBe("deny");
  });

  it("denies a verb invoked by absolute path", () => {
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(`/bin/cat ${RUN_DIR}/slice-361-report.md`),
        })
      ).decision
    ).toBe("deny");
  });

  it("denies past leading environment assignments", () => {
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(
            `LC_ALL=C cat ${RUN_DIR}/slice-361-report.md`
          ),
        })
      ).decision
    ).toBe("deny");
  });

  it("denies a guarded read in a LATER subcommand of a chain", () => {
    for (const chain of ["&&", "||", ";", "|"]) {
      expect(
        decideReadGuard(
          hookEvent({
            toolName: "Bash",
            toolInput: bashInput(
              `npm test ${chain} cat ${RUN_DIR}/slice-361-report.md`
            ),
          })
        ).decision,
        `a guarded read after \`${chain}\` must be denied`
      ).toBe("deny");
    }
  });

  it("denies a redirection whose source is a guarded path", () => {
    for (const command of [
      `jq . < ${RUN_DIR}/slice-361-progress.json`,
      `while read -r l; do echo "$l"; done <${RUN_DIR}/slice-361-report.md`,
    ]) {
      expect(
        decideReadGuard(
          hookEvent({ toolName: "Bash", toolInput: bashInput(command) })
        ).decision,
        `redirection in \`${command}\` must be denied`
      ).toBe("deny");
    }
  });

  it("denies sourcing a guarded path", () => {
    for (const verb of ["source", "."]) {
      expect(
        decideReadGuard(
          hookEvent({
            toolName: "Bash",
            toolInput: bashInput(`${verb} ${RUN_DIR}/slice-361-report.md`),
          })
        ).decision,
        `\`${verb}\` on a guarded path must be denied`
      ).toBe("deny");
    }
  });

  it("denies a relative guarded path resolved against cwd", () => {
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(
            `cat .orchestrate/runs/${RUN_ID}/slice-361-report.md`
          ),
        })
      ).decision
    ).toBe("deny");
  });
});

describe("decideReadGuard — Bash commands that must NOT be denied", () => {
  it("allows a command that merely MENTIONS a guarded path", () => {
    // The AC7 clause most likely to be missed, and the one that breaks a live
    // run: the orchestrator names these files constantly — in echoes, in
    // commit messages, in issue comments — without ever reading them.
    for (const command of [
      `echo "wrote ${RUN_DIR}/slice-361-report.md"`,
      `git commit -m "slice 361: see slice-361-report.md"`,
      `gh issue comment 361 --body "progress: ${RUN_DIR}/slice-361-progress.json"`,
      `ls -l ${RUN_DIR}/slice-361-report.md`,
      `rm -f ${RUN_DIR}/slice-361-progress.json`,
    ]) {
      expect(
        decideReadGuard(
          hookEvent({ toolName: "Bash", toolInput: bashInput(command) })
        ),
        `\`${command}\` reads nothing and must be allowed`
      ).toEqual({ decision: "none" });
    }
  });

  it("allows a read verb applied to an UNGUARDED path", () => {
    for (const command of [
      `cat ${RUN_DIR}/run-state.json`,
      `cat ${CWD}/package.json`,
      `jq .status ${RUN_DIR}/run-state.json`,
    ]) {
      expect(
        decideReadGuard(
          hookEvent({ toolName: "Bash", toolInput: bashInput(command) })
        ),
        `\`${command}\` must be allowed`
      ).toEqual({ decision: "none" });
    }
  });

  it("does not read `./script.sh` as the `.` source builtin", () => {
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(`./script.sh ${RUN_DIR}/slice-361-report.md`),
        })
      )
    ).toEqual({ decision: "none" });
  });

  it("does not treat a heredoc marker as a redirection source", () => {
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(
            `cat <<EOF\n${RUN_DIR}/slice-361-report.md\nEOF`
          ),
        })
      )
    ).toEqual({ decision: "none" });
  });

  it("pins the quote-blind split — a separator inside a quoted argument", () => {
    // Both directions of the SAME limitation, pinned so a later "improvement"
    // to the splitter has to face them deliberately. Documented in the
    // module's "Honest limitations"; neither is closable without a
    // quote-aware parser, which buys little and risks more false denies.
    // If a splitter change turns this test RED, that is not automatically a
    // regression: re-read the limitation first. The over-block half going
    // green-to-red means the false deny was FIXED, and this assertion should
    // be deleted rather than the fix reverted to keep it passing.
    //
    // Under-block: the `|` in the regex splits the command, so the guarded
    // path lands in a segment whose first token is not a read verb.
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(
            `grep -E "PASS|FAIL" ${RUN_DIR}/slice-361-report.md`
          ),
        })
      )
    ).toEqual({ decision: "none" });

    // Over-block: the only known false deny. A quoted argument NARRATING a
    // read — a separator, then a read verb, then a guarded path — reads as a
    // subcommand to a textual splitter.
    expect(
      decideReadGuard(
        hookEvent({
          toolName: "Bash",
          toolInput: bashInput(
            `gh pr create --body 'did X; cat ${RUN_DIR}/slice-361-report.md and moved on'`
          ),
        })
      ).decision
    ).toBe("deny");
  });

  it("allows a Bash command from a subagent regardless of what it reads", () => {
    expect(
      decideReadGuard(
        hookEvent({
          agentId: "sub-abc123",
          toolName: "Bash",
          toolInput: bashInput(`cat ${RUN_DIR}/slice-361-report.md`),
        })
      )
    ).toEqual({ decision: "none" });
  });
});
