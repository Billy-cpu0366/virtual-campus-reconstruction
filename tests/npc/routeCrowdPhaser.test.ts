import { describe, expect, it } from "vitest";
import { PhaserRouteCrowdRuntime, keepOrdinaryCrowdOffTrack } from "../../game/PhaserRouteCrowdRuntime.js";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadNpcConfigs } from "../../config/骨架/05-旁支/SYS-NPC/逻辑/index.js";

/** 11 组路线和三项调参现在都读磁盘上那份配置。 */
const CONFIGS = await loadNpcConfigs(createDiskConfigSource());
/** 用哪些贴图、哪组用专用贴图、显示怎么错开、铁轨带在哪——原先写死在 game/ 里。 */
const PRESENTATION = CONFIGS.presentation.routeCrowd;
const ROUTE_INPUT = {
  configs: CONFIGS.routeCrowdConfigs,
  tuning: CONFIGS.tuning.routeCrowd,
  presentation: PRESENTATION,
};

class Sprite {
 x:number; y:number; depth=0; alpha=1; destroyed=false;
 constructor(x:number,y:number){this.x=x;this.y=y}
 setDepth(v:number){this.depth=v;return this}
 setAlpha(v:number){this.alpha=v;return this}
 destroy(){this.destroyed=true}
}

