# Pi Git Handoff candidate

This directory is the machine entry for the independent cross-project
`git-handoff` outcome.

## Current maturity

- Design decision: accepted under `DEC-PI-GIT-HANDOFF-DESIGN-001`.
- Executor authorization: accepted under `DEC-PI-GIT-HANDOFF-EXECUTORS-001`.
- Persistence: executor implementation is persisted by the containing result commit.
- Verification: local-verified by 15 automated tests, real offline Git bundle,
  project state consistency, and independent review; Windows/GitHub remains
  remote-unverified.
- Execution: `prepare` and `verify-push` exist, but real external use still requires
  a project adapter, external authorization, and the Human push Gate.

## Reading order

1. Read `README.md`.
2. Read `skills/git-handoff/SKILL.md` and only its named references.
3. Read `schemas/` before changing adapter, manifest, or receipt fields.
4. Run `python3 scripts/validate-package.py` after any change.

## Fixed boundaries

- Keep project paths, remotes, refs, transport paths, and checks in the project
  adapter. Never hardcode them in the generic Skill.
- `verification-delivery` owns delivery readiness and authorization.
  `git-handoff` owns cross-host transport and evidence only.
- Sandbox preparation never performs remote Git operations.
- External verification and push never run in the WSL sandbox.
- Do not duplicate the sandbox command denylist inside this package. A future
  prepare implementation exposes a fixed workflow, not arbitrary Git command
  execution, and must stop when the environment guard blocks an operation.
- No Extension, global installation, real project adapter creation, GitHub
  fetch/push, PR, or merge is authorized in the WSL implementation trial.
- Tests may use fake process/Git runners and ignored local artifacts. They must
  not execute real fetch or push from this sandbox.
