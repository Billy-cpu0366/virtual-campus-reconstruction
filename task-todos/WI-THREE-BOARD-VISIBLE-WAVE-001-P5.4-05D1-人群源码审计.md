---
type: source-audit
status: audit-complete-awaiting-human-plan-gate
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
route: systemic-flow
updated: 2026-08-24
---

# 05-D-1 人群公开源码审计

## 结论

此前候选把绝大多数群众都错误建模成路线人。公开实现至少有四类互不等价的人群 owner：路径 CrowdManager、区域随机静态群众、演唱会/抗议专属群众、明确 special NPC；火车乘客只是路径 CrowdManager 的一次性事件组。不能用截图中的固定像素坐标替代区域随机布点，也不能继续用一个路线系统替代所有场所人群。

## 统一差异表

| 差异 | 公开事实 | 当前候选实际 | 根因 | 修复包 |
|---|---|---|---|---|
| 到点消失 | 非 `goBack` 路线群完成后可重生/删除；区域静态群众不走路线 | 场所人群被塞入 8 个路线组 | 把不同 owner 混为路线人 | A 人口生命周期 |
| 一群同步走 | 路线有独立起止/延迟/随机路径；静态/场所群有独立随机布点与最小间距 | 路线组承担了本应静态的视觉密度 | 场所语义缺失 | A + C 场所语义 |
| 火车站与餐车等地无人留驻 | `crowd` / `crowd_up` region 进入扩展视口时随机生成，离开时回收；不是固定 sprite | 仅实现 3 个 special NPC | 未实现区域静态群众 owner | A |
| 火车离站人口不符 Human 观察 | Bundle 的 `crowd-train` 为 `npcCount:10`，22 个只是起点候选；其视觉表现与 Human 观察存在冲突 | 当前也为 10 人 | 公开代码与 Human 观察需并列保留，不可擅自改成 2 | B 路线与火车（先做证据对照 Gate） |

## FACT：公开人群清单

### 1. CrowdManager 路径组

来源：`sample/original-public-build/mirror/chunk-WMFY56ZM.js`，唯一串 `this.registerCrowd({crowdId:`（压缩为单行，约 byte 328000）。常规启动配置共 11 组：

- `main-crowd` 10、`loop-crowd` 10、`drinkers` 5、`concert_crowd` 40；
- `beach_crowd_walk` 4、`bug-area` 10（随机游走）、`vertical-crowd` 10、`vertical-crowd-reverse` 10；
- `walking-crowd` 8、`hazmat-crowd` 8、`outside_concert1` 10。

`test-crowd` 只在 `startTestCrowd()` 调试路径内发现，未发现正常业务调用，不纳入正常人口。路径精灵只在路径与镜头相交时创建，离开时销毁；这不是角色逻辑停止。

### 2. 火车乘客

来源：同 Bundle，唯一串 `spawnTrainPassengers(){`（约 byte 445171）和 `crowdId:"crowd-train"`。`npcCount:10` 是公开事实；tile `(63..84,19)` 是 22 个起点候选，终点候选为 6 个。列车离站生成该组并暂停 `loop-crowd`，列车离开视口后恢复。Human 的“两人左右离开”是待解释的视觉观察，不能在没有更直接证据前改写此 FACT。

### 3. 区域随机静态群众

来源：`sample/original-public-build/mirror/assets/maps/particle-trajectories.json` 与 Bundle `initCrowdStaticNPCs(){`（约 byte 558928）、`updateCrowdStaticNPCs(){`（约 byte 560743）。JSON 共 88 个 regions：

- 25 个 `crowd`；21 个 `crowd_up`；3 个 `concert`；1 个 `protesters_rising`；其余为 water/fog。
- `crowd` / `crowd_up` 在 region polygon 内随机布点、随机选择普通人物贴图，并保持最小间距；进入扩展视口才创建，离开时回收。
- 有明确 ID 的区域包括 `station_static_crowd`（region 29，首点 `(1160,264)`）、`protest_zone`（40，`(1848,1112)`）、`football_team_blue`（51，`(2120,1880)`）、`beach_crowd`（52 与 74，`(1512,1912)`）和 `football_team_red`（53，`(2024,2104)`）。其余无业务名，只能按 region 序号/polygon 定位。

