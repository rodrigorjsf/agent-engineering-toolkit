import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { finalizeSlice } from "../src/tools/finalize-slice.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { encoding: "utf8", cwd }).trim();
}

/** Creates a bare repo to act as a remote `origin`, returns its path. */
function createBareRepo(): string {
  const barePath = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-bare-"));
  git(["init", "--bare"], barePath);
  return barePath;
}

/**
 * Creates a working repo (acting as the slice WORKTREE for finalize) with one
 * commit on a named branch and a remote pointing at `bareOrigin`. The branch is
 * created but NOT pushed — finalize does the staged commit + push.
 */
function createWorkRepo(bareOrigin: string, branch: string): string {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-work-"));
  git(["init"], repoPath);
  git(["config", "user.email", "test@test.local"], repoPath);
  git(["config", "user.name", "Test User"], repoPath);
  git(["checkout", "-b", branch], repoPath);
  fs.writeFileSync(path.join(repoPath, "README.md"), "# Test repo\n");
  git(["add", "README.md"], repoPath);
  git(["commit", "-m", "Initial commit"], repoPath);
  git(["remote", "add", "origin", bareOrigin], repoPath);
  return repoPath;
}

/** Recursively remove a directory. */
function rmrf(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/** No-op sleep so backoff schedules add no real delay in tests. */
const noopSleep = async (): Promise<void> => {};

/**
 * Writes a minimal run-state.json under <mainRoot>/.orchestrate/runs/<runId>/
 * carrying a `driverSessionId` (a key absent from render.ts's runStateSchema —
 * its survival proves the writer round-trips raw JSON, not the schema) and one
 * slice keyed by `sliceId`. Returns the run-state path.
 */
function writeRunState(
  mainRoot: string,
  runId: string,
  sliceId: string,
  extra?: Record<string, unknown>
): string {
  const runDir = path.join(mainRoot, ".orchestrate", "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  const statePath = path.join(runDir, "run-state.json");
  const state = {
    runId,
    status: "in-progress",
    driverSessionId: "session-uuid-keep-me",
    umbrellaBranch: `orchestrate/umbrella-${runId}`,
    integrationBase: "development",
    parentIssue: null,
    startedAt: "2026-06-04T00:00:00Z",
    updatedAt: "2026-06-04T00:00:00Z",
    waves: [[sliceId]],
    completedWaves: 0,
    finalPullRequest: null,
    slices: {
      [sliceId]: {
        issue: Number(sliceId),
        title: "test slice",
        wave: 0,
        tier: "standard",
        blockedBy: [],
        state: "in-progress",
        sliceBranch: `orchestrate/slice-${sliceId}`,
        worktreePath: null,
        pullRequest: null,
        failureReason: null,
        updatedAt: "2026-06-04T00:00:00Z",
        ...extra,
      },
    },
  };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
  return statePath;
}

function readRunState(statePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

// ─── Test state ───────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function track(p: string): string {
  tempDirs.push(p);
  return p;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmrf(tempDirs.pop()!);
  }
});

// ─── finalize_slice — phase A (commit + push) ─────────────────────────────────

