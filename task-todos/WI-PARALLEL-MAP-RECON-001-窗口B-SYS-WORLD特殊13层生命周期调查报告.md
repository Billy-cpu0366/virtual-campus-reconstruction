# 窗口 B：SYS-WORLD 特殊 13 层生命周期调查报告

- 工作项：`WI-PARALLEL-MAP-RECON-001`
- 窗口：B / SYS-WORLD 特殊 13 层
- 调查方式：只读 `task_plan.md`、`决策记录.md`、执行层系统卡、公开 Bundle、运行证据和当前代码
- 报告状态：调查报告；非权威文档；未修改 sample、正式代码、系统卡、总账或决策记录
- 日期：2026-08-20

## 结论先行

1. 原站存在两个同名 `unloadChunk`：
   - `chunk-RA2FASQA.js`：只删除 Chunk Manager 的 JSON 缓存。
   - `chunk-WMFY56ZM.js`：GameScene 方法，实际清理 Tilemap 区域。
2. GameScene 的 `unloadChunk` 明确只清 `layer1`–`layer10` 和 `walls`，共 11 层。
3. 其余 13 层不能直接判定为“全局持久”。只能确认它们没有被该 chunk 卸载函数清理；其中部分是全图层，部分未进入优化写入路径，部分由独立数据驱动。
4. 原站没有定位到完整统一的 Scene shutdown teardown。显式 shutdown 代码目前只移除一个键盘监听器。
5. `cars`、roof、bridge 有明确动态对象或状态消费者；`particles`、`particles2`、`particles3`、`footsteps` 的 raw Tilemap 层消费者没有被完整证明。

## 1. 原站 `unloadChunk` 完整调用链

### 1.1 Chunk Manager 的同名方法

证据：`sample/original-public-build/mirror/chunk-RA2FASQA.js`

- `loadChunk`：约 byte `157469`
- `updateChunks`：约 byte `157888`
- `unloadDistantChunks`：约 byte `158025`
- Manager `unloadChunk`：约 byte `158056`

Manager 的 `unloadChunk(x, y)` 只执行：

```text
loadedChunks.delete(`${x}_${y}`)
```

它不操作 Phaser Tilemap。

当前检查的 `chunk-WMFY56ZM.js` 中未找到 `updateChunks` 或 `unloadDistantChunks` 的调用方。因此不能声称 Manager 缓存一定永不淘汰，只能说当前已定位运行链没有调用它们。

### 1.2 GameScene 的实际地图卸载链

证据：`sample/original-public-build/mirror/chunk-WMFY56ZM.js`

- `loadInitialChunk`：约 byte `377463`
- GameScene `loadChunk`：约 byte `378229`
- GameScene `unloadChunk`：约 byte `387486`
- `loadChunksForCamera`：约 byte `388730`

调用入口：

```text
create
 ├─ startCameraSequence()
 │   ├─ preloadChunksForCameraSequence()
 │   │   └─ this.loadChunk(x, y)
 │   └─ playNextCameraPosition()
 │       ├─ onUpdate → loadChunksForCamera(camera)
 │       └─ onComplete → loadChunksForCamera(camera)
 └─ loadInitialChunk()
     └─ loadChunk(0, 0)
```

玩家阶段：

```text
GameScene.update()
 └─ 每约 500ms 计算：
       玩家 3×3 ∪ 相机可见范围 +1
       ├─ 不在 scene.loadedChunks → loadChunk(x, y)
       └─ 已加载但不在目标集合 → unloadChunk(x, y)
```

证据位置：

- `loadChunksForCamera` 加载调用：约 byte `388979`
- `loadChunksForCamera` 卸载调用：约 byte `389094`
- 玩家更新阶段加载调用：约 byte `401425`
- 玩家更新阶段卸载调用：约 byte `401540`
- 传送期间的 `loadChunksForCamera`：约 byte `396955`
- 相机预载调用：约 byte `414373`
- 相机序列调用：约 byte `414892`、`414959`
- `startGame` 相机 tween 调用：约 byte `415844`

### 1.3 GameScene `unloadChunk` 实际动作

它只做：

1. 检查 `scene.loadedChunks` 是否有该坐标；
2. 根据 `chunkWidth` 计算 28×28 区域；
3. 对以下 11 个层写入 `-1`：
   - `layer1`–`layer10`
   - `walls`
4. 对每层调用 `calculateFacesWithin`；
5. 从 Scene 的 `loadedChunks` 删除坐标。

它不做：

- 不删除 Manager JSON 缓存；
- 不清 cars、roof、bridge、particles、particles2；
- 不处理 particles3、footsteps；
- 不取消 idle callback；
- 不销毁 Tilemap；
- 不销毁动态 NPC、车辆、粒子对象；
- 不等待异步写入完成。

## 2. 为什么只清理 11 层

### FACT

原站代码没有发现解释“为什么是 11 层”的注释或设计声明。只能确认存在两组不对称层清单：

- 优化 `loadChunk` 写入列表：22 层
- `unloadChunk` 清理列表：11 层

优化写入列表位于 `chunk-WMFY56ZM.js` 约 byte `378229`，包含：

