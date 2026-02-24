# Go Project Structure

Based on [golang-standards/project-layout](https://github.com/golang-standards/project-layout).

**Start minimal. Don't create directories unless you need them.**

## Core Directories

| Directory | Purpose |
|-----------|---------|
| `cmd/<appname>/` | Main applications. One subdirectory per binary. Keep `main.go` small — import and call `internal/`. |
| `internal/` | Private code. Compiler-enforced — cannot be imported externally. |
| `pkg/` | Code intentionally exported for external use. Many projects don't need this. |

### Typical `internal/` layout
```
internal/
  app/        # application logic
  config/     # configuration
  domain/     # domain models
  handler/    # HTTP/gRPC handlers
  repository/ # data access
  service/    # business logic
```

## Other Directories

| Directory | Purpose |
|-----------|---------|
| `/api` | OpenAPI/Swagger specs, protobuf definitions |
| `/configs` | Config templates and defaults |
| `/build` | Packaging, CI configs |
| `/deployments` | Docker, Kubernetes, Terraform configs |
| `/scripts` | Build/install/analysis scripts |
| `/test` | Integration/e2e tests, test fixtures |
| `/docs` | Documentation |
| `/tools` | Supporting tools |
| `/examples` | Usage examples |
| `/web` | Web static assets, templates, SPAs |

## Anti-Patterns

- **No `/src`** — not idiomatic Go.
- **No `/model` or `/models`** — use `internal/domain` or colocate with the consuming package.
- **No `/utils` or `/helpers`** — these become dumping grounds. Use descriptive package names.
- **Avoid deep nesting** — `internal/auth` not `internal/services/auth/handler/v1`.
