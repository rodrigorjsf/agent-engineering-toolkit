<!-- TEMPLATE: Root AGENTS.md. Target: 15-40 lines. Only non-standard, non-obvious info;
     remove empty sections. Loads on every agent request — keep minimal.
-->

# [One-sentence project description from codebase analysis]

## Tooling

<!-- CONDITIONAL on non-standard tooling. Remove section if all tooling is the language default.
     Remove individual lines that match defaults. -->
- Package manager: [only if not the language default]
- Build: `[command]`
- Test: `[command]`
- Lint: `[command]`
- Typecheck: `[command]`
<!-- CONDITIONAL: non-standard config (e.g., `strict = true`, `addopts = "--cov=src"`). -->
- Config: `[tool] [key] = [value]`
<!-- CONDITIONAL: cross-scope build prerequisites (e.g., WASM must build before web). -->
- Prerequisite: `[command]` must run before `[scope]`

## Critical Constraints

<!-- CONDITIONAL: 1-3 repo-wide non-obvious constraints, architectural boundaries, or domain
     terms that would cause agent mistakes if omitted. -->
- `[constraint or non-obvious pattern]`

## Context

<!-- CONDITIONAL on multiple scopes with genuinely different tooling. -->
See scope-specific AGENTS.md files:

- `[scope-path/]` — [one-line scope purpose]

## References

<!-- CONDITIONAL: include only when domain docs were generated. -->
- For [domain topic], see `[path/to/domain-doc.md]`
