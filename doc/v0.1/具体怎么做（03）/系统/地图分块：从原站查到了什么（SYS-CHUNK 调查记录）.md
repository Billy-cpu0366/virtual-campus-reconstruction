---
title: 地图分块：从原站查到了什么（SYS-CHUNK 调查记录）
type: system-reverse-engineering-dossier
status: draft
version: v0.1
node-id: SYS-CHUNK
node-type: 系统
parent-ref: SYS-WORLD
scope-disposition: in-scope
understanding-status: confirmed
engineering-status: undesign
source-refs:
  - CAP-MAP-001
  - BASE-MAP-001
  - Q-MAP-001
  - Q-MAP-002
  - Q-MAP-003
decision-refs:
  - DEC-STAGE6B-001
main-definition: false
updated: 2026-08-10
---

# 地图分块：从原站查到了什么（SYS-CHUNK 调查记录）

> **一句话：这是调查过程记录：哪些地图分块行为有证据，哪些仍不确定；它不是最终做法。**

> 这是阶段6C的证据工作稿，不是 `SYS-CHUNK` 的唯一详细主定义，不代表工程状态已经 `designed`，也不授权写正式 `src`。它只把可定位的原站事实、必要推断和尚未解决的问题整理出来，供后续设计和 Human 审查使用。

## 1. 这次要弄清什么

地图不是一张一次性使用的整图，而是由 `master.json` 和多个 chunk 组成。当前要弄清：原站如何确定“现在需要哪些 chunk”、如何请求、写入世界、清除显示内容，以及哪些失败和清理行为尚未被公开证据证明。

本工作稿不处理：所有图层视觉规则、NPC、车辆、完整资源加载框架、玩家移动参数、最终源码目录或复用模块提取。

## 2. 证据定位

