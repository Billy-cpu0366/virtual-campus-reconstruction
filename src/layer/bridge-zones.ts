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

function containsAny(
  zones: readonly TileRect[],
  tileX: number,
  tileY: number,
): boolean {
  return zones.some((zone) => contains(zone, tileX, tileY));
}

/** Evidence-backed bridge trigger zones, expressed in 16px tile coordinates. */
export function isBridge1EntryZone(
  tileX: number,
  tileY: number,
  zones: readonly TileRect[],
): boolean {
  return containsAny(zones, tileX, tileY);
}

export function isBridge1ExitZone(
  tileX: number,
  tileY: number,
  zones: readonly TileRect[],
): boolean {
  return containsAny(zones, tileX, tileY);
}

export function isBridge2Zone(
  tileX: number,
  tileY: number,
  zones: readonly TileRect[],
): boolean {
  return containsAny(zones, tileX, tileY);
}
