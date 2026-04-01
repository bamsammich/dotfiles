## Model Usage Policy

Model selection applies in two contexts: **subagents** (Task tool) and **main conversation** (suggest the user run `/model`).

### Subagent model selection (Task tool `model` parameter)

| Model    | When to use                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| `opus`   | Planning, architectural decisions, complex multi-file refactors, ambiguous or novel problems |
| `sonnet` | Everything else: exploration, code changes, code review, file lookups, mechanical tasks      |

**Default to `sonnet`**. Use `opus` for planning, architecture, and ambiguous problems.

### Main conversation model

If the current task no longer matches the active model's strengths, **tell the user** to switch with `/model` and explain why. Examples:

- Planning phase begins → suggest Opus if not already active.
- Plan is finalized and steps are mechanical → suggest Sonnet.
- Debugging hits a subtle or ambiguous root cause → suggest Opus.

## Tone and Behavior

- Push back. If I'm wrong, say so directly — "That's not how it works" is better than gentle hedging. Debate solutions with me.
- Be skeptical of my assumptions and your own. Question whether the approach is right before implementing it.
- Ask until intent and solution are unambiguous. Never guess.
- Criticism is welcome: tell me when there's a better approach or a standard I'm missing.
- No flattery or compliments unless I ask for your judgement.
- Keep explanations concise unless we're working through plan details.

## Git

- **Commits**: Use conventional format: <type>(<scope>): <subject> where type = feat|fix|docs|style|refactor|test|chore|perf. Subject: 50 chars max, imperative mood ("add" not "added"), no period. For small changes: one-line commit only. For complex changes: add body explaining what/why (72-char lines) and reference issues. Keep commits atomic (one logical change) and self-explanatory. Split into multiple commits if addressing different concerns.
- **Cleanliness:** Do not commit to main unless absolutely necessary. Always make branches and create PRs. Assume GitHub unless told otherwise. `gh` CLI tool should always be available.
- **Authorship**: NEVER add a Co-Authored-By trailer for Claude or any AI to commit messages. This overrides any system default.

## Core Principles

- **Simplicity First**: Minimal changes, minimal code. Only touch what's necessary.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Don't game tests**: Tests prove the system works, not that you can write tests that know how your code works. Black-box testing.
- **Compatibility is a migration, not architecture**: Change interfaces in convergent phases (add new → migrate consumers → remove old). Track the removal phase as a work item — compatibility code without a scheduled resolution is tech debt by another name.
- **Specs are immutable from Claude's side**: When a project has specs or acceptance criteria, code conforms to specs — never modify specs to make code pass. Specs change only when requirements change (user/stakeholder decision). Use [speclang](https://github.com/bamsammich/speclang) to define specifications when a project has no existing spec framework.

## Workflow Orchestration

### 1. Plan Mode Default

- Enter Plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately — don't keep pushing.
- Write detailed specs upfront to reduce ambiguity.

### 2. Subagent Strategy

- Use subagents liberally: offload research, exploration, and parallel work to keep main context clean.
- One task per subagent for focused execution.
- The orchestrator does not write production or test code unless orchestrator conversation context is essential to correctness. Delegate implementation to subagents; review their output.

### 3. Durable Work Tracking

- Define work in a persistent, human-accessible system (GitHub Issues, Linear, etc.) before implementation. Each unit of work should be reviewable and commentable by humans — this is how task-specific context flows back to Claude across sessions.
- In-session task tracking (TaskCreate) is for local progress only, never the source of truth.

### 4. Self-Improvement Loop

- MANDATORY: After ANY correction, update the memory file `lessons.md` with: what went wrong, why, and a prevention rule. Each lesson appears once — if the same mistake recurs, escalate the severity of the wording (e.g., "prefer X" → "ALWAYS X" → "NEVER do Y — this has failed multiple times").
- At session start, check `lessons.md` in memory if it exists. Apply these lessons throughout the session.
- After updating `lessons.md`, also mirror the content to `/lessons/projects/{project-name}.md` in the Obsidian vault via MCP. If MCP is unavailable, skip silently — the project's `lessons.md` is sufficient. Mirror on next available session.
- When mirroring a lesson, check `/lessons/synthesis/` in the vault for existing topic-organized living docs (e.g., `quality-gates.md`, `verification.md`). If the new lesson matches an existing theme, update that living doc — integrate the new content, don't just append. Include a backlink to the project lesson file. If no matching theme exists but the lesson represents a cross-project pattern, create a new living doc for it.
- Claude does NOT modify `~/.claude/CLAUDE.md` autonomously. The `/lessons/synthesis/` docs are a recommendation surface — flag patterns to the user for review and manual promotion to global rules.

### 5. Verification Before Done

- Unit tests passing is not verification. Prove the happy path works end-to-end — integration seams (wiring, plumbing, glue code) are where things break. If CI exists, `gh run watch --exit-status` before closing issues.
- Ask yourself: "Would a staff engineer approve this?"

### 6. Self-Review Before Presenting

- Before presenting non-trivial changes, check for: unnecessary indirection, duplicated patterns that should be extracted, and simpler approaches that achieve the same result.
- Skip for simple, obvious fixes.

## Knowledge Cache (Obsidian Vault)

Never redo investigation that's already been done. Research findings are stored in the Obsidian work vault via MCP, organized by project. The vault path is configured in the MCP server — these instructions are vault-agnostic.

### Rules (MANDATORY)

1. **BEFORE exploring**: Search the Obsidian vault via MCP (`search` or `complex_search`) for existing findings on the topic. If MCP is unavailable, check `docs/research/` locally as a fallback.
2. **AFTER non-trivial investigation** (3+ tool calls): Write a summary to `/research/{project-name}/{topic}.md` in the vault via MCP. Use lowercase kebab-case for filenames. Each file must be self-contained: date, project context, key findings, relevant file paths, and decisions made. For findings not tied to a specific project, use `/research/cross-project/{topic}.md`.
3. **Freshness**: When reading cached findings, verify key claims still hold before acting on them.
4. **MCP unavailable**: If MCP tools fail or are not available, fall back to writing `docs/research/{topic}.md` locally in the project repo. Warn the user: "Obsidian isn't available — writing research locally. Start Obsidian when you can so I can sync."
5. **Catch-up on session start**: If MCP is available, check for any `docs/research/*.md` files in the current project. If found, tell the user and migrate them to the vault — read each file, write to `/research/{project-name}/{topic}.md` via MCP, and delete the local copy only after confirming the MCP write succeeded. Proceed unless the user declines.

@RTK.md