describe("finalizeSlice — phase 'commit-push'", () => {
  it("stages only the named files, commits with the two -m form, pushes, and writes subState='pushed' — verdict committed-pushed", async () => {
    const bare = track(createBareRepo());
    const worktree = track(createWorkRepo(bare, "orchestrate/slice-7"));
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    const statePath = writeRunState(mainRoot, "prd1-20260604-000000", "7");

    // The file finalize must stage.
    fs.writeFileSync(path.join(worktree, "feature.ts"), "export const x = 1;\n");
    // An UNTRACKED file that must NOT be committed.
    fs.writeFileSync(path.join(worktree, "stray.log"), "noise\n");

    const r = await finalizeSlice(
      {
        phase: "commit-push",
        worktreePath: worktree,
        repoPath: mainRoot,
        runId: "prd1-20260604-000000",
        sliceId: "7",
        branch: "orchestrate/slice-7",
        remote: "origin",
        setUpstream: true,
        files: ["feature.ts"],
        commitSubject: "feat(x): the slice",
        issueNumber: 7,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("committed-pushed");

    // The commit landed and contains the staged file.
    const committed = git(["show", "--name-only", "--format=", "HEAD"], worktree)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(committed).toContain("feature.ts");
    // The untracked file was NOT committed.
    expect(committed).not.toContain("stray.log");
    // And it is still untracked in the worktree.
    const statusOut = git(["status", "--porcelain"], worktree);
    expect(statusOut).toContain("stray.log");

    // The commit message preserves subject + Closes trailer.
    const msg = git(["log", "-1", "--format=%B", "HEAD"], worktree);
    expect(msg).toContain("feat(x): the slice");
    expect(msg).toContain("Closes #7");

    // The branch landed on the bare origin at the local tip.
    const localSha = git(["rev-parse", "refs/heads/orchestrate/slice-7"], worktree);
    expect(r.sha).toBe(localSha);
    const remoteRefs = git(["ls-remote", "--heads", bare], worktree);
    expect(remoteRefs).toContain("refs/heads/orchestrate/slice-7");

    // subState 'pushed' written into the MAIN-root run-state (not the worktree).
    const state = readRunState(statePath);
    expect(state.slices["7"].subState).toBe("pushed");
    // The raw-JSON round-trip preserved driverSessionId (absent from the schema).
    expect(state.driverSessionId).toBe("session-uuid-keep-me");
    // No run-state was written under the worktree.
    expect(fs.existsSync(path.join(worktree, ".orchestrate", "runs"))).toBe(false);
  });

  it("returns failed{EMPTY_CHANGESET} and does NOT commit when nothing is staged", async () => {
    const bare = track(createBareRepo());
    const worktree = track(createWorkRepo(bare, "orchestrate/slice-7"));
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    const statePath = writeRunState(mainRoot, "prd1-20260604-000000", "7");

    const headBefore = git(["rev-parse", "HEAD"], worktree);

    // `files` names a path that exists but is already committed (no change) — so
    // `git add` stages nothing and `diff --cached --quiet` finds an empty index.
    const r = await finalizeSlice(
      {
        phase: "commit-push",
        worktreePath: worktree,
        repoPath: mainRoot,
        runId: "prd1-20260604-000000",
        sliceId: "7",
        branch: "orchestrate/slice-7",
        remote: "origin",
        setUpstream: true,
        files: ["README.md"],
        commitSubject: "feat(x): the slice",
        issueNumber: 7,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("EMPTY_CHANGESET");
    // No new commit was made.
    expect(git(["rev-parse", "HEAD"], worktree)).toBe(headBefore);
    // No subState was written (still absent).
    const state = readRunState(statePath);
    expect(state.slices["7"].subState).toBeUndefined();
  });

  it("returns failed{INVALID_INPUT} for an option-injection branch (e.g. --force) before staging", async () => {
    const bare = track(createBareRepo());
    const worktree = track(createWorkRepo(bare, "orchestrate/slice-7"));
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    writeRunState(mainRoot, "prd1-20260604-000000", "7");

    fs.writeFileSync(path.join(worktree, "feature.ts"), "export const x = 1;\n");
    const headBefore = git(["rev-parse", "HEAD"], worktree);

    const r = await finalizeSlice(
      {
        phase: "commit-push",
        worktreePath: worktree,
        repoPath: mainRoot,
        runId: "prd1-20260604-000000",
        sliceId: "7",
        branch: "--force",
        remote: "origin",
        setUpstream: true,
        files: ["feature.ts"],
        commitSubject: "feat(x): the slice",
        issueNumber: 7,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("INVALID_INPUT");
    // Nothing was staged or committed — the guard ran before commit.
    expect(git(["rev-parse", "HEAD"], worktree)).toBe(headBefore);
  });

  it("returns failed{INVALID_INPUT} for an option-injection remote", async () => {
    const bare = track(createBareRepo());
    const worktree = track(createWorkRepo(bare, "orchestrate/slice-7"));
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    writeRunState(mainRoot, "prd1-20260604-000000", "7");

    fs.writeFileSync(path.join(worktree, "feature.ts"), "export const x = 1;\n");

    const r = await finalizeSlice(
      {
        phase: "commit-push",
        worktreePath: worktree,
        repoPath: mainRoot,
        runId: "prd1-20260604-000000",
        sliceId: "7",
        branch: "orchestrate/slice-7",
        remote: "--upload-pack=x",
        setUpstream: true,
        files: ["feature.ts"],
        commitSubject: "feat(x): the slice",
        issueNumber: 7,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });

  it("bubbles PUSH_FAILED when the remote points at a bad path (commit made, push fails)", async () => {
    const worktree = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-work-")));
    git(["init"], worktree);
    git(["config", "user.email", "test@test.local"], worktree);
    git(["config", "user.name", "Test User"], worktree);
    git(["checkout", "-b", "orchestrate/slice-7"], worktree);
    fs.writeFileSync(path.join(worktree, "README.md"), "# Test repo\n");
    git(["add", "README.md"], worktree);
    git(["commit", "-m", "Initial commit"], worktree);
    const badOrigin = path.join(os.tmpdir(), "orchestrate-does-not-exist-" + Date.now());
    git(["remote", "add", "origin", badOrigin], worktree);

    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    const statePath = writeRunState(mainRoot, "prd1-20260604-000000", "7");

    fs.writeFileSync(path.join(worktree, "feature.ts"), "export const x = 1;\n");

    const r = await finalizeSlice(
      {
        phase: "commit-push",
        worktreePath: worktree,
        repoPath: mainRoot,
        runId: "prd1-20260604-000000",
        sliceId: "7",
        branch: "orchestrate/slice-7",
        remote: "origin",
        setUpstream: true,
        files: ["feature.ts"],
        commitSubject: "feat(x): the slice",
        issueNumber: 7,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("PUSH_FAILED");
    // The push failed, so subState 'pushed' was NOT written.
    const state = readRunState(statePath);
    expect(state.slices["7"].subState).toBeUndefined();
  });

  it("bubbles BRANCH_NOT_ON_REMOTE — adversarial stale-SHA-vs-presence: the push lands in pushBare but verification reads fetchBare (absent)", async () => {
    // Split push vs fetch URLs on a single remote: the push lands in `pushBare`,
    // but `git ls-remote origin` reads `fetchBare` (where the branch is absent)
    // — so verification can never see the landed branch → fail loud.
    const pushBare = track(createBareRepo());
    const fetchBare = track(createBareRepo());
    const worktree = track(createWorkRepo(fetchBare, "orchestrate/slice-7"));
    git(["remote", "set-url", "--push", "origin", pushBare], worktree);

    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    const statePath = writeRunState(mainRoot, "prd1-20260604-000000", "7");

    fs.writeFileSync(path.join(worktree, "feature.ts"), "export const x = 1;\n");

    const r = await finalizeSlice(
      {
        phase: "commit-push",
        worktreePath: worktree,
        repoPath: mainRoot,
        runId: "prd1-20260604-000000",
        sliceId: "7",
        branch: "orchestrate/slice-7",
        remote: "origin",
        setUpstream: true,
        files: ["feature.ts"],
        commitSubject: "feat(x): the slice",
        issueNumber: 7,
      },
      { attempts: 2, sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("BRANCH_NOT_ON_REMOTE");
    const state = readRunState(statePath);
    expect(state.slices["7"].subState).toBeUndefined();
  });

  it("returns failed{RUN_STATE_NOT_FOUND} when the run-state.json does not exist", async () => {
    const bare = track(createBareRepo());
    const worktree = track(createWorkRepo(bare, "orchestrate/slice-7"));
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    // No run-state written.

    fs.writeFileSync(path.join(worktree, "feature.ts"), "export const x = 1;\n");

    const r = await finalizeSlice(
      {
        phase: "commit-push",
        worktreePath: worktree,
        repoPath: mainRoot,
        runId: "prd1-20260604-000000",
        sliceId: "7",
        branch: "orchestrate/slice-7",
        remote: "origin",
        setUpstream: true,
        files: ["feature.ts"],
        commitSubject: "feat(x): the slice",
        issueNumber: 7,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("RUN_STATE_NOT_FOUND");
  });
});

// ─── finalize_slice — phase B (post-merge tail) ───────────────────────────────

describe("finalizeSlice — phase 'post-merge'", () => {
  it("writes subState='merged', removes the worktree, then reclaims the local branch — verdict committed-pushed", async () => {
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    git(["init"], mainRoot);
    git(["config", "user.email", "test@test.local"], mainRoot);
    git(["config", "user.name", "Test User"], mainRoot);
    fs.writeFileSync(path.join(mainRoot, "README.md"), "# Main\n");
    git(["add", "README.md"], mainRoot);
    git(["commit", "-m", "Initial commit"], mainRoot);

    // Create a real worktree on a slice branch off the main repo.
    const worktree = track(path.join(os.tmpdir(), "orchestrate-wt-" + Date.now()));
    git(["worktree", "add", "-b", "orchestrate/slice-7", worktree, "HEAD"], mainRoot);

    const statePath = writeRunState(mainRoot, "prd1-20260604-000000", "7", {
      worktreePath: worktree,
      subState: "pr-open",
    });

    const r = await finalizeSlice({
      phase: "post-merge",
      worktreePath: worktree,
      repoPath: mainRoot,
      runId: "prd1-20260604-000000",
      sliceId: "7",
      branch: "orchestrate/slice-7",
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("committed-pushed");

    // subState advanced to 'merged'.
    const state = readRunState(statePath);
    expect(state.slices["7"].subState).toBe("merged");
    expect(state.driverSessionId).toBe("session-uuid-keep-me");

    // The worktree was removed.
    expect(fs.existsSync(worktree)).toBe(false);
    // The local branch was reclaimed.
    const branches = git(["branch", "--list", "orchestrate/slice-7"], mainRoot);
    expect(branches).toBe("");
  });

  it("is idempotent — a re-run with the worktree already gone and the branch already deleted still returns ok", async () => {
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    git(["init"], mainRoot);
    git(["config", "user.email", "test@test.local"], mainRoot);
    git(["config", "user.name", "Test User"], mainRoot);
    fs.writeFileSync(path.join(mainRoot, "README.md"), "# Main\n");
    git(["add", "README.md"], mainRoot);
    git(["commit", "-m", "Initial commit"], mainRoot);

    const worktree = track(path.join(os.tmpdir(), "orchestrate-wt-" + Date.now()));
    git(["worktree", "add", "-b", "orchestrate/slice-7", worktree, "HEAD"], mainRoot);

    const statePath = writeRunState(mainRoot, "prd1-20260604-000000", "7", {
      worktreePath: worktree,
      subState: "merged",
    });

    // First pass removes the worktree and branch.
    const first = await finalizeSlice({
      phase: "post-merge",
      worktreePath: worktree,
      repoPath: mainRoot,
      runId: "prd1-20260604-000000",
      sliceId: "7",
      branch: "orchestrate/slice-7",
    });
    expect(first.status).toBe("ok");

    // Second pass — worktree and branch are already gone; still ok (idempotent).
    const second = await finalizeSlice({
      phase: "post-merge",
      worktreePath: worktree,
      repoPath: mainRoot,
      runId: "prd1-20260604-000000",
      sliceId: "7",
      branch: "orchestrate/slice-7",
    });
    expect(second.status).toBe("ok");
    expect(second.verdict).toBe("committed-pushed");

    const state = readRunState(statePath);
    expect(state.slices["7"].subState).toBe("merged");
  });

  it("returns failed{INVALID_INPUT} for an option-injection branch in phase post-merge", async () => {
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    git(["init"], mainRoot);
    git(["config", "user.email", "test@test.local"], mainRoot);
    git(["config", "user.name", "Test User"], mainRoot);
    fs.writeFileSync(path.join(mainRoot, "README.md"), "# Main\n");
    git(["add", "README.md"], mainRoot);
    git(["commit", "-m", "Initial commit"], mainRoot);
    writeRunState(mainRoot, "prd1-20260604-000000", "7");

    const r = await finalizeSlice({
      phase: "post-merge",
      worktreePath: path.join(mainRoot, "wt"),
      repoPath: mainRoot,
      runId: "prd1-20260604-000000",
      sliceId: "7",
      branch: "--force",
    });

    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });

  it("returns failed{SLICE_NOT_IN_RUN_STATE} when sliceId is not a key in slices", async () => {
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));
    git(["init"], mainRoot);
    git(["config", "user.email", "test@test.local"], mainRoot);
    git(["config", "user.name", "Test User"], mainRoot);
    fs.writeFileSync(path.join(mainRoot, "README.md"), "# Main\n");
    git(["add", "README.md"], mainRoot);
    git(["commit", "-m", "Initial commit"], mainRoot);

    const worktree = track(path.join(os.tmpdir(), "orchestrate-wt-" + Date.now()));
    git(["worktree", "add", "-b", "orchestrate/slice-7", worktree, "HEAD"], mainRoot);
    // run-state keyed on a DIFFERENT slice id than the one we finalize.
    writeRunState(mainRoot, "prd1-20260604-000000", "99", {
      worktreePath: worktree,
    });

    const r = await finalizeSlice({
      phase: "post-merge",
      worktreePath: worktree,
      repoPath: mainRoot,
      runId: "prd1-20260604-000000",
      sliceId: "7",
      branch: "orchestrate/slice-7",
    });

    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("SLICE_NOT_IN_RUN_STATE");
  });

  it("returns failed{RUN_ID_INVALID} for a malformed runId", async () => {
    const mainRoot = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-main-")));

    const r = await finalizeSlice({
      phase: "post-merge",
      worktreePath: path.join(mainRoot, "wt"),
      repoPath: mainRoot,
      runId: "../escape",
      sliceId: "7",
      branch: "orchestrate/slice-7",
    });

    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("RUN_ID_INVALID");
  });
});
