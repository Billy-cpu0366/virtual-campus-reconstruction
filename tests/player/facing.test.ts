import { describe, expect, it } from "vitest";

import {
  facingDirection,
} from "../../src/player/index.js";
import { PLAYER_CONFIGS } from "../config/player-config-fixture.js";

describe("朝向", () => {
  it("默认朝南", () => {
    expect(PLAYER_CONFIGS.defaultFacing).toBe("south");
    expect(facingDirection(undefined, PLAYER_CONFIGS.defaultFacing)).toBe("south");
  });

  it("有最后方向则用它", () => {
    expect(facingDirection("east", PLAYER_CONFIGS.defaultFacing)).toBe("east");
    expect(facingDirection("north-west", PLAYER_CONFIGS.defaultFacing)).toBe("north-west");
  });
});
