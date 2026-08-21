---
work-item: WI-SYS-CAMERA-RUNTIME-001
parent: WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001
status: active
branch: impl/gameplay-serial
authorization: DEC-SYS-CAMERA-RUNTIME-001
blocked-by: none
updated: 2026-08-21
baseline-commit: 36c1cf5
baseline-tree: aa5e4010f3426f746a41a92d614143e2f11da168
---

# 第二波 SYS-CAMERA 运行时实施包

> 范围已由 Human 接受；M1+P1 integration `f2fe106`、全量回归、Human Gate 和同一 gameplay worktree 基线同步均已验证。当前可按本卡实现，完成后必须停在 ready-for-preview。

## 已接受范围

1. 6 点航拍序列，production 使用原站约 111 秒时长。
2. 航拍期间通过统一玩法控制门锁定玩家和摇杆。
3. tween/update 只提交相机 viewport，由 SYS-CHUNK 计算目标；相机不操作 cache/Tilemap。
4. 航拍结束后 3 秒 Power2 回到玩家，再恢复 zoom=1、lerp=1、offset=0、deadzone=0 和控制。
5. `roundPixels=true`；nativeScale 使用运行时设备值。
6. HeatHaze/Fire/Morph 不可用时显式降级，不伪造后处理。
7. test-hooks/可控时钟可以缩短自动化等待；production 时长不得因此改变。

## 实现合同

- 纯状态/时序逻辑放入 `src/camera/`，Phaser 边界放入新增 `game/PhaserCamera*.ts`；不得把完整状态机堆进 `CampusScene`。
- 只消费 `PlayerPositionSnapshot` 和玩法控制门回调；不得持有或输出 Sprite/Body、键盘、摇杆实例。
- viewport 更新只输出 `CameraViewport` 给 Main；不得直接调用 `ChunkCoordinator`、cache、renderer 或 Tilemap。
- production 必须使用卡中 6 点和约111秒；测试缩时必须通过显式配置/可控时钟，默认值不得被测试参数污染。
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

必须新增：6点/production总时长、控制锁、viewport 输出、3秒 Power2 回玩家、硬跟随恢复、nativeScale、后处理降级、重复开始、shutdown/失败恢复和测试缩时不污染默认值的自动测试。真实 `CampusScene` 接线、build 和浏览器 Smoke 由 Main 完成。

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
