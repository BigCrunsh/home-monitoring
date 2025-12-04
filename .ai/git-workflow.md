# Git Workflow & Continuous Delivery Best Practices

## Commit Philosophy

**CRITICAL**: Follow Continuous Delivery principles - small, frequent, atomic commits that can be deployed independently.

### Small, Atomic Commits
- Each commit should represent ONE logical change
- Commits should be deployable independently
- If you can't describe the change in one sentence, it's too big
- Prefer 10 small commits over 1 large commit

### Good vs Bad Commit Size

**✅ GOOD - Small, Focused Commits:**
```bash
git commit -m "Add email validation to UserCreate schema"
git commit -m "Add user repository get_by_email method"
git commit -m "Add duplicate email check to user service"
git commit -m "Add tests for duplicate email validation"
```

**❌ BAD - Large, Unfocused Commits:**
```bash
git commit -m "Add user feature"  # Too vague, too much in one commit
git commit -m "Various fixes and improvements"  # Anti-pattern
git commit -m "WIP"  # Never commit WIP to main branch
```

## Pre-Commit Checklist

**MANDATORY**: Before every commit, you MUST:

1. ✅ **Run tests** - ALL must pass
   ```bash
   pytest
   ```
   - ❌ **NEVER commit with failing tests**
   - ❌ **NEVER commit with skipped tests** (without justification)
   - Coverage should not decrease

2. ✅ **Run linter** - NO errors allowed
   ```bash
   ruff check .
   ```
   - ❌ **NEVER commit with linting errors**
   - Fix all errors before committing
   - Warnings should be addressed when possible

3. ✅ **Run formatter**
   ```bash
   black .
   ```
   - Ensure consistent code style
   - No manual formatting needed

4. ✅ **Run type checker** - NO errors allowed
   ```bash
   mypy src/
   ```
   - ❌ **NEVER commit with type errors**
   - Fix all type errors before committing
   - No `type: ignore` without justification

**If ANY of these fail, you MUST fix them before committing. No exceptions.**

## Commit Message Format

Follow Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types (Required)
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change or bug fix)
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling
- `ci`: CI/CD configuration changes

### Examples

```bash
# Feature
git commit -m "feat(user): add email validation to registration"

# Bug fix
git commit -m "fix(auth): handle expired JWT tokens correctly"

# Test
git commit -m "test(user): add unhappy path tests for user creation"

# Refactor
git commit -m "refactor(user): split user service into authentication module"

# Documentation
git commit -m "docs(api): add authentication endpoint examples"

# With body for complex changes
git commit -m "feat(order): add order cancellation logic

- Add cancel_order method to OrderService
- Add OrderStatus.CANCELLED enum value
- Add tests for cancellation with/without refund
- Update order model with cancelled_at timestamp

Closes #123"
```

### Commit Message Rules
- **Subject line**: Max 50 characters, imperative mood ("add" not "added")
- **Body**: Wrap at 72 characters, explain WHAT and WHY (not HOW)
- **Footer**: Reference issues, breaking changes

## Automated Pre-Commit Hooks

Install pre-commit hooks to enforce quality checks:

### Setup Pre-Commit

1. **Install pre-commit**:
   ```bash
   pip install pre-commit
   ```

2. **Create `.pre-commit-config.yaml`**:
   ```yaml
   repos:
     - repo: https://github.com/astral-sh/ruff-pre-commit
       rev: v0.1.9
       hooks:
         - id: ruff
           args: [--fix, --exit-non-zero-on-fix]
         - id: ruff-format
     
     - repo: https://github.com/pre-commit/mirrors-mypy
       rev: v1.7.1
       hooks:
         - id: mypy
           additional_dependencies: [types-all]
           args: [--strict]
     
     - repo: local
       hooks:
         - id: pytest
           name: pytest
           entry: pytest
           language: system
           pass_filenames: false
           always_run: true
   ```

3. **Install the hooks**:
   ```bash
   pre-commit install
   ```

Now every `git commit` will automatically:
- Run Ruff linter and formatter
- Run mypy type checker
- Run pytest test suite

## Continuous Delivery Workflow

### Branch Strategy
```bash
# Main branch is always deployable
main (production-ready)

# Feature branches - short-lived (< 1 day)
feature/user-authentication
feature/order-api

# No long-lived development branches
# Integrate to main frequently (multiple times per day)
```

