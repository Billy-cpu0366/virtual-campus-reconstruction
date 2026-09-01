import { describe, expect, it } from "vitest";

import {
  PlayerRuntimeStateMachine,
  type PlayerControlEffects,
  type PlayerRuntimeAvailability,
} from "../../src/player/index.js";

const ALL_AVAILABLE: PlayerRuntimeAvailability = {
  idleAnimations: ["eating", "scratching", "tying-shoe"],
  sitting: true,
};

const NOTHING_AVAILABLE: PlayerRuntimeAvailability = {
  idleAnimations: [],
  sitting: false,
};

function makeRuntime(
  now: () => number,
  effects: PlayerControlEffects = {
    resetKeyboard: () => undefined,
    resetJoystick: () => undefined,
    stopMovement: () => undefined,
  },
): PlayerRuntimeStateMachine {
  return new PlayerRuntimeStateMachine({
    now,
    random: () => 0,
    effects,
  });
}

describe("玩家运行时状态机", () => {
  it("控制门禁用时立即停速并 reset 键盘/摇杆，启用后恢复输入", () => {
    let now = 0;
    const calls: string[] = [];
    const runtime = makeRuntime(
      () => now,
      {
        resetKeyboard: () => calls.push("keyboard"),
        resetJoystick: () => calls.push("joystick"),
        stopMovement: () => calls.push("movement"),
      },
    );

    expect(runtime.enableControls(now)).toBe(true);
    expect(runtime.update("east", now).movementDirection).toBe("east");
    expect(runtime.disableControls(now)).toBe(true);
    expect(calls).toEqual(["keyboard", "joystick", "movement"]);
    expect(runtime.update("east", now)).toMatchObject({
      movementDirection: null,
      status: "disabled",
      visualLocked: true,
    });

    now = 1_000;
    expect(runtime.enableControls(now)).toBe(true);
    expect(runtime.update("east", now).movementDirection).toBe("east");
  });

  it("8秒触发小动作，完成后至少再等8秒且不连续重复", () => {
    let now = 0;
    const runtime = makeRuntime(() => now);
    runtime.enableControls(now);

    now = 7_999;
    expect(runtime.update(null, now, ALL_AVAILABLE).status).toBe("normal-idle");
    now = 8_000;
    expect(runtime.update(null, now, ALL_AVAILABLE)).toMatchObject({
      status: "idle-action",
      idleAnimation: "eating",
      visualLocked: true,
    });
    now = 9_000;
    expect(runtime.completeIdleAnimation(now)).toBe(true);
    now = 16_999;
    expect(runtime.update(null, now, ALL_AVAILABLE).status).toBe("normal-idle");
    now = 17_000;
    expect(runtime.update(null, now, ALL_AVAILABLE)).toMatchObject({
      status: "idle-action",
      idleAnimation: "scratching",
    });
  });

  it("30秒优先进入 sitting，移动时 stand-up 并保留恢复方向", () => {
    let now = 0;
    const runtime = makeRuntime(() => now);
    runtime.enableControls(now);

    now = 29_999;
    expect(runtime.update(null, now, ALL_AVAILABLE).status).toBe("idle-action");
    runtime.completeIdleAnimation(now);

    const second = makeRuntime(() => now);
    now = 0;
    second.enableControls(now);
    now = 30_000;
    expect(second.update(null, now, ALL_AVAILABLE).status).toBe("sitting-down");
    expect(second.completeSittingDown()).toBe(true);
    expect(second.status).toBe("sitting");
    expect(second.update("north-east", now, ALL_AVAILABLE)).toMatchObject({
      movementDirection: null,
      status: "standing-up",
      pendingDirection: "north-east",
      visualLocked: true,
    });
    expect(second.completeStandingUp(now)).toBe("north-east");
    expect(second.update("north-east", now, ALL_AVAILABLE)).toMatchObject({
      movementDirection: "north-east",
      status: "walking",
    });
  });

  it("移动意图立即退出 idle 动作并保留最后朝向", () => {
    let now = 0;
    const runtime = makeRuntime(() => now);
    runtime.enableControls(now);
    now = 8_000;
    expect(runtime.update(null, now, ALL_AVAILABLE).status).toBe("idle-action");

    now = 8_100;
    expect(runtime.update("west", now, ALL_AVAILABLE)).toMatchObject({
      movementDirection: "west",
      status: "walking",
      facing: "west",
      idleAnimation: null,
      visualLocked: false,
    });
  });

  it("动作或 sitting 资源缺失时降级普通 idle，不锁控制", () => {
    let now = 0;
    const runtime = makeRuntime(() => now);
    runtime.enableControls(now);

    now = 8_000;
    expect(runtime.update(null, now, NOTHING_AVAILABLE)).toMatchObject({
      status: "normal-idle",
      visualLocked: false,
    });
    now = 30_000;
    expect(runtime.update(null, now, NOTHING_AVAILABLE)).toMatchObject({
      status: "normal-idle",
      visualLocked: false,
    });
    expect(runtime.update("south", now, NOTHING_AVAILABLE).movementDirection).toBe(
      "south",
    );
  });

  it("blur/reset 清理输入并重置计时，快照不暴露可变位置", () => {
    let now = 0;
    const calls: string[] = [];
    const runtime = makeRuntime(
      () => now,
      {
        resetKeyboard: () => calls.push("keyboard"),
        resetJoystick: () => calls.push("joystick"),
        stopMovement: () => calls.push("movement"),
      },
    );
    runtime.enableControls(now);
    runtime.setPosition(12, 34);
    const position = runtime.position;
    expect(position).toEqual({ x: 12, y: 34 });
    expect(Object.isFrozen(position)).toBe(true);

    now = 8_000;
    expect(runtime.update(null, now, ALL_AVAILABLE).status).toBe("idle-action");
    runtime.blur(now);
    expect(calls).toEqual(["keyboard", "joystick", "movement"]);
    now = 15_999;
    expect(runtime.update(null, now, ALL_AVAILABLE).status).toBe("normal-idle");
    expect(runtime.control).toEqual({
      enabled: true,
      shutdown: false,
      status: "normal-idle",
      visualLocked: false,
    });
  });

  it("shutdown 清理一次并永久拒绝控制和 update", () => {
    const calls: string[] = [];
    const runtime = makeRuntime(
      () => 0,
      {
        resetKeyboard: () => calls.push("keyboard"),
        resetJoystick: () => calls.push("joystick"),
        stopMovement: () => calls.push("movement"),
      },
    );
    runtime.enableControls(0);
    expect(runtime.shutdown()).toBe(true);
    expect(runtime.shutdown()).toBe(false);
    expect(calls).toEqual(["keyboard", "joystick", "movement"]);
    expect(runtime.control).toMatchObject({
      enabled: false,
      shutdown: true,
      status: "shutdown",
    });
    expect(runtime.enableControls()).toBe(false);
    expect(() => runtime.update(null, 0)).toThrow("已关闭");
  });
});
