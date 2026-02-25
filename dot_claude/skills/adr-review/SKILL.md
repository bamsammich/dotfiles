---
name: adr-review
description: Review implementation plans and completed work for compliance with existing Architectural Decision Records (ADRs). Auto-activate in two cases (only if docs/adr/ exists in the repo): (1) When a plan is being written or reviewed — review the plan before implementation. (2) After a plan has been fully executed — review the resulting code changes to verify no ADRs were violated. Also activate when the user explicitly asks to check against ADRs. Do NOT activate if the repo has no docs/adr/ directory. Runs as a subagent to keep ADR content out of the main context window.
---

# ADR Review

## Guard

Verify `docs/adr/` exists at the repo root. If it does not exist, skip silently.

## Trigger Points

1. **Pre-implementation**: When a plan is being written or reviewed, before work starts
2. **Post-implementation**: After a plan has been fully executed, before claiming completion

## How to Run

### Pre-implementation (plan review)

```
Task(
  description: "Review plan against ADRs",
  subagent_type: "adr-review",
  prompt: "Review the following plan for ADR compliance:\n\n<plan>\n{plan content}\n</plan>"
)
```

### Post-implementation (code review)

```
Task(
  description: "Review implementation against ADRs",
  subagent_type: "adr-review",
  prompt: "Review the implementation for ADR compliance. Examine the git diff of changes made during this work:\n\n<diff>\n{git diff output}\n</diff>"
)
```

For the post-implementation review, generate the diff with `git diff <base-commit>..HEAD` or `git diff --cached` as appropriate.

## Handling Results

The agent only reports deviations — it does not fix anything. When deviations are reported, the parent agent must surface them to the user and either:
1. **Write a new ADR** (using the `adr` skill) that supersedes the conflicting ADR — if the deviation is intentional
2. **Fix the implementation** to comply with the existing ADR — if the deviation is unintentional

Never silently proceed past deviations.
