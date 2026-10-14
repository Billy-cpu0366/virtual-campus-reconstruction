import { describe, expect, it } from "vitest";

import {
  HOLDING_DISPLAY_SIZE,
  HOLDING_TEXTURE,
} from "../../src/player/index.js";
import { PLAYER_CONFIGS } from "../config/player-config-fixture.js";

describe("换装尺寸", () => {
  it("换装 64×64、冷却 1s", () => {
    expect(PLAYER_CONFIGS.clothing.offDisplaySize).toBe(64);
    expect(PLAYER_CONFIGS.clothing.cooldownMs).toBe(1000);
  });
});

describe("被抓", () => {
  it("holding 贴图 64×64", () => {
    expect(HOLDING_TEXTURE).toBe("player-holding");
    expect(HOLDING_DISPLAY_SIZE).toBe(64);
  });
});
