#!/bin/sh
# PostToolUse on Write|Edit: report prose defects and reread pointers in
# .md/.txt/.rst files. Advisory only; it never blocks.
#
# The report goes back as hookSpecificOutput.additionalContext. Plain stdout
# on PostToolUse is written to the debug log and never shown to the agent,
# which is why the earlier version of this hook was never seen.
set -e
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
[ -f "$CLAUDE_DIR/.prose-rules-off" ] && exit 0
command -v python3 >/dev/null 2>&1 || exit 0
exec python3 -I "$CLAUDE_DIR/hooks/prose-tripwire.py" post
