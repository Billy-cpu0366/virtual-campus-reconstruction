import { describe, expect, it } from "vitest";

import {
  idleAction,
  idleAnimationCandidates,
} from "../../src/player/index.js";
import { PLAYER_CONFIGS } from "../config/player-config-fixture.js";

describe("空闲阈值常量", () => {
  it("8s / 30s", () => {
    expect(PLAYER_CONFIGS.idle.timeForIdleAction).toBe(8000);
    expect(PLAYER_CONFIGS.idle.timeForSitting).toBe(30000);
  });

  it("三种小动作", () => {
    expect(PLAYER_CONFIGS.idle.animations).toEqual(["eating", "scratching", "tying-shoe"]);
  });
});

describe("空闲状态", () => {
  it("阈值边界", () => {
    const { timeForIdleAction, timeForSitting } = PLAYER_CONFIGS.idle;
    expect(idleAction(0, timeForIdleAction, timeForSitting)).toBe("none");
    expect(idleAction(7999, timeForIdleAction, timeForSitting)).toBe("none");
    expect(idleAction(8000, timeForIdleAction, timeForSitting)).toBe("idle");
    expect(idleAction(29999, timeForIdleAction, timeForSitting)).toBe("idle");
    expect(idleAction(30000, timeForIdleAction, timeForSitting)).toBe("sitting");
  });
});

describe("小动作候选（排除上一个）", () => {
  it("无上一个则全部候选", () => {
    expect(idleAnimationCandidates(undefined, PLAYER_CONFIGS.idle.animations)).toEqual([
      "eating",
      "scratching",
      "tying-shoe",
    ]);
  });

  it("排除上一个", () => {
    expect(idleAnimationCandidates("eating", PLAYER_CONFIGS.idle.animations)).toEqual([
      "scratching",
      "tying-shoe",
    ]);
    expect(idleAnimationCandidates("scratching", PLAYER_CONFIGS.idle.animations)).toEqual([
      "eating",
      "tying-shoe",
    ]);
  });
});
