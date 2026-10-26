import { readdir, stat, readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { normalizeConfigFile } from "../../../../../config/骨架/公共/normalize-config-file.js";
import { loadPlayerConfigs } from "../../../../../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";
import { adminDataRoot, assertSetName, configRoot, rejectSymlinkPath, resolveInside, resolveSetPath } from "../../../../lib/paths";
import { copyTree, listJsonFiles, readJsonAt, sha256, writeJsonAtomicAt } from "../../../../lib/config-store";
import { validateOneFile, validateSet } from "../../../../lib/validate-set";
import { makePreview, publishCampus, restoreRevision, PublishError } from "../../../../lib/publish";
import { prisma } from "../../../../lib/db";
import { audit } from "../../../../lib/audit";
import { assertSameOrigin, failure, jsonBody, requireSession, success } from "../../../../lib/api";
import { DiskConfigSource } from "../../../../lib/disk-config-source";

type Context = { params: Promise<{ segments: string[] }> };
const jsonFiles = async (root: string) => {
  const files = await listJsonFiles(root);
  return Promise.all(files.map(async (file) => ({ path: file, size: (await stat(path.join(root, ...file.split("/")))).size })));
};
const ensureDraft = async (slug: string) => {
  const root = adminDataRoot(); const draft = path.join(root, "drafts", slug);
  await rejectSymlinkPath(root, draft);
  try { await stat(draft); return draft; } catch { /* seed a complete copy */ }
  let source = resolveSetPath(configRoot(), slug);
  try { await stat(source); } catch { source = resolveSetPath(configRoot(), "default"); }
  await copyTree(source, draft); return draft;
};
const decode = (part: string) => decodeURIComponent(part);
const getError = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function GET(request: NextRequest, context: Context) {
  const user = await requireSession(); if (!user) return failure("UNAUTHORIZED", "请先登录", 401);
  const segments = (await context.params).segments.map(decode);
  try {
    if (segments[0] === "campuses" && segments.length === 1) {
      const root = configRoot(); await rejectSymlinkPath(root, root); const entries = await readdir(root, { withFileTypes: true });
      const published = entries.filter((item) => item.isDirectory() && /^[a-z0-9_-]{1,64}$/.test(item.name) && !item.name.startsWith("_preview-")).map((item) => item.name);
      const draftRoot = path.join(adminDataRoot(), "drafts");
      const drafts = await readdir(draftRoot, { withFileTypes: true }).catch(() => []);
      const draftNames = new Set(drafts.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
      const metas = await prisma.campusMeta.findMany(); const bySlug = new Map(metas.map((meta) => [meta.slug, meta]));
      const slugs = [...new Set(["default", ...published, ...draftNames])].sort();
      return success(await Promise.all(slugs.map(async (slug) => ({
        slug, displayName: bySlug.get(slug)?.displayName ?? (slug === "default" ? "默认基准" : slug),
        status: bySlug.get(slug)?.status ?? (published.includes(slug) ? "active" : "draft"),
        readOnly: slug === "default", published: published.includes(slug), draft: draftNames.has(slug),
        updatedAt: bySlug.get(slug)?.updatedAt ?? null,
        lastPublished: (await prisma.revision.findFirst({ where: { campusSlug: slug }, orderBy: { createdAt: "desc" } }))?.createdAt ?? (bySlug.get(slug)?.status === "active" ? bySlug.get(slug)?.updatedAt : null),
        lastEditor: (await prisma.auditLog.findFirst({ where: { campusSlug: slug }, orderBy: { createdAt: "desc" } }))?.userId ?? null,
      }))));
    }
    if (segments[0] === "campuses" && segments.length === 2 && segments[1] === "") return failure("NOT_FOUND", "校园未指定", 404);
    if (segments[0] === "campuses" && segments[2] === "documents" && segments.length === 3) {
      const slug = segments[1]; assertSetName(slug);
      let root: string;
      if (slug === "default") root = resolveSetPath(configRoot(), slug);
      else try { root = await ensureDraft(slug); } catch { root = resolveSetPath(configRoot(), slug); }
      const files = await jsonFiles(root);
      const publishedRoot = resolveSetPath(configRoot(), slug);
      return success({ files: await Promise.all(files.map(async (item) => {
        const validation = await validateOneFile(root, item.path);
        const changed = slug !== "default" && await readJsonAt(root, item.path).then(async (draft) => await readJsonAt(publishedRoot, item.path).then((publishedFile) => draft.hash !== publishedFile.hash).catch(() => true)).catch(() => false);
        return { ...item, modified: changed, validation: validation.ok ? "信封通过" : `信封失败：${validation.message}` };
      })) });
    }
    if (segments[0] === "campuses" && segments[2] === "documents" && segments.length >= 4) {
      const slug = segments[1]; assertSetName(slug); const relative = segments.slice(3).join("/");
      const draft = path.join(adminDataRoot(), "drafts", slug), published = resolveSetPath(configRoot(), slug);
      let value: { text: string; hash: string };
      if (slug === "default" || request.nextUrl.searchParams.get("source") === "published") value = await readJsonAt(published, relative);
      else try { value = await readJsonAt(draft, relative); }
      catch { value = await readJsonAt(published, relative); }
      return success({ path: relative, text: value.text, hash: value.hash, draft: await stat(path.join(draft, ...relative.split("/"))).then(() => true).catch(() => false) });
    }
    if (segments[0] === "campuses" && segments[2] === "revisions" && segments.length === 3) {
      const slug = segments[1]; assertSetName(slug);
      return success(await prisma.revision.findMany({ where: { campusSlug: slug }, orderBy: { number: "desc" } }));
    }
    if (segments[0] === "audit") {
      const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1));
      const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 25)));
      const campusSlug = request.nextUrl.searchParams.get("campus") || undefined;
      const action = request.nextUrl.searchParams.get("action") || undefined;
      const where = { ...(campusSlug ? { campusSlug } : {}), ...(action ? { action } : {}) };
      const [items, total] = await Promise.all([prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }), prisma.auditLog.count({ where })]);
      return success({ items, page, limit, total });
    }
    return failure("NOT_FOUND", "接口不存在", 404);
  } catch (error) { return failure("REQUEST_FAILED", getError(error), 400); }
}

