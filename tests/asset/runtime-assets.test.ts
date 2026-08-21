import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_MAPS = resolve(
  ROOT,
  "sample/original-public-build/mirror/assets/maps",
);
const RUNTIME_MAPS = resolve(ROOT, "public/maps");
const RAW_PARTICLE_GIDS = new Set([69355, 69356, 69357, 69358, 69359]);
const MARKER_GIDS = new Map([
  ["cars", new Set([69345, 69346, 69347, 69348, 69349, 69350, 69351, 69352])],
  ["particles3", new Set([69361])],
  ["footsteps", new Set([69345])],
]);
type JsonTileset = Record<string, unknown>;
type JsonLayer = { name?: string; data?: number[] };

function pngDimensions(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function runtimeMapFiles(): string[] {
  return [
    "final_map.json",
    "chunks/master.json",
    ...Array.from({ length: 25 }, (_, index) => `chunks/chunk${index}.json`),
  ];
}

describe("M1 runtime particle asset contract", () => {
  it("copies the evidence image, inlines metadata, and preserves GID boundaries", () => {
    execFileSync(process.execPath, ["scripts/prepare-runtime-assets.mjs"], {
      cwd: ROOT,
      stdio: "ignore",
    });

    const sourceImage = resolve(SOURCE_MAPS, "tileset-particles.png");
    const runtimeImage = resolve(RUNTIME_MAPS, "tileset-particles.png");
    expect(existsSync(runtimeImage)).toBe(true);
    expect(statSync(runtimeImage).size).toBe(statSync(sourceImage).size);
    expect(pngDimensions(sourceImage)).toEqual({ width: 112, height: 16 });
    expect(pngDimensions(runtimeImage)).toEqual({ width: 112, height: 16 });

    const rawVisualCounts = new Map([
      ["particles", 0],
      ["particles2", 0],
    ]);
    for (const relative of runtimeMapFiles()) {
      const document = JSON.parse(
        readFileSync(resolve(RUNTIME_MAPS, relative), "utf8"),
      );
      const tilesets = document.tilesets as JsonTileset[];
      expect(tilesets.filter((tileset) => tileset.source)).toEqual([]);
      expect(
        tilesets.filter(
          (tileset) => tileset.name === "tileset-particles",
        ),
      ).toEqual([
        expect.objectContaining({
          columns: 7,
          firstgid: 69355,
          image: "tileset-particles.png",
          imageheight: 16,
          imagewidth: 112,
          name: "tileset-particles",
          tilecount: 7,
          tileheight: 16,
          tilewidth: 16,
        }),
      ]);

      const layers = document.layers as JsonLayer[] | undefined;
      for (const layer of layers ?? []) {
        const name = layer.name ?? "";
        const data = layer.data ?? [];
        if (name === "particles" || name === "particles2") {
          rawVisualCounts.set(
            name,
            (rawVisualCounts.get(name) ?? 0) +
              data.filter((gid) => RAW_PARTICLE_GIDS.has(gid)).length,
          );
          expect(
            data.filter((gid) => gid !== 0 && !RAW_PARTICLE_GIDS.has(gid)),
          ).toEqual([]);
          expect(data).not.toContain(69360);
          continue;
        }
        const allowed = MARKER_GIDS.get(name);
        if (allowed !== undefined) {
          expect(
            data.filter((gid) => gid !== 0 && !allowed.has(gid)),
          ).toEqual([]);
          continue;
        }
        expect(data.filter((gid) => gid >= 69355)).toEqual([]);
      }
    }
    expect(rawVisualCounts.get("particles")).toBeGreaterThan(0);
    expect(rawVisualCounts.get("particles2")).toBeGreaterThan(0);
  });
});
