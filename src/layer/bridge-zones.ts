interface TileRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function contains(rect: TileRect, tileX: number, tileY: number): boolean {
  return (
    tileX >= rect.minX &&
    tileX <= rect.maxX &&
    tileY >= rect.minY &&
    tileY <= rect.maxY
  );
}

const BRIDGE1_ENTRY_ZONES: readonly TileRect[] = [
  { minX: 89, maxX: 90, minY: 56, maxY: 67 },
  { minX: 112, maxX: 113, minY: 57, maxY: 59 },
];

const BRIDGE1_EXIT_ZONES: readonly TileRect[] = [
  { minX: 92, maxX: 111, minY: 54, maxY: 55 },
  { minX: 92, maxX: 101, minY: 68, maxY: 70 },
  { minX: 114, maxX: 116, minY: 57, maxY: 70 },
  { minX: 87, maxX: 89, minY: 56, maxY: 67 },
];

const BRIDGE2_ZONES: readonly TileRect[] = [
  { minX: 63, maxX: 66, minY: 87, maxY: 87 },
  { minX: 63, maxX: 66, minY: 99, maxY: 102 },
];

function containsAny(
  zones: readonly TileRect[],
  tileX: number,
  tileY: number,
): boolean {
  return zones.some((zone) => contains(zone, tileX, tileY));
}

/** Evidence-backed bridge trigger zones, expressed in 16px tile coordinates. */
export function isBridge1EntryZone(tileX: number, tileY: number): boolean {
  return containsAny(BRIDGE1_ENTRY_ZONES, tileX, tileY);
}

export function isBridge1ExitZone(tileX: number, tileY: number): boolean {
  return containsAny(BRIDGE1_EXIT_ZONES, tileX, tileY);
}

export function isBridge2Zone(tileX: number, tileY: number): boolean {
  return containsAny(BRIDGE2_ZONES, tileX, tileY);
}
