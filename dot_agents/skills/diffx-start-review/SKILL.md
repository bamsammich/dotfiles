---
name: diffx-start-review
description: "Start a code review session by launching the diffx server and opening the browser UI. Use when the user invokes /diffx-start-review."
user_invocable: true
---

# Start diffx Review

Launch the diffx server so the user can review their git changes in a browser-based UI and leave inline comments.

## What to do

### 1. Launch diffx

Run `diffx` in the background. By default it shows all working tree changes (staged + unstaged + untracked).

```bash
diffx -p 7777
```

**Always use port 7777.** The commit gate (`~/.claude/hooks/diffx-gate.sh`) and the
approval script both talk to that port.

Common variations — use these when the context calls for it:

```bash
diffx -p 7777 -- --staged   # Only staged changes
diffx -p 7777 -- HEAD~3     # Last 3 commits
diffx -p 7777 -- main..HEAD # Current branch vs main
```

Anything after `--` is passed directly to `git diff`, so any valid git diff arguments work.

**Important:** Run diffx in the background using the Bash tool with `run_in_background: true`, so the server stays alive while the user reviews.

### 2. Tell the user

After launching, tell the user:

> diffx is running on port 7777. Review your changes in the browser and leave inline comments. When you're done, come back here and run `/diffx-finish-review`.

Commits stay blocked until `/diffx-finish-review` reports a clean review.

Keep it brief.
