import * as path from "path";
import * as fs from "fs";
import { z } from "zod";

// ─── Schemas — z.object is the single source of truth; TS types via z.infer ───

const sliceStateEnum = z.enum(["pending", "in-progress", "passed", "failed", "skipped"]);
const tierEnum = z.enum(["trivial", "standard", "complex"]);

const sliceSchema = z.object({
  issue: z.number().int(),
  title: z.string(),
  wave: z.number().int(),
  tier: tierEnum,
  blockedBy: z.array(z.string()),
  state: sliceStateEnum,
  sliceBranch: z.string(),
  worktreePath: z.string().nullable(),
  pullRequest: z.string().nullable(),
  failureReason: z.string().nullable(),
  updatedAt: z.string(),
});

export const runStateSchema = z.object({
  runId: z.string(),
  status: z.enum(["in-progress", "completed"]),
  umbrellaBranch: z.string(),
  integrationBase: z.string(),
  parentIssue: z.number().int().nullable(),
  startedAt: z.string(),
  updatedAt: z.string(),
  waves: z.array(z.array(z.string())),
  completedWaves: z.number().int(),
  finalPullRequest: z.string().nullable(),
  slices: z.record(z.string(), sliceSchema),
});

export const renderInputSchema = z.object({
  repoPath: z
    .string()
    .optional()
    .describe(
      "Path to the project root that holds the .orchestrate/run-state.json file. " +
        "Defaults to the MCP server process's current working directory — callers " +
        "should pass this explicitly rather than rely on the default."
    ),
  outputPath: z
    .string()
    .optional()
    .describe(
      "Override the default output path for the HTML artifact. When omitted the " +
        "artifact is written under <repoPath>/.orchestrate/ with a fixed filename " +
        "per tool (dashboard.html, graph.html, report.html)."
    ),
});

export const renderOutputSchema = z.object({
  status: z
    .enum(["ok", "error"])
    .describe("Outcome discriminant. 'ok' = artifact written; 'error' = could not complete."),
  artifactPath: z
    .string()
    .optional()
    .describe("Absolute path to the written HTML artifact. Present when status='ok'."),
  errorCode: z
    .enum(["RUN_STATE_NOT_FOUND", "RUN_STATE_INVALID", "WRITE_FAILED"])
    .optional()
    .describe(
      "Machine-readable failure category. Present when status='error'. " +
        "'RUN_STATE_NOT_FOUND' = no .orchestrate/run-state.json; " +
        "'RUN_STATE_INVALID' = malformed JSON or schema mismatch; " +
        "'WRITE_FAILED' = could not write the HTML artifact."
    ),
  errorMessage: z
    .string()
    .optional()
    .describe("Human-readable failure description. Present when status='error'."),
});

// ─── TS types — derived from the schemas (single source of truth) ─────────────

export type RunState = z.infer<typeof runStateSchema>;
export type SliceState = z.infer<typeof sliceStateEnum>;
export type RenderInput = z.infer<typeof renderInputSchema>;
export type RenderOutput = z.infer<typeof renderOutputSchema>;

// ─── Default artifact paths ───────────────────────────────────────────────────

const ARTIFACT_DEFAULTS = {
  dashboard: ".orchestrate/dashboard.html",
  graph: ".orchestrate/graph.html",
  report: ".orchestrate/report.html",
} as const;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Returns the first non-empty trimmed line of a (possibly multi-line) string. */
function firstLine(message: string): string {
  const line = message
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? message.trim();
}

/** HTML-escapes a string so it is safe to embed between tags or in attributes. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Scheme allowlist guard for href attribute values.
 * Returns the URL unchanged when it starts with http:// or https:// (case-insensitive).
 * Returns "#" for any other scheme (e.g. javascript:, data:) to prevent XSS.
 */
function safeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "#";
}

