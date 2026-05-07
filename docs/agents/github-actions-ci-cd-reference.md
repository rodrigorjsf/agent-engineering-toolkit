Detailed reference for [.github/instructions/github-actions-ci-cd-best-practices.instructions.md](../../.github/instructions/github-actions-ci-cd-best-practices.instructions.md). Core file holds the authoritative checklist; this file holds the supporting depth.

# GitHub Actions CI/CD — Deep Reference

## Workflow Structure

**Triggers (`on`):** Full range includes `push`, `pull_request`, `workflow_dispatch` (manual with inputs), `schedule` (cron), `repository_dispatch` (external), `workflow_call` (reusable).

**Concurrency:** Prevents simultaneous runs for specific branch/group, avoiding resource contention.

**Permissions:** Define at workflow level, override at job level. `contents: read` as baseline.

**Reusable workflows:** Use `workflow_call` to abstract common patterns across multiple projects, reducing duplication.

## Jobs

**`runs-on`:** `ubuntu-latest` covers most cases. Use `windows-latest`, `macos-latest`, or `self-hosted` for specific needs.

**`needs` + `outputs`:** Job B runs only after Job A completes. Use `outputs` to pass build paths, image digests, etc.

**Example — conditional deployment with output passing:**
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      artifact_path: ${{ steps.package_app.outputs.path }}
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - name: Package application
        id: package_app
        run: |
          zip -r dist.zip dist
          echo "path=dist.zip" >> "$GITHUB_OUTPUT"
      - uses: actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f # v7.0.0
        with:
          name: my-app-build
          path: dist.zip

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main'
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
        with:
          name: my-app-build
```

## Steps and Actions — SHA Pinning

Tags (e.g., `@v4`) and branches (e.g., `@main`) are mutable references. A malicious actor who gains write access to an action repository can silently move a tag to a compromised commit, executing arbitrary code in your workflow (supply chain attack). A commit SHA is immutable. Always add the version as a comment for readability:

```
uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
```

Use `dependabot` for action version updates. Audit marketplace actions before use; prefer actions from the `actions/` organization.

## Security Deep Dives

### Secret Management

- GitHub Secrets are encrypted at rest and only decrypted on the runner.
- Use environment-specific secrets for deployment environments (enforces approval gates).
- Never construct secrets dynamically or print them to logs.

**Example — environment secrets with approval:**
```yaml
jobs:
  deploy:
    environment:
      name: production
      url: https://prod.example.com
    steps:
      - name: Deploy to production
        env:
          PROD_API_KEY: ${{ secrets.PROD_API_KEY }}
        run: ./deploy-script.sh
```

### OIDC for Cloud Authentication

OIDC exchanges a JWT token for short-lived cloud credentials. Requires configuring trust policies in your cloud provider to trust GitHub's OIDC issuer.

- AWS: `aws-actions/configure-aws-credentials@<SHA>`
- Azure: configure federated credentials in Azure AD
- GCP: configure Workload Identity Federation

### Least Privilege for `GITHUB_TOKEN`

Common permission mappings:
- Reading code only: `contents: read`
- Updating PRs: `pull-requests: write`
- Publishing packages: `packages: write`
- Updating checks: `checks: write`

**Example:**
```yaml
permissions:
  contents: read
  pull-requests: write
  checks: write
jobs:
  lint:
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - run: npm run lint
```

### Dependency Review and SAST

- `dependency-review-action`: catches vulnerable dependencies on PRs.
- CodeQL: GitHub Advanced Security SAST; configure to block PRs on critical findings.
- Snyk/Trivy/Mend: alternative SCA tools.
- Pre-commit hooks: `git-secrets`, `detect-secrets`.

### Image Signing

- Use Cosign or Notary to cryptographically sign container images.
- Enforce that only signed images can be deployed to production.
- Ensure reproducible builds so the same code always produces the same image.

## Caching

**Advanced caching example for monorepos:**
```yaml
- name: Cache Node.js modules
  uses: actions/cache@668228422ae6a00e4ad889ee87cd7109ec5666a7 # v5.0.4
  with:
    path: |
      ~/.npm
      ./node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}-${{ github.run_id }}
    restore-keys: |
      ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}-
      ${{ runner.os }}-node-
```

Design keys to change only when dependencies actually change. Use `restore-keys` for fallback hits. Caches are scoped to repository and branch. Be aware of GitHub's per-repository cache size limits — eviction is automatic when limits are exceeded.

## Matrix Strategies

**Multi-version, multi-OS, multi-browser example:**
```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node-version: [16.x, 18.x, 20.x]
        browser: [chromium, firefox]
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: actions/setup-node@3235b876344d2a9aa001b8d1453c930bba69e610 # v3.9.1
        with:
          node-version: ${{ matrix.node-version }}
      - run: npx playwright install ${{ matrix.browser }}
      - run: npm test
