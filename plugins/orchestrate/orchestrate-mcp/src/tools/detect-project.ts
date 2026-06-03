import * as fs from "fs";

// ─── Project type ─────────────────────────────────────────────────────────────

/**
 * A recognized project type, or 'none' when no manifest is detected.
 *
 * Detection precedence (manifest-first, then Make):
 *   npm (package.json) > cargo (Cargo.toml) > python (pyproject.toml) > make (Makefile) > none
 *
 * Python detection uses `pyproject.toml` only (the modern standard as of PEP 517/518).
 * `setup.py` is legacy and intentionally excluded.
 */
export type ProjectType = "npm" | "cargo" | "python" | "make" | "none";

/**
 * A capability command map — the four fixed capability verbs the orchestrate
 * run tools consume, plus the optional `install` setup verb. Each verb maps to
 * an argv array (no shell). For 'none', the map is empty (`{}`).
 *
 * `install` is the mutating/resolving dependency step (e.g. `pnpm install`,
 * `npm install`, `cargo fetch`, `pip install -e .`) a subagent calls via the
 * `run_install` MCP tool after editing a manifest to add a new dependency — a
 * fresh worktree checks out only tracked files, so a newly-added dependency is
 * not present until install runs. It is OPTIONAL: a `make`/'none' project has
 * no install verb, and a project whose capability commands need no install
 * simply omits it.
 */
export type CapabilityCommandMap = {
  tests?: string[];
  typecheck?: string[];
  build?: string[];
  lint?: string[];
  install?: string[];
};

// ─── JS package-manager resolution ────────────────────────────────────────────

/**
 * The JavaScript-ecosystem package manager, resolved from the lockfile present
 * in a repository root. The whole verb set (the four capability verbs + the
 * `install` setup verb) is keyed on this for consistency — a pnpm-only
 * environment must run `pnpm test`, not `npm test`.
 */
export type JsPackageManager = "pnpm" | "yarn" | "npm";

/**
 * Resolves the JS package manager from the list of filenames present in a
 * repository root, keyed on lockfile precedence. Pure — no I/O; the caller
 * supplies the filename list (the same `readdirSync` list the detector already
 * produces).
 *
 * Precedence: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn,
 * `package-lock.json` → npm, none present → **pnpm** (the preferred default).
 *
 * The lockfile is the single source of truth: there is NO runtime pnpm→npm
 * fallback. A missing `pnpm` binary surfaces later as `run_install`'s
 * `EXEC_ERROR` rather than a silent PM switch — a blind fallback would corrupt
 * a pnpm/yarn repo by writing a foreign lockfile into the slice diff.
 */
export function detectJsPackageManager(
  filesPresent: string[]
): JsPackageManager {
  const present = new Set(filesPresent);
  if (present.has("pnpm-lock.yaml")) {
    return "pnpm";
  }
  if (present.has("yarn.lock")) {
    return "yarn";
  }
  if (present.has("package-lock.json")) {
    return "npm";
  }
  return "pnpm";
}

// ─── Detection manifest list ──────────────────────────────────────────────────

/**
 * Ordered detection rules. The first match wins — earlier entries have higher
 * priority. `Makefile` is last because it often wraps another toolchain;
 * language-specific manifests take precedence over a thin Make wrapper.
 */
const DETECTION_RULES: ReadonlyArray<{ manifest: string; type: ProjectType }> =
  [
    { manifest: "package.json", type: "npm" },
    { manifest: "Cargo.toml", type: "cargo" },
    { manifest: "pyproject.toml", type: "python" },
    { manifest: "Makefile", type: "make" },
  ];

// ─── Command maps ─────────────────────────────────────────────────────────────

/**
 * Canonical argv arrays for the NON-JS project types. Every array is the
 * no-shell form executed by `execFile` — `argv[0]` is the binary, the rest are
 * literal arguments. The JS (`npm`) ecosystem is NOT static — it is computed
 * per package manager by {@link buildJsCommandMap} (lockfile-keyed), so it does
 * not appear here.
 *
 * The map type is `CapabilityCommandMap` (install OPTIONAL) — `cargo` and
 * `python` carry an `install` (the mutating dependency-resolve step), but
 * `make` omits it: the ledger specifies no install verb for a thin Make wrapper.
 *
 * Python commands assume the standard modern toolchain:
 *   - `pytest`   for tests (de-facto standard)
 *   - `mypy .`   for type checking
 *   - `python -m build` for building
 *   - `ruff check .` for linting (modern replacement for flake8)
 *   - `pip install -e .` for install (editable install of the local package)
 */
const COMMAND_MAPS: Record<
  Exclude<ProjectType, "none" | "npm">,
  CapabilityCommandMap
