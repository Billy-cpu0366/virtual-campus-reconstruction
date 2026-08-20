import { describe, expect, it } from "vitest";

import {
  blurStrength,
  chunkRenderBlockSize,
  scaleFactor,
} from "../../src/camera/index.js";

describe("nativeScale 换算", () => {
  it("blur = 16 × nativeScale", () => {
    expect(blurStrength(1)).toBe(16);
    expect(blurStrength(2)).toBe(32);
  });

  it("scaleFactor = 1 / nativeScale", () => {
    expect(scaleFactor(1)).toBe(1);
    expect(scaleFactor(2)).toBe(0.5);
  });

  it("分块 = ceil(10 × nativeScale)（小数向上取整）", () => {
    expect(chunkRenderBlockSize(1)).toBe(10);
    expect(chunkRenderBlockSize(2)).toBe(20);
    expect(chunkRenderBlockSize(1.1)).toBe(11);
  });
});
