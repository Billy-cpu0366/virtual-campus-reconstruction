# 窗口 A：SYS-LAYER 消费者调查报告

- 工作项：`WI-PARALLEL-MAP-RECON-001`
- 窗口：A / SYS-LAYER 消费者
- 调查方式：只读 `task_plan.md`、`决策记录.md`、执行层系统卡、公开 Bundle、地图/运行证据和当前代码
- 报告状态：调查报告；非权威文档；未修改 sample、正式代码、系统卡、总账或决策记录
- 日期：2026-08-20

## 结论先行

1. **cars：FACT，直接消费者已定位**。`cars` 图层进入 `carTraffic()`，再进入道路寻路、路线创建和车辆 NPC。
2. **footsteps：FACT，直接消费者已定位**。独立 `footsteps-layer.json` grid 被玩家移动逻辑读取，生成 depth 450 的 footprint Sprite。
3. **particles / particles2：部分 FACT**。原站优化路径把两层写入可见 Tilemap，并保留 GID `69355–69359`；它们不是已证明的纯 marker，也没有找到 raw layer 到动态 trajectory 的直接链路。
4. **particles3：FACT + UNKNOWN**。原始 GID `69361` 共 86 个，但优化路径不创建 `particles3` 层；独立 trajectory 系统消费 `protesters_rising`，两者直接转换链未定位，`Q-LAYER-002` 保持 open。
5. **GID 69360：FACT + UNKNOWN**。原始 `particles` / `particles2` 数据中出现 206 次，但优化路径过滤掉它，Bundle 中没有找到其直接读取或创建链，`Q-LAYER-003` 保持 open。

## 1. cars

### FACT

1. 原始 chunk 含 `cars` 层；例如：
   - `sample/original-public-build/mirror/assets/maps/chunks/chunk14.json:8766`
   - 该层运行数据使用 GID `69345–69352`。

2. Bundle 优化写入名单包含 `cars`，并按 GID 过滤：
   - `sample/original-public-build/mirror/chunk-WMFY56ZM.js` byte `378447–380704`
   - `cars` 保留 `69345–69352`
   - 运行时 cars 层被设置为隐藏、alpha `.2`。

3. `carTraffic()` 扫描隐藏 cars Tilemap：
   - Bundle byte `383049–383709`
   - `69350`、`69351` 被分别收集为路线端点。
   - 路径邻接检查使用 `69345–69352`。

4. 后续链路：
   - `createAndDrawCarRoutes()`：约 byte `518680`
   - `findPathOnRoad()`：约 byte `519284`
   - `createCarsFromRoutes()`：约 byte `519436`
   - 最终创建 `car1`–`car11`、警车等车辆 Sprite。

5. 车辆资源请求可见于：
   - `sample/analysis/runtime-network.json:532` 及后续 cars 图片请求。

### INFERRED

`cars` 是路线/车辆系统的输入 marker，不是 SYS-LAYER 自己创建车辆。合理职责链为：

```text
SYS-LAYER / SYS-WORLD
  → cars marker 坐标
  → SYS-ROUTE 路线计算
  → SYS-NPC / SYS-ENTITY 车辆实体
```

### UNKNOWN

- 原站动态 chunk 装卸后是否重新扫描 `cars`。
- cars marker 与车辆实体是否具备完整 chunk-local 生命周期。
- 原站 `unloadChunk` 不清理 cars 是有意的场景级设计还是实现遗漏。

### 候选 DECISION（未接受）

保留 `cars` 为 chunk-owned marker；后续由独立 `SYS-ROUTE` / `SYS-NPC` 工作项消费，不把车辆逻辑塞回 SYS-LAYER。

## 2. particles / particles2

### FACT

1. 原站加载粒子 tileset：
   - Bundle byte `362343`
   - firstgid 为 `69355`
   - `sample/original-public-build/mirror/assets/maps/tileset-particles.tsx:2-3` 声明 7 个 tile，对应 `69355–69361`。

2. 优化路径明确包含 `particles`、`particles2`：
   - Bundle byte `378659` 附近的 22 层名单。
   - `particles` / `particles2` 过滤逻辑在 byte `379793–380704`：只保留 `C >= 69355 && C <= 69359`。
   - 因此 `69355–69359` 会写入 Tilemap。

3. Bundle 创建这些层时使用 `setVisible(y !== "walls")`，所以 particles/particles2 在该路径中会成为可见 Tilemap 层；运行快照也记录：
   - `sample/analysis/layer-visual-evidence/observations.json`
   - 多个场景中 `particles`、`particles2` 为 `visible: true`、`depth: 0`。

4. 原始数据中的 `69360`：
   - `chunk8.json`：36 次；
   - `chunk9.json`：170 次；
   - 合计 206 次，位于 `particles` / `particles2` 数据块。
   - 优化路径只保留到 `69359`，因此 `69360` 被过滤。

