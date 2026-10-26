import path from "node:path";
import { lstat } from "node:fs/promises";
import { isConfigSetName } from "../../config/骨架/公共/config-location.js";

export class PathSafetyError extends Error { constructor(message: string) { super(message); this.name = "PathSafetyError"; } }

export function assertSetName(slug: string): void {
  if (!isConfigSetName(slug)) throw new PathSafetyError(`非法配置集名：${slug}`);
}

export function resolveInside(root: string, relative: string): string {
  if (path.isAbsolute(relative) || relative.includes("\\") || relative.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new PathSafetyError(`非法相对路径：${relative}`);
  }
  const base = path.resolve(root);
  const target = path.resolve(base, ...relative.split("/"));
  if (!target.startsWith(base + path.sep)) throw new PathSafetyError(`路径越出根目录：${relative}`);
  return target;
}

export function resolveSetPath(root: string, slug: string, relative?: string): string {
  assertSetName(slug);
  const setRoot = resolveInside(root, slug);
  return relative === undefined ? setRoot : resolveInside(setRoot, relative);
}

export async function rejectSymlinkPath(root: string, target: string): Promise<void> {
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new PathSafetyError("目标路径越出允许根目录");
  try { if ((await lstat(base)).isSymbolicLink()) throw new PathSafetyError(`拒绝符号链接根目录：${base}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const relative = path.relative(base, resolved);
  let current = base;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new PathSafetyError(`拒绝符号链接：${current}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  }
}

export const configRoot = (): string => path.resolve(process.env.CONFIG_ROOT ?? "../config");
export const adminDataRoot = (): string => path.resolve(process.env.ADMIN_DATA_ROOT ?? "./admin-data");
