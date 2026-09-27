---
tags:
  - 虚拟校园
  - 网络协议层
  - 传输契约
  - 骨架/皮
  - 配置下发
type: design
status: draft
knowledge-status: partial
created: 2026-09-14
updated: 2026-09-17
---

# 网络协议层 —— 传输侧设计

> 本层**没有原站对照**——查过原站网络证据（`sample/analysis/runtime-network.json`），六项契约里五项拿不到，其中时限 / 失败定性 / 撤回**原理上就查不到**（那是客户端逻辑，不是网络行为）。所以本篇不从逆向出发，而是从第一性原理出发，把六项传输契约逐一落到**代码位置**与**后台要求**。

---

## 👀 先看这里（给 Human 的人话总结）

**当前状态**：六项契约里 **① 地址、⑥ 撤回已实现**；**② 复用**实现了两层（在途去重 + 页内缓存，HTTP 缓存没有）；**④ 时限**只做了 JSON（图片无超时）；**⑤ 失败定性**四类已分开、**两套重试机制在跑**；**③ 配额完全没有**。

**还没做的**：并发上限与优先级队列（③）；图片超时（④）；单次循环内退避（⑤）；HTTP 缓存策略（②的第三层）；以及把六项参数收进**一个 `TransportConfig`**——现在全是散落的模块常量，没有一处能整体调参。

**你审的就认这几条**：

1. 六项契约的**形状**是骨架、**数字**是皮——换校园骨架一个字不动，只换数字（本篇的「一、契约落地」是骨架，「二、皮落地」是数字）。
2. 地址契约能压成**一个必下发值 + 三条推导**，换校园只改一个字符串（§一 契约 1）。
3. 六项参数收进**一个 `TransportConfig`**，启动时读一次、整场冻结（§三）。

**最要紧的一处**：将来按 ③ 加并发队列时，会多出一种「**已排队但还没发出**」的请求——`abort()` 够不着它们，必须让队列条目**自己可丢弃**，否则取消会静默失效（§一 契约 6）。

---

## 总览图：六项契约 → 代码 对照

```
契约                     代码
────────────────────    ────────────────────────────────────────────────
① 地址                  src/asset/urls.ts         (MAP_BASE_URL / chunkMasterUrl / tilesetImageUrl)
                        src/chunk/coordinates.ts  (chunkFileName)
                        src/chunk/data-store.ts   (resolveRelativeUrl)

② 复用                  src/chunk/data-store.ts   (#inFlight / #cache / #failures)
                        （HTTP 缓存：无）

③ 配额                  （无）

④ 时限                  game/fetchJson.ts         (JSON_REQUEST_TIMEOUT_MS)

⑤ 失败定性              game/fetchJson.ts         (TimeoutError / AbortError / 非 2xx)
                        src/chunk/data-store.ts   (#loadChunk 重试循环 / maxAttempts)
                        src/chunk/coordinator.ts  (#retryBackoff / retryFailedTargets)

⑥ 撤回                  src/chunk/data-store.ts   (#abortController)
                        src/chunk/coordinator.ts  (#applyIfCurrent 过期丢弃)
                        game/main.ts              (pagehide → shutdown)
```

---

## 一、契约落地

### 契约 1：地址——字节在哪个网址上

> 第一性原理：字节在某个网址上，网址 = 源 + 路径 + 查询。换校园时**变的是值，不变的是结构**，所以能压成「一个根 + 三条推导」。

**它怎么工作的**：

根值 `/assets/maps` 只在 `src/asset/urls.ts:9` 的 `MAP_BASE_URL` 定义一次；`game/CampusScene.ts` 的 5 处地图资源加载（181、589-592 行）全部调那里的拼装函数，代码里不再出现字面量路径。分块地址**相对 `master.json` 解析**（`resolveRelativeUrl`），不硬编码根路径。

```
        ┌─ 根（唯一必下发值）──────────────────────────┐
        │  mapBaseUrl = "https://cdn.x.edu/maps"       │
        └──────────────────────────────────────────────┘
                          │
      ┌───────────────────┴───────────────────┐
      ▼ 推导一：索引文件名固定                 ▼ 推导二：瓦片图 = 根 + image 名
   {根}/chunks/master.json                  {根}/{tileset.image}
      │
      ▼ 推导三：分块 = 相对索引地址解析
   {根}/chunks/chunk{index}.json
```

**为什么推导比清单好**：若后台下发一张「完整资源清单」，那张清单就得人为维护，早晚和磁盘实际文件对不上。而**推导不会不一致**——`master.json` 本身就是那份清单（它写着有几块、用什么瓦片集），它是唯一的真相源。

