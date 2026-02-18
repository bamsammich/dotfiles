# Ruff Configuration Reference

## pyproject.toml Config

```toml
[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = [
    "E",     # pycodestyle errors
    "W",     # pycodestyle warnings
    "F",     # pyflakes
    "B",     # bugbear — common bugs and design problems
    "SIM",   # simplify — code simplification suggestions
    "C4",    # flake8-comprehensions
    "UP",    # pyupgrade — modern Python idioms
    "I",     # isort — import sorting
    "ANN",   # flake8-annotations — enforce type annotations
    "RUF",   # ruff-specific rules
    "N",     # pep8-naming
    "S",     # bandit — security checks
    "A",     # flake8-builtins — shadowing builtins
    "DTZ",   # flake8-datetimez — naive datetime usage
    "ICN",   # flake8-import-conventions
    "PIE",   # flake8-pie — misc lints
    "PT",    # flake8-pytest-style
    "RSE",   # flake8-raise
    "RET",   # flake8-return
    "TCH",   # flake8-type-checking — optimize type-only imports
    "ARG",   # flake8-unused-arguments
    "PTH",   # flake8-use-pathlib
    "ERA",   # eradicate — commented-out code
    "PL",    # pylint rules
    "PERF",  # perflint — performance anti-patterns
    "FURB",  # refurb — modernization suggestions
]
ignore = [
    "ANN101",  # missing type annotation for self (deprecated)
    "ANN102",  # missing type annotation for cls (deprecated)
    "S101",    # allow assert in tests
    "PLR0913", # too many arguments — sometimes unavoidable
]

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py" = [
    "S101",    # assert is fine in tests
    "ANN",     # don't require annotations in tests
    "ARG",     # unused arguments common in fixtures
]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

## Rule Categories Explained

| Prefix | Name | Why |
|--------|------|-----|
| B | Bugbear | Catches common bugs: mutable default args, assert on tuples, etc. |
| SIM | Simplify | Flags unnecessarily complex code: collapsible ifs, redundant opens, etc. |
| C4 | Comprehensions | Suggests list/dict/set comprehensions over manual loops |
| UP | Pyupgrade | Modernizes syntax: type union `X \| Y`, `super()` without args, etc. |
| ANN | Annotations | Enforces type annotations on function signatures |
| S | Bandit | Security: hardcoded passwords, shell injection, insecure modules |
| PL | Pylint | Broad set: complexity, errors, refactoring, warnings |
| PERF | Perflint | Avoids `dict.items()` when only keys needed, unnecessary list() calls, etc. |
| FURB | Refurb | Modernization: `pathlib` over `os.path`, `isinstance` tuples, etc. |

## Running Ruff

```bash
# Lint with auto-fix
uv run ruff check --fix .

# Format
uv run ruff format .

# Check without fixing (CI mode)
uv run ruff check .
uv run ruff format --check .
```
