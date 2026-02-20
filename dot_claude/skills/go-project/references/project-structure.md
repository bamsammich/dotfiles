# Go Project Structure

Based on [golang-standards/project-layout](https://github.com/golang-standards/project-layout).

**Golden rule: Don't create directories unless you need them.** Start minimal and add structure as the project grows.

## Core Directories

### `/cmd`
Main applications. Each subdirectory = one binary. Keep `main.go` small — import and invoke code from `/internal` or `/pkg`.

```
cmd/
  myapp/
    main.go
  mycli/
    main.go
```

### `/internal`
Private application and library code. Enforced by the Go compiler — other projects cannot import it. Use subdirectories to separate concerns:

```
internal/
  app/        # application logic
  config/     # configuration handling
  domain/     # domain models
  handler/    # HTTP/gRPC handlers
  repository/ # data access
  service/    # business logic
```

### `/pkg`
Library code safe for external use. Other projects can import these packages. Only create when you intentionally want to export reusable code. Many projects don't need this.

## Common Application Directories

### `/api`
OpenAPI/Swagger specs, JSON schema files, protocol definition files (`.proto`).

### `/configs`
Configuration file templates or default configs. `confd` or `consul-template` template files go here.

### `/build`
Packaging and CI. `/build/package` for cloud, container, OS configs. `/build/ci` for CI pipeline configs.

### `/deployments` (or `/deploy`)
IaaS, PaaS, system, and container orchestration configs (docker-compose, Kubernetes, Helm, Terraform).

### `/scripts`
Scripts for build, install, analysis, etc. Keep the root Makefile small by calling into scripts here.

### `/test`
Additional external test apps and test data. Integration tests, e2e tests, test fixtures. Go ignores directories starting with `.` or `_`.

## Other Directories

| Directory | Purpose |
|-----------|---------|
| `/docs` | Design and user documents |
| `/tools` | Supporting tools for the project |
| `/examples` | Application and library examples |
| `/third_party` | External helper tools, forked code, other third-party utilities |
| `/assets` | Images, logos, and other non-code assets |
| `/web` | Web application components: static assets, server-side templates, SPAs |

## Anti-Patterns

- **No `/src`** — Not idiomatic Go. Don't use it.
- **No `/model` or `/models`** — Put domain types in `/internal/domain` or colocate with the package that uses them.
- **No `/utils` or `/helpers`** — These become dumping grounds. Put functions in the package that uses them or create a descriptive package name.
- **Avoid deep nesting** — Flat is better. `internal/auth` not `internal/services/auth/handler/v1`.
