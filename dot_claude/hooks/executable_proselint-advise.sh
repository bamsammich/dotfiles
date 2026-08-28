#!/bin/sh
# PostToolUse on Write|Edit: report AI-tell defects in prose files. Advisory only.
#
# Never blocks. proselint's gateable checks still fail 13% of prose the reader
# scored 5, so a gate would stop good writing one time in eight. It reports, and
# the agent decides.
#
# Only .md, .txt, and .rst are checked. Source files carry identifiers and
# symbols that the prose heuristics misread.
set -e
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
LINTER="$CLAUDE_DIR/hooks/proselint.py"

[ -f "$CLAUDE_DIR/.prose-rules-off" ] && exit 0
[ -f "$LINTER" ] || exit 0
command -v python3 >/dev/null 2>&1 || exit 0

# The hook receives the tool payload on stdin. Pull the path without needing jq.
PAYLOAD=$(cat)
FILE=$(printf '%s' "$PAYLOAD" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
i = d.get("tool_input") or {}
print(i.get("file_path") or i.get("notebook_path") or "")
' 2>/dev/null) || exit 0

case "$FILE" in
  *.md|*.txt|*.rst) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0

# Skip machine-written files that would fire on every save.
case "$FILE" in
  */CHANGELOG.md|*/node_modules/*|*/.git/*) exit 0 ;;
esac

OUT=$(python3 "$LINTER" "$FILE" --quiet 2>/dev/null) || {
  printf 'PROSE CHECK on %s\n%s\n\nAdvisory. Fix what applies and move on.\n' "$FILE" "$OUT"
  exit 0
}
exit 0
