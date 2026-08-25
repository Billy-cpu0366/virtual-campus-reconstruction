---
tags: [虚拟校园, 执行层, 系统卡]
system: SYS-NPC
status: designed
updated: 2026-08-23
---

# NPC 与环境实体（SYS-NPC）

## 👀 先看这里（人话总结，给 Human）

**P5.1 R4（bounded verified）**：`da68d08`保持四锚点、触发窗、300ms、速度140和路线FACT不变；sprayer presentation depth按`500+(y+24)*0.1`动态更新，train holding时四人可与player同屏辨识。train complete发布无teleport路径，真人键盘到约`(1280,416)`触发后切换factory提示；route完成与shutdown sprite/listener=0。

**SYS-NPC专项已启动（只读审计）**：Human确认第三轮群众candidate即使通过357项测试、build、性能/完整/群众production，视觉上仍有很多毛病；`ef9f004`、`70aefe4`、`76beaf0`、`ea87512`状态为automated-verified / human-visual-rejected并冻结为失败对照。`DEC-SYS-NPC-SPECIAL-001`要求先核对完整owner、公开机制、当前代码覆盖与统一差异，重写本卡七格主体；Human接受机制与分批计划前不再改NPC代码。

**仍未完成**：本卡主体当前仍以sprayer为主，尚未成为完整SYS-NPC合同；ghost、rat attack、birds等公开候选未实施，intro跨场景复位和完整跨chunk路线语义仍UNKNOWN。专项入口：`task-todos/WI-SYS-NPC-SPECIAL-001-NPC专项.md`。

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
