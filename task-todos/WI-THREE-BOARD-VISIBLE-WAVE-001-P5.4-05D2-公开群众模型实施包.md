---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.4-05d2-public-crowd-model
status: accepted-implementation-authorized
updated: 2026-08-24
decision: DEC-P5.4-05D2-PUBLIC-CROWD-MODEL-001
---

# 05-D-2 公开群众模型实施包

## 目标

按公开 Bundle 的人口 owner 重构可见群众，消除“场所人群被错误做成同步路线人、到端点消失”的模型错误。公开事实优先于单次截图：火车离站组保持 `npcCount:10`。

## 范围（FACT）

1. **区域静态群众**：消费 `particle-trajectories.json` 中全部 25 个 `crowd` 和 21 个 `crowd_up` region。在 polygon 内按公开 bbox 面积公式随机布点、最小间距 20px、普通/海滩/足球专属贴图选择；只在扩展视口实例化和回收 sprite。
2. **路径群众**：补齐 11 个正常 `CrowdManager` 配置：`main-crowd`、`loop-crowd`、`drinkers`、`concert_crowd`、`beach_crowd_walk`、`bug-area`、`vertical-crowd`、`vertical-crowd-reverse`、`walking-crowd`、`hazmat-crowd`、`outside_concert1`。不纳入仅调试的 `test-crowd`。
3. **火车事件**：火车离站创建 `crowd-train`，公开人数 10、22 个站台起点候选、6 个终点候选、2400ms 前置延迟、单程删除；期间暂停并在火车离开视口/完成后恢复 `loop-crowd`。
4. **专属人群**：3 个 `concert` region（最小间距18px、镜头内随机转向/舞动）、`protesters_rising`（30 人、最小间距20px、循环行走）、8 名舞者；保留已实现的 reading/eating/cat 与4名 sprayer special。

## 设计边界（DECISION）

- 新增按 owner 分离的有界 runtime，不建立 Entity/NPC 通用框架，也不把场所 crowd 塞入路径 runtime。
- 固定随机源下，区域 placement、贴图、朝向和动作选择可重放；生产运行可使用非固定随机。
- `crowd`/`crowd_up` 无固定 seed；截图中的精确人物、像素点、朝向与同时可见数不得伪称为 FACT。
- 路线 sprite 的回收仅影响渲染，不能冻结或重置路线逻辑；区域静态 crowd 回到视口时恢复同一批已布点结果。
- 不把火车 10 人公开事实改为 2 人；Human 的两人观察作为未采用的冲突记录保留在源码审计中。

## 禁止

- 不改 `sample/`、火车路线/scale/timing、30FPS、玩家、地图、相机或远端。
- 不猜无 ID region 的业务名称，不补造全局避让、未证实常驻地点或动作。
- 不实现 water/fog、动物、ghost、cars，或未证实的完整 worker/teardown 算法。

## 执行清单（Human 已接受）

按公开 owner 分批完成，不再按视觉症状零散补丁。每一批都必须先完成：公开配置测试→核心行为测试→Phaser接线→指定区域 production probe；未完成四项不得开启下一批。

1. 区域静态 crowd：46 个 `crowd/crowd_up` region（已实现，待纳入完整回归）。
2. 路线/火车 crowd：完整 11 条正常路线、`bug-area` 随机游走、火车10人和 `loop-crowd` 协同。
3. 专属场所 crowd：3 concert、1 protesters_rising、8 dancers。
4. special：reading/eating/cat/4 sprayer 保持独立 owner，复核资源和生命周期。
5. 统一回归：站台、餐车/店面、海滩/足球/虫区、concert/抗议/舞者、火车事件、相机创建回收、性能和完整 production。
6. 最终一次 Human 整体视觉验收；自动结果不能代签。

## 验收

- 结构：46 个静态 crowd region、11 条正常路线配置、火车10人配置、3 concert region、1 protesters_rising、8 dancer 和 special 配置均可被测试读取。
- 行为：场所人群稳定分散且不走到端点消失；路线人独立延迟/位置/路径；火车离站10人且 loop 暂停恢复；concert/protest/dancer 与 special 各自保持独立生命周期。
- production：按站台、餐车/店面、演唱会、抗议区和火车事件重放截图/探针；性能、完整 production 路径无异常。
- Human：自动检查不代替视觉验收。

## 依据

- [人群源码审计](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.4-05D1-人群源码审计.md)
- `sample/original-public-build/mirror/chunk-WMFY56ZM.js`：CrowdManager、`initCrowdStaticNPCs`、`initConcertNPCs`、`initProtestersRisingNPCs`、`createDancingNPCs`、`spawnTrainPassengers`。
- `sample/original-public-build/mirror/assets/maps/particle-trajectories.json`。
