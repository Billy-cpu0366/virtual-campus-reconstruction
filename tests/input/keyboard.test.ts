import { describe, expect, it } from "vitest";

import { keyboardDirection } from "../../src/input/index.js";
import type { KeyState } from "../../src/input/index.js";

function keys(partial: Partial<KeyState>): KeyState {
  return { up: false, down: false, left: false, right: false, ...partial };
}

describe("键盘 8 方向归一化", () => {
  it("无按键返回 null", () => {
    expect(keyboardDirection(keys({}))).toBeNull();
  });

  it("单方向", () => {
    expect(keyboardDirection(keys({ up: true }))).toBe("north");
    expect(keyboardDirection(keys({ down: true }))).toBe("south");
    expect(keyboardDirection(keys({ left: true }))).toBe("west");
    expect(keyboardDirection(keys({ right: true }))).toBe("east");
  });

  it("对角方向", () => {
    expect(keyboardDirection(keys({ up: true, left: true }))).toBe(
      "north-west",
    );
    expect(keyboardDirection(keys({ up: true, right: true }))).toBe(
      "north-east",
    );
    expect(keyboardDirection(keys({ down: true, left: true }))).toBe(
      "south-west",
    );
    expect(keyboardDirection(keys({ down: true, right: true }))).toBe(
      "south-east",
    );
  });

  it("优先级 上 > 下 > 左 > 右", () => {
    expect(keyboardDirection(keys({ up: true, down: true }))).toBe("north");
    expect(keyboardDirection(keys({ left: true, right: true }))).toBe("west");
    expect(
      keyboardDirection(
        keys({ up: true, down: true, left: true, right: true }),
      ),
    ).toBe("north-west");
  });
});
