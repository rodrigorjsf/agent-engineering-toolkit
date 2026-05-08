<!-- TEMPLATE: Root CLAUDE.md. Target: 15-40 lines after placeholders are filled.
     Remove sections that would be empty after filling. Only non-standard, non-obvious info.
     Loaded at every session start — keep minimal. Maximize on-demand loading via subdirectory
     CLAUDE.md and .claude/rules/.
-->

# [One-sentence project description from codebase analysis]

## Tooling

<!-- CONDITIONAL on non-standard tooling. Remove if all tooling is the language default;
     remove individual lines that match defaults. -->
- Package manager: [only if not the language default]
- Build: `[command]`
- Test: `[command]`
- Lint: `[command]`
- Typecheck: `[command]`
<!-- CONDITIONAL: non-standard config (`strict = true` mypy, `addopts = "--cov=src"` pytest). -->
- Config: `[tool] [key] = [value]`
<!-- CONDITIONAL: cross-scope prerequisites (WASM must build before web). -->
- Prerequisite: `[command]` must run before `[scope]`

## Critical Constraints

<!-- CONDITIONAL: 1-3 repo-wide non-obvious constraints, architectural boundaries, or domain
     terms that would cause agent mistakes if omitted. -->
- `[constraint or non-obvious pattern]`

## Context

<!-- CONDITIONAL on multiple scopes with genuinely different tooling. -->
See scope-specific CLAUDE.md files:

- `[scope-path/]` — [one-line scope purpose]

## References

<!-- CONDITIONAL on domain docs generated. Pointers, not inlined content. -->
- For [domain topic], see `[path/to/domain-doc.md]`
