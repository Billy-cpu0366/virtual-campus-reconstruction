---
tags: [虚拟校园, 执行层, 系统卡]
system: SYS-NPC
status: designed
updated: 2026-08-22
---

# NPC 与环境实体（SYS-NPC）

## 👀 先看这里（人话总结，给 Human）

本轮先做出生点附近四个正在喷洒的NPC。玩家靠近后，最近的人先跑，其他人每隔300毫秒依次逃跑；跑完必须销毁。当前只是设计完成，代码尚未实现。

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

P2实现包：`task-todos/WI-VISIBLE-SIDE-WAVE-001-P2-实现包.md`；候选`src/npc/**`、新增专属Phaser适配器、`tests/npc/**`。
