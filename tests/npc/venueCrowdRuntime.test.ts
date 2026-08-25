import { describe, expect, it } from "vitest";
import { VenueCrowdRuntime } from "../../src/npc/index.js";
describe("VenueCrowdRuntime",()=>{it("places the public venue populations once and culls presentation only",()=>{let seed=1;const r=()=>((seed=seed*16807%2147483647)/2147483647);const crowd=new VenueCrowdRuntime(r);crowd.start({left:0,top:0,width:2240,height:2240});expect(crowd.snapshot.instances.length).toBeGreaterThan(30);
expect(crowd.snapshot.instances.length).toBeLessThanOrEqual(490);const before=crowd.snapshot.instances.map(x=>x.position);crowd.tick({left:0,top:0,width:10,height:10});expect(crowd.snapshot.instances.every(x=>!x.materialized)).toBe(true);expect(crowd.snapshot.instances.map(x=>x.position)).toEqual(before);});});
