---
work-item: WI-SYS-NPC-SPECIAL-001
type: evidence-contract
system: SYS-NPC
batch: B0
status: completed-read-only
decision: DEC-SYS-NPC-PHASE-A-001
public-evidence: sample/original-public-build/mirror/chunk-WMFY56ZM.js
candidate-head: ea8751260984fa6ef5e4589c2fbf196a6b28aa8c
updated: 2026-08-25
---

# SYS-NPC B0 证据与合同收口

> B0只读公开Bundle、地图JSON和失败candidate。它关闭机制问题，不授权实现，也不能把静态调用链代替正常产品运行证据。

## 1. B0完成结论

| B0问题 | 结论 | 状态 |
|---|---|---|
| 正常`startGame`是否进入火车和乘客链 | `startGame→crowdTrain→5秒到站→3秒等待→departTrain→spawnTrainPassengers`直接成立 | FACT，关闭 |
| `crowd-train`公开合同 | 22起点、6终点、目标10、speed35、variation.2、one-way/delete、beforeDelay2400、maxActive10 | FACT，关闭 |
| train与`loop-crowd`关系 | 离站先生成乘客并暂停loop；火车离开相机阈值或完成后恢复；碰撞与sprite清理 | FACT，关闭 |
| 公开route计算 | `walls-layer` 0/1 grid→Blob Worker→seeded 8向A*；worker失败回退EasyStar；成功路径数限制实际实例数 | FACT，关闭 |
| candidate是否与公开worker等价 | `ea87512`为主线程增量A*，另加blocked endpoint吸附、轨道显示位移和自定义presentation | DECISION差异，关闭“等价”误报 |
| 原站铁路禁站/allowed mask | 未找到rail polygon、tile ID、allowed/blocked mask或直接数据流；只证实动态火车占格阻挡 | UNKNOWN，继续open |
| rat机制 | 40只、中心`(40,12)`、8向BFS、玩家<80触发逃跑、>200重置、局部fade/destroy | FACT，机制关闭 |
| ghost机制 | 默认5、walls grid、dark+玩家区域+viewport三重激活、flashlight淡隐、类内destroy | FACT，机制关闭 |
| birds机制 | 5只区域随机+1只固定waypoint、速度30..50/25、视口保存/销毁/重建 | FACT，机制关闭 |
| rat/ghost/birds正常产品入口 | 三者静态caller都在`startCameraSequence()`；六点序列真实产品触发仍由`Q-CAMERA-ENTRY-001`保持UNKNOWN | UNKNOWN，阻塞对应产品实现 |
| 三者完整scene teardown | 只见类内/对象destroy，未找到scene shutdown直接owner收据 | UNKNOWN，继续open |
| 失败candidate覆盖 | `src/npc`、`game`、`tests/npc`和probe没有这三类owner | FACT，none |

## 2. Train 与 route 公开合同

### 2.1 正常入口和离站链

- **FACT**：Bundle约byte 415178的`startGame()`创建玩家后直接调用`crowdTrain()`。
- **FACT**：约byte 444082的`crowdTrain()`从`(2480,310)`用5000ms进入`x=480`；到站后完成intro、开放控制，并延迟3000ms调用`departTrain()`。
- **FACT**：`departTrain()`先调用`spawnTrainPassengers()`，暂停`loop-crowd`，再用9000ms离场；达到相机左侧阈值或完成时恢复loop并清火车碰撞/sprite。
- **FACT**：`spawnTrainPassengers()`配置22个`x=63..84,y=19`起点、6个终点、`npcCount=10`、speed35、variation.2、`randomPositions=false`、`beforeDelay=2400`。
- **FACT**：10是目标上限，不是任意一帧保证可见10人；实际实例取`min(npcCount, successfulPaths.length)`。

### 2.2 Route worker

- **FACT**：Bundle加载`walls-layer.json`并把140×140的0/1 grid发给inline Blob Worker。
- **FACT**：worker使用8方向A*、octile heuristic、正交1/斜向1.41、禁止斜穿墙角、seeded cost noise、50000迭代上限；异常回退EasyStar。
- **FACT**：候选数上限为`min(npcCount*3,startCount*endCount)`；成功路径打乱后选用，NPC可从非终点随机waypoint起步。
- **FACT**：动态火车占格进入`trainBlockingCells`，NPC下一格命中时等待；这是移动火车避让，不是静态铁路禁站。
- **UNKNOWN**：`walls-layer`只有width/height/grid，无rail语义；公开Bundle未找到静态轨道mask。

### 2.3 与失败candidate的边界

- **DECISION**：`src/npc/gridPathProvider.ts`采用主线程每步512迭代A*；不是Blob Worker。
- **DECISION**：candidate允许blocked endpoint并在半径4内吸附最近walkable tile；公开worker没有同等行为。
- **DECISION**：`PhaserRouteCrowdRuntime.keepOrdinaryCrowdOffTrack`只在显示层把普通route NPC移出硬编码轨道带；没有改变逻辑路径，也没有公开FACT支持。
- **结论**：B2可以使用公开配置/事件/路径合同，但铁路策略必须先作为产品DECISION明确，不能把candidate位移称为原站复刻。

