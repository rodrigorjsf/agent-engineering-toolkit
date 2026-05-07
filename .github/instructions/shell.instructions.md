---
description: 'Shell scripting best practices and conventions for bash, sh, zsh, and other shells'
applyTo: '**/*.sh'
---

# Shell Scripting Guidelines

## General Principles

- Generate code that is clean, simple, and concise.
- Add comments where helpful; avoid excessive logging.
- Use `shellcheck` for static analysis when available.
- Double-quote variable references (`"$var"`); use `${var}` for clarity; avoid `eval`.
- Use modern Bash features (`[[ ]]`, `local`, arrays) when portability allows; fall back to POSIX constructs only when needed.
- Choose reliable parsers for structured data — avoid ad-hoc text processing.

## Error Handling & Safety

- Always enable `set -euo pipefail` at the top of scripts.
- Validate all required parameters before execution; provide clear error messages with context.
- Use `trap` to clean up temporary resources on exit.
- Declare immutable values with `readonly` (or `declare -r`).
- Use `mktemp` to create temporary files/directories; clean them up in the `trap` handler.

## Script Structure

- Start with `#!/bin/bash` unless otherwise specified.
- Include a header comment stating the script's purpose.
- Define default values for all variables at the top.
- Use functions for reusable code blocks; avoid repeating similar code blocks.
- Keep the main execution flow clean: call a `main()` function at the bottom.

## Working with JSON and YAML

- Prefer `jq` for JSON and `yq` for YAML over `grep`/`awk`/string splitting.
- When `jq`/`yq` are unavailable, use the next most reliable parser and document why.
- Validate required fields and handle missing/invalid data paths explicitly (e.g., `jq`'s `// empty` or checking exit status).
- Quote `jq`/`yq` filters to prevent shell expansion; use `--raw-output` for plain strings.
- Treat parser errors as fatal — combine with `set -euo pipefail` or check success before using results.
- Document parser dependencies at the top; fail fast with a helpful message if required tools are missing.

## Validation Checklist

- [ ] `set -euo pipefail` is present at the top.
- [ ] All required parameters validated before execution.
- [ ] `trap` handler cleans up temporary resources on exit.
- [ ] Temporary files created with `mktemp`, not hardcoded paths.
- [ ] Variable references double-quoted (`"$var"`).
- [ ] No use of `eval` with untrusted input.
- [ ] JSON/YAML parsing uses `jq`/`yq`, not `grep`/`awk`.
- [ ] Parser dependencies documented; script fails fast if missing.
- [ ] `--help` or usage function present.

For deep guidance, see [docs/agents/shell-reference.md](../../docs/agents/shell-reference.md).
