import { randomUUID, createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { adminDataRoot, rejectSymlinkPath, resolveInside, resolveSetPath } from "./paths";

export const MAX_JSON_BYTES = Number(process.env.MAX_JSON_BYTES ?? 2_097_152);
export const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const stable = (value: unknown): unknown => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]))
    : value;

export async function readJsonFile(root: string, slug: string, relative: string): Promise<{ text: string; hash: string }> {
  const file = resolveSetPath(root, slug, relative);
  await rejectSymlinkPath(root, file);
  const text = await readFile(file, "utf8");
  return { text, hash: sha256(text) };
}

export async function readJsonAt(root: string, relative: string): Promise<{ text: string; hash: string }> {
  const file = resolveInside(root, relative); await rejectSymlinkPath(root, file);
  const text = await readFile(file, "utf8"); return { text, hash: sha256(text) };
}

export async function writeJsonAtomic(root: string, slug: string, relative: string, text: string): Promise<{ changed: boolean; beforeHash: string | null; afterHash: string }> {
  if (slug === "default") throw new Error("default 配置集只读");
  return writeJsonAtomicAt(resolveSetPath(root, slug), relative, text);
}

export async function writeJsonAtomicAt(root: string, relative: string, text: string): Promise<{ changed: boolean; beforeHash: string | null; afterHash: string }> {
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) throw new RangeError(`JSON 文件超过 ${MAX_JSON_BYTES} 字节上限`);
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !("meta" in parsed) || !("data" in parsed) || Object.keys(parsed).length !== 2) {
    throw new Error("配置文件顶层必须且只能包含 meta 和 data");
  }
  const ordered = { meta: (parsed as { meta: unknown }).meta, data: (parsed as { data: unknown }).data };
  const normalized = `${JSON.stringify(ordered, null, 2)}\n`;
  const file = resolveInside(root, relative);
  await rejectSymlinkPath(root, file);
  await mkdir(path.dirname(file), { recursive: true });
  let beforeText: string | null = null;
  try { beforeText = await readFile(file, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (beforeText !== null && JSON.stringify(stable(JSON.parse(beforeText))) === JSON.stringify(stable(parsed))) {
    return { changed: false, beforeHash: sha256(beforeText), afterHash: sha256(beforeText) };
  }
  const temp = `${file}.tmp-${randomUUID()}`;
  try { await writeFile(temp, normalized, { flag: "wx" }); await rename(temp, file); }
  catch (error) { await rm(temp, { force: true }); throw error; }
  return { changed: true, beforeHash: beforeText === null ? null : sha256(beforeText), afterHash: sha256(normalized) };
}

export async function listJsonFiles(root: string): Promise<string[]> {
  await rejectSymlinkPath(root, root);
  const files: string[] = [];
  const visit = async (dir: string, prefix: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`配置目录拒绝符号链接：${path.join(dir, entry.name)}`);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full, rel);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(rel);
    }
  };
  await visit(root, "");
  return files.sort();
}

export async function copyTree(source: string, target: string): Promise<number> {
  await rejectSymlinkPath(source, source);
  await mkdir(target, { recursive: true });
  let count = 0;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`配置目录拒绝符号链接：${path.join(source, entry.name)}`);
    const from = path.join(source, entry.name), to = path.join(target, entry.name);
    if (entry.isDirectory()) count += await copyTree(from, to);
    else if (entry.isFile()) { await mkdir(path.dirname(to), { recursive: true }); await copyFile(from, to); count++; }
  }
  return count;
}

export async function ensureDraft(slug: string, configRoot: string): Promise<string> {
  const draftRoot = path.join(adminDataRoot(), "drafts", slug);
  try { if ((await stat(draftRoot)).isDirectory()) return draftRoot; } catch { /* create a full copy below */ }
  const source = resolveSetPath(configRoot, slug === "default" ? "default" : slug);
  let copySource = source;
  try { await stat(copySource); } catch { copySource = resolveSetPath(configRoot, "default"); }
  await copyTree(copySource, draftRoot);
  return draftRoot;
}
