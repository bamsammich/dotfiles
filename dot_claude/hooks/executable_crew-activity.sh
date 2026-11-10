#!/usr/bin/env bash
# crew activity hook. Only acts when Claude runs inside a Herdr terminal
# (HC_TERMINAL_ID set); everywhere else it exits at once.
# 1. Prints an OSC 7501 status record to Claude's terminal, so Herdr lists
#    the orchestrating Claude as an agent: working, idle or blocked.
# 2. Writes ~/.local/state/crew/orchestrators/<terminal>.json with what Claude
#    is doing now and which subagents are out, for the crew board.
# 3. On stop, keeps an orchestrator working: if children of its parents wait on
#    Claude and nothing is in flight, the stop is blocked with what's left.
#    After three blocks with no progress it lets Claude stop and marks it stuck.
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
  notify)
    # Only a permission prompt stops Claude; the 60-second idle reminder
    # ("waiting for your input") is not a request.
    doing="$(jq -r '.message // ""' <<<"$payload" 2>/dev/null)"
    case "$doing" in *ermission*|*approve*|*allow*) state=blocked ;; *) exit 0 ;; esac ;;
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
  "\$c + {terminal: \$term, cwd: \$cwd, state: \$state, doing: \$doing, ts: \$now, agents: ($agents_js)}" \
  >"$f.tmp" 2>/dev/null && mv "$f.tmp" "$f"

# ---- stop guard and last message
if [ "$event" = stop ]; then
  last="$(jq -r '.last_assistant_message // ""' <<<"$payload" 2>/dev/null | tail -c 1500)"
  crew="$HOME/.claude/skills/linear-build/bin/crew"
  owed="$("$crew" owed "$HC_TERMINAL_ID" 2>/dev/null || echo '{}')"
  n_owed="$(jq '.owed | length' <<<"$owed" 2>/dev/null || echo 0)"
  n_flight="$(jq '.in_flight | length' <<<"$owed" 2>/dev/null || echo 0)"
  n_agents="$(jq '.agents | length' "$f" 2>/dev/null || echo 0)"
  sig="$(jq -c '[.owed[] | "\(.issue):\(.stage):\(.note)"]' <<<"$owed" 2>/dev/null)"
  prev_sig="$(jq -r '.guard.sig // ""' "$f" 2>/dev/null)"
  blocks="$(jq -r '.guard.blocks // 0' "$f" 2>/dev/null)"
  [ "$sig" = "$prev_sig" ] || blocks=0
  if [ "${n_owed:-0}" -gt 0 ] && [ "${n_flight:-0}" -eq 0 ] && [ "${n_agents:-0}" -eq 0 ] && [ "$blocks" -lt 3 ]; then
    blocks=$((blocks + 1))
    reason="You are this parent's orchestrator, running unattended. Children still wait on you: $(jq -r '[.owed[] | "\(.issue) (\(.stage): \(.note))"] | join("; ")' <<<"$owed"). Keep going until every child is at a PR or escalated with crew ask --auto. Do not ask the user for permission to continue."
    jq --arg sig "$sig" --argjson b "$blocks" --arg last "$last" --arg now "$now" \
      '.guard = {sig: $sig, blocks: $b} | .last_message = $last | .state = "working" | .doing = "Continuing unattended work" | .ts = $now' "$f" >"$f.tmp" && mv "$f.tmp" "$f"
    jq -n --arg r "$reason" '{decision: "block", reason: $r}'
    exit 0
  fi
  stuck=false; [ "${n_owed:-0}" -gt 0 ] && [ "${n_flight:-0}" -eq 0 ] && [ "${n_agents:-0}" -eq 0 ] && stuck=true
  asks=false; printf '%s' "$last" | tail -c 400 | grep -q '?' && asks=true
  jq --arg sig "$sig" --argjson b "$blocks" --arg last "$last" --argjson stuck "$stuck" --argjson asks "$asks" \
    '.guard = {sig: $sig, blocks: $b} | .last_message = $last | .stuck = $stuck | .asks = $asks' "$f" >"$f.tmp" && mv "$f.tmp" "$f"
elif [ "$event" = prompt ]; then
  jq '.stuck = false | .asks = false | .guard.blocks = 0' "$f" >"$f.tmp" 2>/dev/null && mv "$f.tmp" "$f"
fi

msg="$(printf '%s' "$doing" | tr -cd '[:alnum:] ._/,()-' | cut -c1-80)"
{ printf '\033]7501;state=%s:app=claude-code:msg=%s\033\\' "$state" "$msg" >/dev/tty; } 2>/dev/null || true
exit 0