/** Formats duration between two ISO-8601 timestamps as a human-readable string. */
function formatDuration(startedAt: string, updatedAt: string): string {
  const start = new Date(startedAt).getTime();
  const end = new Date(updatedAt).getTime();
  const ms = end - start;
  if (isNaN(ms) || ms < 0) return "unknown";
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

/**
 * Reads and validates `.orchestrate/run-state.json` from the given repoPath.
 * Returns either the validated state or a structured error response.
 */
function readAndValidateRunState(
  repoPath: string
): { ok: true; state: RunState } | { ok: false; response: RenderOutput } {
  const statePath = path.join(repoPath, ".orchestrate", "run-state.json");

  let raw: string;
  try {
    raw = fs.readFileSync(statePath, "utf8");
  } catch {
    return {
      ok: false,
      response: {
        status: "error",
        errorCode: "RUN_STATE_NOT_FOUND",
        errorMessage: `No .orchestrate/run-state.json found in ${repoPath}.`,
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      response: {
        status: "error",
        errorCode: "RUN_STATE_INVALID",
        errorMessage: `.orchestrate/run-state.json is not valid JSON: ${firstLine(
          err instanceof Error ? err.message : String(err)
        )}`,
      },
    };
  }

  const result = runStateSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      ok: false,
      response: {
        status: "error",
        errorCode: "RUN_STATE_INVALID",
        errorMessage: `.orchestrate/run-state.json does not match the expected shape: ${detail}`,
      },
    };
  }

  return { ok: true, state: result.data };
}

/**
 * Writes HTML to `outputPath`, ensuring the parent directory exists.
 * Returns a structured error response on write failure, or undefined on success.
 */
function writeArtifact(
  html: string,
  outputPath: string
): RenderOutput | undefined {
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, html, "utf8");
    return undefined;
  } catch (err) {
    return {
      status: "error",
      errorCode: "WRITE_FAILED",
      errorMessage: `Could not write artifact to ${outputPath}: ${firstLine(
        err instanceof Error ? err.message : String(err)
      )}`,
    };
  }
}

// ─── Shared CSS with light/dark palette ──────────────────────────────────────

const SHARED_CSS = `
  :root {
    --bg: #ffffff;
    --bg-card: #f8f9fa;
    --bg-table-alt: #f1f3f5;
    --text: #1a1a2e;
    --text-muted: #6c757d;
    --border: #dee2e6;
    --accent: #0056b3;
    --accent-hover: #004494;

    --state-passed-bg: #d4edda;
    --state-passed-text: #155724;
    --state-failed-bg: #f8d7da;
    --state-failed-text: #721c24;
    --state-in-progress-bg: #cce5ff;
    --state-in-progress-text: #004085;
    --state-skipped-bg: #fff3cd;
    --state-skipped-text: #856404;
    --state-pending-bg: #e2e3e5;
    --state-pending-text: #383d41;

    --node-bg: #e9ecef;
    --node-border: #adb5bd;
    --edge-color: #6c757d;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d1117;
      --bg-card: #161b22;
      --bg-table-alt: #1c2128;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --border: #30363d;
      --accent: #58a6ff;
      --accent-hover: #79c0ff;

      --state-passed-bg: #1a3a26;
      --state-passed-text: #56d364;
      --state-failed-bg: #3a1a1e;
      --state-failed-text: #ff7b72;
      --state-in-progress-bg: #1a2a3a;
      --state-in-progress-text: #58a6ff;
      --state-skipped-bg: #3a2e1a;
      --state-skipped-text: #d29922;
      --state-pending-bg: #2a2d30;
      --state-pending-text: #8b949e;

      --node-bg: #21262d;
      --node-border: #30363d;
      --edge-color: #8b949e;
    }
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    background: var(--bg);
    color: var(--text);
    padding: 24px;
    line-height: 1.5;
  }

  h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
  h2 { font-size: 16px; font-weight: 600; margin: 20px 0 10px; }

  .meta { color: var(--text-muted); font-size: 13px; margin-bottom: 20px; }
  .meta span { margin-right: 16px; }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
  .badge-passed    { background: var(--state-passed-bg);      color: var(--state-passed-text); }
  .badge-failed    { background: var(--state-failed-bg);      color: var(--state-failed-text); }
  .badge-in-progress { background: var(--state-in-progress-bg); color: var(--state-in-progress-text); }
  .badge-skipped   { background: var(--state-skipped-bg);     color: var(--state-skipped-text); }
  .badge-pending   { background: var(--state-pending-bg);     color: var(--state-pending-text); }
  /* Run status 'completed' reuses the green 'passed' palette — both light and */
  /* dark variants come from --state-passed-* which has a dark-mode override. */
  .badge-completed { background: var(--state-passed-bg);      color: var(--state-passed-text); }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  thead th {
    text-align: left;
    padding: 8px 12px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    border-bottom: 2px solid var(--border);
  }
  tbody td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  tbody tr:nth-child(even) { background: var(--bg-table-alt); }
  tbody tr:hover { background: var(--bg-card); }

  a { color: var(--accent); text-decoration: none; }
  a:hover { color: var(--accent-hover); text-decoration: underline; }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 16px;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  .stat-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 18px;
    text-align: center;
  }
  .stat-value { font-size: 28px; font-weight: 700; line-height: 1.2; }
  .stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
`;

