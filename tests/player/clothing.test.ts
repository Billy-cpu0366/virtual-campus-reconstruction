import { describe, expect, it } from "vitest";

import {
  CHANGE_CLOTHES_COOLDOWN_MS,
  CLOTHES_OFF_DISPLAY_SIZE,
  HOLDING_DISPLAY_SIZE,
  HOLDING_TEXTURE,
} from "../../src/player/index.js";

describe("换装尺寸", () => {
  it("换装 64×64、冷却 1s", () => {
    expect(CLOTHES_OFF_DISPLAY_SIZE).toBe(64);
    expect(CHANGE_CLOTHES_COOLDOWN_MS).toBe(1000);
  });
});

describe("被抓", () => {
  it("holding 贴图 64×64", () => {
    expect(HOLDING_TEXTURE).toBe("player-holding");
    expect(HOLDING_DISPLAY_SIZE).toBe(64);
  });
});
