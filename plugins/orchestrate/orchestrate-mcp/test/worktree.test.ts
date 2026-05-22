import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { createWorktree, removeWorktree } from "../src/tools/worktree.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { encoding: "utf8", cwd }).trim();
}

/** Creates a temporary git repository with one commit and returns its path. */
function createTempRepo(): string {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-test-"));

  git(["init"], repoPath);

  // Local identity so commits work in any environment.
  git(["config", "user.email", "test@test.local"], repoPath);
  git(["config", "user.name", "Test User"], repoPath);

  // Initial commit so HEAD exists.
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

/**
 * Writes `.orchestrate/commands.json` into `repo` and commits it, so a worktree
 * branched from HEAD carries the config.
 */
function commitCommandsJson(repo: string, commands: unknown): void {
  fs.mkdirSync(path.join(repo, ".orchestrate"), { recursive: true });
  fs.writeFileSync(
    path.join(repo, ".orchestrate", "commands.json"),
    JSON.stringify(commands, null, 2)
  );
  git(["add", "."], repo);
  git(["commit", "-m", "Add orchestrate commands.json"], repo);
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

// ─── create_worktree ──────────────────────────────────────────────────────────

describe("create_worktree", () => {
  it("creates a worktree from HEAD and returns status='ok' with path + branch", async () => {
    const wtPath = path.join(worktreesDir, "feature-wt");
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "feature/test-branch",
      worktreePath: wtPath,
      repoPath,
    });

    expect(result.status).toBe("ok");
    expect(result.path).toBe(wtPath);
    expect(result.branch).toBe("feature/test-branch");
    // No remote configured in a bare temp repo.
    expect(result.fetchStatus).toBe("skipped-no-remote");

    expect(fs.existsSync(wtPath)).toBe(true);
    const status = git(["status", "--porcelain"], wtPath);
    expect(status).toBe(""); // clean
  });

  it("resolves a relative worktreePath against repoPath into an absolute path", async () => {
    const relName = "relative-wt";
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "relative-branch",
      worktreePath: relName,
      repoPath,
    });

    expect(result.status).toBe("ok");
    // path must be the absolute resolution of repoPath + relName.
    expect(result.path).toBe(path.resolve(repoPath, relName));
    expect(path.isAbsolute(result.path!)).toBe(true);
    expect(fs.existsSync(result.path!)).toBe(true);

    // Clean up the worktree created inside repoPath.
    rmrf(result.path!);
  });

  it("returns errorCode=BASE_REF_NOT_FOUND when baseRef does not exist", async () => {
    const wtPath = path.join(worktreesDir, "bad-ref-wt");
    const result = await createWorktree({
      baseRef: "refs/heads/nonexistent-base",
      branch: "feature/dead-letter",
      worktreePath: wtPath,
      repoPath,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("BASE_REF_NOT_FOUND");
    expect(result.errorMessage).toBeDefined();
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it("returns errorCode=BRANCH_EXISTS when the branch name already exists", async () => {
    const firstPath = path.join(worktreesDir, "existing-branch-wt");
    const first = await createWorktree({
      baseRef: "HEAD",
      branch: "duplicate-branch",
      worktreePath: firstPath,
      repoPath,
    });
    expect(first.status).toBe("ok");

    const secondPath = path.join(worktreesDir, "duplicate-branch-wt");
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "duplicate-branch",
      worktreePath: secondPath,
      repoPath,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("BRANCH_EXISTS");
    expect(result.errorMessage).toBeDefined();
    expect(fs.existsSync(secondPath)).toBe(false);
  });

  it("refuses a baseRef starting with '-' with errorCode=INVALID_INPUT and creates nothing", async () => {
    const wtPath = path.join(worktreesDir, "injection-baseref-wt");
    const result = await createWorktree({
      baseRef: "--no-checkout",
      branch: "safe-branch-name",
      worktreePath: wtPath,
      repoPath,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("INVALID_INPUT");
    expect(result.errorMessage).toMatch(/baseRef/);
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it("refuses a branch name starting with '-' with errorCode=INVALID_INPUT and creates nothing", async () => {
    const wtPath = path.join(worktreesDir, "injection-branch-wt");
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "--lock",
      worktreePath: wtPath,
      repoPath,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("INVALID_INPUT");
    expect(result.errorMessage).toMatch(/branch/);
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it("refuses a worktreePath starting with '-' with errorCode=INVALID_INPUT and creates nothing", async () => {
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "safe-branch",
      worktreePath: "--detach",
      repoPath,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("INVALID_INPUT");
    expect(result.errorMessage).toMatch(/worktreePath/);
  });

  it("reports fetchStatus=failed when a remote is configured but unreachable, still status=ok", async () => {
    // Point origin at a path that does not exist — fetch must fail.
    git(["remote", "add", "origin", "file:///nonexistent-remote-xyz"], repoPath);

    const wtPath = path.join(worktreesDir, "unreachable-remote-wt");
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "remote-fail-branch",
      worktreePath: wtPath,
      repoPath,
    });

    // Fetch failure must NOT hard-fail the create.
    expect(result.status).toBe("ok");
    expect(result.fetchStatus).toBe("failed");
    expect(result.fetchError).toBeDefined();
    expect(result.fetchError!.length).toBeGreaterThan(0);
    expect(fs.existsSync(wtPath)).toBe(true);
  });

  it("does not leave an orphan branch when 'worktree add' fails on an occupied path", async () => {
    // Occupy the target path with a non-empty directory so `worktree add` fails.
    const occupiedPath = path.join(worktreesDir, "occupied-wt");
    fs.mkdirSync(occupiedPath);
    fs.writeFileSync(path.join(occupiedPath, "blocker.txt"), "in the way\n");

    const failed = await createWorktree({
      baseRef: "HEAD",
      branch: "orphan-candidate-branch",
      worktreePath: occupiedPath,
      repoPath,
    });
    expect(failed.status).toBe("error");

    // The branch ref must NOT linger. A retry with the SAME branch on a
    // clean path must succeed (it would fail with BRANCH_EXISTS otherwise).
    const goodPath = path.join(worktreesDir, "retry-wt");
    const retry = await createWorktree({
      baseRef: "HEAD",
      branch: "orphan-candidate-branch",
      worktreePath: goodPath,
      repoPath,
    });

    expect(retry.status).toBe("ok");
    expect(retry.branch).toBe("orphan-candidate-branch");
    expect(fs.existsSync(goodPath)).toBe(true);
  });

  it("fetches over an ssh:// remote and reports fetchStatus='ok' (F-005 regression)", async () => {
    // F-005: the git wrapper must not blank `core.sshCommand` in a way that
    // breaks SSH transport. A bare repo reached over an `ssh://` URL stands in
    // for a real SSH remote; a stub `ssh` keeps the test offline.
    //
    // The temp dirs are created before the try so the finally can always clean
    // them; everything that can fail runs inside the try.
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-remote-"));
    const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-ssh-"));

    // GIT_SSH_COMMAND would override `-c core.sshCommand` and mask the bug —
    // strip it for the test, restore it after. PATH is restored the same way:
    // assigning `undefined` back would coerce to the string "undefined".
    const savedPath = process.env.PATH;
    const savedSshCommand = process.env.GIT_SSH_COMMAND;

    try {
      const remoteBare = path.join(remoteDir, "remote.git");
      git(["clone", "--bare", repoPath, remoteBare], remoteDir);
      git(["remote", "add", "origin", `ssh://fake${remoteBare}`], repoPath);

      // Stub `ssh`: ignore the options and host, run the remote command
      // locally. Git passes the remote command (`git-upload-pack '<path>'`) as
      // the last argument, so the stub runs the last arg via `sh -c`.
      // Prepended to PATH so the wrapper's `core.sshCommand=ssh` resolves here.
      const stubSsh = path.join(stubDir, "ssh");
      fs.writeFileSync(
        stubSsh,
        '#!/bin/sh\nfor arg in "$@"; do cmd="$arg"; done\nexec sh -c "$cmd"\n'
      );
      fs.chmodSync(stubSsh, 0o755);

      delete process.env.GIT_SSH_COMMAND;
      process.env.PATH = `${stubDir}${path.delimiter}${savedPath ?? ""}`;

      const wtPath = path.join(worktreesDir, "ssh-fetch-wt");
      const result = await createWorktree({
        baseRef: "HEAD",
        branch: "ssh-fetch-branch",
        worktreePath: wtPath,
        repoPath,
      });

      expect(result.status).toBe("ok");
      expect(result.fetchStatus).toBe("ok");
      expect(result.fetchError).toBeUndefined();
    } finally {
      if (savedPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = savedPath;
      }
      if (savedSshCommand === undefined) {
        delete process.env.GIT_SSH_COMMAND;
      } else {
        process.env.GIT_SSH_COMMAND = savedSshCommand;
      }
      rmrf(remoteDir);
      rmrf(stubDir);
    }
  });

  it("does not execute a malicious GIT_SSH_COMMAND inherited from the environment", async () => {
    // Security: GIT_SSH_COMMAND overrides `-c core.sshCommand` in git's
    // precedence, so an inherited value can bypass the hardening. gitEnv() must
    // neutralize it by setting GIT_SSH_COMMAND="ssh" after ...process.env.
    //
    // Setup mirrors the F-005 test: ssh:// remote + stub `ssh` on PATH.
    // Additionally, a sentinel-writing command is injected via GIT_SSH_COMMAND.
    // After createWorktree, the sentinel must NOT exist.
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-remote-"));
    const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-ssh-"));
    const sentinelDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-sentinel-"));
    const sentinelPath = path.join(sentinelDir, "SSH_COMMAND_EXECUTED");

    const savedPath = process.env.PATH;
    const savedSshCommand = process.env.GIT_SSH_COMMAND;

    try {
      const remoteBare = path.join(remoteDir, "remote.git");
      git(["clone", "--bare", repoPath, remoteBare], remoteDir);
      git(["remote", "add", "origin", `ssh://fake${remoteBare}`], repoPath);

      // Stub `ssh` on PATH so the neutralized GIT_SSH_COMMAND="ssh" resolves
      // to something that actually runs the git-upload-pack command (keeping
      // the fetch functional).
      const stubSsh = path.join(stubDir, "ssh");
      fs.writeFileSync(
        stubSsh,
        '#!/bin/sh\nfor arg in "$@"; do cmd="$arg"; done\nexec sh -c "$cmd"\n'
      );
      fs.chmodSync(stubSsh, 0o755);

      // Inject the malicious GIT_SSH_COMMAND that would write the sentinel.
      process.env.GIT_SSH_COMMAND = `sh -c 'touch ${sentinelPath}; for arg in "$@"; do cmd="$arg"; done; sh -c "$cmd"' --`;
      process.env.PATH = `${stubDir}${path.delimiter}${savedPath ?? ""}`;

      const wtPath = path.join(worktreesDir, "malicious-ssh-cmd-wt");
      await createWorktree({
        baseRef: "HEAD",
        branch: "malicious-ssh-cmd-branch",
        worktreePath: wtPath,
        repoPath,
      });

      // The sentinel must NOT have been written — the injected GIT_SSH_COMMAND
      // must have been neutralized by gitEnv() before git was invoked.
      expect(fs.existsSync(sentinelPath)).toBe(false);
    } finally {
      if (savedPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = savedPath;
      }
      if (savedSshCommand === undefined) {
        delete process.env.GIT_SSH_COMMAND;
      } else {
        process.env.GIT_SSH_COMMAND = savedSshCommand;
      }
      rmrf(remoteDir);
      rmrf(stubDir);
      rmrf(sentinelDir);
    }
  });

  it("core.sshCommand in repo .git/config is overridden by -c and does not execute", async () => {
    // Security invariant pinned by #184: a malicious `core.sshCommand` in an
    // untrusted repo's `.git/config` must NOT run because gitExecFile prepends
    // `-c core.sshCommand=ssh` which takes precedence over repo config.
    //
    // This test locks that invariant in place so future refactors cannot
    // accidentally remove the `-c core.sshCommand=ssh` override.
    const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-remote-"));
    const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-ssh-"));
    const sentinelDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-sentinel-"));
    const sentinelPath = path.join(sentinelDir, "CORE_SSH_COMMAND_EXECUTED");

    const savedPath = process.env.PATH;
    const savedSshCommand = process.env.GIT_SSH_COMMAND;

    try {
      const remoteBare = path.join(remoteDir, "remote.git");
      git(["clone", "--bare", repoPath, remoteBare], remoteDir);
      git(["remote", "add", "origin", `ssh://fake${remoteBare}`], repoPath);

      // Stub `ssh` on PATH so the legitimate `-c core.sshCommand=ssh` resolves
      // to something functional.
      const stubSsh = path.join(stubDir, "ssh");
      fs.writeFileSync(
        stubSsh,
        '#!/bin/sh\nfor arg in "$@"; do cmd="$arg"; done\nexec sh -c "$cmd"\n'
      );
      fs.chmodSync(stubSsh, 0o755);

      // Write a malicious core.sshCommand into the repo's .git/config.
      git(
        ["config", "core.sshCommand", `sh -c 'touch ${sentinelPath}; for arg in "$@"; do cmd="$arg"; done; sh -c "$cmd"' --`],
        repoPath
      );

      // Ensure GIT_SSH_COMMAND is not set so env-var path is not the actor.
      delete process.env.GIT_SSH_COMMAND;
      process.env.PATH = `${stubDir}${path.delimiter}${savedPath ?? ""}`;

      const wtPath = path.join(worktreesDir, "malicious-core-ssh-wt");
      const result = await createWorktree({
        baseRef: "HEAD",
        branch: "malicious-core-ssh-branch",
        worktreePath: wtPath,
        repoPath,
      });

      // Fetch should succeed via the stub ssh (not the malicious command).
      expect(result.status).toBe("ok");
      expect(result.fetchStatus).toBe("ok");
      // The sentinel must NOT have been written — the `-c core.sshCommand=ssh`
      // override must have taken precedence over repo config.
      expect(fs.existsSync(sentinelPath)).toBe(false);
    } finally {
      if (savedPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = savedPath;
      }
      if (savedSshCommand === undefined) {
        delete process.env.GIT_SSH_COMMAND;
      } else {
        process.env.GIT_SSH_COMMAND = savedSshCommand;
      }
      rmrf(remoteDir);
      rmrf(stubDir);
      rmrf(sentinelDir);
    }
  });

  it("runs the configured install command and reports installStatus='installed'", async () => {
    commitCommandsJson(repoPath, {
      install: [
        "node",
        "-e",
        "require('fs').writeFileSync('INSTALLED.marker', 'ok')",
      ],
    });

    const wtPath = path.join(worktreesDir, "install-wt");
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "install-branch",
      worktreePath: wtPath,
      repoPath,
    });

    expect(result.status).toBe("ok");
    expect(result.installStatus).toBe("installed");
    // The install command runs with the worktree as cwd — its side-effect
    // must land inside the worktree.
    expect(fs.existsSync(path.join(wtPath, "INSTALLED.marker"))).toBe(true);
  });

  it("reports installStatus='not-configured' when no install command is set", async () => {
    // createTempRepo writes no commands.json — install is simply absent.
    const wtPath = path.join(worktreesDir, "no-install-wt");
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "no-install-branch",
      worktreePath: wtPath,
      repoPath,
    });

    expect(result.status).toBe("ok");
    expect(result.installStatus).toBe("not-configured");
    expect(fs.existsSync(wtPath)).toBe(true);
  });

  it("returns errorCode=INSTALL_FAILED when the install command exits non-zero", async () => {
    commitCommandsJson(repoPath, {
      install: ["node", "-e", "process.exit(1)"],
    });

    const wtPath = path.join(worktreesDir, "install-fail-wt");
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "install-fail-branch",
      worktreePath: wtPath,
      repoPath,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("INSTALL_FAILED");
    expect(result.errorMessage).toBeDefined();
    // The worktree was created before the install failed — it is left on
    // disk for inspection, consistent with the skill's failed-slice handling.
    expect(fs.existsSync(wtPath)).toBe(true);
  });

  it("returns errorCode=INSTALL_FAILED when the install command cannot be spawned", async () => {
    // A nonexistent binary makes runInstall return status='error' (EXEC_ERROR),
    // exercising the create_worktree failure branch distinct from a non-zero exit.
    commitCommandsJson(repoPath, {
      install: ["orchestrate-nonexistent-binary-xyz", "--ci"],
    });

    const wtPath = path.join(worktreesDir, "install-exec-error-wt");
    const result = await createWorktree({
      baseRef: "HEAD",
      branch: "install-exec-error-branch",
      worktreePath: wtPath,
      repoPath,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("INSTALL_FAILED");
    expect(result.errorMessage).toBeDefined();
    // The failure detail must carry a real reason, never the literal "undefined".
    expect(result.errorMessage).not.toContain("undefined");
    expect(fs.existsSync(wtPath)).toBe(true);
  });
});

// ─── remove_worktree ──────────────────────────────────────────────────────────

describe("remove_worktree", () => {
  it("removes a clean worktree and returns status='ok'", async () => {
    const wtPath = path.join(worktreesDir, "clean-wt");
    const created = await createWorktree({
      baseRef: "HEAD",
      branch: "clean-branch",
      worktreePath: wtPath,
      repoPath,
    });
    expect(created.status).toBe("ok");

    const result = await removeWorktree({ worktreePath: wtPath, repoPath });

    expect(result.status).toBe("ok");
    expect(result.removedPath).toBe(wtPath);
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it("refuses a worktree with untracked changes, lists the dirty file, and leaves it intact", async () => {
    const wtPath = path.join(worktreesDir, "dirty-wt");
    const created = await createWorktree({
      baseRef: "HEAD",
      branch: "dirty-branch",
      worktreePath: wtPath,
      repoPath,
    });
    expect(created.status).toBe("ok");

    fs.writeFileSync(path.join(wtPath, "dirty.txt"), "uncommitted content\n");

    const result = await removeWorktree({ worktreePath: wtPath, repoPath });

    expect(result.status).toBe("refused");
    expect(result.refusalReason).toBeDefined();
    expect(result.dirtyFiles).toBeDefined();
    // CONTENT assertion — the specific dirty filename must be present.
    expect(result.dirtyFiles).toContain("dirty.txt");

    expect(fs.existsSync(wtPath)).toBe(true);
    expect(fs.existsSync(path.join(wtPath, "dirty.txt"))).toBe(true);
  });

  it("refuses a worktree with staged (modified) changes and leaves it intact", async () => {
    const wtPath = path.join(worktreesDir, "staged-wt");
    const created = await createWorktree({
      baseRef: "HEAD",
      branch: "staged-branch",
      worktreePath: wtPath,
      repoPath,
    });
    expect(created.status).toBe("ok");

    fs.appendFileSync(path.join(wtPath, "README.md"), "\nModified line\n");
    git(["add", "README.md"], wtPath);

    const result = await removeWorktree({ worktreePath: wtPath, repoPath });

    expect(result.status).toBe("refused");
    expect(result.dirtyFiles).toContain("README.md");
    expect(fs.existsSync(wtPath)).toBe(true);
  });

  it("lists a staged rename as real paths, never as 'old -> new'", async () => {
    const wtPath = path.join(worktreesDir, "rename-wt");
    const created = await createWorktree({
      baseRef: "HEAD",
      branch: "rename-branch",
      worktreePath: wtPath,
      repoPath,
    });
    expect(created.status).toBe("ok");

    // Stage a rename: README.md -> RENAMED.md
    git(["mv", "README.md", "RENAMED.md"], wtPath);

    const result = await removeWorktree({ worktreePath: wtPath, repoPath });

    expect(result.status).toBe("refused");
    expect(result.dirtyFiles).toBeDefined();
    // No entry may contain the composite ' -> ' rendering.
    for (const entry of result.dirtyFiles!) {
      expect(entry).not.toContain(" -> ");
    }
    // Both real paths of the rename must be present.
    expect(result.dirtyFiles).toContain("RENAMED.md");
    expect(result.dirtyFiles).toContain("README.md");

    expect(fs.existsSync(wtPath)).toBe(true);
  });

  it("returns errorCode=PATH_NOT_FOUND when the worktree path does not exist", async () => {
    const result = await removeWorktree({
      worktreePath: path.join(worktreesDir, "does-not-exist"),
      repoPath,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("PATH_NOT_FOUND");
    expect(result.errorMessage).toMatch(/does not exist/i);
  });

  it("refuses a worktreePath starting with '-' with errorCode=INVALID_INPUT", async () => {
    const result = await removeWorktree({
      worktreePath: "--force",
      repoPath,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("INVALID_INPUT");
    expect(result.errorMessage).toMatch(/worktreePath/);
  });

  it("returns errorCode=NOT_A_WORKTREE for a plain non-git directory", async () => {
    const plainDir = path.join(worktreesDir, "plain-dir");
    fs.mkdirSync(plainDir);
    fs.writeFileSync(path.join(plainDir, "file.txt"), "not a worktree\n");

    const result = await removeWorktree({ worktreePath: plainDir, repoPath });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("NOT_A_WORKTREE");
    // The directory must be left untouched.
    expect(fs.existsSync(plainDir)).toBe(true);
  });

  it("removes a clean worktree addressed via a non-canonical path (with '..' segments)", async () => {
    const wtPath = path.join(worktreesDir, "canonical-wt");
    const created = await createWorktree({
      baseRef: "HEAD",
      branch: "canonical-branch",
      worktreePath: wtPath,
      repoPath,
    });
    expect(created.status).toBe("ok");

    // Address the same worktree via a path that resolves to it but is not
    // textually identical — exercises the symlink-safe canonicalization in
    // the NOT_A_WORKTREE check.
    const nonCanonical = path.join(
      worktreesDir,
      "canonical-wt",
      "..",
      "canonical-wt"
    );
    const result = await removeWorktree({
      worktreePath: nonCanonical,
      repoPath,
    });

    expect(result.status).toBe("ok");
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it("force-removes a dirty worktree when force=true", async () => {
    const wtPath = path.join(worktreesDir, "force-dirty-wt");
    const created = await createWorktree({
      baseRef: "HEAD",
      branch: "force-dirty-branch",
      worktreePath: wtPath,
      repoPath,
    });
    expect(created.status).toBe("ok");

    // Make the worktree dirty — a default removal would refuse this.
    fs.writeFileSync(path.join(wtPath, "uncommitted.txt"), "in progress\n");

    const result = await removeWorktree({
      worktreePath: wtPath,
      repoPath,
      force: true,
    });

    expect(result.status).toBe("ok");
    expect(result.removedPath).toBe(wtPath);
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it("force=true still refuses a directory that is not a registered worktree", async () => {
    const plainDir = path.join(worktreesDir, "force-plain-dir");
    fs.mkdirSync(plainDir);
    fs.writeFileSync(path.join(plainDir, "file.txt"), "not a worktree\n");

    const result = await removeWorktree({
      worktreePath: plainDir,
      repoPath,
      force: true,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("NOT_A_WORKTREE");
    // The force flag must not bypass the registered-root guard.
    expect(fs.existsSync(plainDir)).toBe(true);
  });

  it("returns errorCode=NOT_A_WORKTREE for a subdirectory of a real worktree", async () => {
    const wtPath = path.join(worktreesDir, "parent-wt");
    const created = await createWorktree({
      baseRef: "HEAD",
      branch: "parent-branch",
      worktreePath: wtPath,
      repoPath,
    });
    expect(created.status).toBe("ok");

    // Create a subdirectory inside the worktree.
    const subDir = path.join(wtPath, "subdir");
    fs.mkdirSync(subDir);

    const result = await removeWorktree({ worktreePath: subDir, repoPath });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("NOT_A_WORKTREE");
    // The real worktree (and its subdir) must remain intact.
    expect(fs.existsSync(wtPath)).toBe(true);
    expect(fs.existsSync(subDir)).toBe(true);
  });
});
