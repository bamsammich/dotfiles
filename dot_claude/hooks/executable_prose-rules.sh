#!/bin/sh
# UserPromptSubmit hook: re-injects the prose card on every turn, so the rules
# sit next to the prompt instead of decaying from the SessionStart injection.
# Never blocks a prompt.
set -e
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CARD="$CLAUDE_DIR/hooks/prose-rules.md"

# Session-level off switch. Claude creates this when told "stop slop mode off";
# delete it to turn the rules back on.
[ -f "$CLAUDE_DIR/.prose-rules-off" ] && exit 0

# Only fire when the always-on flag is set.
[ -f "$CLAUDE_DIR/.stop-slop-always" ] || exit 0
[ -f "$CARD" ] || exit 0

cat "$CARD"
