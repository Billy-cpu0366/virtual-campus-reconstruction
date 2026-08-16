import { describe, expect, it } from "vitest";

import {
  DEFAULT_FACING,
  facingDirection,
} from "../../src/player/index.js";

describe("朝向", () => {
  it("默认朝南", () => {
    expect(DEFAULT_FACING).toBe("south");
    expect(facingDirection(undefined)).toBe("south");
  });

  it("有最后方向则用它", () => {
    expect(facingDirection("east")).toBe("east");
    expect(facingDirection("north-west")).toBe("north-west");
  });
});