```

Use `include`/`exclude` to fine-tune combinations. `fail-fast: true` (default) stops all matrix jobs on first failure; `fail-fast: false` runs all for full reporting.

## Self-Hosted Runners

When to use: specialized hardware (GPUs), access to on-premise resources, cost optimization for very high usage.

Security requirements: harden runner machines, manage network access and ACLs, patch promptly, use runner groups for access control, plan autoscaling.

## Checkout Optimization

- `fetch-depth: 1`: only latest commit, significantly faster for large repos.
- `fetch-depth: 0`: full history — only needed for release tagging, `git blame`, deep commit analysis.
- `submodules: false`: don't fetch submodules unless required.
- `lfs: false`: skip LFS unless the job uses binary assets.

## Artifacts

- Use `upload-artifact` / `download-artifact` (pinned SHAs) to pass build outputs between jobs.
- Set `retention-days` to manage storage costs and compliance requirements.
- Upload test reports, coverage reports, security scan results as artifacts for historical analysis.
- Artifacts are immutable once uploaded. Max size per artifact is several gigabytes.

## Testing — Deeper Patterns

### Integration Tests

Use `services` for dependencies:
```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
```

Plan test data management: ensure tests are repeatable and data is cleaned up between runs.

### E2E Tests

- Run against a deployed staging environment for maximum fidelity.
- Capture screenshots and video recordings on failure.
- Use stable selectors (`data-testid`) not CSS classes or XPath.
- Implement retries for transient failures.

### Performance Tests

Tools: JMeter, k6, Locust, Gatling, Artillery. Run nightly or on significant feature merges. Define clear thresholds (response time, throughput, error rates); fail builds on regression. Compare metrics against established baselines.

## Deployment Strategies

**Rolling update:** Gradually replaces old instances with new. Configure `maxSurge` and `maxUnavailable` for fine-grained control.

**Blue/Green:** Deploy new version (green) alongside stable (blue); switch traffic at once. Enables instantaneous rollback by reversing traffic. Requires managing two identical environments plus a load balancer or Ingress controller.

**Canary:** Route 5-10% of traffic to new version; monitor error/latency metrics; expand or rollback. Use Service Mesh (Istio, Linkerd) or Ingress controllers with traffic splitting.

**Dark Launch / Feature Flags:** Deploy code; keep features hidden behind flags. Decouples deployment from release. Use LaunchDarkly, Split.io, or Unleash.

**A/B Testing:** Route different user segments to different versions for behavioral metric comparison.

## Rollback Strategies

- Store versioned artifacts and Docker images so previous stable versions are always deployable.
- Implement automated rollback triggered by monitoring alerts (error rate spike, high latency) or failed health checks.
- Document runbooks: step-by-step rollback instructions, tested regularly.
- Conduct blameless post-incident reviews (PIRs) after any production failure.
- `kubectl rollout undo deployment/<name>` for Kubernetes workloads.

## Troubleshooting

### Workflow Not Triggering

- Verify `on` block matches the event exactly.
- Check `branches`, `tags`, `paths` filters — `paths-ignore` and `branches-ignore` take precedence.
- Review `if` conditions at workflow, job, and step levels — add a debug step with `always()` to print `${{ toJson(github) }}`.
- Check `concurrency` tab for blocked runs.
- Verify branch protection rules.

### Permission Errors

- `Resource not accessible by integration`: `GITHUB_TOKEN` lacks required permissions.
- Check `permissions` block at both workflow and job levels.
- For environment secrets: verify the job uses the correct `environment` name and approvals are not pending.
- For OIDC: verify trust policy in cloud provider trusts GitHub's OIDC issuer (`token.actions.githubusercontent.com`).

### Cache Issues

- `Cache miss`: key is too dynamic (changes every run). Use `hashFiles()` on lockfiles only.
- Verify `path` matches where dependencies are actually installed.
- Use `actions/cache/restore` with `lookup-only: true` to inspect keys without affecting builds.
- Be aware of per-repo cache size limits; large caches are evicted automatically.

### Long Workflows / Timeouts

- Profile with workflow run summary to find slowest jobs/steps.
- Combine `run` commands with `&&` to reduce overhead.
- Ensure `actions/cache` covers all significant dependencies.
- Parallelize with `strategy.matrix`.
- Consider larger GitHub-hosted runners or self-hosted runners for resource-intensive tasks.

### Flaky Tests

- Ensure test isolation: no state shared between tests.
- Use explicit waits (not `sleep`) in E2E tests.
- Standardize environments: match Node/Python/DB versions between local and CI.
- Use stable selectors in E2E tests.
- Capture screenshots and video on failure for diagnosis.

### Deployment Failures

- Review deployment and application logs immediately.
- Validate all env vars, ConfigMaps, Secrets in the deployed environment.
- Confirm runtime dependencies are bundled in the container image.
- Check network connectivity (firewall rules, security groups, Kubernetes network policies).
- Run post-deployment health checks; roll back immediately if they fail.