describe("PhaserRouteCrowdRuntime",()=>{
 it("uses only source-backed route display offsets",()=>{
  expect(PRESENTATION.visualOffsets).toMatchObject({"main-crowd":16,"loop-crowd":8,drinkers:8,concert_crowd:10,beach_crowd_walk:8,"vertical-crowd":6,"vertical-crowd-reverse":0,"crowd-train":8});
  expect(PRESENTATION.visualOffsets["walking-crowd"] ?? 0).toBe(0);
  expect(PRESENTATION.visualOffsets["hazmat-crowd"] ?? 0).toBe(0);
  expect(PRESENTATION.visualOffsets.outside_concert1 ?? 0).toBe(0);
  expect(PRESENTATION.trackBand).toEqual({minX:400,maxX:1471,minY:304,maxY:319});
  expect(PRESENTATION.specialTextures["beach_crowd_walk"]).toEqual([
    "npc-man-beach","npc-man-beach2","npc-woman-beach","npc-woman-beach2",
  ]);
  expect(PRESENTATION.specialTextures["hazmat-crowd"]).toEqual(["npc-hazmat-suit"]);
  expect(PRESENTATION.textures).toHaveLength(17);
  expect(PRESENTATION.textures[0]).toBe("npc-man");
  expect(Object.isFrozen(PRESENTATION)).toBe(true);
 });

 it("keeps ordinary crowd displays off the track while preserving train passengers",()=>{
  const band = PRESENTATION.trackBand;
  expect(keepOrdinaryCrowdOffTrack("main-crowd", 600, 312, band).y).not.toBe(312);
  expect(keepOrdinaryCrowdOffTrack("crowd-train", 600, 312, band)).toEqual({x:600,y:312});
  expect(keepOrdinaryCrowdOffTrack("main-crowd", 600, 296, band)).toEqual({x:600,y:296});
 });

 it("takes the track band and the per-group offset from the passed presentation",()=>{
  const narrow={minX:0,maxX:100,minY:0,maxY:10};
  // 带子中线上方推到 minY-1，下方推到 maxY+1，火车乘客照旧不推。
  expect(keepOrdinaryCrowdOffTrack("main-crowd",50,4,narrow)).toEqual({x:50,y:-1});
  expect(keepOrdinaryCrowdOffTrack("main-crowd",50,5,narrow)).toEqual({x:50,y:11});
  expect(keepOrdinaryCrowdOffTrack("crowd-train",50,5,narrow)).toEqual({x:50,y:5});
  expect(keepOrdinaryCrowdOffTrack("main-crowd",500,5,narrow)).toEqual({x:500,y:5});

  const firstSprite=(visualOffsets:Readonly<Record<string,number>>)=>{
   const sprites:Sprite[]=[];
   const runtime=new PhaserRouteCrowdRuntime({add:{sprite:(x,y)=>{const s=new Sprite(x,y);sprites.push(s);return s}}},{ ...ROUTE_INPUT,
    presentation:{...PRESENTATION,visualOffsets},
    pathProvider:{findPath:r=>[r.start,{x:r.start.x+32,y:r.start.y}]},
    viewport:()=>({left:0,top:0,width:2240,height:2240}),random:()=>0,
   });
   runtime.start(0);
   const first=sprites[0]!;
   return {x:first.x,y:first.y};
  };
  expect(firstSprite({})).not.toEqual(firstSprite({"main-crowd":16}));
 });

 it("materializes visible route crowds and destroys them on shutdown",()=>{
  const sprites:Sprite[]=[];
  const runtime=new PhaserRouteCrowdRuntime({add:{sprite:(x,y)=>{const s=new Sprite(x,y);sprites.push(s);return s}}},{ ...ROUTE_INPUT,
   pathProvider:{findPath:r=>[r.start,{x:r.start.x+32,y:r.start.y}]},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),random:()=>0,
  });
  runtime.start(0); expect(sprites.length).toBeGreaterThan(0);
  runtime.shutdown(); expect(sprites.every(s=>s.destroyed)).toBe(true);
 });

 it("defers production startup and creates exactly one per update",()=>{
  const sprites:Sprite[]=[];
  const callbacks:(()=>void)[]=[];
  let calls=0;
  const runtime=new PhaserRouteCrowdRuntime({add:{sprite:(x,y)=>{const s=new Sprite(x,y);sprites.push(s);return s}}},{ ...ROUTE_INPUT,
   pathProvider:{findPath:r=>{calls+=1;return [r.start,{x:r.start.x+32,y:r.start.y}]}},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),random:()=>0,
   scheduleNextUpdate:callback=>callbacks.push(callback),
  });

  runtime.start(0);
  expect(calls).toBe(4);
  expect(sprites).toHaveLength(4);

  let frames=1;
  const normalCount = CONFIGS.routeCrowdConfigs
   .filter((config) => config.id !== "crowd-train")
   .reduce((sum, config) => sum + Math.min(config.count * 3, config.startTiles.length * config.endTiles.length), 0);
  while (callbacks.length > 0) {
   callbacks.shift()!();
   frames+=1;
   expect(calls).toBe(Math.min(frames*4, normalCount));
  }
  expect(calls).toBe(normalCount);
  expect(sprites).toHaveLength(calls);
 });

 it("advances visible crowds and plays their walking animation",()=>{
  const played:string[]=[];
  const created:string[]=[];
  const sprite={x:0,y:0,setDepth:()=>sprite,setFrame:(_frame:number)=>sprite,destroy:()=>undefined,anims:{play:(key:string)=>{played.push(key);return undefined},stop:()=>undefined}};
  const runtime=new PhaserRouteCrowdRuntime({
   add:{sprite:(x,y)=>{sprite.x=x;sprite.y=y;return sprite}},
   anims:{generateFrameNumbers:(_key,range)=>[range.start,range.end],create:config=>{created.push(config.key);return config},exists:()=>false},
  },{ ...ROUTE_INPUT,
   pathProvider:{findPath:r=>[r.start,{x:r.start.x+24,y:r.start.y},{x:r.start.x+48,y:r.start.y}]},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),random:()=>0,
  });
  runtime.start(0);
  const before=runtime.snapshot.instances.find(item=>item.id==="main-crowd:0")!;
  runtime.update(600);
  const after=runtime.snapshot.instances.find(item=>item.id==="main-crowd:0")!;
  expect(after.position).not.toEqual(before.position);
  expect(created.length).toBeGreaterThan(0);
  expect(played.length).toBeGreaterThan(0);
 });

 it("computes thirty train candidates and assigns ten unique paths",()=>{
  const callbacks:(()=>void)[]=[];
  let calls=0;
  const runtime=new PhaserRouteCrowdRuntime({add:{sprite:()=>new Sprite(0,0)}},{ ...ROUTE_INPUT,
   pathProvider:{findPath:r=>{calls+=1;return [r.start,{x:r.start.x+32,y:r.start.y}]}},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),
   scheduleNextUpdate:callback=>callbacks.push(callback),
  });
  runtime.startTrain(0);
  expect(calls).toBe(4);
  while(callbacks.length>0) callbacks.shift()!();
  expect(calls).toBe(30);
  expect(runtime.snapshot.instances).toHaveLength(10);
  expect(new Set(runtime.snapshot.instances.map(item=>item.pathId)).size).toBe(10);
  expect(runtime.trainStarted).toBe(true);
 });

 it("ignores stale startup callbacks after repeat or cancel",()=>{
  const callbacks:(()=>void)[]=[];
  let calls=0;
  const runtime=new PhaserRouteCrowdRuntime({add:{sprite:()=>new Sprite(0,0)}},{ ...ROUTE_INPUT,
   pathProvider:{findPath:r=>{calls+=1;return [r.start]}},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),
   scheduleNextUpdate:callback=>callbacks.push(callback),
  });

  runtime.start(0);
  expect(calls).toBe(4);
  const staleAfterRepeat=callbacks.shift()!;
  runtime.start(1);
  expect(calls).toBe(8);
  staleAfterRepeat();
  expect(calls).toBe(8);
  callbacks.shift()!();
  expect(calls).toBe(12);
  runtime.cancel();
  const staleAfterCancel=callbacks.shift()!;
  staleAfterCancel();
  expect(calls).toBe(12);
  expect(runtime.spriteCount).toBe(0);

  runtime.start(2);
  const staleAfterShutdown=callbacks.shift()!;
  runtime.shutdown();
  staleAfterShutdown();
  expect(calls).toBe(16);
  expect(runtime.spriteCount).toBe(0);
 });

 it("keeps presentation opaque and reuses sprites while inside the safe range",()=>{
  const sprites:Sprite[]=[];
  const runtime=new PhaserRouteCrowdRuntime({
   add:{sprite:(x,y)=>{const s=new Sprite(x,y);sprites.push(s);return s}},
  },{ ...ROUTE_INPUT,
   pathProvider:{findPath:r=>[r.start,{x:r.start.x+32,y:r.start.y}]},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),random:()=>0,
  });
  runtime.start(0);
  const initial=[...sprites];
  expect(sprites.length).toBeGreaterThan(0);
  expect(sprites.every((sprite)=>sprite.alpha===1)).toBe(true);
  runtime.update(100);
  expect(sprites).toEqual(initial);
  expect(sprites.every((sprite)=>!sprite.destroyed&&sprite.alpha===1)).toBe(true);
 });

 it("reuses a drinker sprite through its immediate reverse trip",()=>{
  const sprites:Sprite[]=[];
  const viewport={left:0,top:0,width:2240,height:2240};
  const runtime=new PhaserRouteCrowdRuntime({
   add:{sprite:(x,y)=>{const s=new Sprite(x,y);sprites.push(s);return s}},
  },{ ...ROUTE_INPUT,
   pathProvider:{findPath:r=>{
    const drinker = (r.start.x===880 || r.start.x===800) &&
     (r.start.y===1376 || r.start.y===1360);
    return [r.start,{x:r.start.x+(drinker?72:32),y:r.start.y}];
   }},
   viewport:()=>viewport,random:()=>0,
  });
  runtime.start(0);
  const drinkerIndex=runtime.snapshot.instances.findIndex(
   item=>item.id==="drinkers:0",
  );
  const materializedBefore=runtime.snapshot.instances
   .slice(0,drinkerIndex).filter(item=>item.materialized).length;
  const drinkerSprite=sprites[materializedBefore]!;
  const created=sprites.length;

  runtime.update(6_000);
  const terminal=runtime.snapshot.instances.find(item=>item.id==="drinkers:0")!;
  expect(terminal).toMatchObject({
   state:"returning",position:{x:952,y:1376},generation:0,
   materialized:true,visible:true,alpha:1,destroyed:false,
  });
  const terminalX=drinkerSprite.x;
  expect(sprites.length).toBe(created);
  expect(drinkerSprite.destroyed).toBe(false);

  runtime.update(7_000);
  const returning=runtime.snapshot.instances.find(item=>item.id==="drinkers:0")!;
  expect(returning.position.x).toBe(916);
  expect(drinkerSprite.x).toBeLessThan(terminalX);
  expect(sprites.length).toBe(created);
  expect(drinkerSprite.destroyed).toBe(false);

  runtime.update(8_000);
  expect(runtime.snapshot.instances.find(item=>item.id==="drinkers:0"))
   .toMatchObject({state:"gone",position:{x:880,y:1376},generation:0});
  expect(sprites.length).toBe(created);
  expect(drinkerSprite.destroyed).toBe(false);
 });

 it("keeps a completed on-screen route sprite at its terminal position",()=>{
  const sprites:Sprite[]=[];
  const runtime=new PhaserRouteCrowdRuntime({
   add:{sprite:(x,y)=>{const s=new Sprite(x,y);sprites.push(s);return s}},
  },{ ...ROUTE_INPUT,
   pathProvider:{findPath:r=>[r.start,{x:r.start.x+96,y:r.start.y}]},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),random:()=>0,
  });
  runtime.start(0);
  const initial=[...sprites];
  runtime.update(5_000);
  const terminal=runtime.snapshot.instances.find(item=>item.id==="main-crowd:0")!;
  expect(terminal).toMatchObject({state:"gone",materialized:true,visible:true,alpha:1,destroyed:false});
  const terminalPosition={...terminal.position};
  runtime.update(5_500);
  expect(runtime.snapshot.instances.find(item=>item.id===terminal.id)?.position)
   .toEqual(terminalPosition);
  expect(sprites).toEqual(initial);
  expect(sprites.every((sprite)=>!sprite.destroyed&&sprite.alpha===1)).toBe(true);
 });

 it("only recreates route sprites after the core reports an outside-safe cull",()=>{
  const sprites:Sprite[]=[];
  let viewport={left:0,top:0,width:2240,height:2240};
  const runtime=new PhaserRouteCrowdRuntime({
   add:{sprite:(x,y)=>{const s=new Sprite(x,y);sprites.push(s);return s}},
  },{ ...ROUTE_INPUT,
   pathProvider:{findPath:r=>[r.start,{x:r.start.x+32,y:r.start.y}]},
   viewport:()=>viewport,random:()=>0,
  });
  runtime.start(0);
  const initialCount=sprites.length;
  viewport={left:2_000,top:2_000,width:100,height:100};
  runtime.update(100);
  expect(sprites).toHaveLength(initialCount);
  expect(sprites.every((sprite)=>sprite.destroyed)).toBe(true);

  viewport={left:0,top:0,width:2240,height:2240};
  runtime.update(200);
  expect(sprites.length).toBeGreaterThan(initialCount);
  expect(sprites.slice(initialCount).every((sprite)=>!sprite.destroyed&&sprite.alpha===1)).toBe(true);
 });
});
