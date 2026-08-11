---
title: 图层与遮挡：24层怎样显示和清理（SYS-LAYER）
type: system-detail
status: approved
version: v0.2
node-id: SYS-LAYER
node-type: 系统
parent-ref: SYS-WORLD
scope-disposition: in-scope
understanding-status: partial
engineering-status: designed
source-refs:
  - CAP-LAYER-001
  - CAP-MAP-001
  - BASE-LAYER-001
  - BASE-ROOF-001
  - BASE-BRIDGE-001
  - BASE-PARTICLE-001
  - BASE-FOOTSTEP-001
  - Q-LAYER-001
  - Q-LAYER-002
decision-refs:
  - DEC-SYS-WORLD-LAYER-INVESTIGATION-001
  - DEC-SYS-WORLD-LAYER-DESIGN-001
decision-status: accepted
main-definition: true
updated: 2026-08-11
---

<a id="SYS-LAYER"></a>

# 图层与遮挡：24层怎样显示和清理（SYS-LAYER）

> **一句话：24层使用一张完整策略表；每层明确是视觉层、碰撞层还是marker数据，并统一规定写入、清除、depth和动态状态。**

> 本文是`SYS-LAYER`唯一主定义，所列重构方案均为`DECISION（accepted）`。详细设计已接受，但不自动授权正式代码。

调查依据：[[图层与遮挡：从原站查到了什么（SYS-LAYER 调查记录）]]。

## 1. 需求依据

- FACT：25个chunk和两份整图均包含同顺序24层；
- FACT：发布Bundle覆盖了基础层、walls、cars、roof、bridge和部分particles，但优化写入固定22层、卸载只清11层；
- FACT：地图visible会被运行时代码覆盖；
- FACT：玩家depth动态变化，桥、怪物和龙卷风会覆盖常态depth；
- FACT：footsteps grid与footsteps tilelayer位置完全一致；
- FACT：1280×720公开运行补证已验证layer8遮挡、roof淡隐、bridge切换和footsteps生成；
- UNKNOWN：particles3 marker到trajectory消费者的直接链路，以及特殊13层为何不随原站chunk卸载；
- 项目约束：不能只实现11层却宣称24层完成，也不能把未来可能复用当作当前抽象理由。

## 2. 负责与不负责（DECISION，accepted）

### 负责

1. 为24个已知层提供唯一、无遗漏的策略；
2. 定义每层使用哪个tileset、是否直接渲染、depth、可见性和碰撞；
3. 将chunk layer数据转换成视觉网格、碰撞网格或marker数据；
4. 定义每层随chunk写入、清除和失败回滚的行为；
5. 保存roof/bridge等运行时动态层状态，并将状态应用到图层实例；
6. 向验证暴露24层覆盖和未知层/GID诊断。

### 不负责

- 不决定需要哪些chunk或何时请求；
- 不创建全局Tilemap或拥有世界生命周期；
- 不实现车辆、粒子、脚印等消费者的完整业务；
- 不定义玩家移动、相机或区域触发系统；
- 不提前拆出通用图层框架。

## 3. 24层策略（DECISION，accepted）

| 层 | 分类 | 运行时可见 | depth设计默认 | chunk移除 | 输出 |
|---|---|---|---:|---|---|
| layer1–5 | 静态视觉层 | 是 | 100–500 | 清除tile | exterior视觉网格 |
| layer6–10 | 玩家上方视觉层 | 是 | 1500–1900 | 清除tile | exterior视觉网格 |
| walls | 隐藏碰撞层 | 否 | 550，仅诊断 | 清除tile并重算碰撞 | 碰撞网格与特殊格查询 |
| cars | 隐藏marker层 | 否 | 550，仅诊断 | 撤销该chunk marker | 车辆marker集合 |
| 四个roof | 动态遮挡视觉层 | 是 | 3000–3300 | 清除tile并撤销动态状态引用 | roof视觉网格与分组句柄 |
| 四个bridge wall | 动态碰撞/遮挡层 | 按桥状态 | 3500 | 清除tile、碰撞和分组引用 | 上下层碰撞/视觉句柄 |
| particles | marker数据层 | 不直接显示raw tile | 未定 | 撤销该chunk marker | particle marker集合 |
| particles2 | marker数据层 | 不直接显示raw tile | 未定 | 撤销该chunk marker | particle marker集合 |
| particles3 | marker数据层，消费者未知 | 不直接显示raw tile | 未定 | 撤销该chunk marker | 保留69361 marker并报告未接消费者 |
| footsteps | marker数据层 | 否 | 不适用 | 撤销该chunk marker | 布尔脚印区域 |

说明：

- 第一版采用发布初始创建的layer6–10 depth 1500–1900作为设计默认，不采用只在“缺层补建”分支出现的1100–1500；该默认已由`BASE-LAYER-001`的桌面运行补证验证；
- hidden marker层不等于丢弃数据；它们必须进入明确消费者或保留为可诊断未消费状态；
- 第一版不复制“特殊13层永不卸载”的发布代码表现；所有来源于chunk的数据都必须有对称移除策略；
- roof/bridge目前作为SYS-LAYER内部子能力，不因名称特殊就提前建立独立系统。

