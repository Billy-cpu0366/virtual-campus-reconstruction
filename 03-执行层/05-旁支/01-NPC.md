---
tags: [虚拟校园, 执行层, 系统卡]
system: SYS-NPC
status: designed
updated: 2026-08-23
---

# NPC 与环境实体（SYS-NPC）

## 👀 先看这里（人话总结，给 Human）

**P5.1 R4（bounded verified）**：`da68d08`保持四锚点、触发窗、300ms、速度140和路线FACT不变；sprayer presentation depth按`500+(y+24)*0.1`动态更新，train holding时四人可与player同屏辨识。train complete发布无teleport路径，真人键盘到约`(1280,416)`触发后切换factory提示；route完成与shutdown sprite/listener=0。

**05-D-2 第三轮群众 candidate（自动验证通过，等待 Human 视觉验收）**：静态/venue群众按region级在镜头外预热并滞后回收，route群众按path bounds激活与alpha生命周期，不再按NPC单点跨镜头边界直接创建/销毁。路线使用公开8向A*、octile heuristic、seeded随机边成本和候选路径池；火车保留10人、22起点、6终点与2400ms，30条候选为10人分配唯一pathId。Stop AI固定约三分之一为可动作子集，每次短动作后idle 2–6秒，同时最多2人动作；其余稳定站立。`ef9f004`、`70aefe4`、`76beaf0`、`ea87512`已通过357项测试、build、性能smoke、完整production及群众production（静止镜头ID/spriteCount稳定、火车至少6种轨迹签名、抗议动作有界）；自动结果不代替Human视觉验收。

**仍未完成**：其余原站NPC、intro跨场景复位和完整跨chunk长路线语义；R4不等于完整SYS-NPC。

## 1. 逆向结论（从 sample 读出来的事实）

P1确认真实候选`npc-sprayer`：公开64×64喷洒资源、48×48跑步资源、四个锚点`(60,25)/(67,25)/(71,25)/(78,25)`及逃跑路线。idle NPC在玩家横向≤2 tile、纵向差0..2且intro完成时触发；最近者先跑，其余按距离每300ms启动，速度140。route完成或视口回收会销毁；NPC自身清tween/timer并退出active集合。

UNKNOWN：intro标记的跨场景复位、长路线穿过未加载chunk、完整scene teardown。主报告：`task-todos/WI-VISIBLE-SIDE-WAVE-001-P1-调查报告.md`。

## 2. 数据与约定

- 四公开配置为本轮唯一NPC范围；不扩成行人/怪物/通用NPC。
- 世界锚点属于场景特殊行为，不伪装成chunk tile owner。
- 生命周期：idle/spraying→fleeing→completed/destroyed；destroy幂等。
- Entity公共框架继续NO-GO。

## 3. 怎么做

旁支实现专属sprayer状态/适配器；world ready后按视口创建，entry control gate开放后允许触发。保留四锚点和300ms组行为；Main只接入owner，不复制NPC逻辑。

## 4. 失败怎么办

纹理缺失返回可诊断失败，不换猜测资源；构造/route失败销毁已创建对象。shutdown取消随机delay、级联timer和route tween，清集合；重复进入不得重复实例。

## 5. 接口接口

- 入←Main：world ready、playable/control gate、viewport、player position、shutdown。
- 出→Main：visible count、flee state、destroy receipt和failure。
- 不直接操作chunk cache、相机或玩家输入。

## 6. 怎样算做对

入口终态至少一名sprayer可见；玩家向row25短移触发四人300ms级联逃跑；至少一人沿公开路线完成并销毁。重复进入/shutdown无残留tween/timer/实例；Human肉眼验收通过。

## 7. 代码位置

P2实现包：`task-todos/WI-VISIBLE-SIDE-WAVE-001-P2-实现包.md`；群众审计：`task-todos/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.4-05D1-人群源码审计.md`。

当前candidate：`src/npc/routeCrowd.ts`、`src/npc/gridPathProvider.ts`、`src/npc/staticCrowd.ts`、`src/npc/venueCrowdRuntime.ts`；presentation：`game/PhaserRouteCrowdRuntime.ts`、`game/PhaserStaticCrowdRuntime.ts`、`game/PhaserVenueCrowdRuntime.ts`；验证：`tests/npc/**`与`scripts/browser-route-crowd-production.mjs`。

复用观察：route path与region lifecycle的触发、状态和回收语义仍不同，未发现第二个稳定共同合同，不提取通用Entity/crowd lifecycle框架；A*只保留既有`GridRouteCrowdPathProvider`这一真实多消费者能力。
