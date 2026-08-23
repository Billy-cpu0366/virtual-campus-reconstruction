# Pi Git Handoff

`pi-git-handoff` is a candidate Pi Package for moving a committed Git result
from a restricted WSL sandbox to an external canonical repository, then
verifying and pushing the exact result with versioned receipts.

## Status

| Dimension | Status |
|---|---|
| Human direction | design and executor implementation accepted |
| Design persistence | persisted in `683ea17` |
| Executor persistence | alpha.2 in `c6eee9f`; alpha.3 full-ref fix by the containing result commit |
| Local validation | verified: 17 tests, real offline bundle, state consistency, independent review |
| Prepare implementation | implemented; sandbox-local operations only |
| External verify/push implementation | implemented; WSL tests use a fake Git runner |
| Global or project installation | not authorized |
| Real Windows/GitHub round trip | not verified |

The package is locally testable, but it must not be described as remotely
verified until a separately authorized Windows round trip produces a valid
push receipt.

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

The Skill invokes deterministic Node.js executors relative to its package:

```text
Sandbox executor:
node scripts/prepare.mjs --adapter <git-handoff.json> --profile <name> \
  --authority-ref <verification-delivery-reference>

External executor:
node scripts/verify-push.mjs --external \
  --adapter <git-handoff.json> --artifact <outbox-directory>
```

`verify-push` first emits the exact preview and confirmation token. It pushes
only after the same verified workflow receives that token through interactive
input or `--confirm-token`. Automation must not infer push authorization from
tests, a local commit, or bundle creation.

## Package contents

```text
skills/git-handoff/          Skill contract and one-level references
schemas/                     Adapter extension, manifest, and receipt schemas
examples/                    Generic cross-project examples
scripts/core.mjs             Shared deterministic implementation
scripts/prepare.mjs          Sandbox-only preparation entry point
scripts/verify-push.mjs      External verification and push entry point
scripts/validate-package.py  Standard-library static validation
tests/executors.test.mjs     Fake-runner and artifact tests
```

## Adapter boundary

Every project-specific value belongs in the project-level JSON adapter passed
through `--adapter`. A future project workflow adapter may point to this file
from its `extensions.git-handoff` namespace:

- sandbox and external repository paths;
- canonical remote identity;
- canonical base, local delivery ref template (full ref or branch fragment), and
  allowed target branch templates;
- sandbox outbox and external staging paths;
- external replay check commands; local readiness checks remain owned by
  `verification-delivery` and the project workflow adapter;
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

This implementation milestone does not:

- modify global Pi settings or install a Pi Package;
- create a real project adapter;
- modify the existing WSL security guard;
- maintain a second Git command denylist;
- stage, commit, merge, fetch, push, create a PR, or update a remote from WSL;
- run the external executor against GitHub during sandbox tests;
- reconcile unrelated dirty work or divergent histories;
- claim that a Human product or visual gate passed.
