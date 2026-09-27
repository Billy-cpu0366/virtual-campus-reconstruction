// 沙滩换装触发区。
//
// 原站每 3 帧查一次玩家脚下的瓦片编号（`chunk-WMFY56ZM.js`：
// `let n = this.wallLayer.getTileAtWorldXY(this.player.x, this.player.y, !0), l = n ? n.index : null`），
// 编号等于 `69353` 就脱衣换装。这 595 格全部铺在 `walls` 层里，是本地图里
// 唯一使用这个编号的地方。
//
// 注意它必须是「不碰撞」的——玩家得能站上去才会触发。`walls` 层的碰撞只认
// `COLLISION_GID_FORCED`(69345) / `NON_COLLISION_GID_FORCED`(69346)，69353 两个
// 都不是，因此落到 Phaser 的默认值「不碰撞」，与预期一致。
export const BEACH_TRIGGER_GID = 69353;

/** 脚下的瓦片编号是不是沙滩触发块。拿不到瓦片时传 `null`。 */
export function isBeachTriggerTile(tileIndex: number | null | undefined): boolean {
  return tileIndex === BEACH_TRIGGER_GID;
}