**运行期实际用到的路径**（去重后 16 条）：

| 类别 | 路径 | 出处 |
|---|---|---|
| 分块索引 | `/assets/maps/chunks/master.json` | `game/CampusScene.ts:181`（`CHUNK_MASTER_URL`，值来自 `chunkMasterUrl()`） |
| 地图底图 | `/assets/maps/exterior-final.webp` | `game/CampusScene.ts:589`（`tilesetImageUrl()`） |
| 碰撞图 | `/assets/maps/collisions-objects.webp` | `game/CampusScene.ts:590` |
| 墙体图层 | `/assets/maps/walls-layer.json` | `game/CampusScene.ts:591` |
| 粒子瓦片集 | `/assets/maps/tileset-particles.webp` | `game/CampusScene.ts:592` |
| 精灵 | `/sprites/**`、`/sprites/special/**`、`/sprites/cars/**` | 各 Runtime 的 `preload()` |
| 引擎 | `/vendor/phaser.min.js` | `public/vendor/` |
| 页面图片 | `/assets/images/**` | `public/assets/images/` |
| 页面地图缩略图 | `/assets/maps/mini-map.webp`、`/assets/maps/big-map.webp` | `index.html:676,705`（硬编码 `<img src>`） |

磁盘对应：`public/assets/maps/`（地图资源**全部**在此，含 `chunks/`）、`public/sprites/`、`public/assets/images/`、`public/vendor/`。`public/` **整个目录不进版本库**（`.gitignore:4`），由 `npm run prepare:runtime` → `scripts/prepare-runtime-assets.mjs` 从 `sample/` 镜像生成；脚本注释写明这是「创建 `public/` 的唯一受支持方式」。

**不在这个根里的两类**：① **页面地图缩略图**（`mini-map.webp`、`big-map.webp`）——网页 chrome，跟着 `index.html` 走；② **精灵与引擎**（`/sprites/**`、`/vendor/phaser.min.js`）——现在仍与原站不同名（原站是 `/assets/sprites/**`、`/assets/js/phaser.min.js`，见 §六）。

**代码在哪**：

| 做什么 | 文件路径 + 行号 | 关键函数/类型 |
|---|---|---|
| 地图资源根 | [src/asset/urls.ts](../../src/asset/urls.ts) 第 9 行 | `MAP_BASE_URL` |
| 索引 / 瓦片图 / 图层地址 | [src/asset/urls.ts](../../src/asset/urls.ts) | `chunkMasterUrl()` / `tilesetImageUrl()` / `independentLayerUrl()` |
| 运行期调用点 | [game/CampusScene.ts](../../game/CampusScene.ts) 第 181、589-592 行 | 5 处地图资源加载 |
| 分块文件名 | [src/chunk/coordinates.ts](../../src/chunk/coordinates.ts) 第 74-79 行 | `chunkFileName()` |
| 分块索引公式 | [src/chunk/coordinates.ts](../../src/chunk/coordinates.ts) 第 55-61 行 | `chunkCoordinateToIndex()` |
| 相对地址解析 | [src/chunk/data-store.ts](../../src/chunk/data-store.ts) | `resolveRelativeUrl()` |
| 瓦片集现场推导 | `scripts/` 与 `src/asset/` | `discoverOptimizedTilesets()` |

**设计动作**：`MAP_BASE_URL` 常量 → 改为从 `TransportConfig.mapBaseUrl` 取值。**改 `src/`，按 `AGENTS.md` §7 需要已授权的正式工作项**；在此之前根值仍是模块常量。

**怎么验证它做对了**：[tests/asset/runtime-assets.test.ts](../../tests/asset/runtime-assets.test.ts) 核对运行期资源布局与扩展名；5 个 `scripts/browser-*.mjs` 冒烟脚本断言实际请求的路径。

---

### 契约 2：复用——同样一块数据要不要再跑一趟

> 第一性原理：同一个字节搬两次要花两份成本（带宽、内存、电）。但「省」的手段有三种，**生命周期完全不同，别混为一谈**。

**它怎么工作的**：

| 层次 | 生命周期 | 管什么 | 我们有没有 |
|---|---|---|---|
| **在途去重** | 一个请求的飞行时间 | 同一坐标并发只发一次 | ✅ `#inFlight` |
| **内存缓存** | 页面存活期 | 已拿到的分块不再要 | ✅ `#cache` |
| **HTTP 缓存** | 跨页面 / 跨会话 | 关掉页面也不丢 | ❌ 无 `Cache-Control` / `ETag`，无持久存储 |

