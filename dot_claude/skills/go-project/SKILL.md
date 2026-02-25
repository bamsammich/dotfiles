---
name: go-project
description: >
  Best practices for creating, editing, and maintaining Go projects. Covers project structure
  (golang-standards/project-layout), code style (Uber Go Style Guide + Effective Go), linting
  (golangci-lint), formatting, and testing conventions. Use when: (1) creating a new Go project
  or module, (2) writing or editing Go code, (3) adding packages or restructuring a Go codebase,
  (4) setting up linting/formatting for a Go project, (5) writing or reviewing Go tests,
  (6) any task involving .go files or Go modules. Triggers: "go project", "golang", ".go file",
  "go module", "go test", "go lint", "write go code", "new go service".
---

# Go Project Best Practices

Enforce well-tested, readable, and well-structured Go codebases following industry-standard conventions.

## Workflow

1. **New project?** → Follow [Project Setup](#project-setup)
2. **Existing project missing `.golangci.yaml`?** → Copy `assets/dot_golangci.yaml` → `.golangci.yaml` in the project root, update the `gci` prefix, and suggest it to the user.
3. **Writing/editing code?** → Follow [Code Guidelines](#code-guidelines)
4. **Adding a package?** → Consult `references/project-structure.md` for placement
5. **Writing tests?** → Follow [Testing](#testing)

## Project Setup

ALWAYS set up golangci-lint when creating a new Go project. This is not optional.

1. Initialize module: `go mod init <module-path>`
2. Create minimal directory structure — only what's needed:
   - `cmd/<appname>/main.go` for binaries
   - `internal/` for private packages
   - `pkg/` only if code is intentionally exported for external use
3. Copy linter config: `assets/dot_golangci.yaml` → `.golangci.yaml` in the project root
   - **Update the `gci` prefix** in `formatters.settings.gci.sections` to match your module path
4. Install golangci-lint: `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest`
5. Add a `Makefile` with at minimum:
   ```makefile
   .PHONY: lint fmt test

   lint:
   	golangci-lint run ./...

   fmt:
   	golangci-lint fmt ./...

   test:
   	go test -race -count=1 ./...
   ```

Don't create directories speculatively. Add structure as the project grows. See `references/project-structure.md` for the full layout guide.

## Code Guidelines

Read `references/style-guide.md` for the complete condensed rules. Key principles:

### Critical Rules (non-obvious, commonly violated)
- **NEVER blank-capture a return value.** `_ = doSomething()` is forbidden. ALWAYS bubble up errors to the caller. The only exception is when it is appropriate to log the error and continue in a degraded state.
- **Handle errors once.** Don't both log and return. Wrap with `%w` and add call-site context: `fmt.Errorf("read user: %w", err)`, not bare `return err`.
- **NEVER use nil pointers or nil interfaces to imply code logic.** Always nil-check explicitly for missing content. A nil value is the absence of data, not a signal.
- **NEVER PANIC.** `panic` indicates something is seriously wrong and an error state was not handled. Return errors. Use `t.Fatal` in tests. The only acceptable panic is for truly irrecoverable programmer errors in `init()`.
- **`context.Context` is ALWAYS the first parameter.** Never store it in a struct. Never use `context.TODO()` in production.
- **Accept interfaces, return concrete types.** Define interfaces at the consumer, not the implementer.
- **Consistent method receivers.** If any method on a type needs a pointer receiver, ALL methods use pointer receivers.
- **No fire-and-forget goroutines.** Every goroutine needs a shutdown mechanism.
- **Copy slices/maps at boundaries** to prevent aliasing.
- **Always use field names** in struct literals. Always add struct tags for marshaled fields.
- **Exit only in `main()`** — structure as `main() → run() error`.
- **Avoid `init()`** — prefer explicit initialization.
- **Enums start at 1** (`iota + 1`) so zero value indicates uninitialized.

### Naming Quick Reference
| Item | Convention | Example |
|------|-----------|---------|
| Package | lowercase, singular, no `_` | `auth`, `user` |
| Exported error var | `Err` prefix | `ErrNotFound` |
| Unexported error var | `err` prefix | `errNotFound` |
| Error type | `Error` suffix | `NotFoundError` |
| Unexported pkg-level var | `_` prefix | `_defaultTimeout` |
| Getter | No `Get` prefix | `Owner()` |
| Setter | `Set` prefix | `SetOwner()` |
| Acronyms | All caps | `URL`, `HTTP`, `ID` |

### Generics
- Use generics when you have **2+ functions/types with identical logic differing only by type**. If you're writing `ProcessUsers` and `ProcessOrders` with the same body, that's a generic.
- Prefer stdlib generic packages: `slices`, `maps`, `cmp`. Don't hand-roll what's already there.
- Constrain tightly: `[T comparable]` or `[T fmt.Stringer]`, not `[T any]`. `any` constraint means you should just use `any` — the generic adds nothing.
- Don't genericize for one type. `func Process[T Widget](w T)` is worse than `func Process(w Widget)`.
- Type inference works — let it. `slices.Contains(items, target)` not `slices.Contains[string](items, target)`.

## Linting and Formatting

ALWAYS use the bundled `assets/dot_golangci.yaml`. Copy to project root as `.golangci.yaml` and update the `gci` prefix to match your module path. The config is self-documenting — read it for linter rationale.

- Lint: `golangci-lint run ./...`
- Format (including import ordering): `golangci-lint fmt ./...`

**NEVER add a `//nolint` directive unless the lint error is definitively, verifiably wrong.** A lint error means the code should be fixed, not silenced. If truly necessary, include the linter name and justification:
```go
//nolint:gosec // G204: command is constructed from validated config, not user input
```

## Testing

- **Table-driven tests** as the default pattern. Use `t.Run()` for subtests.
- **`testify/assert` and `testify/require`** for assertions. `require` for preconditions.
- **Blackbox tests** (`package foo_test`) preferred for public API validation.
- **`t.Parallel()`** on safe tests for speed.
- **No complex logic in table entries.** If a test case needs branching or custom setup, give it its own test function.
- Run with race detector: `go test -race ./...`

## Resources

- `assets/dot_golangci.yaml` — Linter/formatter config. Copy to project root and update the `gci` module prefix.
- `references/style-guide.md` — Complete condensed style rules from Uber Go Style Guide and Effective Go.
- `references/project-structure.md` — Directory layout conventions from golang-standards/project-layout.
