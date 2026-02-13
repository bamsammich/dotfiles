#!/usr/bin/env bash

# Read JSON input from stdin
input=$(cat)

# Extract values from JSON
cwd=$(echo "$input" | jq -r '.workspace.current_dir')
model=$(echo "$input" | jq -r '.model.display_name')
remaining=$(echo "$input" | jq -r '.context_window.remaining_percentage // empty')

# Calculate API cost (approximate rates for Claude models)
total_input=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
total_output=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')

# Approximate cost calculation (rates per million tokens)
# Sonnet: $3 input / $15 output per MTok
# Adjust based on model if needed
cost_input=$(echo "scale=4; $total_input * 3 / 1000000" | bc)
cost_output=$(echo "scale=4; $total_output * 15 / 1000000" | bc)
total_cost=$(echo "scale=2; $cost_input + $cost_output" | bc)

# Format cost display
api_cost=""
if [ "$total_input" -gt 0 ] || [ "$total_output" -gt 0 ]; then
  printf -v api_cost "| $%0.2f" "${total_cost}"
fi

# Git status (skip locks for speed)
git_info=""
display_path="$cwd"
is_git_repo=false
if git -C "$cwd" rev-parse --git-dir >/dev/null 2>&1; then
  is_git_repo=true
  # Get repo root and show path relative to it
  repo_root=$(git -C "$cwd" --no-optional-locks rev-parse --show-toplevel 2>/dev/null)
  repo_name=$(basename "$repo_root")
  rel_path=$(echo "$cwd" | sed "s|^$repo_root||")
  if [ -z "$rel_path" ]; then
    display_path="$repo_name"
  else
    display_path="$repo_name$rel_path"
  fi

  branch=$(git -C "$cwd" --no-optional-locks branch --show-current 2>/dev/null || echo "detached")

  # Check for changes
  changes=""
  if ! git -C "$cwd" --no-optional-locks diff --quiet 2>/dev/null ||
    ! git -C "$cwd" --no-optional-locks diff --cached --quiet 2>/dev/null; then
    changes="*"
  fi

  # Check ahead/behind
  ahead_behind=""
  upstream=$(git -C "$cwd" --no-optional-locks rev-parse --abbrev-ref @{upstream} 2>/dev/null)
  if [ -n "$upstream" ]; then
    ahead=$(git -C "$cwd" --no-optional-locks rev-list --count @{upstream}..HEAD 2>/dev/null || echo 0)
    behind=$(git -C "$cwd" --no-optional-locks rev-list --count HEAD..@{upstream} 2>/dev/null || echo 0)
    [ "$behind" -gt 0 ] && ahead_behind="${ahead_behind}⇣"
    [ "$ahead" -gt 0 ] && ahead_behind="${ahead_behind}⇡"
  fi

  git_info=" │  ${branch}${changes}${ahead_behind}"
fi

# Context window indicator
context_info=""
[ -n "$remaining" ] && context_info=" │ ${remaining}% left"

# Terminal theme-adaptive colors using ANSI color references
# Color 4 = blue (git repo path), 5 = magenta (non-git path), 2 = green (context), 3 = yellow (changes), 6 = cyan (model)
if [ "$is_git_repo" = true ]; then
  path_color="\033[34m"      # Terminal color 4 (blue) for git repos
else
  path_color="\033[35m"      # Terminal color 5 (magenta) for non-git directories
fi
git_color="\033[34m"       # Terminal color 4 (blue)
change_color="\033[33m"    # Terminal color 3 (yellow)
model_color="\033[36m"     # Terminal color 6 (cyan)
context_color="\033[32m"   # Terminal color 2 (green)
reset="\033[0m"
dim="\033[2m"
separator="${dim}│${reset}"

# Build colored components
colored_path="${path_color}${display_path}${reset}"

# Color git changes if present - remove extra space
if [ -n "$git_info" ]; then
  # Remove leading space and pipe (with any extra spaces), we'll add them back with proper spacing
  git_info_clean=$(echo "$git_info" | sed 's/^ │  *//')
  git_info_colored=$(echo "$git_info_clean" | sed "s/\*/${change_color}*${reset}/g")
  colored_git="${dim} ${separator} ${git_color}${git_info_colored}${reset}"
else
  colored_git=""
fi

colored_model="${dim} ${separator} ${model_color}${model}${reset}"
colored_context=""
[ -n "$remaining" ] && colored_context="${dim} ${separator} ${context_color}${remaining}% left${reset}"

colored_cost=""
[ -n "$api_cost" ] && colored_cost="${dim} ${api_cost}${reset}"

# Build the status line with theme-adaptive colors
printf "%b%b%b%b%b\n" "$colored_path" "$colored_git" "$colored_model" "$colored_context" "$colored_cost"