export async function POST(request: NextRequest, context: Context) {
  const user = await requireSession(); if (!user) return failure("UNAUTHORIZED", "请先登录", 401);
  if (!assertSameOrigin(request)) return failure("CSRF_REJECTED", "请求来源校验失败", 403);
  const segments = (await context.params).segments.map(decode), body = await jsonBody(request);
  if (!body) return failure("INVALID_BODY", "请求正文必须是 JSON 对象");
  try {
    if (segments.join("/") === "campuses") {
      const slug = String(body.slug ?? ""); const displayName = String(body.displayName ?? "").trim(); assertSetName(slug);
      if (slug === "default" || !displayName) return failure("INVALID_CAMPUS", "集名或显示名无效");
      const draft = path.join(adminDataRoot(), "drafts", slug);
      try { await stat(draft); return failure("ALREADY_EXISTS", "该校园草稿已存在", 409); } catch { /* continue */ }
      try { await stat(resolveSetPath(configRoot(), slug)); return failure("ALREADY_EXISTS", "该校园已存在", 409); } catch { /* create from default */ }
      await copyTree(resolveSetPath(configRoot(), "default"), draft);
      await prisma.campusMeta.upsert({ where: { slug }, create: { slug, displayName, status: "draft", basedOn: "default" }, update: { displayName, status: "draft", basedOn: "default" } });
      await audit(request, { userId: user.userId, action: "create-campus", campusSlug: slug });
      return success({ slug, displayName }, 201);
    }
    if (segments[0] !== "campuses" || segments.length < 3) return failure("NOT_FOUND", "接口不存在", 404);
    const slug = segments[1]; assertSetName(slug);
    if (segments[2] === "validate") {
      const result = await validateSet(slug, configRoot());
      await audit(request, { userId: user.userId, action: "validate", campusSlug: slug, detail: JSON.stringify({ ok: result.ok, errors: result.errors.length }) });
      return success(result);
    }
    if (segments[2] === "preview") {
      const result = await makePreview(slug, configRoot());
      await audit(request, { userId: user.userId, action: "preview", campusSlug: slug, detail: result.url });
      return success(result);
    }
    if (segments[2] === "publish") {
      const result = await publishCampus(slug, typeof body.note === "string" ? body.note : undefined, configRoot());
      if (result.snapshot) {
        const number = (await prisma.revision.aggregate({ where: { campusSlug: slug }, _max: { number: true } }))._max.number ?? 0;
        await prisma.revision.create({ data: { campusSlug: slug, kind: "publish", number: number + 1, dir: result.snapshot.dir, fileCount: result.snapshot.fileCount, createdBy: user.userId, note: result.snapshot.note } });
      }
      await prisma.campusMeta.upsert({ where: { slug }, create: { slug, displayName: slug, status: "active" }, update: { status: "active" } });
      await audit(request, { userId: user.userId, action: "publish", campusSlug: slug, detail: JSON.stringify({ fileCount: result.fileCount }) });
      return success(result);
    }
    if (segments[2] === "revisions" && segments.length === 5 && segments[4] === "restore") {
      const revision = await prisma.revision.findFirst({ where: { id: segments[3], campusSlug: slug } });
      if (!revision) return failure("REVISION_NOT_FOUND", "找不到该版本", 404);
      const restored = await restoreRevision(slug, path.basename(revision.dir), configRoot(), revision.fileCount);
      const next = (await prisma.revision.aggregate({ where: { campusSlug: slug }, _max: { number: true } }))._max.number ?? 0;
      await prisma.revision.create({ data: { campusSlug: slug, kind: "rollback", number: next + 1, dir: restored.currentSnapshot?.dir ?? revision.dir, fileCount: restored.currentSnapshot?.fileCount ?? restored.fileCount, createdBy: user.userId, note: `回滚到版本 ${revision.number}` } });
      await audit(request, { userId: user.userId, action: "rollback", campusSlug: slug, detail: revision.id });
      return success(restored);
    }
    return failure("NOT_FOUND", "接口不存在", 404);
  } catch (error) {
    if (error instanceof PublishError && error.code === "PARTIAL_PUBLISH" && error.details) {
      const slug = segments[1]; const snapshot = error.details as { dir: string; fileCount: number; note?: string } | null;
      if (snapshot && slug) {
        const number = (await prisma.revision.aggregate({ where: { campusSlug: slug }, _max: { number: true } }))._max.number ?? 0;
        await prisma.revision.create({ data: { campusSlug: slug, kind: "publish", number: number + 1, dir: snapshot.dir, fileCount: snapshot.fileCount, createdBy: user.userId, note: snapshot.note } });
        await audit(request, { userId: user.userId, action: "publish", campusSlug: slug, detail: "源目录已更新，发布目标未更新" });
      }
    }
    return failure((error as { code?: string }).code ?? "REQUEST_FAILED", getError(error), 400, error instanceof PublishError ? error.details : undefined);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  const user = await requireSession(); if (!user) return failure("UNAUTHORIZED", "请先登录", 401);
  if (!assertSameOrigin(request)) return failure("CSRF_REJECTED", "请求来源校验失败", 403);
  const segments = (await context.params).segments.map(decode), body = await jsonBody(request);
  if (segments[0] !== "campuses" || segments[2] !== "documents" || segments.length < 4 || !body || typeof body.text !== "string") return failure("INVALID_BODY", "需要文件路径和 text 字段");
  const slug = segments[1], relative = segments.slice(3).join("/");
  try {
    assertSetName(slug); if (slug === "default") return failure("READ_ONLY", "default 配置集只读", 403);
    if (!relative.endsWith(".json")) return failure("INVALID_PATH", "只能保存 JSON 文件");
    const draft = await ensureDraft(slug), draftFile = resolveInside(draft, relative);
    await rejectSymlinkPath(draft, draftFile);
    const before = await readFile(draftFile, "utf8").catch(() => null);
    const parsed: unknown = JSON.parse(body.text);
    if (!parsed || typeof parsed !== "object" || !("meta" in parsed) || !("data" in parsed)) return failure("VALIDATION_FAILED", "顶层必须包含 meta 和 data", 422);
    normalizeConfigFile(relative, parsed as { meta: never; data: unknown });
    const staging = await mkdtemp(path.join(tmpdir(), "admin-save-"));
    try {
      await copyTree(draft, staging);
      const stagedFile = resolveInside(staging, relative);
      await (await import("node:fs/promises")).mkdir(path.dirname(stagedFile), { recursive: true });
      await writeFile(stagedFile, body.text, "utf8");
      const checked = await validateOneFile(staging, relative);
      if (!checked.ok) return failure("VALIDATION_FAILED", checked.message ?? "文件校验失败", 422, [{ path: relative, message: checked.message }]);
      if (relative === "02-玩法线/SYS-PLAYER/数据/player-config.json") await loadPlayerConfigs(new DiskConfigSource(staging, resolveSetPath(configRoot(), slug)));
    } finally { await rm(staging, { recursive: true, force: true }); }
    const result = await writeJsonAtomicAt(draft, relative, body.text);
    const fileCheck = await validateOneFile(draft, relative);
    if (!fileCheck.ok) return failure("VALIDATION_FAILED", fileCheck.message ?? "校验失败", 422, [{ path: relative, message: fileCheck.message }]);
    await audit(request, { userId: user.userId, action: "save-draft", campusSlug: slug, path: relative, beforeHash: before ? sha256(before) : null, afterHash: result.afterHash });
    return success({ ...result, validation: fileCheck });
  } catch (error) { return failure("VALIDATION_FAILED", getError(error), 422, [{ path: relative, message: getError(error) }]); }
}
