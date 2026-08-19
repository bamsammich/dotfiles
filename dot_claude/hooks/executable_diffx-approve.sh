#!/bin/bash
# Approve the current diff for commit — only if the running diffx server
# reports zero open comments. Run from inside the repo being reviewed.
set -u
source "$HOME/.claude/hooks/diffx-lib.sh"

root=$(diffx_repo_root "$PWD")
if [ -z "$root" ]; then
  echo "diffx-approve: not inside a git repository." >&2
  exit 1
fi

resp=$(curl -sf --max-time 5 "http://localhost:${DIFFX_PORT}/api/comments") || {
  echo "diffx-approve: no diffx server answering on port ${DIFFX_PORT}. Start one with: diffx -p ${DIFFX_PORT}" >&2
  exit 1
}

open=$(printf '%s' "$resp" | jq '[.[] | select(.status == "open")] | length')
if [ "$open" != "0" ]; then
  echo "diffx-approve: $open comment(s) still open. Resolve them before approving." >&2
  printf '%s' "$resp" | jq -r '.[] | select(.status == "open") | "  \(.filePath):\(.lineNumber) — \(.body)"' >&2
  exit 1
fi

diffx_fingerprint "$root" > "$(diffx_token_path "$root")"
echo "diffx-approve: review clean, commit unblocked for the current diff."
