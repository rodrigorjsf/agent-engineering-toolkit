import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  pushAndVerify,
  verifyLanded,
} from "../src/tools/push-and-verify.js";

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
 * Creates a working repo with one commit on a named branch and a remote
 * pointing at `bareOrigin`. Returns the repo path. The branch is created but
 * NOT pushed — the test under inspection does the push.
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

// ─── verifyLanded ─────────────────────────────────────────────────────────────

describe("verifyLanded", () => {
  it("returns landed=false after exactly `attempts` polls when the ref is absent on the remote", async () => {
    const bare = track(createBareRepo());
    const repo = track(createWorkRepo(bare, "feature/x"));
    // Nothing was pushed, so the ref is absent on the remote.
    const localSha = git(["rev-parse", "refs/heads/feature/x"], repo);

    const r = await verifyLanded(repo, "origin", "feature/x", localSha, {
      attempts: 3,
      sleep: noopSleep,
    });

    expect(r.landed).toBe(false);
    expect(r.attempts).toBe(3);
  });

  it("returns landed=true, attempts=1 when the remote ref matches the expected SHA", async () => {
    const bare = track(createBareRepo());
    const repo = track(createWorkRepo(bare, "feature/x"));
    git(["push", "origin", "feature/x"], repo);
    const localSha = git(["rev-parse", "refs/heads/feature/x"], repo);

    const r = await verifyLanded(repo, "origin", "feature/x", localSha, {
      sleep: noopSleep,
    });

    expect(r.landed).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it("returns landed=false when the remote ref is present but STALE (older SHA) — proves SHA-match, not presence", async () => {
    const bare = track(createBareRepo());
    const repo = track(createWorkRepo(bare, "feature/x"));
    // Push the first (older) commit so the ref EXISTS on the remote.
    git(["push", "origin", "feature/x"], repo);
    // Advance the local branch — the remote ref is now stale.
    fs.appendFileSync(path.join(repo, "README.md"), "\nnewer line\n");
    git(["add", "README.md"], repo);
    git(["commit", "-m", "Second commit"], repo);
    const newerSha = git(["rev-parse", "refs/heads/feature/x"], repo);

    // The remote still points at the OLD commit; verifying the newer SHA must
    // NOT pass on presence alone.
    const r = await verifyLanded(repo, "origin", "feature/x", newerSha, {
      attempts: 2,
      sleep: noopSleep,
    });

    expect(r.landed).toBe(false);
    expect(r.attempts).toBe(2);
  });
});

// ─── pushAndVerify ────────────────────────────────────────────────────────────

describe("pushAndVerify", () => {
  it("pushes a real branch to a local bare origin and returns status='ok' with the correct sha", async () => {
    const bare = track(createBareRepo());
    const repo = track(createWorkRepo(bare, "orchestrate/slice-7"));
    const localSha = git(["rev-parse", "refs/heads/orchestrate/slice-7"], repo);

    const r = await pushAndVerify(
      { repoPath: repo, branch: "orchestrate/slice-7", remote: "origin", setUpstream: true },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("ok");
    expect(r.branch).toBe("orchestrate/slice-7");
    expect(r.remote).toBe("origin");
    expect(r.sha).toBe(localSha);
    expect(r.attempts).toBeGreaterThanOrEqual(1);
    // And the branch really landed on the bare origin.
    const remoteRefs = git(["ls-remote", "--heads", bare], repo);
    expect(remoteRefs).toContain("refs/heads/orchestrate/slice-7");
  });

  it("returns errorCode=PUSH_FAILED when the remote points at a bad path", async () => {
    // A remote whose URL is a non-existent path: `git push` exits non-zero.
    const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-work-"));
    track(repoPath);
    git(["init"], repoPath);
    git(["config", "user.email", "test@test.local"], repoPath);
    git(["config", "user.name", "Test User"], repoPath);
    git(["checkout", "-b", "feature/x"], repoPath);
    fs.writeFileSync(path.join(repoPath, "README.md"), "# Test repo\n");
    git(["add", "README.md"], repoPath);
    git(["commit", "-m", "Initial commit"], repoPath);
    const badOrigin = path.join(os.tmpdir(), "orchestrate-does-not-exist-" + Date.now());
    git(["remote", "add", "origin", badOrigin], repoPath);

    const r = await pushAndVerify(
      { repoPath, branch: "feature/x", remote: "origin", setUpstream: true },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("PUSH_FAILED");
    expect(r.errorMessage).toBeDefined();
  });

  it("returns errorCode=INVALID_INPUT when branch starts with '-'", async () => {
    const bare = track(createBareRepo());
    const repo = track(createWorkRepo(bare, "feature/x"));

    const r = await pushAndVerify(
      { repoPath: repo, branch: "--force", remote: "origin", setUpstream: true },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
    expect(r.errorMessage).toMatch(/branch/);
  });

  it("returns errorCode=INVALID_INPUT when remote starts with '-'", async () => {
    const bare = track(createBareRepo());
    const repo = track(createWorkRepo(bare, "feature/x"));

    const r = await pushAndVerify(
      { repoPath: repo, branch: "feature/x", remote: "--upload-pack=x", setUpstream: true },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
    expect(r.errorMessage).toMatch(/remote/);
  });

  it("returns errorCode=BRANCH_NOT_ON_REMOTE when the push succeeds but the verified remote never shows the branch", async () => {
    // Split push vs fetch URLs on a single remote: the push lands in `pushBare`,
    // but `git ls-remote origin` reads `fetchBare` (where the branch is absent)
    // — so verification can never see the landed branch → fail loud.
    const pushBare = track(createBareRepo());
    const fetchBare = track(createBareRepo());
    const repo = track(createWorkRepo(fetchBare, "feature/x"));
    git(["remote", "set-url", "--push", "origin", pushBare], repo);

    const r = await pushAndVerify(
      { repoPath: repo, branch: "feature/x", remote: "origin", setUpstream: true },
      { attempts: 2, sleep: noopSleep }
    );

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("BRANCH_NOT_ON_REMOTE");
    expect(r.errorMessage).toMatch(/did not land/);
  });

  it("returns errorCode=GIT_ERROR when the local branch does not exist", async () => {
    const bare = track(createBareRepo());
    const repo = track(createWorkRepo(bare, "feature/x"));

    const r = await pushAndVerify(
      { repoPath: repo, branch: "no-such-branch", remote: "origin", setUpstream: true },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("GIT_ERROR");
    expect(r.errorMessage).toBeDefined();
  });
});
