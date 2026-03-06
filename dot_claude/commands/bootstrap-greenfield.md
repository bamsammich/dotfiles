# Command: /bootstrap-greenfield

## Purpose

Generate a complete, tailored bootstrap prompt the human pastes into a new Claude Code session in an empty project directory. The output prompt produces a repository scaffold — not application code — optimized for fully autonomous AI development.

## Inputs to collect

Before generating anything, ensure you have ALL of the following. Ask the human for anything missing — do not infer.

1. **Project description**: What does the system do, in 2-3 sentences?
2. **External dependencies**: What APIs, databases, services, or SDKs does the system interact with? For each: is there a reliable OpenAPI spec, a sandbox/test mode, or neither?
3. **Runtime AI usage**: Does the system itself use an LLM as part of its functionality (not just as a development tool)? If yes: what decisions does the LLM make, and what happens when the LLM is unavailable or wrong?
4. **Tech stack preferences**: Language, framework, package manager, test runner, CI platform.
5. **Prior research**: Has the human already completed research, spikes, or prototyping? If yes, each piece will become a file in `docs/research/` during scaffold generation.
6. **Known constraints**: Regulatory, performance, security, or compatibility requirements that must become constitutional principles.

## Generation procedure

Given collected inputs, generate the bootstrap prompt below. Sections marked `[PROJECT-SPECIFIC]` are tailored to the project. Everything else is reproduced verbatim in every project.

---

## OUTPUT: The bootstrap prompt

Generate the following as a single copyable prompt:

````
You are bootstrapping a new project for fully autonomous AI development. Your job is to create the project scaffold — the "operating system" that will govern all future AI development sessions. Do NOT write any application code yet.

The project: [PROJECT-SPECIFIC: Generate a single dense sentence capturing what the system does, what it ingests, what external systems it talks to, whether it uses AI at runtime, and what it outputs.]

## PHASE 1: Create the directory structure

```
.
├── CLAUDE.md
├── .claude/
│   ├── local.md
│   ├── commands/
│   │   ├── plan.md
│   │   ├── specify.md
│   │   ├── implement.md
│   │   ├── amend.md
│   │   ├── impact.md
│   │   ├── review-adrs.md
│   │   └── record-fixtures.md
│   └── skills/
│       ├── testing-philosophy.md
│       ├── hexagonal-architecture.md
│       ├── spec-evolution.md
│       └── adr-workflow.md
├── scripts/
│   └── (build/CI helper scripts go here)
├── specs/
│   ├── constitution.md
│   ├── requirements/
│   │   ├── _index.md
│   │   └── (feature specs go here)
│   ├── design/
│   │   ├── architecture.md
│   │   └── port-contracts/
│   ├── scenarios/
│   │   ├── _schema.json
│   │   ├── _index.md
│   │   └── (scenario YAML files go here)
│   ├── plans/
│   └── amendments/
├── docs/
│   ├── adr/
│   │   ├── _template.md
│   │   └── 0001-initial-architecture.md
│   └── research/
│       └── (research findings captured during development)
├── src/
│   ├── core/
│   ├── ports/
│   └── adapters/
│       [PROJECT-SPECIFIC: One subdirectory per external dependency]
├── tests/
│   ├── unit/
│   ├── properties/
│   ├── integration/
│   ├── contracts/
│   │   └── schemas/
│   └── fixtures/
│       ├── _cassette-schema.json
│       └── [PROJECT-SPECIFIC: One subdirectory per external dependency, matching adapters/]
└── .github/
    └── workflows/
        └── ci.yml
```

## PHASE 2: Write the CLAUDE.md (root, under 200 lines)

Structure it in this exact order:

### Section 1: Project purpose (1 line)
[PROJECT-SPECIFIC: What the system does.]

### Section 2: Tech stack (3-5 lines)
[PROJECT-SPECIFIC: Language, framework, key dependencies, test runner, mutation testing tool.]

### Section 3: Commands (copy-pasteable)
```bash
[PROJECT-SPECIFIC: build, lint, and test commands for the chosen stack]
```
Include these test targets regardless of stack:
- test:unit — Core logic only, no mocks, no network
- test:props — Property-based tests (100 examples default)
- test:contract — Consumer contract validation per adapter
- test:int — Integration tests with recorded fixtures
- test:mutate — Mutation testing on src/core/ (target: 70%+)
- test:check-fixtures — Fail if any cassette in tests/fixtures/ is past its TTL
- validate-scenarios — Validate scenario YAML traceability (fixtures, properties, requirements)
- record-fixtures — Record or re-record API cassettes (human execution required)

