import { describe, expect, it } from "vitest";
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
});
