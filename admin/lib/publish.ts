import { randomUUID } from "node:crypto";
import { open, readFile, readdir, rm, rename, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { copyTree, listJsonFiles } from "./config-store";
import { adminDataRoot, assertSetName, configRoot, rejectSymlinkPath, resolveSetPath } from "./paths";
import { validateSet } from "./validate-set";
import { validateOneFile } from "./validate-set";
import { DiskConfigSource } from "./disk-config-source";
import { loadPlayerConfigs } from "../../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";

export class PublishError extends Error { constructor(public readonly code: string, message: string, public readonly details?: unknown) { super(message); this.name = "PublishError"; } }
const staleMs = Number(process.env.LOCK_STALE_MS ?? 600_000);

export async function withCampusLock<T>(slug: string, action: () => Promise<T>): Promise<T> {
  assertSetName(slug);
  const locks = path.join(adminDataRoot(), "locks"); await mkdir(locks, { recursive: true });
  const lockPath = path.join(locks, `${slug}.lock`);
  let handle;
  try { handle = await open(lockPath, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const info = await stat(lockPath).catch(() => null);
    if (!info || Date.now() - info.mtimeMs <= staleMs) throw new PublishError("LOCKED", `校园 ${slug} 正在发布，请稍后重试`);
    await rm(lockPath, { force: true });
    try { handle = await open(lockPath, "wx"); } catch { throw new PublishError("LOCKED", `校园 ${slug} 的陈旧锁清理后仍无法取得`); }
  }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })); return await action(); }
  finally { await handle.close(); await rm(lockPath, { force: true }); }
}

async function replaceDirectory(source: string, target: string): Promise<void> {
  const parent = path.dirname(target), name = path.basename(target), token = randomUUID();
  const temp = path.join(parent, `.${name}.publish-tmp-${token}`), old = path.join(parent, `.${name}.old-${token}`);
  await mkdir(parent, { recursive: true });
  await copyTree(source, temp);
  let movedOld = false;
  try {
    try { await rename(target, old); movedOld = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await rename(temp, target);
  } catch (error) {
    if (movedOld) await rename(old, target).catch(() => undefined);
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  if (movedOld) await rm(old, { recursive: true, force: true }).catch(() => undefined);
}

async function snapshotCurrent(slug: string, target: string, kind: string, note?: string) {
  try { await stat(target); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  const root = path.join(adminDataRoot(), "revisions", slug, `${Date.now()}-${randomUUID()}`);
  const fileCount = await copyTree(target, root);
  const relDir = path.relative(adminDataRoot(), root).split(path.sep).join("/");
  return { dir: relDir, fileCount, kind, note };
}

export async function makePreview(slug: string, config = configRoot()) {
  assertSetName(slug);
  const previewSlug = `_preview-${slug}`;
  if (previewSlug.length > 64) throw new PublishError("INVALID_PREVIEW_NAME", "预览集名超过 64 个字符");
  const validation = await validateSet(slug, config);
  if (!validation.ok) throw new PublishError("VALIDATION_FAILED", "整套配置校验失败");
  const draft = path.join(adminDataRoot(), "drafts", slug);
  const target = resolveSetPath(config, previewSlug);
  await rejectSymlinkPath(adminDataRoot(), draft);
  await rejectSymlinkPath(config, target);
  await withCampusLock(slug, async () => replaceDirectory(draft, target));
  const gameOrigin = process.env.GAME_ORIGIN ?? "http://localhost:4175";
  return { slug: previewSlug, url: `${gameOrigin}/?config=${encodeURIComponent(previewSlug)}`, fileCount: validation.fileCount };
}

export async function publishCampus(slug: string, note?: string, config = configRoot()) {
  assertSetName(slug);
  if (slug === "default") throw new PublishError("READ_ONLY", "default 配置集只读，不能发布");
  return withCampusLock(slug, async () => {
    const validation = await validateSet(slug, config);
    if (!validation.ok) throw new PublishError("VALIDATION_FAILED", "整套配置校验失败");
    const target = resolveSetPath(config, slug), draft = path.join(adminDataRoot(), "drafts", slug);
    await rejectSymlinkPath(config, target);
    await rejectSymlinkPath(adminDataRoot(), draft);
    const snapshot = await snapshotCurrent(slug, target, "publish", note);
    await replaceDirectory(draft, target);
    const publishRoot = process.env.PUBLISH_ROOT;
    if (publishRoot) {
      const publishTarget = resolveSetPath(publishRoot, slug);
      try { await rejectSymlinkPath(publishRoot, publishTarget); await replaceDirectory(draft, publishTarget); }
      catch (error) { throw new PublishError("PARTIAL_PUBLISH", `源目录已更新，发布目标未更新：${error instanceof Error ? error.message : String(error)}`, snapshot); }
    }
    return { fileCount: validation.fileCount, snapshot, target };
  });
}

export async function listRevisions(slug: string) {
  assertSetName(slug);
  const root = path.join(adminDataRoot(), "revisions", slug);
  try {
    return (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => b.name.localeCompare(a.name)).map((entry) => ({ id: entry.name, dir: path.join(root, entry.name) }));
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

export async function restoreRevision(slug: string, id: string, config = configRoot(), expectedFileCount?: number) {
  assertSetName(slug);
  if (slug === "default") throw new PublishError("READ_ONLY", "default 配置集只读，不能回滚覆盖");
  if (!/^[0-9]+-[a-f0-9-]+$/.test(id)) throw new PublishError("INVALID_REVISION", "版本编号无效");
  return withCampusLock(slug, async () => {
    const snapshot = path.join(adminDataRoot(), "revisions", slug, id);
    await rejectSymlinkPath(path.join(adminDataRoot(), "revisions"), path.join(adminDataRoot(), "revisions", slug));
    await rejectSymlinkPath(path.join(adminDataRoot(), "revisions", slug), snapshot);
    const actual = await listJsonFiles(snapshot);
    const expected = await listJsonFiles(resolveSetPath(config, "default"));
    if (actual.length === 0 || (expectedFileCount !== undefined && actual.length !== expectedFileCount)) throw new PublishError("INVALID_REVISION", "版本快照的文件数量与索引不一致");
    const missing = expected.filter((file) => !actual.includes(file));
    const errors = (await Promise.all(actual.map((file) => validateOneFile(snapshot, file)))).filter((item) => !item.ok);
    if (missing.length || errors.length) throw new PublishError("VALIDATION_FAILED", `版本快照校验失败：${[...missing, ...errors.map((item) => item.path)].join(", ")}`);
    if (actual.includes("02-玩法线/SYS-PLAYER/数据/player-config.json")) {
      try { await loadPlayerConfigs(new DiskConfigSource(snapshot, snapshot)); }
      catch (error) { throw new PublishError("VALIDATION_FAILED", error instanceof Error ? error.message : String(error)); }
    }
    const target = resolveSetPath(config, slug);
    await rejectSymlinkPath(config, target);
    const current = await snapshotCurrent(slug, target, "rollback", `回滚到 ${id}`);
    await replaceDirectory(snapshot, target);
    return { fileCount: actual.length, currentSnapshot: current };
  });
}

export async function previewFile(slug: string, relative: string, config = configRoot()) {
  const draft = path.join(adminDataRoot(), "drafts", slug);
  const published = resolveSetPath(config, slug);
  const fromDraft = path.join(draft, ...relative.split("/"));
  const fromPublished = path.join(published, ...relative.split("/"));
  for (const file of [fromDraft, fromPublished]) {
    try { return await readFile(file, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  throw new PublishError("NOT_FOUND", `找不到文件 ${relative}`);
}