| 职责 | 实现 |
|---|---|
| 在途去重 | `#inFlight` Map —— 同一坐标的并发请求合并成同一个 Promise，后续复用 |
| 成功缓存 | `#cache` Map —— 命中直接返回，不再过网络 |
| 失败记忆 | `#failures` Map —— 记录坐标、错误类别、尝试次数；失败后不自动重发，除非显式调 `retryChunk()` |

**代码在哪**：

| 做什么 | 文件路径 + 行号 | 关键函数/类型 |
|---|---|---|
| 在途去重 | [src/chunk/data-store.ts](../../src/chunk/data-store.ts) 第 322-325 行 | `#inFlight` Map |
| 成功缓存 | [src/chunk/data-store.ts](../../src/chunk/data-store.ts) 第 173 行 | `#cache` Map |
| 失败记录 | [src/chunk/data-store.ts](../../src/chunk/data-store.ts) 第 175 行 | `#failures` Map |

**设计动作**：

1. **前两层保留**。它们是页内优化，和后台无关，换校园也不用改。
2. **第三层由后台下发**，且**必须按「名字是否带内容指纹」分档**——见 §五。这是本层对后台最硬的一条要求。
3. **措辞以「持久 / 页内」区分**：`API契约表.md` §十 说的「无缓存」指**没有持久缓存**；`ChunkDataStore` **确有页内内存缓存**，两者不矛盾。

**怎么验证它做对了**：[tests/chunk/data-store.test.ts](../../tests/chunk/data-store.test.ts) 覆盖缓存命中、在途去重、失败记录与销毁。

---

### 契约 3：配额——一次最多问几个

> 第一性原理：浏览器对**同一个源**（origin）的并发连接有硬上限，HTTP/1.1 通常 6 个。25 个分块一次全发，多出来的请求在浏览器层面排队——**而浏览器不认识游戏逻辑，不会把「玩家正前方的块」排到前面**。结果是玩家脚下那块可能要等最后一块。

**它怎么工作的**：**完全未实现**。`ChunkCoordinator.updateTargets()` 对所有目标块一起发请求，没有任何上限。

**这是本层唯一一个「只有游戏自己才知道」的信息**：优先级次序来自玩法（玩家 3×3 邻域 > 相机可见 > 其余），浏览器无从知晓。

**代码在哪**：无。要加的话落在 [src/chunk/coordinator.ts](../../src/chunk/coordinator.ts) 的 `updateTargets()`（第 113-163 行）。

**设计动作**：

1. 加 `maxInFlight` 上限 + 一个**优先级队列**。
2. **上限值下发（皮），优先级次序不下发（骨架）**——前者是部署环境的事（HTTP/1.1 还是 HTTP/2、有没有 CDN），后者是玩法的事。
3. 队列必须**可取消**——见契约 6。

**怎么验证它做对了**：待补。可用 `coordinator.state.requesting` 观察在途数量上界。

---

### 契约 4：时限——多久没回话算失败

> 第一性原理：延迟无上界，对方可能永远不回。所以**每个请求都必须有一个截止时刻**，且这个截止时刻要覆盖**全程**——只管到响应头是不够的，正文卡住时仍然会永久挂起。

**它怎么工作的**：

| 行为 | 实现 |
|---|---|
| 超时 | `JSON_REQUEST_TIMEOUT_MS = 15_000`（15 秒），`game/fetchJson.ts:1` |
| 超时覆盖范围 | **一个截止时刻同时管响应头和 JSON 正文的读取**（注释明确写了这一点） |
| 超时 vs 取消的区分 | 超时 → `TimeoutError`；生命周期取消 → `AbortError`。**两者名字不同，可分别处理** |
| 图片 / 瓦片集 | **无超时**，走 Phaser 的 `load.image()` / `load.json()`，不受 `fetchJson` 管，依赖浏览器默认 |

**代码在哪**：

| 做什么 | 文件路径 + 行号 | 关键函数/类型 |
|---|---|---|
| 统一 JSON 取数器 | [game/fetchJson.ts](../../game/fetchJson.ts) 第 1 行 | `JSON_REQUEST_TIMEOUT_MS` |
| 截止时刻与取消桥接 | [game/fetchJson.ts](../../game/fetchJson.ts) | `fetchJson()` |

**设计动作**：把 15 000 这个数字从常量挪进 `TransportConfig.timeouts.json`；补上 `timeouts.image`（图片 / 瓦片集超时）。

