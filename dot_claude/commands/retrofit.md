# Command: /retrofit

## Purpose

Bring a project into compliance with the universal autonomous development workflow defined in `/bootstrap-greenfield`. Works in two modes:

- **Sync mode** (project was bootstrapped with `/bootstrap-greenfield`): Detect drift between the project's current skills, commands, CLAUDE.md workflow sections, and constitution structure against the canonical templates. Generate an update plan.
- **Onboard mode** (brownfield project not yet using this workflow): Analyze the existing codebase and incrementally introduce the scaffold without disrupting working code.

## Mode detection

Determine mode automatically:

1. If `specs/constitution.md` exists AND `.claude/skills/testing-philosophy.md` exists → **Sync mode**
2. Otherwise → **Onboard mode**
3. If ambiguous, ask the human.

---

## Sync mode

### Step 1: Read the canonical templates

Read the `/bootstrap-greenfield` command from `~/.claude/commands/bootstrap-greenfield.md`. Extract the universal (non-`[PROJECT-SPECIFIC]`) sections:

- Testing philosophy (all 5 layers, authorship table)
- Implement command (pre-implementation gates, test scoping)
- Plan command
- Specify command
- Amend, impact, review-adrs, record-fixtures commands
- CLAUDE.md sections 4–8 (architecture invariants, testing rules, workflow rules, details table, reminders)
- Constitution universal principles (1–5)
- Spec evolution skill
- ADR workflow skill
- CI pipeline gate order

### Step 2: Diff against project files

For each universal section, compare the canonical version against the project's current file. Identify:

- **Missing content**: rules, gates, or workflow steps present in the canonical template but absent from the project file
- **Contradictions**: project file says something that conflicts with the canonical template
- **Additions**: project-specific content that should be preserved (port names, requirements, domain principles)
- **Structural drift**: sections reordered, renamed, or merged in ways that break the expected structure

### Step 3: Generate update plan

Present a structured report:

```
## Retrofit Sync Report

### Files requiring updates:
1. `.claude/skills/testing-philosophy.md`
   - MISSING: Authored by field on Layer 1
   - MISSING: Summary authorship table
   - CONTRADICTION: Layer 1 mentions property-based tests (should be Layer 4 only)

2. `.claude/commands/implement.md`
   - MISSING: Pre-implementation gate (step 2)
   - MISSING: Explicit test type scoping (step 4)

3. `CLAUDE.md`
   - MISSING: `/specify` gate in "Before writing any code" section
   - DRIFT: Implementing section doesn't match implement.md command

### Files in compliance:
- `.claude/commands/plan.md` ✓
- `.claude/skills/adr-workflow.md` ✓
- (etc.)

### Project-specific content preserved:
- Port definitions in CLAUDE.md Section 4
- Domain principles 6-8 in constitution.md
- All requirement specs, plans, amendments, research
```

### Step 4: Apply updates

Ask the human: "Apply all updates? Or review individually?"

- If apply all: make all changes, preserving project-specific content. Commit with message: "retrofit: sync with bootstrap-greenfield canonical templates"
- If review individually: present each change as a before/after diff. Apply only approved changes.

### Step 5: Impact check

After applying updates, run `/review-adrs` to verify no ADR contradictions were introduced. If the testing philosophy or implement command changed in ways that affect existing tests, warn the human about which test files may need review.

---

## Onboard mode

### Step 1: Analyze existing project

Scan the codebase and document:

- **Language and stack**: Detect from package.json, pyproject.toml, go.mod, Cargo.toml, etc.
- **Existing test structure**: Where tests live, what framework, what coverage
- **External dependencies**: Identify SDK imports, API clients, database connections
- **Existing documentation**: README, ADRs, any spec files, architecture docs
- **Code structure**: Is there already separation between business logic and integrations? Identify coupling points.

Save findings to `docs/research/retrofit-analysis.md`.

### Step 2: Present onboarding plan

Generate a phased plan. Each phase is independently valuable — the human can stop at any phase and still have a better project.

**Phase 1 — Foundation (no code changes)**

- Create `CLAUDE.md` with architecture invariants and workflow rules, tailored to detected stack
- Create `.claude/commands/` with all command files
- Create `.claude/skills/` with all skill files
- Create `specs/constitution.md` with universal + detected domain principles
- Create `specs/requirements/_index.md` — initially empty, human populates
- Create `docs/adr/_template.md`
- Create `docs/research/` with the retrofit analysis

**Phase 2 — Retroactive ADRs (no code changes)**

- Scan codebase for architectural decisions embedded in code
- Generate ADR drafts for: framework choice, database choice, API integration patterns, authentication approach, deployment model, and any other significant decisions found
- Present each ADR to human for review and approval

**Phase 3 — Port extraction (minimal code changes)**

- Identify external dependency boundaries in existing code
- Generate port interface definitions in `src/ports/` (or equivalent for the project's structure) that describe the current adapter behavior
- Do NOT refactor adapters to use ports yet — just define the interfaces
- Present interfaces to human for review

**Phase 4 — Test infrastructure (additive only)**

- Create `tests/fixtures/` directory structure matching identified external dependencies
- Create `tests/contracts/schemas/` with consumer contracts derived from any existing test mocks or recorded responses
- Create `tests/properties/` placeholder — human will populate from specs
- Tell human to run `/record-fixtures` for each external dependency
- Do NOT modify existing tests

**Phase 5 — Incremental migration (code changes, opt-in per module)**

- For each module the human selects:
  - Refactor to use port interfaces
  - Move business logic to `src/core/` (or equivalent)
  - Move SDK-dependent code to `src/adapters/` (or equivalent)
  - Add unit tests for extracted core logic
  - Verify existing tests still pass
- Each module migration is a separate commit
- After each module: update `docs/adr/` if new decisions were made

### Step 3: Execute approved phases

Ask the human which phases to execute now. Execute them in order. Each phase ends with a commit and a summary of what was done and what the human needs to do next.

For Phase 1, also ask:

- Are there domain-specific constitutional principles to add? (e.g., security, compliance, data handling)
- Any existing documentation that should be migrated to `docs/research/`?

---

## Post-retrofit

Regardless of mode, after completing:

1. Run the full test suite to confirm nothing was broken
2. Print a summary of changes made
3. If onboard mode: remind the human of remaining phases if not all were completed
4. Commit with descriptive message
