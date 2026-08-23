import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const PACKAGE_NAME = "pi-git-handoff";
export const PACKAGE_VERSION = "0.1.0-alpha.3";
export const PROTOCOL_VERSION = "0.1";

export class HandoffError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HandoffError";
    this.code = code;
    this.details = details;
  }
}

function stop(condition, code, message, details) {
  if (condition) throw new HandoffError(code, message, details);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertKeys(value, required, allowed, location, code = "INVALID_ADAPTER") {
  stop(!isObject(value), code, `${location} must be an object`);
  for (const key of required) {
    stop(!(key in value), code, `${location}.${key} is required`);
  }
  for (const key of Object.keys(value)) {
    stop(!allowed.includes(key), code, `${location}.${key} is not allowed`);
  }
}

function assertString(value, location, pattern) {
  stop(typeof value !== "string" || value.length === 0, "INVALID_ADAPTER", `${location} must be a non-empty string`);
  stop(pattern && !pattern.test(value), "INVALID_ADAPTER", `${location} has an invalid format`);
}

function assertBoolean(value, location, expected) {
  stop(typeof value !== "boolean", "INVALID_ADAPTER", `${location} must be boolean`);
  stop(expected !== undefined && value !== expected, "INVALID_ADAPTER", `${location} must be ${expected}`);
}

const RELATIVE_PATH = /^(?:\.|(?!\/)(?![A-Za-z]:)(?!.*\\)(?!.*(?:^|\/)\.\.(?:\/|$)).+)$/;
const EXTERNAL_PATH = /^(?!.*?\/\.\.(?:\/|$))(?:\/[^\0]*|[A-Za-z]:\/[^\0]*)$/;
const PROJECT_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;
const PROFILE_ID = /^[a-z][a-z0-9-]{0,31}$/;
const CHECK_ID = /^[a-z][a-z0-9-]{0,47}$/;
const GIT_REF = /^refs\/[A-Za-z0-9._/-]+$/;
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const DELIVERY_ID = /^[a-z0-9][a-z0-9._-]{5,119}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const VERIFIED_CONTEXT = Symbol("verified-context");

export function validateAdapter(adapter) {
  assertKeys(
    adapter,
    ["schema-version", "required-package-version", "project-id", "repositories", "refs", "transport", "checks", "policy"],
    ["schema-version", "required-package-version", "project-id", "repositories", "refs", "transport", "checks", "policy"],
    "adapter",
  );
  stop(adapter["schema-version"] !== 1, "INVALID_ADAPTER", "adapter.schema-version must be 1");
  stop(adapter["required-package-version"] !== PACKAGE_VERSION, "PACKAGE_VERSION_MISMATCH", `adapter requires ${adapter["required-package-version"]}; executor is ${PACKAGE_VERSION}`);
  assertString(adapter["project-id"], "adapter.project-id", PROJECT_ID);

  const repositories = adapter.repositories;
  assertKeys(repositories, ["sandbox-root", "external-root", "remote-name", "canonical-remote"], ["sandbox-root", "external-root", "remote-name", "canonical-remote"], "adapter.repositories");
  assertString(repositories["sandbox-root"], "adapter.repositories.sandbox-root", RELATIVE_PATH);
  assertString(repositories["external-root"], "adapter.repositories.external-root", EXTERNAL_PATH);
  assertString(repositories["remote-name"], "adapter.repositories.remote-name", /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
  assertString(repositories["canonical-remote"], "adapter.repositories.canonical-remote", /^(?!-)(?![^:]+:\/\/[^/]*@)\S+$/);

  const refs = adapter.refs;
  assertKeys(refs, ["canonical-base", "remote-base", "delivery-template", "targets"], ["canonical-base", "remote-base", "delivery-template", "targets"], "adapter.refs");
  assertString(refs["canonical-base"], "adapter.refs.canonical-base", GIT_REF);
  assertString(refs["remote-base"], "adapter.refs.remote-base", BRANCH);
  assertTemplate(refs["delivery-template"], "adapter.refs.delivery-template");
  stop(!isObject(refs.targets) || Object.keys(refs.targets).length === 0, "INVALID_ADAPTER", "adapter.refs.targets must contain at least one profile");
  for (const [profile, template] of Object.entries(refs.targets)) {
    assertString(profile, "adapter.refs.targets profile", PROFILE_ID);
    assertTargetTemplate(template, `adapter.refs.targets.${profile}`);
  }

  const transport = adapter.transport;
  assertKeys(transport, ["sandbox-outbox", "external-staging"], ["sandbox-outbox", "external-staging"], "adapter.transport");
  assertString(transport["sandbox-outbox"], "adapter.transport.sandbox-outbox", RELATIVE_PATH);
  stop(transport["sandbox-outbox"] === ".", "INVALID_ADAPTER", "adapter.transport.sandbox-outbox cannot be the repository root");
  assertString(transport["external-staging"], "adapter.transport.external-staging", EXTERNAL_PATH);

  const checks = adapter.checks;
  assertKeys(checks, ["external"], ["external"], "adapter.checks");
  validateChecks(checks.external, "adapter.checks.external");

  const policy = adapter.policy;
  assertKeys(
    policy,
    ["require-clean-worktree", "require-exact-base", "allow-force-push", "allow-direct-base-push", "protected-paths"],
    ["require-clean-worktree", "require-exact-base", "allow-force-push", "allow-direct-base-push", "protected-paths"],
    "adapter.policy",
  );
  assertBoolean(policy["require-clean-worktree"], "adapter.policy.require-clean-worktree");
  assertBoolean(policy["require-exact-base"], "adapter.policy.require-exact-base");
  assertBoolean(policy["allow-force-push"], "adapter.policy.allow-force-push", false);
  assertBoolean(policy["allow-direct-base-push"], "adapter.policy.allow-direct-base-push", false);
  stop(!Array.isArray(policy["protected-paths"]), "INVALID_ADAPTER", "adapter.policy.protected-paths must be an array");
  const seenProtected = new Set();
  for (const value of policy["protected-paths"]) {
    assertString(value, "adapter.policy.protected-paths item", RELATIVE_PATH);
    stop(seenProtected.has(value), "INVALID_ADAPTER", `duplicate protected path ${value}`);
    seenProtected.add(value);
  }
  return adapter;
}

function assertTemplate(value, location) {
  assertString(value, location);
  stop((value.match(/\{delivery-id\}/g) || []).length !== 1, "INVALID_ADAPTER", `${location} must contain {delivery-id} exactly once`);
  const probe = value.replace("{delivery-id}", "delivery-id");
  assertString(probe, location, BRANCH);
}

function assertTargetTemplate(value, location) {
  assertTemplate(value, location);
  stop(value.startsWith("refs/"), "INVALID_ADAPTER", `${location} target template must be a branch name, not a full ref`);
}

function renderDeliveryRef(template, deliveryId) {
  const rendered = renderTemplate(template, deliveryId);
  return rendered.startsWith("refs/") ? rendered : `refs/heads/${rendered}`;
}

function validateChecks(checks, location) {
  stop(!Array.isArray(checks), "INVALID_ADAPTER", `${location} must be an array`);
  const ids = new Set();
  for (const [index, check] of checks.entries()) {
    const item = `${location}[${index}]`;
    assertKeys(check, ["id", "argv"], ["id", "argv", "cwd", "timeout-seconds"], item);
    assertString(check.id, `${item}.id`, CHECK_ID);
    stop(ids.has(check.id), "INVALID_ADAPTER", `duplicate check id ${check.id}`);
    ids.add(check.id);
    stop(!Array.isArray(check.argv) || check.argv.length === 0, "INVALID_ADAPTER", `${item}.argv must be a non-empty array`);
    for (const arg of check.argv) assertString(arg, `${item}.argv item`);
    if (check.cwd !== undefined) assertString(check.cwd, `${item}.cwd`, RELATIVE_PATH);
    if (check["timeout-seconds"] !== undefined) {
      stop(!Number.isInteger(check["timeout-seconds"]) || check["timeout-seconds"] < 1 || check["timeout-seconds"] > 86400, "INVALID_ADAPTER", `${item}.timeout-seconds must be 1..86400`);
    }
  }
}

export async function loadAdapter(adapterPath) {
  const raw = await readFile(adapterPath);
  let adapter;
  try {
    adapter = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    throw new HandoffError("INVALID_ADAPTER_JSON", `cannot parse adapter JSON: ${error.message}`);
  }
  validateAdapter(adapter);
  return { adapter, raw, digest: sha256(raw) };
}

export function renderTemplate(template, deliveryId) {
  assertTemplate(template, "ref template");
  assertString(deliveryId, "delivery-id", DELIVERY_ID);
  const rendered = template.replace("{delivery-id}", deliveryId);
  assertString(rendered, "rendered ref", BRANCH);
  stop(rendered.includes("..") || rendered.includes("//") || rendered.endsWith("/") || rendered.endsWith(".lock"), "INVALID_TARGET_REF", `unsafe rendered ref ${rendered}`);
  return rendered;
}

function isInside(parent, candidate) {
  const parentPath = path.resolve(parent);
  const candidatePath = path.resolve(candidate);
  return candidatePath === parentPath || candidatePath.startsWith(`${parentPath}${path.sep}`);
}

export function assertDisjointPaths(first, second, firstLabel, secondLabel) {
  const normalize = (value) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  const firstPath = normalize(first);
  const secondPath = normalize(second);
  stop(isInside(firstPath, secondPath) || isInside(secondPath, firstPath), "PATHS_OVERLAP", `${firstLabel} and ${secondLabel} must be disjoint`);
}

function normalizeCanonical(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function canonicalExistingPath(value, label) {
  let canonical;
  try {
    canonical = await realpath(value);
  } catch (error) {
    throw new HandoffError("PATH_NOT_RESOLVABLE", `${label} cannot be resolved: ${error.message}`);
  }
  return normalizeCanonical(canonical);
}

async function canonicalFuturePath(value, label) {
  let cursor = path.resolve(value);
  const missing = [];
  while (true) {
    try {
      const existing = await realpath(cursor);
      return normalizeCanonical(path.join(existing, ...missing));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new HandoffError("PATH_NOT_RESOLVABLE", `${label} cannot be resolved: ${error.message}`);
      }
      const parent = path.dirname(cursor);
      stop(parent === cursor, "PATH_NOT_RESOLVABLE", `${label} has no existing ancestor`);
      missing.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function ensureDirectoryTreeNoSymlink(value, label) {
  const absolute = path.resolve(value);
  const parsed = path.parse(absolute);
  let cursor = parsed.root;
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    try {
      const stats = await lstat(cursor);
      stop(stats.isSymbolicLink(), "UNEXPECTED_SYMLINK", `${label} contains symlink: ${cursor}`);
      stop(!stats.isDirectory(), "INVALID_DIRECTORY", `${label} contains non-directory: ${cursor}`);
    } catch (error) {
      if (error instanceof HandoffError) throw error;
      if (error.code !== "ENOENT") throw error;
      try {
        await mkdir(cursor);
      } catch (mkdirError) {
        if (mkdirError.code !== "EEXIST") throw mkdirError;
      }
      const stats = await lstat(cursor);
      stop(stats.isSymbolicLink() || !stats.isDirectory(), "UNEXPECTED_SYMLINK", `${label} was replaced during creation: ${cursor}`);
    }
  }
  return await canonicalExistingPath(absolute, label);
}

export function resolveInside(root, relative, label = "path") {
  assertString(relative, label, RELATIVE_PATH);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  stop(resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`), "PATH_ESCAPE", `${label} escapes root`);
  return resolved;
}

export function validateChangedPath(value) {
  stop(typeof value !== "string" || value.length === 0, "INVALID_CHANGED_PATH", "changed path is empty");
  stop(value.includes("\0") || value.includes("\n") || value.includes("\r") || value.includes("\\"), "INVALID_CHANGED_PATH", `changed path cannot be represented safely: ${JSON.stringify(value)}`);
  stop(value.startsWith("/") || /^[A-Za-z]:/.test(value) || value.split("/").includes(".."), "INVALID_CHANGED_PATH", `changed path escapes repository: ${value}`);
  return value;
}

function globRegex(glob) {
  let result = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*") {
      if (glob[index + 1] === "*") {
        result += ".*";
        index += 1;
      } else {
        result += "[^/]*";
      }
    } else if (char === "?") {
      result += "[^/]";
    } else {
      result += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`${result}$`);
}

export function assertUnprotected(files, patterns) {
  const matchers = patterns.map((value) => [value, globRegex(value)]);
  for (const file of files) {
    validateChangedPath(file);
    for (const [pattern, matcher] of matchers) {
      stop(matcher.test(file), "PROTECTED_PATH_CHANGED", `${file} matches protected path ${pattern}`);
    }
  }
}

export async function runCommand(argv, options = {}) {
  stop(!Array.isArray(argv) || argv.length === 0, "INVALID_COMMAND", "argv must be a non-empty array");
  const started = Date.now();
  const timeoutMs = (options.timeoutSeconds ?? 600) * 1000;
  return await new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new HandoffError("COMMAND_START_FAILED", `${argv[0]} failed to start: ${error.message}`, { argv }));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const result = { code: code ?? -1, signal, stdout, stderr, durationMs: Date.now() - started, argv };
      const accepted = options.acceptCodes ?? [0];
      if (!accepted.includes(result.code)) {
        reject(new HandoffError("COMMAND_FAILED", `${argv[0]} exited with ${result.code}`, result));
      } else {
        resolve(result);
      }
    });
  });
}

export async function defaultGit(repoRoot, args, options = {}) {
  return await runCommand(["git", "-C", repoRoot, ...args], options);
}

async function detectWsl() {
  if (process.env.PI_SANDBOX_SESSION === "1" || process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  if (process.platform !== "linux") return false;
  try {
    const release = await readFile("/proc/sys/kernel/osrelease", "utf8");
    return /microsoft|wsl/i.test(release);
  } catch {
    return false;
  }
}

async function assertExternalRuntime(dependencies, requireProcessRunner = false) {
  if (dependencies.testOnlyAllowWsl === true) {
    stop(typeof dependencies.git !== "function", "UNSAFE_TEST_OVERRIDE", "WSL test override requires an injected fake Git runner");
    stop(requireProcessRunner && typeof dependencies.processRunner !== "function", "UNSAFE_TEST_OVERRIDE", "WSL verification override requires an injected fake process runner");
    return;
  }
  stop(await detectWsl(), "SANDBOX_EXTERNAL_FORBIDDEN", "external verification and push cannot run in WSL");
}

function splitNullList(value) {
  return value.split("\0").filter(Boolean).map(validateChangedPath).sort();
}

function cleanOutput(value) {
  return value.replace(/\r?\n$/, "");
}

function compactTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "z").replace("T", "t");
}

function makeDeliveryId(projectId, date, commit) {
  const value = `${projectId}-${compactTimestamp(date)}-${commit.slice(0, 8)}`;
  assertString(value, "generated delivery-id", DELIVERY_ID);
  return value;
}

async function runChecks(checks, root, processRunner, logsDir, stage) {
  const results = [];
  for (const check of checks) {
    const cwd = resolveInside(root, check.cwd ?? ".", `check ${check.id} cwd`);
    let commandResult;
    try {
      commandResult = await processRunner(check.argv, {
        cwd,
        timeoutSeconds: check["timeout-seconds"] ?? 600,
      });
    } catch (error) {
      if (error instanceof HandoffError && error.details?.argv) {
        commandResult = {
          code: error.details.code ?? -1,
          stdout: error.details.stdout ?? "",
          stderr: error.details.stderr ?? error.message,
          durationMs: error.details.durationMs ?? 0,
          argv: check.argv,
        };
      } else {
        throw error;
      }
    }
    const log = `argv=${JSON.stringify(check.argv)}\nexit=${commandResult.code}\nstdout:\n${commandResult.stdout}\nstderr:\n${commandResult.stderr}`;
    const logName = `${stage}-${check.id}.log`;
    await writeFile(path.join(logsDir, logName), log, "utf8");
    const result = commandResult.code === 0 ? "PASS" : "FAIL";
    results.push({
      id: check.id,
      argv: check.argv,
      cwd: check.cwd ?? ".",
      "exit-code": commandResult.code,
      "duration-ms": commandResult.durationMs,
      result,
      "log-sha256": sha256(log),
    });
    if (result !== "PASS") {
      throw new HandoffError("CHECK_FAILED", `${stage} check ${check.id} failed`, { checks: [...results] });
    }
  }
  return results;
}

async function listRegularFiles(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const childPath = path.join(root, childRelative);
    const stats = await lstat(childPath);
    stop(stats.isSymbolicLink(), "UNEXPECTED_SYMLINK", `symlink is forbidden in artifact: ${childRelative}`);
    if (stats.isDirectory()) files.push(...await listRegularFiles(root, childRelative));
    else if (stats.isFile()) files.push(childRelative);
    else throw new HandoffError("UNEXPECTED_ARTIFACT_TYPE", `unsupported artifact entry: ${childRelative}`);
  }
  return files;
}

async function writeHashInventory(root) {
  const files = (await listRegularFiles(root)).filter((value) => value !== "SHA256SUMS").sort();
  const lines = [];
  for (const relative of files) {
    const bytes = await readFile(path.join(root, relative));
    lines.push(`${sha256(bytes)}  ${relative}`);
  }
  const text = `${lines.join("\n")}\n`;
  await writeFile(path.join(root, "SHA256SUMS"), text, "utf8");
  return { text, digest: sha256(text), files };
}

export async function verifyHashInventory(root) {
  const inventoryPath = path.join(root, "SHA256SUMS");
  const text = await readFile(inventoryPath, "utf8");
  stop(!text.endsWith("\n"), "INVALID_HASH_INVENTORY", "SHA256SUMS must end with newline");
  const expected = new Map();
  for (const line of text.slice(0, -1).split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    stop(!match, "INVALID_HASH_INVENTORY", `invalid SHA256SUMS line: ${line}`);
    const relative = validateChangedPath(match[2]);
    stop(relative === "SHA256SUMS" || expected.has(relative), "INVALID_HASH_INVENTORY", `duplicate or self-referential inventory entry: ${relative}`);
    expected.set(relative, match[1]);
  }
  const actual = (await listRegularFiles(root)).filter((value) => value !== "SHA256SUMS").sort();
  stop(actual.length !== expected.size || actual.some((value) => !expected.has(value)), "ARTIFACT_FILE_SET_MISMATCH", "artifact contains missing or extra files");
  for (const relative of actual) {
    const digest = sha256(await readFile(path.join(root, relative)));
    stop(digest !== expected.get(relative), "ARTIFACT_HASH_MISMATCH", `hash mismatch for ${relative}`);
  }
  return { text, digest: sha256(text), files: actual };
}

function validateTimestamp(value, location, code) {
  assertString(value, location);
  stop(Number.isNaN(Date.parse(value)), code, `${location} must be an ISO date-time`);
}

function validateIdentity(value, location, code, allowRef = false) {
  const allowed = allowRef ? ["commit", "tree", "ref"] : ["commit", "tree"];
  const required = allowRef ? allowed : ["commit", "tree"];
  assertKeys(value, required, allowed, location, code);
  assertString(value.commit, `${location}.commit`, GIT_OID);
  assertString(value.tree, `${location}.tree`, GIT_OID);
  if (allowRef) assertString(value.ref, `${location}.ref`, GIT_REF);
}

function validateManifest(manifest) {
  const code = "INVALID_MANIFEST";
  const fields = ["schema-version", "protocol-version", "producer", "adapter-sha256", "delivery-id", "created-at", "profile", "project-id", "canonical-remote", "canonical-base", "delivery", "target-branch", "files", "excluded-paths", "bundle", "authorization", "unresolved-risks"];
  assertKeys(manifest, fields, fields, "manifest", code);
  stop(manifest["schema-version"] !== 1 || manifest["protocol-version"] !== PROTOCOL_VERSION, code, "unsupported manifest schema or protocol");
  assertKeys(manifest.producer, ["package", "version", "command"], ["package", "version", "command"], "manifest.producer", code);
  stop(manifest.producer.package !== PACKAGE_NAME || manifest.producer.version !== PACKAGE_VERSION || manifest.producer.command !== "prepare", code, "manifest producer mismatch");
  assertString(manifest["adapter-sha256"], "manifest.adapter-sha256", SHA256);
  assertString(manifest["delivery-id"], "manifest.delivery-id", DELIVERY_ID);
  validateTimestamp(manifest["created-at"], "manifest.created-at", code);
  assertString(manifest.profile, "manifest.profile", PROFILE_ID);
  assertString(manifest["project-id"], "manifest.project-id", PROJECT_ID);
  assertString(manifest["canonical-remote"], "manifest.canonical-remote", /^(?!-)\S+$/);
  validateIdentity(manifest["canonical-base"], "manifest.canonical-base", code);
  validateIdentity(manifest.delivery, "manifest.delivery", code, true);
  assertString(manifest["target-branch"], "manifest.target-branch", BRANCH);
  for (const field of ["files", "excluded-paths", "unresolved-risks"]) stop(!Array.isArray(manifest[field]), code, `manifest.${field} must be an array`);
  const seen = new Set();
  for (const file of manifest.files) {
    validateChangedPath(file);
    stop(seen.has(file), code, `manifest.files contains duplicate ${file}`);
    seen.add(file);
  }
  manifest["excluded-paths"].forEach((value) => assertString(value, "manifest.excluded-paths item", RELATIVE_PATH));
  manifest["unresolved-risks"].forEach((value) => assertString(value, "manifest.unresolved-risks item"));
  assertKeys(manifest.bundle, ["path", "sha256", "object-format", "verification"], ["path", "sha256", "object-format", "verification"], "manifest.bundle", code);
  stop(manifest.bundle.path !== "delivery.bundle" || manifest.bundle.verification !== "PASS", code, "manifest bundle contract mismatch");
  assertString(manifest.bundle.sha256, "manifest.bundle.sha256", SHA256);
  stop(!["sha1", "sha256"].includes(manifest.bundle["object-format"]), code, "unsupported object format");
  assertKeys(manifest.authorization, ["prepare-invoked", "push-authorized", "authority-ref"], ["prepare-invoked", "push-authorized", "authority-ref"], "manifest.authorization", code);
  stop(manifest.authorization["prepare-invoked"] !== true || manifest.authorization["push-authorized"] !== false, code, "manifest authorization must not claim push approval");
  if (manifest.authorization["authority-ref"] !== undefined) assertString(manifest.authorization["authority-ref"], "manifest.authorization.authority-ref");
  return manifest;
}

function validateReceipt(receipt) {
  const code = "INVALID_RECEIPT";
  const baseRequired = ["schema-version", "protocol-version", "receipt-id", "delivery-id", "attempt-id", "stage", "status", "created-at", "producer", "adapter-sha256", "project-id", "canonical-remote", "checks", "unresolved-risks"];
  const evidenceFields = ["manifest-sha256", "canonical-base", "delivery", "files-sha256"];
  const required = receipt?.status === "PASS" || ["verify", "push"].includes(receipt?.stage) ? [...baseRequired, ...evidenceFields] : baseRequired;
  const allowed = [...baseRequired, ...evidenceFields, "artifact-index-sha256", "previous-receipt-sha256", "remote-result", "human-gate", "failure"];
  assertKeys(receipt, required, allowed, "receipt", code);
  stop(receipt["schema-version"] !== 1 || receipt["protocol-version"] !== PROTOCOL_VERSION, code, "unsupported receipt schema or protocol");
  for (const field of ["receipt-id", "delivery-id", "attempt-id"]) assertString(receipt[field], `receipt.${field}`, DELIVERY_ID);
  stop(!["prepare", "verify", "push"].includes(receipt.stage), code, "invalid receipt stage");
  stop(!["PASS", "FAIL", "STOPPED"].includes(receipt.status), code, "invalid receipt status");
  validateTimestamp(receipt["created-at"], "receipt.created-at", code);
  assertKeys(receipt.producer, ["package", "version", "command", "environment"], ["package", "version", "command", "environment"], "receipt.producer", code);
  stop(receipt.producer.package !== PACKAGE_NAME || receipt.producer.version !== PACKAGE_VERSION, code, "receipt producer package mismatch");
  const expectedCommand = receipt.stage === "prepare" ? "prepare" : "verify-push";
  const expectedEnvironment = receipt.stage === "prepare" ? "sandbox" : "external";
  stop(receipt.producer.command !== expectedCommand || receipt.producer.environment !== expectedEnvironment, code, "receipt stage/producer mismatch");
  assertString(receipt["adapter-sha256"], "receipt.adapter-sha256", SHA256);
  for (const field of ["manifest-sha256", "files-sha256"]) if (receipt[field] !== undefined) assertString(receipt[field], `receipt.${field}`, SHA256);
  for (const field of ["artifact-index-sha256", "previous-receipt-sha256"]) if (receipt[field] !== undefined) assertString(receipt[field], `receipt.${field}`, SHA256);
  if (["verify", "push"].includes(receipt.stage)) {
    stop(!receipt["artifact-index-sha256"] || !receipt["previous-receipt-sha256"], code, "external receipt lacks artifact or prior receipt binding");
  }
  assertString(receipt["project-id"], "receipt.project-id", PROJECT_ID);
  assertString(receipt["canonical-remote"], "receipt.canonical-remote", /^(?!-)\S+$/);
  if (receipt["canonical-base"] !== undefined) validateIdentity(receipt["canonical-base"], "receipt.canonical-base", code);
  if (receipt.delivery !== undefined) validateIdentity(receipt.delivery, "receipt.delivery", code);
  stop(!Array.isArray(receipt.checks) || !Array.isArray(receipt["unresolved-risks"]), code, "receipt checks and risks must be arrays");
  for (const [index, check] of receipt.checks.entries()) {
    assertKeys(check, ["id", "argv", "cwd", "exit-code", "duration-ms", "result", "log-sha256"], ["id", "argv", "cwd", "exit-code", "duration-ms", "result", "log-sha256"], `receipt.checks[${index}]`, code);
    assertString(check.id, `receipt.checks[${index}].id`, CHECK_ID);
    stop(!Array.isArray(check.argv) || check.argv.length === 0 || check.argv.some((value) => typeof value !== "string" || value.length === 0), code, "receipt check argv is invalid");
    assertString(check.cwd, `receipt.checks[${index}].cwd`, RELATIVE_PATH);
    stop(!Number.isInteger(check["exit-code"]) || !Number.isInteger(check["duration-ms"]) || check["duration-ms"] < 0, code, "receipt check numeric result is invalid");
    stop(!["PASS", "FAIL", "STOPPED"].includes(check.result), code, "receipt check result is invalid");
    assertString(check["log-sha256"], `receipt.checks[${index}].log-sha256`, SHA256);
  }
  receipt["unresolved-risks"].forEach((value) => assertString(value, "receipt.unresolved-risks item"));
  if (receipt["human-gate"] !== undefined) {
    assertKeys(receipt["human-gate"], ["required", "status", "method"], ["required", "status", "method", "authority-ref", "quote"], "receipt.human-gate", code);
    assertBoolean(receipt["human-gate"].required, "receipt.human-gate.required");
    stop(!["not-required", "pending", "accepted", "rejected"].includes(receipt["human-gate"].status), code, "receipt human gate status is invalid");
    assertString(receipt["human-gate"].method, "receipt.human-gate.method");
  }
  if (["FAIL", "STOPPED"].includes(receipt.status)) {
    assertKeys(receipt.failure, ["code", "message"], ["code", "message"], "receipt.failure", code);
    assertString(receipt.failure.code, "receipt.failure.code", /^[A-Z][A-Z0-9_]{2,63}$/);
    assertString(receipt.failure.message, "receipt.failure.message");
  }
  if (receipt.stage === "push" && receipt.status === "PASS") {
    stop(receipt["human-gate"]?.required !== true || receipt["human-gate"]?.status !== "accepted", code, "push PASS requires accepted Human gate");
    assertKeys(receipt["remote-result"], ["branch", "commit", "tree", "verification"], ["branch", "commit", "tree", "verification"], "receipt.remote-result", code);
    assertString(receipt["remote-result"].branch, "receipt.remote-result.branch", BRANCH);
    assertString(receipt["remote-result"].commit, "receipt.remote-result.commit", GIT_OID);
    assertString(receipt["remote-result"].tree, "receipt.remote-result.tree", GIT_OID);
    stop(receipt["remote-result"].verification !== "remote-verified", code, "push PASS lacks remote verification");
  }
  return receipt;
}

function validatePrepareReceipt(receipt, manifest, manifestDigest) {
  validateReceipt(receipt);
  stop(receipt.stage !== "prepare" || receipt.status !== "PASS", "INVALID_PREPARE_RECEIPT", "prepare receipt is not PASS");
  stop(receipt["delivery-id"] !== manifest["delivery-id"] || receipt["manifest-sha256"] !== manifestDigest, "INVALID_PREPARE_RECEIPT", "prepare receipt does not bind manifest");
  return receipt;
}

function failureDetails(error) {
  return {
    code: error instanceof HandoffError ? error.code : "UNEXPECTED_ERROR",
    message: error?.message ?? String(error),
  };
}

function failureStatus(error) {
  const failedCodes = new Set(["CHECK_FAILED", "COMMAND_FAILED", "COMMAND_START_FAILED", "REMOTE_VERIFICATION_FAILED"]);
  return !(error instanceof HandoffError) || failedCodes.has(error.code) ? "FAIL" : "STOPPED";
}

function stoppedReceipt({ deliveryId, attemptId, stage, now, adapterDigest, adapter, error, checks = [], manifest, manifestDigest, inventoryDigest, previousReceiptDigest, baseCommit, baseTree, deliveryCommit, deliveryTree, files = [] }) {
  const receipt = {
    "schema-version": 1,
    "protocol-version": PROTOCOL_VERSION,
    "receipt-id": `receipt-${stage}-${sha256(`${deliveryId}\n${attemptId}\n${failureStatus(error)}`).slice(0, 24)}`,
    "delivery-id": deliveryId,
    "attempt-id": attemptId,
    stage,
    status: failureStatus(error),
    "created-at": now.toISOString(),
    producer: {
      package: PACKAGE_NAME,
      version: PACKAGE_VERSION,
      command: stage === "prepare" ? "prepare" : "verify-push",
      environment: stage === "prepare" ? "sandbox" : "external",
    },
    "adapter-sha256": adapterDigest,
    "project-id": adapter["project-id"],
    "canonical-remote": adapter.repositories["canonical-remote"],
    checks,
    failure: failureDetails(error),
    "unresolved-risks": [error?.message ?? String(error)],
  };
  if (manifest) {
    receipt["manifest-sha256"] = manifestDigest;
    receipt["canonical-base"] = manifest["canonical-base"];
    receipt.delivery = { commit: manifest.delivery.commit, tree: manifest.delivery.tree };
    receipt["files-sha256"] = sha256(`${manifest.files.join("\n")}\n`);
  } else if (baseCommit && baseTree && deliveryCommit && deliveryTree) {
    receipt["canonical-base"] = { commit: baseCommit, tree: baseTree };
    receipt.delivery = { commit: deliveryCommit, tree: deliveryTree };
    receipt["files-sha256"] = sha256(`${files.join("\n")}\n`);
  }
  if (inventoryDigest) receipt["artifact-index-sha256"] = inventoryDigest;
  if (previousReceiptDigest) receipt["previous-receipt-sha256"] = previousReceiptDigest;
  validateReceipt(receipt);
  return receipt;
}

function receiptBase({ deliveryId, attemptId, stage, status, now, adapterDigest, adapter, manifestDigest, inventoryDigest, manifest, previousReceiptDigest }) {
  const receipt = {
    "schema-version": 1,
    "protocol-version": PROTOCOL_VERSION,
    "receipt-id": `receipt-${stage}-${sha256(`${deliveryId}\n${attemptId}`).slice(0, 24)}`,
    "delivery-id": deliveryId,
    "attempt-id": attemptId,
    stage,
    status,
    "created-at": now.toISOString(),
    producer: {
      package: PACKAGE_NAME,
      version: PACKAGE_VERSION,
      command: stage === "prepare" ? "prepare" : "verify-push",
      environment: stage === "prepare" ? "sandbox" : "external",
    },
    "adapter-sha256": adapterDigest,
    "manifest-sha256": manifestDigest,
    "project-id": adapter["project-id"],
    "canonical-remote": adapter.repositories["canonical-remote"],
    "canonical-base": manifest["canonical-base"],
    delivery: {
      commit: manifest.delivery.commit,
      tree: manifest.delivery.tree,
    },
    "files-sha256": sha256(`${manifest.files.join("\n")}\n`),
    checks: [],
    "unresolved-risks": [],
  };
  if (inventoryDigest) receipt["artifact-index-sha256"] = inventoryDigest;
  if (previousReceiptDigest) receipt["previous-receipt-sha256"] = previousReceiptDigest;
  return receipt;
}

export async function prepareDelivery(options, dependencies = {}) {
  const now = dependencies.now ?? new Date();
  const git = dependencies.git ?? defaultGit;
  const projectRootInput = path.resolve(options.projectRoot ?? process.cwd());
  const adapterPath = path.resolve(options.adapterPath);
  const { adapter, digest: adapterDigest } = await loadAdapter(adapterPath);
  const projectRootCandidate = path.resolve(projectRootInput, adapter.repositories["sandbox-root"]);
  const projectRoot = await canonicalExistingPath(projectRootCandidate, "sandbox repository");
  const reportedRoot = cleanOutput((await git(projectRoot, ["rev-parse", "--show-toplevel"])).stdout);
  const actualRoot = await canonicalExistingPath(reportedRoot, "reported sandbox Git root");
  stop(actualRoot !== projectRoot, "SANDBOX_ROOT_MISMATCH", `adapter sandbox root ${projectRoot} differs from Git root ${actualRoot}`);
  const remoteName = adapter.repositories["remote-name"];
  const remote = cleanOutput((await git(projectRoot, ["config", "--get", `remote.${remoteName}.url`])).stdout);
  stop(remote !== adapter.repositories["canonical-remote"], "REMOTE_IDENTITY_MISMATCH", "sandbox remote identity differs from adapter");
  const status = (await git(projectRoot, ["status", "--porcelain"])).stdout;
  stop(adapter.policy["require-clean-worktree"] && status.length > 0, "WORKTREE_DIRTY", "sandbox worktree must be clean");

  const commit = cleanOutput((await git(projectRoot, ["rev-parse", "HEAD"])).stdout);
  const tree = cleanOutput((await git(projectRoot, ["rev-parse", "HEAD^{tree}"])).stdout);
  const baseRef = adapter.refs["canonical-base"];
  const baseCommitResult = await git(projectRoot, ["rev-parse", baseRef], { acceptCodes: [0, 128] });
  stop(baseCommitResult.code !== 0, "CANONICAL_BASE_MISSING", `canonical base ref does not exist: ${baseRef}`);
  const baseCommit = cleanOutput(baseCommitResult.stdout);
  const baseTreeResult = await git(projectRoot, ["rev-parse", `${baseRef}^{tree}`], { acceptCodes: [0, 128] });
  stop(baseTreeResult.code !== 0, "CANONICAL_BASE_INVALID", `canonical base has no readable tree: ${baseRef}`);
  const baseTree = cleanOutput(baseTreeResult.stdout);
  assertString(commit, "HEAD", GIT_OID);
  assertString(tree, "HEAD tree", GIT_OID);
  assertString(baseCommit, "canonical base", GIT_OID);
  assertString(baseTree, "canonical base tree", GIT_OID);
  const ancestry = await git(projectRoot, ["merge-base", "--is-ancestor", baseCommit, commit], { acceptCodes: [0, 1] });
  stop(ancestry.code !== 0, "CANONICAL_BASE_NOT_ANCESTOR", "canonical base is not an ancestor of the delivery commit");

  const profile = options.profile;
  stop(typeof options.authorityRef !== "string" || options.authorityRef.length === 0, "DELIVERY_READINESS_REQUIRED", "prepare requires an authority reference from verification-delivery");
  stop(!(profile in adapter.refs.targets), "UNKNOWN_PROFILE", `adapter has no target profile ${profile}`);
  const deliveryId = options.deliveryId ?? makeDeliveryId(adapter["project-id"], now, commit);
  assertString(deliveryId, "delivery-id", DELIVERY_ID);
  const deliveryRef = renderDeliveryRef(adapter.refs["delivery-template"], deliveryId);
  const targetBranch = renderTemplate(adapter.refs.targets[profile], deliveryId);
  stop(targetBranch === adapter.refs["remote-base"], "PROTECTED_BASE_TARGET", "target branch cannot equal remote base");
  await git(projectRoot, ["check-ref-format", deliveryRef]);
  await git(projectRoot, ["check-ref-format", `refs/heads/${targetBranch}`]);
  const refState = await git(projectRoot, ["show-ref", "--verify", "--quiet", deliveryRef], { acceptCodes: [0, 1] });
  stop(refState.code === 0, "DELIVERY_REF_EXISTS", `delivery ref already exists: ${deliveryRef}`);

  const filesRaw = (await git(projectRoot, ["diff", "--name-only", "-z", `${baseCommit}..${commit}`])).stdout;
  const files = splitNullList(filesRaw);
  stop(files.length === 0, "EMPTY_DELIVERY", "delivery has no changed files");
  assertUnprotected(files, adapter.policy["protected-paths"]);

  const outboxCandidate = resolveInside(projectRoot, adapter.transport["sandbox-outbox"], "sandbox outbox");
  const outboxRoot = await canonicalFuturePath(outboxCandidate, "sandbox outbox");
  stop(!isInside(projectRoot, outboxRoot) || outboxRoot === projectRoot, "PATH_ESCAPE", "sandbox outbox must remain inside the canonical repository root");
  const ignoredPath = `${adapter.transport["sandbox-outbox"].replace(/\/$/, "")}/`;
  const ignored = await git(projectRoot, ["check-ignore", "--quiet", "--", ignoredPath], { acceptCodes: [0, 1] });
  stop(ignored.code !== 0, "OUTBOX_NOT_IGNORED", "sandbox outbox must be ignored by Git so preparation cannot dirty the project");
  const finalDirectory = path.join(outboxRoot, deliveryId);
  const partialDirectory = path.join(outboxRoot, `${deliveryId}.partial-${process.pid}`);
  await mkdir(outboxRoot, { recursive: true });
  for (const candidate of [finalDirectory, partialDirectory]) {
    try {
      await lstat(candidate);
      throw new HandoffError("OUTBOX_EXISTS", `immutable outbox path already exists: ${candidate}`);
    } catch (error) {
      if (error instanceof HandoffError) throw error;
      if (error.code !== "ENOENT") throw error;
    }
  }
  await mkdir(partialDirectory);
  const logsDir = path.join(partialDirectory, "logs");
  await mkdir(logsDir);

  try {
    await git(projectRoot, ["update-ref", deliveryRef, commit]);
  const bundlePath = path.join(partialDirectory, "delivery.bundle");
  await git(projectRoot, ["bundle", "create", bundlePath, deliveryRef]);
  const bundleVerify = await git(projectRoot, ["bundle", "verify", bundlePath]);
  const bundleLog = `${bundleVerify.stdout}${bundleVerify.stderr}`;
  await writeFile(path.join(logsDir, "bundle-verify.log"), bundleLog, "utf8");
  const objectFormatResult = await git(projectRoot, ["rev-parse", "--show-object-format"]);
  const objectFormat = cleanOutput(objectFormatResult.stdout);
  stop(!["sha1", "sha256"].includes(objectFormat), "UNSUPPORTED_OBJECT_FORMAT", `unsupported Git object format ${objectFormat}`);

  const filesText = `${files.join("\n")}\n`;
  await writeFile(path.join(partialDirectory, "files.txt"), filesText, "utf8");
  const manifest = {
    "schema-version": 1,
    "protocol-version": PROTOCOL_VERSION,
    producer: { package: PACKAGE_NAME, version: PACKAGE_VERSION, command: "prepare" },
    "adapter-sha256": adapterDigest,
    "delivery-id": deliveryId,
    "created-at": now.toISOString(),
    profile,
    "project-id": adapter["project-id"],
    "canonical-remote": adapter.repositories["canonical-remote"],
    "canonical-base": { commit: baseCommit, tree: baseTree },
    delivery: { ref: deliveryRef, commit, tree },
    "target-branch": targetBranch,
    files,
    "excluded-paths": adapter.policy["protected-paths"],
    bundle: {
      path: "delivery.bundle",
      sha256: sha256(await readFile(bundlePath)),
      "object-format": objectFormat,
      verification: "PASS",
    },
    authorization: {
      "prepare-invoked": true,
      "push-authorized": false,
      "authority-ref": options.authorityRef,
    },
    "unresolved-risks": [],
  };
  validateManifest(manifest);
  const manifestText = jsonText(manifest);
  await writeFile(path.join(partialDirectory, "manifest.v1.json"), manifestText, "utf8");
  const manifestDigest = sha256(manifestText);
  const receipt = receiptBase({
    deliveryId,
    attemptId: "attempt-prepare-0001",
    stage: "prepare",
    status: "PASS",
    now,
    adapterDigest,
    adapter,
    manifestDigest,
    manifest,
  });
  receipt.checks = [];
  receipt["human-gate"] = { required: false, status: "not-required", method: "explicit prepare invocation" };
  validateReceipt(receipt);
  const receiptText = jsonText(receipt);
  await writeFile(path.join(partialDirectory, "prepare-receipt.v1.json"), receiptText, "utf8");
  const readme = `# ${deliveryId}\n\nImmutable ${PACKAGE_NAME} artifact. Validate SHA256SUMS before use.\nPush is not authorized by preparation.\n`;
  await writeFile(path.join(partialDirectory, "README.md"), readme, "utf8");
  const inventory = await writeHashInventory(partialDirectory);
  await rename(partialDirectory, finalDirectory);
    return {
      state: "prepared",
      deliveryId,
      directory: finalDirectory,
      manifest,
      prepareReceipt: receipt,
      artifactIndexSha256: inventory.digest,
    };
  } catch (error) {
    const stoppedDirectory = path.join(outboxRoot, `${deliveryId}.stopped-${process.pid}`);
    try {
      const stopped = stoppedReceipt({
        deliveryId,
        attemptId: "attempt-prepare-0001",
        stage: "prepare",
        now,
        adapterDigest,
        adapter,
        error,
        baseCommit,
        baseTree,
        deliveryCommit: commit,
        deliveryTree: tree,
        files,
      });
      await writeFile(path.join(partialDirectory, "prepare-receipt.v1.json"), jsonText(stopped), "utf8");
      await writeFile(path.join(partialDirectory, "README.md"), `# ${deliveryId} STOPPED\n\nPreparation stopped: ${stopped.failure.code}.\n`, "utf8");
      await writeHashInventory(partialDirectory);
      await rename(partialDirectory, stoppedDirectory);
      if (error instanceof HandoffError) error.details = { ...error.details, evidenceDirectory: stoppedDirectory };
    } catch (evidenceError) {
      if (error instanceof HandoffError) error.details = { ...error.details, evidenceError: evidenceError.message };
    }
    throw error;
  }
}

function parseJson(bytes, code, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new HandoffError(code, `${label} is invalid JSON: ${error.message}`);
  }
}

function confirmationToken(inventoryDigest, manifest) {
  return sha256(`${inventoryDigest}\n${manifest.delivery.commit}\n${manifest["target-branch"]}\n`).slice(0, 24);
}

function verifiedContextDigest(context) {
  return sha256([
    context.adapterDigest,
    context.manifestDigest,
    context.inventoryDigest,
    context.verifyReceiptDigest,
    context.attemptId,
    path.resolve(context.adapterPath),
    path.resolve(context.artifactRoot),
    path.resolve(context.repo),
    path.resolve(context.receiptDir),
    context.confirmationToken,
    jsonText(context.adapter),
    jsonText(context.manifest),
    jsonText(context.preview),
  ].join("\n"));
}

function parseRemoteRef(output, targetRef, allowMissing) {
  const lines = output.trim().split("\n").filter(Boolean);
  if (allowMissing && lines.length === 0) return undefined;
  stop(lines.length !== 1, "REMOTE_VERIFICATION_FAILED", "remote target did not resolve to exactly one ref");
  const fields = lines[0].split("\t");
  stop(fields.length !== 2 || fields[1] !== targetRef, "REMOTE_VERIFICATION_FAILED", "remote response did not name the exact target ref");
  assertString(fields[0], "remote target commit", GIT_OID);
  return fields[0];
}

export async function verifyExternal(options, dependencies = {}) {
  await assertExternalRuntime(dependencies, true);
  const now = dependencies.now ?? new Date();
  const git = dependencies.git ?? defaultGit;
  const processRunner = dependencies.processRunner ?? runCommand;
  const adapterPath = path.resolve(options.adapterPath);
  const artifactRoot = await canonicalExistingPath(options.artifactPath, "artifact");
  const { adapter, digest: adapterDigest } = await loadAdapter(adapterPath);
  const inventory = await verifyHashInventory(artifactRoot);
  const manifestBytes = await readFile(path.join(artifactRoot, "manifest.v1.json"));
  const manifestDigest = sha256(manifestBytes);
  const manifest = validateManifest(parseJson(manifestBytes, "INVALID_MANIFEST", "manifest"));
  stop(manifest["adapter-sha256"] !== adapterDigest, "ADAPTER_DIGEST_MISMATCH", "artifact was prepared with another adapter");
  stop(manifest["project-id"] !== adapter["project-id"] || manifest["canonical-remote"] !== adapter.repositories["canonical-remote"], "PROJECT_IDENTITY_MISMATCH", "artifact project identity differs from adapter");
  stop(!(manifest.profile in adapter.refs.targets), "TARGET_MISMATCH", "manifest profile is absent from adapter");
  stop(manifest["target-branch"] !== renderTemplate(adapter.refs.targets[manifest.profile], manifest["delivery-id"]), "TARGET_MISMATCH", "manifest target is not adapter-derived");
  const expectedDeliveryRef = renderDeliveryRef(adapter.refs["delivery-template"], manifest["delivery-id"]);
  stop(manifest.delivery.ref !== expectedDeliveryRef, "DELIVERY_REF_MISMATCH", "manifest delivery ref is not adapter-derived");
  stop(manifest["target-branch"] === adapter.refs["remote-base"], "PROTECTED_BASE_TARGET", "target branch cannot equal remote base");
  stop(sha256(await readFile(path.join(artifactRoot, "delivery.bundle"))) !== manifest.bundle.sha256, "BUNDLE_HASH_MISMATCH", "bundle hash differs from manifest");
  const filesText = await readFile(path.join(artifactRoot, "files.txt"), "utf8");
  const declaredFiles = filesText.split("\n").filter(Boolean).map(validateChangedPath).sort();
  stop(JSON.stringify(declaredFiles) !== JSON.stringify([...manifest.files].sort()), "FILE_SET_MISMATCH", "files.txt differs from manifest");
  assertUnprotected(declaredFiles, adapter.policy["protected-paths"]);
  const prepareReceiptBytes = await readFile(path.join(artifactRoot, "prepare-receipt.v1.json"));
  const prepareReceipt = validatePrepareReceipt(parseJson(prepareReceiptBytes, "INVALID_PREPARE_RECEIPT", "prepare receipt"), manifest, manifestDigest);
  const prepareReceiptDigest = sha256(prepareReceiptBytes);

  const externalRoot = await canonicalExistingPath(adapter.repositories["external-root"], "external repository");
  const configuredStagingInput = path.resolve(adapter.transport["external-staging"]);
  const configuredStagingFuture = await canonicalFuturePath(configuredStagingInput, "external staging");
  assertDisjointPaths(externalRoot, configuredStagingFuture, "external repository", "external staging");
  assertDisjointPaths(artifactRoot, configuredStagingFuture, "artifact", "external staging");
  const reportedRoot = cleanOutput((await git(externalRoot, ["rev-parse", "--show-toplevel"])).stdout);
  const actualRoot = await canonicalExistingPath(reportedRoot, "reported external Git root");
  stop(actualRoot !== externalRoot, "EXTERNAL_ROOT_MISMATCH", `adapter external root ${externalRoot} differs from Git root ${actualRoot}`);
  const remoteName = adapter.repositories["remote-name"];
  const remote = cleanOutput((await git(externalRoot, ["config", "--get", `remote.${remoteName}.url`])).stdout);
  stop(remote !== adapter.repositories["canonical-remote"], "REMOTE_IDENTITY_MISMATCH", "external remote identity differs from adapter");
  const status = (await git(externalRoot, ["status", "--porcelain"])).stdout;
  stop(adapter.policy["require-clean-worktree"] && status.length > 0, "WORKTREE_DIRTY", "external canonical worktree must be clean");
  const externalObjectFormat = cleanOutput((await git(externalRoot, ["rev-parse", "--show-object-format"])).stdout);
  stop(externalObjectFormat !== manifest.bundle["object-format"], "OBJECT_FORMAT_MISMATCH", "external repository object format differs from bundle manifest");

  const configuredStagingRoot = await ensureDirectoryTreeNoSymlink(configuredStagingInput, "external staging");
  stop(configuredStagingRoot !== configuredStagingFuture, "PATH_CHANGED_DURING_CHECK", "external staging path changed during validation");
  const deliveryStagingRoot = path.join(configuredStagingRoot, manifest["delivery-id"]);
  await ensureDirectoryTreeNoSymlink(deliveryStagingRoot, "delivery staging");
  const attemptId = options.attemptId ?? `attempt-${compactTimestamp(now)}`;
  assertString(attemptId, "attempt-id", DELIVERY_ID);
  const stagingRoot = path.join(deliveryStagingRoot, attemptId);
  try {
    await mkdir(stagingRoot);
  } catch (error) {
    if (error.code === "EEXIST") throw new HandoffError("ATTEMPT_EXISTS", `external attempt already exists: ${stagingRoot}`);
    throw error;
  }
  const canonicalAttemptRoot = await canonicalExistingPath(stagingRoot, "external attempt staging");
  stop(!isInside(configuredStagingRoot, canonicalAttemptRoot), "PATH_ESCAPE", "external attempt escaped configured staging");
  const repo = path.join(canonicalAttemptRoot, "repo");
  const receiptDir = path.join(canonicalAttemptRoot, "receipts");
  const logsDir = path.join(canonicalAttemptRoot, "logs");
  await mkdir(repo);
  await mkdir(receiptDir);
  await mkdir(logsDir);
  try {
    await git(externalRoot, ["fetch", remoteName, "--prune"]);
    const externalBaseRef = `refs/remotes/${remoteName}/${adapter.refs["remote-base"]}`;
    const baseCommit = cleanOutput((await git(externalRoot, ["rev-parse", externalBaseRef])).stdout);
    const baseTree = cleanOutput((await git(externalRoot, ["rev-parse", `${externalBaseRef}^{tree}`])).stdout);
    if (adapter.policy["require-exact-base"]) {
      stop(baseCommit !== manifest["canonical-base"].commit || baseTree !== manifest["canonical-base"].tree, "CANONICAL_BASE_MISMATCH", "external canonical base differs from manifest");
    }
    await git(repo, ["init", `--object-format=${manifest.bundle["object-format"]}`]);
  const stagingObjectFormat = cleanOutput((await git(repo, ["rev-parse", "--show-object-format"])).stdout);
  stop(stagingObjectFormat !== manifest.bundle["object-format"], "OBJECT_FORMAT_MISMATCH", "staging repository object format differs from bundle manifest");
  await git(repo, ["bundle", "verify", path.join(artifactRoot, "delivery.bundle")]);
  const localBaseRef = `refs/pi-handoff/base/${manifest["delivery-id"]}`;
  const importRef = `refs/pi-handoff/import/${manifest["delivery-id"]}`;
  await git(repo, ["fetch", externalRoot, `${externalBaseRef}:${localBaseRef}`]);
  await git(repo, ["fetch", path.join(artifactRoot, "delivery.bundle"), `${manifest.delivery.ref}:${importRef}`]);
  const importedCommit = cleanOutput((await git(repo, ["rev-parse", importRef])).stdout);
  const importedTree = cleanOutput((await git(repo, ["rev-parse", `${importRef}^{tree}`])).stdout);
  stop(importedCommit !== manifest.delivery.commit || importedTree !== manifest.delivery.tree, "IMPORTED_OBJECT_MISMATCH", "imported bundle object differs from manifest");
  await git(repo, ["checkout", "--detach", importedCommit]);
  const actualFiles = splitNullList((await git(repo, ["diff", "--name-only", "-z", `${baseCommit}..${importedCommit}`])).stdout);
  stop(JSON.stringify(actualFiles) !== JSON.stringify(declaredFiles), "FILE_SET_MISMATCH", "external Git diff differs from manifest");
  assertUnprotected(actualFiles, adapter.policy["protected-paths"]);
  const checkResults = await runChecks(adapter.checks.external, repo, processRunner, logsDir, "external");
  const stagedStatus = (await git(repo, ["status", "--porcelain"])).stdout;
  stop(stagedStatus.length > 0, "CHECKS_CHANGED_WORKTREE", "external checks changed the isolated worktree");

  const verifyReceipt = receiptBase({
    deliveryId: manifest["delivery-id"],
    attemptId,
    stage: "verify",
    status: "PASS",
    now,
    adapterDigest,
    adapter,
    manifestDigest,
    inventoryDigest: inventory.digest,
    manifest,
    previousReceiptDigest: prepareReceiptDigest,
  });
  verifyReceipt.checks = checkResults;
  verifyReceipt["human-gate"] = { required: true, status: "pending", method: "external preview" };
  validateReceipt(verifyReceipt);
  const verifyText = jsonText(verifyReceipt);
  const verifyPath = path.join(receiptDir, "verify-receipt.v1.json");
  await writeFile(verifyPath, verifyText, "utf8");
  const token = confirmationToken(inventory.digest, manifest);
  const context = {
    state: "externally-verified",
    adapter,
    adapterPath,
    adapterDigest,
    artifactRoot,
    inventoryDigest: inventory.digest,
    manifest,
    manifestDigest,
    repo,
    receiptDir,
    attemptId,
    verifyReceipt,
    verifyReceiptDigest: sha256(verifyText),
    confirmationToken: token,
    preview: {
      deliveryId: manifest["delivery-id"],
      baseCommit,
      deliveryCommit: manifest.delivery.commit,
      deliveryTree: manifest.delivery.tree,
      targetBranch: manifest["target-branch"],
      files: declaredFiles,
      checks: checkResults.map(({ id, result }) => ({ id, result })),
      unresolvedRisks: manifest["unresolved-risks"],
      forcePush: false,
      directBasePush: false,
    },
  };
  Object.defineProperty(context, VERIFIED_CONTEXT, {
    value: verifiedContextDigest(context),
    enumerable: false,
    writable: false,
  });
    return context;
  } catch (error) {
    try {
      const stopped = stoppedReceipt({
        deliveryId: manifest["delivery-id"],
        attemptId,
        stage: "verify",
        now,
        adapterDigest,
        adapter,
        error,
        checks: error instanceof HandoffError ? (error.details?.checks ?? []) : [],
        manifest,
        manifestDigest,
        inventoryDigest: inventory.digest,
        previousReceiptDigest: prepareReceiptDigest,
      });
      const evidencePath = path.join(receiptDir, "verify-receipt.v1.json");
      await writeFile(evidencePath, jsonText(stopped), "utf8");
      if (error instanceof HandoffError) error.details = { ...error.details, evidencePath };
    } catch (evidenceError) {
      if (error instanceof HandoffError) error.details = { ...error.details, evidenceError: evidenceError.message };
    }
    throw error;
  }
}

export async function pushVerified(verification, options = {}, dependencies = {}) {
  await assertExternalRuntime(dependencies);
  const now = dependencies.now ?? new Date();
  const git = dependencies.git ?? defaultGit;
  stop(!isObject(verification) || verification.state !== "externally-verified", "VERIFICATION_CONTEXT_INVALID", "push requires an externally verified context");
  stop(verification[VERIFIED_CONTEXT] !== verifiedContextDigest(verification), "VERIFICATION_CONTEXT_INVALID", "verified context is absent or changed");
  const repo = verification.repo;
  const currentAdapter = await loadAdapter(verification.adapterPath);
  stop(currentAdapter.digest !== verification.adapterDigest, "ADAPTER_DIGEST_MISMATCH", "adapter changed after external preview");
  const adapter = currentAdapter.adapter;
  const currentInventory = await verifyHashInventory(verification.artifactRoot);
  stop(currentInventory.digest !== verification.inventoryDigest, "ARTIFACT_CHANGED_AFTER_VERIFY", "artifact changed after external preview");
  const manifestBytes = await readFile(path.join(verification.artifactRoot, "manifest.v1.json"));
  stop(sha256(manifestBytes) !== verification.manifestDigest, "ARTIFACT_CHANGED_AFTER_VERIFY", "manifest changed after external preview");
  const manifest = validateManifest(parseJson(manifestBytes, "INVALID_MANIFEST", "manifest"));
  const verifyReceiptBytes = await readFile(path.join(verification.receiptDir, "verify-receipt.v1.json"));
  stop(sha256(verifyReceiptBytes) !== verification.verifyReceiptDigest, "VERIFY_RECEIPT_CHANGED", "verify receipt changed after preview");
  const verifyReceipt = validateReceipt(parseJson(verifyReceiptBytes, "INVALID_RECEIPT", "verify receipt"));
  stop(verifyReceipt.stage !== "verify" || verifyReceipt.status !== "PASS" || verifyReceipt["manifest-sha256"] !== verification.manifestDigest || verifyReceipt["artifact-index-sha256"] !== verification.inventoryDigest, "VERIFY_RECEIPT_INVALID", "verify receipt does not bind the current artifact");
  const expectedToken = confirmationToken(verification.inventoryDigest, manifest);
  stop(verification.confirmationToken !== expectedToken || options.confirmToken !== expectedToken, "HUMAN_CONFIRMATION_REQUIRED", "confirmation token is absent or does not match the verified preview");
  try {
    const verifiedCommit = cleanOutput((await git(repo, ["rev-parse", "HEAD"])).stdout);
  const verifiedTree = cleanOutput((await git(repo, ["rev-parse", "HEAD^{tree}"])).stdout);
  stop(verifiedCommit !== manifest.delivery.commit || verifiedTree !== manifest.delivery.tree, "VERIFIED_CHECKOUT_CHANGED", "isolated checkout changed after external preview");
  const remote = adapter.repositories["canonical-remote"];
  const targetRef = `refs/heads/${manifest["target-branch"]}`;
  const remoteBefore = await git(repo, ["ls-remote", "--heads", "--", remote, targetRef]);
  const beforeCommit = parseRemoteRef(remoteBefore.stdout, targetRef, true);
  if (beforeCommit) {
    const priorRef = `refs/pi-handoff/prior/${manifest["delivery-id"]}`;
    await git(repo, ["fetch", remote, `${targetRef}:${priorRef}`]);
    await git(repo, ["merge-base", "--is-ancestor", beforeCommit, manifest.delivery.commit]);
  }
  await git(repo, ["push", "--", remote, `${manifest.delivery.commit}:${targetRef}`]);
  const remoteAfter = await git(repo, ["ls-remote", "--heads", "--", remote, targetRef]);
  const remoteCommit = parseRemoteRef(remoteAfter.stdout, targetRef, false);
  stop(remoteCommit !== manifest.delivery.commit, "REMOTE_VERIFICATION_FAILED", "remote commit differs after push");

  const receipt = receiptBase({
    deliveryId: manifest["delivery-id"],
    attemptId: verification.attemptId,
    stage: "push",
    status: "PASS",
    now,
    adapterDigest: verification.adapterDigest,
    adapter,
    manifestDigest: verification.manifestDigest,
    inventoryDigest: verification.inventoryDigest,
    manifest,
    previousReceiptDigest: verification.verifyReceiptDigest,
  });
  receipt["remote-result"] = {
    branch: manifest["target-branch"],
    commit: remoteCommit,
    tree: manifest.delivery.tree,
    verification: "remote-verified",
  };
  receipt["human-gate"] = {
    required: true,
    status: "accepted",
    method: "exact confirmation token",
    ...(options.authorityRef ? { "authority-ref": options.authorityRef } : {}),
    ...(options.confirmationQuote ? { quote: options.confirmationQuote } : {}),
  };
  validateReceipt(receipt);
  const receiptText = jsonText(receipt);
    await writeFile(path.join(verification.receiptDir, "push-receipt.v1.json"), receiptText, "utf8");
    return { state: "remote-verified", pushReceipt: receipt };
  } catch (error) {
    try {
      const stopped = stoppedReceipt({
        deliveryId: manifest["delivery-id"],
        attemptId: verification.attemptId,
        stage: "push",
        now,
        adapterDigest: verification.adapterDigest,
        adapter,
        error,
        manifest,
        manifestDigest: verification.manifestDigest,
        inventoryDigest: verification.inventoryDigest,
        previousReceiptDigest: verification.verifyReceiptDigest,
      });
      stopped["human-gate"] = {
        required: true,
        status: "accepted",
        method: "exact confirmation token",
        ...(options.authorityRef ? { "authority-ref": options.authorityRef } : {}),
        ...(options.confirmationQuote ? { quote: options.confirmationQuote } : {}),
      };
      validateReceipt(stopped);
      const evidencePath = path.join(verification.receiptDir, "push-receipt.v1.json");
      await writeFile(evidencePath, jsonText(stopped), "utf8");
      if (error instanceof HandoffError) error.details = { ...error.details, evidencePath };
    } catch (evidenceError) {
      if (error instanceof HandoffError) error.details = { ...error.details, evidenceError: evidenceError.message };
    }
    throw error;
  }
}

export function parseArguments(argv) {
  const result = { positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      result.positional.push(value);
      continue;
    }
    const key = value.slice(2);
    if (key === "help" || key === "interactive" || key === "external") {
      result[key] = true;
      continue;
    }
    stop(index + 1 >= argv.length, "INVALID_ARGUMENT", `${value} requires a value`);
    result[key] = argv[index + 1];
    index += 1;
  }
  return result;
}

export function errorResult(error) {
  const status = failureStatus(error);
  const details = failureDetails(error);
  return { state: status === "FAIL" ? "failed" : "stopped", error: details };
}
