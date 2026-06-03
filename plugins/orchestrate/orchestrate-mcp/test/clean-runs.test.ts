import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { cleanRuns, reclaimRun } from "../src/tools/clean-runs.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { encoding: "utf8", cwd }).trim();
}

/** Creates a temporary git repository with one commit and returns its path. */
function createTempRepo(): string {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-test-"));

  git(["init"], repoPath);
  git(["config", "user.email", "test@test.local"], repoPath);
  git(["config", "user.name", "Test User"], repoPath);

  fs.writeFileSync(path.join(repoPath, "README.md"), "# Test repo\n");
  git(["add", "README.md"], repoPath);
  git(["commit", "-m", "Initial commit"], repoPath);

  return repoPath;
}

/** Recursively remove a directory. */
function rmrf(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/** Returns true when a local branch ref resolves in the repo. */
function localBranchExists(branch: string, repo: string): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], repo);
    return true;
  } catch {
    return false;
  }
}

/** Returns true when a remote branch ref appears in `git ls-remote origin`. */
function remoteBranchExists(branch: string, repo: string): boolean {
  const out = git(["ls-remote", "--heads", "origin", branch], repo);
  return out.length > 0;
}

/** Writes a run-state.json into `.orchestrate/runs/<runId>/`. */
function writeRunState(repo: string, runId: string, state: unknown): void {
  const runDir = path.join(repo, ".orchestrate", "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(
    path.join(runDir, "run-state.json"),
    typeof state === "string" ? state : JSON.stringify(state, null, 2)
  );
}

/** Path to a run directory. */
function runDirPath(repo: string, runId: string): string {
  return path.join(repo, ".orchestrate", "runs", runId);
}

// ─── Test state ───────────────────────────────────────────────────────────────

let repoPath: string;
let worktreesDir: string;

beforeEach(() => {
  repoPath = createTempRepo();
  worktreesDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-"));
});

afterEach(() => {
  rmrf(repoPath);
  rmrf(worktreesDir);
});

// ─── Fixture builders ─────────────────────────────────────────────────────────

/**
 * Sets up a repo with a bare clone registered as `origin`, so remote branch
 * deletion (`git push origin --delete`) and `git ls-remote` are exercised
 * against a real remote.
 */
function withRemote(): { remoteDir: string } {
  const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-remote-"));
  const remoteBare = path.join(remoteDir, "remote.git");
  git(["clone", "--bare", repoPath, remoteBare], remoteDir);
  git(["remote", "add", "origin", remoteBare], repoPath);
  return { remoteDir };
}

/**
 * Creates an umbrella branch + one slice branch for `runId`, optionally
 * pushing them to `origin`. Returns the branch names.
 */
function makeBranches(
  runId: string,
  sliceIssue: string,
  opts: { push: boolean }
): { umbrellaBranch: string; sliceBranch: string } {
  const umbrellaBranch = `orchestrate/umbrella-${runId}`;
  const sliceBranch = `orchestrate/slice-${sliceIssue}`;
  git(["branch", umbrellaBranch], repoPath);
  git(["branch", sliceBranch], repoPath);
  if (opts.push) {
    git(["push", "origin", umbrellaBranch], repoPath);
    git(["push", "origin", sliceBranch], repoPath);
  }
  return { umbrellaBranch, sliceBranch };
}

/**
 * Creates a slice worktree on `sliceBranch` and returns its absolute path.
 * The branch must already exist.
 */
function makeWorktree(sliceBranch: string, name: string): string {
  const wtPath = path.join(worktreesDir, name);
  git(["worktree", "add", wtPath, sliceBranch], repoPath);
  return wtPath;
}

/** Builds a complete run-state object with one slice. */
function buildRunState(opts: {
  runId: string;
  status: string;
  umbrellaBranch: string;
  finalPullRequest: string | null;
  slices: Record<
    string,
    {
      sliceBranch: string;
      worktreePath: string | null;
      state: string;
    }
  >;
}): Record<string, unknown> {
  return {
    runId: opts.runId,
    status: opts.status,
    umbrellaBranch: opts.umbrellaBranch,
    integrationBase: "development",
    parentIssue: null,
    startedAt: "2026-05-22T00:00:00Z",
    updatedAt: "2026-05-22T01:00:00Z",
    waves: [Object.keys(opts.slices)],
    completedWaves: 1,
    finalPullRequest: opts.finalPullRequest,
    slices: Object.fromEntries(
      Object.entries(opts.slices).map(([id, s]) => [
        id,
        {
          issue: Number(id),
          title: `Slice ${id}`,
          wave: 0,
          tier: "standard",
          blockedBy: [],
          state: s.state,
          sliceBranch: s.sliceBranch,
          worktreePath: s.worktreePath,
          pullRequest: null,
          failureReason: null,
          updatedAt: "2026-05-22T01:00:00Z",
        },
      ])
    ),
  };
}

