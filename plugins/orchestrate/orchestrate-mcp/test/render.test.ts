import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  renderDashboard,
  renderGraph,
  renderReport,
  renderDashboardArtifact,
  renderGraphArtifact,
  renderReportArtifact,
  type RunState,
} from "../src/tools/render.js";

// ─── Test fixture ─────────────────────────────────────────────────────────────

const VALID_STATE: RunState = {
  runId: "20260521-010101",
  status: "in-progress",
  umbrellaBranch: "orchestrate/umbrella-20260521-010101",
  integrationBase: "development",
  parentIssue: 100,
  startedAt: "2026-05-21T01:01:01Z",
  updatedAt: "2026-05-21T02:30:00Z",
  waves: [["101", "102"], ["103"]],
  completedWaves: 1,
  finalPullRequest: null,
  slices: {
    "101": {
      issue: 101,
      title: "S1: walking skeleton",
      wave: 0,
      tier: "standard",
      blockedBy: [],
      state: "passed",
      sliceBranch: "orchestrate/slice-101",
      worktreePath: "/tmp/.orchestrate-worktrees/slice-101",
      pullRequest: "https://github.com/owner/repo/pull/201",
      failureReason: null,
      updatedAt: "2026-05-21T01:30:00Z",
    },
    "102": {
      issue: 102,
      title: "S2: render tools",
      wave: 0,
      tier: "complex",
      blockedBy: [],
      state: "failed",
      sliceBranch: "orchestrate/slice-102",
      worktreePath: "/tmp/.orchestrate-worktrees/slice-102",
      pullRequest: null,
      failureReason: "Typecheck errors in render.ts",
      updatedAt: "2026-05-21T01:45:00Z",
    },
    "103": {
      issue: 103,
      title: "S3: integration",
      wave: 1,
      tier: "trivial",
      blockedBy: ["101", "102"],
      state: "skipped",
      sliceBranch: "orchestrate/slice-103",
      worktreePath: null,
      pullRequest: null,
      failureReason: "Blocker 102 did not pass",
      updatedAt: "2026-05-21T02:00:00Z",
    },
  },
};

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** The runId every test fixture uses unless it needs a second, distinct run. */
const RUN_ID = "20260521-010101";

/**
 * Writes a project dir with a per-run directory at
 * `.orchestrate/runs/<runId>/`. Pass null for config to skip creating
 * run-state.json (the run directory is still created).
 */
function makeProject(
  config: unknown | string | null,
  runId: string = RUN_ID
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-render-"));
  const runDir = path.join(dir, ".orchestrate", "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  if (config !== null) {
    const content =
      typeof config === "string" ? config : JSON.stringify(config, null, 2);
    fs.writeFileSync(path.join(runDir, "run-state.json"), content);
  }
  return dir;
}

const created: string[] = [];

function project(
  config: unknown | string | null,
  runId: string = RUN_ID
): string {
  const dir = makeProject(config, runId);
  created.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  created.length = 0;
});

// ─── Pure renderer tests ──────────────────────────────────────────────────────

describe("renderDashboard (pure)", () => {
  it("includes the run id in the output", () => {
    const html = renderDashboard(VALID_STATE);
    expect(html).toContain("20260521-010101");
  });

  it("contains slice titles and state words", () => {
    const html = renderDashboard(VALID_STATE);
    expect(html).toContain("S1: walking skeleton");
    expect(html).toContain("S2: render tools");
    expect(html).toContain("S3: integration");
    expect(html).toContain("passed");
    expect(html).toContain("failed");
    expect(html).toContain("skipped");
  });

  it("contains a prefers-color-scheme: dark media query", () => {
    const html = renderDashboard(VALID_STATE);
    expect(html).toMatch(/prefers-color-scheme:\s*dark/);
  });

  it("is a complete HTML document", () => {
    const html = renderDashboard(VALID_STATE);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("</html>");
  });
});

describe("renderGraph (pure)", () => {
  it("includes the run id in the output", () => {
    const html = renderGraph(VALID_STATE);
    expect(html).toContain("20260521-010101");
  });

  it("contains issue numbers and slice titles", () => {
    const html = renderGraph(VALID_STATE);
    expect(html).toContain("#101");
    expect(html).toContain("#102");
    expect(html).toContain("#103");
    // Titles may be truncated to 22 chars but first chars should be there
    expect(html).toContain("S1:");
    expect(html).toContain("S2:");
  });

  it("contains a prefers-color-scheme: dark media query", () => {
    const html = renderGraph(VALID_STATE);
    expect(html).toMatch(/prefers-color-scheme:\s*dark/);
  });

  it("contains SVG path elements for edges between connected slices", () => {
    const html = renderGraph(VALID_STATE);
    // Slice 103 is blocked by 101 and 102; both are in pos → two edges
    expect(html).toMatch(/<path.*class="edge"/);
  });

  it("is a complete HTML document", () => {
    const html = renderGraph(VALID_STATE);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("</html>");
  });
});

