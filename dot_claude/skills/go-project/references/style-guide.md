# Go Style Guide

Condensed from [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md) and [Effective Go](https://go.dev/doc/effective_go). Focus on actionable rules that are non-obvious or commonly violated.

## Table of Contents

- [Naming](#naming)
- [Interfaces](#interfaces)
- [Error Handling](#error-handling)
- [Concurrency](#concurrency)
- [Functions and Methods](#functions-and-methods)
- [Types and Structs](#types-and-structs)
- [Control Flow](#control-flow)
- [Performance](#performance)
- [Testing](#testing)
- [Patterns](#patterns)

## Naming

### Packages
- Lowercase, single word, no underscores, no camelCase.
- Singular (`http`, not `https`). Avoid generic names: `common`, `util`, `shared`, `lib`.
- No stuttering: package `http` exports `Server`, not `HTTPServer`.

### Variables and Functions
- MixedCaps/mixedCaps, never underscores (except test names: `TestFoo_SubCase`).
- Acronyms stay cased: `URL`, `HTTP`, `ID` (not `Url`, `Http`, `Id`).
- Prefix unexported package-level vars with `_`: `var _defaultTimeout = 30 * time.Second`.
- Exception: unexported error vars use `err` prefix: `var errNotFound = errors.New("not found")`.

### Exported Names
- Exported error vars: `Err` prefix (`ErrNotFound`).
- Exported error types: `Error` suffix (`NotFoundError`).
- Getters: `Owner()`, not `GetOwner()`. Setters: `SetOwner()`.

### Printf-style Functions
End names with `f` (`Wrapf`, `Logf`) to enable `go vet` format-string checking.

## Interfaces

- Accept interfaces, return concrete types.
- Verify compliance at compile time: `var _ http.Handler = (*Handler)(nil)`.
- Keep interfaces small — one or two methods. Define interfaces at the consumer, not the implementer.
- Never use pointer-to-interface (`*io.Reader`).
- Avoid embedding interfaces in public structs.

## Error Handling

### Choose the Right Error Type

| Caller needs to match? | Static message | Dynamic message |
|------------------------|----------------|-----------------|
| No | `errors.New` | `fmt.Errorf` |
| Yes | `var ErrFoo = errors.New(...)` | Custom type with `Error()` |

### Wrapping
- Use `%w` to preserve the chain: `fmt.Errorf("open config: %w", err)`.
- Use `%v` to intentionally opaque the underlying error.
- No redundant prefixes: `"open file: %w"` not `"failed to open file: %w"`.

### Handle Once
Do not both log and return an error. Return wrapped errors up; let the top-level caller decide to log. Only log when gracefully degrading.

### Always Use Comma-Ok for Type Assertions
```go
t, ok := i.(string)
if !ok { /* handle */ }
```

### Don't Panic
Return errors. Reserve `panic` for truly irrecoverable programmer errors or `init()` failures. In tests, use `t.Fatal`.

### Exit Only in main()
`os.Exit` and `log.Fatal` only in `main()`. Structure as:
```go
func main() {
    if err := run(); err != nil {
        log.Fatal(err)
    }
}
```

## Concurrency

### Channel Size
- Unbuffered (default) or size 1. Any other size requires explicit justification.

### No Fire-and-Forget Goroutines
Every goroutine must have a predictable lifetime and shutdown mechanism. Use `sync.WaitGroup` for multiple goroutines, `chan struct{}` for single.

### No Goroutines in init()
Spawn goroutines in constructors with explicit shutdown methods.

### Zero-Value Mutexes
`var mu sync.Mutex` — don't use `new(sync.Mutex)`. Embed as unexported field in structs used by pointer.

### Avoid Mutable Globals
Use dependency injection. Pass functions and values as parameters.

### Atomic Operations
Use `sync/atomic` types (`atomic.Bool`, `atomic.Int64`) for type safety over raw `atomic.AddInt64`.

## Functions and Methods

### Function Ordering in Files
1. Exported type/const/var declarations.
2. `NewXYZ()` constructor immediately after type.
3. Exported methods by call order.
4. Unexported helpers at file end.

### Functional Options for Complex APIs
When 3+ optional parameters or anticipated growth:
```go
type Option func(*options)
func WithCache(enabled bool) Option { return func(o *options) { o.cache = enabled } }
func New(addr string, opts ...Option) *Client { ... }
```

### Defer for Cleanup
Always `defer` for resource cleanup (files, locks, connections). Overhead is negligible.

### Avoid init()
Prefer explicit initialization from `main()`. If `init()` is used, it must be deterministic, side-effect-free, and independent of other `init()` order.

## Types and Structs

### Struct Initialization
Always use field names. Omit zero-value fields unless they add clarity:
```go
user := User{FirstName: "John"}  // good
user := User{"John", "", false}   // bad
```

### Use `&T{}` Not `new(T)`
```go
user := &User{Name: "bar"}  // good
```

### Field Tags
Always annotate marshaled fields: `json:"price"`. Makes contracts explicit and survives renames.

### Tag Format
Enforce consistent casing: `json:"snake_case"`, `yaml:"snake_case"` (enforced by `tagliatelle` linter).

### Embedding
- Embed at top of field list, separated by blank line.
- Must provide functional benefit, not just convenience.
- Never embed mutexes in exported types.

### Enums Start at One
```go
const (
    Add Operation = iota + 1
    Subtract
)
```
Zero value indicates uninitialized. Exception: when zero is the meaningful default.

### Use `time.Time` and `time.Duration`
Never use `int` for time. For external APIs, include units in names: `IntervalMillis`.

## Control Flow

### Guard Clauses — Reduce Nesting
Handle errors/edge cases first, return early:
```go
if err != nil {
    return err
}
// happy path
```

### No Unnecessary Else
```go
x := defaultVal
if condition {
    x = otherVal
}
```

### Reduce Variable Scope
Declare as close to first use as possible:
```go
if err := os.WriteFile(name, data, 0644); err != nil {
    return err
}
```

### nil is a Valid Slice
Return `nil`, not `[]int{}`. Check with `len(s) == 0`, not `s == nil`.

## Performance

- **strconv over fmt** for primitive-to-string conversions.
- **Preallocate** slices and maps: `make([]T, 0, size)`, `make(map[K]V, size)`.
- **Convert strings to bytes once** and reuse.
- **Avoid repeated string concatenation** in loops — use `strings.Builder`.

## Testing

### Table-Driven Tests
```go
tests := []struct {
    name  string
    input string
    want  string
}{
    {"empty", "", ""},
    {"single", "a", "a"},
}
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        got := MyFunc(tt.input)
        assert.Equal(t, tt.want, got)
    })
}
```

Keep table entries simple. Complex cases with branching logic get their own test functions. Use `t.Parallel()` for safe tests.

### Test Package Naming
- Same package for whitebox: `package foo`
- `_test` suffix for blackbox: `package foo_test`
- Prefer blackbox tests for public API validation.

### Assertions
Use `testify/assert` and `testify/require`. `require` for preconditions that must pass; `assert` for the checks themselves.

### Subtests
Group related cases under a parent test with `t.Run()`. Enables selective execution and parallel runs.

## Patterns

### Copy Slices and Maps at Boundaries
When receiving or returning slices/maps, copy to prevent aliasing:
```go
func (d *Driver) SetTrips(trips []Trip) {
    d.trips = make([]Trip, len(trips))
    copy(d.trips, trips)
}
```

### Avoid Naked Parameters
Use named constants or comment bare booleans:
```go
printInfo("foo", true /* isLocal */)
```

### Use Raw String Literals
```go
wantError := `unknown error:"test"`  // good
wantError := "unknown error:\"test\""  // bad
```

### Format Strings as Constants
```go
const msgFormat = "user: %s"
```

### Don't Shadow Built-In Names
Never shadow `error`, `string`, `len`, `cap`, `new`, `make`, `copy`, `close`, etc.

### Import Grouping
Three groups separated by blank lines:
1. Standard library
2. Third-party packages
3. Internal packages (enforced by `gci` formatter)

### Line Length
Soft limit of 99 characters. Handled by `golines` formatter.
