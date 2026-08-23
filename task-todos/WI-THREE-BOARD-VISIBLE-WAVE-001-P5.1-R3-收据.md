---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
repair-package: P5.1-R3
status: bounded-verified
implementation-commit: 5d0d96d2acca5fdf6596e01ef4a5399ea91e2017
implementation-tree: e522c71704b9ec86ac92f62469085f8c487198b3
base-commit: 00c38dd
verified-date: 2026-08-23
---

# P5.1 R3 视觉平滑与性能证据收据

## 1. 结论

R3已在integration分支完成并有界验证：

1. 原站30 FPS fixed physics FACT保持不变；速度、body、碰撞和`PlayerRuntime`仍由原physics Sprite拥有。
2. 新增仅供主相机显示的玩家镜像，在相邻30Hz物理位置之间插值；主相机忽略physics Sprite并跟随镜像。
3. 入口camera在约3.03秒稳定时释放25块走廊锁；15块动态目标在约4.71秒收敛，早于约5.02秒PLAYING/控制开放。
4. 普通视觉层卸载不再逐层等待；只有碰撞层保留Arcade collider生命周期让步。
5. 正常production入口与4秒移动窗口在本机WSL无LoAF、无long task、无>34ms帧；最大输入handler延迟约4.4ms。

这证明本机正常路径的R3合同成立，但**不能否定Human硬件上的卡顿**；最终Human性能/视觉Gate仍保留。

## 2. 实现

- 提交：`5d0d96d`（`fix: smooth player rendering without changing physics`）
- 主要文件：
  - `game/PhaserPlayerVisualInterpolator.ts`
  - `game/CampusScene.ts`
  - `game/PhaserWorldRenderer.ts`
  - `scripts/browser-visual-smoothing-smoke.mjs`
  - `scripts/browser-performance-smoke.mjs`
- 固定边界：
  - 未把physics改为60 FPS；
  - 未恢复111秒正常入口；
  - 未改变chunk target公式；
  - 未修改`sample/`或猜测`Q-LAYER-002/003`。

## 3. 量化证据

### 3.1 30Hz物理与视觉连续性

2.2秒、134个render采样帧：

| 指标 | physics body | visual mirror | camera |
|---|---:|---:|---:|
| 有位移帧 | 66 | 129 | 129 |
| 零位移帧 | 67 | 4 | 4 |
| 有位移比例 | 49.6% | 97.0% | 97.0% |
| 中位位移 | 4.6667px | 2.3380px | 2px |
| 最大位移 | 4.6667px | 2.3544px | 3px |

结果符合“物理仍30Hz、显示在60Hz中间帧连续推进”。

### 3.2 入口卸载

- camera stable / lock release：约`3030ms`；
- `25 → 15` rendered收敛：约`4710ms`；
- PLAYING：约`5015ms`；
- 收敛发生在控制开放前：PASS。

### 3.3 正常production性能

- production hooks：`undefined`；
- 入口窗口：320帧，P95 `16.7ms`，LoAF `0`，long task `0`；
- 4秒移动窗口：259帧，P95 `16.8ms`，LoAF `0`，long task `0`；
- keydown / keyup handler延迟：约`1.0ms / 4.4ms`；
- console / exception：`0 / 0`。

## 4. 验证

- `npm test`：54 files / 303 tests PASS；
- `npm run typecheck`、`npm run check:runtime` PASS；
- test-hooks与production两种build PASS；
- entry、chunk、camera、collision、lifecycle、mobile-input、content、visual-smoothing PASS；
- production smoke、runtime-safety、performance PASS；
- 独立verifier：静态/目标单测PASS；其隔离环境无法访问本地CDP，因此browser项标记UNVERIFIED；Main已在同一commit上完成实际browser重放。

证据目录：[`task-todos/evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R3/`](evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R3/)

## 5. 状态

- **accepted**：30Hz物理不变、另做显示平滑的方案已由`DEC-P5.1-SYSTEMIC-REPAIR-001`授权。
- **persisted**：实现、自动门禁和本收据已落盘。
- **verified**：R3在WSL本机范围内bounded verified。
- **尚未解决**：Human硬件卡顿现场trace与最终整体视觉验收；父流程继续R4 train/sprayer/smoke可见编排。
