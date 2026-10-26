import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ConfigSource, RawConfigFile } from "../../config/骨架/公共/config-source.js";
import { normalizeConfigFile } from "../../config/骨架/公共/normalize-config-file.js";
import { rejectSymlinkPath, resolveInside } from "./paths";

export class DiskConfigSource implements ConfigSource {
  constructor(private readonly draftRoot: string, private readonly publishedRoot: string) {}

  async read(key: string): Promise<RawConfigFile> {
    const draft = resolveInside(this.draftRoot, key);
    const published = resolveInside(this.publishedRoot, key);
    let file = draft;
    await rejectSymlinkPath(this.draftRoot, draft);
    try { await readFile(file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      file = published;
      await rejectSymlinkPath(this.publishedRoot, published);
    }
    const raw: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!raw || typeof raw !== "object" || !("meta" in raw) || !("data" in raw)) throw new Error(`${key}: 顶层必须包含 meta 和 data`);
    return normalizeConfigFile(key, raw as RawConfigFile) as RawConfigFile;
  }
}
