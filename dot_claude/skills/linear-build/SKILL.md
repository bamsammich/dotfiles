---
name: linear-build
description: Work a Linear issue, usually a parent with child issues, by having Claude plan and decide, cheaper builder models (DeepSeek, a local LM Studio model, or another agent CLI) implement through `crew`, and Opus reviewers check the result before draft PRs open. Use whenever the user asks to work on, implement, build, pick up or finish a Linear issue such as PIPE-123, unless they ask for a different way of working.
---

# linear-build

Claude (you) makes the decisions and writes the structure. Builder models write the implementation through `crew`. They run on the user's own cluster or machine at no Anthropic cost. Opus reviewers check their work. Spend your own tokens on judgment: reading the issues, deciding, writing stubs and tests, handling escalations and reviewing. Never on watching a builder work.

**Report your steps.** The user watches progress on a board in the Herdr app, one card per parent issue, showing whose move each child is waiting on. Builds report themselves. Your own steps only show up if you record them with `crew stage`, `crew review` and `crew parent` at the points this file names. Each call is one short command, so never skip one.

Keep the workflow out of the repo: no workflow files, decision records or architecture decision records. The user runs this workflow alone. `crew` keeps its state in `<worktree>/.crew/`, which git ignores locally. Only stubs, tests and the implementation reach commits.

**`crew` is not on PATH.** It ships in this skill's folder. Every `crew ...` command in this file means `~/.claude/skills/linear-build/bin/crew ...`, so always call it by that full path. The builders, attempt defaults and Linear team keys live in `~/.claude/skills/linear-build/config.json`. Run `crew` with no arguments for its command list, and `crew builders` for the configured builders.

## 1. Read the work

1. Fetch the issue with the Linear tools. If it has children, list them (`list_issues` with the parent) and read each one and its comments. Read any design doc or plan the issues link to.
2. If the session is not in the right repo, move there first.
3. Make sure `crew test-cmd get` prints the repo's test command. If it prints nothing, find it (Makefile, `go.mod`, `package.json`, CI config) and run `crew test-cmd set "<cmd>"`.

## 2. Plan each child issue

The user's design phase already settled the structure before the issues existed. Planning here is mostly translating each issue into stubs and tests, and few new decisions should come up.

For each child issue (or the parent alone, if it has no children):

1. Explore only as much code as the decisions need. Use CodeGraph or an Explore subagent for wide searches.
2. `crew init <ISSUE> --parent <PARENT> [--base <ref>] [--branch <name>]` creates a worktree outside the repo and prints its path. Work in that path. Run `crew parent <PARENT> --title "<parent issue title>"` once per parent before the first child.
3. Write the stubs: every new function signature, exported type and interface the child needs, with bodies that compile but do nothing useful (`panic("unimplemented")`, `return nil, errors.New("unimplemented")`, and so on).
4. Write the tests that define done. They should compile and fail on the stubs for the right reason. Run them to confirm.
5. Write `<worktree>/.crew/spec.md`, which the builder treats as the source of truth:
   - goal, in two or three sentences
   - acceptance criteria, including any the tests cannot check
   - decisions already made that affect this child, whether they came from design, issue text or your planning
   - functions the builder fills in, and their files
   - what is out of scope

**Builders make no decisions.** They implement only behavior the spec and tests pin down, and they send every open point back as a question. So pin behavior while you plan: walk each function's edge cases (empty, nil, zero, negative, oversized, non-ASCII, error paths, ordering) and settle each one, preferably with a test, otherwise with a line in the spec. Each case you settle here saves an escalation round trip later. Read the spec once more for lines a builder could read two ways, such as "truncate at a boundary when possible", and make them exact.
6. Commit the stubs and tests in the worktree (`<ISSUE>: stubs and tests`).
7. Pick the builders (see "Choosing builders"), then `crew seal <ISSUE> [--test "<narrower cmd>"] [--attempts <b>,<b>] --protect <test files> <pure interface files>`. Protect the test files and any file that holds only interfaces or types. Do not protect files where the builder fills in function bodies. The crew-critic reviewer checks signatures in those files.