// ─── merged run — full cleanup ────────────────────────────────────────────────

describe("clean_runs — merged run", () => {
  it("removes worktrees, branches, and the run directory of a merged run", async () => {
    const runId = "20260522-100000";
    withRemote();
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "201", {
      push: true,
    });
    const wtPath = makeWorktree(sliceBranch, "slice-201");
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/9",
        slices: { "201": { sliceBranch, worktreePath: wtPath, state: "passed" } },
      })
    );

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });

    expect(result.status).toBe("ok");
    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("removed");
    expect(run.reason).toBe("merged-and-clean");
    expect(run.runDirRemoved).toBe(true);

    // Worktree gone from disk.
    expect(fs.existsSync(wtPath)).toBe(false);
    // Run directory gone from disk.
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(false);
    // Branches gone — local AND remote.
    expect(localBranchExists(umbrellaBranch, repoPath)).toBe(false);
    expect(localBranchExists(sliceBranch, repoPath)).toBe(false);
    expect(remoteBranchExists(umbrellaBranch, repoPath)).toBe(false);
    expect(remoteBranchExists(sliceBranch, repoPath)).toBe(false);
    // The removed worktree + branches are reported.
    expect(run.removedWorktrees).toContain(wtPath);
    expect(run.removedBranches).toContain(umbrellaBranch);
    expect(run.removedBranches).toContain(sliceBranch);
  });
});

// ─── open / closed-unmerged / unknown — preserved ─────────────────────────────

describe("clean_runs — open final PR", () => {
  it("leaves an open-PR run intact and reports it as skipped", async () => {
    const runId = "20260522-110000";
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "202", {
      push: false,
    });
    const wtPath = makeWorktree(sliceBranch, "slice-202");
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/10",
        slices: { "202": { sliceBranch, worktreePath: wtPath, state: "passed" } },
      })
    );

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "open" },
    });

    expect(result.status).toBe("ok");
    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("skipped");
    expect(run.reason).toBe("final-pr-open");
    expect(run.runDirRemoved).toBe(false);

    // Nothing removed.
    expect(fs.existsSync(wtPath)).toBe(true);
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);
    expect(localBranchExists(umbrellaBranch, repoPath)).toBe(true);
    expect(localBranchExists(sliceBranch, repoPath)).toBe(true);
  });
});

describe("clean_runs — closed-unmerged final PR", () => {
  it("leaves a closed-unmerged run intact and reports it as skipped", async () => {
    const runId = "20260522-120000";
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "203", {
      push: false,
    });
    const wtPath = makeWorktree(sliceBranch, "slice-203");
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/11",
        slices: { "203": { sliceBranch, worktreePath: wtPath, state: "passed" } },
      })
    );

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "closed-unmerged" },
    });

    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("skipped");
    expect(run.reason).toBe("final-pr-closed-unmerged");

    expect(fs.existsSync(wtPath)).toBe(true);
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);
    expect(localBranchExists(umbrellaBranch, repoPath)).toBe(true);
  });
});

describe("clean_runs — unknown verdict", () => {
  it("leaves a run with an unknown verdict intact and reports it as skipped", async () => {
    const runId = "20260522-130000";
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "204", {
      push: false,
    });
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/12",
        slices: { "204": { sliceBranch, worktreePath: null, state: "passed" } },
      })
    );

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "unknown" },
    });

    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("skipped");
    expect(run.reason).toBe("verdict-unknown");
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);
    expect(localBranchExists(umbrellaBranch, repoPath)).toBe(true);
  });
});

// ─── run absent from verdict map — preserved ──────────────────────────────────

describe("clean_runs — no verdict from orchestrator", () => {
  it("leaves a run absent from the verdict map intact", async () => {
    const runId = "20260522-140000";
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "205", {
      push: false,
    });
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/13",
        slices: { "205": { sliceBranch, worktreePath: null, state: "passed" } },
      })
    );

    // Empty verdict map — the orchestrator supplied no verdict for this run.
    const result = await cleanRuns({ repoPath, verdicts: {} });

    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("skipped");
    expect(run.reason).toBe("no-verdict-from-orchestrator");
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);
    expect(localBranchExists(umbrellaBranch, repoPath)).toBe(true);
  });
});

