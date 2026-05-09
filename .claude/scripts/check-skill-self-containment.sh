#!/usr/bin/env bash
# .claude/scripts/check-skill-self-containment.sh
#
# Enforces .claude/rules/skill-self-containment.md: skill bodies and references/
# may not link to .claude/rules/*.md, docs/adr/*.md, wiki/knowledge/*.md, or use
# [[wiki-link]] syntax. Inline constraint content; the skill is a unit of
# distribution.
#
# Usage:
#   bash .claude/scripts/check-skill-self-containment.sh             # full repo
#   bash .claude/scripts/check-skill-self-containment.sh <file>...   # specific files
#
# Exit codes:
#   0 — clean (no violations)
#   1 — violations found (printed to stderr in `path:line:match` form)
#
# False positives:
#   Skills that legitimately teach about .claude/rules/ or [[wiki-link]] as
#   their domain (rule-authoring skills, wiki-lint, wiki-ingest) will appear in
#   the raw output. Reviewers reclassify those as domain content. The script
#   surfaces candidates; classification is human work.

set -euo pipefail

# Paths inside skills that the rule covers.
SKILL_PATHS=(
  ".claude/skills/*/SKILL.md"
  ".claude/skills/*/references/"
  ".claude/skills/*/assets/"
  "plugins/*/skills/*/SKILL.md"
  "plugins/*/skills/*/references/"
  "plugins/*/skills/*/assets/"
  "skills/*/SKILL.md"
  "skills/*/references/"
  "skills/*/assets/"
)

# Patterns that signal a cross-skill-boundary reference.
PATTERN='\.claude/rules/[a-z0-9-]+\.md|docs/adr/[0-9]+|wiki/knowledge/|\[\[[a-z]'

found=0

if [ "$#" -gt 0 ]; then
  # Targeted mode: caller supplies file list (e.g., from a hook receiving
  # a list of just-edited files). Filter to in-scope paths.
  for f in "$@"; do
    case "$f" in
      .claude/skills/*/SKILL.md|plugins/*/skills/*/SKILL.md|skills/*/SKILL.md|\
      .claude/skills/*/references/*|plugins/*/skills/*/references/*|skills/*/references/*|\
      .claude/skills/*/assets/*|plugins/*/skills/*/assets/*|skills/*/assets/*)
        if [ -f "$f" ] && grep -nE "$PATTERN" "$f" >&2 2>/dev/null; then
          found=1
        fi
        ;;
    esac
  done
else
  # Full-repo scan.
  for path_glob in "${SKILL_PATHS[@]}"; do
    if compgen -G "$path_glob" > /dev/null; then
      # shellcheck disable=SC2086
      if grep -rnE "$PATTERN" $path_glob 2>/dev/null | grep -v "Binary file" >&2; then
        found=1
      fi
    fi
  done
fi

if [ "$found" -ne 0 ]; then
  cat >&2 <<EOF

ERROR: skill-self-containment violations detected.
See .claude/rules/skill-self-containment.md for the rule.
Inline the constraint content into the skill instead of linking to the
canonical repo-level artifact.

Domain-content false positives (skills that teach about the matched
artifact type — e.g., wiki-lint, wiki-ingest, rule-authoring skills) are
acceptable; reviewers must reclassify each match.
EOF
  exit 1
fi

echo "skill-self-containment: clean"