/** Returns the badge CSS class for a slice state. */
function stateBadge(state: SliceState): string {
  return `<span class="badge badge-${esc(state)}">${esc(state)}</span>`;
}

// ─── Pure render functions ────────────────────────────────────────────────────

/**
 * Renders a live dashboard view of the orchestration run.
 * Shows run metadata, progress, and a slice table sorted in wave order.
 */
export function renderDashboard(state: RunState): string {
  const totalWaves = state.waves.length;
  const sliceList = state.waves.flatMap((wave, wIdx) =>
    wave.map((id) => ({ id, wave: wIdx, slice: state.slices[id] })).filter((e) => e.slice)
  );

  const counts = { passed: 0, failed: 0, skipped: 0, "in-progress": 0, pending: 0 };
  for (const s of Object.values(state.slices)) {
    counts[s.state] = (counts[s.state] ?? 0) + 1;
  }
  const total = Object.values(state.slices).length;

  const rows = sliceList
    .map(({ id, wave, slice }) => {
      const pr = slice.pullRequest
        ? `<a href="${esc(safeHref(slice.pullRequest))}" target="_blank">#PR</a>`
        : "—";
      return `
      <tr>
        <td>#${esc(String(slice.issue))}</td>
        <td>${esc(slice.title)}</td>
        <td>${esc(String(wave))}</td>
        <td><span class="badge">${esc(slice.tier)}</span></td>
        <td>${stateBadge(slice.state)}</td>
        <td>${pr}</td>
      </tr>`;
    })
    .join("");

  const progressPct =
    totalWaves > 0 ? Math.round((state.completedWaves / totalWaves) * 100) : 0;

  const finalPr = state.finalPullRequest
    ? `<a href="${esc(safeHref(state.finalPullRequest))}" target="_blank">${esc(state.finalPullRequest)}</a>`
    : "—";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Orchestrate Dashboard — ${esc(state.runId)}</title>
  <style>${SHARED_CSS}
    .progress-bar-track {
      background: var(--border);
      border-radius: 4px;
      height: 8px;
      margin: 8px 0 4px;
      overflow: hidden;
    }
    .progress-bar-fill {
      background: var(--accent);
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .progress-label { font-size: 13px; color: var(--text-muted); }
  </style>
</head>
<body>
  <h1>Orchestrate Dashboard</h1>
  <div class="meta">
    <span><strong>Run ID:</strong> ${esc(state.runId)}</span>
    <span><strong>Status:</strong> ${stateBadge(state.status as SliceState)}</span>
    <span><strong>Base:</strong> ${esc(state.integrationBase)}</span>
    ${state.parentIssue ? `<span><strong>Parent Issue:</strong> #${esc(String(state.parentIssue))}</span>` : ""}
    <span><strong>Final PR:</strong> ${finalPr}</span>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value" style="color: var(--state-passed-text)">${counts.passed}</div>
      <div class="stat-label">Passed</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--state-failed-text)">${counts.failed}</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--state-in-progress-text)">${counts["in-progress"]}</div>
      <div class="stat-label">In Progress</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--state-skipped-text)">${counts.skipped}</div>
      <div class="stat-label">Skipped</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--text-muted)">${counts.pending}</div>
      <div class="stat-label">Pending</div>
    </div>
  </div>

  <div class="card">
    <strong>Wave Progress</strong>
    <div class="progress-bar-track">
      <div class="progress-bar-fill" style="width: ${progressPct}%"></div>
    </div>
    <div class="progress-label">${esc(String(state.completedWaves))} / ${esc(String(totalWaves))} waves completed (${progressPct}%) — ${esc(String(total))} total slices</div>
  </div>

  <h2>Slices</h2>
  <table>
    <thead>
      <tr>
        <th>Issue</th>
        <th>Title</th>
        <th>Wave</th>
        <th>Tier</th>
        <th>State</th>
        <th>PR</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <p style="margin-top: 20px; font-size: 12px; color: var(--text-muted);">
    Generated ${new Date().toISOString()} · ${esc(state.umbrellaBranch)}
  </p>
