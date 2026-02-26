---
name: adr
description: Generate Architectural Decision Records (ADRs) in MADR format. Invoke when the user requests an ADR or when the adr-review skill surfaces uncovered architectural decisions and the user agrees to record them. Do NOT auto-create ADRs without user approval. ADRs are written to docs/adr/ in the current git repository.
---

# Architectural Decision Records

Record architectural decisions as concise MADR documents in `docs/adr/` within the current repo.

## Workflow

1. **Notify early**: As soon as an architectural choice is identified, tell the user an ADR will be needed. Do not wait until the end of planning.
2. **Collaborate on the decision**: If the decision involves choices (e.g., which database, which framework), work through the options with the user before drafting. If the choice was already made during planning, confirm it.
3. **Draft**: Write the ADR using the MADR template in [references/madr-template.md](references/madr-template.md)
4. **Check supersession**: Read existing ADRs in `docs/adr/` to determine if this decision supersedes a previous one
5. **Present**: Show the draft ADR to the user for approval
6. **Write before implementation**: On approval, write the ADR file and update OVERVIEW.md. ADRs MUST be committed before any implementation work begins.
7. **Verify gitignore**: Ensure `docs/adr/` is not gitignored

## File Conventions

- **Location**: `docs/adr/` at the repo root (create if missing via `mkdir -p`)
- **Filename**: `YYYYMMDD_<subject>.md` — use today's date, lowercase snake_case subject
  - Example: `20260224_use_postgresql_for_persistence.md`
- **OVERVIEW.md**: `docs/adr/OVERVIEW.md` — always regenerate after writing/superseding an ADR

## Conciseness Rules

ADRs MUST be as short as possible. Target guidelines:
- Context: 2-3 sentences max
- Decision Drivers: 2-4 bullets
- Options: 2-4 options, one line each in the Considered Options list
- Decision Outcome: 1-2 sentences
- Consequences: 2-4 bullets total
- Pros/Cons: Only include if the tradeoff is non-obvious; omit if Decision Outcome justification is sufficient

## Supersession

- When a new ADR supersedes an existing one, set `supersedes: YYYYMMDD_<subject>.md` in the new ADR's frontmatter
- Update the superseded ADR's frontmatter status to `superseded by YYYYMMDD_<subject>.md`
- ADRs merged into the default branch are **immutable** — never edit their content, only update the `status` field when superseded

## OVERVIEW.md Format

Regenerate the full file each time. List only **active** (non-superseded) ADRs:

```markdown
# Architectural Decision Records

| Date | Decision | Supersedes |
|------|----------|------------|
| YYYY-MM-DD | [Short title](YYYYMMDD_<subject>.md) | [Previous title](YYYYMMDD_<prev>.md) or — |
```

## Gitignore Check

After writing, verify `docs/adr/` is not excluded:
1. Run `git check-ignore docs/adr/OVERVIEW.md`
2. If ignored, warn the user and suggest removing the relevant gitignore pattern