| 证据 | 可重复定位方式 | 用途 |
|---|---|---|
| master 元数据 | `sample/original-public-build/mirror/assets/maps/chunks/master.json` | 块尺寸、地图规模、tileset |
| chunk 样本 | `sample/original-public-build/mirror/assets/maps/chunks/chunk0.json` | 28×28、16px、24层数据结构 |
| 数据请求与缓存 | `sample/original-public-build/mirror/chunk-RA2FASQA.js`，搜索 `loadMasterData`、`getChunkFileName`、`loadChunk` | master 请求、文件名公式、manager 缓存 |
| 场景目标集合与写入 | `sample/original-public-build/mirror/chunk-WMFY56ZM.js`，搜索 `getVisibleChunksForCamera`、`loadChunk(e,t)`、`unloadChunk(e,t)` | 玩家/相机目标集合、场景缓存、清除 Tilemap |
| 相机预载 | 同上，搜索 `startCameraSequence`、`preloadChunksForCameraSequence`、`requestIdleCallback` | Play 前预载过程 |
| 运行时结果 | [[../../怎么验证与还差什么（04）/原站实际表现是什么（行为基准）]] 的 `BASE-MAP-001` 行、[[../../整体怎么运作（02）/先做什么（P0系统对照与顺序）#3. 地图分块新增事实]] | 25个 chunk 请求与首屏时序 |

公开 Bundle 只能证明发布后的运行机制，不能证明原始 TypeScript 文件边界或命名。

## 3. 已证实事实（FACT）

### 3.1 数据契约

- `master.json` 明确为：每块 `28 × 28` tile，横向 `5` 块、纵向 `5` 块，原图 `140 × 140` tile；
- tile 尺寸为 `16 × 16` 像素；
- `chunk0.json` 是 `28 × 28`、24层的地图数据样本；
- 文件索引公式是：`index = y * nbChunksHorizontal + x`；文件名为 `chunk{index}.json`；
- 25个 chunk 按行优先拼接后与整图的24层逐格一致；这不是猜测。

### 3.2 两层职责

公开 Bundle 显示两层不同职责：

| 层 | 已证实职责 | 已证实状态 |
|---|---|---|
| chunk manager | 请求 master 和单个 JSON；成功后以 `x_y` 缓存数据；非法坐标、master 未就绪或 HTTP 异常返回 `null` | manager 的 `loadedChunks` Map |
| GameScene | 计算需要的 chunk；把返回数据写入 Tilemap；维护场景已加载集合；清除不再需要的显示区域 | scene 的 `loadedChunks` Map |

两层都叫 `loadedChunks`，但不是同一个 Map：前者表示已获得 JSON，后者表示已进入场景集合。

### 3.3 目标集合与更新节奏

- 场景每约 `500ms` 检查一次（相机展示期间除外）；
- 先以玩家世界坐标计算当前块，加入边界裁剪后的 `3 × 3` 邻域；
- 再根据相机 `scrollX / scrollY / width / height / zoom` 计算可见范围；
- 相机可见范围向四周额外扩展 `1` 块；
- 二者合并为同一个目标集合；目标中未在场景集合的块会加载，场景集合中不再属于目标的块会卸载。

### 3.4 卸载实际做了什么

场景卸载时会：

1. 计算块在世界 Tilemap 中的起点；
2. 将 `layer1` 到 `layer10` 和 `walls` 的该块区域写为 `-1`；
3. 重新计算该区域的碰撞面；
4. 从**场景**的已加载集合删除该块。

在已定位的动态路径中，没有发现这一步同时删除 manager 的 JSON 缓存。因此，“视觉/场景卸载”与“下载数据缓存删除”是两件不同的事。

manager 自身定义了 `unloadChunk`、`unloadDistantChunks` 和 `updateChunks` 等缓存淘汰方法，但在当前已检查的发布 Bundle 中没有找到这些方法的调用方；不能据此断言 manager 缓存永远不会淘汰。

### 3.5 为什么 Play 前会请求全部25块

master 成功后，场景启动相机展示；约 `100ms` 后调用 `preloadChunksForCameraSequence()`：

- 它汇总多个相机位置的视口范围；
- 预载范围额外扩展 `2` 块；
- 用 Set 去重；
- 通过 `requestIdleCallback`（不可用时 `setTimeout`）逐项尝试加载。

在既有 `1920 × 1080` 采集里，这一范围覆盖5×5地图，因此 Play 前已请求 `chunk0.json` 至 `chunk24.json`。这不推翻玩家阶段仍按目标集合动态装卸的事实。

## 4. 暂定边界（INFERRED）

以下是根据事实整理出的研究边界，尚不是最终重构设计：

- 分块系统应只负责“数据块的目标集合、请求结果和写入/清除边界”；世界装配、完整图层语义、玩家参数和通用 Loader 不应被一并塞入；
- 相机和玩家是计算目标集合的输入，不应反过来由分块系统定义其完整行为；
- manager JSON 缓存和场景 Tilemap 状态应在后续设计中分开建模，避免把“已下载”误当成“当前显示”。

这些边界需要在正式详细设计中转化为可审查的 `DECISION`，不能冒充原站事实。

## 5. 尚未解决（UNKNOWN）

| 问题 | 为什么不能现在下结论 | 后续证据或设计动作 |
|---|---|---|
| 同一块在响应前重复触发加载，是否会合并请求 | 静态路径只在成功回调后写入 Map，未定位 in-flight 注册表 | 用受控运行记录或进一步调用链审查验证 |
| 是否支持取消加载 | 未定位 `AbortController`、保存订阅或 unsubscribe 路径 | 调查请求封装和场景生命周期 |
| 失败后如何重试、记录或降级 | 已知失败会变为 `null`，但未证明重试策略 | 单独定义重构失败策略，不声称原站已有 |
| 场景销毁时如何处理缓存、空闲回调、tween 和未完成请求 | 当前范围未定位 shutdown/destroy 清理 | 调查 GameScene 生命周期 |
| 不同视口/缩放下相机预载的精确边界 | 已有一次采集，但没有多视口量化 | 后续运行验证 |
| 13个未在卸载代码中处理的图层如何清除 | 已知清除 `layer1..10` 和 `walls`（共11层），完整图层语义仍未逆向 | 与 SYS-LAYER 边界一起调查 |

## 6. 后续形成正式详细设计前必须补齐

1. 为每条 UNKNOWN 标记“继续调查”还是“我们的重构决定”；
2. 说明两个 Map 的状态所有权、转换条件和销毁责任；
3. 写清加载、失败、重复、取消、卸载和场景退出的路径；
4. 明确分块与世界、图层、资源加载、玩家、相机之间的输入/输出边界；
5. 从 [[../../怎么验证与还差什么（04）/原站实际表现是什么（行为基准）]] 拆出可重复的分块验收步骤和失败判定；
6. 由 Human 审查后，才将节点主定义登记为正式设计并讨论是否授权实现。

## 7. 当前结论

`SYS-CHUNK` 已具备进入详细逆向的公开证据基础，但**尚未具备进入正式代码实现的授权**。当前最重要的工作不是造通用框架，而是补齐失败、清理、层边界和可重复验收，使后续设计能被审查。