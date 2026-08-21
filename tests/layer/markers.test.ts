import { describe, expect, it } from "vitest";

import {
  extractMarkerRecords,
  isKnownMarkerGid,
  markerGids,
} from "../../src/layer/index.js";

function dataWith(
  width: number,
  entries: readonly [number, number][],
): number[] {
  const data = Array.from({ length: width * width }, () => 0);
  for (const [index, gid] of entries) {
    data[index] = gid;
  }
  return data;
}

describe("SYS-LAYER marker GID 与坐标", () => {
  it("按 chunk 来源记录 local/world tile 与 world pixel", () => {
    const records = extractMarkerRecords(
      "cars",
      dataWith(2, [[0, 69345], [3, 69352]]),
      { x: 3, y: 4 },
      2,
      2,
      16,
      16,
    );

    expect(records).toEqual([
      {
        layerName: "cars",
        gid: 69345,
        localTile: { x: 0, y: 0 },
        worldTile: { x: 6, y: 8 },
        worldPixel: { x: 96, y: 128 },
        chunk: { x: 3, y: 4 },
      },
      {
        layerName: "cars",
        gid: 69352,
        localTile: { x: 1, y: 1 },
        worldTile: { x: 7, y: 9 },
        worldPixel: { x: 112, y: 144 },
        chunk: { x: 3, y: 4 },
      },
    ]);
  });

  it("使用分层白名单，空 tile 忽略", () => {
    expect(markerGids("cars")).toEqual([
      69345, 69346, 69347, 69348, 69349, 69350, 69351, 69352,
    ]);
    expect(isKnownMarkerGid("particles", 69359)).toBe(true);
    expect(isKnownMarkerGid("particles2", 69359)).toBe(true);
    expect(isKnownMarkerGid("particles3", 69361)).toBe(true);
    expect(isKnownMarkerGid("footsteps", 69345)).toBe(true);
    expect(
      extractMarkerRecords(
        "footsteps",
        dataWith(2, [[0, 0]]),
        { x: 0, y: 0 },
        2,
        2,
        16,
        16,
      ),
    ).toEqual([]);
  });

  it("未知非零 GID 抛出包含 layer/chunk/local/GID 的错误", () => {
    expect(() =>
      extractMarkerRecords(
        "particles3",
        dataWith(2, [[1, 69360]]),
        { x: 2, y: 5 },
        2,
        2,
        16,
        16,
      ),
    ).toThrow(
      "未知 marker GID：layer=particles3, chunk=(2,5), local=(1,0), gid=69360",
    );
  });
});