**Shared interfaces.** If one child needs an interface that another child implements, stub that interface in a parent worktree first (`crew init <PARENT>`), commit it there, and `init` each child with `--base <parent branch>`. Children that are independent after stubbing can build in parallel.

### Choosing builders

`--attempts` lists one builder per attempt, in order. Without it, `crew` uses the config default (`crew builders` shows it). Builders stay on the user's hardware, so a wasted attempt costs time, not Anthropic tokens.

| Child issue | Attempts |
| --- | --- |
| Mechanical: boilerplate, wiring, a pure function with full tests | Cheapest first, such as `local,deepseek` |
| Typical | The config default |
| Subtle logic, concurrency, anything security-flagged | Strongest builder for every attempt |

Each builder has a `max_parallel` limit, and `crew` queues attempts beyond it. If `crew builders` shows a builder you were going to use with no capacity, or the user says it is offline (a local LM Studio model when LM Studio is not running), leave it out.

## 3. Record decisions on Linear

Post one comment on the parent issue, titled **Build decisions**, and keep updating that same comment (`save_comment` with its id) for the rest of the run. Tag each line with its source:

| Tag | Source |
| --- | --- |
| `[design]` | Design phase or issue text |
| `[plan]` | You, while planning |
| `[escalation]` | You, answering a builder's question |
| `[ratified]` | You, accepting or overruling behavior a builder had to pick where spec and tests were silent, after crew-critic flagged it |

Every decision on the list is yours or the user's. Builders never appear as a source.

**When to pause.** If a planning decision contradicts the design or widens an issue's scope, post the comment, ask the user with `crew ask` (see "Asking the user"), and stop that child until they answer. Otherwise do not pause. The user reviews all decisions at the end.

**Asking the user.** Every question for the user goes through `crew ask <ISSUE> --question "<one sentence>" --option "<Label>: <what happens if they pick it>" ... --recommend <N>`, with two to four options and the 1-based number of your recommendation. The board shows the question as buttons and marks the parent as waiting on the user. When they pick, `crew answer` records the choice and clears the parent's banner. If you run in Herdr, the choice also reaches you as a `[crew board, ...] My decision: ...` message. Otherwise read it from the child's `meta.json` (`.answer.choice`) before you continue. Record the decision on Linear as `[escalation]`, citing the user's choice.

## 4. Build

Run `crew run <CHILD> <CHILD> ...` as a **background** Bash command (`run_in_background: true`). It launches one build per issue, shown as tabs in the Herdr app when its window is open, and prints a JSON array of results once every build finishes. Do not poll it, read the build logs, or tail anything while it runs. You are woken when it exits.

Each result has a `status`, and `attempt_log` shows which builder made each attempt:

| status | What you do |
| --- | --- |
| `passed` | Go to review. |
| `question` | Read `.crew/questions.md` (and `protected-violation.diff` if present). It lists every open point the builder found in one batch. Decide each one, and pin each answer with a test where you can, otherwise in the spec. Commit only the spec, stub and test changes, re-seal (which clears the questions), record each answer as `[escalation]`, and run `crew run <ISSUE>` again in the background. The builder continues from its partial work. If an answer would contradict the design or widen scope, ask the user instead. |
| `failed` | Read `.crew/last-failure.txt` and the spec. The cause is usually an ambiguous spec. Fix the spec, not the code, re-seal (moving to a stronger builder if a weaker one failed) and run once more. If it fails again, stop on that issue and report it to the user. Keep going with the others. |
| `timeout` or `error` | Read the result's `note` and the end of `.crew/build.log`, report it, and keep going with the others. |

## 5. Review

Reviews are Opus subagents. Give each one only its worktree path, issue key and starting scan file, with nothing else from this conversation. Launch independent reviews in a single message so they run in parallel.

