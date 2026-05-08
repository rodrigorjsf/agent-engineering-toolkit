Detailed reference for [.github/instructions/shell.instructions.md](../../.github/instructions/shell.instructions.md). Core file holds the authoritative checklist; this file holds the supporting depth.

# Shell Scripting — Deep Reference

## Canonical Script Template

Use this as a starting point for new scripts:

```bash
#!/bin/bash

# ============================================================================
# Script Description Here
# ============================================================================

set -euo pipefail

cleanup() {
    # Remove temporary resources or perform other teardown steps as needed
    if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

trap cleanup EXIT

# Default values
RESOURCE_GROUP=""
REQUIRED_PARAM=""
OPTIONAL_PARAM="default-value"
readonly SCRIPT_NAME="$(basename "$0")"

TEMP_DIR=""

# Functions
usage() {
    echo "Usage: $SCRIPT_NAME [OPTIONS]"
    echo "Options:"
    echo "  -g, --resource-group   Resource group (required)"
    echo "  -h, --help            Show this help"
    exit 0
}

validate_requirements() {
    if [[ -z "$RESOURCE_GROUP" ]]; then
        echo "Error: Resource group is required" >&2
        exit 1
    fi
}

main() {
    validate_requirements

    TEMP_DIR="$(mktemp -d)"
    if [[ ! -d "$TEMP_DIR" ]]; then
        echo "Error: failed to create temporary directory" >&2
        exit 1
    fi

    echo "============================================================================"
    echo "Script Execution Started"
    echo "============================================================================"

    # Main logic here

    echo "============================================================================"
    echo "Script Execution Completed"
    echo "============================================================================"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Execute main function
main "$@"
```

## Error Handling Patterns

### Why `set -euo pipefail`

- `-e`: exit immediately on any command failure
- `-u`: treat unset variables as errors (prevents silent `""` expansions)
- `-o pipefail`: the exit status of a pipeline is the status of the last command that failed

Without these, many errors are silently swallowed.

### `trap` Usage

Always clean up temporary resources:

```bash
cleanup() {
    [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]] && rm -rf "$TEMP_DIR"
}
trap cleanup EXIT
```

`EXIT` fires on any exit — success, error, or signal. Prefer `EXIT` over `ERR` + `INT` individually.

### `readonly` for Constants

```bash
readonly SCRIPT_NAME="$(basename "$0")"
readonly MAX_RETRIES=3
```

Prevents accidental reassignment. Use `declare -r` if you need to declare before assignment.

## JSON/YAML Parsing

### `jq` Examples

```bash
# Extract a field; fail if missing
value=$(jq -r '.key // empty' file.json)
[[ -n "$value" ]] || { echo "Error: missing key" >&2; exit 1; }

# Iterate over array
jq -r '.items[]' file.json | while IFS= read -r item; do
    echo "Processing: $item"
done

# Check exit status explicitly
if ! result=$(jq -r '.status' file.json 2>/dev/null); then
    echo "Error: failed to parse JSON" >&2
    exit 1
fi
```

### `yq` Examples

```bash
# Extract from YAML
name=$(yq '.metadata.name' config.yaml)

# Convert YAML to JSON, then use jq
jq -r '.key' <(yq -o=json config.yaml)
```

### Dependency Check Pattern

```bash
check_dependencies() {
    local missing=()
    for cmd in jq curl git; do
        command -v "$cmd" &>/dev/null || missing+=("$cmd")
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Error: required tools not found: ${missing[*]}" >&2
        exit 1
    fi
}
```

## Variable and Quoting Best Practices

```bash
# Good: double-quoted, braces for clarity
echo "Processing file: ${file_path}"
echo "Count: ${#items[@]}"

# Risky: unquoted, subject to word splitting and globbing
echo Processing file: $file_path

# Bad: eval with untrusted input
eval "$user_input"  # never do this

# Safe alternative to eval for dynamic variable names
declare -n ref="$var_name"
echo "$ref"
```

## POSIX vs Bash

Use modern Bash features when portability is not required:

| Feature | Bash | POSIX equivalent |
|---------|------|-----------------|
| Conditionals | `[[ -f "$f" ]]` | `[ -f "$f" ]` |
| String comparison | `[[ "$a" == "$b" ]]` | `[ "$a" = "$b" ]` |
| Arithmetic | `(( count++ ))` | `count=$((count + 1))` |
| Arrays | `arr=("a" "b")` | Not available |
| Local variables | `local var` | Not available |
| Process substitution | `<(command)` | Not available |

When targeting `/bin/sh` or environments without Bash, fall back to POSIX constructs.

## Common Patterns

### Retry Loop

```bash
retry() {
    local n=0
    local max="${1}"; shift
    local delay="${1}"; shift
    until "$@"; do
        n=$((n + 1))
        if [[ $n -ge $max ]]; then
            echo "Error: command failed after $max attempts" >&2
            return 1
        fi
        echo "Retry $n/$max in ${delay}s..." >&2
        sleep "$delay"
    done
}

# Usage: retry 3 5 curl -sf "https://example.com"
```

### Logging with Levels

```bash
log_info()  { echo "[INFO]  $(date -Iseconds) $*"; }
log_warn()  { echo "[WARN]  $(date -Iseconds) $*" >&2; }
log_error() { echo "[ERROR] $(date -Iseconds) $*" >&2; }
```

### Checking Required Environment Variables

```bash
require_env() {
    local missing=()
    for var in "$@"; do
        [[ -n "${!var:-}" ]] || missing+=("$var")
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "Error: required environment variables not set: ${missing[*]}" >&2
        exit 1
    fi
}

# Usage: require_env AWS_REGION AWS_ACCOUNT_ID
```
