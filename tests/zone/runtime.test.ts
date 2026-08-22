import { describe, expect, it } from "vitest";

import {
  ZoneRuntime,
  type ZoneMarker,
  type ZoneScheduler,
  type ZoneSnapshot,
} from "../../src/zone/index.js";

class FakeScheduler implements ZoneScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, () => void>();
  readonly delays: number[] = [];

  setTimeout(callback: () => void, delayMs: number): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    this.delays.push(delayMs);
    return handle;
  }

  clearTimeout(handle: unknown): void {
    this.callbacks.delete(handle as number);
  }

  flush(): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of callbacks) callback();
  }

  get pendingCount(): number {
    return this.callbacks.size;
  }
}

const marker: ZoneMarker = {
  markerId: "about-marker",
  menuId: "about",
  x: 100,
  y: 100,
};

function snapshot(x: number, y: number, viewport = {
  x: 0,
  y: 0,
  width: 200,
  height: 200,
}): ZoneSnapshot {
  return { player: { x, y }, viewport };
}

describe("ZoneRuntime", () => {
  it("coalesces updates into an injected 100ms check", () => {
    const scheduler = new FakeScheduler();
    const events: string[] = [];
    const runtime = new ZoneRuntime({
      markers: [marker],
      scheduler,
      onResidence: (event) => events.push(event.phase),
    });

    runtime.update(snapshot(100, 100));
    runtime.update(snapshot(101, 100));
    expect(events).toEqual([]);
    expect(scheduler.pendingCount).toBe(1);
    expect(scheduler.delays).toEqual([100]);

    scheduler.flush();
    expect(events).toEqual(["enter"]);
  });

  it("only considers markers inside the viewport plus the 100px margin", () => {
    const events: string[] = [];
    const runtime = new ZoneRuntime({
      markers: [
        marker,
        { markerId: "edge", menuId: "cv", x: 300, y: 100 },
        { markerId: "outside", menuId: "projects", x: 301, y: 100 },
      ],
      onResidence: (event) => events.push(event.markerId),
    });

    runtime.tick(snapshot(300, 100, { x: 100, y: 0, width: 100, height: 200 }));

    expect(events).toEqual(["edge"]);
  });

  it("checks active markers after they leave the viewport+100 candidate area", () => {
    const events: string[] = [];
    const runtime = new ZoneRuntime({
      markers: [marker],
      onResidence: (event) => events.push(event.phase),
    });

    runtime.tick(snapshot(100, 100));
    runtime.tick(snapshot(200, 100, {
      x: 1000,
      y: 1000,
      width: 10,
      height: 10,
    }));

    expect(events).toEqual(["enter", "leave"]);
  });

  it("uses a strict distance boundary", () => {
    const events: string[] = [];
    const runtime = new ZoneRuntime({
      markers: [marker],
      onResidence: (event) => events.push(event.phase),
    });

    runtime.tick(snapshot(129.999, 100));
    expect(events).toEqual(["enter"]);
    runtime.tick(snapshot(130, 100));
    expect(events).toEqual(["enter", "leave"]);
  });

  it("creates unique residences and accepts only matching visit receipts", () => {
    const events: Array<{ phase: string; residenceId: string }> = [];
    const runtime = new ZoneRuntime({
      markers: [marker],
      onResidence: (event) =>
        events.push({ phase: event.phase, residenceId: event.residenceId }),
    });

    runtime.tick(snapshot(100, 100));
    const first = events[0];
    if (first === undefined) throw new Error("missing enter");
    expect(runtime.acceptVisitReceipt({
      markerId: marker.markerId,
      menuId: "cv",
      residenceId: first.residenceId,
    })).toBe(false);
    expect(runtime.acceptVisitReceipt({
      markerId: marker.markerId,
      menuId: marker.menuId,
      residenceId: first.residenceId,
    })).toBe(true);
    expect(runtime.hasVisited(marker.markerId)).toBe(true);

    runtime.tick(snapshot(130, 100));
    runtime.tick(snapshot(100, 100));
    const third = events[2];
    if (third === undefined) throw new Error("missing second enter");
    expect(third.residenceId).not.toBe(first.residenceId);
    expect(runtime.acceptVisitReceipt({
      markerId: marker.markerId,
      menuId: marker.menuId,
      residenceId: first.residenceId,
    })).toBe(false);
  });

  it("destroy is idempotent and rejects scheduled late updates", () => {
    const scheduler = new FakeScheduler();
    const events: string[] = [];
    const runtime = new ZoneRuntime({
      markers: [marker],
      scheduler,
      onResidence: (event) => events.push(event.phase),
    });

    runtime.update(snapshot(100, 100));
    runtime.destroy();
    runtime.destroy();
    scheduler.flush();
    runtime.update(snapshot(100, 100));
    runtime.tick(snapshot(100, 100));

    expect(events).toEqual([]);
    expect(runtime.isDestroyed).toBe(true);
    expect(runtime.activeResidenceCount).toBe(0);
  });
});