| Reviewer | When |
| --- | --- |
| `crew-critic` | Every child issue that passed. Point it at `.crew/scan-critic.md`. |
| `crew-security` | Only when the result has `risk.security: true`. Point it at `.crew/scan-security.md`. |
| `crew-qa` | Once all children pass, across every child worktree. Also early on a single child whose result has `attempts > 1`. First run `crew scan <ISSUE> --lens qa` for each worktree it will cover. |
| `crew-staff` | Once per parent, after all children pass, across every child worktree, with the Build decisions comment pasted into its prompt. First run `crew scan <ISSUE> --lens staff` for each worktree. Run it again if an escalation changed stubs or tests after its first run. |

The `crew scan` runs use the config's `scan_builder` and cost no Anthropic tokens. Run them in the background in parallel before the reviewers that need them.

**Board updates during review.** Before launching reviewers on a child, run `crew stage <ISSUE> reviewing --note "Claude: <reviewers> reviewing"`. After each reviewer returns, write its full report to a file and run `crew review <ISSUE> <lens> pass|fix-required <number of blocking plus should-fix findings> --file <report.md>`. The board renders that report for the user.

**On `fix-required`.** Write the blocking and should-fix findings to a file and run `crew fix <ISSUE> --feedback <file>` in the background. `crew fix` marks the child as fixing on its own. Then run `crew-critic` again on the fix only (tell it to use `crew diff <ISSUE> --fix`). Allow one fix round per issue. If blocking findings remain, don't loop: `crew ask` the user, offering at least a second fix round and you fixing it yourself, plus any spec change that would make the problem go away.

**Unpinned behavior.** crew-critic lists every behavior the builder had to pick where spec and tests were silent. Decide each one yourself. If you keep the builder's choice, add a test that pins it and record it as `[ratified]`. If you overrule it, put the change in the `crew fix` feedback along with a test that pins your answer. Either way the decision is yours, and the tests now hold it.

## 6. Open draft PRs

For each child that passed review, push its branch and open a **draft** PR with `gh pr create --draft`. Put the issue key in the title. The body covers:

- what changed and how it was tested
- decisions from the Build decisions comment that touch this PR
- which builders wrote the code, which reviewers ran, and any non-blocking findings left open

End the PR body with the attribution line from the system reminder.

Record each PR with `crew pr <ISSUE> <PR URL>`, so the user's build history links issue, branch and PR. It also moves the child to the PR stage, which the board shows as waiting on the user. When the last child's PR is open, run `crew parent <PARENT> --waiting you --note "Review the Build decisions comment, then the draft PRs" --link <decisions comment URL>`. Then `crew remove <ISSUE>` for each finished worktree. It archives the worktree's `.crew/` folder first, and the branches stay.

## 7. Report

Tell the user, in a few lines:
- a link to the Build decisions comment, which they review first
- the draft PRs
- anything stopped: questions you could not answer, issues that failed twice, unresolved blocking findings

## Messages from the board

When you run in a Herdr terminal, `crew parent` records that terminal as the parent's orchestrator, and the crew board in the Herdr app shows a reply box on the parent's card. Whatever the user types there reaches you as a message starting with `[crew board, <PARENT>]`. Treat it as the user speaking about that parent issue: an answer to an escalation, a correction or a new instruction. When the reply settles an escalated child, record the decision on Linear, then move the child on with `crew stage`, `crew fix` or your own work, and clear the banner with `crew parent <PARENT> --waiting none`.

If the session has no memory of the parent, rebuild it from `crew`'s files before acting. `~/.local/state/crew/parents/<repo>/<PARENT>.json` holds the parent's title and the open question. Each child's `~/.local/state/crew/wt/<repo>/<CHILD>/.crew/` holds its spec, meta (stage, reviews, attempts), result, questions and scans, and `crew status <CHILD>` prints the latest result.

## Token rules

- Never read builder transcripts or build logs except `last-failure.txt` and `questions.md`.
- Never re-read a diff a reviewer is already covering. Trust the reviewer's verified findings.
- Keep the main session for decisions. Use subagents for any wide reading.
