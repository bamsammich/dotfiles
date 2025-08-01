#! /usr/bin/env bash

# Append a timestamped bullet to today's note
note() {
  local dir="${DAILY_NOTE_DIR:?}"
  local file="$dir/$(date +%F).md"  # e.g., 2025-07-31.md
  mkdir -p "$dir"

  # Create file with a simple header if it doesn't exist
  if [ ! -f "$file" ]; then
    printf "# %s\n\n" "$(date '+%A, %B %-d, %Y')" >> "$file"
  fi

  # If the arg is a URL, auto-format as a markdown link
  local text="$*"
  if echo "$text" | grep -Eq '^https?://'; then
    text="[$text]($text)"
  fi

  printf "- %s — %s\n" "$(date +%H:%M)" "$text" >> "$file"
}

# Quick-open today's note in your editor (optional convenience)
nt() {
  ${EDITOR:-nvim} "${DAILY_NOTE_DIR:?}/$(date +%F).md"
}

# Backdate or future-date a note: noteon 2025-07-30 "text here"
noteon() {
  local d="$1"; shift
  local dir="${DAILY_NOTE_DIR:?}"
  local file="$dir/$d.md"
  mkdir -p "$dir"
  [ -f "$file" ] || printf "# %s\n\n" "$(date -j -f %F "$d" +%A,\ %B\ %-d,\ %Y 2>/dev/null || echo "$d")" >> "$file"
  printf "- %s — %s\n" "$(date +%H:%M)" "$*" >> "$file"
}
