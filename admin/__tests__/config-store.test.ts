import { mkdtemp, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyTree, listJsonFiles, writeJsonAtomic } from "../lib/config-store";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });
async function fixture() { root = await mkdtemp(path.join(tmpdir(), "admin-store-")); return root; }

describe("config-store", () => {
  it("writes atomically formatted JSON and replaces existing content", async () => {
    const dir = await fixture();
    expect(await writeJsonAtomic(dir, "set1", "02/配置.json", '{"data":{"n":1},"meta":{}}')).toMatchObject({ changed: true, beforeHash: null });
    expect(await readFile(path.join(dir, "set1/02/配置.json"), "utf8")).toBe('{\n  "meta": {},\n  "data": {\n    "n": 1\n  }\n}\n');
    expect((await writeJsonAtomic(dir, "set1", "02/配置.json", '{"meta":{},"data":{"n":2}}')).changed).toBe(true);
  });
  it("skips semantically identical data and enforces the byte limit", async () => {
    const dir = await fixture();
    await writeJsonAtomic(dir, "set1", "x.json", '{"meta":{},"data":{"a":1,"b":2}}');
    expect((await writeJsonAtomic(dir, "set1", "x.json", '{"data":{"b":2,"a":1},"meta":{}}')).changed).toBe(false);
    await expect(writeJsonAtomic(dir, "set1", "too-large.json", JSON.stringify({ data: "x".repeat(2_100_000) }))).rejects.toThrow(/超过/);
  });
  it("copies a full tree and enumerates JSON files", async () => {
    const dir = await fixture(), source = path.join(dir, "source"), target = path.join(dir, "target");
    await mkdir(path.join(source, "nested"), { recursive: true });
    await writeFile(path.join(source, "nested/a.json"), "{}\n"); await writeFile(path.join(source, "readme.txt"), "ok");
    expect(await copyTree(source, target)).toBe(2);
    expect(await listJsonFiles(target)).toEqual(["nested/a.json"]);
    expect(await readFile(path.join(target, "nested/a.json"), "utf8")).toBe("{}\n");
  });
});