**怎么验证它做对了**：现有回归覆盖 JSON 超时分支；图片超时待补测试。

---

### 契约 5：失败定性——失败了算谁的账

> 第一性原理：失败不是一种。不同来源的失败**账不一样、处置也不一样**。分类错了会出现两种坏结果：把可恢复的当成致命（白放弃），或把致命的当成可恢复（白重试）。

**它怎么工作的**——四类失败，账不一样：

| 失败 | 产生方 | 名字 | 是否可重试 | 我们怎么处理 |
|---|---|---|---|---|
| 超时 | `fetchJson` 的定时器 | `TimeoutError` | ✅ 可重试 | `ChunkDataStore` 计入尝试次数 |
| 生命周期取消 | 调用方 / `destroy()` | `AbortError` | ❌ **不是失败** | 转 `ChunkRequestAbortedError`，不记失败、不报错 |
| 非 2xx | `fetchJson` 的 `!response.ok` | `Error` | ✅ 可重试 | 计入尝试次数 |
| 内容不合法 | `parseChunk` | `ChunkDataError` | ❌ **重试无意义** | 当前仍重试 |

**⚠️ 本项目有两套重试，不是一个**——这是本层最容易看错的地方：

| | 单次取数的重试循环 | 失败目标的重试调度 |
|---|---|---|
| 位置 | `src/chunk/data-store.ts` `#loadChunk()` | `src/chunk/coordinator.ts` `#retryBackoff` + `retryFailedTargets()` |
| 管什么 | 同一块**连发几次** | 失败过的目标**什么时候才准再试** |
| 次数 | **3**（`data-store.ts:186`，唯一定义处） | 无固定次数 |
| 退避 | **无**——`await` 完立即重发 | **有，指数退避**：2 500 ms 起、每次翻倍、封顶 30 000 ms |
| 谁驱动 | 循环自己 | `game/CampusScene.ts:2189`——**每次目标集合更新时检查一遍**（不是定时器） |

> **驱动方式的含义**：重试由「目标集合更新」触发，所以**玩家站着不动时不会重试**。这本身合理（没人动就没必要重试），但要清楚它不是后台定时轮询。

**代码在哪**：

| 做什么 | 文件路径 + 行号 | 关键函数/类型 |
|---|---|---|
| 重试循环 | [src/chunk/data-store.ts](../../src/chunk/data-store.ts) 第 348-428 行 | `#loadChunk()` |
| 尝试次数默认值 | [src/chunk/data-store.ts](../../src/chunk/data-store.ts) 第 186 行 | `maxAttempts ?? 3` |
| 调用点传值 | [game/CampusScene.ts](../../game/CampusScene.ts) 第 1346 行 | `{ maxAttempts: 3 }` |
| 失败退避记录 | [src/chunk/coordinator.ts](../../src/chunk/coordinator.ts) 第 184-185 行 | `#retryBackoff` 的 `nextAt` 放行 |
| 退避曲线 | [src/chunk/coordinator.ts](../../src/chunk/coordinator.ts) 第 233 行 | 初始 2 500 ms、翻倍、封顶 30 000 ms |
| 退避驱动 | [game/CampusScene.ts](../../game/CampusScene.ts) 第 2189 行 | 每次目标集合更新调 `retryFailedTargets()` |

**设计动作**：

1. **把第 4 类从重试路径里拿出来**。JSON 格式错、图层数不对——重试拿到的还是同一个坏文件，纯浪费请求。按[统一失败处理策略](../03-执行层/统一失败处理策略.md)的三级分类，这类应走「致命 / 可降级」，不该走「可恢复」的重试。**这是本层唯一建议改现有行为的地方**。
2. **单次循环内补退避**。目标级调度**已经有退避**，但同一块内的连发仍是零间隔——两层要对齐，否则第一轮连发就把服务器砸了。
3. **配置默认值取现状，不是重设**：`maxAttempts = 3`、`backoffInitialMs = 2500`、`backoffFactor = 2`、`backoffMaxMs = 30000`。
4. **`maxAttempts` 只留一个定义处**（`data-store.ts:186`），调用点不单独调低。

**怎么验证它做对了**：[tests/chunk/data-store.test.ts](../../tests/chunk/data-store.test.ts) 覆盖失败与重试分支；[tests/chunk/coordinator.test.ts](../../tests/chunk/coordinator.test.ts) 覆盖退避放行与过期守卫。

---

### 契约 6：撤回——不要了怎么把请求截回来

