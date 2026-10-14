import { describe, expect, it } from "vitest";
import {
  isBridge1EntryZone,
  isBridge1ExitZone,
  isBridge2Zone,
} from "../../src/layer/index.js";
import { LAYER_CONFIGS } from "../config/layer-config-fixture.js";

describe("bridge trigger zones", () => {
  it("matches the evidence-backed bridge1 entry and exit rectangles", () => {
    expect(isBridge1EntryZone(89, 56, LAYER_CONFIGS.bridgeZones.bridge1.entry)).toBe(true);
    expect(isBridge1EntryZone(90, 67, LAYER_CONFIGS.bridgeZones.bridge1.entry)).toBe(true);
    expect(isBridge1EntryZone(91, 56, LAYER_CONFIGS.bridgeZones.bridge1.entry)).toBe(false);

    expect(isBridge1ExitZone(92, 54, LAYER_CONFIGS.bridgeZones.bridge1.exit)).toBe(true);
    expect(isBridge1ExitZone(116, 70, LAYER_CONFIGS.bridgeZones.bridge1.exit)).toBe(true);
    expect(isBridge1ExitZone(91, 54, LAYER_CONFIGS.bridgeZones.bridge1.exit)).toBe(false);
  });

  it("matches both bridge2 zones and rejects adjacent tiles", () => {
    expect(isBridge2Zone(63, 87, LAYER_CONFIGS.bridgeZones.bridge2.zones)).toBe(true);
    expect(isBridge2Zone(66, 102, LAYER_CONFIGS.bridgeZones.bridge2.zones)).toBe(true);
    expect(isBridge2Zone(62, 87, LAYER_CONFIGS.bridgeZones.bridge2.zones)).toBe(false);
    expect(isBridge2Zone(66, 103, LAYER_CONFIGS.bridgeZones.bridge2.zones)).toBe(false);
  });
});
