import { describe, expect, it } from "vitest";

import { velocityForDirection as velocityOf } from "../../src/move/index.js";
import type { Direction } from "../../src/input/index.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadInputConfigs } from "../../config/骨架/02-玩法线/SYS-INPUT/逻辑/index.js";

const INPUT = await loadInputConfigs(createDiskConfigSource());
const velocityForDirection = (direction: Direction) => velocityOf(direction, INPUT.vectors, INPUT.speed);

describe("方向 → 速度", () => {
  it("8 方向速度（单轴 150 / 对角 106）", () => {
    expect(velocityForDirection("north")).toEqual({ vx: 0, vy: -150 });
    expect(velocityForDirection("north-east")).toEqual({ vx: 106, vy: -106 });
    expect(velocityForDirection("east")).toEqual({ vx: 150, vy: 0 });
    expect(velocityForDirection("south-east")).toEqual({ vx: 106, vy: 106 });
    expect(velocityForDirection("south")).toEqual({ vx: 0, vy: 150 });
    expect(velocityForDirection("south-west")).toEqual({ vx: -106, vy: 106 });
    expect(velocityForDirection("west")).toEqual({ vx: -150, vy: 0 });
    expect(velocityForDirection("north-west")).toEqual({ vx: -106, vy: -106 });
  });
});
