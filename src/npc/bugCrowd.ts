/**
 * 虫子群。值已经搬到 config/，这里只留**类型**和**算法**。
 *
 * 配置由调用方递进来（`BugCrowdRuntimeOptions.config`），原因和其它几个 Runtime
 * 一样：这一层管「拿到一份配置之后怎么走」，不管「配置从哪儿来」。
 *
 * `mode` 这个字段没了：它的合法取值**只有 `"wander"` 一个**，等于写死。
 * 一个只有一种填法的输入框不是配置项，是类型，所以它留在下面的 `BugCrowdMode` 里。
 */
import type { RouteCrowdPathProviderLike, RouteCrowdViewport } from "./routeCrowd.js";
export interface BugCrowdPoint { readonly x:number; readonly y:number; }
export interface BugCrowdRange { readonly minMs:number; readonly maxMs:number; }
export type BugCrowdMode="wander"; export type BugCrowdState="moving"|"waiting";
export interface BugCrowdConfig { readonly id:string; readonly startTiles:readonly BugCrowdPoint[]; readonly endTiles:readonly BugCrowdPoint[]; readonly npcCount:number; readonly movementSpeed:number; readonly speedVariation:number; readonly randomPositions:boolean; readonly wanderDistance:number; readonly wanderInterval:BugCrowdRange; readonly sprite:string; readonly maxActiveInViewport:number; }
export interface BugCrowdInstanceSnapshot { readonly id:string; readonly position:BugCrowdPoint; readonly state:BugCrowdState; readonly sprite:string; readonly materialized:boolean; }
export interface BugCrowdSnapshot { readonly instances:readonly BugCrowdInstanceSnapshot[]; }
export type BugCrowdViewport=RouteCrowdViewport;
export interface BugCrowdRuntimeOptions { readonly config:BugCrowdConfig; readonly pathProvider:RouteCrowdPathProviderLike; readonly random?:()=>number; }
export const BUG_CROWD_TILE_SIZE=16;
type Item={id:string;position:BugCrowdPoint;state:BugCrowdState;sprite:string;materialized:boolean;path:readonly BugCrowdPoint[];index:number;nextAt:number;speed:number};
const world=(p:BugCrowdPoint)=>({x:p.x*BUG_CROWD_TILE_SIZE+8,y:p.y*BUG_CROWD_TILE_SIZE+8}); const provider=(p:RouteCrowdPathProviderLike,start:BugCrowdPoint,end:BugCrowdPoint)=>typeof p==="function"?p({start,end}):p.findPath({start,end});
const empty=():BugCrowdSnapshot=>Object.freeze({instances:Object.freeze([])});
export class BugCrowdRuntime { private items:Item[]=[];private last=0;private dead=false;private readonly random:()=>number; constructor(private readonly o:BugCrowdRuntimeOptions){this.random=o.random??Math.random;} get snapshot():BugCrowdSnapshot{return Object.freeze({instances:Object.freeze(this.items.map(({path,index,nextAt,speed,...x})=>Object.freeze({...x,position:Object.freeze({...x.position})}))) });} start(now:number,view?:BugCrowdViewport){if(this.dead)return this.snapshot;const c=this.o.config;this.last=now;this.items=[];for(let i=0;i<c.npcCount;i++){const start=world(c.startTiles[Math.floor(this.random()*c.startTiles.length)]!);const item:Item={id:`${c.id}:${i}`,position:start,state:"moving",sprite:c.sprite,materialized:false,path:[],index:1,nextAt:now+this.delay(),speed:c.movementSpeed*(1-c.speedVariation+this.random()*2*c.speedVariation)};this.choose(item);this.items.push(item);}this.view(view);return this.snapshot;} tick(now:number,view?:BugCrowdViewport){const elapsed=Math.max(0,now-this.last);this.last=now;for(const item of this.items){if(now>=item.nextAt){this.choose(item);item.nextAt=now+this.delay();}let left=elapsed;while(left>0){if(item.path[item.index]===undefined){if(now<item.nextAt){item.state="waiting";break;}this.choose(item);item.nextAt=now+this.delay();continue;}item.state="moving";const target=item.path[item.index]!,dx=target.x-item.position.x,dy=target.y-item.position.y,d=Math.hypot(dx,dy),a=item.speed*left/1000;if(a<d){item.position={x:item.position.x+dx*a/d,y:item.position.y+dy*a/d};left=0;}else{item.position=target;item.index++;left-=d/item.speed*1000;}}}this.view(view);return this.snapshot;} cancel(){this.items=[];return this.snapshot;} shutdown(){this.dead=true;return this.cancel();} private choose(item:Item){const c=this.o.config;const end=world(c.endTiles[Math.floor(this.random()*c.endTiles.length)]!);item.path=provider(this.o.pathProvider,item.position,end)??[];item.index=1;}private delay(){const w=this.o.config.wanderInterval;return w.minMs+this.random()*(w.maxMs-w.minMs);}private view(v?:BugCrowdViewport){if(!v)return;for(const i of this.items)i.materialized=i.position.x>=v.left&&i.position.x<=v.left+v.width&&i.position.y>=v.top&&i.position.y<=v.top+v.height;}}