// ─── defense-in-depth: in-progress run never cleaned ──────────────────────────

describe("clean_runs — in-progress defense", () => {
  it("refuses to clean a run whose run-state.status is in-progress, even with a merged verdict", async () => {
    const runId = "20260522-150000";
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "206", {
      push: false,
    });
    const wtPath = makeWorktree(sliceBranch, "slice-206");
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "in-progress",
        umbrellaBranch,
        finalPullRequest: null,
        slices: { "206": { sliceBranch, worktreePath: wtPath, state: "passed" } },
      })
    );

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });

    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("skipped");
    expect(run.reason).toBe("run-not-completed");

    // Nothing removed — the run is still active.
    expect(fs.existsSync(wtPath)).toBe(true);
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);
    expect(localBranchExists(umbrellaBranch, repoPath)).toBe(true);
  });
});

// ─── defense-in-depth: completed run with a null finalPullRequest ─────────────

describe("clean_runs — final-pr-missing gate", () => {
  it("refuses to clean a completed run whose finalPullRequest is null, even with a merged verdict", async () => {
    const runId = "20260522-155000";
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "207", {
      push: false,
    });
    const wtPath = makeWorktree(sliceBranch, "slice-207");
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: null,
        slices: { "207": { sliceBranch, worktreePath: wtPath, state: "passed" } },
      })
    );

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });

    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("skipped");
    expect(run.reason).toBe("final-pr-missing");

    // Nothing removed — the run never concluded (its final PR was never opened).
    expect(fs.existsSync(wtPath)).toBe(true);
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);
    expect(localBranchExists(umbrellaBranch, repoPath)).toBe(true);
  });
});

// ─── cross-run isolation: a live sibling run is never touched ──────────────────

describe("clean_runs — cross-run isolation", () => {
  it("cleans a merged run while leaving a concurrent in-progress sibling completely untouched", async () => {
    // Structural isolation is guaranteed by construction: `run-dir.ts`
    // `isValidRunId`/`resolveRunDir` are pure functions of `(repoPath, runId)`,
    // so two distinct valid run ids always resolve to disjoint
    // `.orchestrate/runs/<runId>/` paths and disjoint runId-embedding branch
    // names — no tool can write outside its own run's footprint. This test pins
    // that empirically: even when BOTH runs carry a `merged` verdict, the
    // status gate (`checkCrossRunMutationAllowed`) protects the in-progress
    // sibling while the concluded run is cleaned.
    withRemote();

    // Run B — completed, non-null finalPR, merged verdict → cleaned.
    const runB = "20260522-240000";
    const { umbrellaBranch: umbrellaB, sliceBranch: sliceBranchB } =
      makeBranches(runB, "801", { push: true });
    const wtB = makeWorktree(sliceBranchB, "slice-801");
    writeRunState(
      repoPath,
      runB,
      buildRunState({
        runId: runB,
        status: "completed",
        umbrellaBranch: umbrellaB,
        finalPullRequest: "https://github.com/o/r/pull/20",
        slices: {
          "801": { sliceBranch: sliceBranchB, worktreePath: wtB, state: "passed" },
        },
      })
    );

    // Run A — in-progress, still live in another session. Distinct runId and
    // slice issue so Run B's branch deletion can never coincidentally match.
    // Its branches are pushed so the remote half is exercised too.
    const runA = "20260522-250000";
    const { umbrellaBranch: umbrellaA, sliceBranch: sliceBranchA } =
      makeBranches(runA, "802", { push: true });
    const wtA = makeWorktree(sliceBranchA, "slice-802");
    writeRunState(
      repoPath,
      runA,
      buildRunState({
        runId: runA,
        status: "in-progress",
        umbrellaBranch: umbrellaA,
        finalPullRequest: null,
        slices: {
          "802": { sliceBranch: sliceBranchA, worktreePath: wtA, state: "passed" },
        },
      })
    );

    // Both runs carry a `merged` verdict — the status gate is the only thing
    // standing between Run A and deletion.
    const result = await cleanRuns({
      repoPath,
      verdicts: { [runB]: "merged", [runA]: "merged" },
    });

    expect(result.status).toBe("ok");

    // Run B is removed — worktree, branches (local + remote), and run dir gone.
    const reportB = result.runs.find((r) => r.runId === runB)!;
    expect(reportB.action).toBe("removed");
    expect(reportB.runDirRemoved).toBe(true);
    expect(fs.existsSync(wtB)).toBe(false);
    expect(fs.existsSync(runDirPath(repoPath, runB))).toBe(false);
    expect(localBranchExists(umbrellaB, repoPath)).toBe(false);
    expect(remoteBranchExists(umbrellaB, repoPath)).toBe(false);

    // Run A — the in-progress sibling — is COMPLETELY untouched.
    const reportA = result.runs.find((r) => r.runId === runA)!;
    expect(reportA.action).toBe("skipped");
    expect(reportA.reason).toBe("run-not-completed");
    // Its run dir, worktree, and branches (local AND remote) all still present.
    expect(fs.existsSync(runDirPath(repoPath, runA))).toBe(true);
    expect(fs.existsSync(wtA)).toBe(true);
    expect(localBranchExists(umbrellaA, repoPath)).toBe(true);
    expect(localBranchExists(sliceBranchA, repoPath)).toBe(true);
    expect(remoteBranchExists(umbrellaA, repoPath)).toBe(true);
    expect(remoteBranchExists(sliceBranchA, repoPath)).toBe(true);
  });
});

