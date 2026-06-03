import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { cleanRuns } from "../src/tools/clean-runs.js";

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
