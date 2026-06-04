import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  resolveMergeConflict,
  scanConflictMarkers,
} from "../src/tools/resolve-merge-conflict.js";

// ─── Test helpers (mirrors run-wave.test.ts) ──────────────────────────────────

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

/**
 * Builds a slice worktree clone branched from the umbrella's STARTING state
 * (one commit behind the current remote tip), configured with a git identity.
 * Returns the worktree path. Caller commits the slice's own change.
 */
function createSliceWorktree(bare: string): string {
  const worktree = track(
    fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-"))
  );
  git(["clone", bare, worktree], path.dirname(worktree));
  git(["config", "user.email", "test@test.local"], worktree);
  git(["config", "user.name", "Test User"], worktree);
  git(
    [
      "checkout",
      "-b",
      "orchestrate/slice-7",
      "origin/orchestrate/umbrella-r1~1",
    ],
    worktree
  );
  return worktree;
}

// ─── operation 'prepare' ──────────────────────────────────────────────────────

describe("resolveMergeConflict — operation 'prepare'", () => {
  it("merges a non-conflicting umbrella and auto-commits — verdict clean", async () => {
    const bare = track(createBareRepo());
    // The remote umbrella holds an already-merged sibling that adds a NEW file.
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    fs.writeFileSync(path.join(advancer, "sibling.ts"), "export const s = 1;\n");
    git(["add", "sibling.ts"], advancer);
    git(["commit", "-m", "sibling merged"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    // The slice branched from the umbrella's starting state and changed a
    // DIFFERENT file — a clean (non-conflicting) merge.
    const worktree = createSliceWorktree(bare);
    fs.writeFileSync(path.join(worktree, "slice.ts"), "export const z = 3;\n");
    git(["add", "slice.ts"], worktree);
    git(["commit", "-m", "the slice"], worktree);

    const r = await resolveMergeConflict(
      {
        operation: "prepare",
        worktreePath: worktree,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("clean");
    // The merge brought the sibling's file in and auto-committed (clean tree).
    expect(fs.existsSync(path.join(worktree, "sibling.ts"))).toBe(true);
    expect(git(["status", "--porcelain"], worktree)).toBe("");
  });

  it("a conflicting umbrella merge leaves the unmerged index — verdict conflicted naming the path", async () => {
    const bare = track(createBareRepo());
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    // The sibling edits a SHARED file on the umbrella.
    fs.writeFileSync(
      path.join(advancer, "shared.ts"),
      "export const v = 'remote';\n"
    );
    git(["add", "shared.ts"], advancer);
    git(["commit", "-m", "sibling edits shared"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    const worktree = createSliceWorktree(bare);
    // The slice edits the SAME file at the SAME region — irreconcilable.
    fs.writeFileSync(
      path.join(worktree, "shared.ts"),
      "export const v = 'slice';\n"
    );
    git(["add", "shared.ts"], worktree);
    git(["commit", "-m", "slice edits shared"], worktree);

    const r = await resolveMergeConflict(
      {
        operation: "prepare",
        worktreePath: worktree,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("conflicted");
    expect(r.conflictedFiles).toContain("shared.ts");
    // The unmerged index is left in place (a merge is in progress).
    const unmerged = git(["diff", "--name-only", "--diff-filter=U"], worktree);
    expect(unmerged).toContain("shared.ts");
  });

  it("a rename/rename conflict emits BOTH renamed paths in conflictedFiles", async () => {
    const bare = track(createBareRepo());
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    // Seed a base file that BOTH sides will rename to DIFFERENT names — a
    // rename/rename (1-to-2) conflict, which reliably leaves BOTH target paths
    // unmerged (a rename/modify topology is git-version-fiddly and can collapse
    // to a single path, so this uses the deterministic two-path topology).
    fs.writeFileSync(
      path.join(advancer, "original.ts"),
      "export const original = 1;\n"
    );
    git(["add", "original.ts"], advancer);
    git(["commit", "-m", "seed original"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    // The umbrella RENAMES original.ts → umbrella-name.ts.
    git(["mv", "original.ts", "umbrella-name.ts"], advancer);
    git(["commit", "-m", "umbrella renames"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    // The slice branches from the umbrella tip BEFORE the rename (~1) and renames
    // the SAME base file to a DIFFERENT name — an irreconcilable rename/rename.
    const worktree = track(
      fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-"))
    );
    git(["clone", bare, worktree], path.dirname(worktree));
    git(["config", "user.email", "test@test.local"], worktree);
    git(["config", "user.name", "Test User"], worktree);
    git(
      [
        "checkout",
        "-b",
        "orchestrate/slice-7",
        "origin/orchestrate/umbrella-r1~1",
      ],
      worktree
    );
    git(["mv", "original.ts", "slice-name.ts"], worktree);
    git(["commit", "-m", "slice renames"], worktree);

    const r = await resolveMergeConflict(
      {
        operation: "prepare",
        worktreePath: worktree,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("conflicted");
    // Assert the impl returns EXACTLY what git emits (it collects every non-empty
    // line), then assert BOTH renamed targets are present in that emitted set.
    const unmerged = git(["diff", "--name-only", "--diff-filter=U"], worktree)
      .split("\n")
      .filter((l) => l.length > 0);
    expect(r.conflictedFiles).toEqual(unmerged);
    expect(r.conflictedFiles).toContain("umbrella-name.ts");
    expect(r.conflictedFiles).toContain("slice-name.ts");
  });

  it("RE-ENTRANCY: a pre-existing in-progress merge is aborted, then prepare recovers — verdict clean", async () => {
    const bare = track(createBareRepo());
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    fs.writeFileSync(path.join(advancer, "sibling.ts"), "export const s = 1;\n");
    git(["add", "sibling.ts"], advancer);
    git(["commit", "-m", "sibling merged"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    const worktree = createSliceWorktree(bare);
    fs.writeFileSync(path.join(worktree, "slice.ts"), "export const z = 3;\n");
    git(["add", "slice.ts"], worktree);
    git(["commit", "-m", "the slice"], worktree);

    // Plant a STALE in-progress merge: --no-commit --no-ff leaves MERGE_HEAD set
    // and the merge uncommitted, with no conflict required. A fresh prepare must
    // abort this before its own fetch+merge instead of wedging.
    git(["fetch", "origin", "orchestrate/umbrella-r1"], worktree);
    git(["merge", "--no-commit", "--no-ff", "FETCH_HEAD"], worktree);
    // Sanity: a merge really is in progress (MERGE_HEAD exists).
    expect(
      fs.existsSync(path.join(worktree, ".git", "MERGE_HEAD"))
    ).toBe(true);

    const r = await resolveMergeConflict(
      {
        operation: "prepare",
        worktreePath: worktree,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    // Recovered: aborted the stale merge, then cleanly merged the umbrella.
    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("clean");
    expect(fs.existsSync(path.join(worktree, "sibling.ts"))).toBe(true);
    expect(git(["status", "--porcelain"], worktree)).toBe("");
  });

  it("RE-ENTRANCY into a conflict: stale merge aborted, then prepare surfaces the real conflict — verdict conflicted", async () => {
    const bare = track(createBareRepo());
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    fs.writeFileSync(
      path.join(advancer, "shared.ts"),
      "export const v = 'remote';\n"
    );
    git(["add", "shared.ts"], advancer);
    git(["commit", "-m", "sibling edits shared"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    const worktree = createSliceWorktree(bare);
    fs.writeFileSync(
      path.join(worktree, "shared.ts"),
      "export const v = 'slice';\n"
    );
    git(["add", "shared.ts"], worktree);
    git(["commit", "-m", "slice edits shared"], worktree);

    // Plant a stale in-progress merge of an UNRELATED clean change so MERGE_HEAD
    // is set going in. Use an octopus-safe simple no-ff merge of the umbrella tip
    // which itself conflicts — abort it, then prepare re-merges and re-surfaces.
    // To keep the stale merge itself uncomplicated, fabricate a MERGE_HEAD via a
    // throwaway no-ff merge of the current HEAD's parent is not possible; instead
    // start the conflicting merge and leave it mid-flight.
    git(["fetch", "origin", "orchestrate/umbrella-r1"], worktree);
    // This merge conflicts and leaves MERGE_HEAD + an unmerged index in place.
    expect(() =>
      git(["merge", "--no-edit", "FETCH_HEAD"], worktree)
    ).toThrow();
    expect(
      fs.existsSync(path.join(worktree, ".git", "MERGE_HEAD"))
    ).toBe(true);

    const r = await resolveMergeConflict(
      {
        operation: "prepare",
        worktreePath: worktree,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    // The stale merge was aborted, then prepare re-merged and surfaced the real
    // conflict — NOT a wedged 'error'.
    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("conflicted");
    expect(r.conflictedFiles).toContain("shared.ts");
  });

  it("an option-injection umbrellaRef is verdict error INVALID_INPUT", async () => {
    const local = track(
      fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-"))
    );
    git(["init"], local);

    const r = await resolveMergeConflict(
      {
        operation: "prepare",
        worktreePath: local,
        umbrellaRef: "--upload-pack=x",
        remote: "origin",
      },
      { sleep: noopSleep }
    );

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });

  it("an unreachable remote is verdict error GIT_ERROR (bounded retry, noopSleep)", async () => {
    const local = track(
      fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-"))
    );
    git(["init"], local);
    git(["config", "user.email", "test@test.local"], local);
    git(["config", "user.name", "Test User"], local);
    fs.writeFileSync(path.join(local, "f.ts"), "export const x = 1;\n");
    git(["add", "f.ts"], local);
    git(["commit", "-m", "init"], local);
    // Point origin at a path that does not exist — every fetch attempt fails.
    git(
      ["remote", "add", "origin", path.join(os.tmpdir(), "does-not-exist-xyz")],
      local
    );

    const r = await resolveMergeConflict(
      {
        operation: "prepare",
        worktreePath: local,
        umbrellaRef: "orchestrate/umbrella-r1",
        remote: "origin",
      },
      { sleep: noopSleep, fetchAttempts: 2, baseDelayMs: 1 }
    );

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("error");
    expect(r.errorCode).toBe("GIT_ERROR");
  });

  it("a missing umbrellaRef is verdict error INVALID_INPUT", async () => {
    const local = track(
      fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-"))
    );
    git(["init"], local);

    const r = await resolveMergeConflict({
      operation: "prepare",
      worktreePath: local,
    });

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });
});

// ─── operation 'finalize' ─────────────────────────────────────────────────────

describe("resolveMergeConflict — operation 'finalize'", () => {
  /**
   * Sets up a worktree mid-merge with a conflict in `shared.ts`, returns the
   * worktree path. The index is unmerged (a merge is in progress) — exactly the
   * post-prepare, post-resolver-spawn state finalize consumes.
   */
  function worktreeMidConflict(): string {
    const bare = track(createBareRepo());
    const advancer = track(createWorkRepo(bare, "orchestrate/umbrella-r1"));
    fs.writeFileSync(
      path.join(advancer, "shared.ts"),
      "export const v = 'remote';\n"
    );
    git(["add", "shared.ts"], advancer);
    git(["commit", "-m", "sibling edits shared"], advancer);
    git(["push", "origin", "orchestrate/umbrella-r1"], advancer);

    const worktree = createSliceWorktree(bare);
    fs.writeFileSync(
      path.join(worktree, "shared.ts"),
      "export const v = 'slice';\n"
    );
    git(["add", "shared.ts"], worktree);
    git(["commit", "-m", "slice edits shared"], worktree);

    git(["fetch", "origin", "orchestrate/umbrella-r1"], worktree);
    // Start the merge — it conflicts and leaves MERGE_HEAD + unmerged shared.ts.
    expect(() =>
      git(["merge", "--no-edit", "FETCH_HEAD"], worktree)
    ).toThrow();
    return worktree;
  }

  it("a resolver that resolved the file cleanly completes the merge — verdict completed", async () => {
    const worktree = worktreeMidConflict();

    // The resolver writes a clean merged file with NO markers.
    fs.writeFileSync(
      path.join(worktree, "shared.ts"),
      "export const v = 'merged-clean';\n"
    );

    const r = await resolveMergeConflict({
      operation: "finalize",
      worktreePath: worktree,
      resolvedFiles: ["shared.ts"],
    });

    expect(r.status).toBe("ok");
    expect(r.verdict).toBe("completed");
    // The merge commit was written: no merge in progress, clean tree.
    expect(
      fs.existsSync(path.join(worktree, ".git", "MERGE_HEAD"))
    ).toBe(false);
    expect(git(["status", "--porcelain"], worktree)).toBe("");
    // The committed content is the resolver's merged version.
    expect(fs.readFileSync(path.join(worktree, "shared.ts"), "utf8")).toContain(
      "merged-clean"
    );
  });

  it("residual conflict markers abort the merge and leave the worktree clean — verdict markers_remain", async () => {
    const worktree = worktreeMidConflict();
    const headBefore = git(["rev-parse", "HEAD"], worktree);

    // The resolver left the raw conflict markers in place (incomplete resolution).
    fs.writeFileSync(
      path.join(worktree, "shared.ts"),
      "<<<<<<< HEAD\nexport const v = 'slice';\n=======\nexport const v = 'remote';\n>>>>>>> FETCH_HEAD\n"
    );

    const r = await resolveMergeConflict({
      operation: "finalize",
      worktreePath: worktree,
      resolvedFiles: ["shared.ts"],
    });

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("markers_remain");
    expect(r.markerLines && r.markerLines.length).toBeGreaterThan(0);
    // The merge was ABORTED → worktree left CLEAN, HEAD unmoved, no merge running.
    expect(
      fs.existsSync(path.join(worktree, ".git", "MERGE_HEAD"))
    ).toBe(false);
    expect(git(["status", "--porcelain"], worktree)).toBe("");
    expect(git(["rev-parse", "HEAD"], worktree)).toBe(headBefore);
  });

  it("a missing resolvedFiles is verdict error INVALID_INPUT", async () => {
    const local = track(
      fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-wt-"))
    );
    git(["init"], local);

    const r = await resolveMergeConflict({
      operation: "finalize",
      worktreePath: local,
    });

    expect(r.status).toBe("failed");
    expect(r.verdict).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
  });
});

// ─── pure marker-scan unit ────────────────────────────────────────────────────

describe("scanConflictMarkers — the pure marker-scan predicate (no I/O)", () => {
  it("detects each of the three marker kinds on bare lines", () => {
    expect(scanConflictMarkers("<<<<<<< HEAD\n").hasMarkers).toBe(true);
    expect(scanConflictMarkers("=======\n").hasMarkers).toBe(true);
    expect(scanConflictMarkers(">>>>>>> theirs\n").hasMarkers).toBe(true);
  });

  it("detects markers on STAGED-DIFF lines (leading + column)", () => {
    const diff =
      "diff --git a/shared.ts b/shared.ts\n" +
      "index 1111..2222 100644\n" +
      "--- a/shared.ts\n" +
      "+++ b/shared.ts\n" +
      "@@ -1 +1,5 @@\n" +
      "+<<<<<<< HEAD\n" +
      "+export const v = 'slice';\n" +
      "+=======\n" +
      "+export const v = 'remote';\n" +
      "+>>>>>>> FETCH_HEAD\n";
    const scan = scanConflictMarkers(diff);
    expect(scan.hasMarkers).toBe(true);
    // All three marker lines captured (with their diff column preserved).
    expect(scan.offendingLines).toContain("+<<<<<<< HEAD");
    expect(scan.offendingLines).toContain("+=======");
    expect(scan.offendingLines).toContain("+>>>>>>> FETCH_HEAD");
  });

  it("does NOT false-positive on diff headers or clean content", () => {
    const cleanDiff =
      "diff --git a/shared.ts b/shared.ts\n" +
      "index 1111..2222 100644\n" +
      "--- a/shared.ts\n" +
      "+++ b/shared.ts\n" +
      "@@ -1 +1 @@\n" +
      "-export const v = 'slice';\n" +
      "+export const v = 'merged-clean';\n";
    const scan = scanConflictMarkers(cleanDiff);
    expect(scan.hasMarkers).toBe(false);
    expect(scan.offendingLines).toEqual([]);
  });

  it("an empty string has no markers", () => {
    const scan = scanConflictMarkers("");
    expect(scan.hasMarkers).toBe(false);
    expect(scan.offendingLines).toEqual([]);
  });
});