describe("renderReport (pure)", () => {
  it("includes the run id in the output", () => {
    const html = renderReport(VALID_STATE);
    expect(html).toContain("20260521-010101");
  });

  it("contains slice titles, states, and failure reasons", () => {
    const html = renderReport(VALID_STATE);
    expect(html).toContain("S1: walking skeleton");
    expect(html).toContain("S2: render tools");
    expect(html).toContain("Typecheck errors in render.ts");
    expect(html).toContain("passed");
    expect(html).toContain("failed");
    expect(html).toContain("skipped");
  });

  it("contains start and update timestamps", () => {
    const html = renderReport(VALID_STATE);
    expect(html).toContain("2026-05-21T01:01:01Z");
    expect(html).toContain("2026-05-21T02:30:00Z");
  });

  it("contains a prefers-color-scheme: dark media query", () => {
    const html = renderReport(VALID_STATE);
    expect(html).toMatch(/prefers-color-scheme:\s*dark/);
  });

  it("is a complete HTML document", () => {
    const html = renderReport(VALID_STATE);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("</html>");
  });
});

// ─── Artifact tool tests — ok path ───────────────────────────────────────────

describe("renderDashboardArtifact", () => {
  it("writes the file and returns status ok with the artifact path", async () => {
    const dir = project(VALID_STATE);
    const result = await renderDashboardArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("ok");
    expect(result.artifactPath).toBeDefined();
    expect(fs.existsSync(result.artifactPath!)).toBe(true);
    const content = fs.readFileSync(result.artifactPath!, "utf8");
    expect(content).toContain("20260521-010101");
  });

  it("writes the artifact under .orchestrate/runs/<runId>/", async () => {
    const dir = project(VALID_STATE);
    const result = await renderDashboardArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("ok");
    expect(result.artifactPath).toBe(
      path.join(dir, ".orchestrate", "runs", RUN_ID, "dashboard.html")
    );
  });

  it("respects an explicit outputPath override", async () => {
    const dir = project(VALID_STATE);
    const outputPath = path.join(dir, "custom-dashboard.html");
    const result = await renderDashboardArtifact({
      repoPath: dir,
      runId: RUN_ID,
      outputPath,
    });

    expect(result.status).toBe("ok");
    expect(result.artifactPath).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});

describe("renderGraphArtifact", () => {
  it("writes the file and returns status ok with the artifact path", async () => {
    const dir = project(VALID_STATE);
    const result = await renderGraphArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("ok");
    expect(result.artifactPath).toBeDefined();
    expect(fs.existsSync(result.artifactPath!)).toBe(true);
    const content = fs.readFileSync(result.artifactPath!, "utf8");
    expect(content).toContain("20260521-010101");
  });
});

describe("renderReportArtifact", () => {
  it("writes the file and returns status ok with the artifact path", async () => {
    const dir = project(VALID_STATE);
    const result = await renderReportArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("ok");
    expect(result.artifactPath).toBeDefined();
    expect(fs.existsSync(result.artifactPath!)).toBe(true);
    const content = fs.readFileSync(result.artifactPath!, "utf8");
    expect(content).toContain("20260521-010101");
  });
});

// ─── Per-run path isolation ──────────────────────────────────────────────────

describe("artifact tools — per-run path isolation", () => {
  it("two render calls with distinct run ids write to distinct paths", async () => {
    const runA = "20260521-010101";
    const runB = "20260521-020202";
    // One repo dir holding two distinct run directories.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-render-"));
    created.push(dir);
    for (const runId of [runA, runB]) {
      const runDir = path.join(dir, ".orchestrate", "runs", runId);
      fs.mkdirSync(runDir, { recursive: true });
      const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
      state.runId = runId;
      fs.writeFileSync(
        path.join(runDir, "run-state.json"),
        JSON.stringify(state, null, 2)
      );
    }

    const resultA = await renderDashboardArtifact({ repoPath: dir, runId: runA });
    const resultB = await renderDashboardArtifact({ repoPath: dir, runId: runB });

    expect(resultA.status).toBe("ok");
    expect(resultB.status).toBe("ok");
    expect(resultA.artifactPath).not.toBe(resultB.artifactPath);
    expect(resultA.artifactPath).toContain(runA);
    expect(resultB.artifactPath).toContain(runB);
    // Each artifact embeds its own run's id — no cross-contamination.
    expect(fs.readFileSync(resultA.artifactPath!, "utf8")).toContain(runA);
    expect(fs.readFileSync(resultB.artifactPath!, "utf8")).toContain(runB);
  });
});

// ─── Invalid runId ───────────────────────────────────────────────────────────

describe("artifact tools — invalid runId", () => {
  it("renderDashboardArtifact → RUN_ID_INVALID for a path-traversal runId", async () => {
    const dir = project(VALID_STATE);
    const result = await renderDashboardArtifact({
      repoPath: dir,
      runId: "../../etc",
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_ID_INVALID");
    expect(result.artifactPath).toBeUndefined();
  });

  it("renderGraphArtifact → RUN_ID_INVALID for an empty runId", async () => {
    const dir = project(VALID_STATE);
    const result = await renderGraphArtifact({ repoPath: dir, runId: "" });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_ID_INVALID");
  });

  it("renderReportArtifact → RUN_ID_INVALID for a runId with a separator", async () => {
    const dir = project(VALID_STATE);
    const result = await renderReportArtifact({ repoPath: dir, runId: "a/b" });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_ID_INVALID");
  });
});

// ─── Error path tests ─────────────────────────────────────────────────────────

describe("artifact tools — missing run-state.json", () => {
  it("renderDashboardArtifact → RUN_STATE_NOT_FOUND", async () => {
    const dir = project(null);
    const result = await renderDashboardArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_STATE_NOT_FOUND");
    expect(result.artifactPath).toBeUndefined();
  });

  it("renderGraphArtifact → RUN_STATE_NOT_FOUND", async () => {
    const dir = project(null);
    const result = await renderGraphArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_STATE_NOT_FOUND");
  });

  it("renderReportArtifact → RUN_STATE_NOT_FOUND", async () => {
    const dir = project(null);
    const result = await renderReportArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_STATE_NOT_FOUND");
  });
});

describe("artifact tools — malformed JSON", () => {
  it("renderDashboardArtifact → RUN_STATE_INVALID", async () => {
    const dir = project("{ not valid json");
    const result = await renderDashboardArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_STATE_INVALID");
  });

  it("renderGraphArtifact → RUN_STATE_INVALID", async () => {
    const dir = project("{ not valid json");
    const result = await renderGraphArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_STATE_INVALID");
  });

  it("renderReportArtifact → RUN_STATE_INVALID", async () => {
    const dir = project("{ not valid json");
    const result = await renderReportArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_STATE_INVALID");
  });
});

describe("artifact tools — schema mismatch", () => {
  it("renderDashboardArtifact → RUN_STATE_INVALID when required fields are missing", async () => {
    const invalid = { runId: "x", status: "in-progress" }; // missing most required fields
    const dir = project(invalid);
    const result = await renderDashboardArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_STATE_INVALID");
  });

  it("renderReportArtifact → RUN_STATE_INVALID when required fields are missing", async () => {
    const invalid = { runId: "x" };
    const dir = project(invalid);
    const result = await renderReportArtifact({ repoPath: dir, runId: RUN_ID });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RUN_STATE_INVALID");
  });
});

// ─── HTML escaping ────────────────────────────────────────────────────────────

describe("HTML escaping of run-state values", () => {
  /** Builds a run-state whose first slice title carries hostile characters. */
  function hostileState(): RunState {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.slices["101"].title = `<script>alert(1)</script> & "quote" 'apos'`;
    return state;
  }

  it("renderDashboard escapes a <script> tag, ampersand, and quotes", () => {
    const html = renderDashboard(hostileState());
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&amp;");
  });

  it("renderGraph escapes a <script> tag from a slice title", () => {
    const html = renderGraph(hostileState());
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renderReport escapes a <script> tag from a slice title", () => {
    const html = renderReport(hostileState());
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

// ─── WRITE_FAILED ─────────────────────────────────────────────────────────────

describe("artifact tools — write failure", () => {
  it("renderDashboardArtifact → WRITE_FAILED when outputPath is a directory", async () => {
    const dir = project(VALID_STATE);
    // A directory cannot be written as a file; mkdirSync of its parent is a
    // no-op and writeFileSync onto the directory path fails (EISDIR).
    const result = await renderDashboardArtifact({
      repoPath: dir,
      runId: RUN_ID,
      outputPath: dir,
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("WRITE_FAILED");
    expect(result.artifactPath).toBeUndefined();
  });

  it("renderReportArtifact → WRITE_FAILED when outputPath has an unwritable parent", async () => {
    const dir = project(VALID_STATE);
    // A file occupies the would-be parent directory, so mkdirSync of the
    // nested parent and the subsequent writeFileSync both fail (ENOTDIR).
    const blocker = path.join(dir, "blocker");
    fs.writeFileSync(blocker, "i am a file, not a directory");
    const result = await renderReportArtifact({
      repoPath: dir,
      runId: RUN_ID,
      outputPath: path.join(blocker, "nested", "report.html"),
    });

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("WRITE_FAILED");
  });
});

// ─── Completed run status badge ──────────────────────────────────────────────

describe("renderDashboard — completed run status badge", () => {
  it("emits a styled badge-completed class for a completed run", () => {
    const completed = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    completed.status = "completed";
    completed.finalPullRequest = "https://github.com/owner/repo/pull/300";
    const html = renderDashboard(completed);

    // The status badge uses the badge-completed class...
    expect(html).toContain("badge-completed");
    // ...and SHARED_CSS defines a rule for it, so it is not unstyled.
    expect(html).toMatch(/\.badge-completed\s*\{/);
  });
});

// ─── safeHref scheme allowlist ───────────────────────────────────────────────

describe("renderDashboard — safeHref scheme allowlist", () => {
  it("preserves an https:// slice PR URL in the href attribute", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.slices["101"].pullRequest = "https://github.com/owner/repo/pull/201";
    const html = renderDashboard(state);
    expect(html).toContain('href="https://github.com/owner/repo/pull/201"');
  });

  it("replaces a javascript: slice PR URL with href=\"#\"", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.slices["101"].pullRequest = "javascript:alert(1)";
    const html = renderDashboard(state);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('href="#"');
  });

  it("replaces a data: slice PR URL with href=\"#\"", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.slices["101"].pullRequest = "data:text/html,<h1>xss</h1>";
    const html = renderDashboard(state);
    expect(html).not.toMatch(/href="data:/i);
    expect(html).toContain('href="#"');
  });

  it("preserves an https:// finalPullRequest URL in the href attribute", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.finalPullRequest = "https://github.com/owner/repo/pull/300";
    const html = renderDashboard(state);
    expect(html).toContain('href="https://github.com/owner/repo/pull/300"');
  });

  it("replaces a javascript: finalPullRequest URL with href=\"#\"", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.finalPullRequest = "javascript:alert(1)";
    const html = renderDashboard(state);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('href="#"');
  });

  it("replaces a data: finalPullRequest URL with href=\"#\"", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.finalPullRequest = "data:text/html,<h1>xss</h1>";
    const html = renderDashboard(state);
    expect(html).not.toMatch(/href="data:/i);
    expect(html).toContain('href="#"');
  });

  it("preserves a mixed-case HTTPS:// URL — the scheme allowlist is case-insensitive", () => {
    // Witnesses the /i flag on safeHref: without it, an uppercase scheme on
    // an otherwise-valid URL would be wrongly rewritten to "#".
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.slices["101"].pullRequest = "HTTPS://github.com/owner/repo/pull/201";
    const html = renderDashboard(state);
    expect(html).toContain('href="HTTPS://github.com/owner/repo/pull/201"');
  });
});

describe("renderReport — safeHref scheme allowlist", () => {
  it("preserves an https:// slice PR URL in the href attribute", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.slices["101"].pullRequest = "https://github.com/owner/repo/pull/201";
    const html = renderReport(state);
    expect(html).toContain('href="https://github.com/owner/repo/pull/201"');
  });

  it("replaces a javascript: slice PR URL with href=\"#\"", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.slices["101"].pullRequest = "javascript:alert(1)";
    const html = renderReport(state);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('href="#"');
  });

  it("replaces a data: slice PR URL with href=\"#\"", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.slices["101"].pullRequest = "data:text/html,<h1>xss</h1>";
    const html = renderReport(state);
    expect(html).not.toMatch(/href="data:/i);
    expect(html).toContain('href="#"');
  });

  it("preserves an https:// finalPullRequest URL in the href attribute", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.finalPullRequest = "https://github.com/owner/repo/pull/300";
    const html = renderReport(state);
    expect(html).toContain('href="https://github.com/owner/repo/pull/300"');
  });

  it("replaces a javascript: finalPullRequest URL with href=\"#\"", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.finalPullRequest = "javascript:alert(1)";
    const html = renderReport(state);
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('href="#"');
  });

  it("replaces a data: finalPullRequest URL with href=\"#\"", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    state.finalPullRequest = "data:text/html,<h1>xss</h1>";
    const html = renderReport(state);
    expect(html).not.toMatch(/href="data:/i);
    expect(html).toContain('href="#"');
  });
});

// ─── blockedBy id outside the slices map ─────────────────────────────────────

describe("renderGraph — blockedBy id outside the slices map", () => {
  it("renders valid HTML without crashing when a blocker is not a known slice", () => {
    const state = JSON.parse(JSON.stringify(VALID_STATE)) as RunState;
    // Slice 103 now also depends on issue 999, which is not in `slices`.
    state.slices["103"].blockedBy = ["101", "102", "999"];
    const html = renderGraph(state);

    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("</html>");
    expect(html).toContain("#103");
    // The dangling blocker draws no edge but does not break rendering.
  });
});