5. Bundle 全部公开 JS 中未找到字面量：
   - `particles3`
   - `69360`
   - `69361`

### INFERRED

`particles` / `particles2` 已确认存在如下 raw 消费路径：

```text
particles / particles2 raw layer
  → GID 过滤 69355–69359
  → Phaser Tilemap + tileset-particles
```

这与独立的 trajectory 动态系统不同。trajectory 链为：

```text
particle-trajectories.json
  → particleRegions
  → createAreaParticleEmitters
  → initCrowdStaticNPCs
  → updateProtestersRisingNPCs
```

对应证据：

- Bundle 加载独立 JSON：byte `336968`
- `this.particleRegions = e.regions`：byte `551417`
- 三类消费者：byte `551256`、`558928`、`565791`

目前没有证据证明 raw `particles` / `particles2` GID 会进入上述 trajectory 消费者。

### UNKNOWN

- `69355–69359` 各自代表哪一种粒子。
- `69360` 是未公开粒子类型、发布残留，还是被有意过滤。
- raw Tilemap 层的最终视觉效果是否完全依赖这些 GID。

### 候选 DECISION（未接受）

不要把 `particles` / `particles2` 原站事实直接定义成“纯 marker”。应拆分为：

1. raw Tilemap 视觉路径：`69355–69359`；
2. 独立 trajectory 动态粒子路径；
3. `69360` 未知路径，保持 UNKNOWN。

## 3. particles3 / Q-LAYER-002

### FACT

1. 原始 `particles3` 层存在：
   - `chunk14.json:18330` 为图层元数据；
   - `69361` 出现在 `chunk13.json`、`chunk14.json`；
   - 计数分别为 35、51，合计 86。

2. 优化 Bundle 的 22 层名单没有 `particles3`，也没有 `footsteps`：
   - Bundle byte `378659` 附近。
   - 运行证据记录 `mapHasParticles3: false`。
   - `sample/analysis/layer-visual-evidence/observations.json:2325-2537`

3. 独立 trajectory 文件存在一个：
   - `tileCount: 86`：`sample/original-public-build/mirror/assets/maps/particle-trajectories.json:8318`
   - `type: "protesters_rising"`：约 `:8589`
   - Bundle 通过 `updateProtestersRisingNPCs()` 创建/更新抗议者 Sprite。

### INFERRED

`particles3` 的 86 个 marker 与 `protesters_rising` 的 86 个 tileCount、空间区域高度吻合，可能来自同一设计数据。

但这只能证明数据关联，不能证明：

```text
particles3 GID 69361
  → marker 转换
  → protesters_rising trajectory
```

### UNKNOWN

`Q-LAYER-002` 仍然 open：

> GID 69361 是否被直接读取、转换成 trajectory region，或交给其他动态消费者？

目前 Bundle 未定位到直接读取或转换代码。

### 候选 DECISION（未接受）

继续保留 `69361` marker 和“消费者未接入”诊断；不得用 86 数量吻合或画面出现抗议人群来关闭 Q-LAYER-002。

当前代码按此处理：

- `src/layer/markers.ts:134-147`
- `game/PhaserWorldRenderer.ts:369-398`
- `scripts/browser-layer-smoke.mjs:69-73`

## 4. footsteps

### FACT

1. 原站加载独立文件：
   - Bundle byte `336968`
   - `https://peteroravec.com/assets/maps/footsteps-layer.json`
   - 网络证据：`sample/analysis/runtime-network.json:76`

2. 读取 grid：
   - Bundle byte `353489`
   - `this.footstepsGrid = t.grid`

3. 玩家移动时检查：
   - Bundle byte `406499`
   - 玩家速度绝对值大于 5；
   - intro 已完成；
   - 非 teleport；
   - 玩家 depth 小于 1000；
   - `(floor(player.x / 16), floor((player.y + 10) / 16))` 对应 grid 为 `1`；
   - 与上一个脚印距离至少 14px。

4. 脚印 Sprite：
   - `FOOTPRINT_DEPTH = 450`：Bundle byte `312851–312889`
   - pool / spawn / fade：约 byte `469090–470251`
   - 初始池约 `FOOTPRINT_MAX + 15`；
   - 延迟后淡出并回收到池。

5. 视觉证据：
   - `sample/analysis/layer-visual-evidence/observations.json:2540-2977`
   - active footprint 从 0 增至 5；
   - `footstepsDelta`：`:2984-2987`
   - 优化 Tilemap 没有 `footsteps` 层。

### INFERRED

footsteps 的真实职责链是：

```text
footsteps-layer.json grid
  → 玩家移动 / depth / 位置条件
  → SYS-FX footprint pool
  → depth 450 footprint Sprite
```

SYS-LAYER 只应提供地图 marker / grid 来源，不拥有脚印 Sprite 生命周期。

### UNKNOWN

