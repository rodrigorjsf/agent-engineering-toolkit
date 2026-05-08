---
applyTo: '.github/workflows/*.yml,.github/workflows/*.yaml'
description: 'Comprehensive guide for building robust, secure, and efficient CI/CD pipelines using GitHub Actions. Covers workflow structure, jobs, steps, environment variables, secret management, caching, matrix strategies, testing, and deployment strategies.'
---

# GitHub Actions CI/CD Best Practices

## Workflow Structure

- Use descriptive `name` and appropriate `on` triggers with branch/path filters.
- Set `concurrency` for critical workflows to prevent race conditions.
- Define `permissions` at workflow level with least-privilege defaults; override per job.
- Use `workflow_call` for reusable common CI/CD patterns.

## Jobs and Steps

- Jobs represent distinct phases (`build`, `lint`, `test`, `deploy`).
- Use `needs` for job dependencies; use `outputs` for inter-job data.
- Use `if` conditions for conditional execution (branch, event type, prior job status).
- Pin ALL `uses` actions to a full commit SHA with a version comment: `uses: actions/checkout@<SHA> # v4.3.1`. Tags (`@v4`) and branches (`@main`) are mutable and can be silently redirected to malicious commits.
- Set `timeout-minutes` for long-running jobs.
- Never hardcode sensitive data in `env` at any scope.

## Security

- Store all secrets in GitHub Secrets; access via `${{ secrets.NAME }}` only.
- Use OIDC for cloud authentication (AWS, Azure, GCP) — eliminates long-lived credentials.
- Set `GITHUB_TOKEN` to `contents: read` by default; grant write only where required.
- Integrate `dependency-review-action` or SCA tool (Snyk, Trivy) to scan dependencies.
- Integrate SAST tools (CodeQL, SonarQube); block builds on critical findings.
- Enable GitHub secret scanning; suggest pre-commit hooks for local credential prevention.
- Sign container images (Notary, Cosign); enforce signature verification in deployment workflows.
- For self-hosted runners: harden machines, restrict network access, audit regularly.

## Performance and Caching

- Use `actions/cache` (pinned SHA) with `hashFiles()`-based keys for dependencies.
- Use `restore-keys` for fallback cache hits.
- Use `strategy.matrix` to parallelize tests across OS, language versions, browsers.
- Use `fetch-depth: 1` for checkout unless full Git history is required.
- Set `retention-days` on artifacts; prefer artifact transfer over re-building.

## Testing Strategy

- Unit tests: dedicated early job, code coverage enforced with a minimum threshold.
- Integration tests: use `services` for database/queue/cache containers; run after unit tests.
- E2E tests: use Cypress/Playwright against staging; capture screenshots on failure.
- Performance tests: define response-time/error-rate thresholds; break build if exceeded.
- Publish test reports as artifacts and integrate with GitHub Checks/Annotations.

## Deployment

- Use GitHub `environment` with approval rules for staging and production.
- Require manual approval for production deployments.
- Implement rollback: store versioned artifacts, automate `kubectl rollout undo` or equivalent.
- Use blue/green or canary strategies for zero-downtime / controlled rollouts.
- Run post-deployment smoke tests; trigger rollback automatically on health-check failure.
- Configure alerting for critical workflow failures and production anomalies.

For deep guidance, see [docs/agents/github-actions-ci-cd-reference.md](../../docs/agents/github-actions-ci-cd-reference.md).
