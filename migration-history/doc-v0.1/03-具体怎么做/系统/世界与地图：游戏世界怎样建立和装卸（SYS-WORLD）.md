---
title: 世界与地图：游戏世界怎样建立和装卸（SYS-WORLD）
type: system-detail
status: approved
version: v0.2
node-id: SYS-WORLD
node-type: 系统
parent-ref: GRP-WORLD
scope-disposition: in-scope
understanding-status: partial
engineering-status: designed
source-refs:
  - CAP-MAP-001
  - CAP-LAYER-001
decision-refs:
  - DEC-SYS-WORLD-LAYER-INVESTIGATION-001
  - DEC-SYS-WORLD-LAYER-DESIGN-001
decision-status: accepted
main-definition: true
updated: 2026-08-11
---

<a id="SYS-WORLD"></a>

# 世界与地图：游戏世界怎样建立和装卸（SYS-WORLD）

> **一句话：世界系统拥有一个全局Tilemap和图层实例，使用master与chunk作为正式数据来源，并向分块系统提供可回滚的写入、清除和销毁能力。**

> 本文是`SYS-WORLD`唯一主定义，所列重构方案均为`DECISION（accepted）`。详细设计已接受，但不自动授权正式代码。

调查依据：[[世界与地图：从原站查到了什么（SYS-WORLD 调查记录）]]。

## 1. 需求依据

- FACT：master、25个chunk和整图表达同一张140×140、24层世界；
- FACT：发布Bundle先建立空Tilemap，再写入地图数据；
- FACT：SYS-CHUNK正式设计已将目标集合、请求数据和场景渲染状态分开；
- FACT：发布优化路径使用完整整图；普通fallback按chunk区域但只写`layer1`，两条不完整对称的路径并存；
- UNKNOWN：特殊13层不卸载和缺少显式统一teardown是否为有意策略；
- 项目约束：先实现最小、可验证的原站复刻，不提前建立通用地图引擎。

## 2. 负责与不负责（DECISION，accepted）

### 负责

1. 根据已经验证的master建立全局Tilemap坐标空间；
2. 持有Tilemap、tileset句柄和全部运行时图层实例的生命周期；
3. 使用SYS-LAYER提供的24层策略写入或清除一个chunk区域；
4. 维护“已经完整写入世界”的chunk集合；
5. 对创建、部分写入失败和销毁执行一致回滚；
6. 向SYS-CHUNK返回明确的写入、清除或失败结果。

### 不负责

- 不计算玩家或相机需要哪些chunk；
- 不请求JSON、texture或tileset；
- 不定义各层depth、碰撞、roof、bridge、cars或particles语义；
- 不定义玩家、相机、NPC或车辆行为；
- 不抽象成跨项目通用Tilemap引擎。

## 3. 状态所有权（DECISION，accepted）

| 状态 | 唯一拥有者 | 说明 |
|---|---|---|
| WorldSpec | SYS-WORLD | 从已验证master得到的宽高、tile尺寸和chunk尺寸；创建后只读 |
| Tilemap与tileset句柄 | SYS-WORLD | 创建成功后统一持有，销毁后不可访问 |
| 运行时图层实例 | SYS-WORLD | 按SYS-LAYER策略创建；实例生命周期跟随世界 |
| 图层策略 | SYS-LAYER | 世界只消费，不自行硬编码语义 |
| 已完整写入世界的chunk集合 | SYS-WORLD中的WorldRenderer职责 | 只有24层策略均成功处理后才能登记 |
| 原始master/chunk JSON与在途请求 | SYS-CHUNK | 世界只接收已验证数据，不拥有网络状态 |
| 动态roof/bridge等图层状态 | SYS-LAYER | 世界保存实例，但不决定业务切换规则 |

这些是职责名称，不预先要求每行对应独立类或目录。

## 4. 数据来源选择（DECISION，accepted）

第一版正式实现建议：

```text
master + chunk JSON = 唯一运行数据来源
final_map.json / final_map_small.json = 证据Oracle和兼容验证材料
```

不照搬发布Bundle“默认优化路径在单块回调中重复读取完整整图”的结构。

理由：

