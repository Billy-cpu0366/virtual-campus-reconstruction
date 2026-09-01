# 窗口 C：SYS-ASSET 资源加载时序调查报告

- 工作项：`WI-PARALLEL-MAP-RECON-001`
- 窗口：C / SYS-ASSET 资源加载时序、依赖与生命周期
- 调查方式：只读 `task_plan.md`、`决策记录.md`、执行层系统卡、公开 Bundle、运行网络证据和当前代码；另有一次独立只读复核
- 报告状态：调查报告；非权威文档；未修改 sample、正式代码、系统卡、总账或决策记录

## 结论先行

1. 原站资源链路分两段：HTML preload 预加载地图 JSON 和独立层；Phaser Loader 完成静态资源后，HttpClient 再加载 `master.json` 与 chunk。
2. 原站成功后的 chunk 有内存缓存，但没有完成请求级 in-flight 去重；浏览器 HTTP 缓存是否命中仍 UNKNOWN。
3. 原站的地图 tileset、地图 JSON、独立层和动态资源存在多条依赖链；缺少 `final_map_small`、优化 tileset、collision 或 master 都可能影响地图正确性。
4. 原站 chunk 卸载主要清理 Tilemap 数据，不显式移除静态纹理；动态资源和 Scene shutdown 的完整收敛边界未被证明。
5. 当前重构已有更健壮的 `ChunkDataStore` CORE，但 `src/asset/` 尚未接入 Phaser 静态资源加载、完整优化 tileset、失败体验和纹理所有权。
6. 建议提出独立的 SYS-ASSET runtime integration 工作项；该建议尚未被接受或写入 `task_plan.md`。

## 1. 原站加载时序

### 1.1 HTML preload

证据：`sample/original-public-build/mirror/index.html:138-146`

HTML 预加载以下资源：

```text
assets/js/phaser.min.js
assets/maps/final_map_small.json
assets/maps/final_map.json
assets/maps/walls-layer.json
assets/maps/footsteps-layer.json
assets/maps/particle-trajectories.json
```

这是浏览器 preload 声明，不等于已经证明 Phaser Loader 后续不会再次提交逻辑请求。

### 1.2 Phaser Loader

证据：`sample/original-public-build/mirror/chunk-WMFY56ZM.js:1263`

`GameScene.preload()` 的主要行为：

- 加载 `final_map_small.json`、`final_map.json` 和独立层 JSON；
- 默认优化路径加载 `exterior-small.webp`；
- 在 `final_map_small.json` 完成后，根据 tileset 元数据动态加入
  `exterior-small-2.webp` 至 `exterior-small-16.webp`；
- 加载 collision、particle、玩家、UI 和地图预览相关图片；
- 失败事件主要写入 console。

`full-map.webp` 属于 Phaser 加载的地图图片；`big-map.webp`、`mini-map.webp` 由页面 UI 使用，不是 Tilemap tileset。

### 1.3 HttpClient master/chunk

证据：`sample/original-public-build/mirror/chunk-WMFY56ZM.js:1263`、`chunk-RA2FASQA.js:8`

场景进入 `create()` 后：

```text
Phaser Loader 完成
  └─ GameScene.create()
      └─ chunkManager.loadMasterData()
          └─ master 成功
              ├─ 创建 Tilemap 和 tilesets
              ├─ 加载初始 chunk
              └─ 按相机/玩家目标集合预载 chunk
```

网络快照中，优化 tileset 请求先出现，`master.json` 约在
`63060.242`，chunk 请求从约 `63060.848` 开始。

证据：`sample/analysis/runtime-network.json:2684-3140`

## 2. 地图与资源依赖

### 2.1 master 与 chunk

证据：`sample/original-public-build/mirror/assets/maps/chunks/master.json:2-35`

- 地图为 5×5 个 chunk；
- 每个 chunk 为 28×28；
- 完整地图为 140×140；
- `exterior` 的 `firstgid` 为 1；
- collision 的 `firstgid` 为 69345；
- particle 的 `firstgid` 为 69355，并引用外部 `tileset-particles.tsx`。

`chunk0.json` 包含 24 个层，覆盖视觉层、cars、roof、bridge、walls、particles、particles3 和 footsteps。

证据：`sample/original-public-build/mirror/assets/maps/chunks/chunk0.json:8766-19165`

### 2.2 优化 tileset

