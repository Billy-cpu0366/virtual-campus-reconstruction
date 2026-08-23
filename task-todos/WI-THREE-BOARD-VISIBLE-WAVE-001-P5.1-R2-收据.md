---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
package: R2-entry-atomicity
status: bounded-implemented-verified
implementation-commit: 00c38dd
parent: ae2bf33
updated: 2026-08-23
---

# P5.1 R2 入口原子性 / viewport / chunk reveal 收据

## 结果

- READY前按480×270逻辑视口采样camera start→player走廊，锁住并完整渲染目标；当前5×5世界的入口走廊覆盖25块。
- `PhaserWorldMutationScheduler.waitForIdle()`同时等待queue、已请求frame与active mutation；world ready不再只等待单个active。
- READY、ENTERING和约3秒cameraStable均保持lock/targets/rendered=`25/25/25`；正常production 0/3/5/8/17秒截图未观察到空洞或逐块补齐。
- 入口完成后lock释放，targets恢复15块，rendered约2.375秒在屏外从25收敛到15；没有永久保留25块。该后台收敛耗时转R3性能包。
- App shell resize与READY前显式刷新Phaser Scale FIT；已启动页面从776.875×437调整到1920×1080后canvas正确刷新为1920×1080。移动375×667保持480×270逻辑画面FIT为375×210.9375。
- READY增加850ms、8步网格揭示；production仍不接111秒序列。

## 代码

- integration分支：`integration/visible-product-wave`
- 提交：`00c38dd`（`fix: make product entry rendering atomic`）
- 修改：`game/CampusScene.ts`、`game/PhaserWorldMutationScheduler.ts`、`game/main.ts`、`index.html`、`src/game-ui/app-shell.ts`及对应测试。

## 检查

- `npm test -- --run`：53 files / 299 tests PASS。
- `npm run typecheck`、`npm run check:runtime`：PASS。
- production/test-hooks build：PASS。
- test-hooks串行：entry、chunk、camera、lifecycle、app-retry Smoke PASS。
- production：普通Smoke、runtime-safety Smoke PASS。
- 正常production桌面READY/0/3/5/8/17、运行中resize和移动READY截图PASS。
- 独立`lightweight-verifier`：纠正其首次误读worktree历史task_plan后，以根`task_plan.md`复验PASS。
- 证据与哈希：`task-todos/evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R2/`。

## 尚未解决

- R3：入口解锁后屏外10块卸载约2.4秒；30Hz物理位置在60Hz render中每隔一帧跳约4.67px；Human硬件LoAF/input latency仍需收据。
- R4–R7和最终Human视觉Gate仍未完成。
