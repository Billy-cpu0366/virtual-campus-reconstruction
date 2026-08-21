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

## 排除

传送相机、怪物抓人相机、SYS-ZONE、内容弹窗、完整灯光/FX、地图新功能和最终硬件性能阈值。

## 激活 Gate

必须同时满足：

- M1 和 P1 实际 diff/检查结果经 Human 预览接受后各自提交，并通过允许范围检查；
- Main 在 integration 分支完成 `CampusScene` 接线；
- 第一波全量测试/build/browser Smoke 通过；
- Human 明确接受第一波预览结果。
