---
work-item: WI-SYS-NPC-SPECIAL-001
parent-batch: B0
batch: B1
systems: [SYS-NPC]
type: bounded-implementation-package
status: proposed-awaiting-human
authorization: none
candidate-base: ea8751260984fa6ef5e4589c2fbf196a6b28aa8c
updated: 2026-08-25
---

# SYS-NPC B1 静态与 Venue 实施包（候选）

> B1尚未授权。目标是先修公开机制已经足够、且不依赖六点相机序列入口的`crowd/crowd_up`、concert和protest；不夹带route、train、special、rat、ghost或birds。

## 1. 目标与 expected

### Region static：`crowd` / `crowd_up`

- 25/21个公开region按polygon布点；配置数量和成功布点数量分开记录。
- presentation按整个region bbox与camera worldView外扩100px激活/回收；region存活期间身份与位置稳定。
- 保留公开方向池；每NPC拥有独立、可复放的look-around节奏，不用全局少量抽样代替owner机制。
- 无名region只使用ID，不补造地点名、精确人物或固定随机结果。

### Concert

- 三个公开region独立于普通static和protest。
- 按公开方向/动作机制呈现，不再只放单一`npc-man`静态sprite。
- region级生命周期、稳定身份、动态depth和资源失败显式收敛。

### Protesters rising

- region 87、目标30、最小间距20；polygon布点和region生命周期保持。
- 每NPC按公开0–2秒初始延迟、0–2次动作、500–2000ms等待循环；不把“约三分之一动作、2–6秒idle、最多2人”DECISION冒充FACT。
- 口号气泡、方向和presentation状态独立清理；cull/recreate不得产生共享状态串扰。

## 2. 实施拓扑与允许路径

建议从clean失败candidate `ea87512`创建隔离分支/worktree `impl/npc-b1-static-venue`。实现窗口只允许：

- `src/npc/staticCrowd.ts`
- `src/npc/venueCrowd.ts`
- `src/npc/venueCrowdRuntime.ts`
- `game/PhaserStaticCrowdRuntime.ts`
- `game/PhaserVenueCrowdRuntime.ts`
- `tests/npc/staticCrowd.test.ts`
- `tests/npc/venueCrowd.test.ts`
- `tests/npc/venueCrowdRuntime.test.ts`
- `tests/npc/venueCrowdPhaser.test.ts`
- 新增有界`tests/npc/`测试和一份分支执行报告

Main独占并在接收后串行处理：

- `game/CampusScene.ts`
- `scripts/browser-npc-static-venue-production.mjs`及`package.json`命令入口
- 权威文档、状态、integration merge和最终Human Gate

## 3. 禁止范围

- 不修改`sample/`、地图、玩家、相机、30FPS、火车路线/scale/timing或远端。
- 不修改route/train/bug/hazmat、sprayer、fixed special、dancing、rat、ghost、birds。
- 不改`particle-trajectories.json`公开快照；不硬编码单次截图的人物、方向和坐标。
- 不建立通用NPC/Entity框架，不把region owner改成逐点viewport owner。
- 不自行修改`CampusScene`、共享probe/package命令、权威状态，不merge/push。

## 4. 实施步骤

1. 固定region配置、polygon、count/spacing、方向与动作合同的失败测试。
2. 修正static region生命周期与独立look-around状态。
3. 分离concert presentation，补方向/动作和资源失败。
4. 把protest从历史DECISION改回公开逐NPC循环与气泡生命周期。
5. 补Phaser presentation、cull/recreate、shutdown和失败测试。
6. 分支目标测试通过后交Main；Main接线production probe并完整回归。

## 5. 自动验收

- `npm run typecheck`
- B1相关`tests/npc/`全部通过；修改前失败证据和修改后通过使用同一测试。
- 全库测试、两种build和既有browser门禁不回归。
- 新production probe至少覆盖：一个普通`crowd`、一个`crowd_up`、三个concert、protest；桌面与375×667。
- 每类验证：镜头从region外慢移入/移出、region内静止、身份稳定、动作节奏、无屏内pop、资源失败、shutdown后sprite/timer/listener归零。
- probe不得只检查数量；必须记录可见位置、稳定ID、动作状态与边界前后截图/收据。

## 6. Human Gate

自动回归通过后，先由Human分别验收：

1. 普通static和`crowd_up`区域自然出现/离开、方向与动作不过度同步；
2. concert不是静态单一人物堆；
3. protest动作有独立节奏、无整群同步、气泡不残留；
4. 镜头边界没有明显屏内生成/消失；
5. 双视口画面可接受。

B1 Human视觉通过不自动授权B2，也不晋升完整SYS-NPC为implemented/verified。

## 7. 成本与风险

- **成本**：中等；现有candidate已有owner骨架，主要修改presentation状态和region边界，并补完整probe。
- **性能风险**：concert高密度sprite；需要保留分帧创建预算，但预算不能造成屏内迟到，需在region外预热阶段完成。
- **随机风险**：原站使用随机布点；测试固定seed验证语义，Human不按精确人物像素对齐验收。
- **集成风险**：根`master`没有NPC代码，实施必须以`ea87512`隔离worktree为基线，由Main统一接收，不能直接写根基线。
