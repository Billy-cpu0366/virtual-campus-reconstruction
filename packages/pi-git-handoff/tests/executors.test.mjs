import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import {
  HandoffError,
  PACKAGE_VERSION,
  assertDisjointPaths,
  assertUnprotected,
  defaultGit,
  errorResult,
  loadAdapter,
  prepareDelivery,
  pushVerified,
  renderTemplate,
  validateAdapter,
  verifyExternal,
  verifyHashInventory,
} from "../scripts/core.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = path.resolve(PACKAGE_ROOT, "../..");
const RUNTIME_ROOT = path.join(WORKSPACE_ROOT, ".pi", "git-handoff-tests");
const REMOTE = "https://example.invalid/acme/example-project.git";
const BASE_COMMIT = "a".repeat(40);
const BASE_TREE = "b".repeat(40);
const DELIVERY_COMMIT = "c".repeat(40);
const DELIVERY_TREE = "d".repeat(40);
const BASE_REF = "refs/pi-handoff/canonical/main";

async function runtimeDirectory(label) {
  const directory = path.join(RUNTIME_ROOT, `${label}-${process.pid}-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  return directory;
}

function adapterFor(projectRoot, externalRoot, externalStaging) {
  return {
    "schema-version": 1,
    "required-package-version": PACKAGE_VERSION,
    "project-id": "example-project",
    repositories: {
      "sandbox-root": ".",
      "external-root": externalRoot.replaceAll("\\", "/"),
      "remote-name": "upstream",
      "canonical-remote": REMOTE,
    },
    refs: {
      "canonical-base": BASE_REF,
      "remote-base": "main",
      "delivery-template": "delivery/{delivery-id}",
      targets: { review: "handoff/{delivery-id}" },
    },
    transport: {
      "sandbox-outbox": ".pi/handoff/outbox",
      "external-staging": externalStaging.replaceAll("\\", "/"),
    },
    checks: {
      external: [{ id: "external-check", argv: ["fake", "external"] }],
    },
    policy: {
      "require-clean-worktree": true,
      "require-exact-base": true,
      "allow-force-push": false,
      "allow-direct-base-push": false,
      "protected-paths": [".env", ".git/**"],
    },
  };
}

function processResult(argv, overrides = {}) {
  return {
    code: 0,
    signal: null,
    stdout: "",
    stderr: "",
    durationMs: 1,
    argv,
    ...overrides,
  };
}

function createPrepareGit(projectRoot, operations) {
  return async (_repo, args) => {
    operations.push(args);
    const joined = args.join(" ");
    if (joined === "rev-parse --show-toplevel") return processResult(args, { stdout: `${projectRoot}\n` });
    if (joined === "config --get remote.upstream.url") return processResult(args, { stdout: `${REMOTE}\n` });
    if (joined === "status --porcelain") return processResult(args);
    if (joined === "rev-parse HEAD") return processResult(args, { stdout: `${DELIVERY_COMMIT}\n` });
    if (joined === "rev-parse HEAD^{tree}") return processResult(args, { stdout: `${DELIVERY_TREE}\n` });
    if (joined === `rev-parse ${BASE_REF}`) return processResult(args, { stdout: `${BASE_COMMIT}\n` });
    if (joined === `rev-parse ${BASE_REF}^{tree}`) return processResult(args, { stdout: `${BASE_TREE}\n` });
    if (args[0] === "merge-base" || args[0] === "check-ref-format" || args[0] === "update-ref" || args[0] === "check-ignore") return processResult(args);
    if (args[0] === "show-ref") return processResult(args, { code: 1 });
    if (args[0] === "diff") return processResult(args, { stdout: "src/example.js\0" });
    if (args[0] === "bundle" && args[1] === "create") {
      await writeFile(args[2], "deterministic fake bundle\n", "utf8");
      return processResult(args);
    }
    if (args[0] === "bundle" && args[1] === "verify") return processResult(args, { stdout: "bundle is okay\n" });
    if (joined === "rev-parse --show-object-format") return processResult(args, { stdout: "sha1\n" });
    throw new Error(`unexpected prepare Git operation: ${joined}`);
  };
}

function createExternalGit({ externalRoot, stageRoot, operations }) {
  let pushed = false;
  return async (repo, args) => {
    operations.push({ repo, args });
    const joined = args.join(" ");
    if (joined === "rev-parse --show-toplevel") return processResult(args, { stdout: `${externalRoot}\n` });
    if (joined === "config --get remote.upstream.url") return processResult(args, { stdout: `${REMOTE}\n` });
    if (joined === "status --porcelain") return processResult(args);
    if (joined === "fetch upstream --prune") return processResult(args);
    if (joined === "rev-parse refs/remotes/upstream/main") return processResult(args, { stdout: `${BASE_COMMIT}\n` });
    if (joined === "rev-parse refs/remotes/upstream/main^{tree}") return processResult(args, { stdout: `${BASE_TREE}\n` });
    if (joined === "rev-parse --show-object-format") return processResult(args, { stdout: "sha1\n" });
    if (args[0] === "init" || args[0] === "fetch" || args[0] === "checkout" || (args[0] === "bundle" && args[1] === "verify")) return processResult(args);
    if (joined === "rev-parse HEAD") return processResult(args, { stdout: `${DELIVERY_COMMIT}\n` });
    if (joined === "rev-parse HEAD^{tree}") return processResult(args, { stdout: `${DELIVERY_TREE}\n` });
    if (args[0] === "rev-parse" && args[1].endsWith("^{tree}") && args[1].startsWith("refs/pi-handoff/import/")) return processResult(args, { stdout: `${DELIVERY_TREE}\n` });
    if (args[0] === "rev-parse" && args[1].startsWith("refs/pi-handoff/import/")) return processResult(args, { stdout: `${DELIVERY_COMMIT}\n` });
    if (args[0] === "diff") return processResult(args, { stdout: "src/example.js\0" });
    if (args[0] === "ls-remote") {
      return processResult(args, { stdout: pushed ? `${DELIVERY_COMMIT}\t${args.at(-1)}\n` : "" });
    }
    if (args[0] === "push") {
      pushed = true;
      return processResult(args);
    }
    throw new Error(`unexpected external Git operation in ${repo || stageRoot}: ${joined}`);
  };
}

async function prepareFixture(label = "fixture") {
  const runtime = await runtimeDirectory(label);
  const projectRoot = path.join(runtime, "project");
  const externalRoot = path.join(runtime, "external");
  const externalStaging = path.join(runtime, "staging");
  await mkdir(projectRoot, { recursive: true });
  await mkdir(externalRoot, { recursive: true });
  const adapter = adapterFor(projectRoot, externalRoot, externalStaging);
  const adapterPath = path.join(projectRoot, "git-handoff.json");
  await writeFile(adapterPath, `${JSON.stringify(adapter, null, 2)}\n`, "utf8");
  const operations = [];
  const result = await prepareDelivery({
    adapterPath,
    profile: "review",
    projectRoot,
    deliveryId: "example-delivery-0001",
    authorityRef: "DEC-EXAMPLE-001",
  }, {
    now: new Date("2026-08-23T00:00:00Z"),
    git: createPrepareGit(projectRoot, operations),
  });
  return { runtime, projectRoot, externalRoot, externalStaging, adapter, adapterPath, operations, result };
}

test("adapter validation rejects version mismatch and unknown keys", () => {
  const adapter = adapterFor("/tmp/project", "/tmp/external", "/tmp/staging");
  assert.equal(validateAdapter(adapter), adapter);
  assert.throws(
    () => validateAdapter({ ...adapter, "required-package-version": "9.9.9" }),
    (error) => error instanceof HandoffError && error.code === "PACKAGE_VERSION_MISMATCH",
  );
  assert.throws(
    () => validateAdapter({ ...adapter, unexpected: true }),
    (error) => error instanceof HandoffError && error.code === "INVALID_ADAPTER",
  );
  const targetAsFullRef = adapterFor("/tmp/project", "/tmp/external", "/tmp/staging");
  targetAsFullRef.refs.targets.review = "refs/heads/handoff/{delivery-id}";
  assert.throws(
    () => validateAdapter(targetAsFullRef),
    (error) => error instanceof HandoffError && error.code === "INVALID_ADAPTER",
  );
});

test("target templates, protected paths, and staging paths are deterministic", () => {
  assert.equal(renderTemplate("handoff/{delivery-id}", "example-delivery-0001"), "handoff/example-delivery-0001");
  assert.throws(() => renderTemplate("main", "example-delivery-0001"), /exactly once/);
  assert.doesNotThrow(() => assertUnprotected(["src/example.js"], [".env", ".git/**"]));
  assert.throws(
    () => assertUnprotected([".env"], [".env"]),
    (error) => error instanceof HandoffError && error.code === "PROTECTED_PATH_CHANGED",
  );
  assert.doesNotThrow(() => assertDisjointPaths("/srv/repo", "/srv/staging", "repo", "staging"));
  assert.throws(
    () => assertDisjointPaths("/srv/repo", "/srv/repo/staging", "repo", "staging"),
    (error) => error instanceof HandoffError && error.code === "PATHS_OVERLAP",
  );
});

test("prepare creates immutable artifact and no remote Git operations", async () => {
  const fixture = await prepareFixture("prepare");
  assert.equal(fixture.result.state, "prepared");
  assert.equal(fixture.result.manifest["target-branch"], "handoff/example-delivery-0001");
  assert.deepEqual(fixture.result.manifest.files, ["src/example.js"]);
  const inventory = await verifyHashInventory(fixture.result.directory);
  assert.equal(inventory.digest, fixture.result.artifactIndexSha256);
  assert.ok(inventory.files.includes("delivery.bundle"));
  assert.ok(inventory.files.includes("prepare-receipt.v1.json"));
  const forbidden = fixture.operations.filter((args) => ["fetch", "pull", "push", "clone"].includes(args[0]));
  assert.deepEqual(forbidden, []);
  await assert.rejects(
    prepareDelivery({
      adapterPath: fixture.adapterPath,
      profile: "review",
      projectRoot: fixture.projectRoot,
      deliveryId: "example-delivery-0001",
      authorityRef: "DEC-EXAMPLE-001",
    }, {
      now: new Date("2026-08-23T00:00:01Z"),
      git: createPrepareGit(fixture.projectRoot, []),
    }),
    (error) => error instanceof HandoffError && error.code === "OUTBOX_EXISTS",
  );
});

test("prepare preserves a full delivery ref template exactly", async () => {
  const runtime = await runtimeDirectory("full-delivery-ref");
  const projectRoot = path.join(runtime, "project");
  const externalRoot = path.join(runtime, "external");
  const externalStaging = path.join(runtime, "staging");
  await mkdir(projectRoot, { recursive: true });
  await mkdir(externalRoot, { recursive: true });
  const adapter = adapterFor(projectRoot, externalRoot, externalStaging);
  adapter.refs["delivery-template"] = "refs/pi-handoff/delivery/{delivery-id}";
  const adapterPath = path.join(projectRoot, "git-handoff.json");
  await writeFile(adapterPath, `${JSON.stringify(adapter, null, 2)}\n`, "utf8");
  const operations = [];
  await prepareDelivery({
    adapterPath,
    profile: "review",
    projectRoot,
    deliveryId: "example-full-ref-0001",
    authorityRef: "DEC-EXAMPLE-001",
  }, {
    git: createPrepareGit(projectRoot, operations),
  });
  const updateRef = operations.find((args) => args[0] === "update-ref");
  assert.equal(updateRef[1], "refs/pi-handoff/delivery/example-full-ref-0001");
});

test("prepare classifies a missing canonical ref as stopped", async () => {
  const runtime = await runtimeDirectory("missing-canonical-ref");
  const projectRoot = path.join(runtime, "project");
  const externalRoot = path.join(runtime, "external");
  const externalStaging = path.join(runtime, "staging");
  await mkdir(projectRoot, { recursive: true });
  await mkdir(externalRoot, { recursive: true });
  const adapter = adapterFor(projectRoot, externalRoot, externalStaging);
  const adapterPath = path.join(projectRoot, "git-handoff.json");
  await writeFile(adapterPath, `${JSON.stringify(adapter, null, 2)}\n`, "utf8");
  let observed;
  await assert.rejects(
    prepareDelivery({
      adapterPath,
      profile: "review",
      projectRoot,
      deliveryId: "example-missing-base-0001",
      authorityRef: "DEC-EXAMPLE-001",
    }, {
      git: async (repo, args, options) => {
        if (args[0] === "rev-parse" && args[1] === BASE_REF) {
          return processResult(args, { code: 128, stderr: "unknown revision" });
        }
        return createPrepareGit(projectRoot, [])(repo, args, options);
      },
    }),
    (error) => {
      observed = error;
      return error instanceof HandoffError;
    },
  );
  assert.equal(errorResult(observed).state, "stopped");
  assert.equal(observed.code, "CANONICAL_BASE_MISSING");
});

test("external verification binds adapter, artifact, Human token, and remote result", async () => {
  const fixture = await prepareFixture("external");
  const operations = [];
  const git = createExternalGit({
    externalRoot: fixture.externalRoot,
    stageRoot: fixture.externalStaging,
    operations,
  });
  const verification = await verifyExternal({
    adapterPath: fixture.adapterPath,
    artifactPath: fixture.result.directory,
    attemptId: "attempt-external-0001",
  }, {
    now: new Date("2026-08-23T00:01:00Z"),
    git,
    processRunner: async (argv) => processResult(argv),
    testOnlyAllowWsl: true,
  });
  assert.equal(verification.state, "externally-verified");
  assert.equal(verification.preview.forcePush, false);
  assert.equal(verification.preview.directBasePush, false);
  await assert.rejects(
    pushVerified(verification, { confirmToken: "wrong-token" }, { git, testOnlyAllowWsl: true }),
    (error) => error instanceof HandoffError && error.code === "HUMAN_CONFIRMATION_REQUIRED",
  );
  const pushed = await pushVerified(verification, {
    confirmToken: verification.confirmationToken,
    authorityRef: "DEC-EXAMPLE-PUSH-001",
    confirmationQuote: "confirm exact target",
  }, {
    now: new Date("2026-08-23T00:02:00Z"),
    git,
    testOnlyAllowWsl: true,
  });
  assert.equal(pushed.state, "remote-verified");
  assert.equal(pushed.pushReceipt["remote-result"].commit, DELIVERY_COMMIT);
  const pushCalls = operations.filter(({ args }) => args[0] === "push");
  assert.equal(pushCalls.length, 1);
  assert.deepEqual(pushCalls[0].args, [
    "push",
    "--",
    REMOTE,
    `${DELIVERY_COMMIT}:refs/heads/handoff/example-delivery-0001`,
  ]);
});

test("forged verification context cannot reach push", async () => {
  const fixture = await prepareFixture("forged-context");
  const operations = [];
  const git = createExternalGit({ externalRoot: fixture.externalRoot, stageRoot: fixture.externalStaging, operations });
  const verification = await verifyExternal({
    adapterPath: fixture.adapterPath,
    artifactPath: fixture.result.directory,
    attemptId: "attempt-forged-0001",
  }, {
    git,
    processRunner: async (argv) => processResult(argv),
    testOnlyAllowWsl: true,
  });
  await assert.rejects(
    pushVerified({ ...verification }, { confirmToken: verification.confirmationToken }, { git, testOnlyAllowWsl: true }),
    (error) => error instanceof HandoffError && error.code === "VERIFICATION_CONTEXT_INVALID",
  );
  verification.manifest["target-branch"] = "handoff/tampered";
  await assert.rejects(
    pushVerified(verification, { confirmToken: verification.confirmationToken }, { git, testOnlyAllowWsl: true }),
    (error) => error instanceof HandoffError && error.code === "VERIFICATION_CONTEXT_INVALID",
  );
  assert.equal(operations.filter(({ args }) => args[0] === "push").length, 0);
});

test("prepare rejects an outbox symlink that escapes the repository", async () => {
  const runtime = await runtimeDirectory("outbox-symlink");
  const projectRoot = path.join(runtime, "project");
  const externalRoot = path.join(runtime, "external");
  const externalStaging = path.join(runtime, "staging");
  const escaped = path.join(runtime, "escaped-outbox");
  await mkdir(projectRoot, { recursive: true });
  await mkdir(externalRoot, { recursive: true });
  await mkdir(escaped);
  await symlink(escaped, path.join(projectRoot, ".handoff"), "dir");
  const adapter = adapterFor(projectRoot, externalRoot, externalStaging);
  adapter.transport["sandbox-outbox"] = ".handoff";
  const adapterPath = path.join(projectRoot, "git-handoff.json");
  await writeFile(adapterPath, `${JSON.stringify(adapter, null, 2)}\n`, "utf8");
  await assert.rejects(
    prepareDelivery({
      adapterPath,
      profile: "review",
      projectRoot,
      deliveryId: "example-symlink-0001",
      authorityRef: "DEC-EXAMPLE-001",
    }, {
      git: createPrepareGit(projectRoot, []),
    }),
    (error) => error instanceof HandoffError && error.code === "PATH_ESCAPE",
  );
});

test("prepare bundle failure produces an immutable failure receipt", async () => {
  const runtime = await runtimeDirectory("prepare-failure");
  const projectRoot = path.join(runtime, "project");
  const externalRoot = path.join(runtime, "external");
  const externalStaging = path.join(runtime, "staging");
  await mkdir(projectRoot, { recursive: true });
  await mkdir(externalRoot, { recursive: true });
  const adapter = adapterFor(projectRoot, externalRoot, externalStaging);
  const adapterPath = path.join(projectRoot, "git-handoff.json");
  await writeFile(adapterPath, `${JSON.stringify(adapter, null, 2)}\n`, "utf8");
  const baseGit = createPrepareGit(projectRoot, []);
  let captured;
  await assert.rejects(
    prepareDelivery({
      adapterPath,
      profile: "review",
      projectRoot,
      deliveryId: "example-failed-prepare-0001",
      authorityRef: "DEC-EXAMPLE-001",
    }, {
      git: async (repo, args, options) => {
        if (args[0] === "bundle" && args[1] === "create") {
          throw new HandoffError("COMMAND_FAILED", "bundle creation failed", { argv: args, code: 1 });
        }
        return baseGit(repo, args, options);
      },
    }),
    (error) => {
      captured = error;
      return error instanceof HandoffError && error.code === "COMMAND_FAILED";
    },
  );
  assert.ok(captured.details.evidenceDirectory);
  const receipt = JSON.parse(await readFile(path.join(captured.details.evidenceDirectory, "prepare-receipt.v1.json"), "utf8"));
  assert.equal(receipt.stage, "prepare");
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.failure.code, "COMMAND_FAILED");
  await verifyHashInventory(captured.details.evidenceDirectory);
});

test("external check failure produces a chained failure receipt", async () => {
  const fixture = await prepareFixture("verify-failure");
  const git = createExternalGit({ externalRoot: fixture.externalRoot, stageRoot: fixture.externalStaging, operations: [] });
  let captured;
  await assert.rejects(
    verifyExternal({
      adapterPath: fixture.adapterPath,
      artifactPath: fixture.result.directory,
      attemptId: "attempt-verify-failed-0001",
    }, {
      git,
      processRunner: async (argv) => processResult(argv, { code: 2, stderr: "test failed" }),
      testOnlyAllowWsl: true,
    }),
    (error) => {
      captured = error;
      return error instanceof HandoffError && error.code === "CHECK_FAILED";
    },
  );
  const receipt = JSON.parse(await readFile(captured.details.evidencePath, "utf8"));
  assert.equal(receipt.stage, "verify");
  assert.equal(receipt.status, "FAIL");
  assert.match(receipt["previous-receipt-sha256"], /^[a-f0-9]{64}$/);
  assert.equal(receipt.checks[0].result, "FAIL");
});

test("push command failure produces a Human-gated failure receipt", async () => {
  const fixture = await prepareFixture("push-failure");
  const baseGit = createExternalGit({ externalRoot: fixture.externalRoot, stageRoot: fixture.externalStaging, operations: [] });
  const verification = await verifyExternal({
    adapterPath: fixture.adapterPath,
    artifactPath: fixture.result.directory,
    attemptId: "attempt-push-failed-0001",
  }, {
    git: baseGit,
    processRunner: async (argv) => processResult(argv),
    testOnlyAllowWsl: true,
  });
  let captured;
  await assert.rejects(
    pushVerified(verification, {
      confirmToken: verification.confirmationToken,
      confirmationQuote: "confirm exact target",
    }, {
      git: async (repo, args, options) => {
        if (args[0] === "push") throw new HandoffError("COMMAND_FAILED", "push failed", { argv: args, code: 1 });
        return baseGit(repo, args, options);
      },
      testOnlyAllowWsl: true,
    }),
    (error) => {
      captured = error;
      return error instanceof HandoffError && error.code === "COMMAND_FAILED";
    },
  );
  const receipt = JSON.parse(await readFile(captured.details.evidencePath, "utf8"));
  assert.equal(receipt.stage, "push");
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt["human-gate"].status, "accepted");
  assert.equal(receipt.failure.code, "COMMAND_FAILED");
});

test("WSL verification override requires both fake runners", async () => {
  await assert.rejects(
    verifyExternal({ adapterPath: "missing", artifactPath: "missing" }, {
      git: async () => processResult([]),
      testOnlyAllowWsl: true,
    }),
    (error) => error instanceof HandoffError && error.code === "UNSAFE_TEST_OVERRIDE",
  );
});

test("external verification stops when adapter bytes change", async () => {
  const fixture = await prepareFixture("adapter-digest");
  const altered = { ...fixture.adapter, checks: { ...fixture.adapter.checks, external: [] } };
  await writeFile(fixture.adapterPath, `${JSON.stringify(altered, null, 2)}\n`, "utf8");
  await assert.rejects(
    verifyExternal({
      adapterPath: fixture.adapterPath,
      artifactPath: fixture.result.directory,
      attemptId: "attempt-external-0002",
    }, {
      git: async () => { throw new Error("Git must not run before adapter digest validation"); },
      processRunner: async () => { throw new Error("process runner must not run before adapter digest validation"); },
      testOnlyAllowWsl: true,
    }),
    (error) => error instanceof HandoffError && error.code === "ADAPTER_DIGEST_MISMATCH",
  );
});

test("real local Git prepare creates and verifies a bundle without remote operations", async () => {
  const runtime = await runtimeDirectory("real-git");
  const projectRoot = path.join(runtime, "project");
  const externalRoot = path.join(runtime, "external");
  const stagingRoot = path.join(runtime, "staging");
  await mkdir(projectRoot, { recursive: true });
  const localGit = async (...args) => defaultGit(projectRoot, args);
  await localGit("init");
  await writeFile(path.join(projectRoot, ".gitignore"), ".handoff/\n", "utf8");
  await writeFile(path.join(projectRoot, "base.txt"), "base\n", "utf8");
  await localGit("add", "--", ".gitignore", "base.txt");
  await localGit("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "base");
  const baseCommit = (await localGit("rev-parse", "HEAD")).stdout.trim();
  await localGit("update-ref", BASE_REF, baseCommit);
  await writeFile(path.join(projectRoot, "delivery.txt"), "delivery\n", "utf8");
  await localGit("add", "--", "delivery.txt");
  await localGit("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "delivery");

  const adapter = adapterFor(projectRoot, externalRoot, stagingRoot);
  adapter.transport["sandbox-outbox"] = ".handoff";
  const adapterPath = path.join(runtime, "git-handoff.json");
  await writeFile(adapterPath, `${JSON.stringify(adapter, null, 2)}\n`, "utf8");
  const operations = [];
  const git = async (repo, args, options) => {
    operations.push(args);
    if (args.join(" ") === "config --get remote.upstream.url") {
      return processResult(args, { stdout: `${REMOTE}\n` });
    }
    return defaultGit(repo, args, options);
  };
  const result = await prepareDelivery({
    adapterPath,
    profile: "review",
    projectRoot,
    deliveryId: "example-real-git-0001",
    authorityRef: "DEC-EXAMPLE-001",
  }, {
    now: new Date("2026-08-23T00:05:00Z"),
    git,
  });
  assert.equal(result.state, "prepared");
  assert.deepEqual(result.manifest.files, ["delivery.txt"]);
  assert.equal((await verifyHashInventory(result.directory)).digest, result.artifactIndexSha256);
  assert.deepEqual(
    operations.filter((args) => ["fetch", "pull", "push", "clone"].includes(args[0])),
    [],
  );
});

test("verify-push CLI refuses the sandbox before reading adapter input", () => {
  const result = spawnSync(process.execPath, [
    path.join(PACKAGE_ROOT, "scripts", "verify-push.mjs"),
    "--external",
    "--adapter", "missing.json",
    "--artifact", "missing-artifact",
  ], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    env: { ...process.env, PI_SANDBOX_SESSION: "1" },
  });
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stderr);
  assert.equal(output.state, "stopped");
  assert.equal(output.error.code, "SANDBOX_EXTERNAL_FORBIDDEN");
});

test("receipt schema requires the same check evidence as runtime validation", async () => {
  const schema = JSON.parse(await readFile(path.join(PACKAGE_ROOT, "schemas", "receipt.v1.schema.json"), "utf8"));
  assert.deepEqual(
    [...schema.$defs["check-result"].required].sort(),
    ["argv", "cwd", "duration-ms", "exit-code", "id", "log-sha256", "result"].sort(),
  );
});

test("package example adapter matches runtime validation", async () => {
  const { adapter } = await loadAdapter(path.join(PACKAGE_ROOT, "examples", "adapter-extension.v1.json"));
  assert.equal(adapter["required-package-version"], PACKAGE_VERSION);
});
