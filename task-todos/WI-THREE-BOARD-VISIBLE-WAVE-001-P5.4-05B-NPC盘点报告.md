---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.4-05b-npc-inventory
status: historical-input-to-npc-special-audit
updated: 2026-08-24
---

# 05-B 全量 NPC 盘点与分组

## 结论

**FACT**：四个喷洒 NPC 不是完整覆盖。公开 Bundle 还直接证明常规路线群众、区域群众、hazmat/bug、抗议者、ghost、特写人物、舞者/鼠群和鸟类。05-C 只处理已确认的四个 sprayer；其余必须按独立证据批次进入 05-D，不能先建通用 NPC/Entity 框架。

## 已直接证实的候选（FACT）

| 建议批次 | 候选 | 公开证据 / 已知行为 |
|---|---|---|
| 05-C | sprayer×4 | `chunk-WMFY56ZM.js`约`546761–550600`：四锚点、接近触发、300ms级联、速度140、路线/销毁。|
| 05-D-1 | 常规步行群众 | 约`318394`、`328290–332437`：17种人物精灵，main/loop/drinkers/concert/vertical/walking/outside_concert/crowd-train路线组。|
| 05-D-2 | 静态群众/沙滩群众/足球队 | `particle-trajectories.json` crowd/crowd_up区域；约`557700–563300`：视口创建/销毁、随机朝向/idle。|
| 05-D-3 | hazmat、bug群 | 约`330174`：bug-area十只wander；约`332097`：hazmat八人循环路线。|
| 05-D-4 | protesters_rising | trajectory region 87（约`1672..1896,1096..1304`）；约`564770–568000`：最多30、视口回收、随机转向与口号气泡。|
| 05-D-5 | ghost×5 | 约`228200–235500`：随机寻路，仅黑暗、玩家在区域且视口内激活；手电方向淡隐。|
| 05-D-6 | reading/eating/licking cat | 约`546761`：固定tile `(72,53)`/`(54,63)`/`(12,106)`，视口创建/回收。|
| 05-D-7 | dancing NPC×8、rat attack×40 | 约`549787`：舞者区域`(114..131,100..102)`；鼠群中心`(40,12)`，逃离后文字回调。|
| 05-D-8 | birds | 约`545709`：随机5只和一只固定循环鸟，速度30..50/25。|

## 仅静态资源或未知（不授权实现）

**UNKNOWN**：`npc-scientist*`、`npc-monk`、`npc-cat*`、`npc-dog*`、`npc-bug2`、`npc-dj1/2`、`npc-helicopter*`、lizard/rabbit/snake/fish/duck/butterfly 仅有 preload/资源证据，尚无完整场景创建链。helicopter、monster可见入口同样未知。`ai-transparent/2`是抗议者附属透明 sprite，不是独立人物。

## 当前覆盖差距

本报告形成后，integration worktree已增加route/static/venue/bug/dancing/special等candidate，但第三轮整体Human视觉失败；具体覆盖和正确性必须由`WI-SYS-NPC-SPECIAL-001`重新逐owner审计。ghost、rat attack、birds仍未实施；车辆不纳入NPC，继续属于SYS-ROUTE。

## 后续入口

本盘点作为历史来源输入保留，不再单独决定05-D实施顺序。当前只读审计和后续Human Gate统一见`task-todos/WI-SYS-NPC-SPECIAL-001-NPC专项.md`。
