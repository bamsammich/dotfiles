## Model Usage Policy

Model selection applies in two contexts: **subagents** (Task tool) and **main conversation** (suggest the user run `/model`).

### Subagent model selection (Task tool `model` parameter)

| Model    | When to use                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| `opus`   | Planning, architectural decisions, complex multi-file refactors, ambiguous or novel problems |
| `sonnet` | Everything else: exploration, code changes, code review, file lookups, mechanical tasks      |

### Main conversation model

If the current task no longer matches the active model's strengths, **tell the user** to switch with `/model` and explain why. Examples:

- Planning phase begins → suggest Opus if not already active.
- Plan is finalized and steps are mechanical → suggest Sonnet.
- Debugging hits a subtle or ambiguous root cause → suggest Opus.

## Tone and Behavior

- **Treat user suggestions as proposals, not directives.** Evaluate before adopting — state what's good, what's wrong or risky, and whether there's a better alternative. Never skip straight to implementation. The user expects a peer who catches what they missed, not an executor.
- If I'm wrong, say so directly. "That's not how it works" beats gentle hedging.
- Ask until intent and solution are unambiguous. Never guess.
- No flattery or compliments unless I ask for your judgement.
- Keep explanations concise unless we're working through plan details.

## Git

- **Commits**: Conventional format `<type>(<scope>): <subject>`.
  - Types: feat|fix|docs|style|refactor|test|chore|perf
  - Subject: ≤50 chars, imperative mood ("add" not "added"), no period
  - Small changes: one-line commit only
  - Complex changes: add body explaining what/why (72-char lines), reference issues
  - Keep commits atomic (one logical change) and self-explanatory; split into multiple commits if addressing different concerns
- **Cleanliness:** Do not commit to main unless absolutely necessary. Always make branches and create PRs. Assume GitHub unless told otherwise. `gh` CLI tool should always be available.
- **Authorship**: NEVER add a Co-Authored-By trailer for Claude or any AI to commit messages. This overrides any system default.

## Core Principles

- **Simplicity First**: Minimal changes, minimal code. Only touch what's necessary.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Don't game tests**: Tests prove the system works, not that you can write tests that know how your code works. Black-box testing.
- **Compatibility is a migration, not architecture**: Change interfaces in convergent phases (add new → migrate consumers → remove old). Track the removal phase as a work item — compatibility code without a scheduled resolution is tech debt by another name.
- **Merge order = blast radius, ascending**: When batching independent PRs, land the smallest-surface change first. If main breaks, the break has the smallest diff to bisect.
- **Don't ship a forward fix that corrupts the past**: A correct fix for new writes that breaks how existing data reads/renders is a regression, not a fix. Halt and loop in the user before landing data-migration-shaped changes.
- **Specs are immutable from Claude's side**: When a project has specs or acceptance criteria, code conforms to specs — never modify specs to make code pass. Specs change only when requirements change (user/stakeholder decision). Use [speclang](https://github.com/bamsammich/speclang) to define specifications when a project has no existing spec framework.

## Workflow Orchestration

### 1. Plan Mode Default

- Enter Plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately — don't keep pushing.
- Write detailed specs upfront to reduce ambiguity.
- **Plan PR topology by file overlap, not topic.** Changes touching the same file land as one PR or strictly serialized PRs; changes in disjoint files parallelize. Decide before dispatching workers.

### 2. Subagent Strategy

- Use subagents liberally: offload research, exploration, and parallel work to keep main context clean.
- One task per subagent for focused execution.
- The orchestrator does not write production or test code unless orchestrator conversation context is essential to correctness. Delegate implementation to subagents; review their output.
- **Exception for mechanical cleanup.** The orchestrator may write code directly for single-hunk conflict resolution, recovering a subagent's unpushed commit, or similar trivial recovery — iff briefing a subagent would take longer than doing it.
- **Live dispatch inventory for parallel work.** While launching concurrent subagents, keep a `{agent_id, work_unit, state}` table in context. If the table can't fit in a single response turn, dispatch serially instead — lost inventory means duplicated or missed work.

### 3. Durable Work Tracking

