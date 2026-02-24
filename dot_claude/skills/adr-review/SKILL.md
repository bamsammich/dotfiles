---
name: adr-review
description: Review implementation plans for compliance with existing Architectural Decision Records (ADRs). Auto-activate when a plan is being written or reviewed AND a docs/adr/ directory exists in the current git repo. Also activate when the user explicitly asks to check a plan against ADRs. Do NOT activate if the repo has no docs/adr/ directory. Runs as a subagent to keep ADR content out of the main context window.
---

# ADR Plan Review

## Activation Check

Before activating, verify `docs/adr/` exists at the repo root. If it does not exist, skip silently.

## How to Run

Launch the `adr-review` agent as a subagent, passing the plan content:

```
Task(
  description: "Review plan against ADRs",
  subagent_type: "general-purpose",
  model: "sonnet",
  prompt: "/agents adr-review\n\nReview the following plan:\n\n<plan>\n{plan content}\n</plan>"
)
```

## Handling Results

When the agent reports deviations, the user must either:
1. **Write a new ADR** (using the `adr` skill) that supersedes the conflicting ADR — if the deviation is intentional
2. **Revise the plan** to comply with the existing ADR — if the deviation is unintentional

Never silently proceed past deviations. Always surface them to the user.
