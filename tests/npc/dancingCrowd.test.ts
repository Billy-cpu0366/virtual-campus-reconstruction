import { describe,expect,it } from "vitest";
import { DancingCrowdRuntime } from "../../src/npc/index.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadNpcConfigs } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";

/** 配置不再从 src/ 里来，是读磁盘上那份 JSON——和游戏里读的是同一份。 */
const config=(await loadNpcConfigs(createDiskConfigSource())).dancingCrowd;

describe("DancingCrowdRuntime",()=>it("八个跳舞的，只渲染看得见的那部分",()=>{
  const r=new DancingCrowdRuntime(config,()=>.5);
  r.start({left:0,top:0,width:2240,height:2240});
  expect(config).toMatchObject({minTileX:114,minTileY:100,maxTileX:131,maxTileY:102,npcCount:8,scale:.9,frameRate:6});
  expect(r.snapshot.instances).toHaveLength(8);
  expect(r.snapshot.instances.every(x=>x.x>=114*16&&x.x<=131*16&&x.y>=100*16&&x.y<=102*16)).toBe(true);
  r.tick({left:0,top:0,width:10,height:10});
  expect(r.snapshot.instances.every(x=>!x.materialized)).toBe(true);
}));
