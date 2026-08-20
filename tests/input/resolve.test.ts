import { describe, expect, it } from "vitest";

import { resolveMovement } from "../../src/input/index.js";

describe("输入优先级", () => {
  it("摇杆激活时键盘让位", () => {
    expect(resolveMovement("north", "east", true)).toBe("east");
  });

  it("摇杆未激活走键盘", () => {
    expect(resolveMovement("north", "east", false)).toBe("north");
  });

  it("摇杆激活但摇杆回中返回 null", () => {
    expect(resolveMovement("north", null, true)).toBeNull();
  });

  it("键盘与摇杆都无输入返回 null", () => {
    expect(resolveMovement(null, null, false)).toBeNull();
  });
});