// ─── failed-slice worktree preservation ───────────────────────────────────────

describe("clean_runs — failed-slice worktree preservation", () => {
  it("preserves a failed-slice worktree and keeps the run directory by default", async () => {
    const runId = "20260522-160000";
    withRemote();
    const umbrellaBranch = `orchestrate/umbrella-${runId}`;
    const passedSlice = "orchestrate/slice-301";
    const failedSlice = "orchestrate/slice-302";
    git(["branch", umbrellaBranch], repoPath);
    git(["branch", passedSlice], repoPath);
    git(["branch", failedSlice], repoPath);
    git(["push", "origin", umbrellaBranch], repoPath);
    git(["push", "origin", passedSlice], repoPath);
    git(["push", "origin", failedSlice], repoPath);
    const passedWt = makeWorktree(passedSlice, "slice-301");
    const failedWt = makeWorktree(failedSlice, "slice-302");

    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/14",
        slices: {
          "301": {
            sliceBranch: passedSlice,
            worktreePath: passedWt,
            state: "passed",
          },
          "302": {
            sliceBranch: failedSlice,
            worktreePath: failedWt,
            state: "failed",
          },
        },
      })
    );

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });

    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("preserved");
    expect(run.reason).toBe("merged-with-preserved-worktrees");

    // The passed slice's worktree is removed; its branch deleted both sides.
    expect(fs.existsSync(passedWt)).toBe(false);
    expect(run.removedWorktrees).toContain(passedWt);
    expect(run.removedBranches).toContain(passedSlice);
    expect(localBranchExists(passedSlice, repoPath)).toBe(false);
    expect(remoteBranchExists(passedSlice, repoPath)).toBe(false);
    // The failed slice's worktree is PRESERVED and reported.
    expect(fs.existsSync(failedWt)).toBe(true);
    expect(run.preservedWorktrees).toContain(failedWt);
    // The failed slice's branch is left FULLY intact — local AND remote — so
    // the inspecting developer can still check it out and push from the
    // preserved worktree. It is neither removed nor reported as an error.
    expect(localBranchExists(failedSlice, repoPath)).toBe(true);
    expect(remoteBranchExists(failedSlice, repoPath)).toBe(true);
    expect(run.removedBranches).not.toContain(failedSlice);
    expect(run.branchErrors).toEqual([]);
    // The umbrella branch is still deleted — it is not a preserved worktree.
    expect(localBranchExists(umbrellaBranch, repoPath)).toBe(false);
    // The run directory is KEPT — the preserved worktree's state survives.
    expect(run.runDirRemoved).toBe(false);
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);
  });

  it("removes a failed-slice worktree and the run directory when force=true", async () => {
    const runId = "20260522-170000";
    withRemote();
    const umbrellaBranch = `orchestrate/umbrella-${runId}`;
    const passedSlice = "orchestrate/slice-401";
    const failedSlice = "orchestrate/slice-402";
    git(["branch", umbrellaBranch], repoPath);
    git(["branch", passedSlice], repoPath);
    git(["branch", failedSlice], repoPath);
    git(["push", "origin", umbrellaBranch], repoPath);
    git(["push", "origin", passedSlice], repoPath);
    git(["push", "origin", failedSlice], repoPath);
    const passedWt = makeWorktree(passedSlice, "slice-401");
    const failedWt = makeWorktree(failedSlice, "slice-402");

    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/15",
        slices: {
          "401": {
            sliceBranch: passedSlice,
            worktreePath: passedWt,
            state: "passed",
          },
          "402": {
            sliceBranch: failedSlice,
            worktreePath: failedWt,
            state: "failed",
          },
        },
      })
    );

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
      force: true,
    });

    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("removed");
    expect(run.reason).toBe("merged-and-clean");

    // Both worktrees removed under force.
    expect(fs.existsSync(passedWt)).toBe(false);
    expect(fs.existsSync(failedWt)).toBe(false);
    expect(run.removedWorktrees).toContain(passedWt);
    expect(run.removedWorktrees).toContain(failedWt);
    expect(run.preservedWorktrees).toEqual([]);
    // The run directory is removed.
    expect(run.runDirRemoved).toBe(true);
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(false);
    // Branches gone — local and remote.
    expect(localBranchExists(failedSlice, repoPath)).toBe(false);
    expect(remoteBranchExists(failedSlice, repoPath)).toBe(false);
  });
});

