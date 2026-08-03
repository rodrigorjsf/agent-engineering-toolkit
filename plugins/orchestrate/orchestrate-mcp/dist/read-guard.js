#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/hooks/read-guard.ts
var path = __toESM(require("path"));
var GUARDED_BASENAME = /^slice-\d+-(progress\.json|report\.md)$/;
var READ_VERBS = /* @__PURE__ */ new Set([
  "cat",
  "head",
  "tail",
  "less",
  "more",
  "bat",
  "sed",
  "awk",
  "grep",
  "rg",
  "jq",
  "od",
  "xxd",
  "strings",
  "nl",
  "wc",
  "source",
  "."
]);
var READ_GUARD_DENY_REASON = "orchestrate: the orchestrator does not open slice-internal artifacts. Use the slice-executor envelope's own fields for the slice's outcome, and pass reportPath forward without opening it. If the envelope is missing or invalid, recover the progress record's contents through the recover_slice_progress MCP tool, which derives the path from (runId, issue) and returns validated structured data.";
function denyPayload(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    }
  };
}
function unquote(token) {
  const match = token.match(/^(["'])(.*)\1$/);
  return match ? match[2] : token;
}
function isGuardedPath(candidate, cwd, runDir) {
  if (candidate === "") return false;
  const resolved = path.resolve(cwd, candidate);
  return path.dirname(resolved) === runDir && GUARDED_BASENAME.test(path.basename(resolved));
}
function bashReadsGuardedPath(command, cwd, runDir) {
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const tokens = segment.trim().split(/\s+/).filter((t) => t !== "");
    if (tokens.length === 0) continue;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let candidate;
      if (token === "<") candidate = tokens[i + 1];
      else if (token.startsWith("<") && !token.startsWith("<<")) {
        candidate = token.slice(1);
      }
      if (candidate !== void 0 && isGuardedPath(unquote(candidate), cwd, runDir)) {
        return true;
      }
    }
    let start = 0;
    while (start < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[start])) {
      start++;
    }
    if (start >= tokens.length) continue;
    if (!READ_VERBS.has(path.basename(unquote(tokens[start])))) continue;
    for (const token of tokens.slice(start + 1)) {
      if (isGuardedPath(unquote(token), cwd, runDir)) return true;
    }
  }
  return false;
}
function decideReadGuard(input) {
  const none = { decision: "none" };
  try {
    if (typeof input.agentId === "string" && input.agentId.length > 0) {
      return none;
    }
    const runId = input.activeRunId;
    if (typeof runId !== "string" || runId.length === 0) return none;
    if (typeof input.cwd !== "string" || input.cwd.length === 0) return none;
    const toolInput = input.toolInput;
    if (typeof toolInput !== "object" || toolInput === null) return none;
    const cwd = input.cwd;
    const runDir = path.resolve(cwd, ".orchestrate", "runs", runId);
    if (input.toolName === "Read") {
      const filePath = toolInput.file_path;
      if (typeof filePath === "string" && isGuardedPath(filePath, cwd, runDir)) {
        return { decision: "deny", reason: READ_GUARD_DENY_REASON };
      }
      return none;
    }
    if (input.toolName === "Bash") {
      const command = toolInput.command;
      if (typeof command === "string" && bashReadsGuardedPath(command, cwd, runDir)) {
        return { decision: "deny", reason: READ_GUARD_DENY_REASON };
      }
      return none;
    }
    return none;
  } catch {
    return none;
  }
}

// src/hooks/run-discovery.ts
var path2 = __toESM(require("path"));
var fs = __toESM(require("fs"));
function scanInProgressRuns(cwd) {
  const runsDir = path2.join(cwd, ".orchestrate", "runs");
  let entries;
  try {
    entries = fs.readdirSync(runsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const statePath = path2.join(runsDir, entry.name, "run-state.json");
    let runState;
    try {
      runState = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch {
      continue;
    }
    if (typeof runState !== "object" || runState === null || runState.status !== "in-progress") {
      continue;
    }
    const rawId = runState.driverSessionId;
    runs.push({
      runId: entry.name,
      driverSessionId: typeof rawId === "string" ? rawId : null
    });
  }
  return runs;
}
function findActiveRunForSession(cwd, sessionId) {
  const runs = scanInProgressRuns(cwd);
  if (runs.length === 0) return null;
  if (typeof sessionId === "string" && sessionId.length > 0) {
    const matches = runs.filter((r) => r.driverSessionId === sessionId);
    if (matches.length === 1) return matches[0].runId;
  }
  if (runs.length === 1) return runs[0].runId;
  return null;
}

// src/hooks/read-guard-cli.ts
function readStdin() {
  return new Promise((resolve2) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve2(data));
    process.stdin.on("error", () => resolve2(data));
  });
}
async function main() {
  let raw = "";
  try {
    raw = await readStdin();
  } catch {
    process.exit(0);
  }
  try {
    const event = raw ? JSON.parse(raw) : {};
    const cwd = typeof event.cwd === "string" ? event.cwd : process.cwd();
    const sessionId = typeof event.session_id === "string" && event.session_id.length > 0 ? event.session_id : void 0;
    const runId = findActiveRunForSession(cwd, sessionId);
    if (runId === null) {
      process.exit(0);
    }
    const decision = decideReadGuard({
      toolName: typeof event.tool_name === "string" ? event.tool_name : void 0,
      toolInput: typeof event.tool_input === "object" && event.tool_input !== null ? event.tool_input : void 0,
      // Present ONLY inside a subagent call, which is what makes it — and not
      // `agent_type`, which a `--agent` session also carries — the main-thread
      // discriminator.
      agentId: typeof event.agent_id === "string" ? event.agent_id : void 0,
      cwd,
      activeRunId: runId
    });
    if (decision.decision === "deny") {
      process.stdout.write(JSON.stringify(denyPayload(decision.reason)));
    }
  } catch {
  }
  process.exit(0);
}
void main();
