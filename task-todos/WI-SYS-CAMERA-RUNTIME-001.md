---
work-item: WI-SYS-CAMERA-RUNTIME-001
parent: WI-MAP-GAMEPLAY-PARALLEL-DESIGN-001
status: bounded-integrated-verified
branch: impl/gameplay-serial
authorization: DEC-SYS-CAMERA-RUNTIME-001
blocked-by: none
updated: 2026-08-22
baseline-commit: 36c1cf5
baseline-tree: aa5e4010f3426f746a41a92d614143e2f11da168
result-commit: 19ac98b
integration-commit: cd3691a
---

# 第二波 SYS-CAMERA 运行时实施包

> 历史有界能力包已完成。`DEC-CAMERA-ENTRY-FLOW-FIX-001`与`DEC-THREE-BOARD-VISIBLE-WAVE-001`已取代本卡关于产品入口的旧解释：六点序列只保留显式test-hooks能力，正常入口触发为UNKNOWN且禁止接入111秒序列。

## 已接受范围

1. 当时实现六点默认序列能力（数据总时长约111秒）；这不再作为正常入口要求。
2. 航拍期间通过统一玩法控制门锁定玩家和摇杆。
3. tween/update 只提交相机 viewport，由 SYS-CHUNK 计算目标；相机不操作 cache/Tilemap。
4. 航拍结束后 3 秒 Power2 回到玩家，再恢复 zoom=1、lerp=1、offset=0、deadzone=0 和控制。
5. `roundPixels=true`；nativeScale 使用运行时设备值。
6. HeatHaze/Fire/Morph 不可用时显式降级，不伪造后处理。
7. test-hooks/可控时钟验证序列能力；正常production入口不得自动触发该序列。

## 实现合同

- 纯状态/时序逻辑放入 `src/camera/`，Phaser 边界放入新增 `game/PhaserCamera*.ts`；不得把完整状态机堆进 `CampusScene`。
- 只消费 `PlayerPositionSnapshot` 和玩法控制门回调；不得持有或输出 Sprite/Body、键盘、摇杆实例。
- viewport 更新只输出 `CameraViewport` 给 Main；不得直接调用 `ChunkCoordinator`、cache、renderer 或 Tilemap。
- 序列能力被显式调用时使用卡中六点默认数据；正常入口禁止调用，Loading/Play真实短过渡由新工作项调查。
- shutdown/重复开始/中途失败必须清 timer/tween，保持控制门和跟随状态可恢复；后处理不可用只报告降级，不阻断主流程。

## 允许文件

```text
src/camera/
新增 game/PhaserCamera*.ts
tests/camera/
task-todos/WI-SYS-CAMERA-RUNTIME-001-执行报告.md
```

## 禁止与排除

- 不修改 `game/CampusScene.ts`、`game/PhaserPlayerRuntime.ts`、地图/renderer、`package.json`、共享 browser Smoke 或权威状态文档。
- 不修改 `sample/`、旧 Phaser 或远端 Git。
- 不实现传送相机、怪物抓人相机、SYS-ZONE、内容弹窗、完整灯光/FX、地图新功能和最终硬件性能阈值。
- 不自行 commit、merge 或 push；完成后停在 ready-for-preview。

## 客观检查

```text
npm run typecheck
npm test -- --run
git -c core.whitespace=cr-at-eol diff --check
```

历史能力测试覆盖六点默认总时长、控制锁、viewport输出、3秒回玩家、硬跟随恢复、nativeScale、降级、重复开始和shutdown；当前production正常入口不调用该序列。真实短入口由新工作项调查。

## 激活 Gate

必须同时满足：

- M1 和 P1 实际 diff/检查结果经 Human 预览接受后各自提交，并通过允许范围检查；
- Main 在 integration 分支完成 `CampusScene` 接线；
- 第一波全量测试/build/browser Smoke 通过；
- Human 明确接受第一波预览结果。

以上 Gate 已由 `f2fe106`、Human“接受并提交”和 clean/tree 等价基线 `36c1cf5` 满足。

## 停止条件与交接

- 允许范围实现和客观检查完成后，创建 `task-todos/WI-SYS-CAMERA-RUNTIME-001-执行报告.md`。
- 报告必须列出实际 diff、production/test 参数、状态/失败/shutdown 边界、测试结果、Main 接线说明和未解决风险。
- 标记 ready-for-preview 后停止；不自行修改 Main 文件或进入 commit。
