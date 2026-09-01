---
title: 世界与地图：从原站查到了什么（SYS-WORLD 调查记录）
type: system-reverse-engineering-dossier
status: draft
version: v0.1
node-id: SYS-WORLD
node-type: 系统
parent-ref: GRP-WORLD
scope-disposition: in-scope
understanding-status: partial
engineering-status: undesign
source-refs:
  - CAP-MAP-001
  - CAP-LAYER-001
  - BASE-MAP-001
decision-refs:
  - DEC-SYS-WORLD-LAYER-INVESTIGATION-001
main-definition: false
updated: 2026-08-11
---

# 世界与地图：从原站查到了什么（SYS-WORLD 调查记录）

> **一句话：原站先建立140×140的空Tilemap世界，再按发布路径把地图数据写入图层；这份文件记录已证实机制和未知项，不是正式设计。**

> 本文是`WI-SYS-WORLD-LAYER-DESIGN-001`产生的调查工作稿，自身不改变节点状态，也不授权正式`src`、Phaser集成或资源加载实现。当前正式设计见[[世界与地图：游戏世界怎样建立和装卸（SYS-WORLD）#SYS-WORLD]]。

## 1. 这次要弄清什么

1. 世界的尺寸、Tilemap和tileset怎样建立；
2. chunk数据怎样写入和清除世界；
3. 世界、分块、图层和资源系统分别应研究什么；
4. 创建失败、卸载和销毁已能证明到什么程度。

完整24层语义记录在[[图层与遮挡：从原站查到了什么（SYS-LAYER 调查记录）]]。

## 2. 证据定位

| 证据 | 可重复定位方式 | 用途 |
|---|---|---|
| 世界目录 | `sample/original-public-build/mirror/assets/maps/chunks/master.json` | 5×5、28×28、原图140×140 |
| 25个chunk | 同目录`chunk0.json`至`chunk24.json` | 每块24层数据与行主序拼接 |
| 整图 | `sample/original-public-build/mirror/assets/maps/final_map.json` | 24层140×140对照 |
| 优化整图 | 同目录上级`final_map_small.json` | 18个tileset和优化写入数据 |
| 发布Bundle | `sample/original-public-build/mirror/chunk-WMFY56ZM.js` | 空世界、图层、写入、清除、碰撞和场景协作 |
| 分块正式边界 | [[地图分块：玩家移动时怎样加载地图（SYS-CHUNK）#SYS-CHUNK]] | 避免重复定义目标集合和请求状态 |

Bundle可用搜索锚点：`this.make.tilemap({tileWidth:`、`USE_OPTIMIZED_TILESETS`、`loadChunk(e,t)`、`unloadChunk(e,t)`、`createBlankLayer("walls"`。

公开Bundle只能证明发布后的实现，不能证明原始TypeScript目录或类边界。

## 3. 已证实事实（FACT）

### 3.1 世界数据是同一张140×140地图

- `master.json`定义5×5个chunk，每块28×28 tile，原图140×140；tile为16×16像素；
- 25个chunk的24层名称、顺序、类型、尺寸和data长度完全一致；
- 按`index = y * 5 + x`行主序拼接后，24层共470400个格子与`final_map.json`逐格差异为0；
- `final_map_small.json`同样是140×140、24层，但把exterior拆成16个每组400 tile的优化tileset，同时保留碰撞和粒子tileset。

因此chunk、`final_map.json`和`final_map_small.json`表达的是同一世界数据的不同发布形式。

### 3.2 发布Bundle先创建空Tilemap

发布Bundle从master读取`originalWidth/originalHeight`，调用：

```text
make.tilemap(tileWidth=16, tileHeight=16, width=140, height=140)
```

当前世界像素范围为2240×2240。随后相机和物理世界边界也设置为这个像素范围。

普通tileset路径映射：

- `exterior`，firstgid 1；
- `collisions-objects`，firstgid 69345；
- `tileset-particles`，firstgid 69355。

优化路径读取`final-map-small`中的16个`exterior-small*` tileset，并建立原始tile ID到优化tile ID的映射。发布类字段`USE_OPTIMIZED_TILESETS=!0`，当前只定位到这一处赋值，说明发布默认值为true；运行时仍须同时成功取得优化地图和tileset才能走完整优化路径。

### 3.3 图层实例和世界写入是不同步骤

创建世界时先建立空图层实例：

- `layer1`至`layer10`；
- 四个roof层；
- `walls`；
- bridge1上下层。

优化写入路径还会在缺失时创建`cars`、particles、bridge2等图层。创建规则和各层depth详见SYS-LAYER调查记录。

`loadChunk(x,y)`在场景中维护自己的`loadedChunks`。取得chunk JSON后：

- **普通路径**：代码遍历chunk layers，但`o=["layer1"]`名称守卫使其实际只处理`layer1`，将该28×28数据写到`x*28, y*28`对应区域；
- **优化路径**：读取完整`final_map_small.json`，处理22层；`layer1`先同步写入，其余通过空闲回调分批写入。

发布代码同时保留两条路径。普通路径是只写`layer1`的局部fallback，不是完整24层实现；优化路径使用完整140×140数据。

### 3.4 已定位卸载只清11层

`unloadChunk(x,y)`会：

1. 根据master计算该chunk的28×28世界区域；
2. 将`layer1`至`layer10`和`walls`写成`-1`；
3. 对对应区域重新计算碰撞面；
4. 从场景`loadedChunks`删除坐标。

它没有在同一方法中清除cars、roof、bridge、particles或footsteps等其余13层，也没有删除chunk manager中的原始JSON缓存。

### 3.5 已定位失败和边界处理

- master不存在时记录错误并提前返回；
- 必要tileset或texture无法建立时记录错误并提前返回；
- `loadChunksForCamera`捕获异常，但已定位分支没有形成完整错误状态；
- 单块回调返回falsy数据时直接停止本次写入；
- 已定位卸载只收敛场景11层和场景已加载标记，不等于完整销毁Tilemap、释放缓存或取消在途请求；
- 应用Bundle中`putTilesAt`只有优化写入、普通chunk写入和卸载清空3个调用点，未定位特殊13层的其他tile清空；
- GameScene已定位的shutdown监听只移除一个document keydown handler；优化图层批写不保存idle callback ID，Bundle中没有`cancelIdleCallback`或`tilemap.destroy`调用。Phaser是否在场景生命周期中隐式释放部分资源仍未知。

## 4. 暂定研究边界（INFERRED）

以下只是根据证据收敛的设计输入，尚未获得正式设计接受：

| 责任 | 暂定归属 | 理由 |
|---|---|---|
| 需要哪些chunk、请求和原始JSON状态 | SYS-CHUNK | 已由SYS-CHUNK主定义拥有 |
| 全局Tilemap、世界坐标空间和场景图层实例 | SYS-WORLD | 它们在单一世界生命周期中被创建和销毁 |
| 图层depth、可见性、碰撞和roof/bridge/cars语义 | SYS-LAYER | 这些规则不决定需要哪些chunk |
| 地图JSON、texture和tileset是否可用 | SYS-ASSET | 资源结果是世界创建输入，不应由世界系统实现通用Loader |

`WorldRenderer`是SYS-CHUNK正式设计中的职责名称，不预先等于一个可复用类。后续设计需要决定它由SYS-WORLD还是更小的内部协作者承担，不能在调查记录中提前固定代码目录。

## 5. 仍未知（UNKNOWN）

1. 优化路径为何在每次`loadChunk`回调中使用完整`final_map_small`，以及实际运行时是否重复写完整世界；普通fallback为何只允许`layer1`；
2. 其余13层不随chunk卸载，是有意作为全局持久层，还是发布实现的不完整路径；
3. 普通路径和优化路径的depth公式存在差异时，实际显示结果由哪一次创建决定；
4. particles3与footsteps tilelayer为何不进入已定位的22层优化写入清单；
5. 世界创建中途失败时，已创建图层和监听器如何回滚；
6. 场景关闭时Tilemap、空闲回调、定时器、碰撞和特殊层的完整销毁顺序；静态代码未定位显式统一teardown；
7. 是否需要运行时截图或Canvas采样才能关闭图层前后遮挡顺序。

## 6. 对后续设计的约束

- 不得把“已下载chunk”与“已写入世界”合并成一个状态；
- 不得只实现已定位11层却宣称支持完整24层生命周期；
- 不得把优化整图路径冒充分块系统唯一原站机制；
- 失败和销毁必须覆盖部分创建、空闲任务和后续异步回调；
- 本轮没有出现第二个独立复用场景，复用观察保持“未发现”。
