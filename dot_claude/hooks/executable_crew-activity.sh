#!/usr/bin/env bash
# crew activity hook. Only acts when Claude runs inside a Herdr terminal
# (HC_TERMINAL_ID set); everywhere else it exits at once.
# 1. Prints an OSC 7501 status record to Claude's terminal, so Herdr lists
#    the orchestrating Claude as an agent: working, idle or blocked.
# 2. Writes ~/.local/state/crew/orchestrators/<terminal>.json with what Claude
#    is doing now and which subagents are out, for the crew board.
[ -n "${HC_TERMINAL_ID:-}" ] || exit 0
event="${1:-}"
payload="$(cat)"
dir="$HOME/.local/state/crew/orchestrators"; mkdir -p "$dir"
f="$dir/${HC_TERMINAL_ID//\//_}.json"
now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cur="$(cat "$f" 2>/dev/null || echo '{}')"

state=working; doing=""
case "$event" in
  prompt) doing="Reading your message" ;;
  pretool)
    doing="$(jq -r '
      .tool_input as $i | .tool_name as $t |
      if ($t == "Agent" or $t == "Task") then "Started \($i.subagent_type // "subagent"): \($i.description // "")"
      elif $t == "Bash" then ($i.description // ($i.command | .[0:80]))
      elif ($t == "Edit" or $t == "Write" or $t == "MultiEdit") then "Editing \($i.file_path | split("/") | last)"
      elif $t == "Read" then "Reading \($i.file_path | split("/") | last)"
      elif ($t | startswith("mcp__")) then "Using \($t | split("__") | last)"
      else $t end' <<<"$payload" 2>/dev/null)" ;;
  subagent-stop) doing="A subagent finished" ;;
  notify) state=blocked; doing="$(jq -r '.message // "Needs your attention"' <<<"$payload" 2>/dev/null)" ;;
  stop) state=idle; doing="Waiting for you" ;;
  *) exit 0 ;;
esac

# Track subagents: started on Agent/Task calls, finished on SubagentStop.
agents_js='.agents // []'
if [ "$event" = pretool ] && jq -e '.tool_name == "Agent" or .tool_name == "Task"' <<<"$payload" >/dev/null 2>&1; then
  agents_js="(.agents // []) + [{type: \$p.tool_input.subagent_type, about: \$p.tool_input.description, since: \$now}]"
elif [ "$event" = subagent-stop ]; then
  agents_js='(.agents // [])[1:]'
elif [ "$event" = stop ] || [ "$event" = prompt ]; then
  # A turn that ends with no background work leaves no agents out.
  agents_js='if ($p.stop_hook_active // false) then (.agents // []) else (.agents // []) end'
fi
jq -n --argjson c "$cur" --argjson p "${payload:-{\}}" --arg now "$now" --arg state "$state" --arg doing "$doing" \
  --arg term "$HC_TERMINAL_ID" --arg cwd "$PWD" \
  "\$c | {terminal: \$term, cwd: \$cwd, state: \$state, doing: \$doing, ts: \$now, agents: ($agents_js)}" \
  >"$f.tmp" 2>/dev/null && mv "$f.tmp" "$f"

msg="$(printf '%s' "$doing" | tr -cd '[:alnum:] ._/,()-' | cut -c1-80)"
{ printf '\033]7501;state=%s:app=claude-code:msg=%s\033\\' "$state" "$msg" >/dev/tty; } 2>/dev/null || true
exit 0
