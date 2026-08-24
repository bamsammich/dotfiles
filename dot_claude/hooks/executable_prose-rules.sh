#!/bin/sh
# UserPromptSubmit hook: re-injects a condensed merged stop-slop + i-have-adhd
# card on every turn, so the rules sit next to the prompt instead of decaying
# from the SessionStart injection. Never blocks a prompt.
set -e
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CARD="$CLAUDE_DIR/hooks/prose-rules.md"

# Session-level off switch. Claude creates this when told "stop adhd mode" or
# "stop slop mode off"; delete it to turn the rules back on.
[ -f "$CLAUDE_DIR/.prose-rules-off" ] && exit 0

# Only fire when at least one always-on flag is set.
[ -f "$CLAUDE_DIR/.stop-slop-always" ] || [ -f "$CLAUDE_DIR/.i-have-adhd-always" ] || exit 0
[ -f "$CARD" ] || exit 0

cat "$CARD"
