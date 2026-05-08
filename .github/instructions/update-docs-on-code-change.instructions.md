---
description: 'Automatically update README.md and documentation files when application code changes require documentation updates'
applyTo: '**/*.{md,js,mjs,cjs,ts,tsx,jsx,py,java,cs,go,rb,php,rs,cpp,c,h,hpp}'
---

# Update Documentation on Code Change

## When to Update Documentation

Update documentation whenever:

- New features or functionality are added
- API endpoints, methods, or interfaces change
- Breaking changes are introduced
- Dependencies or requirements change
- Configuration options or environment variables are modified
- Installation or setup procedures change
- CLI commands or scripts are updated
- Code examples in documentation become outdated

## README.md Rules

- Add new features to the "Features" section with usage examples; update table of contents.
- Update "Installation" / "Getting Started" when setup or prerequisites change.
- Document new CLI commands: syntax, options, default values, examples.
- Update configuration examples when config options or environment variables change.

## API Documentation Rules

- Document new endpoints: HTTP method, path, parameters, request/response examples, OpenAPI/Swagger spec.
- Update parameter lists, response schemas, and breaking-change notes when endpoint signatures change.
- Revise authentication examples and security requirements when auth/authz changes.

## Code Examples

- Update all doc snippets when function signatures change; verify examples still compile/run.
- Revise example requests, responses, and SDK usage when API interfaces change.
- Replace outdated patterns and add deprecation notices for old approaches.

## Configuration Documentation

- Add new environment variables to `.env.example` and `docs/configuration.md` with defaults and descriptions.
- Update example config files and mark deprecated options when config file structure changes.
- Revise Docker/Kubernetes configs and deployment guides when infrastructure changes.

## Breaking Changes and Migrations

- Create a migration guide for every breaking API change: what changed, before/after examples, step-by-step instructions.
- List all breaking changes and provide an upgrade checklist for major version bumps.
- Mark deprecated features clearly; suggest alternatives; include removal timeline.

## Changelog

- Add entries for every user-facing change under `Added`, `Changed` (**BREAKING** prefix for breaking), `Fixed`, `Deprecated`, `Removed`, `Security`.
- Use format: `## [Version] - YYYY-MM-DD` with subsections per change type.

## Quality Standards

- Use clear, concise language; consistent terminology.
- Include working, tested code examples (basic and advanced).
- Document edge cases, limitations, and error-handling patterns.
- Keep documentation DRY — link instead of duplicating.

## Verification Checklist

- [ ] All new public APIs are documented
- [ ] Code examples compile and run
- [ ] Links are valid (no broken internal/external links)
- [ ] Configuration examples match current code
- [ ] Installation steps are current
- [ ] README.md reflects current project state
- [ ] Breaking changes have a migration guide
- [ ] CHANGELOG.md is updated
- [ ] Environment variables documented with defaults

## Best Practices

- Update documentation in the same commit as code changes.
- Test code examples before committing.
- Document limitations and edge cases.
- Run `docs:lint`, `docs:links`, and `docs:test-examples` as pre-commit checks when available.
- Review documentation during code review: verify accuracy, completeness, no undocumented breaking changes.

For deep guidance, see [docs/agents/update-docs-on-code-change-reference.md](../../docs/agents/update-docs-on-code-change-reference.md).
