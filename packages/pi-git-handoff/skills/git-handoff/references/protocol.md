# Git handoff protocol v0.1

## 1. Roles

- **Verification owner**: `verification-delivery` confirms scope, checks,
  persistence, and the applicable Human authorization boundary.
- **Sandbox preparer**: reads an already committed result and creates an
  immutable transport artifact. It has no remote-delivery role.
- **External verifier**: validates repository identity, canonical base,
  artifact integrity, exact diff, and adapter checks in isolation.
- **Human**: explicitly authorizes the displayed push target after external
  verification. Automation cannot manufacture this decision.

## 2. Adapter input

The project-level JSON adapter passed to the executor is the only source for:

- project identity and required package version;
- sandbox and external repository paths;
- canonical remote and base ref;
- delivery and target branch templates;
- outbox and external staging paths;
- external replay checks; local readiness checks remain in the project workflow
  consumed by `verification-delivery`;
- protected paths and fixed non-destructive policy.

The package validates this object against the contract in
`schemas/adapter-extension.v1.schema.json`. A broader workflow adapter may
point to this JSON file from `extensions.git-handoff`. The artifact records the
exact adapter SHA-256. The external stage must use byte-identical adapter input
or stop.

## 3. Prepare contract

Preconditions:

1. delivery readiness has been assessed by `verification-delivery`, and the
   prepare invocation carries its authoritative reference;
2. the repository root and adapter are known and trusted;
3. the selected profile exists in the adapter;
4. the worktree is clean when policy requires it;
5. `HEAD` is a coherent local commit and satisfies the declared base policy;
6. actual changed paths do not intersect protected paths;
7. the configured outbox is ignored by Git, so preparation cannot dirty the
   project.

`prepare` does not execute adapter-defined commands. This preserves the sandbox
security boundary: `verification-delivery` runs and records local readiness
checks before handoff, while the external executor reruns adapter `external`
checks after import.

The prepare executor performs a fixed sequence. It may inspect local Git
objects, create one delivery ref, and create a bundle, but it does not expose
arbitrary Git command execution. It does not stage, commit, merge, rewrite, fetch, push, access host
paths, or change the environment guard.

Output:

```text
<outbox>/<delivery-id>/
├── delivery.bundle
├── manifest.v1.json
├── files.txt
├── prepare-receipt.v1.json
├── logs/
├── SHA256SUMS
└── README.md
```

The directory is immutable. A content or metadata change requires a new
`delivery-id`.

## 4. External verification contract

The external stage:

1. validates package compatibility and adapter identity;
2. validates every artifact hash and rejects missing or extra payload files;
3. verifies the declared bundle ref, commit, tree, prerequisites, and object
   format;
4. verifies the configured canonical repository path and remote identity;
5. refreshes remote knowledge only in the authorized external environment;
6. enforces canonical base and dirty-state policy;
7. imports into an isolated staging repository or worktree;
8. compares the exact changed-file set with the manifest and protected paths;
9. reruns the adapter `external` checks;
10. emits `verify-receipt.v1.json` even when the attempt stops or fails.

Passing verification does not authorize push.

## 5. Push Gate and remote proof

After external verification, display at least:

- delivery ID, commit, and tree;
- canonical base and target branch;
- exact changed-file set and diff summary;
- check results and unresolved risks;
- explicit statements that force-push and direct base-branch push are disabled.

The Human must explicitly confirm this displayed target. The external workflow
emits a confirmation token bound to the artifact, commit, and target. It may
pause interactively or resume with that exact token, and it preserves the
confirmation method and authoritative reference in the push receipt.

The executor then pushes only the exact verified commit to the adapter-derived
target ref. Success from the push process is not final proof. It must re-read
the remote ref and verify the commit identity; the matching local tree is then
recorded. Only this result is `remote-verified`.

## 6. Receipt chain

Each attempt writes an immutable receipt that conforms to
`schemas/receipt.v1.schema.json`:

```text
prepare-receipt.v1.json
  -> verify-receipt.v1.json
  -> push-receipt.v1.json
```

The evidence graph is deliberately one-way to avoid self-hash cycles:

1. the manifest describes the delivery but does not hash any receipt;
2. the prepare receipt records `manifest-sha256`;
3. after the prepare receipt exists, `SHA256SUMS` hashes the immutable outbox
   payload and prepare receipt, excluding `SHA256SUMS` itself;
4. verify and push receipts record `artifact-index-sha256`, the hash of that
   `SHA256SUMS` file, plus `previous-receipt-sha256`.

Logs are stored separately and referenced by digest. Retries receive new
`attempt-id` and `receipt-id` values and never overwrite earlier evidence.

A receipt records transport evidence, not current project state. Project
status changes only in the project's named authority after the receipt is
accepted and reviewed.

## 7. State meanings

```text
committed
  -> prepared
  -> externally-verified
  -> push-authorized
  -> pushed
  -> remote-verified
```

`failed` and `stopped` are evidence-bearing results for one attempt. Safe
preflight failures before an attempt directory exists are reported only on the
structured command channel; later failures also persist a receipt. No failure
automatically rolls back or mutates unrelated repository state.
