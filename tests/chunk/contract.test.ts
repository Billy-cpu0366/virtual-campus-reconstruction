import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ChunkMasterContractError,
  geometryFromMaster,
  parseChunkMaster,
  tilesetFirstGid,
} from "../../src/chunk/index.js";

function publicMaster(): unknown {
  const path = new URL(
    "../../sample/original-public-build/mirror/assets/maps/chunks/master.json",
    import.meta.url,
  );
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

describe("parseChunkMaster", () => {
  it("accepts the mirrored public master contract", () => {
    const master = parseChunkMaster(publicMaster());

    expect(master).toMatchObject({
      chunkWidth: 28,
      chunkHeight: 28,
      nbChunksHorizontal: 5,
      nbChunksVertical: 5,
      originalWidth: 140,
      originalHeight: 140,
      tileWidth: 16,
      tileHeight: 16,
    });
    expect(master.tilesets).toHaveLength(3);
    expect(tilesetFirstGid(master, "exterior")).toBe(1);
    expect(tilesetFirstGid(master, "collisions-objects")).toBe(69345);
    expect(geometryFromMaster(master)).toEqual({
      chunkWidthTiles: 28,
      chunkHeightTiles: 28,
      chunksHorizontal: 5,
      chunksVertical: 5,
      tileWidthPixels: 16,
      tileHeightPixels: 16,
    });
  });

  it("rejects a non-object master", () => {
    expect(() => parseChunkMaster(null)).toThrow(ChunkMasterContractError);
  });

  it("rejects inconsistent map dimensions", () => {
    const value = publicMaster() as Record<string, unknown>;
    value.originalWidth = 139;

    expect(() => parseChunkMaster(value)).toThrow(
      "originalWidth must equal chunkWidth * nbChunksHorizontal",
    );
  });

  it("rejects a tileset without a usable firstgid", () => {
    const master = parseChunkMaster(publicMaster());
    const invalid = {
      ...master,
      tilesets: [{ name: "exterior", tilewidth: 16, tileheight: 16 }],
    };

    expect(() => tilesetFirstGid(invalid, "exterior")).toThrow(
      "tileset exterior must define a positive firstgid",
    );
  });

  it("rejects missing tile dimensions", () => {
    const value = publicMaster() as Record<string, unknown>;
    value.tilesets = [{ source: "external.tsx" }];

    expect(() => parseChunkMaster(value)).toThrow(
      "at least one inline tileset must define tile size",
    );
  });

  it("rejects conflicting inline tile dimensions", () => {
    const value = publicMaster() as Record<string, unknown>;
    value.tilesets = [
      { tilewidth: 16, tileheight: 16 },
      { tilewidth: 32, tileheight: 16 },
    ];

    expect(() => parseChunkMaster(value)).toThrow(
      "inline tilesets must use one tile size",
    );
  });
});
