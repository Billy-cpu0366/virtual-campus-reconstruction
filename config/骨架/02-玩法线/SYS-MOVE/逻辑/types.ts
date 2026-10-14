/** 移动板块的校园数值，碰撞与寻路接口仍由 src 定义。 */
export interface MoveConfigs {
  readonly body: { readonly width: number; readonly height: number };
  readonly drag: number;
  readonly maxVelocity: number;
  readonly collideWorldBounds: boolean;
  readonly collisionLayerNames: readonly string[];
  readonly walkableValue: number;
  readonly blockedValue: number;
  readonly outOfBoundsIsWalkable: boolean;
}
