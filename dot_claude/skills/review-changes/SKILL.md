---
name: review-changes
description: Run the security and staff-engineer reviews on a branch's unreviewed commits, in parallel subagents, and fix what they find. Use before every `git push` or pull request, whenever review-gate blocks a push, and when the user asks for a security or staff review of their changes.
---
# review-changes

Every commit that leaves this machine passes two reviews first, `security-reviewer` and `staff-reviewer`. Each runs as its own Opus subagent with no view of this conversation. A `SubagentStop` hook reads each reviewer's verdict and stores it as a marker for the reviewed commit. A `PreToolUse` hook blocks `git push`, `gh pr create` and pull-request tools until the commit being pushed has a pass from both.

The helper lives at `~/.claude/skills/review-changes/bin/review-gate`. After changing it, run `bin/test-review-gate`, a table of push commands and the decision each should get.

## Steps

1. **Commit first.** Reviews are keyed to a commit, so uncommitted changes are never covered. Commit everything you intend to push.

2. **Find the commits.** Run `review-gate status` in the repository. Its JSON gives `head`, `base` (the fork point from the default branch), `unreviewed` and `needs_review`. When `needs_review` is false, there is nothing to do. `unreviewed` lists the commits no pass covers yet, newest first. A pass covers every commit from `base` to the reviewed commit, and a commit counts as covered when its patch matches one of those (`git patch-id --verbatim`). A rebase or a cascade up a stack therefore leaves only new or changed patches in `unreviewed`.

   In a stack of branches, run `status` on the top branch and review there. A pass at the top covers every branch below it.

3. **Write the purpose.** Two to four sentences on what the change is for and any constraint the user stated. Give the reviewers nothing else from this conversation, so their reads are not anchored on yours.

4. **Launch both reviewers in one message.** Two `Agent` calls in the same response, `subagent_type` set to `security-reviewer` and `staff-reviewer`, `run_in_background: false`. Calls sent together run in parallel. Give each the same prompt:

   ```
   Repository: <absolute path>
   Head commit: <full head sha>
   Focus commits: <the unreviewed list, oldest first>
   Whole-branch range for context: <base>..<head>
   Purpose: <the sentences from step 3>
   ```

   Tell the reviewers to review the focus commits only, and to read the rest of the branch as context.

5. **Read the verdicts.** Run `review-gate status` again.
   - `passed: true` means both reviewers passed and the hook recorded them. Push.
   - A reviewer returned `fix-required`: fix every blocking finding, commit, and go back to step 2. Take the list from `status` again, never from memory. A failed round covers nothing, so after it `unreviewed` still holds the commits the failed review looked at, plus the fix. Both reviewers run again on that whole list, in parallel. Giving them only the fix commits would record a pass for code nobody reviewed.
   - A reviewer passed but `status` shows no marker for it: the hook could not read the report header. Run that reviewer again.

6. **Handle the rest.** Fix a `should-fix` finding when the fix is small and plainly right. Otherwise list it under a "Review notes" heading in the pull request description. Drop nits unless the fix is trivial.

## Limits

- After three rounds that still end in `fix-required`, stop and show the user the open findings.
- When a blocking finding looks wrong, ask the user. Never argue around it, and never write files under `review-gate/` yourself.
- Only the user turns the gate off, with `touch ~/.claude/.review-gate-off`. Never create that file.