### Section 4: Architecture invariants (reproduce verbatim)

This project uses hexagonal (ports & adapters) architecture. This is the most important structural rule.

**`src/core/`**: Pure business logic. Zero imports from `src/adapters/` or any external SDK. Core only depends on port interfaces defined in `src/ports/`. If you are tempted to import an SDK here, you are violating the architecture — define a port interface instead.

**`src/ports/`**: Interfaces defining contracts with the outside world. Ports define WHAT the outside world does, never HOW.

[PROJECT-SPECIFIC: List each port by name with a one-line description of its responsibility.]

**`src/adapters/<service>/`**: Implementations of port interfaces. Each adapter is independently replaceable and testable.

**Dependency rule:**
```
core/ ──depends on──▶ ports/ (interfaces only)
adapters/ ──implements──▶ ports/
adapters/ ──imports──▶ external SDKs

core/ NEVER imports from adapters/
core/ NEVER imports external SDKs
adapters/ NEVER import from each other
```

### Section 5: Testing rules (reproduce verbatim)

These are non-negotiable. Read `.claude/skills/testing-philosophy.md` for full details.

- `tests/unit/` — tests `src/core/` only. No mocks. Pure input → output.
- `tests/properties/` — invariants derived from specs. Express WHAT, never HOW. Never reference implementation internals.
- `tests/contracts/` — validate each adapter's API calls against consumer contracts in `tests/contracts/schemas/`.
- `tests/integration/` — use ONLY recorded fixtures from `tests/fixtures/`. Never invent API responses.
- Never delete or weaken a failing test. Fix the code. If stuck, stop and ask the human.
- Never create synthetic external API responses. All fixtures come from real recordings via `/record-fixtures`.
- Scenario definitions in `specs/scenarios/*.scenarios.yaml` are authored by humans. AI may not create or modify them.

### Section 6: Workflow rules (reproduce verbatim)

**Before writing any code:**
1. Read `specs/requirements/_index.md` — know what's built and what isn't
2. Ensure the target requirement has a complete spec file. If not, run `/specify` first.
3. Ensure scenarios exist in `specs/scenarios/` for the target requirement. If not, run `/specify` first.
4. Run `validate-scenarios` to confirm traceability links are complete.
5. Read relevant spec files for the feature you're working on
6. Read `docs/adr/` — every accepted ADR is a constraint you must respect
7. Search `docs/research/` for findings relevant to the current task
8. If anything in the spec is ambiguous or seems wrong: STOP and ask the human

**Planning (`/plan`):**
1. Search `docs/research/` for findings relevant to this requirement
2. If investigation is needed for unfamiliar dependencies or patterns, conduct it and save to `docs/research/` before finalizing the plan
3. Decompose the requirement into a task DAG
4. For each task: specify files to create/modify, tests to write, ports involved
5. Save to `specs/plans/<req-id>.md` with checkboxes
6. Run `/review-adrs` — verify plan doesn't contradict existing decisions
7. Present to human for approval. Do not implement without approval.

**Implementing (`/implement`):**
1. Verify pre-requisites before writing code:
   - Scenarios for this requirement MUST exist in `specs/scenarios/`. If missing, stop and tell the human to run `/specify`.
   - Property-based tests MUST already exist in `tests/properties/`. If missing, stop and tell the human.
   - Recorded fixtures for external APIs MUST already exist in `tests/fixtures/`. If missing, stop and tell the human to run `/record-fixtures`.
   - Consumer contract schemas MUST already exist in `tests/contracts/schemas/`. If missing, stop and tell the human.
   - Run `validate-scenarios` to confirm traceability links are complete.
2. Work through plan tasks in dependency order
3. Write code, then write ONLY unit tests and integration test cases (never property tests, contract schemas, or fixtures)
4. Run the full test suite
5. Tests pass → check off task, commit with descriptive message referencing requirement ID
6. Tests fail → fix code (never weaken tests). If stuck after 2 attempts, ask human.
7. If the resolution involved learning something about external system behavior, library usage, or a non-obvious pattern, save findings to `docs/research/`
8. After all tasks: update `specs/requirements/_index.md` status

