import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { runWave } from "../src/tools/run-wave.js";

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
 * Creates a working repo with one commit on `branch`, a remote `origin` at
 * `bareOrigin`, and that branch pushed to the remote. Returns the repo path.
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
  git(["push", "-u", "origin", branch], repoPath);
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

/** Writes `.orchestrate/commands.json` into `dir`, given a verb→argv map. */
function writeCommands(dir: string, commands: Record<string, string[]>): void {
  fs.mkdirSync(path.join(dir, ".orchestrate"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".orchestrate", "commands.json"),
    JSON.stringify(commands, null, 2),
    "utf8"
  );
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

// ─── operation 'refresh-base' ─────────────────────────────────────────────────

describe("runWave — operation 'refresh-base'", () => {
  it("fast-forwards the local umbrella ref to its remote counterpart — verdict refreshed", async () => {
    const bare = track(createBareRepo());
    // Repo A pushes an advance to the umbrella's remote; repo B (ours) is behind.
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    const local = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-local-")));
    git(["clone", "--branch", "orchestrate/umbrella-r1", bare, local], path.dirname(local));
    git(["config", "user.email", "test@test.local"], local);
    git(["config", "user.name", "Test User"], local);

    // Advance the remote umbrella by one commit (a later wave's merge).
    fs.writeFileSync(path.join(advancer, "later.ts"), "export const y = 2;\n");
    git(["add", "later.ts"], advancer);
    git(["commit", "-m", "later wave"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    const localTipBefore = git(
      ["rev-parse", "refs/heads/orchestrate/umbrella-r1"],
      local
    );

    const r = await runWave(
      {
        operation: "refresh-base",
        repoPath: local,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("refreshed");

    // The local umbrella ref advanced to the remote tip.
    const localTipAfter = git(
      ["rev-parse", "refs/heads/orchestrate/umbrella-r1"],
      local
    );
    expect(localTipAfter).not.toBe(localTipBefore);
    const remoteTip = git(
      ["rev-parse", "orchestrate/umbrella-r1"],
      advancer
    );
    expect(localTipAfter).toBe(remoteTip);
    expect(r.sha).toBe(remoteTip);
  });

  it("a no-op fast-forward (already at the remote tip) is verdict refreshed", async () => {
    const bare = track(createBareRepo());
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    const local = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-local-")));
    git(["clone", "--branch", "orchestrate/umbrella-r1", bare, local], path.dirname(local));
    git(["config", "user.email", "test@test.local"], local);
    git(["config", "user.name", "Test User"], local);

    const r = await runWave(
      {
        operation: "refresh-base",
        repoPath: local,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("refreshed");
  });

  it("a diverged umbrella (local has commits the remote tip is not an ancestor of) is verdict diverged", async () => {
    const bare = track(createBareRepo());
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    const local = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-local-")));
    git(["clone", "--branch", "orchestrate/umbrella-r1", bare, local], path.dirname(local));
    git(["config", "user.email", "test@test.local"], local);
    git(["config", "user.name", "Test User"], local);

    // Remote umbrella advances one way…
    fs.writeFileSync(path.join(advancer, "remote-side.ts"), "export const a = 1;\n");
    git(["add", "remote-side.ts"], advancer);
    git(["commit", "-m", "remote divergence"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    // …and the LOCAL umbrella advances a different, incompatible way: the remote
    // tip is now NOT an ancestor of local, so a fast-forward is impossible.
    fs.writeFileSync(path.join(local, "local-side.ts"), "export const b = 2;\n");
    git(["add", "local-side.ts"], local);
    git(["commit", "-m", "local divergence"], local);

    const localTipBefore = git(
      ["rev-parse", "refs/heads/orchestrate/umbrella-r1"],
      local
    );

    const r = await runWave(
      {
        operation: "refresh-base",
        repoPath: local,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("diverged");
    // The local ref was NOT moved — fail loud, do not clobber.
    expect(
      git(["rev-parse", "refs/heads/orchestrate/umbrella-r1"], local)
    ).toBe(localTipBefore);
  });

  it("returns verdict error for an option-injection umbrellaRef (e.g. --upload-pack=x)", async () => {
    const local = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-local-")));
    git(["init"], local);

    const r = await runWave(
      {
        operation: "refresh-base",
        repoPath: local,
        umbrellaRef: "--upload-pack=x",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });
});

// ─── operation 'select-processable' ───────────────────────────────────────────

describe("runWave — operation 'select-processable'", () => {
  it("a slice whose in-partition blockers all reached passed is verdict processable", async () => {
    const r = await runWave({
      operation: "select-processable",
      inPartitionBlockers: [
        { blockerId: "5", state: "passed" },
        { blockerId: "6", state: "passed" },
      ],
      outOfPartitionBlockers: [{ blockerId: "99", state: "CLOSED" }],
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("processable");
  });

  it("a slice with no blockers at all is verdict processable", async () => {
    const r = await runWave({
      operation: "select-processable",
      inPartitionBlockers: [],
      outOfPartitionBlockers: [],
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("processable");
  });

  it("an OPEN out-of-partition blocker is verdict skip naming that blocker", async () => {
    const r = await runWave({
      operation: "select-processable",
      inPartitionBlockers: [{ blockerId: "5", state: "passed" }],
      outOfPartitionBlockers: [{ blockerId: "99", state: "OPEN" }],
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("skip");
    expect(r.blockerId).toBe("99");
  });

  it("a non-passed in-partition blocker (failed) is verdict skip naming that blocker", async () => {
    const r = await runWave({
      operation: "select-processable",
      inPartitionBlockers: [
        { blockerId: "5", state: "passed" },
        { blockerId: "6", state: "failed" },
      ],
      outOfPartitionBlockers: [],
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("skip");
    expect(r.blockerId).toBe("6");
  });

  it("a skipped in-partition blocker is verdict skip", async () => {
    const r = await runWave({
      operation: "select-processable",
      inPartitionBlockers: [{ blockerId: "6", state: "skipped" }],
      outOfPartitionBlockers: [],
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("skip");
    expect(r.blockerId).toBe("6");
  });
});

// ─── operation 'reverify-slice' ───────────────────────────────────────────────

describe("runWave — operation 'reverify-slice'", () => {
  it("is a no-op verdict skipped-first-merge when isFirstMergedThisWave", async () => {
    const local = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-")));
    git(["init"], local);

    const r = await runWave(
      {
        operation: "reverify-slice",
        repoPath: local,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
        isFirstMergedThisWave: true,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("skipped-first-merge");
  });

  it("merges the umbrella and runs both correctness verbs — verdict passed when both pass", async () => {
    const bare = track(createBareRepo());
    // The remote umbrella holds an already-merged sibling that adds a NEW file.
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    fs.writeFileSync(path.join(advancer, "sibling.ts"), "export const s = 1;\n");
    git(["add", "sibling.ts"], advancer);
    git(["commit", "-m", "sibling merged"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    // The slice worktree branched from the umbrella's STARTING state and changed
    // a different file — a clean (non-conflicting) merge.
    const worktree = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-")));
    git(["clone", bare, worktree], path.dirname(worktree));
    git(["config", "user.email", "test@test.local"], worktree);
    git(["config", "user.name", "Test User"], worktree);
    git(["checkout", "-b", "orchestrate/slice-7", "origin/orchestrate/umbrella-r1~1"], worktree);
    fs.writeFileSync(path.join(worktree, "slice.ts"), "export const z = 3;\n");
    git(["add", "slice.ts"], worktree);
    git(["commit", "-m", "the slice"], worktree);
    writeCommands(worktree, {
      tests: ["node", "-e", "process.exit(0)"],
      build: ["node", "-e", "process.exit(0)"],
    });

    const r = await runWave(
      {
        operation: "reverify-slice",
        repoPath: worktree,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
        isFirstMergedThisWave: false,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("passed");
    // The merge actually brought the sibling's file into the worktree.
    expect(fs.existsSync(path.join(worktree, "sibling.ts"))).toBe(true);
  });

  it("verdict failed{which:tests} when the merged worktree fails the tests verb", async () => {
    const bare = track(createBareRepo());
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    fs.writeFileSync(path.join(advancer, "sibling.ts"), "export const s = 1;\n");
    git(["add", "sibling.ts"], advancer);
    git(["commit", "-m", "sibling merged"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    const worktree = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-")));
    git(["clone", bare, worktree], path.dirname(worktree));
    git(["config", "user.email", "test@test.local"], worktree);
    git(["config", "user.name", "Test User"], worktree);
    git(["checkout", "-b", "orchestrate/slice-7", "origin/orchestrate/umbrella-r1~1"], worktree);
    fs.writeFileSync(path.join(worktree, "slice.ts"), "export const z = 3;\n");
    git(["add", "slice.ts"], worktree);
    git(["commit", "-m", "the slice"], worktree);
    // tests FAIL, build passes — the post-merge combination breaks the unit suite.
    writeCommands(worktree, {
      tests: ["node", "-e", "process.exit(1)"],
      build: ["node", "-e", "process.exit(0)"],
    });

    const r = await runWave(
      {
        operation: "reverify-slice",
        repoPath: worktree,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
        isFirstMergedThisWave: false,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("failed");
    expect(r.which).toBe("tests");
  });

  it("verdict conflict when the umbrella merge conflicts — the conflicted index is left in place, not aborted", async () => {
    const bare = track(createBareRepo());
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    // The sibling edits a SHARED file on the umbrella.
    fs.writeFileSync(path.join(advancer, "shared.ts"), "export const v = 'remote';\n");
    git(["add", "shared.ts"], advancer);
    git(["commit", "-m", "sibling edits shared"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    const worktree = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-")));
    git(["clone", bare, worktree], path.dirname(worktree));
    git(["config", "user.email", "test@test.local"], worktree);
    git(["config", "user.name", "Test User"], worktree);
    git(["checkout", "-b", "orchestrate/slice-7", "origin/orchestrate/umbrella-r1~1"], worktree);
    // The slice edits the SAME file at the SAME region — an irreconcilable merge.
    fs.writeFileSync(path.join(worktree, "shared.ts"), "export const v = 'slice';\n");
    git(["add", "shared.ts"], worktree);
    git(["commit", "-m", "slice edits shared"], worktree);
    writeCommands(worktree, {
      tests: ["node", "-e", "process.exit(0)"],
      build: ["node", "-e", "process.exit(0)"],
    });

    const r = await runWave(
      {
        operation: "reverify-slice",
        repoPath: worktree,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
        isFirstMergedThisWave: false,
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("conflict");
    // The conflicted index is LEFT IN PLACE (not aborted) — #274 owns resolution.
    const unmerged = git(["diff", "--name-only", "--diff-filter=U"], worktree);
    expect(unmerged).toContain("shared.ts");
  });
});

// ─── operation 'integration-gate' ─────────────────────────────────────────────

describe("runWave — operation 'integration-gate'", () => {
  it("verdict proceed when the integration suite passes", async () => {
    const dir = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-int-")));
    writeCommands(dir, { integration: ["node", "-e", "process.exit(0)"] });

    const r = await runWave({
      operation: "integration-gate",
      repoPath: dir,
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("proceed");
  });

  it("verdict halt when the integration suite fails", async () => {
    const dir = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-int-")));
    writeCommands(dir, { integration: ["node", "-e", "process.exit(1)"] });

    const r = await runWave({
      operation: "integration-gate",
      repoPath: dir,
    });

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("halt");
  });

  it("verdict tolerate when no integration suite is configured", async () => {
    const dir = track(fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-int-")));
    writeCommands(dir, { tests: ["node", "-e", "process.exit(0)"] });

    const r = await runWave({
      operation: "integration-gate",
      repoPath: dir,
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("tolerate");
  });
});

// ─── plan-wave-width ──────────────────────────────────────────────────────────
//
// A parallel wave holds roughly twice as many live agents as it has slices —
// the slice executor plus the one worker it currently has running — so the
// wave's width is computed against the platform's concurrent-subagent limit
// instead of assumed to be "every processable slice".

describe("runWave — operation 'plan-wave-width'", () => {
  it("caps the wave at half the concurrency limit (two agent slots per slice)", async () => {
    const r = await runWave({
      operation: "plan-wave-width",
      processableCount: 30,
      concurrencyLimit: 20,
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("width-planned");
    expect(r.waveWidth).toBe(10);
    expect(r.deferredCount).toBe(20);
  });

  it("defaults to the platform's own default limit of 20 (width 10)", async () => {
    const r = await runWave({
      operation: "plan-wave-width",
      processableCount: 12,
    });

    expect(r.waveWidth).toBe(10);
    expect(r.deferredCount).toBe(2);
  });

  it("defers nothing when the processable slices already fit", async () => {
    const r = await runWave({
      operation: "plan-wave-width",
      processableCount: 4,
      concurrencyLimit: 20,
    });

    expect(r.waveWidth).toBe(4);
    expect(r.deferredCount).toBe(0);
  });

  it("floors the width at 1 so a limit of 1 cannot deadlock the wave", async () => {
    const r = await runWave({
      operation: "plan-wave-width",
      processableCount: 5,
      concurrencyLimit: 1,
    });

    expect(r.waveWidth).toBe(1);
    expect(r.deferredCount).toBe(4);
  });

  it("scales with a raised concurrency limit", async () => {
    const r = await runWave({
      operation: "plan-wave-width",
      processableCount: 50,
      concurrencyLimit: 40,
    });

    expect(r.waveWidth).toBe(20);
    expect(r.deferredCount).toBe(30);
  });

  it("returns verdict error when processableCount is missing", async () => {
    const r = await runWave({ operation: "plan-wave-width" });

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });

  it("returns verdict error for a non-positive processableCount", async () => {
    const r = await runWave({
      operation: "plan-wave-width",
      processableCount: 0,
    });

    expect(r.verdict).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });
});

// ─── classify-spawn-outcome ───────────────────────────────────────────────────
//
// A concurrency-limit refusal is BACKPRESSURE, never a slice failure: nothing
// is wrong with the slice, so it returns to the queue with its state unchanged.
// The session spawn budget is a different animal — it is spent, not busy — and
// the two must never be conflated.

describe("runWave — operation 'classify-spawn-outcome'", () => {
  it("classifies a concurrent-subagent-limit refusal as backpressure", async () => {
    const r = await runWave({
      operation: "classify-spawn-outcome",
      spawnFailureText:
        "Concurrent subagent limit reached (20). Do not retry this spawn.",
    });

    expect(r.verdict).toBe("backpressure");
    expect(r.limitSignal).toBe("concurrent-subagent-limit");
  });

  it("never reports a failed status for backpressure", async () => {
    const r = await runWave({
      operation: "classify-spawn-outcome",
      spawnFailureText: "Concurrent subagent limit reached",
    });

    // A backpressure classification must not read as a slice failure anywhere
    // in the structured result — no failed status, no error code, no message.
    expect(r.status).toBe("ok");
    expect(r.errorCode).toBeUndefined();
    expect(r.errorMessage).toBeUndefined();
  });

  it("matches the refusal literal case-insensitively", async () => {
    const r = await runWave({
      operation: "classify-spawn-outcome",
      spawnFailureText: "Error: CONCURRENT SUBAGENT LIMIT REACHED",
    });

    expect(r.verdict).toBe("backpressure");
  });

  it("keeps the session spawn budget distinguishable from backpressure", async () => {
    const r = await runWave({
      operation: "classify-spawn-outcome",
      spawnFailureText: "Subagent spawn limit reached (200 per session).",
    });

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("spawn-error");
    expect(r.limitSignal).toBe("session-spawn-limit");
  });

  it("defaults an unrecognized failure to spawn-error, never to backpressure", async () => {
    const r = await runWave({
      operation: "classify-spawn-outcome",
      spawnFailureText: "ECONNRESET while starting the subagent",
    });

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("spawn-error");
    expect(r.limitSignal).toBe("unrecognized");
  });

  it("returns verdict error when spawnFailureText is missing", async () => {
    const r = await runWave({ operation: "classify-spawn-outcome" });

    expect(r.verdict).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });

  it("is pure — it needs no repoPath and touches no git state", async () => {
    const r = await runWave({
      operation: "classify-spawn-outcome",
      spawnFailureText: "Concurrent subagent limit reached",
    });

    expect(r.verdict).toBe("backpressure");
    expect(r.sha).toBeUndefined();
  });
});
