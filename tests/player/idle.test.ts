import { describe, expect, it } from "vitest";

import {
  IDLE_ANIMATIONS,
  IDLE_TIME_FOR_EATING,
  IDLE_TIME_FOR_SITTING,
  idleAction,
  idleAnimationCandidates,
} from "../../src/player/index.js";

describe("空闲阈值常量", () => {
  it("8s / 30s", () => {
    expect(IDLE_TIME_FOR_EATING).toBe(8000);
    expect(IDLE_TIME_FOR_SITTING).toBe(30000);
  });

  it("三种小动作", () => {
    expect(IDLE_ANIMATIONS).toEqual(["eating", "scratching", "tying-shoe"]);
  });
});

describe("空闲状态", () => {
  it("阈值边界", () => {
    expect(idleAction(0)).toBe("none");
    expect(idleAction(7999)).toBe("none");
    expect(idleAction(8000)).toBe("idle");
    expect(idleAction(29999)).toBe("idle");
    expect(idleAction(30000)).toBe("sitting");
  });
});

describe("小动作候选（排除上一个）", () => {
  it("无上一个则全部候选", () => {
    expect(idleAnimationCandidates(undefined)).toEqual([
      "eating",
      "scratching",
      "tying-shoe",
    ]);
  });

  it("排除上一个", () => {
    expect(idleAnimationCandidates("eating")).toEqual([
      "scratching",
      "tying-shoe",
    ]);
    expect(idleAnimationCandidates("scratching")).toEqual([
      "eating",
      "tying-shoe",
    ]);
  });
});
