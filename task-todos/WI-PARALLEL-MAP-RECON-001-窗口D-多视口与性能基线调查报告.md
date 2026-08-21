# 窗口 D：多视口与性能基线调查报告

- 工作项：`WI-PARALLEL-MAP-RECON-001`
- 窗口：D / 多视口与性能基线
- 调查方式：只读读取 `task_plan.md`、`决策记录.md`、`03-执行层/00-总账.md`、SYS-CHUNK 卡；通过本 worktree 开发服务器和 CDP 浏览器采样
- 报告状态：调查报告；非权威文档；不代表最终性能结论
- 日期：2026-08-21

## 结论先行

1. 本轮覆盖 3 种 viewport、3 种 zoom、中心和两个地图边界，共 27 个样本。
2. 27/27 个样本满足稳定条件：目标集合与独立重算结果一致，`rendered == targets`，无在途请求，无失败记录。
3. 缓存集合和渲染集合保持分离：边界移动时渲染层数下降，但当前页面的 Chunk cache 通常保留已请求块，最高达到 25 块。
4. 小 viewport（320×240、780×437）在本次软件 WebGL 环境下观测到约 60 rAF FPS；1920×1080 在高渲染层数场景下约 25–35 rAF FPS，具体值随目标块数和位置变化。
5. 这些是当前实现、当前 Chromium、当前本地资源和当前采样窗口的 baseline，不是性能阈值，也不是最终性能结论。

## 1. 读取的当前约束

### SYS-CHUNK 当前要求

- 地图为 5×5 个 chunk。
- 每个 chunk 为 28×28 tile，tile 为 16×16 像素，世界为 2240×2240 像素。
- 目标集合为：玩家周围 3×3 与相机可见范围外扩 1 块的并集。
- 已下载 cache、当前 rendered 集合、requesting 状态必须分开观察。
- 当前卡明确保留多视口量化、严格 FPS/内存指标和完整 13 层语义为差距。

### 当前工作边界

- 不修改 `sample/`、正式 `src/`、`game/` 或权威文档。
- 本报告只记录当前运行时 baseline，不把 baseline 晋升为最终设计或性能结论。

## 2. 测试矩阵与原始结果摘要

下表中每个三元组顺序均为：**中心 / 西北边界 / 东南边界**。

- `target`：目标 chunk 数量。
- `cache`：ChunkDataStore 当前缓存数量。
- `layers`：`renderer.layers.size`。
- `FPS`：1500ms `requestAnimationFrame` 采样值，不等于固定物理步频。
- `heap`：`Runtime.getHeapUsage.usedSize`，单位 MB，按十进制近似。
- `requests`：该页面最终同源请求事件总数 / Chunk JSON 请求数；每页另有 1 次 master 请求。

| viewport / zoom | target | cache | layers | FPS | heap MB | requests 总数/Chunk |
|---|---:|---:|---:|---:|---:|---:|
| 320×240 / 0.5 | 16/16/6 | 20/24/24 | 304/304/114 | 60.6/60.3/60.4 | 161.7/159.0/78.3 | 74/24 |
| 320×240 / 1 | 16/9/4 | 20/23/23 | 304/171/76 | 60.4/60.5/60.2 | 176.8/129.1/128.6 | 73/23 |
| 320×240 / 2 | 16/9/4 | 20/23/23 | 304/171/76 | 60.2/60.2/60.2 | 167.7/114.1/64.1 | 73/23 |
| 780×437 / 0.5 | 20/25/12 | 25/25/25 | 380/475/228 | 60.7/60.7/60.6 | 262.2/294.6/298.6 | 75/25 |
| 780×437 / 1 | 20/12/6 | 25/25/25 | 380/228/114 | 60.6/60.5/60.6 | 230.0/131.1/65.9 | 75/25 |
| 780×437 / 2 | 20/9/6 | 25/25/25 | 380/171/114 | 60.7/60.3/60.4 | 200.2/93.7/166.6 | 75/25 |
| 1920×1080 / 0.5 | 20/22/20 | 25/25/25 | 380/418/380 | 30.9/26.3/29.5 | 234.3/263.7/275.8 | 75/25 |
| 1920×1080 / 1 | 25/25/20 | 25/25/25 | 475/475/380 | 26.4/25.6/32.3 | 244.3/255.9/259.1 | 75/25 |
| 1920×1080 / 2 | 25/12/15 | 25/25/25 | 475/228/285 | 34.7/40.0/43.8 | 238.5/256.6/153.6 | 75/25 |

### 2.1 集合验证结果

27 个样本均满足：

- `targetKeys` 与独立重算的 `player 3×3 ∪ camera +1` 完全一致；
- `rendered == targets`；
- `rendered ⊆ cached`；
- `requesting == []`；
- `failed == []`；
- 无 Runtime exception、失败请求或错误响应。

原始 JSON 中保存每个样本的完整 `targetKeys`、`expectedTargetKeys`、`cachedKeys`、`renderedKeys`、相机状态、FPS、heap、请求事件和稳定等待结果。

### 2.2 代表性集合

以默认 viewport `780×437`、zoom=1 为例：

