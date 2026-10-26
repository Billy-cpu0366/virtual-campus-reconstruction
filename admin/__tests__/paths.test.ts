import { mkdtemp, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertSetName, PathSafetyError, rejectSymlinkPath, resolveInside, resolveSetPath } from "../lib/paths";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; });

describe("paths", () => {
  it("accepts only config-location set names", () => {
    expect(() => assertSetName("set1_abc-2")).not.toThrow();
    for (const bad of ["../outside", "Upper", "a b", "x".repeat(65), ""]) expect(() => assertSetName(bad)).toThrow(PathSafetyError);
  });
  it("keeps resolved paths within the root", () => {
    expect(resolveSetPath("C:/config", "campus", "02/玩家.json")).toBe(path.resolve("C:/config/campus/02/玩家.json"));
    for (const bad of ["../escape", "/absolute", "C:/absolute", "a//b", "a/./b"]) expect(() => resolveInside("C:/config", bad)).toThrow(PathSafetyError);
  });
  it("rejects paths whose prefix only resembles the root", async () => {
    await expect(rejectSymlinkPath("/config", "/config-evil/file.json")).rejects.toThrow(PathSafetyError);
  });
  it("rejects symlinks when the platform permits creating them", async () => {
    root = await mkdtemp(path.join(tmpdir(), "admin-paths-"));
    const outside = path.join(root, "outside"), inside = path.join(root, "inside");
    await mkdir(outside); await mkdir(inside);
    try { await symlink(outside, path.join(inside, "linked"), "junction"); }
    catch { return; }
    await expect(rejectSymlinkPath(inside, path.join(inside, "linked"))).rejects.toThrow(PathSafetyError);
  });
});