**Changing specs (`/amend`):**
1. Human describes the change and rationale
2. Run `/impact` to identify all affected code, tests, specs, and ADRs
3. Generate amendment checklist at `specs/amendments/<id>.md`
4. Do not implement until human approves the amendment
5. Work through checklist items — each is checked off as completed

**When to write an ADR:**
- New external dependency or service integration
- Change to any port interface
- Data model change that crosses port boundaries
- Any non-obvious decision where alternatives were considered
- Write the ADR FIRST, get human approval, THEN implement

**Research capture:**
- Before investigating ANY technical question, search `docs/research/` for existing findings first
- After ANY investigation (API behavior, library evaluation, debugging root cause, architectural spike), create or update a file in `docs/research/`
- Reference research files in ADRs, specs, and plan files where applicable
- Never re-derive what has already been captured. If a research file exists, use it.

### Section 7: Where to find details (reproduce verbatim, as table)

| Topic | Location |
|-------|----------|
| Testing stack details | `.claude/skills/testing-philosophy.md` |
| Port/adapter patterns | `.claude/skills/hexagonal-architecture.md` |
| Spec change process | `.claude/skills/spec-evolution.md` |
| ADR format and rules | `.claude/skills/adr-workflow.md` |
| Project constitution | `specs/constitution.md` |
| Requirements registry | `specs/requirements/_index.md` |
| Scenario specs | `specs/scenarios/` |
| Architecture decisions | `docs/adr/` |
| Research & findings | `docs/research/` |
| Active plans | `specs/plans/` |
| Pending amendments | `specs/amendments/` |
| Custom commands | `.claude/commands/` |

### Section 8: Reminders (reproduce verbatim)

- You are not the specification author. The human writes specs. You write code that fulfills them.
- If a requirement is missing, don't infer — ask.
- Every commit message should reference the requirement ID (e.g., `REQ-001: implement event listener`).
- After completing any plan, re-read `docs/adr/` to confirm nothing was contradicted.
- Expired fixtures (>30 days old) will fail CI. Tell the human to run `/record-fixtures`.

## PHASE 3: Write the skill files

### .claude/skills/testing-philosophy.md

Write this file with the following content:

**Layer 1 — Unit tests on core (example-based, no mocks at all)**
Core logic is pure functions/state machines. Test specific inputs → expected outputs directly.
These are example-based tests: concrete scenarios with concrete assertions. Property-based tests are a separate layer (Layer 4).
Mutation testing must achieve 70%+ score on `src/core/`.
Location: `tests/unit/`. Target: `src/core/` only. Mocks: none.
Authored by: **AI during `/implement`** — validated by mutation testing and the other four layers.

**Layer 2 — Integration tests with recorded fixtures**
All external API interactions use VCR cassettes (recorded from real services).
Cassettes have a 30-day TTL metadata field. Expired cassettes fail CI with a message to re-record.
AI may write new test CASES using existing cassettes. AI may NEVER create synthetic API response payloads.
New API interactions require a human to run `/record-fixtures` against real services.
Location: `tests/integration/`. Fixtures: `tests/fixtures/<service>/<scenario>.json`.
Cassette envelope format:
```json
{
  "meta": {
    "recorded_at": "ISO-8601",
    "ttl_days": 30,
    "service": "<adapter-name>",
    "scenario": "<scenario-id>",
    "recorded_by": "human",
    "api_version": "<api-version>"
  },
  "interactions": [
    {
      "request": { "method": "GET", "url": "...", "headers": {}, "body": null },
      "response": { "status": 200, "headers": {}, "body": {} }
    }
  ]
}
```
Cassettes are validated against `tests/fixtures/_cassette-schema.json`.
Authored by: **Fixtures recorded by human. Test cases written by AI during `/implement`** using only existing fixtures.

**Layer 3 — Contract tests per adapter**
Each adapter has a consumer contract (JSON Schema) derived from recorded fixtures.
Every outgoing API call is validated against the contract.
Contract violations fail the build.
Location: `tests/contracts/`. Schemas: `tests/contracts/schemas/`.
Authored by: **Human** — schemas derived from recorded fixtures or official specs. AI never creates or modifies contract schemas.

