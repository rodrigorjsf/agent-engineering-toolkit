import { describe, it, expect, afterEach } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {
  detectProjectType,
  detectJsPackageManager,
  buildCommandMap,
  buildJsCommandMap,
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
  it("returns the pnpm command map for 'npm' with no PM argument (default)", () => {
    const map = buildCommandMap("npm");
    expect(map.tests).toEqual(["pnpm", "test"]);
    expect(map.typecheck).toEqual(["pnpm", "run", "typecheck"]);
    expect(map.build).toEqual(["pnpm", "run", "build"]);
    expect(map.lint).toEqual(["pnpm", "run", "lint"]);
    // install is now emitted — the mutating/resolving form, defaulting to pnpm
    expect(map.install).toEqual(["pnpm", "install"]);
  });

  it("returns npm-prefixed verbs + 'npm install' for 'npm' with the npm PM", () => {
    const map = buildCommandMap("npm", "npm");
    expect(map.tests).toEqual(["npm", "test"]);
    expect(map.typecheck).toEqual(["npm", "run", "typecheck"]);
    expect(map.build).toEqual(["npm", "run", "build"]);
    expect(map.lint).toEqual(["npm", "run", "lint"]);
    // mutating form — never `npm ci` (decision #5)
    expect(map.install).toEqual(["npm", "install"]);
  });

  it("returns yarn-prefixed verbs + 'yarn install' for 'npm' with the yarn PM", () => {
    const map = buildCommandMap("npm", "yarn");
    expect(map.tests).toEqual(["yarn", "test"]);
    expect(map.build).toEqual(["yarn", "run", "build"]);
    expect(map.install).toEqual(["yarn", "install"]);
  });

  it("returns the cargo command map for 'cargo', including 'cargo fetch' install", () => {
    const map = buildCommandMap("cargo");
    expect(map.tests).toEqual(["cargo", "test"]);
    expect(map.typecheck).toEqual(["cargo", "check"]);
    expect(map.build).toEqual(["cargo", "build"]);
    expect(map.lint).toEqual(["cargo", "clippy"]);
    expect(map.install).toEqual(["cargo", "fetch"]);
  });

  it("returns the python command map for 'python', including editable install", () => {
    const map = buildCommandMap("python");
    expect(map.tests).toEqual(["pytest"]);
    expect(map.typecheck).toEqual(["mypy", "."]);
    expect(map.build).toEqual(["python", "-m", "build"]);
    expect(map.lint).toEqual(["ruff", "check", "."]);
    expect(map.install).toEqual(["pip", "install", "-e", "."]);
  });

  it("returns the make command map for 'make', WITHOUT an install verb", () => {
    const map = buildCommandMap("make");
    expect(map.tests).toEqual(["make", "test"]);
    expect(map.typecheck).toEqual(["make", "typecheck"]);
    expect(map.build).toEqual(["make", "build"]);
    expect(map.lint).toEqual(["make", "lint"]);
    // make has no install verb (ledger #4) — key intentionally absent
    expect("install" in map).toBe(false);
  });

  it("returns an empty map for 'none'", () => {
    const map = buildCommandMap("none");
    expect(map).toEqual({});
    expect(Object.keys(map)).toHaveLength(0);
  });

  it("npm/cargo/python carry the install key; make does not", () => {
    for (const type of ["npm", "cargo", "python"] as ProjectType[]) {
      const map = buildCommandMap(type);
      const keys = Object.keys(map).sort();
      expect(keys).toEqual(["build", "install", "lint", "tests", "typecheck"]);
    }
    const makeKeys = Object.keys(buildCommandMap("make")).sort();
    expect(makeKeys).toEqual(["build", "lint", "tests", "typecheck"]);
  });
});

// ─── detectJsPackageManager (pure function) ───────────────────────────────────