证据：`sample/original-public-build/mirror/assets/maps/final_map_small.json:470727-470933`

`final_map_small.json` 动态描述：

```text
exterior-small.webp
exterior-small-2.webp
...
exterior-small-16.webp
collisions-objects.png
外部 particles tileset
```

因此，原站优化路径不是单一 `exterior-final.webp`，而是依赖地图 JSON 动态发现和 GID 映射的 16 张 tileset。

### 2.3 独立层和动态图片

已定位的独立 JSON：

```text
walls-layer.json
footsteps-layer.json
particle-trajectories.json
```

其中：

- `walls-layer.json` 参与路径/墙体辅助逻辑；
- `footsteps-layer.json` 被独立 footsteps grid 消费；
- `particle-trajectories.json` 驱动区域粒子对象；
- raw `particles`、`particles2`、`particles3` 层与这些动态消费者的完整转换关系没有全部证明。

`tileset-particles.tsx` 证据：
`sample/original-public-build/mirror/assets/maps/tileset-particles.tsx:1-2`

## 3. 缓存与重复请求

### FACT

- 运行快照中，核心地图 URL 各出现一次；相关资源请求成功。
- 快照中的 `fromDiskCache` 和 `fromServiceWorker` 均为 `false`。
- 原站 Chunk Manager 成功后把 chunk 放入 `loadedChunks`；再次请求已成功 chunk 时返回内存缓存。
- 原站没有独立的 in-flight 请求表；请求成功前的重复调用可能产生重复 HTTP 请求。
- master 的成功数据会保存在服务实例中，但当前代码没有通用的请求状态机或 cache policy。

证据：

- `sample/analysis/runtime-network.json:164-172,2684-3140`
- `sample/original-public-build/mirror/chunk-RA2FASQA.js:8`

### INFERRED

- HTML preload 很可能被浏览器复用，因此单次快照未出现明显重复 URL；但当前证据没有 initiator、完整缓存类型和响应头，不能把它报告为已确认的 HTTP 去重。
- 在慢网络、相机预载和玩家更新重叠时，原站可能对同一 chunk 发起多个在途请求。
- chunk 离开可见范围后，原站的 Tilemap 数据可能被清空，但 Manager JSON 缓存仍可能保留；再次进入时可能不需要重新请求。

### UNKNOWN

- `Cache-Control`、ETag、Last-Modified 等响应头未知。
- 浏览器第二次访问是否命中 HTTP cache 未验证。
- 多次进入/重建 Scene 时 master 是否重复请求，当前没有独立运行证据。

## 4. 纹理与 chunk 生命周期

### 4.1 原站

### FACT

- 静态 tileset 在 Loader 阶段创建，chunk 加载本身不创建新的地图纹理。
- GameScene `unloadChunk()` 主要清理 `layer1`–`layer10` 和 `walls` 的 Tilemap 数据。
- 未定位到该卸载路径对 `textures.remove()` 的调用。
- Bundle 中存在个别动态纹理的显式移除，但未发现覆盖所有 Loader 静态资源和动态对象的统一 teardown。

证据：`sample/original-public-build/mirror/chunk-WMFY56ZM.js:1263`

### UNKNOWN

- Phaser Game/Scene 销毁后，底层 Texture Manager 和 GPU 资源是否自动完整释放，尚未验证。
- 动态 particle、车辆、NPC 等对象在 Scene shutdown 时是否全部销毁，尚未验证。
- idle callback、进行中的 chunk 写入和异步动态对象创建是否会在 shutdown 后晚到，尚未做故障注入。

### 4.2 当前重构

当前代码已经显式区分 chunk 数据、Tilemap layer 和 Scene teardown：

- `ChunkDataStore`：in-flight 去重、成功缓存、有限重试、AbortSignal、失败记录和 destroy；
- `PhaserWorldRenderer`：按 chunk 创建/清理 Tilemap layer 和碰撞对象；
- Scene shutdown：先停协调器和数据请求，再等待 mutation，最后销毁 renderer。

证据：

- `src/chunk/data-store.ts:174-342`
- `game/PhaserWorldRenderer.ts:298-345,559-615`
- `game/CampusScene.ts:174-192,306-352`

这些是当前重构 DECISION，不是原站 FACT。

## 5. 失败体验

### FACT

原站 Bundle 中可见：

