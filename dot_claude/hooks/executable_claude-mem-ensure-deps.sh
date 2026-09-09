#!/usr/bin/env bash
# Marketplace auto-updates extract a new claude-mem version dir but never run
# `bun install`, so every hook dies on `Cannot find module 'zod/v3'`.
set -uo pipefail

CACHE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/cache/thedotmack/claude-mem"
[ -d "$CACHE" ] || exit 0

# Newest non-orphaned version dir, by semver.
ROOT=$(
  for d in "$CACHE"/[0-9]*/; do
    [ -d "$d" ] || continue
    [ -e "${d}.orphaned_at" ] && continue
    b=${d%/}; b=${b##*/}
    IFS=. read -r a c e <<<"${b%%-*}"
    printf '%08d%08d%08d %s\n' "${a:-0}" "${c:-0}" "${e%%[!0-9]*}" "${d%/}"
  done 2>/dev/null | sort -r | head -1 | cut -d' ' -f2-
)
[ -n "$ROOT" ] || exit 0
[ -f "$ROOT/package.json" ] || exit 0
[ -d "$ROOT/node_modules" ] && exit 0

BUN=$(command -v bun 2>/dev/null)
for p in "$HOME/.bun/bin/bun" /opt/homebrew/bin/bun /usr/local/bin/bun; do
  [ -n "$BUN" ] && break
  [ -x "$p" ] && BUN=$p
done
if [ -z "$BUN" ]; then
  echo "claude-mem: node_modules missing in $ROOT and bun not found. Run: npx claude-mem@latest install" >&2
  exit 0
fi

echo "claude-mem: installing missing deps for $(basename "$ROOT")..." >&2
if ! "$BUN" install --production --cwd "$ROOT" >/dev/null 2>&1; then
  rm -rf "$ROOT/node_modules"
  echo "claude-mem: bun install failed. Run: npx claude-mem@latest install" >&2
  exit 0
fi
echo "claude-mem: deps installed for $(basename "$ROOT")" >&2
exit 0