// ─── malformed / absent run-state ─────────────────────────────────────────────

describe("clean_runs — malformed run-state", () => {
  it("tolerates a malformed run-state.json, leaves the run intact, and reports it", async () => {
    const runId = "20260522-180000";
    writeRunState(repoPath, runId, "{ not valid json");

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });

    expect(result.status).toBe("ok");
    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("skipped");
    expect(run.reason).toBe("malformed-run-state");
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);
  });

  it("tolerates a run directory with no run-state.json", async () => {
    const runId = "20260522-190000";
    fs.mkdirSync(runDirPath(repoPath, runId), { recursive: true });

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });

    expect(result.status).toBe("ok");
    const run = result.runs.find((r) => r.runId === runId)!;
    expect(run.action).toBe("skipped");
    expect(run.reason).toBe("missing-run-state");
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);
  });
});

// ─── idempotency ──────────────────────────────────────────────────────────────

describe("clean_runs — idempotency", () => {
  it("succeeds when a run's branches are already deleted (absent ref is not an error)", async () => {
    const runId = "20260522-200000";
    withRemote();
    const umbrellaBranch = `orchestrate/umbrella-${runId}`;
    const sliceBranch = `orchestrate/slice-501`;
    // run-state names branches that were never created — the absent-ref case.
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/16",
        slices: {
          "501": { sliceBranch, worktreePath: null, state: "passed" },
        },
      })
    );

    const result = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });

    expect(result.status).toBe("ok");
    const run = result.runs.find((r) => r.runId === runId)!;
    // Absent branches are not errors — the run is still cleaned.
    expect(run.action).toBe("removed");
    expect(run.branchErrors).toEqual([]);
    expect(run.runDirRemoved).toBe(true);
  });

  it("re-running clean on an already-clean run does not error", async () => {
    const runId = "20260522-210000";
    withRemote();
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "601", {
      push: true,
    });
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/17",
        slices: {
          "601": { sliceBranch, worktreePath: null, state: "passed" },
        },
      })
    );

    const first = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });
    expect(first.status).toBe("ok");
    expect(first.runs[0].runDirRemoved).toBe(true);

    // Second run: the run directory is already gone — clean reports no runs.
    const second = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });
    expect(second.status).toBe("ok");
    expect(second.runs.find((r) => r.runId === runId)).toBeUndefined();
  });
});

// ─── path-traversal guard ─────────────────────────────────────────────────────

describe("clean_runs — runId validation", () => {
  it("skips a run directory whose name is not a valid runId", async () => {
    // Manually create a malformed directory name under runs/.
    const badDir = path.join(repoPath, ".orchestrate", "runs", "bad.name");
    fs.mkdirSync(badDir, { recursive: true });

    const result = await cleanRuns({
      repoPath,
      verdicts: { "bad.name": "merged" },
    });

    expect(result.status).toBe("ok");
    const run = result.runs.find((r) => r.runId === "bad.name")!;
    expect(run.action).toBe("skipped");
    expect(run.reason).toBe("invalid-run-id");
    // The directory is untouched.
    expect(fs.existsSync(badDir)).toBe(true);
  });
});

// ─── no runs directory ────────────────────────────────────────────────────────