- 具体脚印贴图和自然移动路径的全部边界行为。
- 脚印池与场景销毁、传送、重复触发的完整清理细节。

### 候选 DECISION（未接受）

后续由 SYS-FX 负责脚印效果；SYS-PLAYER / SYS-MOVE 只提供移动、朝向和 depth 输入。不要把脚印 Sprite 逻辑写回 SYS-LAYER。

## 5. 当前代码对照与冲突

### FACT

当前正式代码没有真实 cars、particle、footstep、protester 消费者：

- `src/layer/strategy.ts:11-48`：只声明 marker GID 白名单。
- `src/layer/markers.ts:69-147`：提取坐标并为 particles3 生成未消费诊断。
- `game/PhaserWorldRenderer.ts:525-595`：marker 层只写入/清除内存记录，不创建车辆、粒子或脚印。
- `game/CampusScene.ts:158-161`：只加载 exterior、collision、player 资源。
- `game/CampusScene.ts:331-352`：运行时 tileset 只有 exterior 和 collisions。
- 当前源码搜索只找到独立 URL 测试，没有 `carTraffic`、`footstepsGrid`、`particle-trajectories` 实际消费者。

### 冲突

当前 SYS-LAYER 卡和重构代码把 `particles` / `particles2` 定义为：

> marker 数据层，不直接显示 raw tile。

但原站 Bundle 明确：

- 将两层纳入优化写入名单；
- 保留 `69355–69359`；
- 创建可见 Tilemap 层；
- 加载 `tileset-particles`。

因此，“marker-only”是当前重构 DECISION / 实现边界，不是原站 FACT。应作为行为差距保留，不能写成原站语义。

## 6. 职责边界建议

- **SYS-CHUNK**：负责目标集合、请求、缓存、在途状态；不决定某一层是否全局持久。
- **SYS-WORLD**：负责 Tilemap/世界生命周期、chunk apply/remove 和 Scene destroy 边界。
- **SYS-LAYER**：负责 24 层策略、marker、roof、bridge 的图层语义；不负责 HTTP 和请求缓存。
- **SYS-ROUTE / SYS-NPC / SYS-ENTITY**：负责车辆路线、车辆实体和动态对象生命周期。
- **SYS-FX**：负责 footsteps Sprite，以及未来 raw particle / trajectory 的视觉效果。
- **SYS-PLAYER / SYS-MOVE**：向 footsteps 提供移动、朝向和 depth 输入。
- **SYS-NPC**：负责 `protesters_rising` 动态抗议者；不得假设其必然来自 particles3。

## 7. 候选 DECISION（未接受、未落盘）

> 保留 `cars`、`particles`、`particles2`、`particles3`、`footsteps` 的层来源和 chunk 坐标记录；SYS-LAYER 不直接创建车辆、NPC、粒子或脚印。对原站已经证明的 raw particles/particles2 Tilemap 路径和当前重构的 marker-only 方案分开记录；对 `particles3` 与 GID `69360` 保持 UNKNOWN，不通过数量吻合或过滤结果关闭 Q-LAYER-002/003。

## 8. 推荐后续工作项

### `WI-Q-LAYER-CONSUMER-CLOSURE-001`（P0）

只针对 Q-LAYER-002/003 做受控 Bundle 数据流审查：

1. 对 `particles3`、`69360` 做直接读取/转换查找；
2. 对 raw Tilemap 写入和 trajectory 初始化做运行时关联采样；
3. 停止条件是“找到直接链路”或“保留 UNKNOWN”，不得用计数吻合关闭问题。

### `WI-SYS-ROUTE-DESIGN-001`（P1）

处理 `cars → carTraffic → route → vehicle NPC`，明确 SYS-LAYER、SYS-ROUTE、SYS-NPC 的边界。

### `WI-SYS-FX-DESIGN-001`（P1）

处理 footsteps，以及 particles/particles2 raw visual 与独立 trajectory FX 的分离。

### `WI-SYS-NPC-DESIGN-001`（P1）

单独逆向 `protesters_rising` 的 Sprite、viewport、更新和销毁，不假设它来自 particles3。

## 9. 当前报告边界

- 已确认：只读完成 Bundle、地图、trajectory、运行采样和当前代码检索。
- 推断：particles3 与 protesters_rising 存在数据关联；particles/particles2 的 raw Tilemap 路径与动态 trajectory 路径分离。
- UNKNOWN：`Q-LAYER-002`、`Q-LAYER-003`，以及完整 cars/footsteps/particles 消费生命周期。
- 已落盘：本调查报告，仅位于 `task-todos/`，不是项目权威定义。
- 未落盘：任何新的 DECISION、系统卡变更、`task_plan.md` 工作项或正式实现授权。
- 本窗口没有修改 sample、正式 src/game、测试或权威状态文件；调查结束时主工作树已有其他 dirty 状态，未触碰或回滚。