```text
layer1–layer10
walls
cars
particles
particles2
roof_factory
roof_factory2
roof_concert
roof_concert2
bridge1_down_wall
bridge1_up_wall
bridge2_down_wall
bridge2_up_wall
```

它没有写入：

```text
particles3
footsteps
```

`unloadChunk` 的 11 层列表则只包括：

```text
layer1–layer10
walls
```

### INFERRED：最可能是混合原因

有两种证据同时存在：

1. **可能有意将特殊层视为场景级或全图级数据**
   - 优化写入函数读取完整 `final_map_small.json`；
   - 每次 `loadChunk` 都把 140×140 数据写入 `(0,0)`，不是写入当前 chunk 偏移；
   - roof、bridge、cars 的消费者都按全图层名称读取；
   - 对这类层执行局部清除可能破坏全图动态状态。

2. **也可能是发布实现不完整**
   - 24 层数据存在，但优化路径只处理 22 层；
   - unload 只处理 11 层；
   - idle callback 不保存句柄；
   - 未发现统一 shutdown、Tilemap 销毁或动态对象清理。

因此当前最稳妥判断是：

> 11 层可能是早期“核心局部地图层”的卸载名单；特殊层可能被当作全图或场景级资源，但代码同时存在明显未完成路径。不能把它解释为已证实的生命周期设计。

## 3. 剩余 13 层是否全局持久

### FACT

剩余 13 层是：

```text
cars
roof_concert
roof_concert2
roof_factory
roof_factory2
bridge1_up_wall
bridge1_down_wall
bridge2_up_wall
bridge2_down_wall
particles
particles2
particles3
footsteps
```

可以确认：

- GameScene `unloadChunk` 不清它们；
- `scene.loadedChunks.delete()` 不会影响这些 Tilemap 层；
- 这不等于它们会持续到 Scene shutdown；
- 也不等于它们跨 Scene 全局持久。

### 分组判断

| 层 | 当前判断 |
|---|---|
| `cars` | 场景内全图层候选，有直接动态消费者 |
| 4 个 `roof` | 场景内全图层候选，有直接淡隐消费者 |
| 4 个 `bridge` | 场景内全图层候选，有直接碰撞和深度消费者 |
| `particles`、`particles2` | 原始优化层存在，但直接消费者未定位 |
| `particles3` | 优化运行时未创建；消费者链 UNKNOWN |
| `footsteps` | 优化运行时未创建，行为由独立 `footstepsGrid` 驱动 |

运行证据：`sample/analysis/layer-visual-evidence/observations.json`

- `particles`、`particles2` 层出现；
- `mapHasParticles3: false`；
- `mapHasFootsteps: false`；
- 同时存在动态 particle emitter；
- README 明确说明 footsteps 行为来自独立 grid。

所以只能报告：

> 原站表现为“chunk unload 不清理这 13 层”，但不能报告为“13 层全部全局持久”。其中只有 cars、roof、bridge 具备较强的场景级依赖证据；其余层仍需保留 UNKNOWN。

## 4. Scene shutdown 与 chunk unload 的区别

### 原站

| 项目 | chunk unload | Scene shutdown |
|---|---|---|
| 触发 | 目标 chunk 离开目标集合 | Phaser Scene 进入 shutdown |
| 范围 | 单个 28×28 区域 | 整个 Scene |
| Tilemap | 只清 11 层区域 | 未定位显式 Tilemap destroy |
| JSON 缓存 | 不清 Manager 缓存 | 未定位统一清理 |
| 动态对象 | 不处理 | 未定位统一销毁 |
| idle callback | 不取消 | 未定位取消 |
| 状态 | 删除 Scene `loadedChunks` 坐标 | 应由 Phaser 生命周期处理，但具体行为 UNKNOWN |

Bundle 中唯一定位到的显式 shutdown 监听：

- `chunk-WMFY56ZM.js` 约 byte `376560`
- 作用：移除 `monsterEscapeHandler` 的 `keydown` 监听器

未定位到：

```text
cancelIdleCallback
tilemap.destroy
统一 dynamic object teardown
统一请求取消
```

Phaser 是否隐式清理部分 Scene-owned 对象，当前静态证据不足。

### 当前重构代码

当前代码已经将两者明确分开：

- chunk 目标变化：`game/CampusScene.ts:626-653`，通过 `ChunkCoordinator.updateTargets()` 调用 `World.removeChunkAsync()`；
- 单块清除：`src/world/world.ts:193-233`，按 24 层数据逐层清除；
- Scene shutdown：`game/CampusScene.ts:174-191`、`game/CampusScene.ts:434-467`；
- renderer teardown：`game/PhaserWorldRenderer.ts:298-345`、`game/PhaserWorldRenderer.ts:559-615`。

这是当前重构 DECISION，不是原站事实。

## 5. 这些层是否被动态对象依赖

### 已确认有直接依赖

#### `cars`

证据：

- `chunk-WMFY56ZM.js` 约 byte `383135`：首次加载后安排 `placeCarMarkers()` / `carTraffic()`；
- `carTraffic()` 约 byte `516329`。

