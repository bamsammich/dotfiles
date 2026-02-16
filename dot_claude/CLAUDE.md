## Model Usage Policy

- Always use the latest version of a model.
- Use Opus model for all planning.
- Use Sonnet model for complex exploration that requires distilling/summarizing data or making careful choices. Otherwise, use Haiku model.
- Use Haiku model for executing a plan if the plan is simple and the content or codebase is not complex. Otherwise, use Sonnet model.
- Use `/model` to switch immediateyl when a task requires a different level of reasoning (higher or lower).

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

## Coding Practices

- Use best practices and modern, widely-accepted tooling for the language you're working in.
- Practice codebase hygiene
  - Always remove dead code
  - Implement automated linting and formatting to enforce style consistency
  - Regularly update dependencies to the latest stable version unless doing so requires a refactor. Refactoring to update a dependency should be considered its own feature work