</body>
</html>`;
}

/**
 * Renders a dependency graph view of the orchestration run.
 * Waves are laid out as columns; slices are nodes; blockedBy edges are SVG lines.
 */
export function renderGraph(state: RunState): string {
  const NODE_W = 180;
  const NODE_H = 56;
  const COL_GAP = 60;
  const ROW_GAP = 20;
  const PAD_X = 40;
  const PAD_Y = 40;

  // Build wave columns: list of issue ids per wave in deterministic order
  const waveColumns: string[][] = state.waves.map((w) => [...w]);
  const numWaves = waveColumns.length;

  // Position map: issueId → { cx, cy } (center of node)
  const pos: Record<string, { x: number; y: number; cx: number; cy: number }> = {};
  for (let wIdx = 0; wIdx < waveColumns.length; wIdx++) {
    const col = waveColumns[wIdx];
    for (let rIdx = 0; rIdx < col.length; rIdx++) {
      const id = col[rIdx];
      const x = PAD_X + wIdx * (NODE_W + COL_GAP);
      const y = PAD_Y + rIdx * (NODE_H + ROW_GAP);
      pos[id] = { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 };
    }
  }

  const maxRows = waveColumns.reduce((m, c) => Math.max(m, c.length), 0);
  const svgW = PAD_X * 2 + numWaves * NODE_W + (numWaves - 1) * COL_GAP;
  const svgH = PAD_Y * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;

  // Column headers
  const headers = waveColumns
    .map((_, wIdx) => {
      const hx = PAD_X + wIdx * (NODE_W + COL_GAP) + NODE_W / 2;
      return `<text x="${hx}" y="20" text-anchor="middle" class="wave-label">Wave ${wIdx}</text>`;
    })
    .join("\n    ");

  // Edges (blockedBy: target ← source, i.e. source depends on target)
  // Draw line from the blocker's right edge to the dependent's left edge
  const edges = Object.entries(state.slices)
    .flatMap(([id, slice]) =>
      slice.blockedBy
        .filter((bid) => bid in pos && id in pos)
        .map((bid) => {
          const from = pos[bid];
          const to = pos[id];
          // Exit right side of blocker, enter left side of dependent
          const x1 = from.x + NODE_W;
          const y1 = from.cy;
          const x2 = to.x;
          const y2 = to.cy;
          // Cubic bezier for smooth curve
          const cpOffset = Math.max(20, (x2 - x1) / 2);
          return `<path d="M${x1},${y1} C${x1 + cpOffset},${y1} ${x2 - cpOffset},${y2} ${x2},${y2}" class="edge"/>`;
        })
    )
    .join("\n    ");

  // Nodes
  const nodes = Object.entries(pos)
    .map(([id, { x, y }]) => {
      const slice = state.slices[id];
      if (!slice) return "";
      const stateClass = `node-${slice.state.replace("-", "")}`;
      // Truncate by code point, not UTF-16 unit, so an emoji/astral char at
      // the boundary cannot be cut into a lone (invalid) surrogate half.
      const codePoints = Array.from(slice.title);
      const label =
        codePoints.length > 22
          ? codePoints.slice(0, 20).join("") + "…"
          : slice.title;
      return `
    <g class="node ${stateClass}" transform="translate(${x}, ${y})">
      <rect width="${NODE_W}" height="${NODE_H}" rx="6"/>
      <text x="${NODE_W / 2}" y="18" text-anchor="middle" class="node-id">#${esc(String(slice.issue))}</text>
      <text x="${NODE_W / 2}" y="36" text-anchor="middle" class="node-title">${esc(label)}</text>
      <text x="${NODE_W - 8}" y="${NODE_H - 8}" text-anchor="end" class="node-state">${esc(slice.state)}</text>
    </g>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Orchestrate Graph — ${esc(state.runId)}</title>
  <style>${SHARED_CSS}
    .graph-container {
      overflow-x: auto;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    svg { display: block; min-width: 100%; }
    .wave-label { fill: var(--text-muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .edge { fill: none; stroke: var(--edge-color); stroke-width: 1.5; marker-end: url(#arrow); opacity: 0.7; }
    .node rect { stroke-width: 1.5; }
    .node-passed    rect { fill: var(--state-passed-bg);      stroke: var(--state-passed-text); }
    .node-failed    rect { fill: var(--state-failed-bg);      stroke: var(--state-failed-text); }
    .node-inprogress rect { fill: var(--state-in-progress-bg); stroke: var(--state-in-progress-text); }
    .node-skipped   rect { fill: var(--state-skipped-bg);     stroke: var(--state-skipped-text); }
    .node-pending   rect { fill: var(--node-bg);              stroke: var(--node-border); }
    .node-id    { fill: var(--text); font-size: 12px; font-weight: 600; }
    .node-title { fill: var(--text); font-size: 11px; }
    .node-state { fill: var(--text-muted); font-size: 10px; }
  </style>
</head>
<body>
  <h1>Orchestrate Dependency Graph</h1>
  <div class="meta">
    <span><strong>Run ID:</strong> ${esc(state.runId)}</span>
    <span><strong>Status:</strong> ${stateBadge(state.status as SliceState)}</span>
    <span><strong>${esc(String(numWaves))} waves</strong></span>
    <span><strong>${esc(String(Object.keys(state.slices).length))} slices</strong></span>
  </div>

  <div class="graph-container">
    <svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="var(--edge-color)"/>
        </marker>
      </defs>
      ${headers}
      ${edges}
      ${nodes}
    </svg>
  </div>

  <p style="margin-top: 16px; font-size: 12px; color: var(--text-muted);">
    Generated ${new Date().toISOString()} · Edges represent blockedBy dependencies (source → dependent)
  </p>
</body>
</html>`;
}

/**
 * Renders a final summary report of the orchestration run.
 * Shows run duration, outcome counts, final PR, and a per-slice outcome table.
 */
export function renderReport(state: RunState): string {
  const duration = formatDuration(state.startedAt, state.updatedAt);

  const counts = { passed: 0, failed: 0, skipped: 0, "in-progress": 0, pending: 0 };
  for (const s of Object.values(state.slices)) {
    counts[s.state] = (counts[s.state] ?? 0) + 1;
  }

  const sliceList = state.waves.flatMap((wave) =>
    wave.map((id) => state.slices[id]).filter(Boolean)
  );

  const rows = sliceList
    .map((slice) => {
      const pr = slice.pullRequest
        ? `<a href="${esc(safeHref(slice.pullRequest))}" target="_blank">PR</a>`
        : "—";
      const reason = slice.failureReason ? esc(slice.failureReason) : "—";
      return `
      <tr>
        <td>#${esc(String(slice.issue))}</td>
        <td>${esc(slice.title)}</td>
        <td>${esc(String(slice.wave))}</td>
        <td>${stateBadge(slice.state)}</td>
        <td>${pr}</td>
        <td style="color: var(--state-failed-text); font-size: 12px;">${reason}</td>
      </tr>`;
    })
    .join("");

  const finalPr = state.finalPullRequest
    ? `<a href="${esc(safeHref(state.finalPullRequest))}" target="_blank">${esc(state.finalPullRequest)}</a>`
    : "Not yet created";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Orchestrate Report — ${esc(state.runId)}</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <h1>Orchestrate Run Report</h1>
  <div class="meta">
    <span><strong>Run ID:</strong> ${esc(state.runId)}</span>
    <span><strong>Status:</strong> ${stateBadge(state.status as SliceState)}</span>
    <span><strong>Base:</strong> ${esc(state.integrationBase)}</span>
    <span><strong>Duration:</strong> ${esc(duration)}</span>
    ${state.parentIssue ? `<span><strong>Parent Issue:</strong> #${esc(String(state.parentIssue))}</span>` : ""}
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value" style="color: var(--state-passed-text)">${counts.passed}</div>
      <div class="stat-label">Passed</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--state-failed-text)">${counts.failed}</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--state-skipped-text)">${counts.skipped}</div>
      <div class="stat-label">Skipped</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--text-muted)">${counts.pending + counts["in-progress"]}</div>
      <div class="stat-label">Not Terminal</div>
    </div>
  </div>

  <div class="card">
    <strong>Final Pull Request:</strong> ${finalPr}
  </div>

  <div class="card">
    <strong>Timeline:</strong>
    <div style="margin-top: 8px; font-size: 13px; color: var(--text-muted);">
      <div>Started: ${esc(state.startedAt)}</div>
      <div>Updated: ${esc(state.updatedAt)}</div>
      <div>Duration: ${esc(duration)}</div>
    </div>
  </div>

  <h2>Per-Slice Outcomes</h2>
  <table>
    <thead>
      <tr>
        <th>Issue</th>
        <th>Title</th>
        <th>Wave</th>
        <th>State</th>
        <th>PR</th>
        <th>Failure Reason</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <p style="margin-top: 20px; font-size: 12px; color: var(--text-muted);">
    Generated ${new Date().toISOString()} · ${esc(state.umbrellaBranch)}
  </p>
</body>
</html>`;
}

// ─── Artifact tool functions ──────────────────────────────────────────────────

/**
 * Reads run-state, renders the dashboard HTML, writes it to disk, and returns
 * the artifact path. Never throws — every failure mode is a structured result.
 */
export async function renderDashboardArtifact(
  input: RenderInput
): Promise<RenderOutput> {
  const repoPath = input.repoPath ?? process.cwd();
  const read = readAndValidateRunState(repoPath);
  if (!read.ok) return read.response;

  const html = renderDashboard(read.state);
  const artifactPath = input.outputPath ?? path.join(repoPath, ARTIFACT_DEFAULTS.dashboard);
  const writeErr = writeArtifact(html, artifactPath);
  if (writeErr) return writeErr;

  return { status: "ok", artifactPath };
}

/**
 * Reads run-state, renders the dependency graph HTML, writes it to disk, and
 * returns the artifact path. Never throws — every failure mode is a structured result.
 */
export async function renderGraphArtifact(
  input: RenderInput
): Promise<RenderOutput> {
  const repoPath = input.repoPath ?? process.cwd();
  const read = readAndValidateRunState(repoPath);
  if (!read.ok) return read.response;

  const html = renderGraph(read.state);
  const artifactPath = input.outputPath ?? path.join(repoPath, ARTIFACT_DEFAULTS.graph);
  const writeErr = writeArtifact(html, artifactPath);
  if (writeErr) return writeErr;

  return { status: "ok", artifactPath };
}

/**
 * Reads run-state, renders the final report HTML, writes it to disk, and
 * returns the artifact path. Never throws — every failure mode is a structured result.
 */
export async function renderReportArtifact(
  input: RenderInput
): Promise<RenderOutput> {
  const repoPath = input.repoPath ?? process.cwd();
  const read = readAndValidateRunState(repoPath);
  if (!read.ok) return read.response;

  const html = renderReport(read.state);
  const artifactPath = input.outputPath ?? path.join(repoPath, ARTIFACT_DEFAULTS.report);
  const writeErr = writeArtifact(html, artifactPath);
  if (writeErr) return writeErr;

  return { status: "ok", artifactPath };
}
