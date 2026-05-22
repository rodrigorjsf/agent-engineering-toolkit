import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  detectProjectType,
  buildCommandMap,
  detectCommandMap,
  type ProjectType,
  type CapabilityCommandMap,
} from "../src/tools/detect-project.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a temporary directory and optionally writes marker files into it.
 * The `files` record maps relative paths to content (empty string = touch).
 */
function makeRepo(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrate-detect-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
  return dir;
}

const created: string[] = [];

function repo(files: Record<string, string> = {}): string {
  const dir = makeRepo(files);
  created.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of created) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  created.length = 0;
});

// ─── detectProjectType (pure function) ────────────────────────────────────────

describe("detectProjectType (pure)", () => {
  it("returns 'npm' when package.json is present in the manifest list", () => {
    expect(detectProjectType(["package.json"])).toBe("npm");
  });

  it("returns 'cargo' when Cargo.toml is present", () => {
    expect(detectProjectType(["Cargo.toml"])).toBe("cargo");
  });

  it("returns 'python' when pyproject.toml is present", () => {
    expect(detectProjectType(["pyproject.toml"])).toBe("python");
  });

  it("returns 'make' when Makefile is present", () => {
    expect(detectProjectType(["Makefile"])).toBe("make");
  });

  it("returns 'none' when no recognized manifest is present", () => {
    expect(detectProjectType([])).toBe("none");
    expect(detectProjectType(["README.md", "src/index.ts"])).toBe("none");
  });

  it("prefers npm over Makefile when both are present (manifest-first priority)", () => {
    expect(detectProjectType(["Makefile", "package.json"])).toBe("npm");
  });

  it("prefers cargo over Makefile when both are present", () => {
    expect(detectProjectType(["Makefile", "Cargo.toml"])).toBe("cargo");
  });

  it("prefers python over Makefile when both are present", () => {
    expect(detectProjectType(["Makefile", "pyproject.toml"])).toBe("python");
  });

  it("prefers npm over python when both are present", () => {
    expect(detectProjectType(["pyproject.toml", "package.json"])).toBe("npm");
  });
});

// ─── buildCommandMap (pure function) ──────────────────────────────────────────

describe("buildCommandMap (pure)", () => {
  it("returns the npm command map for 'npm'", () => {
    const map = buildCommandMap("npm");
    expect(map.tests).toEqual(["npm", "test"]);
    expect(map.typecheck).toEqual(["npm", "run", "typecheck"]);
    expect(map.build).toEqual(["npm", "run", "build"]);
    expect(map.lint).toEqual(["npm", "run", "lint"]);
    // install is not a capability verb — must not appear in the capability map
    expect("install" in map).toBe(false);
  });

  it("returns the cargo command map for 'cargo'", () => {
    const map = buildCommandMap("cargo");
    expect(map.tests).toEqual(["cargo", "test"]);
    expect(map.typecheck).toEqual(["cargo", "check"]);
    expect(map.build).toEqual(["cargo", "build"]);
    expect(map.lint).toEqual(["cargo", "clippy"]);
    expect("install" in map).toBe(false);
  });

  it("returns the python command map for 'python'", () => {
    const map = buildCommandMap("python");
    expect(map.tests).toEqual(["pytest"]);
    expect(map.typecheck).toEqual(["mypy", "."]);
    expect(map.build).toEqual(["python", "-m", "build"]);
    expect(map.lint).toEqual(["ruff", "check", "."]);
    expect("install" in map).toBe(false);
  });

  it("returns the make command map for 'make'", () => {
    const map = buildCommandMap("make");
    expect(map.tests).toEqual(["make", "test"]);
    expect(map.typecheck).toEqual(["make", "typecheck"]);
    expect(map.build).toEqual(["make", "build"]);
    expect(map.lint).toEqual(["make", "lint"]);
    expect("install" in map).toBe(false);
  });

  it("returns an empty map for 'none'", () => {
    const map = buildCommandMap("none");
    expect(map).toEqual({});
    expect(Object.keys(map)).toHaveLength(0);
  });

  it("the command map has exactly the four capability verb keys for recognized types", () => {
    for (const type of ["npm", "cargo", "python", "make"] as ProjectType[]) {
      const map = buildCommandMap(type);
      const keys = Object.keys(map).sort();
      expect(keys).toEqual(["build", "lint", "tests", "typecheck"]);
    }
  });
});

// ─── detectCommandMap (I/O function) ──────────────────────────────────────────

describe("detectCommandMap", () => {
  it("returns an empty map for a repository with no recognized manifest", () => {
    const dir = repo({ "README.md": "hello" });
    const map = detectCommandMap(dir);
    expect(map).toEqual({});
  });

  it("returns an empty map for a completely empty directory", () => {
    const dir = repo();
    const map = detectCommandMap(dir);
    expect(map).toEqual({});
  });

  it("detects npm from package.json", () => {
    const dir = repo({ "package.json": '{"name":"test"}' });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["npm", "test"]);
    expect(map.build).toEqual(["npm", "run", "build"]);
  });

  it("detects cargo from Cargo.toml", () => {
    const dir = repo({ "Cargo.toml": '[package]\nname = "test"' });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["cargo", "test"]);
    expect(map.build).toEqual(["cargo", "build"]);
  });

  it("detects python from pyproject.toml", () => {
    const dir = repo({ "pyproject.toml": "[tool.pytest]" });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["pytest"]);
    expect(map.typecheck).toEqual(["mypy", "."]);
  });

  it("detects make from Makefile", () => {
    const dir = repo({ "Makefile": "test:\n\techo test" });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["make", "test"]);
    expect(map.build).toEqual(["make", "build"]);
  });

  it("prefers npm over Makefile when both are present", () => {
    const dir = repo({
      "package.json": '{"name":"test"}',
      "Makefile": "test:\n\techo test",
    });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["npm", "test"]);
  });

  it("does not include an 'install' key in the result", () => {
    const dir = repo({ "package.json": '{"name":"test"}' });
    const map = detectCommandMap(dir);
    expect("install" in map).toBe(false);
  });

  it("returns the full four-key map for npm", () => {
    const dir = repo({ "package.json": '{"name":"test"}' });
    const map = detectCommandMap(dir);
    const keys = Object.keys(map).sort();
    expect(keys).toEqual(["build", "lint", "tests", "typecheck"]);
  });

  it("none case yields empty map — never a fallback to npm commands", () => {
    const dir = repo({ "go.mod": "module example.com/test" });
    const map = detectCommandMap(dir);
    // go.mod is not a recognized manifest; must not fall back to npm
    expect(map).toEqual({});
  });
});
