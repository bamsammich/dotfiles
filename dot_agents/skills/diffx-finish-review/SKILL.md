---
name: diffx-finish-review
description: "Finish a code review session by fetching comments from the running diffx server, applying requested changes, and marking comments as resolved. Use when the user invokes /diffx-finish-review."
user_invocable: true
---

# Finish diffx Review

Fetch all review comments from the running diffx server, apply the requested changes, and mark each comment as resolved.

## What to do

### 1. Fetch comments from the API

The diffx server is running locally on port 7777. Fetch all comments:

```bash
curl -s http://localhost:7777/api/comments
```

diffx always runs on port 7777 in this setup (see `/diffx-start-review`).

The response is a JSON array of comment objects:

```json
[
  {
    "id": "uuid",
    "filePath": "src/utils/parser.ts",
    "side": "additions",
    "lineNumber": 42,
    "lineContent": "const x = tokenize(input)",
    "body": "Rename x to parsedToken for clarity",
    "status": "open",
    "createdAt": 1234567890,
    "replies": []
  }
]
```

### 2. Process each comment

For each comment with `"status": "open"`, first determine the intent — is it a **change request** or a **question**?

#### Change requests (e.g., "Rename x to parsedToken", "Extract this into a helper")

1. Read the file at `filePath`
2. Find the relevant code using `lineContent` as context
3. Apply the change described in `body`
4. Reply to the comment explaining what you did, then mark it as resolved:

```bash
# Reply to the comment
curl -s -X POST http://localhost:7777/api/comments/<id>/replies \
  -H "Content-Type: application/json" \
  -d '{"body": "Done. Renamed x to parsedToken."}'

# Mark as resolved
curl -s -X PUT http://localhost:7777/api/comments/<id> \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}'
```

#### Questions (e.g., "Why not use a Map here?", "Is this thread-safe?")

Just reply with an answer. Do **not** modify code or resolve the comment — leave it open for the user to read and follow up if needed.

```bash
curl -s -X POST http://localhost:7777/api/comments/<id>/replies \
  -H "Content-Type: application/json" \
  -d '{"body": "A Map would work too, but we use a plain object here because..."}'
```

The `side` field tells you whether the comment is on an added line (`additions`) or a deleted line (`deletions`).

### 3. Handle edge cases

- If a comment is ambiguous, reply to ask for clarification rather than guessing.
- If multiple comments interact (e.g., a rename that affects several places), handle them together.
- If there are no open comments, tell the user there's nothing to process.

### 4. Approve the diff so commits unblock

Once every change request is applied and resolved, run the approval script from
inside the repo:

```bash
~/.claude/hooks/diffx-approve.sh
```

It refuses to approve while any comment is still open, and it prints the
offending comments if so. On success it records a fingerprint of the current
diff, which is what the `git commit` gate checks.

If the script reports open comments, fix them and run it again. Question
comments count as open by design: tell the user which questions you answered and
ask them to mark those threads resolved in the diffx UI once satisfied. **Never write the
approval file by hand and never suggest `DIFFX_SKIP=1` on your own** — the user
asks for that, or the commit waits.

If the user made further edits after approving, the fingerprint no longer
matches and the gate re-arms: start a fresh review rather than re-approving
blindly.

### 5. Summary

After processing all comments, give a brief summary of what you did: how many changes were applied, how many questions were answered.

## Why the gate exists

A `PreToolUse` hook blocks `git commit` until this skill records a clean review.
That is deliberate: the user wants no code committed until a diffx review comes
back with zero comments. If a commit is denied, run the review — do not look for
a way around it.
