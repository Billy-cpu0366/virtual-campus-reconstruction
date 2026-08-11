---
title: 图层与遮挡：从原站查到了什么（SYS-LAYER 调查记录）
type: system-reverse-engineering-dossier
status: draft
version: v0.1
node-id: SYS-LAYER
node-type: 系统
parent-ref: SYS-WORLD
scope-disposition: in-scope
understanding-status: partial
engineering-status: undesign
source-refs:
  - CAP-LAYER-001
  - CAP-MAP-001
  - Q-LAYER-001
decision-refs:
  - DEC-SYS-WORLD-LAYER-INVESTIGATION-001
main-definition: false
updated: 2026-08-11
---

# 图层与遮挡：从原站查到了什么（SYS-LAYER 调查记录）

> **一句话：地图文件有24层，但发布Bundle只对其中一部分明确创建、写入、碰撞或动态控制；文件里的visible并不等于最终运行时显示。**

> 本文是`WI-SYS-WORLD-LAYER-DESIGN-001`产生的调查工作稿，自身不改变节点状态，也不授权正式代码。当前正式设计见[[图层与遮挡：24层怎样显示和清理（SYS-LAYER）#SYS-LAYER]]。

## 1. 这次要弄清什么

1. 24层的完整名称、顺序和数据特征；
2. 哪些层被渲染、隐藏、用于碰撞或特殊行为；
3. depth、roof、bridge、cars、particles和footsteps已能证明什么；
4. `Q-LAYER-001`还缺哪些证据才能关闭。

世界创建和chunk写入/清除链路记录在[[世界与地图：从原站查到了什么（SYS-WORLD 调查记录）]]。

## 2. 证据定位

| 证据 | 可重复定位方式 | 用途 |
|---|---|---|
| 24层数据 | `sample/original-public-build/mirror/assets/maps/chunks/chunk0.json`至`chunk24.json` | 名称、顺序、可见字段、GID和数据量 |
| 整图对照 | `sample/original-public-build/mirror/assets/maps/final_map.json` | 140×140逐格一致性 |
| 优化整图 | 同目录`final_map_small.json` | 发布默认优化路径的22层处理输入 |
| 发布Bundle | `sample/original-public-build/mirror/chunk-WMFY56ZM.js` | 创建、depth、写入、碰撞、roof、bridge、cars和脚印行为 |
| 旧实现差距 | [[../../04-怎么验证与还差什么/原站和旧版本差在哪（证据与差距）]] 的`CAP-LAYER-001` | 旧版只创建11层的差距 |

Bundle搜索锚点：`let b=["layer1"`、`["layer1","layer2","layer3"`、`createBlankLayer("walls"`、`getLayer("cars")`、`initRoofAreas()`、`activateBridgeUpWall`、`footsteps-layer`、`unloadChunk(e,t)`。

## 3. 24层确定性清单（FACT）

25个chunk的层名、顺序、`tilelayer`类型、28×28尺寸和784项data完全一致。按行主序拼接后，24层与`final_map.json`的470400个格子逐格差异为0。

| # | 层名 | 地图visible / opacity | 非零tile | 非零GID范围 | 发布Bundle已定位处理 |
|---:|---|---|---:|---|---|
| 1 | layer1 | true / 1 | 19463 | 184–66751 | 创建、写入、卸载；初始depth 100 |
| 2 | layer2 | true / 1 | 5555 | 52–69216 | 创建、写入、卸载；初始depth 200 |
| 3 | layer3 | true / 1 | 3358 | 58–69357 | 创建、写入、卸载；初始depth 300 |
| 4 | layer4 | true / 1 | 1597 | 201–68512 | 创建、写入、卸载；初始depth 400 |
| 5 | layer5 | true / 1 | 461 | 1783–67177 | 创建、写入、卸载；初始depth 500 |
| 6 | layer6 | true / 1 | 1203 | 1458–67090 | 创建、写入、卸载；初始depth 1500 |
| 7 | layer7 | true / 1 | 2285 | 201–69345 | 创建、写入、卸载；初始depth 1600 |
| 8 | layer8 | true / 1 | 630 | 1164–68512 | 创建、写入、卸载；初始depth 1700 |
| 9 | layer9 | true / 1 | 220 | 1140–67181 | 创建、写入、卸载；初始depth 1800 |
| 10 | layer10 | true / 1 | 68 | 1255–58293 | 创建、写入、卸载；初始depth 1900 |
| 11 | cars | false / 1 | 623 | 69345–69351 | hidden、alpha .2、depth 550；交通扫描69350/69351 |
| 12 | roof_concert | false / 1 | 768 | 25211–47699 | 运行时创建为visible；depth 3200；区域淡隐 |
| 13 | roof_concert2 | false / 1 | 156 | 19143–64214 | 运行时创建为visible；depth 3300；区域淡隐 |
| 14 | roof_factory | false / 1 | 620 | 21040–47699 | 运行时创建为visible；depth 3000；区域淡隐 |
| 15 | roof_factory2 | false / 1 | 243 | 2137–59323 | 运行时创建为visible；depth 3100；区域淡隐 |
| 16 | bridge1_up_wall | false / 1 | 82 | 69345 | depth 3500；动态可见与逐tile碰撞 |
| 17 | bridge1_down_wall | false / 1 | 14 | 69345 | depth 3500；动态可见与逐tile碰撞 |
| 18 | bridge2_up_wall | false / 1 | 24 | 69345 | 优化路径可创建；depth 3500；动态可见与碰撞 |
| 19 | bridge2_down_wall | false / 1 | 16 | 69345 | 优化路径可创建；depth 3500；动态可见与碰撞 |
| 20 | walls | true / 0.84 | 8074 | 69345–69353 | 运行时hidden、depth 550；碰撞和特殊格查询 |
| 21 | particles | false / 1 | 2492 | 69355–69360 | 优化清单只接受69355–69359；可创建，无明确depth |
| 22 | particles2 | false / 1 | 746 | 69355–69360 | 优化清单只接受69355–69359；可创建，无明确depth |
| 23 | particles3 | false / 1 | 86 | 69361 | 未进入已定位创建、写入或卸载清单 |
| 24 | footsteps | false / 1 | 368 | 69345 | 未进入已定位tilelayer写入/卸载清单；另有独立脚印网格 |

所有层实际字段只包含`data/height/id/name/opacity/type/visible/width/x/y`；没有`properties`或offset字段。地图文件中的visible是发布数据字段，Bundle会主动覆盖多个层的运行时可见性，因此不能仅凭该字段判断最终显示。

## 4. 已证实运行规则（FACT）

### 4.1 基础层和depth

世界创建时先创建`layer1`至`layer10`并设为visible。初始创建代码的depth为：

```text
layer1–5  = 100, 200, 300, 400, 500
layer6–10 = 1500, 1600, 1700, 1800, 1900
```

`layer1`至`layer3`同时进入`groundLayers`和`coastLayers`集合。

优化写入函数在“图层尚不存在”分支里另有`layer6–10 = 1100…1500`的公式；正常初始创建已先建立这些层，因此发布代码中存在两套公式，但当前静态证据不能把次级公式当成最终运行depth。

### 4.2 walls

- 地图字段是visible、opacity 0.84；运行时创建后改为hidden、alpha 1、depth 550；
- 优化路径只保留碰撞tileset中的特定GID；
- `69345`被强制设为碰撞，`69346`被强制设为不碰撞；
- 发布代码还会按玩家世界坐标查询walls tile，用于桥梁、海滩等特殊判断；
- chunk卸载会清除walls对应28×28区域并重算碰撞面。

### 4.3 cars

- 运行时cars层hidden、alpha .2、depth 550；
- 优化路径只保留69345至69352；
- `carTraffic()`扫描该层的69350和69351等标记来建立车辆路径或放置车辆；
- 已定位chunk卸载不清除cars。

### 4.4 roof

四个roof层在地图文件中hidden，但运行时创建为visible、alpha 1，并使用3000至3300的depth。玩家进入factory或concert固定区域时，对应roof在300ms内淡到alpha 0；离开时恢复到1。

### 4.5 bridge

四个bridge wall层使用depth 3500。发布代码根据桥区和方向在上下层之间切换可见性，并逐tile切换碰撞；bridge1相关路径还会把玩家depth改为1650。bridge1上下层在初始世界创建时建立，bridge2可在优化写入时补建。

### 4.6 particles和footsteps

- 优化写入清单包含particles和particles2，只保留69355至69359；没有particles3；
- 已定位代码没有为particles/particles2设置明确depth，也没有在chunk卸载时清除；
- `final_map.json`与`final_map_small.json`的particles、particles2、particles3三层逐格完全相同；
- `particle-trajectories.json`包含88个世界像素多边形region。water、water2、protesters_rising三类的全局tileCount分别与69355、69356、69361计数吻合，但其他类型、region bbox和多边形均不能精确复现tilelayer，因此只能确认有限数据关联，不能宣称轨迹由三层机械生成；
- `footsteps-layer.json`的140×140布尔grid与24层中footsteps的368个GID=69345位置逐格完全一致；两者是同一位置集合的不同编码；
- 发布Bundle运行时读取独立`footstepsGrid`，在玩家移动、depth低于1000且网格值为1时生成脚印；当前没有定位footsteps tilelayer本身的消费者。

### 4.7 玩家动态depth

玩家常态depth不是固定值：已定位更新规则约为`500 + (player.y + 24) * 0.1`。桥上可强制为1650；怪物抓取设为2001；龙卷风路径还会按发射器depth覆盖。因而玩家与基础层、roof和bridge的最终遮挡关系必须同时考虑动态玩家depth，不能只比较静态图层depth。

## 5. 暂定边界（INFERRED）

- 图层系统应拥有“图层定义到运行时策略”的映射，而不是让SYS-CHUNK硬编码所有名称；
- SYS-CHUNK只负责目标坐标和触发写入/清除，具体每层怎样过滤GID、设置depth、碰撞和动态可见性应由SYS-LAYER提供；
- roof、bridge和cars已有独立运行行为，但是否以后成为独立系统必须等真实实现复杂度和重复场景出现，当前不拆节点；
- particles和footsteps的tilelayer与独立动态数据可能是不同职责，不能为了凑齐24层而强行统一。

## 6. `Q-LAYER-001`当前状态

仍保持`open`。静态证据已回答大部分创建顺序、depth、可见性和碰撞调用，但以下问题仍会影响正式设计或视觉验收：

1. 玩家、roof和基础层在真实运行中的前后遮挡是否与静态depth一致；
2. 两套layer6–10 depth公式是否会在实际路径中产生差异；
3. bridge上下层切换与玩家depth 1650的完整时序；
4. particles、particles2、particles3的视觉消费者和清理方式；
5. footsteps tilelayer与独立grid虽然位置完全一致，但为何同时发布、运行时为何只消费grid；
6. 特殊13层不随chunk卸载是否为有意的全局层策略。

关闭该问题至少需要：进一步静态调用链核对，并在确有必要时申请有边界的浏览器截图或Canvas采样；当前工作项没有授权刷新证据。

## 7. 对后续设计的约束

- 24层必须逐项分类，不能只实现11层后宣称完整；
- 地图visible不能直接当成运行时可见策略；
- depth冲突必须在设计和验证中显式处理；
- 图层清除策略必须说明局部层、全局层和动态对象的差异；
- 本轮没有第二个独立复用场景，复用观察保持“未发现”。