describe("clean_runs — empty / absent runs directory", () => {
  it("returns status='ok' with an empty runs array when no runs directory exists", async () => {
    const result = await cleanRuns({ repoPath, verdicts: {} });
    expect(result.status).toBe("ok");
    expect(result.runs).toEqual([]);
  });

  it("returns errorCode=INVALID_INPUT when repoPath starts with '-'", async () => {
    const result = await cleanRuns({ repoPath: "--bad", verdicts: {} });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("INVALID_INPUT");
  });
});

// ─── one run's failure does not abort the sweep ───────────────────────────────

describe("clean_runs — sweep continues past one run's failure", () => {
  it("cleans a healthy merged run even when another run is malformed", async () => {
    const goodRun = "20260522-220000";
    const badRun = "20260522-230000";
    withRemote();
    const { umbrellaBranch } = makeBranches(goodRun, "701", { push: true });
    writeRunState(
      repoPath,
      goodRun,
      buildRunState({
        runId: goodRun,
        status: "completed",
        umbrellaBranch,
        finalPullRequest: "https://github.com/o/r/pull/18",
        slices: {
          "701": {
            sliceBranch: "orchestrate/slice-701",
            worktreePath: null,
            state: "passed",
          },
        },
      })
    );
    writeRunState(repoPath, badRun, "}{ broken");

    const result = await cleanRuns({
      repoPath,
      verdicts: { [goodRun]: "merged", [badRun]: "merged" },
    });

    expect(result.status).toBe("ok");
    const good = result.runs.find((r) => r.runId === goodRun)!;
    const bad = result.runs.find((r) => r.runId === badRun)!;
    expect(good.action).toBe("removed");
    expect(good.runDirRemoved).toBe(true);
    expect(bad.action).toBe("skipped");
    expect(bad.reason).toBe("malformed-run-state");
    expect(fs.existsSync(runDirPath(repoPath, badRun))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// reclaim_run — the human-gated single-run override (ADR-0012's sanctioned
// status-gate exception). It removes ONE named run's complete footprint —
// passed AND failed worktrees, umbrella + slice branches, run dir — WITHOUT the
// status gate, scoped by construction to that single run, and never throws.
// ═══════════════════════════════════════════════════════════════════════════════

describe("reclaimRun — removes both passed- and failed-state worktrees", () => {
  it("removes BOTH the passed- and failed-state worktrees for the runId", async () => {
    const runId = "20260522-300000";
    withRemote();
    const umbrellaBranch = `orchestrate/umbrella-${runId}`;
    const passedSlice = "orchestrate/slice-901";
    const failedSlice = "orchestrate/slice-902";
    git(["branch", umbrellaBranch], repoPath);
    git(["branch", passedSlice], repoPath);
    git(["branch", failedSlice], repoPath);
    git(["push", "origin", umbrellaBranch], repoPath);
    git(["push", "origin", passedSlice], repoPath);
    git(["push", "origin", failedSlice], repoPath);
    const passedWt = makeWorktree(passedSlice, "slice-901");
    const failedWt = makeWorktree(failedSlice, "slice-902");

    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        // in-progress + null finalPR — exactly what a status gate would refuse.
        status: "in-progress",
        umbrellaBranch,
        finalPullRequest: null,
        slices: {
          "901": { sliceBranch: passedSlice, worktreePath: passedWt, state: "passed" },
          "902": { sliceBranch: failedSlice, worktreePath: failedWt, state: "failed" },
        },
      })
    );

    const result = await reclaimRun({ repoPath, runId });

    expect(result.status).toBe("ok");
    const report = result.report!;
    expect(report.action).toBe("removed");
    expect(report.reason).toBe("failed-run-reclaimed");

    // BOTH worktrees gone — the failed one too (no inspection preservation here).
    expect(fs.existsSync(passedWt)).toBe(false);
    expect(fs.existsSync(failedWt)).toBe(false);
    expect(report.removedWorktrees).toContain(passedWt);
    expect(report.removedWorktrees).toContain(failedWt);
    expect(report.preservedWorktrees).toEqual([]);
  });
});

describe("reclaimRun — deletes umbrella + every slice branch", () => {
  it("deletes the umbrella branch and every slice branch (local and remote)", async () => {
    const runId = "20260522-310000";
    withRemote();
    const umbrellaBranch = `orchestrate/umbrella-${runId}`;
    const sliceA = "orchestrate/slice-911";
    const sliceB = "orchestrate/slice-912";
    git(["branch", umbrellaBranch], repoPath);
    git(["branch", sliceA], repoPath);
    git(["branch", sliceB], repoPath);
    git(["push", "origin", umbrellaBranch], repoPath);
    git(["push", "origin", sliceA], repoPath);
    git(["push", "origin", sliceB], repoPath);

    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "in-progress",
        umbrellaBranch,
        finalPullRequest: null,
        slices: {
          "911": { sliceBranch: sliceA, worktreePath: null, state: "passed" },
          "912": { sliceBranch: sliceB, worktreePath: null, state: "failed" },
        },
      })
    );

    const result = await reclaimRun({ repoPath, runId });

    const report = result.report!;
    expect(report.removedBranches).toContain(umbrellaBranch);
    expect(report.removedBranches).toContain(sliceA);
    expect(report.removedBranches).toContain(sliceB);
    expect(localBranchExists(umbrellaBranch, repoPath)).toBe(false);
    expect(localBranchExists(sliceA, repoPath)).toBe(false);
    expect(localBranchExists(sliceB, repoPath)).toBe(false);
    expect(remoteBranchExists(umbrellaBranch, repoPath)).toBe(false);
    expect(remoteBranchExists(sliceA, repoPath)).toBe(false);
    expect(remoteBranchExists(sliceB, repoPath)).toBe(false);
    expect(report.branchErrors).toEqual([]);
  });
});

