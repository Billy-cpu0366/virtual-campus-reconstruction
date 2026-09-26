import { describe, expect, it } from "vitest";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadNpcConfigs } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";

/** 区域不再从 src/ 里来，是读磁盘上那份 JSON——和游戏里读的是同一份。 */
const REGIONS = (await loadNpcConfigs(createDiskConfigSource())).venueCrowdRegions;

describe("venue crowd public configuration",()=>{it("keeps concert and rising protesters separate from ordinary crowds",()=>{const concert=REGIONS.filter(x=>x.type==="concert");const protest=REGIONS.find(x=>x.type==="protesters_rising");expect(concert).toHaveLength(3);expect(concert.reduce((n,x)=>n+x.count,0)).toBe(460);expect(concert.every(x=>x.spacing===18)).toBe(true);expect(protest).toMatchObject({count:30,spacing:20});});});
