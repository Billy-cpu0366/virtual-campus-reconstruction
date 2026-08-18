import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicRoot = new URL("../public/assets/", import.meta.url);

const requiredAssets = [
  "js/phaser.min.js",
  "maps/final_map.json",
  "maps/exterior-final.webp",
  "maps/collisions-objects.png",
  "sprites/player.webp",
] as const;

describe("当前 Phaser 雏形运行资源", () => {
  it.each(requiredAssets)("包含 %s", (relativePath) => {
    expect(existsSync(new URL(relativePath, publicRoot))).toBe(true);
  });

  it("地图 JSON 可以解析", () => {
    const map = JSON.parse(
      readFileSync(new URL("maps/final_map.json", publicRoot), "utf8"),
    ) as { layers?: unknown[]; tilesets?: unknown[] };

    expect(map.layers).toHaveLength(24);
    expect(map.tilesets).toHaveLength(3);
  });
});