## 4. 图层策略数据（DECISION，accepted）

每个策略至少表达：

```text
name
sourceTileset
role: visual | collision | marker | dynamic-visual | dynamic-collision
renderRawTiles
initialVisibility
depthPolicy
gidFilterOrMapping
onChunkApply
onChunkRemove
collisionPolicy
dynamicGroup
unknownHandling
```

这是一份逻辑合同，不要求第一版建立通用注册框架。实现可以先用一个本项目内的明确表完成。

## 5. 写入与清除（DECISION，accepted）

### 写入

1. 输入chunk必须恰好含24层且名称、顺序、28×28尺寸正确；
2. 每层先执行GID校验和转换，不直接把未知GID写入世界；
3. 视觉/碰撞层形成28×28可写网格；
4. marker层形成带世界坐标和chunk来源的marker集合；
5. 所有层转换成功后交SYS-WORLD统一提交；
6. 任一层失败则本chunk整体失败，不静默跳过该层后报告成功。

### 清除

1. 视觉和碰撞层清除对应28×28区域；
2. marker层按chunk来源撤销；
3. roof/bridge清除图层数据并断开本chunk动态引用；
4. walls和bridge碰撞区域重新计算；
5. 重复清除必须安全，不遗留半个chunk状态。

## 6. 动态遮挡（DECISION，accepted）

### 玩家depth

常态使用与原站相同性质的Y排序规则，而不是每帧写死固定depth：

```text
playerDepth = base + footY * scale
```

第一版默认以发布常态公式`500 + (y + 24) * 0.1`为行为参考。桥上、剧情抓取等覆盖必须通过显式状态进入和退出，退出后恢复常态计算，禁止多个系统无所有权地直接覆盖。

### roof

SYS-LAYER拥有roof分组句柄和当前alpha状态；“玩家是否进入区域”的判定可以来自后续区域能力，但图层系统负责幂等应用显示/淡隐结果。第一版保留Bundle的300ms行为参数；`BASE-ROOF-001`已验证进入淡隐与离开恢复结果。

### bridge

SYS-LAYER保存每座桥当前上下状态，并以一次状态切换同时更新：

- 上/下图层可见性；
- 对应tile碰撞；
- 必要的玩家depth覆盖请求。

桥状态来源和玩家移动规则不归图层系统。

## 7. markers与重复数据（DECISION，accepted）

- cars、particles和footsteps数据先保留在SYS-LAYER提供的marker视图中；具体消费者后续按实际实现归属；
- footsteps tilelayer与`footsteps-layer.json`位置完全一致。第一版建议以chunk中的footsteps层作为运行来源，外部grid只做一致性Oracle，不维护两份可变运行状态；
- particles三层与`particle-trajectories.json`只有有限关联。不得根据不完整映射自动生成轨迹；轨迹JSON继续作为独立资源输入，tile marker保留用于验证或未识别消费者；
- particles3没有消费者时必须报告为未消费，不得静默删除后宣称完成。

## 8. 失败与诊断（DECISION，accepted）

| 条件 | 结果 |
|---|---|
| 缺少任一已知层 | chunk转换失败，列出缺失层 |
| 出现未知层 | 默认失败并记录名称；Human接受兼容策略前不忽略 |
| GID不属于允许tileset或策略 | 记录层名、坐标和GID；本chunk不提交 |
| marker消费者尚未实现 | 数据保留并标记未消费，不误报功能完成 |
| 动态状态指向已移除chunk | 撤销引用并恢复安全默认状态 |
| 清除或碰撞重算失败 | 世界不删除已渲染标记，进入可定位失败状态 |

## 9. 代价与风险

- 24层全部显式建模比只处理11层工作量更高，但避免长期隐藏缺口；
- 使用chunk中的footsteps可减少一份运行状态，但与原站加载独立grid的内部方式不同，需要行为验证；
- particles消费者仍未知，第一版可能只能保留marker和明确未完成状态；
- layer6–10、roof、bridge和footsteps已获得桌面运行证据，但移动视口和自然长路径仍不在本轮覆盖；
- roof和bridge若后续出现独立复杂生命周期，再根据真实实现考虑拆节点，当前不提前拆。

## 10. 已接受决定

1. 24层策略表作为唯一图层合同；
2. 所有chunk来源层都具有对称移除，不照搬特殊13层不清除；
3. layer6–10第一版使用1500–1900设计默认；桌面视觉证据已通过；
4. footsteps以chunk tilelayer为运行来源，外部grid只作Oracle；
5. particles3在消费者未知时保留marker并明确未完成；
6. 已完成有边界原站视觉补证并关闭`Q-LAYER-001`；particles3直连问题转入`Q-LAYER-002`。

## 11. 当前状态

- 调查：24层数据和主要静态调用链已建立；
- 未知：`Q-LAYER-001`已关闭；`Q-LAYER-002`继续open；
- 设计：`accepted`；
- 节点：`designed`；
- 实现：未授权；
- 复用观察：未发现。
