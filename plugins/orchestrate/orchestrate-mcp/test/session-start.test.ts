import { describe, it, expect } from "vitest";
import {
  SESSION_ID_ENV_VAR,
  shellQuote,
  buildSessionEnvLine,
} from "../src/hooks/session-start.js";

// ─── shellQuote ───────────────────────────────────────────────────────────────

describe("shellQuote", () => {
  it("wraps an ordinary value in single quotes", () => {
    expect(shellQuote("abc123")).toBe("'abc123'");
  });

  it("escapes an embedded single quote as '\\'' ", () => {
    // close-quote, escaped quote, reopen-quote.
    expect(shellQuote("a'b")).toBe("'a'\\''b'");
  });

  it("leaves shell metacharacters inert inside the quotes", () => {
    const quoted = shellQuote("$(rm -rf /); `whoami`");
    expect(quoted).toBe("'$(rm -rf /); `whoami`'");
  });

  it("quotes an empty string", () => {
    expect(shellQuote("")).toBe("''");
  });
});

// ─── buildSessionEnvLine ──────────────────────────────────────────────────────

describe("buildSessionEnvLine", () => {
  it("builds an export line for a normal session id", () => {
    expect(buildSessionEnvLine("abc123")).toBe(
      `export ${SESSION_ID_ENV_VAR}='abc123'\n`
    );
  });

  it("uses ORCHESTRATE_SESSION_ID as the variable name", () => {
    expect(SESSION_ID_ENV_VAR).toBe("ORCHESTRATE_SESSION_ID");
    expect(buildSessionEnvLine("s")).toContain("ORCHESTRATE_SESSION_ID=");
  });

  it("terminates the line with a newline so it appends cleanly", () => {
    expect(buildSessionEnvLine("s")!.endsWith("\n")).toBe(true);
  });

  it("shell-quotes a session id carrying a single quote", () => {
    expect(buildSessionEnvLine("a'b")).toBe(
      `export ${SESSION_ID_ENV_VAR}='a'\\''b'\n`
    );
  });

  it("returns null for an undefined session id", () => {
    expect(buildSessionEnvLine(undefined)).toBeNull();
  });

  it("returns null for an empty session id", () => {
    expect(buildSessionEnvLine("")).toBeNull();
  });
});
