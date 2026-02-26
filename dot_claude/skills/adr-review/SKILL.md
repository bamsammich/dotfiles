---
name: adr-review
description: >-
  Review plans and implementations for ADR compliance. Invoked at two
  mandatory gates defined in CLAUDE.md: (1) after writing a plan, before
  user approval, and (2) after implementation, before claiming completion.
  Only applies when docs/adr/ exists. Dispatches the adr-review agent as
  a subagent to keep ADR content out of the main context window.
---

# ADR Review

## Guard

Verify `docs/adr/` exists at the repo root. If it does not exist, skip silently.

## Trigger Points

These correspond to the mandatory review gates in CLAUDE.md:

1. **Pre-implementation**: After writing a plan, BEFORE presenting it for user approval or exiting plan mode
2. **Post-implementation**: After executing a plan, BEFORE the verification-before-completion checklist or claiming completion

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

### Deviations

The agent reports deviations — it does not fix anything. When deviations are reported, the parent agent must surface them to the user and either:
1. **Write a new ADR** (using the `adr` skill) that supersedes the conflicting ADR — if the deviation is intentional
2. **Fix the implementation** to comply with the existing ADR — if the deviation is unintentional

Never silently proceed past deviations.

### Uncovered Architectural Decisions

If the agent flags architectural choices not covered by any existing ADR, surface them to the user:

> "This plan introduces architectural decisions not covered by existing ADRs:
> - [decision summary]
> Would you like to create an ADR for any of these before proceeding?"

If the user says yes, invoke the `adr` skill. If no, proceed — the user decides when ADRs are created.
