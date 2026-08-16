import { describe, expect, it } from "vitest";

import {
  validateWorldSpec,
  WorldSpecError,
  worldSpecFromMaster,
} from "../../src/world/index.js";
import { makeMaster, makeSpec } from "./fixtures.js";

describe("世界规格从 master 派生", () => {
  it("28/28 chunk、5×5 网格、140×140 世界、16px、2240×2240 像素", () => {
    const spec = worldSpecFromMaster(makeMaster());
    expect(spec.chunkWidthTiles).toBe(28);
    expect(spec.chunkHeightTiles).toBe(28);
    expect(spec.chunksHorizontal).toBe(5);
    expect(spec.chunksVertical).toBe(5);
    expect(spec.worldWidthTiles).toBe(140);
    expect(spec.worldHeightTiles).toBe(140);
    expect(spec.tileWidthPixels).toBe(16);
    expect(spec.tileHeightPixels).toBe(16);
    expect(spec.worldPixelWidth).toBe(2240);
    expect(spec.worldPixelHeight).toBe(2240);
  });
});

describe("世界规格自洽校验", () => {
  it("合法规格通过并返回冻结副本", () => {
    const spec = validateWorldSpec(makeSpec());
    expect(spec.worldWidthTiles).toBe(140);
    expect(spec.worldPixelWidth).toBe(2240);
  });

  it("世界宽度不等于 chunk×网格时抛错", () => {
    expect(() =>
      validateWorldSpec({ ...makeSpec(), worldWidthTiles: 141 }),
    ).toThrow(WorldSpecError);
  });

  it("世界高度不一致抛错", () => {
    expect(() =>
      validateWorldSpec({ ...makeSpec(), worldHeightTiles: 139 }),
    ).toThrow(WorldSpecError);
  });

  it("像素宽度不一致抛错", () => {
    expect(() =>
      validateWorldSpec({ ...makeSpec(), worldPixelWidth: 2241 }),
    ).toThrow(WorldSpecError);
  });

  it("像素高度不一致抛错", () => {
    expect(() =>
      validateWorldSpec({ ...makeSpec(), worldPixelHeight: 2239 }),
    ).toThrow(WorldSpecError);
  });
});
