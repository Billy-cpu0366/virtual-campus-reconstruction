// walls-layer.json 网格。
// 消费方是 NPC 寻路，不是玩家碰撞。

// 这格能走吗（API契约表「移动→地图」接口）；越界按不可走处理（安全默认）。
export function isWalkable(
  grid: readonly (readonly number[])[],
  x: number,
  y: number,
  walkableValue: number,
  blockedValue: number,
  outOfBoundsIsWalkable: boolean,
): boolean {
  const row = grid[y];
  const value = row?.[x];
  if (value === undefined) return outOfBoundsIsWalkable;
  return value === walkableValue && value !== blockedValue;
}
