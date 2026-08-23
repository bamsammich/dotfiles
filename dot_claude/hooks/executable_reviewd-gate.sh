#!/bin/bash
# PreToolUse(Bash) gate: refuse `git commit` until reviewd says the current
# working tree was approved.
#
# The whole decision lives in the daemon. This script resolves which repository
# is being committed, asks, and turns the answer into a hook verdict. It stays
# silent in every case that is not a clearly unreviewed commit.

set -u

REVIEWCTL="${REVIEWD_CTL:-reviewctl}"

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')
cwd=$(printf '%s' "$payload" | jq -r '.cwd // empty')
[ -n "$cmd" ] || exit 0
[ -n "$cwd" ] || cwd=$PWD

deny() {
  jq -nc --arg r "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# Only intercept actual commit invocations. This also catches `rtk git commit`
# and `git -C path commit`, and ignores read-only commands that merely contain
# the word.
printf '%s' "$cmd" |
  grep -Eq '(^|[;&|(`]|[[:space:]])git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-][^[:space:]]*)?)*[[:space:]]+commit([[:space:]]|$)' ||
  exit 0
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+(log|show|rev-list|rev-parse|config)' && exit 0

# Escape hatch, for the user to ask for by name.
printf '%s' "$cmd" | grep -q 'REVIEWD_SKIP=1' && exit 0

root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -n "$root" ] || exit 0

gitdir=$(git -C "$root" rev-parse --absolute-git-dir 2>/dev/null) || exit 0
[ -f "$gitdir/reviewd-gate-off" ] && exit 0

# Nothing to review means nothing to gate: an --amend that only edits a message
# leaves the tree identical to HEAD.
empty_hash=$(printf '' | shasum -a 256 | cut -d' ' -f1)
fingerprint=$("$REVIEWCTL" fingerprint "$root" 2>/dev/null) || fingerprint=""
[ -z "$fingerprint" ] && exit 0
[ "$fingerprint" = "$empty_hash" ] && exit 0

answer=$("$REVIEWCTL" gate "$root" --json 2>/dev/null)
status=$?

if [ -z "$answer" ]; then
  # A daemon that is down denies rather than waves everything through, because
  # the point of the gate is that unreviewed code does not get committed. The
  # message carries both ways out.
  deny "reviewd is not answering, so this commit cannot be checked.

Start it:
  launchctl kickstart -k gui/\$(id -u)/com.bamsammich.reviewd

Then commit again. To turn the gate off for this repository only:
  touch \"$gitdir/reviewd-gate-off\"

Override this one commit only if the user explicitly asks: prefix the command
with REVIEWD_SKIP=1."
fi

decision=$(printf '%s' "$answer" | jq -r '.decision // "deny"')
[ "$decision" = "allow" ] && {
  # Warnings ride along with an allow and are worth printing, but they never
  # block: approving with threads open is the reviewer's call.
  printf '%s' "$answer" | jq -r '.warnings[]? | "reviewd warning: \(.)"' >&2
  exit 0
}

reason=$(printf '%s' "$answer" | jq -r '.reason // "not approved"')
url=$(printf '%s' "$answer" | jq -r '.reviewUrl // empty')
threads=$(printf '%s' "$answer" | jq -r '.openThreads[]? | "  \(.path):\(.line) — \(.excerpt)"')

message="reviewd gate: $reason"
[ -n "$url" ] && message="$message

Review: $url"
[ -n "$threads" ] && message="$message

Open threads:
$threads"

message="$message

Open a review with the reviewd MCP tools (review_create, then review_snapshot
after edits), and wait for a verdict with:
  reviewctl wait --review <id>

Override this one commit only if the user explicitly asks: prefix the command
with REVIEWD_SKIP=1."

deny "$message"
exit "$status"