- Phaser `fileerror`/`loaderror` 主要输出 console；
- master 失败返回空结果或 `null`；
- chunk 失败不会写入成功缓存；
- 未定位统一重试、占位图、降级 Tilemap 或玩家可见错误页。

证据：`sample/original-public-build/mirror/chunk-WMFY56ZM.js:1263`、`chunk-RA2FASQA.js:8`

### INFERRED

如果关键资源失败，玩家可能看到：

- 空白或局部缺 tile 地图；
- collision 缺失或无法创建；
- chunk 区域暂时空白；
- 加载进度完成但世界没有成功初始化。

这些是控制流推断，不是已观察到的真实画面。

### UNKNOWN

- 没有做资源删除、HTTP 非 200、超时或断网故障注入；
- 没有直接验证玩家最终画面、按钮状态和错误提示；
- 不能报告“原站失败体验已验证”。

## 6. 当前重构差距

### FACT

`src/asset/` 当前是纯 CORE：

- URL 构造；
- key 构造；
- optimized tileset 发现。

证据：`src/asset/urls.ts:9-35`、`src/asset/tilesets.ts:5-31`

`CampusScene` 当前只加载：

```text
/maps/exterior-final.webp
/maps/collisions-objects.png
/sprites/player.webp
```

证据：`game/CampusScene.ts:64,159-162`

当前运行路径没有接入：

- `final_map_small.json`；
- 16 张 `exterior-small` tileset；
- 原站 GID mapping；
- 独立 walls/footsteps/particle JSON；
- 原站粒子 tileset 的完整依赖链；
- 静态资源失败状态和纹理 ownership。

当前 runtime 资源脚本还会从公开证据复制完整 `exterior-final`、collision 和 chunks，并对不可用的外部 particle GID 做 sanitize/clamp。

证据：

- `scripts/prepare-runtime-assets.mjs:18-25`
- `scripts/sanitize-runtime-maps.mjs:1-16`
- `scripts/check-runtime-assets.mjs:15-25,72-114`

### 判断

当前 playable prototype 可以在自己的 sanitized 资源合同下渲染地图，但这不等于已经复现原站完整 SYS-ASSET 行为。

## 7. 对地图正确性的影响

影响等级：**高**。

1. 缺少 `final_map_small` 和 16 张优化 tileset 时，无法证明原站小图 GID 映射正确。
2. collision 纹理或 master 失败会影响 chunk 装配和碰撞。
3. 单个 chunk 失败可能留下空区域；原站没有明确的玩家可见降级状态。
4. 当前使用完整 `exterior-final.webp` 加 sanitized 地图，是当前重构的主动简化方案，不应冒充原站事实。
5. 纹理未释放主要影响长时间运行的内存和性能，也可能间接影响后续地图正确性。

## 8. 候选独立实现工作项

以下仅为建议，尚未接受、未持久化、未写入 `task_plan.md`：

`WI-SYS-ASSET-RUNTIME-INTEGRATION-001`

建议范围：

1. 接入 Phaser Loader 的地图 JSON、优化 tileset、collision 和独立层；
2. 将 master/chunk 浏览器请求接入现有 `ChunkDataStore`；
3. 明确成功缓存、in-flight、重试、Abort 和失败状态；
4. 明确静态纹理、动态纹理、Tilemap layer 和 chunk cache 的 owner 与 teardown；
5. 为 master、tileset、collision、chunk 失败建立可重复 fault fixture 和浏览器检查；
6. 记录需要响应头才能确认的 HTTP cache 结论，不凭单次快照下结论。

不建议在该工作项中：

- 先抽象通用 Loader；
- 同时扩展完整 particles/NPC 行为；
- 修改 sample 公开证据；
- 把原站缺少重试或释放的行为直接复制成重构合同。

## 9. 当前报告边界

- 已确认：资源依赖、代码时序、原站成功缓存、缺少 in-flight 去重、chunk 清理边界、当前重构差距。
- 推测：浏览器 preload 复用、重复请求风险、失败时空白/缺碰撞体验。
- UNKNOWN：HTTP cache 命中、响应头、真实故障画面、完整 GPU/Scene teardown。
- 已落盘：本调查报告，仅位于 `task-todos/`，不是项目权威定义。
- 未落盘：任何新的 DECISION、系统卡变更、`task_plan.md` 工作项或正式实现授权。