**Layer 4 — Property-based tests from specs**
Each spec in `specs/scenarios/` maps to property tests.
Properties express WHAT should be true, never HOW.
Property-based tests use the chosen framework to generate random valid inputs and check invariants hold.
Location: `tests/properties/`.
Authored by: **Human** — derived from requirement specs and scenario definitions. AI never writes or modifies property-based tests.

**Layer 5 — Semantic evaluation (async, non-blocking)**
[PROJECT-SPECIFIC: Only include this layer if the system uses AI at runtime.]
LLM output quality is evaluated by a benchmark suite of golden scenarios.
Results are tracked but don't block CI. Regressions create issues.
Authored by: **Human** — golden scenarios are curated and approved. AI never writes or modifies evaluation benchmarks.

**Summary: who writes what**

| Layer | Test type | Authored by | AI may modify? |
|-------|-----------|-------------|----------------|
| 1 | Unit tests (example-based) | AI | Yes |
| 2 | Integration test cases | AI | Cases only, never fixtures |
| 3 | Contract schemas | Human | No |
| 4 | Property-based tests | Human | No |
| 5 | Semantic eval benchmarks | Human | No |
| — | Scenario definitions (YAML) | Human | No |

### .claude/skills/hexagonal-architecture.md

Write this file explaining the port/adapter pattern concretely for this project:
[PROJECT-SPECIFIC: List each port by name, its responsibility, and its key operations.]
- Core depends ONLY on port interfaces
- Each adapter is independently replaceable and testable
- Include concrete interface examples in the project's chosen language for each port

### .claude/skills/spec-evolution.md

Write this file with the following content:

When a spec needs to change:
1. Human describes the change and rationale
2. `/amend` command is invoked, which:
   a. Appends an amendment entry to the spec with date, rationale, and diff
   b. Runs `/impact` to identify all affected files (code, tests, other specs, ADRs)
   c. Generates an impact report listing: files to modify, tests to update, new tests needed
   d. Creates a checklist in a tracking file (`specs/amendments/<id>.md`)
3. Implementation proceeds against the checklist — each item is checked off
4. Amendment is not "complete" until all checklist items are resolved

Impact analysis heuristic:
- Search codebase for imports/references to types defined in the changed spec
- Check all test files that reference the changed feature
- Check all ADRs that reference the changed spec
- Check all other specs that depend on the changed spec
- Check all research files that reference the changed spec
- List all findings with file paths and line numbers

### .claude/skills/adr-workflow.md

Write this file with the following content:

ADRs are required for:
- Any new external dependency or service integration
- Any change to port interfaces
- Any data model change that crosses port boundaries
- Any deviation from patterns established in existing ADRs
- Any non-obvious technical decision where alternatives were considered

ADR format:
- Title, Date, Status (proposed/accepted/superseded)
- Context: what problem or decision point arose
- Decision: what was chosen and why
- Consequences: what this enables and what it constrains
- Alternatives considered: what was rejected and why
- References: link to relevant research files in `docs/research/`

After planning and after implementation, Claude MUST review all ADRs to verify the plan/code doesn't contradict existing decisions. If it does, either the ADR needs superseding (requires human approval) or the plan needs revision.

## PHASE 4: Write the command files

### .claude/commands/specify.md

Write this command file:

This command creates or updates requirement specifications. It handles four invocation patterns:

**Pattern 1: `/specify`** (no arguments)
1. Ask the user: "Are we writing a specification for an existing requirement or a new one?"
2. If existing: show the requirements table from `specs/requirements/_index.md` and ask which REQ to specify
3. If new: ask the user to describe the requirement in their own words
4. Proceed to the guided questionnaire (below)

**Pattern 2: `/specify <requirements text>`** (free-form input, no REQ ID)
1. Read `specs/requirements/_index.md`
2. Determine if the provided text matches an existing requirement title/description
3. If match found: confirm with the user — "This looks like it corresponds to REQ-NNN: <title>. Is that correct?"
4. If no match: propose a new REQ ID (next available number) and a draft title derived from the input
5. Confirm with the user before proceeding
6. Use the provided text as initial input and proceed to the guided questionnaire, skipping questions already answered by the input

**Pattern 3: `/specify REQ-NNN`** (REQ ID only)
1. Confirm the REQ ID exists in `specs/requirements/_index.md`
2. If it doesn't exist, ask if the user wants to create it
3. If the spec file already exists, show current content and ask what the user wants to add or change
4. Proceed to the guided questionnaire

