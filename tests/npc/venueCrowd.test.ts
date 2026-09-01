import { describe, expect, it } from "vitest";
import { VENUE_CROWD_REGIONS } from "../../src/npc/index.js";
describe("venue crowd public configuration",()=>{it("keeps concert and rising protesters separate from ordinary crowds",()=>{const concert=VENUE_CROWD_REGIONS.filter(x=>x.type==="concert");const protest=VENUE_CROWD_REGIONS.find(x=>x.type==="protesters_rising");expect(concert).toHaveLength(3);expect(concert.reduce((n,x)=>n+x.count,0)).toBe(460);expect(concert.every(x=>x.spacing===18)).toBe(true);expect(protest).toMatchObject({count:30,spacing:20});});});
