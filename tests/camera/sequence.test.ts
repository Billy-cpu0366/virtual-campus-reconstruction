import { describe, expect, it } from "vitest";

import { cameraSequenceTotalDuration } from "../../src/camera/index.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadCameraConfigs } from "../../config/骨架/02-玩法线/SYS-CAMERA/逻辑/index.js";

const CAMERA = await loadCameraConfigs(createDiskConfigSource());

describe("开场航拍序列", () => {
  it("6 点坐标/耗时/停留与卡一致", () => {
    expect(CAMERA.sequence).toEqual([
      { x: 944, y: 928, duration: 0, stayDuration: 7000 },
      { x: 1552, y: 1216, duration: 15000, stayDuration: 7000 },
      { x: 912, y: 1136, duration: 15000, stayDuration: 5000 },
      { x: 1216, y: 656, duration: 15000, stayDuration: 5000 },
      { x: 2048, y: 2048, duration: 15000, stayDuration: 7000 },
      { x: 944, y: 928, duration: 15000, stayDuration: 5000 },
    ]);
  });

  it("默认 6 点的 tween/stay 总和为 111 秒，返回另计 3 秒", () => {
    const sequenceDuration = CAMERA.sequence.reduce(
      (total, point) => total + point.duration + point.stayDuration,
      0,
    );
    expect(sequenceDuration).toBe(111000);
    expect(cameraSequenceTotalDuration(CAMERA.sequence)).toBe(111000);
    expect(CAMERA.returnDuration).toBe(3000);
  });

  it("总时长按 飞到+停留 逐点累加", () => {
    expect(
      cameraSequenceTotalDuration([
        { x: 0, y: 0, duration: 100, stayDuration: 50 },
        { x: 10, y: 10, duration: 200, stayDuration: 150 },
      ]),
    ).toBe(500);
    expect(cameraSequenceTotalDuration(CAMERA.sequence)).toBe(111000);
    expect(CAMERA.sequence).toHaveLength(6);
  });

  it("结束落回玩家 tween 3 秒 Power2", () => {
    expect(CAMERA.returnDuration).toBe(3000);
    expect(CAMERA.pointEase).toBe("Linear");
    expect(CAMERA.returnEase).toBe("Power2");
  });
});