**Pattern 4: `/specify REQ-NNN <requirements text>`** (REQ ID + free-form input)
1. Confirm the REQ ID exists in `specs/requirements/_index.md`
2. Use the provided text as initial input
3. Proceed to the guided questionnaire, skipping questions already answered by the input

**Guided questionnaire — ask only what's missing from user-provided input:**

1. **User story**: "As a [user], I want to [action] so that [outcome]." — Ask if not provided.
2. **Acceptance criteria**: Elicit specific behaviors in EARS format (When \<trigger\>, the system shall \<response\>). Ask for each distinct behavior. Probe for error/edge cases: "What should happen when [input is malformed / service is unavailable / data is missing]?"
3. **Invariants**: Properties that must ALWAYS hold for this feature regardless of input. Ask: "What must always be true about this feature's behavior, no matter what?"
4. **Edge cases**: Explicitly enumerate known edge cases. Ask: "What unusual, boundary, or adversarial inputs should we consider?"
5. **Dependencies**: Which other REQs must be implemented first? Cross-reference `specs/requirements/_index.md`.
6. **Scenarios**: Propose concrete test scenarios and ask the user to confirm or adjust. Each scenario becomes an entry in `specs/scenarios/`.

**Status check — before writing:**

Read the REQ's current status from `specs/requirements/_index.md`:
- **not-started**: Create the spec file normally.
- **in-progress** or **completed**: Warn the user that this requirement has existing implementation. Ask: "This requirement is currently [status]. Updating the spec will require changes to existing code and tests. Proceed?" If yes, write the updated spec and then run `/impact` to identify all affected artifacts. Present the impact report to the user.

**Output:**

1. Present the complete draft requirement spec to the user for final review
2. Do NOT write the file until the user explicitly approves
3. On approval: write `specs/requirements/req-NNN.md`, update `specs/requirements/_index.md` (set status, spec file path)
4. If scenarios were confirmed, write them as `specs/scenarios/req-NNN.scenarios.yaml` (validated against `specs/scenarios/_schema.json`) and update `specs/scenarios/_index.md` to reference the YAML file
5. If the REQ was in-progress or completed: include the impact report and ask if the user wants to create an amendment checklist via `/amend`

### .claude/commands/plan.md

Write this command file:

Read the full `specs/` directory and `docs/adr/` directory. Search `docs/research/` for findings relevant to the target requirement. Identify which requirements are not yet implemented (check `specs/requirements/_index.md`). For the requirement(s) the human specifies:
1. If investigation is needed for unfamiliar dependencies or patterns, conduct it and save to `docs/research/` before proceeding
2. Decompose into tasks as a DAG — identify which tasks depend on which
3. For each task: specify files to create/modify, tests to write, port interfaces involved
4. Save the plan to `specs/plans/<requirement-id>.md` with task checkboxes
5. Run `/review-adrs` to check for contradictions
6. Present the plan to the human for approval before any implementation

### .claude/commands/implement.md

Write this command file:

Read the plan file specified by the human (or the current active plan). For each unchecked task in dependency order:
1. Read relevant specs, ADRs, research files, and existing code
2. **Verify pre-requisites before writing code:**
   - Scenarios for this requirement MUST exist in `specs/scenarios/`. If missing, stop and tell the human to run `/specify` to define scenarios.
   - Property-based tests for this requirement MUST already exist in `tests/properties/` (derived from specs via `/specify`). If missing, stop and tell the human to define spec invariants first.
   - Recorded fixtures for any external APIs this task touches MUST already exist in `tests/fixtures/`. If missing, stop and tell the human to run `/record-fixtures`.
   - Consumer contract schemas for involved adapters MUST already exist in `tests/contracts/schemas/`. If missing, stop and tell the human to derive them from recorded fixtures.
   - Run `validate-scenarios` to confirm traceability links are complete.
3. Write/modify code following hexagonal architecture rules
4. **Write/modify ONLY these test types:**
   - Unit tests in `tests/unit/` — pure input → output tests on `src/core/`. No mocks.
   - Integration test *cases* in `tests/integration/` — new test scenarios using ONLY existing recorded fixtures. Never create synthetic API responses.
   - Do NOT write or modify property-based tests, contract schemas, or fixture data.
