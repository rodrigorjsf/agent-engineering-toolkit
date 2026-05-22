import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { recoverChangedFiles } from "../src/tools/recover-changed-files.js";

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

// ─── Test state ───────────────────────────────────────────────────────────────

let repoPath: string;

beforeEach(() => {
  repoPath = createTempRepo();
});

afterEach(() => {
  rmrf(repoPath);
});

// ─── recover_changed_files ────────────────────────────────────────────────────

describe("recover_changed_files", () => {
  it("returns status='ok' with an empty list for a clean worktree", async () => {
    const r = await recoverChangedFiles({ worktreePath: repoPath });

    expect(r.status).toBe("ok");
    expect(r.changedFiles).toEqual([]);
  });

  it("recovers a modified tracked file", async () => {
    fs.appendFileSync(path.join(repoPath, "README.md"), "\nmodified line\n");

    const r = await recoverChangedFiles({ worktreePath: repoPath });

    expect(r.status).toBe("ok");
    expect(r.changedFiles).toContain("README.md");
  });

  it("recovers a staged tracked-file change", async () => {
    fs.appendFileSync(path.join(repoPath, "README.md"), "\nstaged line\n");
    git(["add", "README.md"], repoPath);

    const r = await recoverChangedFiles({ worktreePath: repoPath });

    expect(r.status).toBe("ok");
    expect(r.changedFiles).toContain("README.md");
  });

  it("recovers an untracked file", async () => {
    fs.writeFileSync(path.join(repoPath, "new-file.ts"), "export const x = 1;\n");

    const r = await recoverChangedFiles({ worktreePath: repoPath });

    expect(r.status).toBe("ok");
    expect(r.changedFiles).toContain("new-file.ts");
  });

  it("recovers both real paths of a staged rename, never as 'old -> new'", async () => {
    git(["mv", "README.md", "RENAMED.md"], repoPath);

    const r = await recoverChangedFiles({ worktreePath: repoPath });

    expect(r.status).toBe("ok");
    for (const entry of r.changedFiles!) {
      expect(entry).not.toContain(" -> ");
    }
    expect(r.changedFiles).toContain("RENAMED.md");
    expect(r.changedFiles).toContain("README.md");
  });

  it("recovers multiple changed files together", async () => {
    fs.appendFileSync(path.join(repoPath, "README.md"), "\nmod\n");
    fs.writeFileSync(path.join(repoPath, "a.ts"), "a\n");
    fs.writeFileSync(path.join(repoPath, "b.ts"), "b\n");

    const r = await recoverChangedFiles({ worktreePath: repoPath });

    expect(r.status).toBe("ok");
    expect(r.changedFiles).toEqual(
      expect.arrayContaining(["README.md", "a.ts", "b.ts"])
    );
  });

  it("returns errorCode=PATH_NOT_FOUND when the worktree path does not exist", async () => {
    const r = await recoverChangedFiles({
      worktreePath: path.join(repoPath, "does-not-exist"),
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("PATH_NOT_FOUND");
    expect(r.errorMessage).toMatch(/does not exist/i);
  });

  it("returns errorCode=GIT_ERROR for a non-git directory", async () => {
    const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-plain-"));
    try {
      const r = await recoverChangedFiles({ worktreePath: plainDir });

      expect(r.status).toBe("error");
      expect(r.errorCode).toBe("GIT_ERROR");
      expect(r.errorMessage).toBeDefined();
    } finally {
      rmrf(plainDir);
    }
  });

  it("refuses a worktreePath starting with '-' with errorCode=INVALID_INPUT", async () => {
    const r = await recoverChangedFiles({ worktreePath: "--git-dir" });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
    expect(r.errorMessage).toMatch(/worktreePath/);
  });
});