> 第一性原理：用户会中途不要了（关页面、点 Retry、走出加载范围）。不管的话，旧请求回来时会**污染新状态**——这是状态机的正确性问题，不是性能问题。

**它怎么工作的**：

| 场景 | 谁触发 | 我们怎么做 |
|---|---|---|
| 玩家走出目标范围 | `ChunkCoordinator` | 从 `#targets` 移除 → 丢弃过期响应（`#applyIfCurrent` 里查 `#targets.has(key)`） |
| 用户点 Retry / 关页面 | `AppRuntime.cleanup` | `dataStore.destroy()` → `abortController.abort()` → 全部在途请求中断 |
| 页面关闭（`pagehide`） | `game/main.ts` | `appRuntime.shutdown()` → 清理全链路 |

**关键约定（已实现且必须保持）**：取消是**正常行为**，不是失败——不触发错误状态、不打印错误日志、不计入 `#failures`。这条写在[统一失败处理策略](../03-执行层/统一失败处理策略.md) §二.4，代码里由 `isChunkRequestAbortedError` 落实。

**⚠️ 加并发队列会新开一个取消口子**：现在「取消」只需管**已发出**的请求（一个 `AbortController` 全断）。一旦按契约 3 加了排队，就出现第三种状态：**已排队但还没发出**。这类请求不能靠 `abort()` 取消（还没进 `fetch`），必须从队列里**移除**，否则取消后还会照样发出去——**取消就失效了**。所以契约 3 和契约 6 必须一起设计：**队列的每个条目都要能单独丢弃**。

**代码在哪**：

| 做什么 | 文件路径 + 行号 | 关键函数/类型 |
|---|---|---|
| abort 控制器 | [src/chunk/data-store.ts](../../src/chunk/data-store.ts) 第 17 / 177 行 | `#abortController` / `#throwIfDestroyed()` |
| 取消识别 | [src/chunk/data-store.ts](../../src/chunk/data-store.ts) 第 31-39 行 | `isChunkRequestAbortedError()` |
| apply 前过期检查 | [src/chunk/coordinator.ts](../../src/chunk/coordinator.ts) 第 242-248 行 | `#applyIfCurrent()` 守卫 |
| remove 前过期检查 | [src/chunk/coordinator.ts](../../src/chunk/coordinator.ts) 第 272-274 行 | `#removeIfCurrent()` 守卫 |
| 协调器销毁 | [src/chunk/coordinator.ts](../../src/chunk/coordinator.ts) 第 178-198 行 | `destroyAsync()` |
| 页面关闭 | [game/main.ts](../../game/main.ts) | `pagehide` → `appRuntime.shutdown()` |

**设计动作**：加队列时，队列条目自带取消标记；`destroy()` / 目标移除时一并从队列剔除。**待授权**（同契约 3）。

**怎么验证它做对了**：[tests/chunk/coordinator.test.ts](../../tests/chunk/coordinator.test.ts) 测试过期结果被拒绝；浏览器 `browser:lifecycle-smoke` 验证销毁后无异常 / 无失败请求。

---

## 二、皮落地

**皮 = 跟具体校园绑定、换校园要改的数字**。全部数字的唯一实测出处是本节。

| 皮 | 精确值 | 在哪 |
|---|---|---|
| 地图资源根 | `/assets/maps` | [src/asset/urls.ts](../../src/asset/urls.ts) 第 9 行 `MAP_BASE_URL` |
| JSON 取数超时 | 15 000 ms | [game/fetchJson.ts](../../game/fetchJson.ts) 第 1 行 |
| 图片 / 瓦片集超时 | 无（依赖浏览器默认） | —— |
| 单次循环最大尝试 | 3 | [src/chunk/data-store.ts](../../src/chunk/data-store.ts) 第 186 行 |
| 目标级退避初值 | 2 500 ms | [src/chunk/coordinator.ts](../../src/chunk/coordinator.ts) 第 233 行 |
| 目标级退避倍数 | 2（每次翻倍） | 同上 |
| 目标级退避上限 | 30 000 ms | 同上 |
| 并发上限 | 无上限（未实现） | —— |
| 分块文件名格式 | `chunk{index}.json` | [src/chunk/coordinates.ts](../../src/chunk/coordinates.ts) 第 74-79 行 |
| 分块索引公式 | `index = y × 横向块数 + x` | [src/chunk/coordinates.ts](../../src/chunk/coordinates.ts) 第 55-61 行 |
| 地图资源扩展名 | `.webp`（`collisions-objects` / `tileset-particles`） | `public/assets/maps/`（同名 `.png` 是 Tiled 作图源，运行期不用） |

