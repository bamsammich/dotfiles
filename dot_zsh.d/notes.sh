#! /usr/bin/env bash

# Convert space-delimited tags to #hashtags
tags() {
  local tags="${DAILY_NOTE_TAGS:-}"
  if [ -n "$tags" ]; then
    echo "$tags" | sed 's/\b[^ ]\+/#&/g'
  fi
}

# Append a timestamped bullet to today's note
note() {
  local dir="${DAILY_NOTE_DIR:?}"
  local file="$dir/$(date +%F).md" # e.g., 2025-07-31.md
  mkdir -p "$dir"

  # Create file with a simple header if it doesn't exist
  if [ ! -f "$file" ]; then
    printf "# %s\n\n" "$(date '+%A, %B %-d, %Y')" >>"$file"
  fi

  # If the arg is a URL, auto-format as a markdown link
  local text="$*"
  if echo "$text" | grep -Eq '^https?://'; then
    text="[$text]($text)"
  fi

  # Add tags if they exist
  local hashtags
  hashtags=$(tags)
  local note_line="- $(date +%H:%M) — $text"

  if [ -n "$hashtags" ]; then
    note_line="$note_line $hashtags"
  fi

  printf "%s\n" "$note_line" >>"$file"
}

# Quick-open today's note in your editor (optional convenience)
nt() {
  ${EDITOR:-nvim} "${DAILY_NOTE_DIR:?}/$(date +%F).md"
}

# Backdate or future-date a note: noteon 2025-07-30 "text here"
noteon() {
  local d="$1"
  shift
  local dir="${DAILY_NOTE_DIR:?}"
  local file="$dir/$d.md"
  mkdir -p "$dir"
  [ -f "$file" ] || printf "# %s\n\n" "$(date -j -f %F "$d" +%A,\ %B\ %-d,\ %Y 2>/dev/null || echo "$d")" >>"$file"

  # Add tags if they exist
  local hashtags
  hashtags=$(tags)
  local note_line="- $(date +%H:%M) — $*"

  if [ -n "$hashtags" ]; then
    note_line="$note_line $hashtags"
  fi

  printf "%s\n" "$note_line" >>"$file"
}

glossary() {
  rg --no-heading '#wtf\s+\S+\s*=' "${DAILY_NOTE_DIR:?}" |
    sed -E 's/.*#wtf\s*([^=]+)=\s*(.*)/\1 = \2/' |
    sort -u |
    awk '
    BEGIN {
      print "# WTF Glossary\n"
    }
    {
      v = substr($0, index($0,$2)+1);
      substr($0, index($0,$2)+1);
      print "- **" $1 "**:" v 
    }
  '
}
