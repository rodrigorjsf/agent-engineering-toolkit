Detailed reference for [.github/instructions/update-docs-on-code-change.instructions.md](../../.github/instructions/update-docs-on-code-change.instructions.md). Core file holds the authoritative checklist; this file holds the supporting depth.

# Update Docs on Code Change — Deep Reference

## Standard Documentation File Structure

Maintain these files and update as needed:

- **README.md** — project overview, quick start, basic usage
- **CHANGELOG.md** — version history and user-facing changes
- **docs/**
  - `installation.md` — setup and installation guide
  - `configuration.md` — configuration options and examples
  - `api.md` — API reference documentation
  - `contributing.md` — contribution guidelines
  - `migration-guides/` — version migration guides
- **examples/** — working code examples and tutorials

## Changelog Format

```markdown
## [Version] - YYYY-MM-DD

### Added
- New feature description with reference to PR/issue

### Changed
- **BREAKING**: Description of breaking change
- Other changes

### Fixed
- Bug fix description

### Deprecated
- Feature X is deprecated; use Y instead. Removal planned for v3.0.

### Security
- Patched CVE-XXXX-YYYY in dependency Z
```

## Code Example Format

```markdown
### Example: [Clear description of what example demonstrates]

\`\`\`language
// Include necessary imports/setup
import { myFunction } from 'package';

// Complete, runnable example
const result = myFunction(parameter);
console.log(result);
\`\`\`

**Output:**
\`\`\`
expected output
\`\`\`
```

## API Documentation Format

```markdown
### `functionName(param1, param2)`

Brief description of what the function does.

**Parameters:**
- `param1` (type): Description of parameter
- `param2` (type, optional): Description with default value

**Returns:**
- `type`: Description of return value

**Example:**
\`\`\`language
const result = functionName('value', 42);
\`\`\`

**Throws:**
- `ErrorType`: When and why error is thrown
```

## API Endpoint Documentation Template

```markdown
### `HTTP_METHOD /api/endpoint`

Description of what the endpoint does.

**Request:**
\`\`\`json
{
  "param": "value"
}
\`\`\`

**Response:**
\`\`\`json
{
  "result": "value"
}
\`\`\`

**Status Codes:**
- 200: Success
- 400: Bad request
- 401: Unauthorized
```

## Feature Documentation Template

```markdown
## Feature Name

Brief description of the feature.

### Usage

Basic usage example with code snippet.

### Configuration

Configuration options with examples.

### Advanced Usage

Complex scenarios and edge cases.

### Troubleshooting

Common issues and solutions.
```

## Automation and Tooling

### Documentation Generators

Use language-appropriate tools to auto-generate API reference documentation:

- **JavaScript/TypeScript:** JSDoc, TSDoc
- **Python:** Sphinx, pdoc
- **Java:** Javadoc
- **C#:** xmldoc
- **Go:** godoc
- **Rust:** rustdoc

### Documentation Linting Tools

- **Markdown linting:** `markdownlint`
- **Link checking:** `markdown-link-check`
- **Spell checking:** `cspell`
- **Code example validation:** custom test runner

### Validation Scripts

Example `package.json` scripts for documentation validation:

```json
{
  "scripts": {
    "docs:build": "Build documentation",
    "docs:test": "Test code examples in docs",
    "docs:lint": "Lint documentation files",
    "docs:links": "Check for broken links",
    "docs:spell": "Spell check documentation",
    "docs:validate": "Run all documentation checks"
  }
}
```

Example validation commands:
```bash
npm run docs:check          # Verify docs build
npm run docs:test-examples  # Test code examples
npm run docs:lint           # Check for issues
```

### Pre-commit Hooks

Add pre-commit checks for:
- Documentation build succeeds
- No broken links
- Code examples are valid
- Changelog entry exists for changes

## Maintenance Schedule

- **Monthly:** Review documentation for accuracy
- **Per release:** Update version numbers and examples
- **Quarterly:** Check for outdated patterns or deprecated features
- **Annually:** Comprehensive documentation audit

## Deprecation Process

1. Add deprecation notice to documentation
2. Update examples to use recommended alternatives
3. Create migration guide
4. Update changelog with deprecation notice
5. Set timeline for removal
6. In next major version: remove deprecated feature and all its docs

## Git / PR Integration

**Documentation must be updated in the same PR as code changes:**

- Document new features in the feature PR
- Update examples when code changes
- Add changelog entries with code changes
- Update API docs when interfaces change

**During code review, verify:**
- Documentation accurately describes the changes
- Examples are clear, complete, and tested
- No undocumented breaking changes
- Changelog entry is appropriate
- Migration guides are provided when needed

## Configurable Sections (Original Design)

The original instruction file used a configuration system where sections could be toggled on/off via boolean properties. The default configuration was:

| Property | Default | Description |
|---------|---------|-------------|
| apply-doc-file-structure | true | Consistent file structure |
| apply-doc-verification | true | Verify docs match code |
| apply-doc-quality-standard | true | Quality writing standards |
| apply-automation-tooling | true | Use doc generation tools |
| apply-doc-patterns | true | Templates and patterns |
| apply-best-practices | true | Best practice enforcement |
| apply-validation-commands | true | Run validation scripts |
| apply-maintenance-schedule | true | Periodic review schedule |
| apply-git-integration | false | Git/PR workflow integration |

All sections except `apply-git-integration` were enabled by default. The core instruction file now always applies all the rules that were previously togglable.