**地址契约的特殊之处**：其余契约的皮是一串数字，**地址契约的皮只有一个值**（`mapBaseUrl`）。这是契约 1 那条推导规则带来的红利——本来可能是一张清单，现在是一个字符串。

---

## 三、配置点：TransportConfig

**为什么必须收成一个配置**：六项契约的参数**互相制约**（提高并发会撞上源上限、加长缓存会和换校园打架、多重试会砸服务器）。它们若分散在各处各自读取，就会出现「同一次会话里一半请求用旧超时、一半用新超时」——这是**不一致状态**，比参数取值本身不对更难查。

> 对照现状：`MAP_BASE_URL`、`JSON_REQUEST_TIMEOUT_MS`、`maxAttempts` 现在是三个互不相干的模块常量 / 构造参数，没有任何一处能整体调参。**待建**。

**配置的形状**：

```
TransportConfig
├── mapBaseUrl: string            地图运行资源根。唯一必下发值。默认 "/assets/maps"
├── timeouts
│   ├── json: number              JSON 取数截止时长（毫秒）。现状 15000
│   └── image: number             图片 / 瓦片集截止时长。现状：无（缺口）
├── retry
│   ├── maxAttempts: number       单次循环内最多连发几次。现状 3
│   ├── backoffInitialMs: number  目标级重试的首次等待。现状 2500
│   ├── backoffFactor: number     每次失败后等待翻几倍。现状 2
│   └── backoffMaxMs: number      等待上限。现状 30000
└── concurrency
    └── maxInFlight: number       同一时刻最多几个在途。现状：无限（缺口）
```

每个字段都能追溯到「现值」（§二）或「缺口」，没有凭空发明的参数。

**配置从哪来：三个来源，优先级递增**：

| 优先级 | 来源 | 用途 | 现状 |
|---|---|---|---|
| 低 | 代码内置默认值 `DEFAULT_TRANSPORT_CONFIG` | 本地开发**零配置就能跑** | 待建 |
| 中 | 构建期注入（Vite 环境变量） | 单校园固定部署 | 待建 |
| 高 | 后台运行时下发（启动时拉一次） | 换校园 / 多租户 | 待建（Phase 2） |

**三条设计约束**：

1. **默认值必须能独立工作**。缺了后台，`npm run dev` 也要能跑起来——这是「后端还没做，前端先能开发」的前提。
2. **只有一处读取点**。启动时读一次、冻结，之后只读不写。
3. **下发失败要降级到默认值，不能白屏**。后台挂了不等于游戏不能玩——和[统一失败处理策略](../03-执行层/统一失败处理策略.md)的「可降级」是同一条原则。

---

## 四、测试覆盖

| 测试文件 | 测什么 |
|---|---|
| [tests/chunk/data-store.test.ts](../../tests/chunk/data-store.test.ts) | master / chunk 加载、缓存命中、在途去重、失败记录、重试、取消、销毁 |
| [tests/chunk/coordinator.test.ts](../../tests/chunk/coordinator.test.ts) | 目标更新、apply/remove 调度、三态一致性、过期守卫、退避放行、`destroyAsync` |
| [tests/asset/runtime-assets.test.ts](../../tests/asset/runtime-assets.test.ts) | 运行期资源布局、扩展名（`.webp`）、尺寸 |
| [tests/world/world.test.ts](../../tests/world/world.test.ts) | World apply/remove 集成 |
| `scripts/browser-chunk-smoke.mjs` | 浏览器分块 Smoke：动态装卸、请求路径断言 |
| `scripts/browser-lifecycle-smoke.mjs` | 生命周期 Smoke：销毁后无残留请求 |
| **缺口** | **图片 / 瓦片集超时**（契约 4）、**并发上限与队列**（契约 3）**无测试** |

---

## 五、后台要做什么（Phase 2 交付）

### 五.1 后台要下发的参数

| 参数 | 现值（出处见 §二） | 后台应下发 |
|---|---|---|
| **地图资源根** | `/assets/maps`（`src/asset/urls.ts:9`，运行期唯一入口） | 每校园一个根 |
| `timeouts.json` | 15 000 ms（`game/fetchJson.ts:1`） | 按资源类型分档 |
| `timeouts.image` | 无 | 30s 起 |
| `retry.maxAttempts` | 3（`src/chunk/data-store.ts:186`） | 做成可配 |
| `retry.backoff*` | 2 500 ms 起、翻倍、封顶 30 000 ms | 保持现状即可，做成可配 |
| `concurrency.maxInFlight` | 无限 | 建议 6 起 |
| 缓存策略 | 无 HTTP 缓存 | 按资源类别分档（§五.3） |