5. Run the full test suite
6. If tests pass: check off the task in the plan, commit with a descriptive message referencing the requirement ID
7. If tests fail: fix the code (NEVER delete or weaken tests). If stuck after 2 attempts, stop and ask the human.
8. If the resolution involved learning about external system behavior, library usage, or a non-obvious pattern, save findings to `docs/research/`
9. After completing all tasks: update `specs/requirements/_index.md` status

### .claude/commands/amend.md

Write this command file:

The human will describe a specification change and its rationale.
1. Identify which spec file(s) need modification
2. Append an amendment entry with: date, rationale, before/after diff
3. Run `/impact` to generate the full impact analysis
4. Create `specs/amendments/<id>.md` with the checklist of all affected artifacts
5. Present the impact report and checklist to the human
6. Do NOT begin implementation until the human approves the amendment

### .claude/commands/impact.md

Write this command file:

Given a spec change (file path + description of change):
1. Parse the changed spec to identify modified types, interfaces, behaviors, or constraints
2. Search `src/` for all files importing or referencing the affected types/interfaces
3. Search `tests/` for all test files covering the affected feature
4. Search `docs/adr/` for ADRs referencing the affected spec
5. Search `docs/research/` for research files referencing the affected spec
6. Search `specs/` for other specs that depend on the affected spec
7. For each found file, describe specifically what would need to change
8. Output a structured impact report with: file path, line numbers, description of required change, priority (breaking/non-breaking)

### .claude/commands/review-adrs.md

Write this command file:

Read all ADR files in `docs/adr/` with status "accepted". Compare against the current plan or recent changes. For each ADR, verify:
1. The plan/code doesn't contradict the decision
2. If it does, flag it with: ADR number, the contradiction, and whether the ADR should be superseded or the plan revised
3. Output a compliance report

### .claude/commands/record-fixtures.md

Write this command file:

This command manages VCR cassette recording in three phases. Claude cannot call real external APIs — recording requires human execution.

ARGUMENTS: $ARGUMENTS

**Phase 1 — Analysis (AI):**
1. Read the requirement/plan specified in arguments (or prompt for which requirement)
2. Identify all external services and endpoints the requirement touches
3. Read existing cassettes in `tests/fixtures/` — diff against what's needed
4. Check TTLs — flag any expired cassettes that need re-recording
5. Output a **recording manifest**:
   - For each gap: service, scenario name, endpoint, method, example parameters
   - For each expiration: cassette path, expired date, re-record command
   - Mark each entry as NEW or RE-RECORD

**Phase 2 — Recording (Human):**
For each manifest entry, the human either:
- Runs `pnpm record-fixtures <service> <scenario>` (if the adapter is importable)
- Or uses the provided curl commands and manually wraps in envelope format:
```json
{
  "meta": {
    "recorded_at": "ISO-8601",
    "ttl_days": 30,
    "service": "<service>",
    "scenario": "<scenario>",
    "recorded_by": "human",
    "api_version": "<version>"
  },
  "interactions": [{ "request": { ... }, "response": { ... } }]
}
```
Sanitization: strip `Authorization`, `X-Api-Key`, bearer tokens → `<REDACTED>`

**Phase 3 — Validation (AI):**
After the human records cassettes:
1. Validate all new/updated cassettes against `tests/fixtures/_cassette-schema.json`
2. Check sanitization — scan for tokens, API keys, secrets
3. Verify completeness against the recording manifest from Phase 1
4. Report any remaining gaps

## PHASE 5: Write the constitution

### specs/constitution.md

**Immutable principles** (can only change with human-approved amendment):

Always include these universal principles:
1. External dependencies are accessed only through port interfaces
2. Tests are the specification's enforcement mechanism — they are never weakened to make code pass
3. Recorded fixtures are the only source of truth for external API behavior in tests
4. Architectural decisions are documented in ADRs before implementation
5. Research findings are captured in `docs/research/` and referenced before re-investigating

[PROJECT-SPECIFIC: Add 3-5 domain-specific principles based on the project type:
- Security tools: conservative defaults, traceability, read-only analysis
- Data pipelines: idempotency, graceful degradation on malformed input
- User-facing systems: confirmation before destructive actions
- AI-in-the-loop systems: confidence scoring, distinguishable from deterministic results, fallback when LLM unavailable]

**Amendment log:**
| # | Date | Principle affected | Change | Rationale | Approved by |
|---|------|-------------------|--------|-----------|-------------|

