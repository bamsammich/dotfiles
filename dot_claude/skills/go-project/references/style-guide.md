# Go Style Guide

Condensed from [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md) and [Effective Go](https://go.dev/doc/effective_go). Only rules that are non-obvious or commonly violated.

## Naming

- No stuttering: package `http` exports `Server`, not `HTTPServer`.
- Prefix unexported package-level vars with `_`: `var _defaultTimeout = 30 * time.Second`.
- Exception: unexported error vars use `err` prefix: `var errNotFound = errors.New("not found")`.
- Printf-style functions end with `f` (`Wrapf`, `Logf`) to enable `go vet` format-string checking.

## Interfaces

- Accept interfaces, return concrete types. Define at the consumer.
- Verify compliance at compile time: `var _ http.Handler = (*Handler)(nil)`.
- Keep small — one or two methods. Never use pointer-to-interface (`*io.Reader`).
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
- ALWAYS add call-site context when wrapping. Bare `return err` loses the trace — wrap with what this function was doing: `fmt.Errorf("read user %d: %w", id, err)`.
- No redundant prefixes: `"open file: %w"` not `"failed to open file: %w"`.

### NEVER Blank-Capture a Return Value
`_ = doSomething()` is forbidden. ALWAYS bubble up errors to the caller. The only exception: log the error explicitly and continue in a degraded state — never silently discard.

### Handle Once
Do not both log and return an error. Wrap and propagate up; let the top-level caller log.

### NEVER Panic
`panic` means an unhandled error state. ALWAYS return errors. Only acceptable in `init()` for truly irrecoverable programmer errors. In tests, use `t.Fatal`.

### Exit Only in main()
`os.Exit` and `log.Fatal` only in `main()`. Structure as `main() → run() error`:
```go
func main() {
    if err := run(); err != nil {
        log.Fatal(err)
    }
}
```

### Always Use Comma-Ok for Type Assertions
```go
t, ok := i.(string)
if !ok { /* handle */ }
```

## Context

- `context.Context` is ALWAYS the first parameter: `func DoThing(ctx context.Context, ...) error`.
- NEVER store `context.Context` in a struct. Pass it through function calls.
- NEVER use `context.TODO()` in production code — it exists for refactoring only.
- Respect cancellation: check `ctx.Err()` or `select` with `ctx.Done()` in loops and long operations.
- Derive child contexts for scoped work: `ctx, cancel := context.WithTimeout(ctx, 5*time.Second)`.

## Concurrency

- **Channel size:** Unbuffered or size 1. Any other size requires explicit justification.
- **No fire-and-forget goroutines.** Every goroutine needs a predictable lifetime and shutdown mechanism (`sync.WaitGroup`, `chan struct{}`).
- **No goroutines in `init()`.** Spawn in constructors with explicit shutdown methods.
- **Zero-value mutexes:** `var mu sync.Mutex` — embed as unexported field in structs used by pointer.
- **Avoid mutable globals.** Use dependency injection.
- **Atomic operations:** Use `sync/atomic` types (`atomic.Bool`, `atomic.Int64`) over raw `atomic.AddInt64`.
- **Graceful shutdown:** Handle `os.Signal`, propagate cancellation via `context.Context`:
```go
ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
defer stop()
```

## Functions and Methods

### File Ordering
1. Exported type/const/var declarations.
2. `NewXYZ()` constructor immediately after type.
3. Exported methods by call order.
4. Unexported helpers at file end.

### Receiver Consistency
All methods on a type MUST use the same receiver type. If any method needs a pointer receiver, ALL methods use pointer receivers. Use pointer receivers when the method mutates state, the struct is large, or for consistency.

### Functional Options
When 3+ optional parameters:
```go
type Option func(*options)
func WithCache(enabled bool) Option { return func(o *options) { o.cache = enabled } }
func New(addr string, opts ...Option) *Client { ... }
```

## Types and Structs

### Struct Initialization
Always use field names. Omit zero-value fields unless they add clarity:
```go
user := User{FirstName: "John"}  // good
user := User{"John", "", false}   // bad
```

### Field Tags
Always annotate marshaled fields: `json:"price"`. Enforce `snake_case` for `json` and `yaml` tags (enforced by `tagliatelle`).

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
Zero value = uninitialized. Exception: when zero is the meaningful default.

### Use `time.Time` and `time.Duration`
Never use `int` for time. For external APIs, include units in names: `IntervalMillis`.

## Control Flow

### nil is a Valid Slice
Return `nil`, not `[]int{}`. Check with `len(s) == 0`, not `s == nil`.

### NEVER Use nil to Imply Logic
A nil value means absence of data, not a control flow signal. Always nil-check explicitly:
```go
// bad — nil used as implicit "skip" signal
if handler != nil {
    handler.Process(data)
}

// good — explicit check with clear intent
if handler == nil {
    return fmt.Errorf("handler is required")
}
handler.Process(data)
```

## Patterns

### Copy Slices and Maps at Boundaries
```go
func (d *Driver) SetTrips(trips []Trip) {
    d.trips = make([]Trip, len(trips))
    copy(d.trips, trips)
}
```

### Don't Shadow Built-In Names
Never shadow `error`, `string`, `len`, `cap`, `new`, `make`, `copy`, `close`, etc.

### Import Grouping
ALWAYS maintain three groups separated by blank lines (enforced by `gci` via `golangci-lint fmt ./...`):
1. Standard library
2. Third-party packages
3. Internal packages