**两条不下发的**：① **优先级次序**（玩家 3×3 > 相机可见 > 其余）——这是玩法，属骨架（契约 3）；② **页面地图缩略图的路径**（`/assets/maps/mini-map.webp` 等）——这是网页 chrome，跟着 `index.html` 走，不属于游戏资源根。

### 五.2 后台作为服务器必须做对的四件事

1. **内容类型标记（MIME type）正确**。分块 JSON 必须以 `application/json` 返回。若后台把 JSON 当 `text/html` 返回，前端 JSON 解析会失败，而失败会走契约 5 的重试路径——**3 次全废**。
2. **404 必须真的是 404**，不能返「200 + 一个 HTML 错误页」。前端靠「状态码不是 2xx」判断失败；错误页返 200 会让前端误以为拿到了数据，然后在解析环节以更难查的方式炸掉。
3. **跨域（CORS）**。现在资源全部同源，没有跨域需求。一旦把资源挪到 CDN 域名（`mapBaseUrl` 换成绝对网址），就必须配 CORS，否则所有资源请求直接失败。**这是把根路径改成可下发之后新引入的风险**。
4. **带内容指纹的资源才配长缓存**。前端产物（`main-*.js`）名字里带指纹，可以标长缓存；**地图数据是固定名**（`chunk0.json`），换校园就变，**必须短缓存或协商缓存**。这两类千万不能一刀切。

### 五.3 换校园时的缓存分档建议

**这一档是建议，不是实测事实**——原站缓存头未确认（§六），我们自己也还没实现。

| 资源类别 | 命名方式 | 建议 |
|---|---|---|
| 前端产物（JS / CSS） | 内容哈希 | `Cache-Control: public, max-age=31536000, immutable`（存一年，永不重问） |
| 引擎（phaser.min.js） | 固定名，版本稳定 | 长缓存 + `ETag` |
| 瓦片集 / 精灵图 | 固定名，换校园会变 | `max-age=3600` + `ETag`，靠协商缓存 |
| 地图数据（`final_map.json`、`chunk*.json`） | 固定名，换校园必变 | `no-cache` + `ETag`，每次协商 |

> **分档依据**（第一性原理）：**名字里有没有内容指纹**。有指纹 → 内容变名字就变 → 可放心永久缓存。没指纹 → 内容变了名字没变 → 必须每次问，否则玩家拿到上一个校园的地图。

---

## 六、缺口与边界

### 六.1 缺口（我们这边）

| 优先级 | 缺口 | 说明 |
|---|---|---|
| P0 | **并发上限 + 优先级排队**（契约 3） | 完全没有。25 块一起发，玩家脚下的块可能最后到。加队列时别忘契约 6 的取消口子 |
| P0 | **图片 / 瓦片集加载无超时、无取消**（契约 4） | 走 Phaser 的 `load.image()` / `load.json()`，不受 `fetchJson` 管。[统一失败处理策略](../03-执行层/统一失败处理策略.md) §四把它记在 **SYS-ASSET** 名下列为 P0 |
| P0 | **没有 `TransportConfig`**（§三） | 参数散落成模块常量，无法整体调参，也无法下发 |
| P1 | **第 4 类失败（内容不合法）仍走重试**（契约 5） | 重试拿到的还是同一个坏文件，纯浪费请求 |
| P1 | **根值仍是模块常量**（契约 1） | 未从 `TransportConfig` 取，换校园仍需改代码 |
| P2 | **单次循环内无退避**（契约 5） | 同一块连发 `maxAttempts` 次之间零间隔；目标级虽有退避，第一轮连发仍会同时砸出去 |
| P2 | **无 HTTP 缓存策略**（契约 2） | 换校园后整包重下 |

### 六.2 边界：本层不含原站分析

本层**不承载原站侧分析**。这一层几乎无法从原站逆向——查过原站网络证据（`sample/analysis/runtime-network.json`），六项契约里五项拿不到：

| 契约 | 原站能查到吗 | 为什么 |
|---|---|---|
| ① 地址 | ✅ 拿到了 | 每条记录都有完整 URL |
| ② 复用（HTTP 缓存） | ❌ | 记录里**没有响应头字段**，`Cache-Control` / `ETag` / `Expires` 无从得知 |
| ③ 配额（并发） | ❌ | 时间戳是采集器登记的，**396 条挤在 14.6 毫秒里**，物理上不可能，分辨率不足 |
| ④ 时限（超时） | ❌ **原理上就查不到** | 超时是**客户端逻辑**，网络日志只记「实际发出去了什么」 |
| ⑤ 失败定性 | ❌ | 那次采集**全程 0 失败**（396 条全 200、0 重复），失败路径一次没被触发 |
| ⑥ 撤回（取消） | ❌ **原理上就查不到** | 同④，被取消的请求不会出现在请求列表里 |