describe("detectJsPackageManager (pure)", () => {
  it("returns 'pnpm' when pnpm-lock.yaml is present", () => {
    expect(detectJsPackageManager(["package.json", "pnpm-lock.yaml"])).toBe(
      "pnpm"
    );
  });

  it("returns 'yarn' when yarn.lock is present", () => {
    expect(detectJsPackageManager(["package.json", "yarn.lock"])).toBe("yarn");
  });

  it("returns 'npm' when package-lock.json is present", () => {
    expect(detectJsPackageManager(["package.json", "package-lock.json"])).toBe(
      "npm"
    );
  });

  it("returns 'pnpm' (the preferred default) when no lockfile is present", () => {
    expect(detectJsPackageManager(["package.json"])).toBe("pnpm");
    expect(detectJsPackageManager([])).toBe("pnpm");
  });

  it("prefers pnpm over yarn over npm when multiple lockfiles are present", () => {
    expect(
      detectJsPackageManager([
        "pnpm-lock.yaml",
        "yarn.lock",
        "package-lock.json",
      ])
    ).toBe("pnpm");
    expect(detectJsPackageManager(["yarn.lock", "package-lock.json"])).toBe(
      "yarn"
    );
  });
});

// ─── buildJsCommandMap (pure function) ────────────────────────────────────────

describe("buildJsCommandMap (pure)", () => {
  it("builds the full five-verb map keyed on the package manager", () => {
    const map = buildJsCommandMap("pnpm");
    expect(map.tests).toEqual(["pnpm", "test"]);
    expect(map.typecheck).toEqual(["pnpm", "run", "typecheck"]);
    expect(map.build).toEqual(["pnpm", "run", "build"]);
    expect(map.lint).toEqual(["pnpm", "run", "lint"]);
    expect(map.install).toEqual(["pnpm", "install"]);
  });

  it("uses the mutating install form for npm — never `npm ci`", () => {
    expect(buildJsCommandMap("npm").install).toEqual(["npm", "install"]);
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

  it("detects npm from package.json + package-lock.json with npm-prefixed verbs", () => {
    const dir = repo({
      "package.json": '{"name":"test"}',
      "package-lock.json": "{}",
    });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["npm", "test"]);
    expect(map.build).toEqual(["npm", "run", "build"]);
    // mutating install keyed on the npm lockfile — never `npm ci`
    expect(map.install).toEqual(["npm", "install"]);
  });

  it("defaults a lockfile-less npm project to the pnpm verb set", () => {
    const dir = repo({ "package.json": '{"name":"test"}' });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["pnpm", "test"]);
    expect(map.build).toEqual(["pnpm", "run", "build"]);
    expect(map.install).toEqual(["pnpm", "install"]);
  });

  it("keys the npm verb set on yarn.lock", () => {
    const dir = repo({
      "package.json": '{"name":"test"}',
      "yarn.lock": "",
    });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["yarn", "test"]);
    expect(map.install).toEqual(["yarn", "install"]);
  });

  it("detects cargo from Cargo.toml with its fetch install", () => {
    const dir = repo({ "Cargo.toml": '[package]\nname = "test"' });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["cargo", "test"]);
    expect(map.build).toEqual(["cargo", "build"]);
    expect(map.install).toEqual(["cargo", "fetch"]);
  });

  it("detects python from pyproject.toml with its editable install", () => {
    const dir = repo({ "pyproject.toml": "[tool.pytest]" });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["pytest"]);
    expect(map.typecheck).toEqual(["mypy", "."]);
    expect(map.install).toEqual(["pip", "install", "-e", "."]);
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
      "package-lock.json": "{}",
      "Makefile": "test:\n\techo test",
    });
    const map = detectCommandMap(dir);
    expect(map.tests).toEqual(["npm", "test"]);
  });

  it("omits the 'install' key for a make project", () => {
    const dir = repo({ "Makefile": "test:\n\techo test" });
    const map = detectCommandMap(dir);
    expect("install" in map).toBe(false);
  });

  it("returns the full five-key map (incl. install) for npm", () => {
    const dir = repo({ "package.json": '{"name":"test"}' });
    const map = detectCommandMap(dir);
    const keys = Object.keys(map).sort();
    expect(keys).toEqual(["build", "install", "lint", "tests", "typecheck"]);
  });

  it("none case yields empty map — never a fallback to npm commands", () => {
    const dir = repo({ "go.mod": "module example.com/test" });
    const map = detectCommandMap(dir);
    // go.mod is not a recognized manifest; must not fall back to npm
    expect(map).toEqual({});
  });
});
