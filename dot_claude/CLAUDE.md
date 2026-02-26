## Model Usage Policy

Model selection applies in two contexts: **subagents** (Task tool) and **main conversation** (suggest the user run `/model`).

### Subagent model selection (Task tool `model` parameter)

| Model   | When to use                                                                                   |
|---------|-----------------------------------------------------------------------------------------------|
| `opus`  | Planning, architectural decisions, complex multi-file refactors, ambiguous or novel problems   |
| `sonnet`| Exploration requiring judgment (summarizing, comparing options), multi-step code changes, code review |
| `haiku` | File lookups, simple grep/glob searches, straightforward single-file edits, mechanical tasks  |

**Default to `haiku`** unless the task clearly requires deeper reasoning. When in doubt, prefer `sonnet` over `opus`.

### Main conversation model

If the current task no longer matches the active model's strengths, **tell the user** to switch with `/model` and explain why. Examples:
- Planning phase begins → suggest Opus if not already active.
- Plan is finalized and steps are mechanical → suggest Haiku or Sonnet.
- Debugging hits a subtle or ambiguous root cause → suggest Opus or Sonnet.

## Tone and Behavior

- Criticism is welcome.
  - Please tell me when I am wrong or mistaken, or even when you think I might be wrong or mistaken.
  - Please tell me if there is a better approach than the one I am taking.
  - Please tell me if there is a relevant standard or convention that I appear to be unaware of.
- Be skeptical.
- Be thorough and complete.
- Be concise.
  - Short summaries are OK, but don't give an extended breakdown unless we are working through the details of a plan.
  - Do not flatter, and do not give compliments unless I am specifically asking for your judgement.
  - Occasional pleasantries are fine.
- Feel free to ask many questions. If you are in doubt of my intent, don't guess. Ask.

## Git

- **Commits**: Use conventional format: <type>(<scope>): <subject> where type = feat|fix|docs|style|refactor|test|chore|perf. Subject: 50 chars max, imperative mood ("add" not "added"), no period. For small changes: one-line commit only. For complex changes: add body explaining what/why (72-char lines) and reference issues. Keep commits atomic (one logical change) and self-explanatory. Split into multiple commits if addressing different concerns.
- **Cleanliness:** Do not commit to main unless absolutely necessary. Always make branches and create PRs. Assume GitHub unless told otherwise. `gh` CLI tool should always be available.
- **Authorship**: Never add a Co-Authored-By trailer for Claude or any AI to commit messages.

## Architectural Decision Records (ADRs)

- **Immutability**: ADRs that have been merged into the repo's default branch MUST NOT be modified, ever. The only permitted change to a merged ADR is updating its `status` field when it is superseded by a new ADR. To change a decision, write a new superseding ADR — never edit the original.
- **Mandatory review gates** (only when `docs/adr/` exists in the repo):
  1. **After writing a plan, before user approval**: Invoke the `adr-review` skill to dispatch the adr-review agent with the plan content. Do this BEFORE presenting the plan for approval or exiting plan mode.
  2. **After implementation, before claiming completion**: Invoke the `adr-review` skill to dispatch the adr-review agent with the git diff. Do this BEFORE the verification-before-completion checklist.
  These gates are non-negotiable — treat them like running tests. Skipping them is the same as skipping verification.
- **New architectural decisions**: When the adr-review agent flags decisions not covered by existing ADRs, surface this to the user and offer to invoke the `adr` skill. Do not silently proceed.

## Coding Practices

- Use best practices and modern, widely-accepted tooling for the language you're working in.
- Practice codebase hygiene
  - Always remove dead code
  - Implement automated linting and formatting to enforce style consistency
  - Regularly update dependencies to the latest stable version unless doing so requires a refactor. Refactoring to update a dependency should be considered its own feature work
- Prefer writing DRY code as often as possible, but do not sacrifice readability or code quality.
