import { describe, expect, it } from "vitest";
import {
  isBridge1EntryZone,
  isBridge1ExitZone,
  isBridge2Zone,
} from "../../src/layer/index.js";

describe("bridge trigger zones", () => {
  it("matches the evidence-backed bridge1 entry and exit rectangles", () => {
    expect(isBridge1EntryZone(89, 56)).toBe(true);
    expect(isBridge1EntryZone(90, 67)).toBe(true);
    expect(isBridge1EntryZone(91, 56)).toBe(false);

    expect(isBridge1ExitZone(92, 54)).toBe(true);
    expect(isBridge1ExitZone(116, 70)).toBe(true);
    expect(isBridge1ExitZone(91, 54)).toBe(false);
  });

  it("matches both bridge2 zones and rejects adjacent tiles", () => {
    expect(isBridge2Zone(63, 87)).toBe(true);
    expect(isBridge2Zone(66, 102)).toBe(true);
    expect(isBridge2Zone(62, 87)).toBe(false);
    expect(isBridge2Zone(66, 103)).toBe(false);
  });
});