- 中心：20 块；相机范围覆盖中部，目标集合为 20 块；
- 西北边界：12 块；目标集合被地图左、上边界裁剪；
- 东南边界：6 块；目标集合被地图右、下边界裁剪。

不同 zoom 会改变相机可见范围：默认 viewport 西北边界在 zoom 0.5、1、2 下分别观测到 25、12、9 块。

## 3. 执行命令

### 3.1 启动本 worktree 开发服务器

```bash
npm run dev -- --port 4200 > .pi/dev-4200.log 2>&1 &
```

4175 当前入口为 production-like 模式，未暴露 `__campusDebug`；因此本轮使用独立的 4200 开发端口。开发服务器的 `predev` 会准备被忽略的派生 `public/` 运行资源。

### 3.2 多视口、zoom、边界和性能采样

探针只放在 `.pi/`，不属于正式代码或权威文档；通过已有 `npm run browser:smoke` 入口加载。

```bash
NODE_OPTIONS=--import=./.pi/perf-bootstrap.mjs \
CDP_URL=http://127.0.0.1:9223 \
SMOKE_BASE_URL=http://127.0.0.1:4200 \
SMOKE_URL=http://127.0.0.1:4200/ \
PERF_SETTLE_TIMEOUT_MS=30000 \
npm run browser:smoke
```

探针参数：

- viewport：`320×240`、`780×437`、`1920×1080`；
- zoom：`0.5`、`1`、`2`；
- 玩家位置：中心 `(1120,1120)`、西北边界 `(8,8)`、东南边界 `(2232,2232)`；
- 每个 viewport×zoom 使用新页面，页面内依次采样三个玩家位置；
- 目标集合稳定后再进行 1500ms FPS 和内存采样。

### 3.3 项目既有跨块 Smoke

```bash
CDP_URL=http://127.0.0.1:9223 \
SMOKE_URL=http://127.0.0.1:4200/ \
npm run browser:chunk-smoke
```

结果：

- 初始请求 `chunk0.json`–`chunk19.json`；
- 移动后新增 `chunk21.json`–`chunk24.json`；
- 无异常、失败请求或错误响应；
- Smoke PASS。

碰撞 Smoke 也在 4200 开发入口通过，初始状态观测到 380 个 renderer layer、100 个 collision layer。

## 4. 原始结果位置

完整原始 JSON：

`.pi/window-d-perf-baseline-results.json`

生成时间：`2026-08-21T09:01:07.363Z`

关键采样参数：

```text
initialWaitMs: 6000
settleTimeoutMs: 30000
frameSampleMs: 1500
geometry: 5×5 chunks, 28×28 tiles/chunk, 16×16 px/tile
```

原始结果中的内存字段包括：

- `Runtime.getHeapUsage`；
- `performance.memory`（若 Chromium 提供）；
- `Performance.getMetrics`；
- DOM counter、请求事件和失败事件。

## 5. 异常与限制

1. **4175 调试入口限制**：4175 页面可以正常渲染，但没有 `__campusDebug`，直接运行依赖该 hook 的碰撞/生命周期 Smoke 会失败；这不是游戏运行异常，而是采样入口模式差异。
2. **软件 WebGL**：Chromium 输出了 automatic fallback to software WebGL 的 warning。没有 Runtime exception、失败请求或错误响应，但 FPS 不可直接外推到硬件 GPU。
3. **边界位置约束**：玩家有 20×8 body 和世界边界约束，请求 `(8,8)` 后实际约为 `(10,8)`；请求 `(2232,2232)` 后实际约为 `(2230,2220)`。报告使用实际观察位置记录集合。
4. **内存范围**：只测 JS heap，不含 GPU、纹理、原生对象和浏览器进程 RSS；没有强制 GC，数值可能受 GC 和前序渲染影响。
5. **FPS 口径**：记录的是 1500ms rAF 采样；Phaser 当前物理配置为固定 30 FPS，不能把 rAF 值直接当成游戏模拟步频。
6. **网络口径**：使用本地开发服务器，没有网络延迟、带宽、丢包或冷缓存控制；请求数量只代表本次页面和当前浏览器缓存条件。
7. **范围限制**：当前 renderer layer 数量按已实现的 19 个策略层计数；不代表完整 24 层消费者、原站特殊 13 层生命周期或完整玩法已经解决。
8. **工具限制**：直接执行一次性 Node CDP 探针被沙箱命令白名单拒绝，最终通过现有 `npm run browser:smoke` 加 `.pi` preload 完成同一 CDP 采样。

## 6. 文件边界与状态

- `git status --short -- src game sample 03-执行层` 无输出；本窗口没有修改正式代码、sample 或执行层文档。
- 本报告位于 `task-todos/`，按要求作为窗口交接记录，不是权威状态源。
- 原始探针和 JSON 仅位于 `.pi/`，未写入权威文档。
- baseline 状态：**已验证、已记录；未接受为最终性能标准，未落盘为权威性能结论。**
- 当前仍未解决：长期稳定性、真实硬件 GPU、完整内存占用、网络受限条件和完整系统性能阈值。
