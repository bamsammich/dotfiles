#!/bin/bash
# Shared helpers for the diffx review gate.

DIFFX_PORT="${DIFFX_PORT:-7777}"

# Fingerprint of everything a reviewer would see: tracked changes vs HEAD
# plus the content of untracked, non-ignored files.
diffx_fingerprint() {
  local root="$1"
  {
    git -C "$root" diff HEAD 2>/dev/null
    git -C "$root" ls-files --others --exclude-standard -z 2>/dev/null \
      | while IFS= read -r -d '' f; do
          printf '### %s\n' "$f"
          cat "$root/$f" 2>/dev/null
        done
  } | shasum -a 256 | cut -d' ' -f1
}

diffx_repo_root() {
  git -C "$1" rev-parse --show-toplevel 2>/dev/null
}

# Uses the real git dir so linked worktrees (where .git is a file) work too.
diffx_token_path() {
  local gitdir
  gitdir=$(git -C "$1" rev-parse --absolute-git-dir 2>/dev/null) || return 1
  printf '%s/diffx-review-approved' "$gitdir"
}