### Daily Workflow

```bash
# 1. Start day - pull latest
git checkout main
git pull

# 2. Create feature branch
git checkout -b feature/add-user-validation

# 3. Make small change
# Edit code...

# 4. Run quality checks (automated by pre-commit)
pytest
ruff check .
black .
mypy src/

# 5. Commit (pre-commit hooks run automatically)
git add src/schemas/user.py
git commit -m "feat(user): add email format validation"

# 6. Make another small change
# Edit tests...

# 7. Commit again
git add tests/unit/test_user_schema.py
git commit -m "test(user): add email validation unhappy path tests"

# 8. Push frequently
git push origin feature/add-user-validation

# 9. Create PR, merge to main
# 10. Delete feature branch immediately after merge
git checkout main
git pull
git branch -d feature/add-user-validation
```

## When to Commit

Commit whenever you complete a logical unit of work:

✅ **Commit triggers:**
- Added a new function/method
- Fixed a bug
- Added tests for a feature
- Refactored a class
- Updated documentation
- Added a dependency

❌ **Don't commit:**
- At end of day ("saving progress")
- Multiple unrelated changes together
- Code that doesn't pass tests
- Code with linting errors
- Commented-out code
- Debug print statements

## Breaking Changes

For breaking changes, use `BREAKING CHANGE:` in footer:

```bash
git commit -m "feat(api)!: change user endpoint response format

BREAKING CHANGE: UserResponse now returns 'email' instead of 'emailAddress'.
Clients must update their API integration.

Migration guide: Update field name from emailAddress to email in all API calls.
"
```

## Git Workflow Commands Reference

```bash
# Check status before committing
git status

# Stage specific files (prefer this over `git add .`)
git add src/services/user.py tests/unit/test_user_service.py

# Commit with message
git commit -m "feat(user): add user creation service"

# Amend last commit (if not pushed yet)
git commit --amend

# Run pre-commit hooks manually
pre-commit run --all-files

# Skip hooks (ONLY for emergencies, not recommended)
git commit --no-verify -m "hotfix: critical production bug"

# Interactive staging for partial commits
git add -p

# Show what will be committed
git diff --staged
```

## Continuous Integration

Every commit should trigger:
1. ✅ Linting (Ruff)
2. ✅ Type checking (mypy)
3. ✅ Tests (pytest)
4. ✅ Coverage check (minimum 80%)
5. ✅ Security scan (optional: bandit, safety)

## Common Mistakes to Avoid

❌ **Don't:**
- Commit multiple features in one commit
- Commit broken code
- Commit without running tests
- Use vague commit messages ("fix stuff", "updates")
- Commit large refactorings with feature changes
- Let feature branches live more than a day
- Commit generated files (unless necessary)
- Commit `.env` files or secrets

✅ **Do:**
- Break work into smallest deployable units
- Commit working, tested code
- Write descriptive commit messages
- Separate refactoring from feature work
- Merge to main multiple times per day
- Keep commits focused and atomic
- Review your own diff before committing

## AI Assistant Instructions

When the AI suggests code changes, it should ALWAYS:

1. **Suggest commit strategy**: "This change should be 2 commits: one for the service logic, one for the tests"
2. **Provide commit messages**: Give exact conventional commit messages
3. **Remind about pre-commit checks**: "Remember to run pytest and ruff before committing"
4. **Break down large changes**: If suggesting >100 lines of changes, break into multiple commit suggestions
5. **Flag breaking changes**: Explicitly call out if a change is breaking

### Example AI Response Format

```
I'll help you add user authentication. Let's break this into small commits:

**Commit 1: Add JWT utility functions**
Files: src/core/security.py
Commit message: feat(auth): add JWT token generation utilities

**Commit 2: Add authentication service**  
Files: src/services/auth.py
Commit message: feat(auth): add user authentication service

**Commit 3: Add authentication tests**
Files: tests/unit/test_auth_service.py
Commit message: test(auth): add authentication service tests (1 happy + 2 unhappy paths)

Before each commit, run:
- pytest
- ruff check .
- mypy src/

Or just commit and let pre-commit hooks handle it automatically.
```