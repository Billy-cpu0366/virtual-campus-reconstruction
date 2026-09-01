// 玩家碰撞体（FACT：20×8 贴脚小扁块，头部可与墙/屋檐重叠）。
// 深度归 SYS-LAYER（playerDepth 公式），本 CORE 不重复定义。

export const PLAYER_BODY_WIDTH = 20;
export const PLAYER_BODY_HEIGHT = 8;
// 偏移按玩家显示尺寸 48 计算；显示尺寸 SSOT 在 SYS-PLAYER 的 DISPLAY_SIZE，本 CORE 不重复定义。
export const PLAYER_BODY_OFFSET_X = 14; // (48 - 20) / 2
export const PLAYER_BODY_OFFSET_Y = 36; // 48 - 8 - 4
export const PLAYER_DRAG = 300;
export const PLAYER_MAX_VELOCITY = 200;
export const COLLIDE_WORLD_BOUNDS = true;
