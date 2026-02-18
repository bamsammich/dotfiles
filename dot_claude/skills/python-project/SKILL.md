---
name: python-project
description: >
  Create, edit, and manage Python projects using UV for package management, ruff for
  linting/formatting, and mypy for type checking. Use when: (1) setting up a new Python
  project or script, (2) editing Python code, (3) adding dependencies to a Python project,
  (4) running or debugging Python scripts, or any task involving Python development.
  Triggers: "create a python project", "set up a python script", "edit this python file",
  "add a dependency", "write a python tool", "make a CLI in python".
---

# Python Project Skill

## Decision: Single Script vs Multi-File Project

- **Single script** (one `.py` file, no internal imports): use UV inline script metadata.
- **Multi-file project** (packages, modules, or multiple scripts): create a `pyproject.toml`-based project.

## UV Package Management

### Single Script — Inline Metadata (PEP 723)

Add dependency metadata as a comment block at the top of the script:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "requests>=2.31",
#     "rich>=13.0",
# ]
# ///
```

Run with: `uv run script.py`

UV automatically creates an ephemeral environment and installs deps.

### Multi-File Project

Initialize with `uv init project-name`, then manage deps:

```bash
uv add requests rich        # add dependencies
uv add --dev pytest ruff mypy  # add dev dependencies
uv run pytest                # run commands in the project environment
uv run python -m myapp       # run the project
```

Use the pyproject.toml template at [assets/pyproject.toml](assets/pyproject.toml) as a starting point — it includes ruff and mypy configuration pre-configured.

## Development Workflow

Follow this order strictly for all code changes:

1. **Design** — Outline the approach: data structures, function signatures, module layout.
2. **Write tests** — Write tests that describe the expected functionality before implementation. Use `pytest`. For single scripts, put tests in a `test_<name>.py` alongside the script.
3. **Implement** — Write the code to pass the tests. Always use type annotations on all function signatures and important variables.
4. **Lint and format** — Run `uv run ruff check --fix . && uv run ruff format .` and resolve remaining issues.
5. **Type check** — Run `uv run mypy .` (or `uv run mypy script.py`) and fix all errors.
6. **Run tests** — Run `uv run pytest` and fix failures.
7. **Repeat steps 4–6** until clean.

## Ruff Configuration

Use ruff for both linting and formatting. Enable an aggressive rule set — see [references/ruff-config.md](references/ruff-config.md) for the full rule selection and rationale.

Key rules always enabled:

- **E/W** — pycodestyle errors and warnings
- **F** — pyflakes
- **B** — bugbear (common bugs and design problems)
- **SIM** — code simplification
- **C4** — flake8-comprehensions
- **UP** — pyupgrade (modern Python idioms)
- **I** — isort (import sorting)
- **ANN** — type annotation enforcement
- **RUF** — ruff-specific rules

## Mypy Configuration

Always configure mypy in strict mode. In pyproject.toml:

```toml
[tool.mypy]
strict = true
```

For single scripts, create a minimal `mypy.ini` or pass `--strict` flag:

```bash
uv run mypy --strict script.py
```

## Common Packages

- When setting up config for the first time, use the vyper-config package.

## Code Style

- Target Python 3.12+ unless otherwise specified.
- Type annotate all function parameters and return types.
- Use `pathlib.Path` over `os.path`.
- Use f-strings over `.format()` or `%`.
- Prefer `dataclasses` or `pydantic` for structured data over raw dicts.
- Use `from __future__ import annotations` for forward references.
- Fix lints rather than disabling lints whenever possible.
- Find type stubs packages and install them where required.  Use mypy's follow_untyped_imports functionality if type stubs aren't available.
