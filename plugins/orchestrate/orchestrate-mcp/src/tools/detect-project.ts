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
 * A capability command map — the four fixed verbs the orchestrate run tools
 * consume. Each verb maps to an argv array (no shell). For 'none', the map is
 * empty (`{}`). The `install` verb is never included — it is a setup verb, not
 * a capability verb.
 */
export type CapabilityCommandMap = {
  tests?: string[];
  typecheck?: string[];
  build?: string[];
  lint?: string[];
};

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
 * Canonical argv arrays for each project type. Every array is the no-shell
 * form executed by `execFile` — `argv[0]` is the binary, the rest are literal
 * arguments.
 *
 * Python commands assume the standard modern toolchain:
 *   - `pytest`   for tests (de-facto standard)
 *   - `mypy .`   for type checking
 *   - `python -m build` for building
 *   - `ruff check .` for linting (modern replacement for flake8)
 */
const COMMAND_MAPS: Record<
  Exclude<ProjectType, "none">,
  Required<CapabilityCommandMap>
> = {
  npm: {
    tests: ["npm", "test"],
    typecheck: ["npm", "run", "typecheck"],
    build: ["npm", "run", "build"],
    lint: ["npm", "run", "lint"],
  },
  cargo: {
    tests: ["cargo", "test"],
    typecheck: ["cargo", "check"],
    build: ["cargo", "build"],
    lint: ["cargo", "clippy"],
  },
  python: {
    tests: ["pytest"],
    typecheck: ["mypy", "."],
    build: ["python", "-m", "build"],
    lint: ["ruff", "check", "."],
  },
  make: {
    tests: ["make", "test"],
    typecheck: ["make", "typecheck"],
    build: ["make", "build"],
    lint: ["make", "lint"],
  },
};

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
 * Returns the capability command map for a given project type. Pure — no I/O.
 *
 * For 'none', returns an empty object (`{}`). For any recognized type, returns
 * an object with exactly the four capability verb keys (`tests`, `typecheck`,
 * `build`, `lint`). The `install` verb is never included.
 */
export function buildCommandMap(type: ProjectType): CapabilityCommandMap {
  if (type === "none") {
    return {};
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
  return buildCommandMap(projectType);
}

// ─── Re-exports for consumers ─────────────────────────────────────────────────

export { DETECTION_RULES, COMMAND_MAPS };
