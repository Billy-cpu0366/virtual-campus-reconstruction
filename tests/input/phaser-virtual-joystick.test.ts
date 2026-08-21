import { describe, expect, it } from "vitest";

import { PhaserVirtualJoystick } from "../../game/PhaserVirtualJoystick.js";

type Handler = (...args: any[]) => void;

class FakeEmitter {
  private readonly handlers = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): this {
    const listeners = this.handlers.get(event) ?? new Set<Handler>();
    listeners.add(handler);
    this.handlers.set(event, listeners);
    return this;
  }

  off(event: string, handler: Handler): this {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }
}

class FakeGraphics {
  visible = true;
  x = 0;
  y = 0;
  destroyed = false;

  clear(): this {
    return this;
  }

  fillStyle(): this {
    return this;
  }

  fillCircle(): this {
    return this;
  }

  lineStyle(): this {
    return this;
  }

  strokeCircle(): this {
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setScrollFactor(): this {
    return this;
  }

  setDepth(): this {
    return this;
  }

  setVisible(value: boolean): this {
    this.visible = value;
    return this;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

function makeScene() {
  const input = new FakeEmitter();
  const scale = Object.assign(new FakeEmitter(), {
    width: 400,
    height: 300,
  });
  const graphics: FakeGraphics[] = [];
  return {
    input,
    scale,
    graphics,
    add: {
      graphics: () => {
        const item = new FakeGraphics();
        graphics.push(item);
        return item;
      },
    },
  };
}

function center(scene: ReturnType<typeof makeScene>) {
  return {
    x: scene.scale.width - 50,
    y: scene.scale.height - 50,
  };
}

describe("Phaser 原生摇杆适配器", () => {
  it("只允许第一个 pointer 持有摇杆，并在释放或离开时恢复", () => {
    const scene = makeScene();
    const joystick = new PhaserVirtualJoystick(scene, "mobile");
    const point = center(scene);

    scene.input.emit("pointerdown", { id: 1, ...point });
    scene.input.emit("pointerdown", { id: 2, ...point });
    scene.input.emit("pointermove", { id: 2, x: point.x + 20, y: point.y });
    expect(joystick.debugState()).toMatchObject({
      active: true,
      direction: null,
      pointerId: 1,
    });

    scene.input.emit("pointermove", { id: 1, x: point.x + 20, y: point.y });
    expect(joystick.direction).toBe("east");
    expect(joystick.active).toBe(true);
    scene.input.emit("pointerup", { id: 2, ...point });
    expect(joystick.active).toBe(true);
    scene.input.emit("pointerupoutside", { id: 1, ...point });
    expect(joystick.debugState()).toMatchObject({
      active: false,
      direction: null,
      pointerId: null,
    });
  });

  it("只把 forceMin 当作距离 deadzone", () => {
    const scene = makeScene();
    const joystick = new PhaserVirtualJoystick(scene, "mobile");
    const point = center(scene);

    scene.input.emit("pointerdown", { id: 1, ...point });
    scene.input.emit("pointermove", { id: 1, x: point.x + 15, y: point.y });
    expect(joystick.direction).toBeNull();
    scene.input.emit("pointermove", { id: 1, x: point.x + 16, y: point.y });
    expect(joystick.direction).toBe("east");
  });

  it("桌面隐藏且不接管 pointer，resize 仍重定位", () => {
    const scene = makeScene();
    const joystick = new PhaserVirtualJoystick(scene, "desktop");
    const point = center(scene);
    const before = joystick.debugState();

    expect(before.visible).toBe(false);
    expect(scene.graphics.every((item) => item.visible === false)).toBe(true);
    scene.input.emit("pointerdown", { id: 1, ...point });
    scene.input.emit("pointermove", { id: 1, x: point.x + 20, y: point.y });
    expect(joystick.active).toBe(false);
    scene.scale.width = 800;
    scene.scale.height = 600;
    scene.scale.emit("resize");
    expect(joystick.debugState()).toMatchObject({
      visible: false,
      x: 750,
      y: 550,
    });
    expect(joystick.debugState().x).not.toBe(before.x);
  });

  it("resize 重定位，shutdown 移除监听并清理图形", () => {
    const scene = makeScene();
    const joystick = new PhaserVirtualJoystick(scene, "tablet");
    expect(joystick.debugState().visible).toBe(true);
    expect(joystick.debugState().device).toBe("tablet");
    const before = joystick.debugState();
    scene.scale.width = 800;
    scene.scale.height = 600;
    scene.scale.emit("resize");
    expect(joystick.debugState().x).not.toBe(before.x);
    joystick.shutdown();
    expect(scene.graphics.every((item) => item.destroyed)).toBe(true);
    scene.input.emit("pointerdown", { id: 1, ...center(scene) });
    expect(joystick.isActive).toBe(false);
  });
});
