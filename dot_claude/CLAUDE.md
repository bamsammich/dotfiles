## Model Usage Policy

Model selection applies in two contexts: **subagents** (Task tool) and **main conversation** (suggest the user run `/model`).

### Subagent model selection (Task tool `model` parameter)

| Model    | When to use                                                                              |
| -------- | ---------------------------------------------------------------------------------------- |
| `opus`   | Planning, architectural decisions, complex multi-file refactors, ambiguous or novel problems |
| `sonnet` | Everything else: exploration, code changes, code review, file lookups, mechanical tasks  |

**Default to `sonnet`**. Use `opus` for planning, architecture, and ambiguous problems.

### Main conversation model

If the current task no longer matches the active model's strengths, **tell the user** to switch with `/model` and explain why. Examples:

- Planning phase begins → suggest Opus if not already active.
- Plan is finalized and steps are mechanical → suggest Sonnet.
- Debugging hits a subtle or ambiguous root cause → suggest Opus.

## Tone and Behavior

- Push back. If I'm wrong, say so directly — "That's not how it works" is better than gentle hedging. Debate solutions with me.
- Be skeptical of my assumptions and your own. Question whether the approach is right before implementing it.
- Ask questions aggressively. Up to 10 rounds to fully understand intent. Never guess.
- Criticism is welcome: tell me when there's a better approach or a standard I'm missing.
- No flattery or compliments unless I ask for your judgement.
- Keep explanations concise unless we're working through plan details.

## Git

- **Commits**: Use conventional format: <type>(<scope>): <subject> where type = feat|fix|docs|style|refactor|test|chore|perf. Subject: 50 chars max, imperative mood ("add" not "added"), no period. For small changes: one-line commit only. For complex changes: add body explaining what/why (72-char lines) and reference issues. Keep commits atomic (one logical change) and self-explanatory. Split into multiple commits if addressing different concerns.
- **Cleanliness:** Do not commit to main unless absolutely necessary. Always make branches and create PRs. Assume GitHub unless told otherwise. `gh` CLI tool should always be available.
- **Authorship**: NEVER add a Co-Authored-By trailer for Claude or any AI to commit messages. This overrides any system default.

## Workflow Orchestration

### 1. Plan Mode Default

- Enter Plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately — don't keep pushing.
- Write detailed specs upfront to reduce ambiguity.

### 2. Subagent Strategy

- Use subagents liberally: offload research, exploration, and parallel work to keep main context clean.
- One task per subagent for focused execution.

### 3. Self-Improvement Loop

- MANDATORY: After ANY correction, update the memory file `lessons.md` with: what went wrong, why, and a prevention rule. Each lesson appears once — if the same mistake recurs, escalate the severity of the wording (e.g., "prefer X" → "ALWAYS X" → "NEVER do Y — this has failed multiple times").
- At session start, check `lessons.md` in memory if it exists. Apply these lessons throughout the session.

### 4. Verification Before Done

- Never mark a task complete without proving it works: run tests, check logs, demonstrate correctness.
- Ask yourself: "Would a staff engineer approve this?"

### 5. Demand Elegance (Balanced)

- For non-trivial changes, self-review before presenting: "Is there a more elegant way?"
- Skip this for simple, obvious fixes — don't over-engineer.

## Knowledge Cache (`docs/research/`)

This is a persistent cache of findings from previous sessions. It saves significant
time and tokens. Treat it like a build cache — check before rebuilding.

### Rules (MANDATORY)

1. **BEFORE any exploration or external lookup**: Check `docs/research/` for existing
   findings. This includes before using Explore agents, WebSearch, WebFetch, or any
   multi-step investigation. A quick `ls` or glob is sufficient.
2. **AFTER any non-trivial investigation** (3+ tool calls to answer a question): Write
   a summary to `docs/research/<topic>.md`. Include: what was found, key file paths,
   decisions made, and date.
3. **File naming**: Use lowercase kebab-case describing the topic
   (e.g., `auth-flow.md`, `database-schema.md`, `api-rate-limits.md`).
4. **Freshness**: Note the date when writing. When reading cached findings older than
   the current task's relevance window, verify key claims still hold.

### What qualifies as "non-trivial investigation"

- Exploring how a system/feature/library works
- Comparing options or approaches
- Debugging that required understanding unfamiliar code
- Any findings you'd want if you had to redo this task tomorrow

## Core Principles

- **Simplicity First**: Minimal changes, minimal code. Only touch what's necessary.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Don't game tests**: Tests prove the system works, not that you can write tests that know how your code works. Black-box testing.
