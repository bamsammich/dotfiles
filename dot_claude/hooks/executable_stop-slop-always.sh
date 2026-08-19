#!/bin/sh
# SessionStart hook: injects the stop-slop ruleset when the user has opted in
# by creating ~/.claude/.stop-slop-always. Never blocks session start.
set -e
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
FLAG="$CLAUDE_DIR/.stop-slop-always"
SKILL="$CLAUDE_DIR/skills/stop-slop/SKILL.md"
[ -f "$FLAG" ] || exit 0
[ -f "$SKILL" ] || exit 0
printf 'STOP-SLOP ACTIVE (always-on). Apply the ruleset below to all prose you write, every response. Full references live in %s/skills/stop-slop/references/ (phrases.md, structures.md, examples.md). Read them for a deep edit pass. "stop slop mode off" disables for this session; delete %s to disable permanently.\n\n' "$CLAUDE_DIR" "$FLAG"
awk 'NR==1 && $0!="---" {p=1} p {print; next} /^---$/ {n++; if(n==2){p=1}}' "$SKILL"
