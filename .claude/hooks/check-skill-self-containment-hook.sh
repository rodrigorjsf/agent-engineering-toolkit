#!/bin/bash
# Skill Self-Containment Hook
# Triggered on PostToolUse for Edit/Write/MultiEdit on skill internals.
# Enforces .claude/rules/skill-self-containment.md.
#
# Exits 2 (warning to agent) when the just-edited file contains cross-document
# links that violate self-containment. Agent sees stderr and corrects.
# Exits 0 silently when the edit is out of scope or clean.

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check mutating tools
case "$TOOL_NAME" in
  Edit|Write|MultiEdit) ;;
  *) exit 0 ;;
esac

[[ -z "$FILE_PATH" ]] && exit 0

# Resolve to repo-relative path. The hook runs from the project root.
REL_PATH="${FILE_PATH#$PWD/}"
REL_PATH="${REL_PATH#./}"

# Filter: only fire on skill internals (SKILL.md, references/**, assets/**
# under .claude/skills/, plugins/*/skills/, or skills/).
case "$REL_PATH" in
  .claude/skills/*/SKILL.md|.claude/skills/*/references/*|.claude/skills/*/assets/*) ;;
  plugins/*/skills/*/SKILL.md|plugins/*/skills/*/references/*|plugins/*/skills/*/assets/*) ;;
  skills/*/SKILL.md|skills/*/references/*|skills/*/assets/*) ;;
  *) exit 0 ;;
esac

# Run the canonical checker against this single file (targeted mode).
SCRIPT="$PWD/.claude/scripts/check-skill-self-containment.sh"
[[ -x "$SCRIPT" ]] || exit 0  # script absent → no-op (do not block on missing tool)

OUTPUT=$(bash "$SCRIPT" "$REL_PATH" 2>&1)
RC=$?

if [[ "$RC" -ne 0 ]]; then
  cat >&2 <<EOF
[skill-self-containment] $REL_PATH contains cross-document references that
violate .claude/rules/skill-self-containment.md.

$OUTPUT

Action: replace each external link with the inlined constraint content,
or reclassify the match as domain content if the skill's topic is the
artifact type whose path was matched (e.g., a rule-authoring skill
describing .claude/rules/, wiki-lint describing [[wiki-link]]).
EOF
  exit 2
fi

exit 0
