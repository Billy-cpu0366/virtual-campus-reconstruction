import { describe, expect, it } from "vitest";
import { GridRouteCrowdPathProvider } from "../../src/npc/gridPathProvider.js";

describe("GridRouteCrowdPathProvider", () => {
  it("finds a bounded walkable route and rejects blocked endpoints", () => {
    const provider = new GridRouteCrowdPathProvider([[0,0,0],[1,1,0],[0,0,0]]);
    expect(provider.findPath({start:{x:8,y:8},end:{x:40,y:40}})).toEqual([
      {x:8,y:8},{x:24,y:8},{x:40,y:8},{x:40,y:24},{x:40,y:40},
    ]);
    expect(provider.findPath({start:{x:8,y:8},end:{x:8,y:24}})).toBeNull();
  });
});