describe("reclaimRun — removes the run directory", () => {
  it("removes the run directory", async () => {
    const runId = "20260522-320000";
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "921", {
      push: false,
    });
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "in-progress",
        umbrellaBranch,
        finalPullRequest: null,
        slices: { "921": { sliceBranch, worktreePath: null, state: "passed" } },
      })
    );

    const result = await reclaimRun({ repoPath, runId });

    expect(result.report!.runDirRemoved).toBe(true);
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(false);
  });
});

describe("reclaimRun — bypasses the status gate", () => {
  it("acts when run-state.status is in-progress — the central new behavior clean_runs refuses", async () => {
    const runId = "20260522-330000";
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "931", {
      push: false,
    });
    const wt = makeWorktree(sliceBranch, "slice-931");
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "in-progress",
        umbrellaBranch,
        finalPullRequest: null,
        slices: { "931": { sliceBranch, worktreePath: wt, state: "passed" } },
      })
    );

    // Contrast: clean_runs REFUSES this exact run (status gate → run-not-completed).
    const cleanResult = await cleanRuns({
      repoPath,
      verdicts: { [runId]: "merged" },
    });
    const cleanReport = cleanResult.runs.find((r) => r.runId === runId)!;
    expect(cleanReport.action).toBe("skipped");
    expect(cleanReport.reason).toBe("run-not-completed");
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(true);

    // reclaimRun acts on the very same in-progress run.
    const result = await reclaimRun({ repoPath, runId });
    expect(result.status).toBe("ok");
    expect(result.report!.action).toBe("removed");
    expect(result.report!.reason).toBe("failed-run-reclaimed");
    expect(fs.existsSync(wt)).toBe(false);
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(false);
  });
});

describe("reclaimRun — ignores any verdict input", () => {
  it("takes only a runId — no verdict map participates", async () => {
    const runId = "20260522-340000";
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "941", {
      push: false,
    });
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        // A `completed` run whose final PR was closed-unmerged: clean_runs would
        // need a verdict to act; reclaimRun ignores verdicts entirely.
        status: "completed",
        umbrellaBranch,
        finalPullRequest: null,
        slices: { "941": { sliceBranch, worktreePath: null, state: "passed" } },
      })
    );

    // No verdict argument exists on reclaimRun's input — its signature is runId-only.
    const result = await reclaimRun({ repoPath, runId });
    expect(result.status).toBe("ok");
    expect(result.report!.action).toBe("removed");
    expect(result.report!.reason).toBe("failed-run-reclaimed");
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(false);
  });
});

