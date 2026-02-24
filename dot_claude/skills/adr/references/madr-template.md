# MADR Template

Use this exact structure. Omit optional sections only when they add zero value.

```markdown
---
status: {accepted | superseded by YYYYMMDD_<subject>.md}
date: YYYY-MM-DD
supersedes: YYYYMMDD_<subject>.md (delete if n/a)
---

# {Short title: problem and chosen solution}

## Context and Problem Statement

{2-3 sentences max. What architectural question are we facing and why?}

## Decision Drivers

* {driver 1}
* {driver 2}

## Considered Options

* {option 1}
* {option 2}

## Decision Outcome

Chosen option: "{option}", because {justification in 1-2 sentences}.

### Consequences

* Good, because {positive consequence}
* Bad, because {negative consequence}

## Pros and Cons of the Options (optional)

### {Option 1}

* Good, because {argument}
* Bad, because {argument}

### {Option 2}

* Good, because {argument}
* Bad, because {argument}
```
