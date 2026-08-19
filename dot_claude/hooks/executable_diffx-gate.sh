#!/bin/bash
# PreToolUse(Bash) gate: refuse `git commit` until diffx review is clean.
# Allow (exit 0 silently) in every case that is not a clearly-unreviewed commit.

source "$HOME/.claude/hooks/diffx-lib.sh"

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')
cwd=$(printf '%s' "$payload" | jq -r '.cwd // empty')
[ -n "$cmd" ] || exit 0
[ -n "$cwd" ] || cwd=$PWD

deny() {
  jq -nc --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# Only intercept actual commit invocations (also catches `rtk git commit`,
# `git -C path commit`). Ignore read-only commands that merely say "commit".
printf '%s' "$cmd" | grep -Eq '(^|[;&|(`]|[[:space:]])git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-][^[:space:]]*)?)*[[:space:]]+commit([[:space:]]|$)' || exit 0
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+(log|show|rev-list|rev-parse|config)' && exit 0

# Escape hatches.
printf '%s' "$cmd" | grep -q 'DIFFX_SKIP=1' && exit 0

root=$(diffx_repo_root "$cwd") || exit 0
[ -n "$root" ] || exit 0
gitdir=$(git -C "$root" rev-parse --absolute-git-dir 2>/dev/null) || exit 0
[ -f "$gitdir/diffx-gate-off" ] && exit 0

current=$(diffx_fingerprint "$root")
# Nothing to review (e.g. empty tree, pure `--amend` of message).
[ "$current" = "$(printf '' | shasum -a 256 | cut -d' ' -f1)" ] && exit 0

token=$(diffx_token_path "$root") || exit 0
[ -f "$token" ] && [ "$(cat "$token")" = "$current" ] && exit 0

if [ -f "$token" ]; then
  reason="diffx review gate: the working tree changed after the last clean review, so this commit is blocked.

Re-review the current diff:
  1. Run /diffx-start-review and tell the user to review in the browser.
  2. When they are done, run /diffx-finish-review to apply comments and re-approve.

Override for this one commit only if the user explicitly asks: prefix the command with DIFFX_SKIP=1."
else
  reason="diffx review gate: these changes have not passed a diffx review, so this commit is blocked.

  1. Run /diffx-start-review and tell the user to review in the browser.
  2. When they are done, run /diffx-finish-review to apply comments and approve.

Commit only once the review comes back with no open comments. Override for this one commit only if the user explicitly asks: prefix the command with DIFFX_SKIP=1."
fi
deny "$reason"