describe("reclaimRun — cross-run isolation", () => {
  it("leaves a second run present on disk completely untouched", async () => {
    withRemote();

    // Target run — to be reclaimed.
    const target = "20260522-350000";
    const { umbrellaBranch: umbT, sliceBranch: sliceT } = makeBranches(
      target,
      "951",
      { push: true }
    );
    const wtT = makeWorktree(sliceT, "slice-951");
    writeRunState(
      repoPath,
      target,
      buildRunState({
        runId: target,
        status: "in-progress",
        umbrellaBranch: umbT,
        finalPullRequest: null,
        slices: { "951": { sliceBranch: sliceT, worktreePath: wtT, state: "passed" } },
      })
    );

    // Sibling run — distinct runId + slice issue; must be untouched.
    const sibling = "20260522-360000";
    const { umbrellaBranch: umbS, sliceBranch: sliceS } = makeBranches(
      sibling,
      "952",
      { push: true }
    );
    const wtS = makeWorktree(sliceS, "slice-952");
    writeRunState(
      repoPath,
      sibling,
      buildRunState({
        runId: sibling,
        status: "in-progress",
        umbrellaBranch: umbS,
        finalPullRequest: null,
        slices: { "952": { sliceBranch: sliceS, worktreePath: wtS, state: "passed" } },
      })
    );

    const result = await reclaimRun({ repoPath, runId: target });
    expect(result.status).toBe("ok");
    expect(result.report!.runId).toBe(target);

    // Target gone.
    expect(fs.existsSync(wtT)).toBe(false);
    expect(fs.existsSync(runDirPath(repoPath, target))).toBe(false);
    expect(localBranchExists(umbT, repoPath)).toBe(false);
    expect(remoteBranchExists(umbT, repoPath)).toBe(false);

    // Sibling COMPLETELY untouched — run dir, worktree, branches (local + remote).
    expect(fs.existsSync(runDirPath(repoPath, sibling))).toBe(true);
    expect(fs.existsSync(wtS)).toBe(true);
    expect(localBranchExists(umbS, repoPath)).toBe(true);
    expect(localBranchExists(sliceS, repoPath)).toBe(true);
    expect(remoteBranchExists(umbS, repoPath)).toBe(true);
    expect(remoteBranchExists(sliceS, repoPath)).toBe(true);
  });
});

describe("reclaimRun — invalid runId", () => {
  it("returns a structured invalid-run-id result, never a throw, for an option-injection-shaped runId", async () => {
    const result = await reclaimRun({ repoPath, runId: "--evil" });
    expect(result.status).toBe("ok");
    expect(result.report!.action).toBe("skipped");
    expect(result.report!.reason).toBe("invalid-run-id");
  });

  it("returns invalid-run-id for a non-runId-shaped name (fails isValidRunId)", async () => {
    const result = await reclaimRun({ repoPath, runId: "bad.name" });
    expect(result.status).toBe("ok");
    expect(result.report!.action).toBe("skipped");
    expect(result.report!.reason).toBe("invalid-run-id");
  });
});

describe("reclaimRun — nonexistent but valid runId", () => {
  it("reports run-not-found for a valid runId with no run directory, never a throw", async () => {
    const result = await reclaimRun({ repoPath, runId: "20260522-999999" });
    expect(result.status).toBe("ok");
    expect(result.report!.action).toBe("skipped");
    expect(result.report!.reason).toBe("run-not-found");
  });
});

describe("reclaimRun — idempotent re-run", () => {
  it("a second reclaim of the same runId is a clean run-not-found no-op", async () => {
    const runId = "20260522-370000";
    withRemote();
    const { umbrellaBranch, sliceBranch } = makeBranches(runId, "961", {
      push: true,
    });
    const wt = makeWorktree(sliceBranch, "slice-961");
    writeRunState(
      repoPath,
      runId,
      buildRunState({
        runId,
        status: "in-progress",
        umbrellaBranch,
        finalPullRequest: null,
        slices: { "961": { sliceBranch, worktreePath: wt, state: "passed" } },
      })
    );

    const first = await reclaimRun({ repoPath, runId });
    expect(first.status).toBe("ok");
    expect(first.report!.action).toBe("removed");
    expect(first.report!.reason).toBe("failed-run-reclaimed");
    expect(fs.existsSync(runDirPath(repoPath, runId))).toBe(false);

    // Second reclaim: the run dir is already gone — a clean no-op, not an error.
    const second = await reclaimRun({ repoPath, runId });
    expect(second.status).toBe("ok");
    expect(second.report!.action).toBe("skipped");
    expect(second.report!.reason).toBe("run-not-found");
  });
});

describe("reclaimRun — invalid repoPath", () => {
  it("returns errorCode=INVALID_INPUT when repoPath starts with '-'", async () => {
    const result = await reclaimRun({ repoPath: "--bad", runId: "20260522-380000" });
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("INVALID_INPUT");
  });
});