> = {
  cargo: {
    tests: ["cargo", "test"],
    typecheck: ["cargo", "check"],
    build: ["cargo", "build"],
    lint: ["cargo", "clippy"],
    install: ["cargo", "fetch"],
  },
  python: {
    tests: ["pytest"],
    typecheck: ["mypy", "."],
    build: ["python", "-m", "build"],
    lint: ["ruff", "check", "."],
    install: ["pip", "install", "-e", "."],
  },
  make: {
    tests: ["make", "test"],
    typecheck: ["make", "typecheck"],
    build: ["make", "build"],
    lint: ["make", "lint"],
    // make has no install verb (ledger #4) — a thin Make wrapper's install
    // step is unspecified, so the key is intentionally absent.
  },
};

/**
 * Builds the full JS-ecosystem command map for a resolved package manager. The
 * whole verb set is keyed on the PM (decision #4) so a pnpm-only environment
 * never runs `npm test`. `install` is the **mutating/resolving** form
 * (`pnpm install` / `npm install`, never `npm ci`) so a subagent adding a new
 * dependency to `package.json` and calling `run_install` resolves and rewrites
 * the lockfile in-place.
 *
 * Returns `Required<CapabilityCommandMap>` — a JS project always has all five
 * verbs (the four capabilities + install).
 */
export function buildJsCommandMap(
  pm: JsPackageManager
): Required<CapabilityCommandMap> {
  return {
    tests: [pm, "test"],
    typecheck: [pm, "run", "typecheck"],
    build: [pm, "run", "build"],
    lint: [pm, "run", "lint"],
    install: [pm, "install"],
  };
}

// ─── Pure functions ───────────────────────────────────────────────────────────

/**
 * Determines the project type from the list of filenames present in a
 * repository root. Pure — no I/O; the caller supplies the manifest list.
 *
 * Returns the first match from {@link DETECTION_RULES}, applying
 * manifest-first priority (npm > cargo > python > make). Returns 'none' when
 * no recognized manifest is present.
 */
export function detectProjectType(manifestsPresent: string[]): ProjectType {
  const present = new Set(manifestsPresent);
  for (const rule of DETECTION_RULES) {
    if (present.has(rule.manifest)) {
      return rule.type;
    }
  }
  return "none";
}

/**
 * Returns the command map for a given project type. Pure — no I/O.
 *
 * For 'none', returns an empty object (`{}`). For a recognized type, returns
 * the four capability verbs plus the `install` setup verb where one exists:
 * npm/cargo/python carry `install`; `make` does not. For an `npm` project the
 * whole verb set is keyed on `jsPackageManager` (lockfile-resolved by the
 * caller, defaulting to pnpm when none is supplied).
 */
export function buildCommandMap(
  type: ProjectType,
  jsPackageManager?: JsPackageManager
): CapabilityCommandMap {
  if (type === "none") {
    return {};
  }
  if (type === "npm") {
    return buildJsCommandMap(jsPackageManager ?? "pnpm");
  }
  return { ...COMMAND_MAPS[type] };
}

// ─── I/O function ─────────────────────────────────────────────────────────────

/**
 * Detects the project type from the repository root and returns the
 * corresponding capability command map.
 *
 * Reads only the top-level directory entries of `repoRoot` — no subdirectory
 * traversal, no config parsing. Checks for the presence of the manifest files
 * defined in {@link DETECTION_RULES} and delegates to the pure functions.
 *
 * Returns an empty map (`{}`) when:
 * - The repository has no recognized manifest.
 * - `repoRoot` does not exist or cannot be read.
 *
 * Never throws — every failure mode yields an empty map.
 */
export function detectCommandMap(repoRoot: string): CapabilityCommandMap {
  let entries: string[];
  try {
    entries = fs.readdirSync(repoRoot);
  } catch {
    // Unreadable or non-existent directory — treat as "no manifest found".
    return {};
  }

  // Build the set of manifest filenames we care about (no subdirectory walk).
  const manifests = DETECTION_RULES.map((r) => r.manifest);
  const presentManifests = entries.filter((e) => manifests.includes(e));

  const projectType = detectProjectType(presentManifests);
  if (projectType === "npm") {
    // Resolve the JS package manager from the SAME top-level `entries` list —
    // the lockfiles are top-level entries already in scope (no extra I/O), and
    // they are NOT in `presentManifests` (that list is filtered to the
    // detection manifests, which excludes lockfiles).
    const pm = detectJsPackageManager(entries);
    return buildCommandMap(projectType, pm);
  }
  return buildCommandMap(projectType);
}

// ─── Re-exports for consumers ─────────────────────────────────────────────────

export { DETECTION_RULES, COMMAND_MAPS };
