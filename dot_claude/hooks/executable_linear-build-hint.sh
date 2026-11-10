#!/usr/bin/env bash
# UserPromptSubmit hook: when a prompt names a Linear issue key from one of
# the user's teams, remind Claude that the linear-build skill exists.
conf="$HOME/.claude/skills/linear-build/config.json"
[ -f "$conf" ] || exit 0
keys="$(jq -r '.linear_team_keys | join("|")' "$conf" 2>/dev/null)"
[ -n "$keys" ] || exit 0
prompt="$(jq -r '.prompt // empty' 2>/dev/null)"
found="$(grep -Eo "\\b($keys)-[0-9]+\\b" <<<"$prompt" | sort -u | paste -sd, -)"
[ -n "$found" ] || exit 0
echo "Linear issue key(s) in this prompt: $found. If the user is asking you to work on, implement, build or finish these issues, follow the linear-build skill (load it with the Skill tool). If they are asking something else about the issues, ignore this note."