④⑤⑥ **再采一次也拿不到**——那是前端代码里的决定，不是网络行为。原始文件仍在 `sample/analysis/runtime-network.json`，只读边界见 `AGENTS.md` §10。

### 六.3 后续可做的事

| # | 事 | 状态 |
|---|---|---|
| 1 | 把 `TransportConfig` 落成 `src/` 代码 | **待授权**——改 `src/` 按 `AGENTS.md` §7 需要已授权的正式工作项 |
| 2 | `MAP_BASE_URL` 改为从 `TransportConfig.mapBaseUrl` 取值 | **待授权**（同上，契约 1） |
| 3 | `/sprites/**` 与 `/vendor/phaser.min.js` 跟原站对齐 | **待裁决**——原站分别是 `/assets/sprites/**` 和 `/assets/js/phaser.min.js` |

---

## 七、所有代码位置一页速查

```
src/asset/
  urls.ts             — MAP_BASE_URL 常量、chunkMasterUrl() / tilesetImageUrl() / independentLayerUrl()
                        （运行期地图资源地址的唯一入口）

src/chunk/
  coordinates.ts      — ChunkCoordinate / ChunkGeometry 类型
                      — chunkCoordinateToIndex() / chunkFileName()
  data-store.ts       — ChunkDataStore 类（master/chunk 加载、#inFlight 去重、#cache、#failures）
                      — #abortController / isChunkRequestAbortedError()（撤回契约）
                      — #loadChunk() 重试循环 + maxAttempts（失败定性契约）
                      — resolveRelativeUrl()（地址契约）
  coordinator.ts      — ChunkCoordinator 类（updateTargets / applyIfCurrent / removeIfCurrent）
                      — #retryBackoff / retryFailedTargets()（目标级指数退避）

game/
  fetchJson.ts        — JSON_REQUEST_TIMEOUT_MS = 15_000、fetchJson()（超时与取消桥接）
  CampusScene.ts      — 地图资源加载调用点（181、589-592）；重试调度驱动（2189）；maxAttempts 传值（1346）
  main.ts             — pagehide → appRuntime.shutdown()

scripts/
  prepare-runtime-assets.mjs — 从 sample/ 镜像生成 public/（创建 public/ 的唯一受支持方式）

tests/
  chunk/data-store.test.ts    — 缓存 / 去重 / 失败 / 重试 / 取消 / 销毁
  chunk/coordinator.test.ts   — 目标调度 / 过期守卫 / 退避放行
  asset/runtime-assets.test.ts — 运行期资源布局与扩展名
```

---

## 八、状态声明

本文件严格区分三类内容：

- **实测**（契约 1-6 的「它怎么工作的」「代码在哪」、§二 皮落地）：来自当前 `game/`、`src/` 代码与 `public/` 磁盘布局，可逐条核对行号。
- **设计**（各契约的「设计动作」、§三、§五.3、§六.3）：**是设计，不是已落码的实现**。
- **已排除**（§六.2）：原站侧为何不可逆向后不再承载，不补猜。

**地址契约已定的两条**：① 地图资源根改为**后台可下发**的配置（**未落码**）；② 根值**取 `/assets/maps`**、运行期统一走 `src/asset/urls.ts`（**已落码**）。其余设计动作尚未定稿。

**本文件状态：`draft`，待 Human 审查。** 未经签字前，本文件不构成对 `src/` 的写入授权，也不改变 [API契约表](../02-接口层/API契约表.md) 的现有契约。

---

## 关联文档

- [API 契约表（L1+L2）](../02-接口层/API契约表.md) — §十 声明网络协议细节由本层承接
- [统一失败处理策略](../03-执行层/统一失败处理策略.md) — 三级分类 + 异步操作四条要求
- [地图分块（SYS-CHUNK）](../03-执行层/01-地图线/04-地图分块.md) — 分块请求的去重与取消
- [资源加载（SYS-ASSET）](../03-执行层/01-地图线/01-资源加载.md) — 地图资源根的落点
- [换皮配置总表](../换皮配置总表.md) — §六 网络协议层板块
- [名词解释表](../名词解释表.md) — §二十四 本层词条 #227–#258
