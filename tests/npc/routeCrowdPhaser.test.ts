import { describe, expect, it } from "vitest";
import { ROUTE_CROWD_CONFIGS } from "../../src/npc/index.js";
import { PhaserRouteCrowdRuntime } from "../../game/PhaserRouteCrowdRuntime.js";

class Sprite { x:number; y:number; depth=0; destroyed=false; constructor(x:number,y:number){this.x=x;this.y=y} setDepth(v:number){this.depth=v;return this} destroy(){this.destroyed=true} }

describe("PhaserRouteCrowdRuntime",()=>{
 it("materializes visible route crowds and destroys them on shutdown",()=>{
  const sprites:Sprite[]=[];
  const runtime=new PhaserRouteCrowdRuntime({add:{sprite:(x,y)=>{const s=new Sprite(x,y);sprites.push(s);return s}}},{
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
  const runtime=new PhaserRouteCrowdRuntime({add:{sprite:(x,y)=>{const s=new Sprite(x,y);sprites.push(s);return s}}},{
   pathProvider:{findPath:r=>{calls+=1;return [r.start,{x:r.start.x+32,y:r.start.y}]}},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),random:()=>0,
   scheduleNextUpdate:callback=>callbacks.push(callback),
  });

  runtime.start(0);
  expect(calls).toBe(1);
  expect(sprites).toHaveLength(1);

  let frames=1;
  while (callbacks.length > 0) {
   callbacks.shift()!();
   frames+=1;
   expect(calls).toBe(Math.min(frames, ROUTE_CROWD_CONFIGS.reduce((sum, config)=>sum+config.count,0)));
  }
  expect(calls).toBe(ROUTE_CROWD_CONFIGS.reduce((sum, config)=>sum+config.count,0));
  expect(sprites).toHaveLength(calls);
 });

 it("plays the matching eight-direction walk animation",()=>{
  const played:string[]=[];
  const frames:number[]=[];
  const created:string[]=[];
  const sprite={x:0,y:0,setDepth:()=>sprite,setFrame:(frame:number)=>{frames.push(frame);return sprite},destroy:()=>undefined,anims:{play:(key:string)=>{played.push(key);return undefined},stop:()=>undefined}};
  const runtime=new PhaserRouteCrowdRuntime({
   add:{sprite:(x,y)=>{sprite.x=x;sprite.y=y;return sprite}},
   anims:{generateFrameNumbers:(_key,range)=>[range.start,range.end],create:config=>{created.push(config.key);return config},exists:()=>false},
  },{
   pathProvider:{findPath:r=>[r.start,{x:r.start.x+24,y:r.start.y},{x:r.start.x+48,y:r.start.y}]},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),random:()=>0,
  });
  runtime.start(0);
  runtime.update(600);
  expect(created).toContain("route-crowd-npc-man-east");
  expect(played).toContain("route-crowd-npc-man-east");
  expect(frames.at(-1)).toBe(48);
 });

 it("ignores stale startup callbacks after repeat or cancel",()=>{
  const callbacks:(()=>void)[]=[];
  let calls=0;
  const runtime=new PhaserRouteCrowdRuntime({add:{sprite:()=>new Sprite(0,0)}},{
   pathProvider:{findPath:r=>{calls+=1;return [r.start]}},
   viewport:()=>({left:0,top:0,width:2240,height:2240}),
   scheduleNextUpdate:callback=>callbacks.push(callback),
  });

  runtime.start(0);
  expect(calls).toBe(1);
  const staleAfterRepeat=callbacks.shift()!;
  runtime.start(1);
  expect(calls).toBe(2);
  staleAfterRepeat();
  expect(calls).toBe(2);
  callbacks.shift()!();
  expect(calls).toBe(3);
  runtime.cancel();
  const staleAfterCancel=callbacks.shift()!;
  staleAfterCancel();
  expect(calls).toBe(3);
  expect(runtime.spriteCount).toBe(0);

  runtime.start(2);
  const staleAfterShutdown=callbacks.shift()!;
  runtime.shutdown();
  staleAfterShutdown();
  expect(calls).toBe(4);
  expect(runtime.spriteCount).toBe(0);
 });
});
