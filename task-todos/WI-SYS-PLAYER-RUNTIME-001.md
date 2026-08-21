---
work-item: WI-SYS-PLAYER-RUNTIME-001
parent: WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001
status: authorized-awaiting-baseline-sync
branch: impl/gameplay-serial
authorization: DEC-SYS-PLAYER-RUNTIME-001
updated: 2026-08-21
---

# P1 SYS-PLAYER 运行时实施包

> 本文件是玩法串行窗口第一阶段任务卡；动态状态仍只以根 `task_plan.md` 为准。

## 目标

在保留现有移动、碰撞、depth 和移动端摇杆行为的前提下，接入真实玩家 idle/sitting 状态和统一玩法控制门，为第二波相机航拍提供稳定依赖。

## 必须实现

1. 玩法控制门：禁用时立即停速、屏蔽并 reset 键盘/摇杆；启用后恢复设备对应输入。
2. 8 秒无移动触发 eating/scratching/tying-shoe，不能连续重复上一次动作。
3. 30 秒无移动进入 sitting；收到移动意图后 stand-up 并恢复方向。
4. 使用公开 player-eating/player-scratching/player-tying-shoe/player-sitting 资源。
5. 资源或动画缺失时安全降级为普通 idle，不得卡死控制状态。
6. 提供只读玩家位置快照和控制状态，供 Main 接线。
7. 保持现有 8 方向、速度、Body、碰撞、桥 depth、键盘/摇杆优先级和失焦清理。

## 允许文件

```text
src/player/
src/camera/ 仅已有共享类型确需最小兼容时
新增 game/PhaserPlayer*.ts 有界适配器
tests/player/
tests/camera/ 仅共享类型对应测试
task-todos/WI-SYS-PLAYER-RUNTIME-001-执行报告.md
```

## 禁止

- 不修改 `game/CampusScene.ts`、地图/renderer、`package.json`、共享 browser Smoke 或权威状态文档。
- 不实现 SYS-CAMERA 航拍。
- 不实现沙滩完整触发、怪物抓人、传送、区域弹窗或内容线。
- 不修改 `sample/`、旧 Phaser 或远端 Git。
- 不建立通用实体框架，不自行 merge/push。

## 客观检查

```text
npm run typecheck
npm test -- --run
```

必须新增控制门、8s/30s 阈值、动作不连续重复、移动退出 idle、缺资源降级和 shutdown/reset 测试。真实 `CampusScene` 接线及浏览器 Smoke 由 Main 在 integration 分支完成。

## 停止条件与交接

- P1 范围实现和单元测试完成后停止，不进入 SYS-CAMERA。
- 若当前单 Sprite 结构无法在不改 `CampusScene` 下接入，先提供最小适配器和明确接线说明，不越权修改共享文件。
- 返回实际 diff、测试结果、状态/清理边界、未解决项、提交 ID 和执行报告路径。