这类群体解释了火车站、餐车、店面与其他多个场所的持续人口：角色不是固定名单或固定像素，而是场所区域内的稳定随机分布。

### 4. 专属场所群众与 special

- `concert`：3 个 region，区域随机布点、最小间距 18px、镜头内随机转向/舞动；来源 `initConcertNPCs(){` 约 byte 572712。
- `protesters_rising`：1 个 region，30 人随机布点、最小间距 20px、循环行走；来源 `initProtestersRisingNPCs(){` 约 byte 564770。
- 舞者：8 人，有独立贴图和编队动作；来源 `createDancingNPCs(){` 约 byte 549787。
- special：reading `(72,53)`、eating `(54,63)`、cat licking `(12,106)` 与 4 个 sprayer；来源 `createNPCSpecials(){` 约 byte 546761。

## 仍未解决

- 无 ID 的 41 个 `crowd`/`crowd_up` region 没有公开业务名称；不得按截图擅自命名。
- Bundle 未提供固定随机 seed，因此截图里的精确人物、坐标、朝向、同时可见人数不是可冻结 FACT。
- Human 所见“火车开走只出现两名离站者”与 Bundle `npcCount:10` 冲突。需重放原站该事件并记录真实镜头/时序，或由 Human 明确选择重构目标；不能直接把 10 改成 2。

## 第二轮 Human 视觉失败差异（2026-08-25）

| 差异 | 图片证据 | 公开 FACT | 当前根因 | 修复包 |
|---|---|---|---|---|
| 人站在火车轨道 | `df724b414485dca1fd44dbf8717c0dc1.png`、`0003f3637cebc56df5a1da1b7a069f5c.png` | crowd 位置来自公开 polygon/路径；没有把轨道作为 crowd 可站区域的证据 | 当前区域与路线 owner 未有铁路禁站过滤 | A 位置合法性 |
| 路线排队 | `6fccdec09aab0200f90948a1651e23b6.png` | Bundle 的 `visualOffset` 有消费者；`main-crowd` 为16px，其他常见为8px（约 byte 328491） | 当前渲染将逻辑路径坐标直接用于 sprite，遗漏视觉偏移 | B 路线分散 |
| 聚集人群静止且多背对 | `6fccdec09aab0200f90948a1651e23b6.png` | `crowd_up` 只取方向[3,4,5]；`station_static_crowd`取[0,1,2,6,7]；其他区域可取完整方向，并每秒触发随机 look-around（约 byte 560363） | 当前静态 crowd 只分 up/down，且无 look-around/特殊 idle | C 场所姿态 |

**修复包边界（待 Human Gate）**：

A. 在所有 crowd owner 的最终 position/路径候选上使用公开地图可走区域与铁路禁站掩码；不改火车路线或地图。

B. 将公开 `visualOffset` 加入 RouteCrowdConfig 与 Phaser presentation；偏移只改变 sprite 显示，不改变逻辑路径、碰撞或火车等待。

C. 按 Bundle 的区域方向池初始化静态 crowd，并以1秒节拍做可复放 look-around；只对已有普通 spritesheet 应用公开 walk 首帧/已证实 idle，不猜新动作。

## 建议的整体修复包（等待 Human Gate）

A. **人口生命周期**：按 region polygon 生成 seeded、最小间距的静态群众；视口只管理 sprite，不停止其逻辑。范围包括所有 46 个 `crowd`/`crowd_up` region，不建立通用 Entity 框架。

B. **路径与火车**：补全 11 个公开常规路径组，火车组与 `loop-crowd` 协同保持独立；先解决 10 人 FACT 与两人视觉观察的冲突。

C. **专属场所行为**：独立接入 concert、protesters_rising、舞者和已证实 special；不把它们降级成普通路线人。

验收必须按区域截图与行为重放：站台/餐车/店面等静态密度、路径群分散、火车事件、concert/protest/舞者和 special。对象计数不能代替视觉验收。
