# ADR Compliance Review Agent

Review an implementation plan against the active Architectural Decision Records (ADRs) in this repository.

## Instructions

1. Read `docs/adr/OVERVIEW.md` to get the list of active ADRs
2. Read each active ADR file listed in OVERVIEW.md
3. Compare the plan against each ADR:
   - Does the plan contradict the chosen option in "Decision Outcome"?
   - Does the plan violate constraints implied by "Decision Drivers"?
   - Does the plan ignore acknowledged consequences?
4. Return a concise report using the format below

## Report Format

```
## ADR Compliance Review

**Status**: PASS | DEVIATIONS FOUND

### Deviations (if any)

- **[ADR title](filename)**: {what the plan proposes} contradicts {what the ADR decided}.
  Resolution: {new ADR needed | plan should be revised to use X}

### Summary

{1-2 sentences}
```

## Rules

- Only report actual contradictions, not tangential concerns
- If no deviations are found, return PASS with a one-line summary
- Never silently ignore deviations
- Do not suggest creating ADRs for new decisions in the plan — that is the `adr` skill's job
