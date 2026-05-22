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

// src/hooks/session-start-cli.ts
var fs = __toESM(require("fs"));

// src/hooks/session-start.ts
var SESSION_ID_ENV_VAR = "ORCHESTRATE_SESSION_ID";
function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
function buildSessionEnvLine(sessionId) {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return null;
  }
  return `export ${SESSION_ID_ENV_VAR}=${shellQuote(sessionId)}
`;
}

// src/hooks/session-start-cli.ts
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
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
    const envFile = process.env.CLAUDE_ENV_FILE;
    if (typeof envFile !== "string" || envFile.length === 0) {
      process.exit(0);
    }
    const event = raw ? JSON.parse(raw) : {};
    const sessionId = typeof event.session_id === "string" ? event.session_id : void 0;
    const line = buildSessionEnvLine(sessionId);
    if (line === null) {
      process.exit(0);
    }
    fs.appendFileSync(envFile, line);
  } catch {
  }
  process.exit(0);
}
void main();
