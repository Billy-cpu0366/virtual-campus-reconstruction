import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makePreview, publishCampus, restoreRevision, withCampusLock, PublishError } from "../lib/publish";

let root = "";
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = ""; delete process.env.CONFIG_ROOT; delete process.env.ADMIN_DATA_ROOT; delete process.env.PUBLISH_ROOT;
});
const relative = "sample.json", meta = { system: "test", source: "test", sourceConstant: "test", verified: "exact" };
async function setup() {
  root = await mkdtemp(path.join(tmpdir(), "admin-publish-"));
  const config = path.join(root, "config"), data = path.join(root, "data");
  process.env.CONFIG_ROOT = config; process.env.ADMIN_DATA_ROOT = data;
  const base = path.join(config, "default", relative), draft = path.join(data, "drafts", "set1", relative);
  await mkdir(path.dirname(base), { recursive: true }); await mkdir(path.dirname(draft), { recursive: true });
  await writeFile(base, JSON.stringify({ meta, data: { value: 1 } }));
  await writeFile(draft, JSON.stringify({ meta, data: { value: 2 } }));
  return { config, data, draft, published: path.join(config, "set1", relative) };
}

describe("publish", () => {
  it("materializes preview, publishes atomically, and snapshots the previous published set", async () => {
    const { config, data, published } = await setup();
    const preview = await makePreview("set1", config);
    expect(preview.slug).toBe("_preview-set1");
    expect(JSON.parse(await readFile(path.join(config, preview.slug, relative), "utf8")).data.value).toBe(2);
    const first = await publishCampus("set1", "first", config);
    expect(first.snapshot).toBeNull();
    expect(JSON.parse(await readFile(published, "utf8")).data.value).toBe(2);
    await writeFile(path.join(data, "drafts", "set1", relative), JSON.stringify({ meta, data: { value: 3 } }));
    const second = await publishCampus("set1", "second", config);
    expect(second.snapshot?.fileCount).toBe(1);
    expect(JSON.parse(await readFile(published, "utf8")).data.value).toBe(3);
    await restoreRevision("set1", path.basename(second.snapshot!.dir), config, 1);
    expect(JSON.parse(await readFile(published, "utf8")).data.value).toBe(2);
  });
  it("rejects lock collisions and protects default", async () => {
    const { config } = await setup();
    await expect(withCampusLock("set1", () => withCampusLock("set1", async () => undefined))).rejects.toMatchObject({ code: "LOCKED" });
    await expect(publishCampus("default", undefined, config)).rejects.toMatchObject({ code: "READ_ONLY" });
  });
  it("reports a partial publish when a configured target cannot be replaced", async () => {
    const { config, published } = await setup();
    process.env.PUBLISH_ROOT = path.join(root, "publish-is-a-file");
    await writeFile(process.env.PUBLISH_ROOT, "block");
    await expect(publishCampus("set1", undefined, config)).rejects.toMatchObject({ code: "PARTIAL_PUBLISH" });
    expect(JSON.parse(await readFile(published, "utf8")).data.value).toBe(2);
  });
});