- 25个chunk已证明可无损重建整图；
- 已实现的SYS-CHUNK CORE和后续动态装卸都以chunk坐标为边界；
- 同时维护整图与chunk两条运行写入路径会增加状态分叉和失败面；
- tileset图片优化可以以后独立保留，不要求用完整整图作为运行数据源。

代价：第一版不会逐字复刻发布Bundle的整图优化写法；需要用行为验证证明可见结果一致。

## 5. 概念接口（DECISION，accepted）

```text
createWorld(worldSpec, worldResources, layerPlan)
  -> WorldReady | WorldCreateFailure

applyChunk(coord, validatedChunk)
  -> Applied | AlreadyApplied | ChunkApplyFailure

removeChunk(coord)
  -> Removed | AlreadyAbsent | ChunkRemoveFailure

destroyWorld()
  -> idempotent completion
```

接口名称仅表达能力，不指定TypeScript文件、类或公共库。

### `createWorld`

1. 先校验worldSpec、必要资源和24层策略完整性；
2. 创建Tilemap和tileset句柄；
3. 按固定策略创建所有运行时图层；
4. 全部成功后才发布ready句柄；
5. 任一步失败则销毁已经创建的实例，并返回可定位错误。

### `applyChunk`

1. 校验坐标、28×28尺寸、24层名称和data长度；
2. 先由SYS-LAYER把24层转换成可写网格或marker结果；
3. 所有转换成功后才修改Tilemap；
4. 任一写入失败时清除本次坐标的所有chunk-local层和marker登记；
5. 只有完整成功才加入已渲染集合。

### `removeChunk`

1. 对所有被定义为chunk-local的24层策略执行清除或marker撤销；
2. 重新计算受影响碰撞区域；
3. 完成后删除已渲染标记；
4. 重复删除返回AlreadyAbsent，不制造错误状态。

## 6. 生命周期（DECISION，accepted）

```text
uninitialized
  -> creating
  -> ready
  -> destroying
  -> destroyed

creating / ready
  -> failed
  -> destroying
  -> destroyed
```

- 非`ready`状态拒绝写入；
- destroy可重复调用；
- 世界销毁先禁止新写入，再取消本系统自己安排的任务，断开碰撞与监听，最后销毁图层和Tilemap；
- SYS-CHUNK的晚到请求结果必须在进入世界前检查自身销毁与目标状态；SYS-WORLD不承担HTTP取消；
- 第一版不使用未保存句柄的idle callback进行关键写入。

## 7. 与SYS-LAYER和SYS-CHUNK的接力

```text
SYS-CHUNK：决定目标坐标并取得validatedChunk
         ↓
SYS-LAYER：按名称提供24层处理策略
         ↓
SYS-WORLD：原子写入/清除世界并返回结果
         ↓
SYS-CHUNK：根据结果更新协调状态和失败记录
```

世界不得自行重新计算目标集合；分块不得直接绕过图层策略操作Tilemap。

## 8. 失败与风险

| 风险 | 建议处理 |
|---|---|
| 24层写到一半失败 | 清除当前坐标全部chunk-local结果，不登记已渲染 |
| 资源缺失 | 创建阶段失败，不发布半成品世界 |
| 晚到回调写入已销毁世界 | 世界状态拒绝；协调器也必须先检查自身状态 |
| 图层策略缺失 | 创建前阻塞，不静默忽略未知层 |
| 特殊13层是否全局持久仍未知 | 第一版按显式策略处理；未经接受不得复制发布Bundle遗漏清除行为 |
| Phaser隐式销毁行为不清 | 正式实现必须用显式测试证明，无证据时不依赖隐式行为 |

## 9. 已接受决定

1. master+chunk作为第一版唯一运行数据来源；
2. SYS-WORLD拥有Tilemap、图层实例和已渲染集合；
3. 24层先完整转换，再写入并在失败时回滚当前chunk；
4. 不照搬发布Bundle的完整整图优化写入；
5. 世界生命周期边界先成为正式设计，`Q-LAYER-001`的视觉未知继续保留并单独补证。

## 10. 当前状态

- 调查：已形成可定位静态证据；
- 设计：`accepted`；
- 节点：`designed`；
- 实现：未授权；
- 复用观察：未发现。
