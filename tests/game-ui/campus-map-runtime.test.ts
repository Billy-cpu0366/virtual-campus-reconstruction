import { describe, expect, it } from "vitest";

import {
  PhaserCampusMapRuntime,
  type CampusMapClickHandler,
  type CampusMapElementLike,
  type CampusMapMarker,
  type CampusMapMarkerView,
} from "../../game/PhaserCampusMapRuntime.js";

class FakeClassList {
  readonly values = new Set<string>();

  toggle(token: string, force?: boolean): boolean {
    const enabled = force ?? !this.values.has(token);
    if (enabled) this.values.add(token);
    else this.values.delete(token);
    return enabled;
  }
}

class FakeElement implements CampusMapElementLike {
  hidden = true;
  readonly style = { left: "", top: "" };
  readonly classList = new FakeClassList();
  readonly attributes = new Map<string, string>();
  readonly listeners = new Set<CampusMapClickHandler>();
  focusCount = 0;

  addEventListener(_type: "click", handler: CampusMapClickHandler): void {
    this.listeners.add(handler);
  }

  removeEventListener(_type: "click", handler: CampusMapClickHandler): void {
    this.listeners.delete(handler);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  focus(): void {
    this.focusCount += 1;
  }

  click(): void {
    for (const listener of [...this.listeners]) listener({ preventDefault() {} });
  }
}

const markers: readonly CampusMapMarker[] = Object.freeze([
  {
    markerId: "about",
    menuId: "about",
    label: "About Me",
    kind: "sunburn",
    x: 1_120,
    y: 560,
    enabled: true,
  },
  {
    markerId: "cv",
    menuId: "cv",
    label: "Resume(CV)",
    kind: "sunburn",
    x: -20,
    y: 3_000,
    enabled: false,
  },
]);

function views(elements: readonly FakeElement[]): readonly CampusMapMarkerView[] {
  return markers.map((marker, index) => ({
    markerId: marker.markerId,
    element: elements[index]!,
  }));
}

function fixture(options: { openAllowed?: boolean } = {}) {
  const hud = new FakeElement();
  const openButton = new FakeElement();
  const root = new FakeElement();
  const backdrop = new FakeElement();
  const dialog = new FakeElement();
  const closeButton = new FakeElement();
  const miniPlayer = new FakeElement();
  const bigPlayer = new FakeElement();
  const miniMarkers = [new FakeElement(), new FakeElement()];
  const bigMarkers = [new FakeElement(), new FakeElement()];
  const events: string[] = [];
  const runtime = new PhaserCampusMapRuntime({
    worldWidth: 2_240,
    worldHeight: 2_240,
    markers,
    elements: {
      hud,
      openButton,
      root,
      backdrop,
      dialog,
      closeButton,
      miniPlayer,
      bigPlayer,
      miniMarkers: views(miniMarkers),
      bigMarkers: views(bigMarkers),
    },
    onOpen: () => {
      events.push("open");
      return options.openAllowed ?? true;
    },
    onClose: () => events.push("close"),
    onSelect: (marker) => events.push(`select:${marker.markerId}`),
  });
  return {
    runtime,
    events,
    hud,
    openButton,
    root,
    backdrop,
    dialog,
    closeButton,
    miniPlayer,
    bigPlayer,
    miniMarkers,
    bigMarkers,
  };
}

describe("PhaserCampusMapRuntime", () => {
  it("positions markers, clamps players, and mirrors visited state", () => {
    const item = fixture();
    expect(item.miniMarkers[0]?.style).toEqual({ left: "50%", top: "25%" });
    expect(item.bigMarkers[1]?.style).toEqual({ left: "0%", top: "100%" });
    expect(item.bigMarkers[0]?.classList.values.has("map-marker-info")).toBe(true);
    expect(item.bigMarkers[1]?.classList.values.has("map-marker-disabled")).toBe(true);
    expect(item.bigMarkers[1]?.attributes.get("aria-disabled")).toBe("true");

    item.runtime.update({ x: -1, y: 4_000 }, ["about", "missing"]);
    expect(item.miniPlayer.style).toEqual({ left: "0%", top: "100%" });
    expect(item.bigPlayer.style).toEqual({ left: "0%", top: "100%" });
    expect(item.miniMarkers[0]?.classList.values.has("visited")).toBe(true);
    expect(item.bigMarkers[0]?.classList.values.has("visited")).toBe(true);
    expect(item.runtime.snapshot.visitedMarkerIds).toEqual(["about"]);
  });

  it("gates HUD and map visibility through open and content state", () => {
    const item = fixture();
    expect(item.runtime.snapshot.hudHidden).toBe(true);
    item.runtime.setHudEnabled(true);
    expect(item.hud.hidden).toBe(false);

    item.openButton.click();
    expect(item.events).toEqual(["open"]);
    expect(item.root.hidden).toBe(false);
    expect(item.dialog.hidden).toBe(false);
    expect(item.hud.hidden).toBe(true);
    expect(item.closeButton.focusCount).toBe(1);

    item.runtime.setContentModalVisible(true);
    expect(item.events).toEqual(["open", "close"]);
    expect(item.root.hidden).toBe(true);
    expect(item.hud.hidden).toBe(true);
    expect(item.runtime.open()).toBe(false);

    item.runtime.setContentModalVisible(false);
    expect(item.hud.hidden).toBe(false);
    item.openButton.click();
    item.backdrop.click();
    expect(item.events).toEqual(["open", "close", "open", "close"]);
    expect(item.hud.hidden).toBe(false);
  });

  it("keeps the map closed when the owner rejects its lease", () => {
    const item = fixture({ openAllowed: false });
    item.runtime.setHudEnabled(true);
    item.openButton.click();
    expect(item.events).toEqual(["open"]);
    expect(item.root.hidden).toBe(true);
    expect(item.hud.hidden).toBe(false);
  });

  it("closes before selecting enabled markers and ignores disabled markers", () => {
    const item = fixture();
    item.runtime.setHudEnabled(true);
    item.openButton.click();
    item.bigMarkers[1]?.click();
    expect(item.events).toEqual(["open"]);
    expect(item.root.hidden).toBe(false);

    item.bigMarkers[0]?.click();
    expect(item.events).toEqual(["open", "close", "select:about"]);
    expect(item.root.hidden).toBe(true);
    expect(item.hud.hidden).toBe(false);
  });

  it("unbinds listeners and cannot revive after idempotent destroy", () => {
    const item = fixture();
    item.runtime.setHudEnabled(true);
    item.openButton.click();
    item.runtime.destroy();
    item.runtime.destroy();
    expect(item.events).toEqual(["open", "close"]);
    expect(item.openButton.listeners.size).toBe(0);
    expect(item.closeButton.listeners.size).toBe(0);
    expect(item.backdrop.listeners.size).toBe(0);
    expect(item.bigMarkers[0]?.listeners.size).toBe(0);
    expect(item.hud.hidden).toBe(true);
    expect(item.root.hidden).toBe(true);
    item.openButton.click();
    item.runtime.setHudEnabled(true);
    item.runtime.update({ x: 1_120, y: 1_120 }, ["about"]);
    expect(item.runtime.snapshot.destroyed).toBe(true);
    expect(item.runtime.snapshot.hudHidden).toBe(true);
  });
});
