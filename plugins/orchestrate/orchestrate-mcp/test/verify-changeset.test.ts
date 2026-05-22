import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { verifyChangeset } from "../src/tools/verify-changeset.js";

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

// ─── verify_changeset ─────────────────────────────────────────────────────────

describe("verify_changeset — matching changesets", () => {
  it("reports 'clean' when nothing was declared and the worktree is clean", async () => {
    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: [],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("clean");
    expect(r.actualFiles).toEqual([]);
    expect(r.declaredButAbsent).toEqual([]);
    expect(r.presentButUndeclared).toEqual([]);
  });

  it("reports 'matched' when the declared set equals the worktree changeset", async () => {
    fs.appendFileSync(path.join(repoPath, "README.md"), "\nmodified line\n");
    fs.writeFileSync(path.join(repoPath, "a.ts"), "export const a = 1;\n");

    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: ["README.md", "a.ts"],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("matched");
    expect(r.declaredButAbsent).toEqual([]);
    expect(r.presentButUndeclared).toEqual([]);
  });

  it("treats declared-file order as irrelevant to a 'matched' result", async () => {
    fs.writeFileSync(path.join(repoPath, "a.ts"), "a\n");
    fs.writeFileSync(path.join(repoPath, "b.ts"), "b\n");

    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: ["b.ts", "a.ts"],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("matched");
  });

  it("ignores duplicate entries in the declared list", async () => {
    fs.writeFileSync(path.join(repoPath, "a.ts"), "a\n");

    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: ["a.ts", "a.ts"],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("matched");
  });
});

describe("verify_changeset — mismatching changesets", () => {
  it("reports 'empty-but-declared' when files were declared but the worktree is clean", async () => {
    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: ["src/foo.ts"],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("empty-but-declared");
    expect(r.declaredButAbsent).toEqual(["src/foo.ts"]);
    expect(r.presentButUndeclared).toEqual([]);
  });

  it("reports 'mismatch' with declaredButAbsent when a declared file was never changed", async () => {
    fs.writeFileSync(path.join(repoPath, "a.ts"), "a\n");

    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: ["a.ts", "never-touched.ts"],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("mismatch");
    expect(r.declaredButAbsent).toEqual(["never-touched.ts"]);
    expect(r.presentButUndeclared).toEqual([]);
  });

  it("reports 'mismatch' with presentButUndeclared when the worktree changed an undeclared file", async () => {
    fs.writeFileSync(path.join(repoPath, "a.ts"), "a\n");
    fs.writeFileSync(path.join(repoPath, "surprise.ts"), "surprise\n");

    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: ["a.ts"],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("mismatch");
    expect(r.declaredButAbsent).toEqual([]);
    expect(r.presentButUndeclared).toEqual(["surprise.ts"]);
  });

  it("reports both directions of mismatch together", async () => {
    fs.writeFileSync(path.join(repoPath, "present.ts"), "present\n");

    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: ["absent.ts"],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("mismatch");
    expect(r.declaredButAbsent).toEqual(["absent.ts"]);
    expect(r.presentButUndeclared).toEqual(["present.ts"]);
  });

  it("reports 'suspiciously-empty' when nothing was declared but the worktree has changes", async () => {
    fs.writeFileSync(path.join(repoPath, "stray.ts"), "stray\n");

    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: [],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("suspiciously-empty");
    expect(r.presentButUndeclared).toEqual(["stray.ts"]);
    expect(r.declaredButAbsent).toEqual([]);
  });

  it("surfaces both real paths of a rename as actualFiles", async () => {
    git(["mv", "README.md", "RENAMED.md"], repoPath);

    const r = await verifyChangeset({
      worktreePath: repoPath,
      declaredFiles: ["README.md", "RENAMED.md"],
    });

    expect(r.status).toBe("ok");
    expect(r.match).toBe("matched");
    expect(r.actualFiles).toEqual(
      expect.arrayContaining(["README.md", "RENAMED.md"])
    );
  });
});

describe("verify_changeset — error handling", () => {
  it("returns errorCode=PATH_NOT_FOUND when the worktree path does not exist", async () => {
    const r = await verifyChangeset({
      worktreePath: path.join(repoPath, "does-not-exist"),
      declaredFiles: [],
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("PATH_NOT_FOUND");
    expect(r.errorMessage).toMatch(/does not exist/i);
  });

  it("returns errorCode=GIT_ERROR for a non-git directory", async () => {
    const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-plain-"));
    try {
      const r = await verifyChangeset({
        worktreePath: plainDir,
        declaredFiles: [],
      });

      expect(r.status).toBe("error");
      expect(r.errorCode).toBe("GIT_ERROR");
      expect(r.errorMessage).toBeDefined();
    } finally {
      rmrf(plainDir);
    }
  });

  it("refuses a worktreePath starting with '-' with errorCode=INVALID_INPUT", async () => {
    const r = await verifyChangeset({
      worktreePath: "--git-dir",
      declaredFiles: [],
    });

    expect(r.status).toBe("error");
    expect(r.errorCode).toBe("INVALID_INPUT");
    expect(r.errorMessage).toMatch(/worktreePath/);
  });
});