## 3. Rat attack合同

1. **配置/资源**：60×60 rat，8方向动画；中心tile`(40,12)`、40只、depth500、scale.7。
2. **激活/数量**：constructor建立三圈`10+14+16`；camera+200内materialize。
3. **身份/位置**：index驱动角度、半径、nibble phase和hide target，非每次随机布点。
4. **路径/动作**：`walls-layer` 0-cell上的8邻域BFS，禁止斜穿墙角；速度90..160；eating有nibble位移。
5. **触发/接口**：玩家距中心`<80px`进入fleeing并触发一次pizza文本回调；全hidden且玩家`>200px`才reset。
6. **生命周期**：离开camera+200且非fleeing时reset并销毁presentation；fleeing扩大视口半径。
7. **完成/清理**：progress>.85开始300ms fade；到1后hidden；类`destroy()`清sprites和数组。scene shutdown caller UNKNOWN。
8. **覆盖**：失败candidate无core、Phaser、Main、test或probe。

## 4. Ghost合同

1. **配置/资源**：84×84、8方向单帧动画，rectangle tile`109,7..136,18`，默认5、depth600。
2. **出生/数量**：`startCameraSequence`延迟1800ms构造；区域内按子区随机找0-cell，最多50次。
3. **路径/速度**：每只`8+index*2`个随机路径点；8方向40–100px，8px采样检查walls；速度30–50。
4. **激活**：玩家在ghost bounds、bounds与camera+100相交、darkness alpha≥.5同时成立；teleport时deactivate。
5. **动作**：active时订阅update；按方向动画和`depth=600+y`；玩家面向70px/60°flashlight cone时200ms淡到0，离开300ms恢复.6。
6. **生命周期**：deactivate仅隐藏并off update，不自然完成。
7. **清理**：类`destroy()`清100ms event、update、tween、sprites；scene shutdown caller UNKNOWN。
8. **覆盖**：失败candidate无core、Phaser、Main、test或probe。

## 5. Birds合同

1. **配置/资源**：32×32 frames0..11，depth3400、scale1、ignorePlayerDepth。
2. **数量/调用**：`startCameraSequence`延迟5500ms调用；5个area随机配置加1个固定waypoint配置。
3. **位置/身份**：area为tile`58..114,118..139`，精确位置随机；固定鸟路径`(68,121)→(63,124)→(68,128)→(74,123)→(68,121)`。
4. **速度/动作**：area五只速度30/35/40/45/50，固定鸟25；按主轴播放四方向flight动画。
5. **生命周期**：每500ms检查；camera+100外destroy并保存位置/waypoint index，current position进入camera+200后重建。
6. **接口**：相机、texture/animation和moving sprite config；不依赖player或walls。
7. **清理**：MovingSprite.destroy清idle timer/debug并保存状态；scene-level config/timer总清理UNKNOWN。
8. **覆盖**：失败candidate无core、Phaser、Main、test或probe。

## 6. 更新后的六状态与阻塞

| Owner | 资源 | 创建链 | 正常入口 | candidate | 自动 | Human | B0后处理 |
|---|---|---|---|---|---|---|---|
| train passengers | FACT | FACT | FACT：正常startGame离站链 | 有 | 历史有 | 整体失败 | B2可规划；铁路策略单独DECISION |
| rat | FACT | FACT | UNKNOWN：依赖六点序列 | 无 | 无 | 无 | B3 rat部分阻塞 |
| ghost | FACT | FACT | UNKNOWN：依赖六点序列 | 无 | 无 | 无 | B4阻塞 |
| birds | FACT | FACT | UNKNOWN：依赖六点序列 | 无 | 无 | 无 | B4阻塞 |

`Q-CAMERA-ENTRY-001`继续作为rat/ghost/birds产品范围阻塞；不另建重复入口问题。新增`Q-NPC-RAIL-001`和`Q-NPC-TEARDOWN-001`记录铁路策略与owner完整shutdown。

## 7. B0后的批次判断

- **B1 static + venue**：不依赖残余入口UNKNOWN；公开region、方向和动作机制及candidate差异已足够形成有界实现包，推荐进入下一Human授权Gate。
- **B2 route + train**：公开合同已收敛；铁路禁站只能作为Human产品DECISION，实施前必须明确不伪称FACT。
- **B3**：sprayer/fixed special/dancing可规划；rat部分仍被正常入口UNKNOWN阻塞，不能整批无条件实施。
- **B4**：ghost/birds保持blocked，直到`Q-CAMERA-ENTRY-001`有正常产品证据或Human明确作重构产品选择。
- **B5**：完整owner shutdown仍需统一收据，`Q-NPC-TEARDOWN-001`在联合关闭前必须解决。

## 8. 验证边界

本轮只做静态证据核对：公开Bundle调用链、JSON结构/计数、失败candidate clean `ea87512`与覆盖搜索。没有运行原站/当前产品、自动测试、build或Human视觉；因此正常入口和运行时结果仍按上表保留。
