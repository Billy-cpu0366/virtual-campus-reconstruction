# Pi Git Handoff

`pi-git-handoff` is a design-only candidate Pi Package for moving a committed
Git result from a restricted WSL sandbox to an external canonical repository,
then verifying and pushing the exact result with versioned receipts.

## Status

| Dimension | Status |
|---|---|
| Human direction | accepted |
| Design persistence | persisted by the containing result commit |
| Static validation | verified: package validator, project state check, and independent review PASS |
| Prepare implementation | not implemented |
| External verify/push implementation | not implemented |
| Global or project installation | not authorized |
| Real GitHub round trip | not verified |

This package must not be described as operational until the two deterministic
executors and their isolated Git tests exist.

## Why this is independent

`verification-delivery` answers **whether a result is ready and authorized for
delivery**. `git-handoff` answers **how an already committed result crosses a
host boundary and how that transport is proved**. Keeping them separate avoids
turning the general verification Skill into a project-specific upload tool.

The intended relationship is:

```text
verification-delivery
  -> git-handoff prepare
  -> immutable outbox
  -> git-handoff verify-push
  -> versioned receipt chain
```

## Intended user interface

These are command contracts, not currently executable commands:

```text
Sandbox Pi:  /skill:git-handoff prepare --profile <adapter-profile>
External Pi: /skill:git-handoff verify-push <delivery-id>
```

The Human starts one command on each side. A future external command may pause
inside the same workflow for the required push confirmation. Automation must
not infer push authorization from tests, a local commit, or bundle creation.

## Package contents

```text
skills/git-handoff/          Skill contract and one-level references
schemas/                     Adapter extension, manifest, and receipt schemas
examples/                    Generic cross-project examples
scripts/validate-package.py  Standard-library static validation
```

There is deliberately no `prepare` or `verify-push` executor in this design
milestone.

## Adapter boundary

Every project-specific value belongs under the existing project adapter's
`extensions.git-handoff` namespace:

- sandbox and external repository paths;
- canonical remote identity;
- canonical base, local delivery ref template, and allowed target templates;
- sandbox outbox and external staging paths;
- prepare and external check commands;
- protected paths and non-destructive policy.

The generic Skill and future executors must reject a missing or incompatible
adapter instead of guessing values. The adapter stores stable mappings and
policy, never live phase, gate, or outcome values.

See `schemas/adapter-extension.v1.schema.json` and
`examples/adapter-extension.v1.json`.

## Evidence model

A handoff uses two different evidence types:

- `manifest.v1.json`: what the sandbox claims should be delivered;
- `receipt.v1.json`: what a specific prepare, verify, or push attempt actually
  observed and did.

Receipts are append-only. A later receipt references the SHA-256 of the prior
receipt. A retry gets a new attempt and receipt ID; it never overwrites a failed
or stopped attempt.

See `skills/git-handoff/references/protocol.md` for the complete state flow.

## Explicit non-scope

This milestone does not:

- modify global Pi settings or install a Pi Package;
- create a project `.ai-workflow/project.yaml`;
- modify the existing WSL security guard;
- maintain a second Git command denylist;
- stage, commit, merge, bundle, fetch, push, create a PR, or update a remote;
- reconcile unrelated dirty work or divergent histories;
- claim that a Human product or visual gate passed.
