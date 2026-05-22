# Scope Detection Instructions
Structured process for identifying distinct project contexts that need separate configuration files.
Used by INIT skills for scope detection.
---

Follow these scope detection instructions. Identify distinct contexts within the project at the current working directory that would benefit from their own configuration file (AGENTS.md or CLAUDE.md). Each scope represents an area where an agent needs different guidance than the root-level instructions.

Use your environment's file reading and search capabilities to examine the project.

## Contents

- Constraints (minimum scopes, meaningful differences only)
- When a directory deserves its own scope (criterion table)
- Process (monorepo check, package boundaries, domain boundaries, scope content)
- Output format (structured template for scope results)
- Self-verification (quality checks before returning)

---

## Constraints

- Do not create a scope for every directory — only for truly distinct contexts
- A scope needs its own file only if it has different tooling, conventions, or domain knowledge from the root
- Single-package projects may have zero additional scopes (root file is sufficient)
- Aim for the minimum number of scopes that captures meaningful differences

## When a Directory Deserves Its Own Scope

A directory is a distinct scope if ANY of these are true:

| Criterion | Example |
|-----------|---------|
| Different tech stack | Frontend (React) vs Backend (Express) in a monorepo |
| Different build/test commands | `packages/api` uses `jest`, `packages/web` uses `vitest` |
| Different language | Go service alongside a TypeScript frontend |
| Different deployment target | Lambda functions vs Docker containers |
| Independent package with own dependencies | Monorepo package with own `package.json` |
| Distinct domain with specialized conventions | Database migration scripts with specific ordering rules |
| Unique constraints on a shared package | Zero-dependency rule, dual exports, conditional imports, `server-only` marker |
| Security-sensitive data handling | Package that handles encryption, PII, or cross-schema access control |

A directory is NOT a distinct scope if:

- It merely organizes code within the same tech stack
- Its conventions are identical to the root
- It has no independent tooling or commands
- It is a simple utility directory with no unique constraints
- It is a repo-internal `tools/` or shared-config package with no distinct developer workflow — handle it at root or in a domain doc instead

## Process

### 1. Check for Monorepo Structure

Look for:

- `workspaces` field in root `package.json`
- `pnpm-workspace.yaml`
- `lerna.json`
- `nx.json` or `project.json` files
- `turbo.json`
- `Cargo.toml` with `[workspace]`
- `go.work`
- Multiple `package.json` / `pyproject.toml` / `setup.py` / `requirements.txt` / `Cargo.toml` / `go.mod` files

### 2. Identify Package Boundaries

For each potential package/service:

- Read its manifest file (package.json, Cargo.toml, etc.)
- Check if it has its own build/test commands
- Determine its primary tech stack
- Note any unique dependencies or tooling
- Pay special attention to shared/library packages with their own manifest or unique constraints — they often deserve scopes even without a user-facing binary
- Treat Python service manifests (`pyproject.toml`, `setup.py`, `requirements.txt`) as package boundaries when they define an independent app or workflow inside a monorepo

### 3. Identify Domain Boundaries

Beyond packages, check for distinct domains:

- `scripts/` or `tools/` directories with their own execution environment — default these to root/domain-doc treatment unless they have genuinely different tooling or constraints
- `docs/` directories that may need documentation-specific guidance
- Infrastructure code (`terraform/`, `kubernetes/`, `docker/`) with different tooling
- Database-related directories (`migrations/`, `seeds/`) with ordering or naming conventions

### 4. Determine Scope-Specific Content

For each identified scope, determine what makes it different:

- What unique commands does this scope have?
- What conventions apply here but not elsewhere?
- What tech-specific knowledge would an agent need?


---

## Output Format

Return your analysis in exactly this format:

```
## Scope Detection Results

### Project Structure
- Type: [single-package | monorepo | multi-service | hybrid]
- Monorepo tool: [if applicable]

### Detected Scopes

#### Scope: [relative/path]
- Purpose: [one sentence]
- Tech: [primary technology if different from root]
- Commands: [scope-specific commands, if any]
- Key conventions: [only if different from root]
- Needs own config file: [yes/no with brief reason]

#### Scope: [relative/path]
...

### Recommended File Tree
- `./AGENTS.md` (root) — [one-line description of what goes here]
- `[path]/AGENTS.md` — [one-line description, only for scopes marked "yes"]
...

### Domain Files Recommended
- `docs/TESTING.md` — [only if non-standard testing patterns detected]
- `docs/BUILD.md` — [only if non-standard build pipeline detected]
...
```

If the project is a simple single-package project, report zero additional scopes — the root file is sufficient.


---

## Self-Verification

Before returning results, verify:

1. Every recommended scope has genuinely different tooling or conventions from root
2. No scopes were created just for organizational directories
3. The recommended file count is the minimum necessary
4. Simple projects correctly return zero additional scopes

