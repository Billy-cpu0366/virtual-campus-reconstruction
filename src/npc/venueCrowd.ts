/**
 * 场馆人群的区域。值已经搬到 config/，这里只留**类型**。
 *
 * 区域数据由调用方递进来（`VenueCrowdRuntimeOptions.regions`）：这一层只管
 * 「拿到几块区域之后怎么撒人」，不管「这几块区域从哪儿来」。
 */
export interface VenuePoint { readonly x:number; readonly y:number; }
export interface VenueRegion { readonly id:string; readonly type:"concert"|"protesters_rising"; readonly outline:readonly VenuePoint[]; readonly count:number; readonly spacing:number; }
