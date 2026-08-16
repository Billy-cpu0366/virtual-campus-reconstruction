// SYS-MOVE 确定性 CORE 的公共类型。

export interface Velocity {
  readonly vx: number;
  readonly vy: number;
}

// Phaser Arcade 引擎每帧碰撞后更新的 body.blocked 标志。
export interface BlockedFlags {
  readonly up: boolean;
  readonly down: boolean;
  readonly left: boolean;
  readonly right: boolean;
}
