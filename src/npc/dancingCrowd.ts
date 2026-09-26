/**
 * 跳舞人群。值已经搬到 config/，这里只留**类型**和**算法**。
 *
 * `DANCING_DIRECTIONS` 留在代码里，是因为它**同时是类型**：下面那个
 * `DancingDirection` 是这四个字符串的联合类型，`DancingCrowdInstance.direction`
 * 靠它定类型。搬进配置就得把这个类型放宽成普通字符串——那是在动字段定义。
 *
 * （早先这里写的理由是「下载发生在读配置之前」，**那是错的**：配置恰恰是在下载
 * 之前读的——`game/main.ts` 先 `loadNpcConfigs()` 再造 `new Phaser.Game`，preload
 * 在造游戏时才跑。静态人群、路线人群的贴图名单同样决定「下载哪几张」，它们就在
 * 配置里（见各自的 `preload*RuntimeAssets()` 直接读 `presentation.textures`）。
 * 订正于 2026-09-21。）
 */
export const DANCING_DIRECTIONS=Object.freeze(["down","left","right","up"] as const);
export type DancingDirection=(typeof DANCING_DIRECTIONS)[number];
export interface DancingCrowdConfig{readonly minTileX:number;readonly minTileY:number;readonly maxTileX:number;readonly maxTileY:number;readonly npcCount:number;readonly depth:number;readonly scale:number;readonly frameRate:number;}
export interface DancingCrowdInstance {readonly id:string;readonly x:number;readonly y:number;readonly direction:DancingDirection;readonly materialized:boolean;}
export class DancingCrowdRuntime{private items:DancingCrowdInstance[]=[];constructor(private readonly config:DancingCrowdConfig,private readonly random:()=>number=Math.random){}start(view?:{left:number;top:number;width:number;height:number}){if(this.items.length===0)this.items=Array.from({length:this.config.npcCount},(_,i)=>({id:`dancing:${i}`,x:(this.config.minTileX+this.random()*(this.config.maxTileX-this.config.minTileX))*16,y:(this.config.minTileY+this.random()*(this.config.maxTileY-this.config.minTileY))*16,direction:DANCING_DIRECTIONS[Math.floor(this.random()*DANCING_DIRECTIONS.length)]!,materialized:false}));return this.tick(view)}tick(v?:{left:number;top:number;width:number;height:number}){if(v)this.items=this.items.map(i=>({...i,materialized:i.x>=v.left&&i.x<=v.left+v.width&&i.y>=v.top&&i.y<=v.top+v.height}));return this.snapshot}get snapshot(){return Object.freeze({instances:Object.freeze(this.items)});}shutdown(){this.items=[];}}
