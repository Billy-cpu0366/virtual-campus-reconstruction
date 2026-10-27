import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { normalizeConfigFile } from "../../config/骨架/公共/normalize-config-file.js";
import { loadPlayerConfigs } from "../../config/骨架/02-玩法线/SYS-PLAYER/逻辑/index.js";
import { copyTree, listJsonFiles } from "./config-store";
import { DiskConfigSource } from "./disk-config-source";
import { adminDataRoot, resolveSetPath } from "./paths";

export interface FileCheck { path: string; ok: boolean; message?: string; level?: "error" | "warning"; }
export interface ValidationResult { ok: boolean; fileCount: number; missing: string[]; extra: string[]; errors: FileCheck[]; warnings: FileCheck[]; files: FileCheck[]; }

const PLAYER_KEY = "02-玩法线/SYS-PLAYER/数据/player-config.json";

export async function validateOneFile(root: string, relative: string): Promise<FileCheck> {
  try {
    const raw: unknown = JSON.parse(await readFile(path.join(root, ...relative.split("/")), "utf8"));
    if (!raw || typeof raw !== "object" || !("meta" in raw) || !("data" in raw)) throw new Error("顶层必须包含 meta 和 data");
    normalizeConfigFile(relative, raw as { meta: never; data: unknown });
    return { path: relative, ok: true };
  } catch (error) { return { path: relative, ok: false, message: error instanceof Error ? error.message : String(error), level: "error" }; }
}

async function materializeDraft(slug: string, configRoot: string): Promise<string> {
  const draft = path.join(adminDataRoot(), "drafts", slug);
  try { await stat(draft); return draft; } catch { /* copy published set or default */ }
  const published = resolveSetPath(configRoot, slug);
  try { await stat(published); await copyTree(published, draft); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await copyTree(resolveSetPath(configRoot, "default"), draft);
  }
  return draft;
}

export async function validateSet(slug: string, configRoot: string): Promise<ValidationResult> {
  const standardRoot = resolveSetPath(configRoot, "default");
  const draftRoot = await materializeDraft(slug, configRoot);
  const expected = await listJsonFiles(standardRoot);
  const actual = await listJsonFiles(draftRoot);
  const actualSet = new Set(actual), expectedSet = new Set(expected);
  const missing = expected.filter((file) => !actualSet.has(file));
  const extra = actual.filter((file) => !expectedSet.has(file));
  const files = await Promise.all(actual.map((file) => validateOneFile(draftRoot, file)));
  const errors = files.filter((file) => !file.ok);
  for (const file of missing) errors.push({ path: file, ok: false, level: "error", message: "标准文件缺失" });
  if (actualSet.has(PLAYER_KEY)) {
    try { await loadPlayerConfigs(new DiskConfigSource(draftRoot, resolveSetPath(configRoot, slug))); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!errors.some((item) => item.path === PLAYER_KEY && item.message === message)) errors.push({ path: PLAYER_KEY, ok: false, level: "error", message });
    }
  }
  const warnings = extra.map((file) => ({ path: file, ok: true, level: "warning" as const, message: "不在 default 标准清单中" }));
  return { ok: errors.length === 0, fileCount: actual.length, missing, extra, errors, warnings, files };
}
