import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateOneFile, validateSet } from "../lib/validate-set";

let root = "";
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); root = ""; delete process.env.ADMIN_DATA_ROOT; });
const key = "02-玩法线/SYS-PLAYER/数据/player-config.json";
const player = {
  spawn: { x: 1088, y: 304 }, texture: "player", textureUrl: "/player.png", displaySize: 48, specialDisplaySize: 64,
  spritesheet: { frameSize: { width: 48, height: 48 } },
  animation: { walkFramesPerDirection: 8, frameRate: 10, walkFrameStart: { east: 0, "north-east": 8, "north-west": 16, north: 24, "south-east": 32, "south-west": 40, south: 48, west: 56 } },
  defaultFacing: "south", idle: { timeForIdleAction: 8000, timeForSitting: 30000, animations: ["eating"], textures: [{ action: "eating", key: "eat", url: "/eat.png" }], animationKeys: { eating: "eat", scratching: "scratch", "tying-shoe": "tie", sittingDown: "sit-down", standingUp: "stand-up" }, assetFrames: { frameWidth: 48, frameHeight: 48, startFrame: 0, endFrame: 7 } },
  beach: { texture: "beach", textureUrl: "/beach.png" }, clothing: { offTexture: "off", offTextureUrl: "/off.png", undressAnimationKey: "undress", dressAnimationKey: "dress", frameSize: { width: 64, height: 64 }, assetFrames: { startFrame: 0, endFrame: 47 }, frameRange: { start: 0, end: 47 }, frameRate: 10, offDisplaySize: 64, cooldownMs: 500 }, beachTriggerGid: 1,
};
const meta = { system: "player", source: "test", sourceConstant: "PLAYER", verified: "exact" };
async function setup() {
  root = await mkdtemp(path.join(tmpdir(), "admin-validate-"));
  const config = path.join(root, "config"), adminData = path.join(root, "admin-data");
  process.env.ADMIN_DATA_ROOT = adminData;
  const file = path.join(config, "default", ...key.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ meta, data: player }, null, 2) + "\n");
  return { config, adminData };
}
async function saveDraft(adminData: string, data: unknown) {
  const file = path.join(adminData, "drafts", "set1", ...key.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ meta, data }, null, 2) + "\n");
}

describe("validate-set", () => {
  it("checks the standard file list and reports missing files", async () => {
    const { config } = await setup();
    const result = await validateSet("set1", config);
    expect(result.ok).toBe(true); expect(result.fileCount).toBe(1); expect(result.missing).toEqual([]);
    const draftFile = path.join(root, "admin-data", "drafts", "set1", ...key.split("/"));
    await rm(draftFile);
    const missing = await validateSet("set1", config);
    expect(missing.ok).toBe(false); expect(missing.missing).toEqual([key]);
  });
  it("validates envelopes, reports malformed JSON, missing meta, and extras", async () => {
    const { config, adminData } = await setup();
    const draftFile = path.join(adminData, "drafts", "set1", ...key.split("/"));
    await mkdir(path.dirname(draftFile), { recursive: true });
    await writeFile(draftFile, "{");
    await mkdir(path.join(adminData, "drafts", "set1", "extra"), { recursive: true });
    await writeFile(path.join(adminData, "drafts", "set1", "extra", "other.json"), JSON.stringify({ data: {} }));
    const result = await validateSet("set1", config);
    expect(result.ok).toBe(false); expect(result.extra).toEqual(["extra/other.json"]); expect(result.errors.length).toBeGreaterThan(0);
    expect((await validateOneFile(path.join(adminData, "drafts", "set1"), "extra/other.json")).ok).toBe(false);
  });
  it("reuses SYS-PLAYER semantic validation and reports displaySize field path", async () => {
    const { config, adminData } = await setup();
    await saveDraft(adminData, { ...player, displaySize: 99999 });
    const result = await validateSet("set1", config);
    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.path === key && entry.message?.includes("displaySize"))).toBe(true);
    await saveDraft(adminData, player);
    expect((await validateSet("set1", config)).ok).toBe(true);
  });
});