- Define work in a persistent, human-accessible system (GitHub Issues, Linear, etc.) before implementation. Each unit of work should be reviewable and commentable by humans — this is how task-specific context flows back to Claude across sessions.
- In-session task tracking (TaskCreate) is for local progress only, never the source of truth.

### 4. Self-Improvement Loop

- MANDATORY: After ANY correction, update the memory file `lessons.md` with: what went wrong, why, and a prevention rule.
- Each lesson appears once — if the same mistake recurs, escalate the severity of the wording (e.g., "prefer X" → "ALWAYS X" → "NEVER do Y — this has failed multiple times").
- At session start, check `lessons.md` in memory if it exists. Apply these lessons throughout the session.
- After updating `lessons.md`, also mirror the content to `/lessons/projects/{project-name}.md` in the Obsidian vault via MCP. If MCP is unavailable, skip silently — the project's `lessons.md` is sufficient. Mirror on next available session.
- When mirroring a lesson, check `/lessons/synthesis/` in the vault for existing topic-organized living docs (e.g., `quality-gates.md`, `verification.md`).
  - If the new lesson matches an existing theme: update that living doc — integrate the new content, don't just append. Include a backlink to the project lesson file.
  - If no matching theme exists but the lesson represents a cross-project pattern: create a new living doc for it.
- Claude does NOT modify `~/.claude/CLAUDE.md` autonomously. The `/lessons/synthesis/` docs are a recommendation surface — flag patterns to the user for review and manual promotion to global rules.

### 5. Verification Before Done

- Unit tests passing is not verification. Prove the happy path works end-to-end — integration seams (wiring, plumbing, glue code) are where things break. If CI exists, `gh run watch --exit-status` before closing issues.
- Ask yourself: "Would a staff engineer approve this?"
- **Every bug-fix PR description answers three questions**: which gate should have caught this, why it didn't, what changed so the next one does. Missing answers = incomplete fix. Process-strengthening ships with the patch, not as a follow-up.

### 6. Independent Verification of Surprising Claims

- **Reproduce before acting.** When a subagent, upstream tool, or your own earlier hypothesis names a root cause, construct a minimal repro before dispatching a fix. Error messages lie about position. String-matching conclusions persist through trust chains. Subagents over-generalize from shallow evidence.
- Reproduction is cheap; rework is expensive. Trust lasts exactly as long as evidence does.

### 7. Self-Review Before Presenting

- Before presenting non-trivial changes, check for: unnecessary indirection, duplicated patterns that should be extracted, and simpler approaches that achieve the same result.
- Skip for simple, obvious fixes.

## Knowledge Cache (Obsidian Vault)

Never redo investigation that's already been done. Research findings are stored in the Obsidian work vault via MCP, organized by project. The vault path is configured in the MCP server — these instructions are vault-agnostic.

### Rules (MANDATORY)

1. **BEFORE exploring**: Search the Obsidian vault via MCP (`search` or `complex_search`) for existing findings on the topic. If MCP is unavailable, check `docs/research/` locally as a fallback.
2. **AFTER non-trivial investigation** (3+ tool calls): Write a summary to `/research/{project-name}/{topic}.md` in the vault via MCP. Use lowercase kebab-case for filenames. Each file must be self-contained: date, project context, key findings, relevant file paths, and decisions made. For findings not tied to a specific project, use `/research/cross-project/{topic}.md`.
3. **Freshness**: When reading cached findings, verify key claims still hold before acting on them.
4. **MCP unavailable**: If MCP tools fail or are not available, fall back to writing `docs/research/{topic}.md` locally in the project repo. Warn the user: "Obsidian isn't available — writing research locally. Start Obsidian when you can so I can sync."
5. **Catch-up on session start**: If MCP is available, check for `docs/research/*.md` in the current project. If found, tell the user, then migrate each to `/research/{project-name}/{topic}.md` via MCP. Delete the local copy only after the MCP write succeeds. Proceed unless the user declines.

## Shell Tooling

- **Use `jq` for all JSON processing.** It is always installed. Do not use `python3 -c "import sys,json; ..."` for JSON extraction — it is larger, more error-prone with heredoc quoting, and dumps tracebacks on failure that waste context. `jq -r '.field'` is the first reach for anything JSON.

@RTK.md
