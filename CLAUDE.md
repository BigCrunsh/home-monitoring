# CLAUDE.md

Project guidance for Claude Code. Cross-cutting docs: `README.md`,
`integrations/iobroker/README.md`, `integrations/iobroker/DESIGN_SYSTEM.md`, `openspec/`.

## Model selection for subagents

| Task | Agent | Model |
|---|---|---|
| Codebase search / summarize | `explorer` | haiku |
| Run checks, report pass/fail | `verifier` | haiku |
| Well-specified implementation | `implementer` | sonnet |
| Review a finished change | `code-reviewer` | sonnet |

Launch independent subagents in parallel; give each a precise, self-contained brief
and require a dense summary back (never raw file dumps). The main loop plans and
integrates; cheap agents execute. Don't silently upgrade an agent's model tier.

## Non-negotiables

- TDD: failing test first for every fix/feature; target 2:1 unhappy:happy paths.
- `make check` green before every commit (ruff, black, mypy strict, unit tests).
- `node --check` every edited ioBroker script; re-validate `vis-views.json` as JSON.
- Dashboard colors carry meaning — `DESIGN_SYSTEM.md` and the `vis_card.js` VC_PAL
  tokens are ground truth; never restyle, and verify changes visually (render the
  published view states locally).
- Pi deploys: **drift-check first** — the live system can be ahead of the repo
  (the vis_card layer existed only on the Pi until 2026-07-19). Deploy commands:
  README.md → "Development cycle for dashboard logic".
- One concern per commit; dashboard iterations push directly to `main` (no draft PRs).
