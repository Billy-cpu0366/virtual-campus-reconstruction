# Failure and stop rules

## Prepare must stop

- adapter is absent, invalid, untrusted, or requires another package version;
- selected target profile is absent;
- repository root, local commit, base ref, or tree cannot be proved;
- required clean-worktree policy fails;
- a changed path is protected or escapes the repository root;
- a prepare check fails, times out, or cannot start;
- the environment guard blocks an operation;
- the delivery ID or outbox path already exists;
- generated bundle, manifest, receipt, file list, or hash inventory disagree.

Prepare must not repair these conditions by staging, committing, merging,
rewriting, cleaning, fetching, using host paths, or changing security policy.

## External verification must stop

- artifact files are missing, extra, symlinked unexpectedly, or hash-mismatched;
- manifest, adapter, package, ref, commit, tree, prerequisite, or object format
  disagree;
- canonical repository path or remote identity differs from the adapter;
- canonical base or dirty-state policy fails;
- import requires history guessing, conflict resolution, or destructive work;
- actual files differ from the manifest or intersect protected paths;
- an external check fails or the isolated checkout changes tracked files;
- target ref is the protected base branch or violates its adapter template.

## Push must stop

- external verification is not PASS for the same artifact and attempt chain;
- Human confirmation is absent, ambiguous, or names another target;
- the verified local commit changed after preview;
- target movement would require force or a forbidden non-fast-forward update;
- credentials, remote service, or network verification fail;
- post-push remote identity cannot be re-read exactly.

## Failure evidence

Every attempted stage writes a `FAIL` or `STOPPED` receipt when it can do so
without weakening safety. Record a stable error code, concise message,
completed checks, and unresolved repository state. Do not store credentials,
tokens, environment secrets, or unredacted authenticated URLs.

A failed receipt is not a request to retry automatically. Human or project
authority must resolve the blocking condition and start a new attempt.
