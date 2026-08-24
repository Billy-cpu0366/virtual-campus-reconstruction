export type RouteCrowdState = "delay" | "moving" | "returning" | "gone";
export interface RouteCrowdTile { readonly x:number; readonly y:number }
export interface RouteCrowdDelayRange { readonly minMs:number; readonly maxMs:number }
export interface RouteCrowdRange { readonly min:number; readonly max:number }
export interface RouteCrowdConfig { readonly id:string; readonly count:number; readonly tileCandidates:readonly RouteCrowdTile[]; readonly speedVariation:RouteCrowdRange; readonly delay:RouteCrowdDelayRange; readonly goBack:boolean; readonly deleteAfterComplete:boolean }
export interface RouteCrowdPathRequest { readonly start:RouteCrowdTile; readonly end:RouteCrowdTile }
export type RouteCrowdPathPoint=RouteCrowdTile;
export interface RouteCrowdPathProvider { findPath(request:RouteCrowdPathRequest):readonly RouteCrowdPathPoint[]|null }
export type RouteCrowdPathProviderLike=RouteCrowdPathProvider|((request:RouteCrowdPathRequest)=>readonly RouteCrowdPathPoint[]|null);
export interface RouteCrowdViewport { readonly left:number; readonly top:number; readonly width:number; readonly height:number }
export interface RouteCrowdInstanceSnapshot { state:RouteCrowdState; position:RouteCrowdTile; generation:number; materialized:boolean; visible:boolean; destroyed:boolean }
export interface RouteCrowdSnapshot { readonly instances:readonly RouteCrowdInstanceSnapshot[] }
export type RouteCrowdStartResult={ok:true;created:number;pathFailures:number}|{ok:false;reason:"shutdown"};
export interface RouteCrowdRuntimeOptions { readonly random?:()=>number; readonly configs?:readonly RouteCrowdConfig[]; readonly pathProvider:RouteCrowdPathProviderLike; readonly baseSpeed?:number }
export const ROUTE_CROWD_BASE_SPEED=48; export const ROUTE_CROWD_TILE_SIZE=16;
const group=(id:string,count:number):RouteCrowdConfig=>Object.freeze({id,count,tileCandidates:Object.freeze([{x:31,y:81},{x:73,y:133}]),speedVariation:Object.freeze({min:.8,max:1.2}),delay:Object.freeze({minMs:0,maxMs:2000}),goBack:true,deleteAfterComplete:false});
export const ROUTE_CROWD_CONFIGS=Object.freeze([group("main-crowd",10),group("loop-crowd",10),group("drinkers",5),group("concert-crowd",40),group("vertical-crowd",10),group("vertical-crowd-reverse",10),group("walking-crowd",8),group("outside-concert1",10),Object.freeze({...group("crowd-train",10),goBack:false,deleteAfterComplete:true})]);
type Item=RouteCrowdInstanceSnapshot&{path:readonly RouteCrowdTile[]; delayAt:number; speed:number; config:RouteCrowdConfig; start:RouteCrowdTile};
const pathOf=(p:RouteCrowdPathProviderLike,r:RouteCrowdPathRequest)=>typeof p==="function"?p(r):p.findPath(r);
export class RouteCrowdRuntime { private items:Item[]=[]; private dead=false; private begun=false; private last=0; constructor(private readonly options:RouteCrowdRuntimeOptions){ }
get started(){return this.begun} get snapshot():RouteCrowdSnapshot{return {instances:this.items.map(({path,delayAt,speed,...v})=>({...v}))}}
start(now:number,view?:RouteCrowdViewport):RouteCrowdStartResult{if(this.dead)return{ok:false,reason:"shutdown"};this.items=[];let fail=0;const cs=this.options.configs??ROUTE_CROWD_CONFIGS;const rnd=this.options.random??Math.random;for(const c of cs)for(let i=0;i<c.count;i++){const a=c.tileCandidates[Math.floor(rnd()*c.tileCandidates.length)]!;const b=c.tileCandidates[Math.floor(rnd()*c.tileCandidates.length)]!;const start={x:a.x*16,y:a.y*16};const end={x:b.x*16,y:b.y*16};const path=pathOf(this.options.pathProvider,{start,end});if(!path){fail++;continue}const pos=start;this.items.push({state:"delay",position:pos,generation:0,materialized:true,visible:true,destroyed:false,path,delayAt:now+c.delay.minMs,speed:(this.options.baseSpeed??ROUTE_CROWD_BASE_SPEED),config:c,start});}this.begun=this.items.length>0;this.last=now;this.applyView(view);return{ok:true,created:this.items.length,pathFailures:fail}}
tick(now:number,view?:RouteCrowdViewport):RouteCrowdSnapshot{const dt=Math.max(0,now-this.last);this.last=now;for(const x of this.items){if(x.state==="delay"&&now>=x.delayAt)x.state="moving";if(x.state==="moving"&&x.path[1]){x.position={x:Math.min(x.path[1].x,x.position.x+x.speed*dt/1000),y:x.path[1].y};if(x.position.x>=x.path[1].x){if(x.config.goBack)x.state="returning";else if(x.config.deleteAfterComplete){x.state="gone";x.destroyed=true}else{x.state="delay";x.generation++;x.position=x.start;x.delayAt=now+x.config.delay.minMs}}}else if(x.state==="returning"){x.state="gone";x.destroyed=true}}this.applyView(view);return this.snapshot}
private applyView(v?:RouteCrowdViewport){if(!v)return;for(const x of this.items){const hit=x.position.x>=v.left&&x.position.x<=v.left+v.width&&x.position.y>=v.top&&x.position.y<=v.top+v.height;x.materialized=hit;x.visible=hit;x.destroyed=!hit||x.state==="gone"}}
cancel(){this.items=[];this.begun=false;return this.snapshot}shutdown(){this.dead=true;return this.cancel()}}
