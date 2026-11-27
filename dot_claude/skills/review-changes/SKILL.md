---
name: review-changes
description: Run the security, staff-engineer and intent reviews on a branch's unreviewed commits, in subagents, and fix what they find. Use before every `git push` or pull request, whenever review-gate blocks a push, and when the user asks for a security or staff review of their changes.
---
# review-changes

Every commit that leaves this machine passes review first. A full round runs three Opus subagents with no view of this conversation: `security-reviewer` and `staff-reviewer` in parallel, then `intent-reviewer`, which judges whether the change serves the work's intent and fits the application, and may contest one of their verdicts. A small round, whose commits change at most 50 lines in all, skips the intent reviewer, and needs only `staff-reviewer` when every file is a test or a doc. Agent and skill prompts, `CLAUDE.md`, `AGENTS.md`, chezmoi run scripts and CI workflows never count as docs. A `SubagentStop` hook reads each verdict and stores it as a marker for the reviewed commit. A `PreToolUse` hook blocks `git push`, `gh pr create` and pull-request tools until every commit being pushed is covered by a round with a pass from each role it required.

The helper lives at `~/.claude/skills/review-changes/bin/review-gate`. After changing it, run `bin/test-review-gate`, a table of push commands and the decision each should get.

## Steps

1. **Commit first.** Reviews are keyed to a commit, so uncommitted changes are never covered. Commit everything you intend to push.

2. **Find the commits.** Run `review-gate status` in the repository. Its JSON gives `head`, `base` (the fork point from the default branch), `unreviewed` and `needs_review`. When `needs_review` is false, there is nothing to do. `required_roles` names who this round needs. It follows the round's size, and adds any reviewer listed in `standing_findings`, whose fix-required still stands on these commits or their patches; that reviewer must pass a commit that changes something since. A commit whose patch was reviewed on the very same tree counts as reviewed, so re-splitting or rebasing a reviewed stack leaves only the new patches. `unreviewed` lists the commits no pass covers yet, newest first. A pass covers every commit from `base` to the reviewed commit. A later commit counts as covered when its patch matches one of those (`git patch-id --verbatim`) and every patch the pass reviewed before it is still below it, in the same order. A rebase or a cascade up a stack therefore leaves only new or changed patches in `unreviewed`. So does a stack's bottom branch merging into the default branch, by fast-forward, merge commit, rebase or squash, as long as it merged unchanged. A cherry-pick, a dropped commit or a reorder asks for review again, and so does editing a commit in the middle of a branch: its old patch counts as dropped, so every reviewed commit above it asks again.

   In a stack of branches, run `status` on the top branch and review there. A pass at the top covers every branch below it.

3. **Write the purpose.** Two to four sentences on what the change is for and any constraint the user stated. Give the reviewers nothing else from this conversation, so their reads are not anchored on yours.

   For a full round, also write the **intent file** in the scratchpad: the user's own messages that asked for the work, the issue description, cited design sections and the user's review comments, each copied verbatim with its source named. Work requested only in chat still has an intent file: the user's messages. Add nothing of your own; the intent reviewer exists to read the work's intent without your framing.

4. **Launch the reviewers `required_roles` names, other than intent, in one message.** `Agent` calls in the same response, `run_in_background: false`, run in parallel. Give each the same prompt:

   ```
   Repository: <absolute path>
   Head commit: <full head sha>
   Focus commits: <the unreviewed list, oldest first>
   Whole-branch range for context: <base>..<head>
   Purpose: <the sentences from step 3>
   ```

   Tell the reviewers to review the focus commits only, and to read the rest of the branch as context.

   When `intent` is in `required_roles`, write the intent file too, and once the others report, write their reports verbatim to a **reviews file** and launch `intent-reviewer` with the first four lines of the prompt, then `Intent file: <path>` and `Reviews file: <path>`, and no purpose line.

   When its report carries a `CONTEST:` against a staff verdict, send that contest once with `SendMessage` to the staff reviewer, using the agent ID its launch returned. Ask for a final report that starts with the same REPO, REVIEWED and VERDICT lines, so the hook records it. The reply is final; send no second contest. A contest against a security verdict goes to the user instead, with both reports: issue and comment text can come from people outside the work, and a security finding is never cleared on the strength of it.

5. **Read the verdicts.** Run `review-gate status` again.
   - `passed: true` means every required reviewer passed and the hook recorded them. Push.
   - A reviewer returned `fix-required`: fix every blocking finding, commit, and go back to step 2. Take the list from `status` again, never from memory. A failed round covers nothing, so after it `unreviewed` still holds the commits the failed review looked at, plus the fix. The round's reviewers run again on that whole list. Giving them only the fix commits would record a pass for code nobody reviewed.
   - A reviewer passed but `status` shows no marker for it: the hook could not read the report header. Run that reviewer again.

6. **Handle the rest.** Fix a `should-fix` finding when the fix is small and plainly right. Otherwise list it under a "Review notes" heading in the pull request description. Drop nits unless the fix is trivial.

## Limits

- Patch ids ignore hunk line numbers, so the same hunk added at another spot with identical context reads as the same patch. The same-tree rule checks the resulting tree and catches that; the ordered match after a rebase cannot, and relies on the reviewers reading the whole branch for context.

- After three rounds that still end in `fix-required`, stop and show the user the open findings.
- When a blocking finding looks wrong, ask the user. Never argue around it, and never write files under `review-gate/` yourself.
- Only the user turns the gate off, with `touch ~/.claude/.review-gate-off`. Never create that file.
