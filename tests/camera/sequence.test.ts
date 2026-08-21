import { describe, expect, it } from "vitest";

import {
  CAMERA_END_TWEEN_DURATION_MS,
  CAMERA_END_TWEEN_EASE,
  CAMERA_SEQUENCE,
  CAMERA_SEQUENCE_DURATION_MS,
  cameraSequenceTotalDuration,
} from "../../src/camera/index.js";

describe("开场航拍序列", () => {
  it("6 点坐标/耗时/停留与卡一致", () => {
    expect(CAMERA_SEQUENCE).toEqual([
      { x: 944, y: 928, duration: 0, stayDuration: 7000 },
      { x: 1552, y: 1216, duration: 15000, stayDuration: 7000 },
      { x: 912, y: 1136, duration: 15000, stayDuration: 5000 },
      { x: 1216, y: 656, duration: 15000, stayDuration: 5000 },
      { x: 2048, y: 2048, duration: 15000, stayDuration: 7000 },
      { x: 944, y: 928, duration: 15000, stayDuration: 5000 },
    ]);
  });

  it("默认 6 点的 tween/stay 总和为 111 秒，返回另计 3 秒", () => {
    const sequenceDuration = CAMERA_SEQUENCE.reduce(
      (total, point) => total + point.duration + point.stayDuration,
      0,
    );
    expect(sequenceDuration).toBe(111000);
    expect(cameraSequenceTotalDuration(CAMERA_SEQUENCE)).toBe(111000);
    expect(CAMERA_SEQUENCE_DURATION_MS).toBe(111000);
    expect(CAMERA_END_TWEEN_DURATION_MS).toBe(3000);
  });

  it("总时长按 飞到+停留 逐点累加", () => {
    expect(
      cameraSequenceTotalDuration([
        { x: 0, y: 0, duration: 100, stayDuration: 50 },
        { x: 10, y: 10, duration: 200, stayDuration: 150 },
      ]),
    ).toBe(500);
    expect(CAMERA_SEQUENCE_DURATION_MS).toBe(111000);
    expect(CAMERA_SEQUENCE).toHaveLength(6);
  });

  it("结束落回玩家 tween 3 秒 Power2", () => {
    expect(CAMERA_END_TWEEN_DURATION_MS).toBe(3000);
    expect(CAMERA_END_TWEEN_EASE).toBe("Power2");
  });
});