`carTraffic()`：

- 读取 `tilemap.getLayer("cars")`；
- 扫描全图 `69350`、`69351`；
- 生成车辆路线和车辆对象。

因此 `cars` 是明确的动态车辆输入。

#### roof 四层

证据：

- `initRoofAreas()` 约 byte `574377`；
- `updateRoofAreas()` 约 byte `574728`。

`updateRoofAreas()`：

- 按 roof 名称取得 Tilemap 层；
- 根据玩家是否进入 factory/concert 区域；
- 对对应 roof 层做 300ms alpha tween。

因此 roof 层被动态遮挡状态直接依赖。

#### bridge 四层

证据：

- `activateBridgeUpWall()` 等约 byte `324986`、`325339`、`326863`、`327217`；
- 调用入口约 byte `403677`–`404039`。

行为包括：

- 切换上下 bridge 层可见性；
- 切换碰撞；
- 改变玩家 depth；
- 玩家创建时为 bridge 层注册 collider。

因此 bridge 层被动态碰撞和玩家深度直接依赖。

### 没有定位直接 raw-layer 消费者

#### `particles` / `particles2`

`createAreaParticleEmitters()` 约 byte `551256`，读取的是：

```text
particle-trajectories.json
```

并非 `tilemap.getLayer("particles")` 或 `particles2`。

目前只能说：

- raw 层会被优化路径写入；
- 动态粒子对象由 trajectory regions 驱动；
- raw layer 到动态对象的直接关系未定位。

#### `particles3`

当前 Bundle 中未找到：

```text
particles3
69361
```

的直接处理链。

`initProtestersRisingNPCs()` 约 byte `564770`，消费的是 `particleRegions`。`protesters_rising` 的数量与 GID 69361 数量吻合，但没有找到 marker → trajectory 的转换步骤。

状态仍为 `UNKNOWN`，对应 `Q-LAYER-002`。

#### `footsteps`

证据：

- `footstepsGrid` 约 byte `353548`、`406507`；
- `spawnFootprint` 约 byte `406947`。

运行时脚印读取独立的 `footstepsGrid`，没有定位 footsteps Tilemap 层消费者。视觉证据也显示优化运行时没有 `footsteps` 层。

## 6. 职责边界建议

- **SYS-CHUNK**：负责目标集合、请求、缓存、在途状态；不决定某一层是否全局持久。
- **SYS-WORLD**：负责 Tilemap/世界生命周期、chunk apply/remove 和 Scene destroy 边界。
- **SYS-LAYER**：负责 24 层策略、marker、roof、bridge 的图层语义；不负责 HTTP 和请求缓存。
- **动态对象消费者**：车辆、NPC、粒子、脚印等对象应有独立创建、更新和销毁责任；不能因为某层未被 `unloadChunk` 清理，就默认动态对象也应永久存在。
- **Scene**：负责 shutdown 编排、监听器、定时器、collider、动态对象和 renderer 的最终收敛。

## 7. 候选 DECISION（未接受、未落盘）

> 不把原站 11 层卸载列表当作重构合同，也不把剩余 13 层直接定义为全局持久。重构对 24 层逐层声明 apply/remove 责任；若某层或其动态消费者确实是场景级资源，必须显式登记 owner、生命周期和 shutdown 验收。particles3 等消费者未证实的层保留 UNKNOWN，不通过“未找到卸载代码”关闭问题。

当前代码已经部分采用这个方向：

- `src/layer/strategy.ts:14-49` 明确列出 24 层；
- `src/world/world.ts:193-233` 按 24 层对称清除；
- `PhaserWorldRenderer` 按 chunk 保存 layer/marker；
- 但完整 cars/NPC/粒子消费者尚未实现。

## 8. 建议验收方式

### 原站事实验收

1. 使用内存探针加载至少两个相距较远的 chunk；
2. 调用 Scene `unloadChunk(x, y)` 前后，逐层记录层是否存在、目标 28×28 区域 tile 数、动态对象数量、Scene/Manager cache 状态；
3. 确认只有 11 层目标区域被清成 `-1`；
4. 单独调用 Manager `unloadChunk`，确认它只影响 JSON cache；
5. 在 idle 写入排队时触发 unload，观察是否有晚到写入；
6. 触发 Scene shutdown，记录 Tilemap、动态对象、监听器、定时器和请求是否收敛；
7. 对 cars、roof、bridge 做调用覆盖或运行时拦截，验证直接消费者；
8. 对 particles3/footsteps 只在找到直接数据流后再关闭 UNKNOWN。

### 当前重构验收

- 24 层每层都做 apply/remove 对称测试；
- 各类 marker 在 chunk remove 后不残留；
- pending request、active mutation、collider、roof/bridge 状态存在时执行 shutdown；
- shutdown 后不得有晚到写入、异常或残留 renderer layer；
- 使用现有命令：
  - `npm run typecheck`
  - `npm test -- --run`
  - `npm run browser:lifecycle-smoke`
  - `npm run browser:chunk-smoke`

现有生命周期 Smoke 只能证明当前重构 teardown 边界，不能关闭原站特殊 13 层事实。
