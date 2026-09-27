import { describe, expect, it } from "vitest";

import { BEACH_TRIGGER_GID, isBeachTriggerTile } from "../../src/layer/index.js";
import {
  CHANGE_CLOTHES_COOLDOWN_MS,
  PlayerRuntimeStateMachine,
} from "../../src/player/index.js";

describe("沙滩触发块", () => {
  it("69353 是触发块，其它都不是", () => {
    expect(BEACH_TRIGGER_GID).toBe(69353);
    expect(isBeachTriggerTile(69353)).toBe(true);
    expect(isBeachTriggerTile(69345)).toBe(false);
    expect(isBeachTriggerTile(0)).toBe(false);
    expect(isBeachTriggerTile(null)).toBe(false);
    expect(isBeachTriggerTile(undefined)).toBe(false);
  });
});

function createRuntime(nowRef: { value: number }) {
  const stops: number[] = [];
  const runtime = new PlayerRuntimeStateMachine({
    now: () => nowRef.value,
    effects: {
      resetKeyboard: () => undefined,
      resetJoystick: () => undefined,
      stopMovement: () => stops.push(nowRef.value),
    },
  });
  runtime.enableControls(nowRef.value);
  return { runtime, stops };
}

describe("换装状态机", () => {
  it("踩上沙滩块：进入换装、锁住操作、把速度清零", () => {
    const nowRef = { value: 1000 };
    const { runtime, stops } = createRuntime(nowRef);

    expect(runtime.beginClothingChange("undressing", nowRef.value)).toBe(true);
    expect(runtime.status).toBe("changing-clothes");
    expect(runtime.clothingChange).toBe("undressing");
    expect(runtime.control.visualLocked).toBe(true);
    expect(stops).toEqual([1000]);
  });

  it("换装途中不接受任何输入", () => {
    const nowRef = { value: 1000 };
    const { runtime } = createRuntime(nowRef);
    runtime.beginClothingChange("undressing", nowRef.value);

    nowRef.value = 1016;
    const result = runtime.update("east", nowRef.value);
    expect(result.status).toBe("changing-clothes");
    expect(result.movementDirection).toBeNull();
    expect(runtime.facing).not.toBe("east");
  });

  it("脱衣播完 → 身上是沙滩装；穿衣播完 → 换回常服", () => {
    const nowRef = { value: 1000 };
    const { runtime } = createRuntime(nowRef);

    runtime.beginClothingChange("undressing", nowRef.value);
    expect(runtime.onBeach).toBe(false);
    nowRef.value = 2000;
    expect(runtime.completeClothingChange(nowRef.value)).toBe(true);
    expect(runtime.onBeach).toBe(true);
    expect(runtime.status).toBe("normal-idle");
    expect(runtime.clothingChange).toBeNull();

    nowRef.value = 4000;
    runtime.beginClothingChange("dressing", nowRef.value);
    nowRef.value = 5000;
    expect(runtime.completeClothingChange(nowRef.value)).toBe(true);
    expect(runtime.onBeach).toBe(false);
  });

  it("冷却 1 秒内不许再换", () => {
    const nowRef = { value: 1000 };
    const { runtime } = createRuntime(nowRef);
    runtime.beginClothingChange("undressing", nowRef.value);
    runtime.completeClothingChange(nowRef.value);

    expect(
      runtime.beginClothingChange("dressing", nowRef.value + 999),
    ).toBe(false);
    expect(
      runtime.beginClothingChange(
        "dressing",
        nowRef.value + CHANGE_CLOTHES_COOLDOWN_MS,
      ),
    ).toBe(true);
  });

  it("换装中重复请求无效；控制被关掉时也无效", () => {
    const nowRef = { value: 1000 };
    const { runtime } = createRuntime(nowRef);
    runtime.beginClothingChange("undressing", nowRef.value);
    nowRef.value = 3000;
    expect(runtime.beginClothingChange("dressing", nowRef.value)).toBe(false);

    const other = createRuntime({ value: 1000 }).runtime;
    other.disableControls(1000);
    expect(other.beginClothingChange("undressing", 1000)).toBe(false);
  });

  it("贴图缺失时兜底：跳过动画直接落到目标着装", () => {
    const nowRef = { value: 1000 };
    const { runtime } = createRuntime(nowRef);
    runtime.beginClothingChange("undressing", nowRef.value);

    expect(runtime.skipClothingChange("undressing", nowRef.value)).toBe(true);
    expect(runtime.onBeach).toBe(true);
    expect(runtime.status).toBe("normal-idle");
    expect(runtime.clothingChange).toBeNull();
    // 兜底也要走冷却，否则会每 3 帧反复触发。
    expect(runtime.beginClothingChange("dressing", nowRef.value)).toBe(false);
  });

  it("reset 会清掉换装中途状态", () => {
    const nowRef = { value: 1000 };
    const { runtime } = createRuntime(nowRef);
    runtime.beginClothingChange("undressing", nowRef.value);

    runtime.reset(nowRef.value);
    expect(runtime.clothingChange).toBeNull();
    expect(runtime.status).toBe("normal-idle");
  });
});
