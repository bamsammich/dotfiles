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
2. **Writing/editing code?** → Follow [Code Guidelines](#code-guidelines)
3. **Adding a package?** → Consult `references/project-structure.md` for placement
4. **Writing tests?** → Follow [Testing](#testing)

## Project Setup

When creating a new Go project:

1. Initialize module: `go mod init <module-path>`
2. Create minimal directory structure — only what's needed:
   - `cmd/<appname>/main.go` for binaries
   - `internal/` for private packages
   - `pkg/` only if code is intentionally exported for external use
3. Copy linter config: `assets/.golangci.yaml` → project root
   - **Update the `gci` prefix** in `formatters.settings.gci.sections` to match your module path
4. Install golangci-lint: `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest`
5. Add a `Makefile` with at minimum:
   ```makefile
   .PHONY: lint test

   lint:
   	golangci-lint run ./...

   test:
   	go test -race -count=1 ./...
   ```

Don't create directories speculatively. Add structure as the project grows. See `references/project-structure.md` for the full layout guide.

## Code Guidelines

Read `references/style-guide.md` for the complete condensed rules. Key principles:

### Critical Rules (non-obvious, commonly violated)
- **Accept interfaces, return concrete types.** Define interfaces at the consumer.
- **Handle errors once.** Don't both log and return. Wrap with `%w` and propagate up.
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

## Linting and Formatting

The bundled `assets/.golangci.yaml` configures golangci-lint v2 with:

**Linters enabled:**
- Defaults: `errcheck`, `govet`, `ineffassign`, `staticcheck`, `unused`
- Style: `revive` (most rules enabled), `goconst`, `gocritic`, `whitespace`
- Safety: `gosec`, `spancheck`, `unconvert`, `copyloopvar`
- Conventions: `tagliatelle` (snake_case tags), `nolintlint` (require explanations), `ireturn` (accept interfaces, return types)
- Complexity: `gocyclo` (max 15)

**Formatters enabled:**
- `gofmt` — standard formatting, rewrites `interface{}` → `any`
- `golines` — enforces line length
- `gci` — import grouping: stdlib → third-party → project-internal

**Key config decisions:**
- `errcheck.check-blank: true` — blank error assignments `_` are flagged
- `nolintlint.require-explanation: true` — every `//nolint` must explain why
- `revive` has most rules enabled with sensible exceptions (see config comments)
- Test files: `gosec`, `goconst`, `dupl` are excluded
- `tagliatelle` enforces `snake_case` for `json` and `yaml` tags

Run: `golangci-lint run ./...`

When adding a `//nolint` directive, always include the linter name and explanation:
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

- `assets/.golangci.yaml` — Linter/formatter config. Copy to project root and update the `gci` module prefix.
- `references/style-guide.md` — Complete condensed style rules from Uber Go Style Guide and Effective Go.
- `references/project-structure.md` — Directory layout conventions from golang-standards/project-layout.
