import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  parseAstGrepJson,
  searchStructural,
} from "../src/tools/search-structural.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** One ast-grep `--json` match object. */
function match(
  file: string,
  startLine: number,
  endLine: number,
  lines: string
): Record<string, unknown> {
  return {
    text: lines.trim(),
    lines,
    range: {
      start: { line: startLine, column: 0 },
      end: { line: endLine, column: 0 },
    },
    file,
  };
}

const created: string[] = [];

/**
 * Writes an executable shell script that stands in for the `ast-grep` binary —
 * it ignores its arguments and emits fixed stdout/stderr and exit code. Output
 * is base64-encoded into the script to survive any JSON quoting.
 */
function fakeAstGrep(opts: {
  stdout?: string;
  stderr?: string;
  exit?: number;
  sleepSeconds?: number;
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-astgrep-"));
  created.push(dir);
  const scriptPath = path.join(dir, "fake-ast-grep");
  const lines = ["#!/bin/sh"];
  if (opts.sleepSeconds !== undefined) {
    lines.push(`sleep ${opts.sleepSeconds}`);
  }
  if (opts.stdout !== undefined) {
    const b64 = Buffer.from(opts.stdout, "utf8").toString("base64");
    lines.push(`printf '%s' '${b64}' | base64 -d`);
  }
  if (opts.stderr !== undefined) {
    const b64 = Buffer.from(opts.stderr, "utf8").toString("base64");
    lines.push(`printf '%s' '${b64}' | base64 -d 1>&2`);
  }
  lines.push(`exit ${opts.exit ?? 0}`);
  fs.writeFileSync(scriptPath, lines.join("\n") + "\n", { mode: 0o755 });
  return scriptPath;
}

afterEach(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  created.length = 0;
});

// ─── parseAstGrepJson ─────────────────────────────────────────────────────────

describe("parseAstGrepJson", () => {
  it("parses a JSON array of matches", () => {
    const json = JSON.stringify([
      match("src/a.ts", 10, 10, "  console.log(a)"),
      match("src/b.ts", 4, 6, "function f() {}"),
    ]);
    const result = parseAstGrepJson(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toEqual({
      file: "src/a.ts",
      startLine: 10,
      endLine: 10,
      snippet: "  console.log(a)",
    });
    expect(result.matches[1].file).toBe("src/b.ts");
    expect(result.matches[1].endLine).toBe(6);
  });

  it("treats an empty array as zero matches", () => {
    const result = parseAstGrepJson("[]");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.matches).toHaveLength(0);
  });

  it("treats empty output as zero matches", () => {
    const result = parseAstGrepJson("   ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.matches).toHaveLength(0);
  });

  it("rejects non-JSON output", () => {
    expect(parseAstGrepJson("not json at all").ok).toBe(false);
  });

  it("rejects JSON that is not an array", () => {
    expect(parseAstGrepJson('{"file":"a.ts"}').ok).toBe(false);
  });

  it("skips a match object with no file field", () => {
    const json = JSON.stringify([
      { range: { start: { line: 1 }, end: { line: 1 } }, lines: "x" },
      match("src/ok.ts", 2, 2, "ok"),
    ]);
    const result = parseAstGrepJson(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].file).toBe("src/ok.ts");
  });

  it("defaults line numbers to zero when range is absent", () => {
    const result = parseAstGrepJson(
      JSON.stringify([{ file: "src/a.ts", text: "snippet" }])
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matches[0]).toEqual({
      file: "src/a.ts",
      startLine: 0,
      endLine: 0,
      snippet: "snippet",
    });
  });

  it("falls back to the text field when lines is absent", () => {
    const result = parseAstGrepJson(
      JSON.stringify([
        { file: "src/a.ts", text: "from text", range: { start: { line: 1 }, end: { line: 1 } } },
      ])
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.matches[0].snippet).toBe("from text");
  });

  it("truncates a snippet longer than 2000 characters", () => {
    const huge = "x".repeat(2500);
    const result = parseAstGrepJson(
      JSON.stringify([match("src/a.ts", 1, 50, huge)])
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matches[0].snippet.length).toBe(2001); // 2000 + ellipsis
    expect(result.matches[0].snippet.endsWith("…")).toBe(true);
  });
});

// ─── searchStructural ─────────────────────────────────────────────────────────

describe("searchStructural", () => {
  const repoPath = os.tmpdir();

  it("reports unavailable when the ast-grep binary is missing", async () => {
    const result = await searchStructural(
      { pattern: "console.log($A)", repoPath },
      { binary: "orchestrate-nonexistent-astgrep-xyz" }
    );
    expect(result.status).toBe("unavailable");
  });

  it("returns ok with parsed matches when ast-grep succeeds", async () => {
    const stdout = JSON.stringify([
      match("src/a.ts", 3, 3, "console.log(a)"),
      match("src/b.ts", 9, 9, "console.log(b)"),
    ]);
    const binary = fakeAstGrep({ stdout, exit: 0 });
    const result = await searchStructural(
      { pattern: "console.log($A)", repoPath },
      { binary }
    );
    expect(result.status).toBe("ok");
    expect(result.matchCount).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.matches![0].file).toBe("src/a.ts");
  });

  it("returns ok with zero matches when ast-grep emits an empty array", async () => {
    const binary = fakeAstGrep({ stdout: "[]", exit: 0 });
    const result = await searchStructural(
      { pattern: "nope($A)", repoPath },
      { binary }
    );
    expect(result.status).toBe("ok");
    expect(result.matchCount).toBe(0);
  });

  it("returns BAD_OUTPUT when ast-grep exits 0 with unparseable output", async () => {
    const binary = fakeAstGrep({ stdout: "this is not json", exit: 0 });
    const result = await searchStructural(
      { pattern: "x", repoPath },
      { binary }
    );
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("BAD_OUTPUT");
  });

  it("returns ASTGREP_FAILED when ast-grep exits non-zero without JSON", async () => {
    const binary = fakeAstGrep({
      stderr: "error: invalid pattern syntax",
      exit: 1,
    });
    const result = await searchStructural(
      { pattern: "((((", repoPath },
      { binary }
    );
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("ASTGREP_FAILED");
    expect(result.errorMessage).toContain("invalid pattern");
  });

  it("still parses matches when ast-grep exits non-zero but emits valid JSON", async () => {
    const stdout = JSON.stringify([match("src/a.ts", 1, 1, "x")]);
    const binary = fakeAstGrep({ stdout, exit: 1 });
    const result = await searchStructural(
      { pattern: "x", repoPath },
      { binary }
    );
    expect(result.status).toBe("ok");
    expect(result.matchCount).toBe(1);
  });

  it("returns TIMEOUT when ast-grep exceeds the time limit", async () => {
    const binary = fakeAstGrep({ sleepSeconds: 5, exit: 0 });
    const result = await searchStructural(
      { pattern: "x", repoPath },
      { binary, timeoutMs: 100 }
    );
    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("TIMEOUT");
  });

  it("caps the match list and sets truncated when ast-grep returns more than 100", async () => {
    const many = Array.from({ length: 150 }, (_, i) =>
      match(`src/f${i}.ts`, i, i, `line ${i}`)
    );
    const binary = fakeAstGrep({ stdout: JSON.stringify(many), exit: 0 });
    const result = await searchStructural(
      { pattern: "x", repoPath },
      { binary }
    );
    expect(result.status).toBe("ok");
    expect(result.matchCount).toBe(100);
    expect(result.truncated).toBe(true);
    expect(result.matches).toHaveLength(100);
  });
});
