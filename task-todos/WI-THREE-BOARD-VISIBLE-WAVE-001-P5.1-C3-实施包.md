---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
repair-package: P5.1-C3
status: automated-verified-awaiting-human-acceptance
authorization: DEC-P5.1-C3-IMPLEMENT-001; DEC-P5.1-C3-CONTINUITY-001
authority-inputs:
  - DEC-P5.1-C3-P0-SCOPE-001
  - DEC-P5.1-C3-LOCAL-ENTRY-ORACLE-001
  - IC-P5.1-C3-001
candidate-baseline: 54c0e2922ce3fc6b3ced78118db6b2b867b6eff7
owner: Main
updated: 2026-08-24
---

# P5.1 C3 三项联合实施包（候选）

## 目标

只修复 C3 的三个已定位差异：Loading/Play 壳层级、约 2 秒入口回主角的可感知停顿、party/concert 屋顶未淡隐。一次实施、一次完整正常路径回归；不把 WSL 结果冒充最终 Human 验收。

## 证据与判断

- **Loading FACT**：原站 `#init-load` 是完整白屏；GIF、进度、Play 壳均有公开 HTML/本地镜像。1280×720 对照显示复刻为 560×454 居中面板且 READY 仅有 150×53.6 Play 按钮。
- **入口 FACT/诊断**：保留总 3 秒和 5 秒控制门的既有 DECISION；当前 `200ms` 到 smoke、`1750ms`停留、`1050ms`回玩家，连续录制确认约 2.05 秒才开始回程。
- **party DECISION**：Human 指定右侧 party 要采用实验室式淡隐。合法 production 路径落在 concert bounds，内部 concert alpha 仍为 1；当前仅 factory 区域调用 roof 消费者。

## 实施内容

### C3-A：全视口 Loading / Play 壳

**文件**：`index.html`、必要的 `src/game-ui/app-shell.ts` 测试、Loading browser evidence 脚本。

1. 保持真实 Phaser progress、generation、Error/Retry 合同不变。
2. Loading 改为无边框、无居中卡片的全视口白色层；canvas 在 Loading 下不能透出。
3. READY/Play 使用已准备好的游戏画面作为可见背景，上叠同一 presentation layer 的 logo 与 Play；不得留全白空背景，也不以孤立小按钮悬浮。
4. 保留网格揭示作为重构 DECISION，但不宣称其精确网格/时序等同原站。

### C3-B：连续入口镜头编排

**文件**：`game/CampusScene.ts`、`tests/game/**`、入口连续画面脚本。

1. 保持 3 秒总时长、5 秒 train/control 边界、30FPS physics、entry corridor 与动态 chunk 生命周期。
2. 取消 smoke 预览的到点停留；在总3秒内以单条连续相机轨迹从烟雾预览回到玩家，不能出现“静止画面后重新启动”的可感知断点。
3. 不改变111秒序列、火车路线/scale/timing，也不将 WSL 的无长帧结果写为硬件性能结论。

### C3-C：party/concert roof 消费者

**文件**：`game/CampusScene.ts`、必要 `tests/game/**` 与 production roof 路径脚本。

1. 将目前 factory-only 区域消费者收敛为按组独立的 factory/concert 检查与 tween handle；不改 `src/layer` 的 roof 组、策略或 renderer 合同。
2. concert 采用本次重构区域 `x=1632..2208, y=384..848`；进入淡隐、离开恢复，均复用既有 300ms Power2 tween。
3. factory 行为保持原样；两个 roof 组互不影响，chunk 装卸、Retry、shutdown 后无 tween 残留。

## 明确不做

- 不改 `sample/`、`src/route/train.ts`、30FPS、111 秒序列、train 路线/scale/timing。
- 不纳入 HUD、内容、NPC、车辆、particles3/69360 或任何 deferred C3 行。
- 不 push、PR、merge 或修改 `main`。

## 验证

1. `npm run typecheck`、全量测试、production/test-hooks build；
2. 1280×720 原站/复刻 Loading 与 Play 同视口截图，检查Loading全视口白屏、READY/Play可见游戏背景、真实进度与可点击 Play；
3. normal-production 0–5 秒低扰动 screencast：从预览到玩家无静止再启动断点、3 秒前完成、5 秒前不开放控制；
4. normal-production 合法 party 外→内→离开：concert alpha `1→0→1`，factory 不受影响；再跑 factory 原路径以证明未回归；
5. 既有 entry、app-retry、roof-footsteps、lifecycle、chunk、runtime-safety browser gates；
6. 最终由 Human 复看 Loading、入口连贯性与 party 屋顶，未通过则回同一差异表。

## 风险

- C3-B 是重构编排 DECISION，不是原站精确时序 FACT；若 Human 仍感到不连贯，回到该连续录制调整，不改 physics。
- C3-C 的 party=concert 区域是本轮适配 DECISION；不扩展为原站 party 触发事实。
- C3-A 可改善层级但原站精确百分比插值仍 UNKNOWN。

## Human Gate

Human先回复`开始吧`（2026-08-24），随后以`ok`接受连续镜头与可见Play背景修正。实现提交为`18ee2d1`、`a24b10b`、`1109137`；typecheck、315项测试、两种build、test-hooks entry smoke及production trace通过（相机约3099ms稳定、约5084ms开放控制）。最终视觉验收仍单独保留。
