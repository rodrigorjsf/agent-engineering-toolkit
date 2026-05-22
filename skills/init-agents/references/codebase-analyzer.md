# Codebase Analysis Instructions
Structured process for detecting project tech stack, tooling, and non-standard patterns.
Used by INIT and IMPROVE skills for codebase analysis.
---

Follow these codebase analysis instructions. Analyze the project at the current working directory and return a structured summary of its technical characteristics. Focus on facts that would cause mistakes if an AI coding agent didn't know them.

Use your environment's file reading and search capabilities to examine the project.

## Contents

- Constraints (what NOT to include in analysis)
- Process (project detection, package manager, build/test/lint, tech stack, non-standard patterns)
- Output format (structured template for analysis results)
- Self-verification (quality checks before returning)

---

## Constraints

- Do not generate codebase overviews or directory listings — research shows these don't help agents navigate
- Do not document obvious conventions the model already knows (e.g., standard JavaScript patterns)
- Only report non-standard, non-obvious, or project-specific information
- Shorter output is better — omit sections with nothing non-standard to report

## Process

### 1. Project Detection

Search for configuration files to determine the project type:

```
Look for: package.json, Cargo.toml, go.mod, pyproject.toml, setup.py, requirements.txt,
pom.xml, build.gradle, Gemfile, composer.json, mix.exs, CMakeLists.txt, Makefile,
*.csproj, *.sln, deno.json, bun.lockb
```

### 2. Package Manager Detection

Identify the package manager by checking for lock files:

| Lock File | Package Manager |
|-----------|----------------|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |
| `bun.lockb` | bun |
| `Cargo.lock` | cargo |
| `go.sum` | go modules |
| `poetry.lock` | poetry |
| `uv.lock` | uv |
| `Pipfile.lock` | pipenv |
| `Gemfile.lock` | bundler |
| `composer.lock` | composer |

Only report if non-default (e.g., pnpm instead of npm for JS projects).

### 3. Build/Test/Lint Commands

Extract commands from configuration files:

- **package.json**: Read `scripts` section for build, test, lint, typecheck, dev commands
- **Makefile**: Read target names
- **pyproject.toml**: Read `[tool.pytest]`, `[tool.ruff]`, `[tool.mypy]`, `[scripts]` sections. Also extract non-standard configuration values (e.g., `addopts = "--cov=src"` in pytest, `strict = true` in mypy, `line-length` override in ruff).
- **Cargo.toml**: Check for workspace configuration

Only report non-standard commands. Don't report `npm test` if that's the standard.

### 4. Tech Stack Detection

Identify key frameworks and tools by checking dependencies:

- Frameworks: React, Next.js, Vue, Angular, Express, FastAPI, Django, Rails, etc.
- Databases: Check for ORM configs (Prisma, TypeORM, SQLAlchemy, etc.). Also check for migration tools: `alembic.ini`, `alembic/env.py`, `alembic/versions/` (Alembic), `schema.prisma` (Prisma Migrate), Flyway/Liquibase config. Report the migration run command (e.g., `alembic upgrade head`, `prisma migrate deploy`) as non-standard.
- Testing: Jest, Vitest, pytest, Go test, RSpec, etc.
- Linting: ESLint, Prettier, Ruff, clippy, etc.
- CI/CD: Check `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`

### 5. Non-Standard Patterns

Look for anything unusual that would trip up an agent:

- Custom build scripts or tooling
- Monorepo tools (Turborepo, Nx, Lerna, etc.)
- Cross-scope build chains or ordering requirements (e.g., generated artifacts or WASM packages that must build before another scope)
- Code generation (protobuf, GraphQL codegen, etc.)
- Environment setup requirements (.env files, Docker, etc.)
- Migration workflows that live in app-specific directories rather than a root config file
- Repository-specific tools mentioned in existing documentation


---

## Output Format

Return your analysis in exactly this format:

```
## Codebase Analysis Results

### Project Type
- Language: [primary language]
- Framework: [if applicable]
- Type: [application | library | monorepo | CLI tool | API | etc.]

### Tooling (non-standard only)
- Package manager: [only if non-default]
- Build: `[command]`
- Test: `[command]`
- Lint: `[command]`
- Typecheck: `[command]`
- Dev server: `[command]`
- Config: `[tool] [key] = [value]` (only non-default configuration values)
- Migrate: `[command]` (only if a migration tool is present)

### Tech Stack
- [Only list items that are non-obvious from the language/framework]

### Non-Standard Patterns
- [List anything unusual that would cause agent mistakes]

### Domain Concepts
- [Key domain terms that differ from common usage, if any]
```

If a section has nothing non-standard to report, omit it entirely. Shorter is better.


---

## Self-Verification

Before returning results, verify:

1. Every reported item is genuinely non-standard — would an experienced developer consider this worth noting?
2. No directory listings or file structure descriptions crept in
3. Output follows the exact format specified above
4. Sections with no findings are omitted, not left empty