## PHASE 6: Write the requirements index and first spec

### specs/requirements/_index.md

[PROJECT-SPECIFIC: Generate a requirements table with columns: ID, Title, Status (all "not-started"), Spec file, Plan file, Dependencies. Decompose into 8-15 requirements following these rules:
- Each requirement is independently implementable and testable
- Requirements form a DAG — identify dependencies explicitly
- Start with ingest/parsing (no dependencies), then core logic, then integrations, then output
- If the system uses runtime AI: separate deterministic and AI-assisted paths into distinct requirements
- Include a requirement for fallback/degraded behavior when AI is unavailable
- At least one requirement must have no dependencies (an entry point)]

### specs/requirements/req-001.md

[PROJECT-SPECIFIC: Write the first requirement (pick one with no dependencies) fully:
- User story
- Acceptance criteria in EARS format (When <trigger>, the system shall <response>)
- Invariants (properties that must always hold)
- Edge cases explicitly called out
- Scenarios referencing specs/scenarios/]

## PHASE 7: Write the initial ADR

### docs/adr/0001-initial-architecture.md

Document the hexagonal architecture decision:
- Context: AI-maintained codebase needs strict dependency boundaries to prevent test-gaming and ensure independent testability of core logic
- [PROJECT-SPECIFIC: Add which dependencies might change, have unreliable APIs, or need independent testing]
- Decision: Hexagonal (ports & adapters) with core/, ports/, adapters/ separation
- Consequences: All external interactions are mockable at the port level; core is fully testable without any mocks; adapter changes don't affect core logic; new integrations only require new adapters
- Alternatives: Layered architecture (rejected: too easy for AI to create leaky abstractions); direct SDK usage (rejected: impossible to test without hitting real services)

### docs/adr/_template.md

Write a reusable ADR template with sections: Title, Date, Status, Context, Decision, Consequences, Alternatives Considered, References.

## PHASE 8: Write the CI pipeline

### .github/workflows/ci.yml

Implement gates in this order:
1. Lint + type check
2. Check fixture expiry (`check-fixtures`) — fail if any cassette TTL is expired
3. Validate scenarios (`validate-scenarios`) — fail if traceability is broken
4. Unit tests (core only, no mocks, no network)
5. Property-based tests (100 examples in CI)
6. Contract tests (validate adapter calls against consumer contracts)
7. Integration tests (recorded fixtures only — blocked by check-fixtures)
8. Mutation testing on src/core/ (fail if score < 70%)

Jobs 2+3 run after lint, in parallel. Jobs 4+5+6 run after lint, in parallel. Job 7 requires 2+4+5+6. Job 8 requires 4+5.

[PROJECT-SPECIFIC: Use the correct CI platform and test runner commands for the chosen stack.]

## PHASE 9: Research files

[PROJECT-SPECIFIC: For each piece of prior research the human provided, create a file in `docs/research/` with this structure:]

```markdown
# <Title>

**Date:** <when the research was conducted>
**Status:** active | superseded-by <filename>
**Tags:** <searchable keywords>
**Triggered by:** bootstrap

## Summary
<2-3 sentence takeaway>

## Findings
<Full detail>

## Implications for this project
<How findings constrain or inform decisions. Reference ADRs/specs.>

## Open questions
<Unresolved items for future sessions.>
```

## FINAL INSTRUCTIONS

After creating all files:
1. Initialize a git repo and make the initial commit
2. Print a summary of what was created and what the human should do next
3. The human's next steps are:
   a. Review and refine the constitution
   b. Fill in detailed specs for each requirement
   c. Record initial fixtures by running the app against real external services
   d. Run `/plan REQ-001` to begin the first implementation cycle

Do NOT write any application code. `src/` files should be empty or contain only port interface stubs. The scaffold IS the product of this session.
````

## Post-generation checklist

After generating the prompt, present it to the human and verify:

1. The requirements decomposition is complete — no missing capabilities
2. The constitutional principles cover the project's domain constraints
3. Every external boundary maps to exactly one adapter and one port
4. Research files capture everything the human has already investigated
5. The requirements DAG has at least one entry point with no dependencies
6. CLAUDE.md will stay under 200 lines in the generated output

Once the human approves, they paste the prompt into a new Claude Code session in an empty directory.
