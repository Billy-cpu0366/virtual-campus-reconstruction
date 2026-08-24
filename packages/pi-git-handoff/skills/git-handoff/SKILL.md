---
name: git-handoff
description: 执行受限沙盒到外部正式仓库的 Git bundle 中转、外部复核、显式推送 Gate 和版本化收据。仅在已有项目级 JSON adapter 且成果已通过 verification-delivery 时使用；不用于普通本地提交、分支集成、dirty 修复、自动 PR/merge 或从 WSL 运行外部推送。
disable-model-invocation: true
---

# Git handoff

This Skill owns cross-host transport, not delivery readiness. Load
`verification-delivery` first when scope, checks, state persistence, or Human
authorization is not already resolved.

## Entry points

Use the deterministic executors relative to this Skill directory; do not
improvise equivalent Git commands:

```text
node ../../scripts/prepare.mjs --adapter <path> --profile <name> \
  --authority-ref <verification-delivery-reference>
node ../../scripts/verify-push.mjs --external --adapter <path> \
  --artifact <outbox-directory>
```

- `prepare` runs only in the restricted sandbox after a coherent result is
  committed and delivery readiness is established.
- `verify-push` runs only in the external environment that owns the canonical
  repository and remote credentials. Never run it from WSL.
- The first external pass stops at a preview and confirmation token. Continue
  to push only after Human confirms that exact preview.

If the adapter is missing, the package version differs, the environment is
wrong, or authorization is absent, stop. Do not create an adapter, install
global configuration, or broaden the task automatically.

Read `references/protocol.md` for the stage contract and
`references/failure-rules.md` for mandatory stop conditions.

## Authority and adapter

Require a trusted project-level JSON adapter conforming to
`schemas/adapter-extension.v1.schema.json`. Project paths, remotes, refs,
profiles, transport paths, checks, and protected paths come only from that
file. A broader workflow adapter may point to it. Missing values remain
unknown; never infer them from the current directory, remembered projects, or
a prior receipt.

The adapter is stable mapping and policy. Live work-item state and Human Gate
status remain in the authority files named by the project workflow.

`refs.snapshot-profiles` is explicit. An empty array selects canonical mode for
all profiles; listed profiles select snapshot mode. Snapshot manifests and
receipts carry the adapter-derived `history-mode`.

## Security boundary

- Do not duplicate or weaken the environment security guard.
- The sandbox executor exposes one fixed prepare workflow, not arbitrary Git
  subcommands.
- Sandbox preparation contains no fetch, pull, push, clone, remote mutation,
  credential access, or host-path access.
- External verification does not rewrite the canonical base, clean unrelated
  work, force-push, or update a protected base branch.
- Snapshot preparation does not require the canonical base to be an ancestor;
  canonical preparation retains that requirement. Snapshot verification may
  observe a dirty formal worktree, but all import, checkout, checks, and
  receipts occur in external staging only.
- A blocked environment operation is a STOP result, not permission to bypass
  the guard through a script or alternate command.

## Result language

Distinguish these states:

- `prepared`: delivery readiness was established and the immutable sandbox
  artifact passed its fixed identity, scope, bundle, and hash checks;
- `externally-verified`: external identity, bundle, diff, and checks passed;
- `push-authorized`: Human explicitly approved the displayed exact target;
- `pushed`: the push command returned success;
- `remote-verified`: the remote ref and object identity were independently
  re-read and match;
- `failed` or `stopped`: evidence exists, but delivery did not advance.

Only `remote-verified` supports a claim that the exact delivery reached the
remote. It does not imply PR, merge, base-branch inclusion, or product
acceptance. Snapshot preview and push require a nonexistent target ref; a
race is a STOP and never a push. Preview displays `historyMode` and the
non-merge-main risk.
