---
tags:
  - 虚拟校园
  - 接口层
  - API设计
type: design
created: 2026-08-24
updated: 2026-08-24
---

# API 细化设计（全 16 系统 L1+L2 精确契约）

> **目的**：为全部 16 个系统提供精确到字段级别的接口契约。
> **层级**：L1 = 全局索引速查表；L2 = 每个接口的 14 字段精确定义。
> **结论级别**：FACT（原站证据）> INFERRED（推断）> DECISION（设计决定）> UNKNOWN（未弄清）
> **冻结规矩**：已冻结接口（`API契约表.md`）只补充细化，不修改语义。修改需同步两张表。

---

## L1：全局接口索引

### 地图线（4 系统，串行）

| 接口ID | 接口名 | 调用方 → 提供方 | 作用（人话） | 结论级别 |
|---|---|---|---|---|
| API-ASSET-001 | 资源清单查询 | WORLD/LAYER → ASSET | 查询某个资源 key 对应的 URL 和加载状态 | FACT |
| API-ASSET-002 | 瓦片集发现 | WORLD → ASSET | 从 final_map_small.json 元数据推导出全部切块瓦片集 key | FACT |
| API-ASSET-003 | 资源就绪检查 | WORLD/CHUNK → ASSET | 检查某个资源 key 是否已加载完成 | INFERRED |
| API-WORLD-001 | createWorld | APP/CHUNK → WORLD | 创建全局 Tilemap 和所有图层实例，返回 ready 世界 | DECISION |
| API-WORLD-002 | destroyWorld | APP → WORLD | 销毁世界：禁止新写入、断开碰撞、释放图层和 Tilemap | DECISION |
| API-WORLD-003 | applyChunk | CHUNK → WORLD | 把一块已验证的 chunk 数据写入世界 Tilemap 对应区域 | DECISION |
| API-WORLD-004 | removeChunk | CHUNK → WORLD | 清除一块 chunk 在世界 Tilemap 中的对应区域 | DECISION |
| API-WORLD-005 | worldSpec | 任意系统 → WORLD | 只读查询世界规格（尺寸、tile大小、像素范围） | DECISION |
| API-LAYER-001 | 图层策略查询 | WORLD/CHUNK → LAYER | 按层名取得该层的处理策略（depth/可见性/碰撞/GID过滤） | DECISION |
| API-LAYER-002 | 玩家深度计算 | PLAYER → LAYER | 按玩家 Y 坐标计算动态深度（常态 + 桥上/特殊覆盖） | DECISION |
| API-LAYER-003 | roof淡隐控制 | ZONE → LAYER | 玩家进入/离开 roof 区域时，对应 roof 层 300ms 淡隐/恢复 | FACT |
| API-LAYER-004 | bridge状态切换 | ZONE → LAYER | 玩家上下桥时，切换上下层可见性、碰撞和玩家深度 | FACT |
| API-LAYER-005 | 碰撞GID判定 | MOVE → LAYER | 查询某个 tile GID 是否应该参与碰撞 | FACT |
| API-CHUNK-001 | 目标集合计算 | CHUNK → CHUNK | 给定玩家位置和相机视口，计算需要加载的 chunk 坐标集合 | DECISION |
| API-CHUNK-002 | chunk坐标索引 | CHUNK → CHUNK | 世界坐标 (x,y) → chunk 坐标 (cx,cy) 和文件索引 | FACT |
| API-CHUNK-003 | 玩家邻域 | CHUNK → CHUNK | 给定玩家世界坐标，返回 3×3 邻域 chunk 坐标集合 | DECISION |
| API-CHUNK-004 | 相机可见范围 | CAMERA → CHUNK | 给定相机视口参数，返回可见 chunk 坐标集合（含 +1 边距） | DECISION |

### 玩法线（4 系统，串行）

| 接口ID | 接口名 | 调用方 → 提供方 | 作用（人话） | 结论级别 |
|---|---|---|---|---|
| API-INPUT-001 | 键盘方向解析 | INPUT → INPUT | 合并方向键+WASD 键态，解析为 8 方向 | FACT |
| API-INPUT-002 | 摇杆方向解析 | INPUT → INPUT | 读摇杆 forceX/forceY，量化为主轴/对角 8 方向 | FACT |
| API-INPUT-003 | 方向归一化 | MOVE → INPUT | 统一入口：键盘或摇杆 → 8 方向 + 速度 | FACT |
| API-INPUT-004 | 摇杆参数 | UI → INPUT | 查询当前设备摇杆参数（radius/位置/阈值） | FACT |
| API-MOVE-001 | 速度计算 | PLAYER → MOVE | 给定方向和 blocked 标志，返回 (vx, vy) | FACT |
| API-MOVE-002 | 这格能走吗 | MOVE → WORLD/LAYER | 给定世界坐标(x,y)，判定该格是否可走（非墙壁） | FACT |
| API-MOVE-003 | blocked方向判定 | PLAYER → MOVE | 给定 Phaser body.blocked 标志，判定哪些方向被卡住 | FACT |
| API-PLAYER-001 | 出生点 | WORLD → PLAYER | 返回玩家出生世界坐标 (1088, 304) | FACT |
| API-PLAYER-002 | 动态深度 | PLAYER → LAYER | 请求当前玩家 depth（常态 Y排序 + 桥上/特殊覆盖） | FACT |
| API-PLAYER-003 | 空闲动作判定 | PLAYER → PLAYER | 给定静止时长，判定当前应播放的空闲动作 | FACT |
| API-PLAYER-004 | 换装状态 | ZONE → PLAYER | 触发沙滩换装（脱衣/穿衣动画 + 尺寸切换） | FACT |
| API-PLAYER-005 | 朝向 | MOVE → PLAYER | 查询/设置玩家当前朝向（8 方向之一，默认 south） | FACT |
| API-CAMERA-001 | startFollow | PLAYER → CAMERA | 相机硬跟随玩家（lerp=1 逐帧贴住） | FACT |
| API-CAMERA-002 | 相机边界 | WORLD → CAMERA | 返回相机世界边界 (0,0,2240,2240) | FACT |
| API-CAMERA-003 | 航拍序列 | APP → CAMERA | 返回开场 6 点航拍序列（坐标+耗时+停留） | FACT |
| API-CAMERA-004 | 可见范围 | CHUNK → CAMERA | 给定相机当前 scrollX/Y/zoom/width/height，返回视口矩形 | FACT |

### 内容线（2 系统，串行）

| 接口ID | 接口名 | 调用方 → 提供方 | 作用（人话） | 结论级别 |
|---|---|---|---|---|
| API-ZONE-001 | 区域注册 | WORLD → ZONE | 注册一个触发区域（矩形/多边形 + 进入/离开回调） | INFERRED |
| API-ZONE-002 | 玩家进入判定 | ZONE → ZONE | 每帧检查玩家位置是否落入任一注册区域 | INFERRED |
| API-ZONE-003 | 区域查询 | INTERACT → ZONE | 查询玩家当前所在区域列表 | INFERRED |
| API-INTERACT-001 | 弹窗触发 | ZONE → INTERACT | 玩家进入触发区域时，弹出对应内容弹窗 | INFERRED |
| API-INTERACT-002 | 弹窗关闭 | GAME-UI → INTERACT | 玩家关闭弹窗，恢复游戏控制 | INFERRED |
| API-INTERACT-003 | 弹窗内容 | INTERACT → INTERACT | 查询弹窗配置（标题/正文/图片/按钮） | INFERRED |

### 独立件（3 系统，并行）

| 接口ID | 接口名 | 调用方 → 提供方 | 作用（人话） | 结论级别 |
|---|---|---|---|---|
| API-APP-001 | 应用启动 | 浏览器 → APP | 初始化 Angular/Phaser 框架，加载首页 | INFERRED |
| API-APP-002 | 场景切换 | APP → APP | 首页 → 游戏场景的切换（含 play 按钮） | INFERRED |
| API-APP-003 | 页面生命周期 | 浏览器 → APP | 页面可见性变化、卸载前保存状态 | INFERRED |
| API-GAME-UI-001 | HUD更新 | VARIOUS → GAME-UI | 更新 HUD 显示（坐标/状态/调试信息） | INFERRED |
| API-GAME-UI-002 | 摇杆UI | INPUT → GAME-UI | 创建/显示/隐藏虚拟摇杆 DOM 元素 | INFERRED |
| API-GAME-UI-003 | 对话框UI | INTERACT → GAME-UI | 渲染弹窗 UI（标题/正文/按钮/卡牌） | INFERRED |
| API-ENTITY-001 | 实体注册 | NPC/ROUTE/FX → ENTITY | 注册一个游戏实体到全局生命周期管理 | INFERRED |
| API-ENTITY-002 | 实体销毁 | ENTITY → ENTITY | 销毁一个实体及其所有关联资源 | INFERRED |
| API-ENTITY-003 | 生命周期钩子 | ENTITY → ENTITY | 场景暂停/恢复/销毁时的全局通知 | INFERRED |

### 旁支（3 系统，世界盖好后并行）

| 接口ID | 接口名 | 调用方 → 提供方 | 作用（人话） | 结论级别 |
|---|---|---|---|---|
| API-NPC-001 | NPC注册 | WORLD → NPC | 在世界中注册一个 NPC 实例（位置/贴图/动画） | INFERRED |
| API-NPC-002 | 寻路查询 | NPC → MOVE | 查询 walls-layer.json 网格 `grid[y][x]` 是否可走 | INFERRED |
| API-NPC-003 | NPC动画状态 | ENTITY → NPC | 查询/设置 NPC 当前动画状态（idle/walk/talk） | INFERRED |
| API-ROUTE-001 | 车辆注册 | WORLD → ROUTE | 注册一辆车（位置/路线/速度/贴图） | INFERRED |
| API-ROUTE-002 | 车辆路线推进 | ROUTE → ROUTE | 每帧推进车辆沿路线移动 | INFERRED |
| API-ROUTE-003 | 车辆位置 | CAMERA → ROUTE | 查询所有车辆当前位置（用于遮挡/渲染） | INFERRED |
| API-FX-001 | 粒子发射 | ZONE/ENTITY → FX | 在指定位置发射粒子效果（参数：类型/数量/时长） | INFERRED |
| API-FX-002 | 后处理管线 | CAMERA → FX | 安装/卸载后处理效果（HeatHaze/Fire/Morph） | INFERRED |
| API-FX-003 | 脚印生成 | PLAYER → FX | 玩家移动时在 footsteps 标记格上生成脚印精灵 | INFERRED |

### 跨系统桥接（已冻结）

| 接口ID | 接口名 | 连接 | 作用 | 结论级别 |
|---|---|---|---|---|
| BRIDGE-001 | 这格能走吗 | MOVE ⇄ WORLD/LAYER | 移动前问地图"前面是不是墙" | FACT |
| BRIDGE-002 | loadChunksForCamera | CAMERA → CHUNK | 相机视口决定加载哪些 chunk（含 +1 边距） | FACT |
| BRIDGE-003 | roof/bridge区域判定 | ZONE → LAYER | 玩家是否进入 roof/bridge 触发区域 | UNKNOWN |

> **总计**：16 系统，57 个系统接口，3 条跨系统桥接（合计 60 个接口）。

---

## L2：精确契约

### 字段说明

每个接口 14 个字段：

| # | 字段 | 说明 |
|---|---|---|
| 1 | 接口ID | 唯一标识符 |
| 2 | 调用方 | 哪个系统调用此接口 |
| 3 | 提供方 | 哪个系统实现此接口 |
| 4 | 触发条件 | 何时、以什么频率调用 |
| 5 | 输入 | 参数形状、类型、约束 |
| 6 | 输出 | 返回值形状、类型 |
| 7 | 类型约束 | 概念 TypeScript 签名（不绑定文件） |
| 8 | 单位与坐标系 | 像素/瓦片/世界坐标，原点约定 |
| 9 | 同步/异步 | 执行模型 |
| 10 | 异常处理 | 失败模式、错误类型、兜底行为 |
| 11 | 副作用 | 状态变更、资源创建/销毁 |
| 12 | 生命周期 | 何时可用、何时失效、销毁后行为 |
| 13 | 证据 | 原站证据或推断依据 |
| 14 | 结论级别 | FACT/INFERRED/DECISION/UNKNOWN |

---

## 一、地图线（SYS-ASSET / SYS-WORLD / SYS-LAYER / SYS-CHUNK）

### 1.1 SYS-ASSET 资源加载

#### API-ASSET-001 资源清单查询

| 字段 | 定义 |
|---|---|
| 接口ID | API-ASSET-001 |
| 调用方 | SYS-WORLD / SYS-LAYER |
| 提供方 | SYS-ASSET |
| 触发条件 | 世界创建前、图层创建前，按需查询资源 URL 与加载 key |
| 输入 | `key: string`（资源加载 key，如 `"exterior"`、`"final-map-small"`） |
| 输出 | `TilesetEntry \| null`：`{ name, image }`；未找到返回 `null` |
| 类型约束 | `(key: string) => TilesetEntry \| null` |
| 单位与坐标系 | 无（URL 字符串） |
| 同步/异步 | 同步（纯查询，读已登记的 URL 约定表） |
| 异常处理 | key 不存在返回 `null`，不抛错 |
| 副作用 | 无（只读） |
| 生命周期 | 全程可用；资源清单在启动时一次性登记 |
| 证据 | `src/asset/contract.ts` 的 `TilesetEntry`；SYS-ASSET 卡 §2 URL 约定表 |
| 结论级别 | FACT |

#### API-ASSET-002 瓦片集发现

| 字段 | 定义 |
|---|---|
| 接口ID | API-ASSET-002 |
| 调用方 | SYS-WORLD |
| 提供方 | SYS-ASSET |
| 触发条件 | 世界创建时，`USE_OPTIMIZED_TILESETS` 为真，读取 `final_map_small.json` 后 |
| 输入 | `tilesets: readonly unknown[]`（来自 final_map_small.json 的 tilesets 数组） |
| 输出 | `DiscoveredTileset[]`：`{ key, url }` 数组（含 `exterior` 基础 + 全部 `exterior-{n}` 切块） |
| 类型约束 | `(tilesets: readonly unknown[]) => DiscoveredTileset[]` |
| 单位与坐标系 | 无（key 字符串 + URL 字符串） |
| 同步/异步 | 同步（纯发现逻辑：过滤名字含 `exterior-small` 的项，拆后缀构造 key） |
| 异常处理 | tilesets 非法（非数组/缺字段）抛 `ChunkMasterContractError` |
| 副作用 | 无（只读，不发起加载） |
| 生命周期 | 仅在创建世界阶段调用一次 |
| 证据 | `src/asset/tilesets.ts` 的 `discoverOptimizedTilesets`；SYS-ASSET 卡 §1 FACT「切块瓦片动态发现」 |
| 结论级别 | FACT |

#### API-ASSET-003 资源就绪检查

| 字段 | 定义 |
|---|---|
| 接口ID | API-ASSET-003 |
| 调用方 | SYS-WORLD / SYS-CHUNK |
| 提供方 | SYS-ASSET |
| 触发条件 | 世界创建、chunk 写入前，检查依赖资源是否加载完成 |
| 输入 | `keys: readonly string[]`（需要检查的加载 key 列表） |
| 输出 | `boolean`（全部就绪返回 true） |
| 类型约束 | `(keys: readonly string[]) => boolean` |
| 单位与坐标系 | 无 |
| 同步/异步 | 同步（查 Phaser Loader 缓存状态） |
| 异常处理 | 单个 key 缺失返回 false，不阻断整体流程；调用方自行降级 |
| 副作用 | 无（只读） |
| 生命周期 | 资源加载期间可用；场景销毁后不再查询 |
| 证据 | SYS-ASSET 卡 §1 FACT「两套加载机制」；原站 `collisions` 瓦片集失败打印严重错误 |
| 结论级别 | INFERRED（原站无显式就绪检查 API，此接口为重构设计） |

---

### 1.2 SYS-WORLD 世界与地图

#### API-WORLD-001 createWorld

| 字段 | 定义 |
|---|---|
| 接口ID | API-WORLD-001 |
| 调用方 | SYS-APP（场景进入） |
| 提供方 | SYS-WORLD |
| 触发条件 | 游戏场景 `create`，世界尚不存在时 |
| 输入 | `worldSpec: WorldSpec`（140×140 tile、16px、5×5 chunk 网格）+ `layerPlan?: LayerStrategy[]`（默认 LAYER_STRATEGIES）+ `hooks?: WorldWriteHooks` |
| 输出 | `WorldCreateResult`：`{ kind:"ready", world } \| { kind:"failure", reason }` |
| 类型约束 | `(spec, plan, hooks) => WorldCreateResult` |
| 单位与坐标系 | tile 坐标（140×140），像素 2240×2240 |
| 同步/异步 | 同步（纯逻辑 CORE）；Phaser 集成后含异步创建瞬态 |
| 异常处理 | 校验失败/资源缺失 → `{ kind:"failure", reason }`，销毁已建实例并回滚 |
| 副作用 | 创建 Tilemap、tileset 句柄、全部运行时图层实例 |
| 生命周期 | 世界 `uninitialized → creating → ready`；`failed` 后不发布半成品 |
| 证据 | `src/world/contract.ts` `WorldCreateResult`；SYS-WORLD 卡 §3 createWorld 步骤 |
| 结论级别 | DECISION（重构设计，原站无此纯函数边界） |

#### API-WORLD-002 destroyWorld

| 字段 | 定义 |
|---|---|
| 接口ID | API-WORLD-002 |
| 调用方 | SYS-APP（场景退出） |
| 提供方 | SYS-WORLD |
| 触发条件 | 退游戏 / 切场景 |
| 输入 | 无 |
| 输出 | `void`（幂等完成） |
| 类型约束 | `() => void` |
| 单位与坐标系 | 无 |
| 同步/异步 | 同步（销毁顺序：禁写入 → 断开碰撞/监听 → 销毁图层 → 销毁 Tilemap） |
| 异常处理 | 重复调用安全（幂等）；销毁后一切写入被拒绝 |
| 副作用 | 释放 Tilemap、图层、碰撞、监听器 |
| 生命周期 | 世界 `ready → destroying → destroyed`；销毁后句柄不可访问 |
| 证据 | `src/world/world.ts` `WorldImpl.destroy`；SYS-WORLD 卡 §3 生命周期 |
| 结论级别 | DECISION |

#### API-WORLD-003 applyChunk

| 字段 | 定义 |
|---|---|
| 接口ID | API-WORLD-003 |
| 调用方 | SYS-CHUNK（WorldRenderer） |
| 提供方 | SYS-WORLD |
| 触发条件 | 某 chunk 数据已下载且坐标仍在目标集合中 |
| 输入 | `chunk: ValidatedChunk`（coordinate + 24 层 × 28×28 data） |
| 输出 | `ApplyResult`：`{ kind:"applied" } \| { kind:"already-applied" } \| { kind:"failure", reason }` |
| 类型约束 | `(chunk: ValidatedChunk) => ApplyResult` |
| 单位与坐标系 | chunk 坐标 `(cx,cy)`，世界 tile 区域 `cx*28…(cx+1)*28` |
| 同步/异步 | 同步（纯逻辑）；Phaser 集成后含空闲回调分批写入 |
| 异常处理 | 校验失败（缺层/尺寸错/GID非法）→ `{ kind:"failure" }`，本 chunk 整体回滚，不登记已渲染 |
| 副作用 | 写入 24 层 Tilemap 区域；成功后加入 `renderedChunks` 集合 |
| 生命周期 | 仅 `ready` 状态可写入；重复 apply 返回 already-applied |
| 证据 | `src/world/world.ts` `applyChunk`；SYS-WORLD 卡 §3 applyChunk 步骤 |
| 结论级别 | DECISION |

#### API-WORLD-004 removeChunk

| 字段 | 定义 |
|---|---|
| 接口ID | API-WORLD-004 |
| 调用方 | SYS-CHUNK（WorldRenderer） |
| 提供方 | SYS-WORLD |
| 触发条件 | 某 chunk 坐标离开目标集合 |
| 输入 | `coordinate: ChunkCoordinate` |
| 输出 | `RemoveResult`：`{ kind:"removed" } \| { kind:"already-absent" } \| { kind:"failure", reason }` |
| 类型约束 | `(coordinate: ChunkCoordinate) => RemoveResult` |
| 单位与坐标系 | chunk 坐标 `(cx,cy)` |
| 同步/异步 | 同步 |
| 异常处理 | 重复删除返回 already-absent，不制造错误状态；清除失败进入可定位失败 |
| 副作用 | 清除该 chunk 的 24 层区域、撤销 marker、重算碰撞；从 `renderedChunks` 移除 |
| 生命周期 | 仅 `ready` 状态可清除 |
| 证据 | `src/world/world.ts` `removeChunk`；SYS-WORLD 卡 §3 removeChunk 步骤 |
| 结论级别 | DECISION |

#### API-WORLD-005 worldSpec

| 字段 | 定义 |
|---|---|
| 接口ID | API-WORLD-005 |
| 调用方 | 任意系统（CAMERA/CHUNK/LAYER 只读） |
| 提供方 | SYS-WORLD |
| 触发条件 | 需要世界尺寸/边界/tile 大小信息时 |
| 输入 | 无 |
| 输出 | `WorldSpec`（只读，含 8 个字段：chunk 宽高、网格数、世界 tile 数、tile 像素、世界像素宽高） |
| 类型约束 | `() => WorldSpec` |
| 单位与坐标系 | tile / 像素混合（见 WorldSpec 各字段） |
| 同步/异步 | 同步 |
| 异常处理 | 世界未创建时访问 spec 为 undefined（调用方需先检查状态） |
| 副作用 | 无（只读） |
| 生命周期 | 世界创建后只读，销毁后不可访问 |
| 证据 | `src/world/contract.ts` `WorldSpec`；`src/world/spec.ts` `worldSpecFromMaster` |
| 结论级别 | DECISION |

---

### 1.3 SYS-LAYER 图层与遮挡

#### API-LAYER-001 图层策略查询

| 字段 | 定义 |
|---|---|
| 接口ID | API-LAYER-001 |
| 调用方 | SYS-WORLD / SYS-CHUNK |
| 提供方 | SYS-LAYER |
| 触发条件 | chunk apply/remove 时，按层名取处理策略 |
| 输入 | `name: string`（层名，如 `"walls"`、`"roof_factory"`） |
| 输出 | `LayerStrategy \| null`：`{ name, role, depth }`；未知名返回 `null` |
| 类型约束 | `(name: string) => LayerStrategy \| null` |
| 单位与坐标系 | depth 为 Phaser depth 值（无量纲排序值） |
| 同步/异步 | 同步 |
| 异常处理 | 未知层返回 `null`；调用方按「未知层默认失败」处理，不静默忽略 |
| 副作用 | 无（只读策略表） |
| 生命周期 | 全程可用（策略表在启动时固定） |
| 证据 | `src/layer/contract.ts` `LayerStrategy`；`src/layer/strategy.ts` `LAYER_STRATEGIES` |
| 结论级别 | DECISION（24 层策略表为唯一图层合同） |

#### API-LAYER-002 玩家深度计算

| 字段 | 定义 |
|---|---|
| 接口ID | API-LAYER-002 |
| 调用方 | SYS-PLAYER |
| 提供方 | SYS-LAYER |
| 触发条件 | 每帧玩家位置变化时（或深度需重算时） |
| 输入 | `y: number`（玩家世界 Y 坐标，像素）+ 可选 `override?: { bridge?: boolean }` |
| 输出 | `number`（Phaser depth 值） |
| 类型约束 | `(y: number, override?: {...}) => number` |
| 单位与坐标系 | y 为世界像素坐标；depth 无量纲 |
| 同步/异步 | 同步 |
| 异常处理 | y 非法（NaN/越界）→ 按公式计算或返回默认 500 |
| 副作用 | 无（纯计算） |
| 生命周期 | 全程可用 |
| 证据 | `src/layer/depth.ts` `playerDepth`；SYS-LAYER 卡 §2「500 + (y+24)*0.1，桥上 1650」 |
| 结论级别 | DECISION（公式为重构统一，桥上 1650 为原站事实覆盖） |

#### API-LAYER-003 roof淡隐控制

| 字段 | 定义 |
|---|---|
| 接口ID | API-LAYER-003 |
| 调用方 | SYS-ZONE（玩家进入/离开判定） |
| 提供方 | SYS-LAYER |
| 触发条件 | 玩家进入 factory / concert 固定区域（或离开） |
| 输入 | `roofGroup: string`（`"factory" \| "concert"`）+ `fade: boolean`（true=淡隐, false=恢复） |
| 输出 | `void` |
| 类型约束 | `(roofGroup, fade) => void` |
| 单位与坐标系 | 无（alpha 0..1） |
| 同步/异步 | 异步（300ms tween 淡隐/恢复） |
| 异常处理 | roof 层不存在 → 忽略；幂等（重复进入不叠加 tween） |
| 副作用 | 修改对应 roof 层 alpha（1 → 0 → 1） |
| 生命周期 | 世界 ready 后可用；销毁后撤销动态状态引用 |
| 证据 | SYS-LAYER 卡 §1 FACT「roof 300ms 淡隐」；`BASE-ROOF-001` VERIFIED |
| 结论级别 | FACT（300ms 行为参数原站证实；区域判定来源归 ZONE 待定） |

#### API-LAYER-004 bridge状态切换

| 字段 | 定义 |
|---|---|
| 接口ID | API-LAYER-004 |
| 调用方 | SYS-ZONE（桥上/桥下判定） |
| 提供方 | SYS-LAYER |
| 触发条件 | 玩家进入/离开桥区 |
| 输入 | `bridge: "bridge1" \| "bridge2"` + `state: BridgeState`（`"up" \| "down"`） |
| 输出 | `void` |
| 类型约束 | `(bridge, state) => void` |
| 单位与坐标系 | 无（碰撞 tile 逐格切换） |
| 同步/异步 | 同步（一次状态切换同时更新上下层可见性 + 碰撞 + 深度覆盖） |
| 异常处理 | 桥层缺失 → 忽略；重复设置同状态幂等 |
| 副作用 | 上下层可见性切换、tile 碰撞切换、必要时玩家深度覆盖请求（1650） |
| 生命周期 | 世界 ready 后可用；桥状态由 LAYER 保存 |
| 证据 | SYS-LAYER 卡 §1 FACT「bridge 上下层切换 + 玩家 depth 1650」；`BASE-BRIDGE-001` VERIFIED |
| 结论级别 | FACT（切换行为原站证实；桥状态来源归 ZONE 待定） |

#### API-LAYER-005 碰撞GID判定

| 字段 | 定义 |
|---|---|
| 接口ID | API-LAYER-005 |
| 调用方 | SYS-MOVE |
| 提供方 | SYS-LAYER |
| 触发条件 | 碰撞墙层建立时，判断哪些 GID 参与碰撞 |
| 输入 | `gid: number`（tile GID） |
| 输出 | `boolean`（是否碰撞） |
| 类型约束 | `(gid: number) => boolean` |
| 单位与坐标系 | GID 为 tileset 全局 tile ID |
| 同步/异步 | 同步 |
| 异常处理 | 未知 GID 返回 false（不碰撞） |
| 副作用 | 无 |
| 生命周期 | 全程可用 |
| 证据 | SYS-LAYER 卡 §2「walls 碰撞 GID：69345 强制碰撞、69346 强制不碰撞」 |
| 结论级别 | FACT |

---

### 1.4 SYS-CHUNK 地图分块

#### API-CHUNK-001 目标集合计算

| 字段 | 定义 |
|---|---|
| 接口ID | API-CHUNK-001 |
| 调用方 | SYS-CHUNK（ChunkCoordinator 自用） |
| 提供方 | SYS-CHUNK |
| 触发条件 | 每约 500ms（相机展示期间除外）或玩家/相机显著移动时 |
| 输入 | `playerPos: {x,y}` + `cameraViewport: {scrollX,scrollY,width,height,zoom}` |
| 输出 | `ChunkCoordinate[]`（目标集合 = 玩家 3×3 ∪ 相机可见 +1 边距，边界裁剪后去重） |
| 类型约束 | `(playerPos, cameraViewport) => ChunkCoordinate[]` |
| 单位与坐标系 | 世界像素坐标 → chunk 坐标 `(cx,cy)`，`cx∈[0,4]`，`cy∈[0,4]` |
| 同步/异步 | 同步（纯计算） |
| 异常处理 | 坐标越界 → 边界裁剪，不产越界 chunk |
| 副作用 | 无（只读计算，结果供协调器调度） |
| 生命周期 | 世界 ready 后可用 |
| 证据 | `src/chunk/targets.ts` `targetChunks`；SYS-CHUNK 卡 §2 目标集合 |
| 结论级别 | DECISION（公式来自原站 FACT，实现为重构设计） |

#### API-CHUNK-002 chunk坐标索引

| 字段 | 定义 |
|---|---|
| 接口ID | API-CHUNK-002 |
| 调用方 | SYS-CHUNK（自用） |
| 提供方 | SYS-CHUNK |
| 触发条件 | 世界坐标换算时 |
| 输入 | `worldX: number, worldY: number`（世界 tile 坐标） |
| 输出 | `ChunkCoordinate`：`{ x, y }`（chunk 坐标） |
| 类型约束 | `(worldX, worldY) => ChunkCoordinate` |
| 单位与坐标系 | 世界 tile 坐标（140×140）→ chunk 坐标（5×5），`floor(world/28)` |
| 同步/异步 | 同步 |
| 异常处理 | 越界坐标按 floor 计算后由调用方裁剪 |
| 副作用 | 无 |
| 生命周期 | 全程可用 |
| 证据 | `src/chunk/coordinates.ts` `worldToChunkCoordinate` |
| 结论级别 | FACT |

#### API-CHUNK-003 玩家邻域

| 字段 | 定义 |
|---|---|
| 接口ID | API-CHUNK-003 |
| 调用方 | SYS-CHUNK（自用） |
| 提供方 | SYS-CHUNK |
| 触发条件 | 目标集合计算的一部分 |
| 输入 | `playerWorldPos: {x,y}`（世界像素坐标） |
| 输出 | `ChunkCoordinate[]`（3×3 邻域，边界裁剪后） |
| 类型约束 | `(playerWorldPos) => ChunkCoordinate[]` |
| 单位与坐标系 | 世界像素 → chunk 坐标；玩家脚下 chunk 为中心 3×3 |
| 同步/异步 | 同步 |
| 异常处理 | 玩家越界 → 裁剪到合法 chunk 范围 |
| 副作用 | 无 |
| 生命周期 | 全程可用 |
| 证据 | `src/chunk/targets.ts` `playerNeighborhood` |
| 结论级别 | DECISION（3×3 邻域来自原站 FACT） |

#### API-CHUNK-004 相机可见范围

| 字段 | 定义 |
|---|---|
| 接口ID | API-CHUNK-004 |
| 调用方 | SYS-CAMERA |
| 提供方 | SYS-CHUNK |
| 触发条件 | 相机移动 / 缩放变化时 |
| 输入 | `camera: {scrollX,scrollY,width,height,zoom}` |
| 输出 | `ChunkCoordinate[]`（相机可见范围 +1 块边距） |
| 类型约束 | `(camera) => ChunkCoordinate[]` |
| 单位与坐标系 | 相机视口像素 → 世界 tile → chunk 坐标 |
| 同步/异步 | 同步 |
| 异常处理 | 相机越界 → 裁剪 |
| 副作用 | 无 |
| 生命周期 | 世界 ready 后可用 |
| 证据 | `src/chunk/targets.ts` `cameraVisibleChunks`；SYS-CHUNK 卡 §2 |
| 结论级别 | DECISION（+1 边距来自原站 FACT） |

---

## 二、玩法线（SYS-INPUT / SYS-MOVE / SYS-PLAYER / SYS-CAMERA）

### 2.1 SYS-INPUT 输入

#### API-INPUT-001 键盘方向解析

| 字段 | 定义 |
|---|---|
| 接口ID | API-INPUT-001 |
| 调用方 | SYS-INPUT（自用，`keyboardDirection`） |
| 提供方 | SYS-INPUT |
| 触发条件 | 每帧 `updateMovement` 时，摇杆未激活 |
| 输入 | `keyState: KeyState`（`{ up, down, left, right }`，合并方向键+WASD） |
| 输出 | `Direction \| null`（8 方向字符串，null = 无按键） |
| 类型约束 | `(keyState: KeyState) => Direction \| null` |
| 单位与坐标系 | 无（方向枚举） |
| 同步/异步 | 同步 |
| 异常处理 | 无输入返回 null；不可能的方向组合（如同时上下）按 if/else 优先级（上>下>左>右）处理 |
| 副作用 | 无 |
| 生命周期 | 全程可用 |
| 证据 | `src/input/keyboard.ts` `keyboardDirection`；SYS-INPUT 卡 §1 FACT「键盘归一化：if/else 链，8 方向」 |
| 结论级别 | FACT |

#### API-INPUT-002 摇杆方向解析

| 字段 | 定义 |
|---|---|
| 接口ID | API-INPUT-002 |
| 调用方 | SYS-INPUT（自用，`joystickDirection`） |
| 提供方 | SYS-INPUT |
| 触发条件 | 每帧摇杆回调时，非桌面设备 |
| 输入 | `forceX: number, forceY: number`（摇杆相对中心像素偏移） |
| 输出 | `Direction \| null`（8 方向，null = 摇杆回中） |
| 类型约束 | `(forceX, forceY) => Direction \| null` |
| 单位与坐标系 | forceX/Y 为像素偏移（相对摇杆中心），radius=15（tablet 12） |
| 同步/异步 | 同步 |
| 异常处理 | 无输入（forceX=0,forceY=0）返回 null；阈值 0.3/0.5 以下忽略 |
| 副作用 | 无 |
| 生命周期 | 仅非桌面设备可用 |
| 证据 | `src/input/joystick.ts` `joystickDirection`；SYS-INPUT 卡 §1 FACT「主轴判定 1.5、阈值 0.3/0.5」 |
| 结论级别 | FACT（阈值单位标记 UNKNOWN） |

#### API-INPUT-003 方向归一化

| 字段 | 定义 |
|---|---|
| 接口ID | API-INPUT-003 |
| 调用方 | SYS-MOVE（`updateMovement`） |
| 提供方 | SYS-INPUT |
| 触发条件 | 每帧移动更新前，从键盘或摇杆取得方向 |
| 输入 | `direction: Direction \| null`（来自键盘或摇杆） |
| 输出 | `DirectionVector`（`{ dx, dy }`，`dx,dy ∈ {-1,0,1}`） |
| 类型约束 | `(direction: Direction \| null) => DirectionVector` |
| 单位与坐标系 | 方向向量（dx,dy），非像素；`null` 输出 `(0,0)` |
| 同步/异步 | 同步 |
| 异常处理 | null → `(0,0)`；非法方向字符串 → `(0,0)` |
| 副作用 | 无 |
| 生命周期 | 全程可用 |
| 证据 | `src/input/direction.ts` 方向向量表；`src/input/resolve.ts` `resolveMovement` |
| 结论级别 | FACT |

#### API-INPUT-004 摇杆参数

| 字段 | 定义 |
|---|---|
| 接口ID | API-INPUT-004 |
| 调用方 | SYS-GAME-UI（摇杆 UI 创建） |
| 提供方 | SYS-INPUT |
| 触发条件 | 摇杆 UI 初始化时 |
| 输入 | `deviceKind: DeviceKind`（`"desktop" \| "tablet" \| "mobile"`） |
| 输出 | `JoystickParams`：`{ radius, baseDiameter, thumbDiameter, fixed, forceMin, position }` |
| 类型约束 | `(deviceKind: DeviceKind) => JoystickParams` |
| 单位与坐标系 | 像素（radius/baseDiameter/thumbDiameter） |
| 同步/异步 | 同步 |
| 异常处理 | 未知设备类型 → 默认用 tablet 参数 |
| 副作用 | 无 |
| 生命周期 | 全程可用 |
| 证据 | `src/input/contract.ts` `JoystickParams`；`src/input/joystick.ts` `joystickParams` |
| 结论级别 | FACT |

---

### 2.2 SYS-MOVE 移动与碰撞

#### API-MOVE-001 速度计算

| 字段 | 定义 |
|---|---|
| 接口ID | API-MOVE-001 |
| 调用方 | SYS-PLAYER（`updateMovement`） |
| 提供方 | SYS-MOVE |
| 触发条件 | 每帧移动更新时 |
| 输入 | `direction: Direction \| null` + `blocked: BlockedFlags`（来自 Phaser body.blocked） |
| 输出 | `Velocity`：`{ vx, vy }`（`null` 方向或卡墙方向输出 0） |
| 类型约束 | `(direction: Direction \| null, blocked: BlockedFlags) => Velocity` |
| 单位与坐标系 | 像素/帧（vx,vy 为 Phaser velocity 值） |
| 同步/异步 | 同步 |
| 异常处理 | null → `(0,0)`；卡墙方向 → 该轴输出 0 |
| 副作用 | 无（纯计算；Phaser 层负责 `setVelocity`） |
| 生命周期 | 全程可用 |
| 证据 | `src/move/velocity.ts` `velocityForDirection`；SPEED=150/DIAG=106 |
| 结论级别 | FACT |

#### API-MOVE-002 这格能走吗

| 字段 | 定义 |
|---|---|
| 接口ID | API-MOVE-002 |
| 调用方 | SYS-MOVE |
| 提供方 | SYS-WORLD（通过 SYS-LAYER 的 walls 碰撞数据） |
| 触发条件 | 玩家移动前、NPC 寻路前 |
| 输入 | `worldX: number, worldY: number`（世界 tile 坐标） |
| 输出 | `boolean`（`true` = 可走，`false` = 墙壁） |
| 类型约束 | `(worldX: number, worldY: number) => boolean` |
| 单位与坐标系 | 世界 tile 坐标（140×140），(0,0) = 左上角 |
| 同步/异步 | 同步 |
| 异常处理 | 越界坐标 → false（边界外不可走） |
| 副作用 | 无（只读） |
| 生命周期 | 世界 ready 后可用 |
| 证据 | `src/move/walls.ts` `isWalkable`；SYS-MOVE 卡 §2 walls 碰撞墙层 |
| 结论级别 | FACT（已冻结接口「这格能走吗」） |

#### API-MOVE-003 blocked方向判定

| 字段 | 定义 |
|---|---|
| 接口ID | API-MOVE-003 |
| 调用方 | SYS-PLAYER（动画选择） |
| 提供方 | SYS-MOVE |
| 触发条件 | 每帧碰撞后，判断动画应播放 walk 还是 stop 于第一帧 |
| 输入 | `blocked: BlockedFlags`（`{ up, down, left, right }`）+ `direction: Direction` |
| 输出 | `boolean`（`true` = 被卡住，应停动画） |
| 类型约束 | `(blocked: BlockedFlags, direction: Direction) => boolean` |
| 单位与坐标系 | 无（布尔标志） |
| 同步/异步 | 同步 |
| 异常处理 | blocked 为空 → false（不卡）；非法方向 → false |
| 副作用 | 无 |
| 生命周期 | 仅在 Phaser 碰撞后可用（依赖 body.blocked 更新） |
| 证据 | `src/move/blocked.ts` `blockedInDirection`；SYS-MOVE 卡 §1 FACT「卡墙则 anims.stop + 第一帧」 |
| 结论级别 | FACT |

---

### 2.3 SYS-PLAYER 玩家

#### API-PLAYER-001 出生点

| 字段 | 定义 |
|---|---|
| 接口ID | API-PLAYER-001 |
| 调用方 | SYS-WORLD（`createPlayer`） |
| 提供方 | SYS-PLAYER |
| 触发条件 | 玩家创建时 |
| 输入 | 无 |
| 输出 | `{ x: number, y: number }`——固定 `(1088, 304)` |
| 类型约束 | `() => { x: number, y: number }` |
| 单位与坐标系 | 世界像素坐标 |
| 同步/异步 | 同步 |
| 异常处理 | 无（常量） |
| 副作用 | 无 |
| 生命周期 | 全程可用 |
| 证据 | `src/player/appearance.ts` `SPAWN_X=1088, SPAWN_Y=304`；SYS-PLAYER 卡 §2 |
| 结论级别 | FACT |

#### API-PLAYER-002 动态深度

| 字段 | 定义 |
|---|---|
| 接口ID | API-PLAYER-002 |
| 调用方 | SYS-PLAYER（每帧 `preUpdate`） |
| 提供方 | SYS-LAYER（`playerDepth`） |
| 触发条件 | 每帧玩家位置变化时 |
| 输入 | 无（玩家内部持有当前 y 坐标） |
| 输出 | `number`（Phaser depth 值） |
| 类型约束 | `() => number` |
| 单位与坐标系 | 世界像素 y → depth 值（500 + (y+24)*0.1） |
| 同步/异步 | 同步（纯计算） |
| 异常处理 | 深度覆盖（桥上）退出后恢复常态计算 |
| 副作用 | 修改玩家精灵 depth 属性 |
| 生命周期 | 玩家创建后每帧可用 |
| 证据 | `src/layer/depth.ts`；SYS-PLAYER 卡 §2 深度公式 |
| 结论级别 | FACT（已冻结接口「动态深度」） |

#### API-PLAYER-003 空闲动作判定

| 字段 | 定义 |
|---|---|
| 接口ID | API-PLAYER-003 |
| 调用方 | SYS-PLAYER（`preUpdate` 空闲检测） |
| 提供方 | SYS-PLAYER |
| 触发条件 | 每帧 `preUpdate`，检查 `now - lastMovementTime` |
| 输入 | `idleMs: number`（静止时长，ms） |
| 输出 | `IdleAction`（`"sitting" \| "idle" \| "none"`） |
| 类型约束 | `(idleMs: number) => IdleAction` |
| 单位与坐标系 | 时间（毫秒） |
| 同步/异步 | 同步 |
| 异常处理 | 负数 → `"none"` |
| 副作用 | 无（判定结果供动画系统消费） |
| 生命周期 | 玩家创建后可用 |
| 证据 | `src/player/idle.ts` `idleAction`；SYS-PLAYER 卡 §2「IDLE_TIME_FOR_EATING=8000ms, IDLE_TIME_FOR_SITTING=30000ms」 |
| 结论级别 | FACT |

#### API-PLAYER-004 换装状态

| 字段 | 定义 |
|---|---|
| 接口ID | API-PLAYER-004 |
| 调用方 | SYS-ZONE（沙滩区域触发） |
| 提供方 | SYS-PLAYER |
| 触发条件 | 玩家进入/离开沙滩区域 |
| 输入 | `clothes: "beach" \| "normal"`（目标着装状态） |
| 输出 | `void` |
| 类型约束 | `(clothes: "beach" \| "normal") => void` |
| 单位与坐标系 | 无（贴图切换 + 显示尺寸 48×48 ↔ 64×64） |
| 同步/异步 | 异步（播动画 → `animationcomplete` → 换贴图） |
| 异常处理 | 换装中再次触发 → 排队或忽略；动画缺失 → 卡住（原站未兜底） |
| 副作用 | 设置 `isChangingClothes=true`、锁移动、切换贴图和显示尺寸 |
| 生命周期 | 每次换装后冷却 1s |
| 证据 | `src/player/clothing.ts` `CHANGE_CLOTHES_COOLDOWN_MS=1000`；SYS-PLAYER 卡 §1 FACT「沙滩换装」 |
| 结论级别 | FACT |

#### API-PLAYER-005 朝向

| 字段 | 定义 |
|---|---|
| 接口ID | API-PLAYER-005 |
| 调用方 | SYS-MOVE（动画选择） |
| 提供方 | SYS-PLAYER |
| 触发条件 | 需要查询/设置玩家朝向时 |
| 输入 | `set?: Direction`（设置时传入，查询时省略） |
| 输出 | `Direction`（当前朝向，默认 `"south"`） |
| 类型约束 | `(set?: Direction) => Direction` |
| 单位与坐标系 | 8 方向枚举 |
| 同步/异步 | 同步 |
| 异常处理 | 非法方向 → 忽略，保持当前朝向 |
| 副作用 | 设置时更新 `lastRequestedDirection` |
| 生命周期 | 玩家创建后可用 |
| 证据 | `src/player/facing.ts` `facingDirection`、`DEFAULT_FACING="south"`；SYS-PLAYER 卡 §1 FACT「getFacingDirection」 |
| 结论级别 | FACT |

---

### 2.4 SYS-CAMERA 相机

#### API-CAMERA-001 startFollow

| 字段 | 定义 |
|---|---|
| 接口ID | API-CAMERA-001 |
| 调用方 | SYS-PLAYER（玩家创建后） |
| 提供方 | SYS-CAMERA |
| 触发条件 | 游戏开始（航拍结束后）、传送完成后、怪物抓取结束后 |
| 输入 | `player: {x,y}`（玩家位置） |
| 输出 | `void` |
| 类型约束 | `(player: {x,y}) => void` |
| 单位与坐标系 | 世界像素坐标；相机 lerp=1（硬跟随，逐帧瞬时贴住） |
| 同步/异步 | 同步（调用 `startFollow(player,true,1,1)`） |
| 异常处理 | 玩家不存在 → 忽略 |
| 副作用 | 相机跟随目标切换为玩家；offset(0,0)、deadzone(0,0) |
| 生命周期 | 航拍期间 `stopFollow`；航拍结束恢复 |
| 证据 | `src/camera/params.ts` `FOLLOW_LERP=1`；SYS-CAMERA 卡 §1 FACT「硬跟随 lerp=1」 |
| 结论级别 | FACT（已冻结接口「startFollow」） |

#### API-CAMERA-002 相机边界

| 字段 | 定义 |
|---|---|
| 接口ID | API-CAMERA-002 |
| 调用方 | SYS-WORLD（世界创建时） |
| 提供方 | SYS-CAMERA |
| 触发条件 | 世界创建后，设置相机和物理世界边界 |
| 输入 | 无 |
| 输出 | `CameraBounds`：`{ x:0, y:0, width:2240, height:2240 }` |
| 类型约束 | `() => CameraBounds` |
| 单位与坐标系 | 世界像素坐标（2240 = 140 tile × 16px） |
| 同步/异步 | 同步 |
| 异常处理 | 无（常量） |
| 副作用 | 无 |
| 生命周期 | 世界创建后可用 |
| 证据 | `src/camera/params.ts` `CAMERA_BOUNDS`；SYS-CAMERA 卡 §2 |
| 结论级别 | FACT |

#### API-CAMERA-003 航拍序列

| 字段 | 定义 |
|---|---|
| 接口ID | API-CAMERA-003 |
| 调用方 | SYS-APP（游戏开始） |
| 提供方 | SYS-CAMERA |
| 触发条件 | 玩家点击 play 后，开场介绍完成 |
| 输入 | 无 |
| 输出 | `CameraPoint[]`（6 点序列，含坐标+飞行耗时+停留耗时） |
| 类型约束 | `() => readonly CameraPoint[]` |
| 单位与坐标系 | 世界像素坐标（x = 16×tileX）；duration/stayDuration 为 ms |
| 同步/异步 | 同步（返回数据）；执行是异步（tween 序列，总约 111s） |
| 异常处理 | 无（常量数据） |
| 副作用 | 无（返回序列数据，执行侧由相机控制器驱动） |
| 生命周期 | 全程可用（常量数据） |
| 证据 | `src/camera/sequence.ts` `CAMERA_SEQUENCE`；SYS-CAMERA 卡 §2 6 点序列表 |
| 结论级别 | FACT |

#### API-CAMERA-004 可见范围

| 字段 | 定义 |
|---|---|
| 接口ID | API-CAMERA-004 |
| 调用方 | SYS-CHUNK（`loadChunksForCamera`） |
| 提供方 | SYS-CAMERA |
| 触发条件 | 相机移动 / 缩放变化时，约每 500ms 或显著移动时 |
| 输入 | 无（从相机当前状态读取 `scrollX, scrollY, width, height, zoom`） |
| 输出 | `{ scrollX, scrollY, width, height, zoom }`（视口矩形参数） |
| 类型约束 | `() => { scrollX, scrollY, width, height, zoom }` |
| 单位与坐标系 | 世界像素坐标；width/height 受 zoom 和 nativeScale 影响 |
| 同步/异步 | 同步（读 Phaser camera 当前状态） |
| 异常处理 | 相机未初始化 → 返回全零 |
| 副作用 | 无（只读） |
| 生命周期 | 相机创建后可用 |
| 证据 | SYS-CAMERA 卡 §2；SYS-CHUNK 卡 §2 相机可见范围 +1 边距 |
| 结论级别 | FACT（已冻结接口「loadChunksForCamera」的数据来源） |

---

## 三、内容线（SYS-ZONE / SYS-INTERACT）

> ⚠️ 内容线两个系统均为空槽（`status: 空槽`），sample 里有原料但尚未逆向。以下接口设计基于系统架构推断和原站可观察行为，结论级别为 **INFERRED**。

### 3.1 SYS-ZONE 区域触发

#### API-ZONE-001 区域注册

| 字段 | 定义 |
|---|---|
| 接口ID | API-ZONE-001 |
| 调用方 | SYS-WORLD（世界创建后） |
| 提供方 | SYS-ZONE |
| 触发条件 | 世界 ready 后，注册所有已知触发区域 |
| 输入 | `zones: ZoneDefinition[]`（每个区域含 `id`, `type`, `bbox`/`outline`, `onEnter`, `onLeave`） |
| 输出 | `void` |
| 类型约束 | `(zones: ZoneDefinition[]) => void` |
| 单位与坐标系 | 世界像素坐标（bbox 矩形 / outline 多边形） |
| 同步/异步 | 同步（注册）；回调异步 |
| 异常处理 | 重复 id → 覆盖旧注册；无效 bbox → 跳过并告警 |
| 副作用 | 建立区域 → 回调映射表 |
| 生命周期 | 世界 ready 后注册；世界销毁时全部清空 |
| 证据 | 原站 roof/bridge 区域判定存在（FACT），但 zone 注册机制是独立系统（INFERRED） |
| 结论级别 | INFERRED |

#### API-ZONE-002 玩家进入判定

| 字段 | 定义 |
|---|---|
| 接口ID | API-ZONE-002 |
| 调用方 | SYS-ZONE（自用，每帧） |
| 提供方 | SYS-ZONE |
| 触发条件 | 每帧玩家位置更新后 |
| 输入 | `playerPos: {x,y}`（世界像素坐标） |
| 输出 | `ZoneEvent[]`（`{ zoneId, type: "enter" \| "leave" \| "stay" }`） |
| 类型约束 | `(playerPos) => ZoneEvent[]` |
| 单位与坐标系 | 世界像素坐标；区域 bbox 判定（含容差） |
| 同步/异步 | 同步 |
| 异常处理 | 越界 → 无匹配区域 |
| 副作用 | 更新玩家当前区域集合；触发 onEnter/onLeave 回调 |
| 生命周期 | 世界 ready 后每帧运行 |
| 证据 | 原站 roof 淡隐在玩家进入工厂区域时触发，表明存在区域判定逻辑（FACT）；具体实现推断 |
| 结论级别 | INFERRED |

#### API-ZONE-003 区域查询

| 字段 | 定义 |
|---|---|
| 接口ID | API-ZONE-003 |
| 调用方 | SYS-INTERACT / SYS-LAYER / SYS-PLAYER |
| 提供方 | SYS-ZONE |
| 触发条件 | 需要知道玩家当前在哪些区域时 |
| 输入 | 无（查询当前玩家所在区域） |
| 输出 | `string[]`（当前区域 id 列表） |
| 类型约束 | `() => string[]` |
| 单位与坐标系 | 无（区域 id 字符串） |
| 同步/异步 | 同步 |
| 异常处理 | 无玩家 → 空数组 |
| 副作用 | 无 |
| 生命周期 | 世界 ready 后可用 |
| 证据 | 原站 roof/bridge 区域判定待定（TBD）；推断为 SYS-ZONE 职责 |
| 结论级别 | INFERRED |

---

### 3.2 SYS-INTERACT 世界交互（弹窗）

#### API-INTERACT-001 弹窗触发

| 字段 | 定义 |
|---|---|
| 接口ID | API-INTERACT-001 |
| 调用方 | SYS-ZONE（`onEnter` 回调） |
| 提供方 | SYS-INTERACT |
| 触发条件 | 玩家进入交互区域 |
| 输入 | `interactionId: string`（交互配置 id） |
| 输出 | `void` |
| 类型约束 | `(interactionId: string) => void` |
| 单位与坐标系 | 无 |
| 同步/异步 | 同步（触发弹窗显示）；异步（等待用户关闭） |
| 异常处理 | 未知 id → 忽略；弹窗已在显示 → 排队或忽略 |
| 副作用 | 暂停玩家控制、显示弹窗 UI、暂停游戏（可选） |
| 生命周期 | 世界 ready 后可用；弹窗关闭后恢复控制 |
| 证据 | 原站有弹窗内容（卡牌/文字），但交互触发完整链路未逆向 |
| 结论级别 | INFERRED |

#### API-INTERACT-002 弹窗关闭

| 字段 | 定义 |
|---|---|
| 接口ID | API-INTERACT-002 |
| 调用方 | SYS-GAME-UI（关闭按钮） |
| 提供方 | SYS-INTERACT |
| 触发条件 | 用户点击关闭按钮或按 ESC |
| 输入 | 无 |
| 输出 | `void` |
| 类型约束 | `() => void` |
| 单位与坐标系 | 无 |
| 同步/异步 | 同步 |
| 异常处理 | 无弹窗 → 忽略 |
| 副作用 | 恢复玩家控制、隐藏弹窗 UI、恢复游戏运行 |
| 生命周期 | 弹窗显示期间可用 |
| 证据 | 原站弹窗可关闭（FACT）；关闭机制推断 |
| 结论级别 | INFERRED |

#### API-INTERACT-003 弹窗内容

| 字段 | 定义 |
|---|---|
| 接口ID | API-INTERACT-003 |
| 调用方 | SYS-GAME-UI |
| 提供方 | SYS-INTERACT |
| 触发条件 | 弹窗触发后，UI 需要渲染内容 |
| 输入 | `interactionId: string` |
| 输出 | `InteractionContent`：`{ title, body, image?, buttons[] }` |
| 类型约束 | `(id: string) => InteractionContent \| null` |
| 单位与坐标系 | 无（内容数据） |
| 同步/异步 | 同步（从配置表读取） |
| 异常处理 | 未知 id → null；缺失字段 → 用默认值 |
| 副作用 | 无 |
| 生命周期 | 全程可用（内容配置在启动时加载） |
| 证据 | 原站有卡牌/作品集弹窗内容（FACT）；内容结构推断 |
| 结论级别 | INFERRED |

---

## 四、独立件（SYS-APP / SYS-GAME-UI / SYS-ENTITY）

> ⚠️ 独立件三个系统均为空槽。以下接口基于 Angular+Phaser 架构和原站可观察行为推断。

### 4.1 SYS-APP 应用启动与页面

#### API-APP-001 应用启动

| 字段 | 定义 |
|---|---|
| 接口ID | API-APP-001 |
| 调用方 | 浏览器（`DOMContentLoaded`） |
| 提供方 | SYS-APP |
| 触发条件 | 用户访问 peteroravec.com |
| 输入 | 无（从 URL 推断首屏） |
| 输出 | `void` |
| 类型约束 | `() => void` |
| 单位与坐标系 | DOM 视口（1280×720 或自适应） |
| 同步/异步 | 异步（Angular 启动 + 资源预加载） |
| 异常处理 | 加载失败 → 显示错误页 |
| 副作用 | 初始化 Angular 应用、加载 Phaser、注册全局插件 |
| 生命周期 | 页面加载 → Angular 初始化 → Phaser 就绪 |
| 证据 | 原站 `main-RV3Z53H4.js`（Angular 入口）；`chunk-WMFY56ZM.js`（Phaser GameScene） |
| 结论级别 | INFERRED |

#### API-APP-002 场景切换

| 字段 | 定义 |
|---|---|
| 接口ID | API-APP-002 |
| 调用方 | SYS-APP（自用） |
| 提供方 | SYS-APP |
| 触发条件 | 用户点击 play 按钮 |
| 输入 | 无 |
| 输出 | `void` |
| 类型约束 | `() => void` |
| 单位与坐标系 | 无 |
| 同步/异步 | 异步（首页 → 游戏场景过渡） |
| 异常处理 | 资源未就绪 → 阻塞切换或显示加载进度 |
| 副作用 | 销毁首页 DOM、创建 Phaser GameScene、启动航拍 |
| 生命周期 | 首页 → 游戏场景（单向，不回到首页） |
| 证据 | 原站 `button.btn-play` 点击触发游戏场景创建（FACT） |
| 结论级别 | INFERRED |

#### API-APP-003 页面生命周期

| 字段 | 定义 |
|---|---|
| 接口ID | API-APP-003 |
| 调用方 | 浏览器（`visibilitychange`、`beforeunload`） |
| 提供方 | SYS-APP |
| 触发条件 | 页面隐藏/显示、关闭/刷新 |
| 输入 | `event: "hidden" \| "visible" \| "unload"` |
| 输出 | `void` |
| 类型约束 | `(event) => void` |
| 单位与坐标系 | 无 |
| 同步/异步 | 同步（事件处理） |
| 异常处理 | 静默处理 |
| 副作用 | hidden → 暂停游戏循环；visible → 恢复；unload → 保存状态 |
| 生命周期 | 全程 |
| 证据 | 原站 `localStorage` 存 UI 状态（FACT）；页面生命周期未定位 |
| 结论级别 | INFERRED |

---

### 4.2 SYS-GAME-UI 游戏 UI

#### API-GAME-UI-001 HUD更新

| 字段 | 定义 |
|---|---|
| 接口ID | API-GAME-UI-001 |
| 调用方 | 各系统（调试/坐标/状态显示） |
| 提供方 | SYS-GAME-UI |
| 触发条件 | 调试开关开启时，每帧更新 |
| 输入 | `data: Record<string, string \| number>`（键值对） |
| 输出 | `void` |
| 类型约束 | `(data: Record<string, string \| number>) => void` |
| 单位与坐标系 | DOM 坐标（叠加在 canvas 上） |
| 同步/异步 | 同步 |
| 异常处理 | 无调试面板 → 忽略 |
| 副作用 | 更新 DOM 文本 |
| 生命周期 | 调试开关开启期间可用 |
| 证据 | 原站 `localStorage` 存 `debug` 开关（FACT）；HUD 实现推断 |
| 结论级别 | INFERRED |

#### API-GAME-UI-002 摇杆UI

| 字段 | 定义 |
|---|---|
| 接口ID | API-GAME-UI-002 |
| 调用方 | SYS-INPUT |
| 提供方 | SYS-GAME-UI |
| 触发条件 | 游戏创建时（非桌面设备） |
| 输入 | `params: JoystickParams` + `visible: boolean` |
| 输出 | `void` |
| 类型约束 | `(params, visible) => void` |
| 单位与坐标系 | DOM 坐标（右下角或居中底部） |
| 同步/异步 | 同步 |
| 异常处理 | 插件/纹理缺失 → 圆形占位 |
| 副作用 | 创建/显示/隐藏摇杆 DOM 元素 |
| 生命周期 | 游戏创建时创建；航拍/换装期间隐藏 |
| 证据 | 原站 `createJoystick` + `toggleJoystick`（FACT） |
| 结论级别 | INFERRED |

#### API-GAME-UI-003 对话框UI

| 字段 | 定义 |
|---|---|
| 接口ID | API-GAME-UI-003 |
| 调用方 | SYS-INTERACT |
| 提供方 | SYS-GAME-UI |
| 触发条件 | 弹窗触发时 |
| 输入 | `content: InteractionContent`（标题/正文/图片/按钮） |
| 输出 | `void` |
| 类型约束 | `(content: InteractionContent) => void` |
| 单位与坐标系 | DOM 坐标（居中覆盖） |
| 同步/异步 | 同步（渲染）；异步（等待用户交互） |
| 异常处理 | 内容缺失 → 显示默认占位 |
| 副作用 | 渲染弹窗 DOM、暂停游戏输入 |
| 生命周期 | 弹窗显示期间 |
| 证据 | 原站有卡牌 UI 和作品集弹窗（FACT）；UI 层推断 |
| 结论级别 | INFERRED |

---

### 4.3 SYS-ENTITY 实体生命周期

#### API-ENTITY-001 实体注册

| 字段 | 定义 |
|---|---|
| 接口ID | API-ENTITY-001 |
| 调用方 | SYS-NPC / SYS-ROUTE / SYS-FX |
| 提供方 | SYS-ENTITY |
| 触发条件 | 任何游戏实体创建时（NPC、车辆、粒子系统） |
| 输入 | `entity: EntityDefinition`（`{ id, type, gameObject, hooks? }`） |
| 输出 | `void` |
| 类型约束 | `(entity: EntityDefinition) => void` |
| 单位与坐标系 | 无（实体引用） |
| 同步/异步 | 同步 |
| 异常处理 | 重复 id → 覆盖旧实体并销毁旧实体 |
| 副作用 | 加入全局实体注册表 |
| 生命周期 | 注册后至销毁 |
| 证据 | 原站有 NPC、车辆、粒子等实体生命周期（FACT）；统一管理推断 |
| 结论级别 | INFERRED |

#### API-ENTITY-002 实体销毁

| 字段 | 定义 |
|---|---|
| 接口ID | API-ENTITY-002 |
| 调用方 | SYS-ENTITY（自用）或实体自身 |
| 提供方 | SYS-ENTITY |
| 触发条件 | 实体离开世界（chunk 卸载、场景销毁、显式 destroy） |
| 输入 | `entityId: string` |
| 输出 | `void` |
| 类型约束 | `(entityId: string) => void` |
| 单位与坐标系 | 无 |
| 同步/异步 | 同步 |
| 异常处理 | 未知 id → 忽略 |
| 副作用 | 从注册表移除、清理关联资源（动画/纹理/碰撞/监听） |
| 生命周期 | 注册后至销毁 |
| 证据 | 原站有实体销毁（FACT 如 NPC 移除）；统一管理推断 |
| 结论级别 | INFERRED |

#### API-ENTITY-003 生命周期钩子

| 字段 | 定义 |
|---|---|
| 接口ID | API-ENTITY-003 |
| 调用方 | SYS-ENTITY（自用，广播） |
| 提供方 | SYS-ENTITY |
| 触发条件 | 场景暂停/恢复/销毁 |
| 输入 | `event: "pause" \| "resume" \| "destroy"` |
| 输出 | `void` |
| 类型约束 | `(event) => void` |
| 单位与坐标系 | 无 |
| 同步/异步 | 同步（遍历注册表通知） |
| 异常处理 | 单个实体钩子失败不影响其他实体 |
| 副作用 | 所有注册实体的对应钩子被调用 |
| 生命周期 | 全程 |
| 证据 | 原站场景 `shutdown` 监听只移除一个 keydown handler（FACT）；完整钩子推断 |
| 结论级别 | INFERRED |

---

## 五、旁支（SYS-NPC / SYS-ROUTE / SYS-FX）

> ⚠️ 旁支三个系统均为空槽。以下接口基于 sample 证据（walls-layer.json、cars 标记层、particles 数据）推断。

### 5.1 SYS-NPC NPC 与环境实体

#### API-NPC-001 NPC注册

| 字段 | 定义 |
|---|---|
| 接口ID | API-NPC-001 |
| 调用方 | SYS-WORLD（世界创建后） |
| 提供方 | SYS-NPC |
| 触发条件 | 世界 ready 后，NPC 数据加载完成 |
| 输入 | `npc: NpcDefinition`（`{ id, type, startPos, spriteKey, animations?, route? }`） |
| 输出 | `void` |
| 类型约束 | `(npc: NpcDefinition) => void` |
| 单位与坐标系 | 世界像素坐标 |
| 同步/异步 | 同步（注册）；异步（NPC 自主行为） |
| 异常处理 | 贴图未加载 → 跳过并告警 |
| 副作用 | 创建 Phaser sprite、注册碰撞、启动行为循环 |
| 生命周期 | 世界 ready 后注册；chunk 卸载/世界销毁时清理 |
| 证据 | 原站有 `NpcGhost`、`Rats` 类（FACT）；注册接口推断 |
| 结论级别 | INFERRED |

#### API-NPC-002 寻路查询

| 字段 | 定义 |
|---|---|
| 接口ID | API-NPC-002 |
| 调用方 | SYS-NPC（自用，寻路每步） |
| 提供方 | SYS-MOVE（通过 walls-layer.json） |
| 触发条件 | NPC 寻路每一步 |
| 输入 | `worldX: number, worldY: number`（世界 tile 坐标） |
| 输出 | `boolean`（`true` = 可走，`0` = 可走，`1` = 墙） |
| 类型约束 | `(worldX, worldY) => boolean` |
| 单位与坐标系 | 世界 tile 坐标（140×140），grid[y][x] 行优先 |
| 同步/异步 | 同步 |
| 异常处理 | 越界 → false |
| 副作用 | 无 |
| 生命周期 | walls-layer.json 加载后可用 |
| 证据 | 原站 `walls-layer.json` 140×140 0/1 网格 + `NpcGhost.isWalkable`（FACT） |
| 结论级别 | INFERRED（消费方推断为 NPC 寻路） |

#### API-NPC-003 NPC动画状态

| 字段 | 定义 |
|---|---|
| 接口ID | API-NPC-003 |
| 调用方 | SYS-ENTITY（生命周期管理） |
| 提供方 | SYS-NPC |
| 触发条件 | 查询/设置 NPC 当前动画 |
| 输入 | `npcId: string` + `animation?: string`（设置时传入） |
| 输出 | `string`（当前动画名） |
| 类型约束 | `(npcId, animation?) => string` |
| 单位与坐标系 | 无 |
| 同步/异步 | 同步 |
| 异常处理 | 未知 id → 返回空字符串；未知动画 → 忽略 |
| 副作用 | 设置时切换 NPC 动画 |
| 生命周期 | NPC 存活期间 |
| 证据 | 原站有 NPC 动画（FACT）；动画状态接口推断 |
| 结论级别 | INFERRED |

---

### 5.2 SYS-ROUTE 车辆与路线

#### API-ROUTE-001 车辆注册

| 字段 | 定义 |
|---|---|
| 接口ID | API-ROUTE-001 |
| 调用方 | SYS-WORLD（世界创建后，从 cars 层 marker 读取） |
| 提供方 | SYS-ROUTE |
| 触发条件 | 世界 ready 后，cars 层 marker 解析完成 |
| 输入 | `vehicle: VehicleDefinition`（`{ id, routeNodeIds[], speed, spriteKey, depth }`） |
| 输出 | `void` |
| 类型约束 | `(vehicle: VehicleDefinition) => void` |
| 单位与坐标系 | 世界像素坐标 |
| 同步/异步 | 同步（注册）；异步（每帧移动） |
| 异常处理 | 贴图未加载 → 跳过 |
| 副作用 | 创建 Phaser sprite、加入车辆列表 |
| 生命周期 | 世界 ready 后注册；世界销毁时清理 |
| 证据 | 原站 `carTraffic()` 扫描 cars 层 GID 69350/69351 建立车辆（FACT） |
| 结论级别 | INFERRED |

#### API-ROUTE-002 车辆路线推进

| 字段 | 定义 |
|---|---|
| 接口ID | API-ROUTE-002 |
| 调用方 | SYS-ROUTE（自用，每帧） |
| 提供方 | SYS-ROUTE |
| 触发条件 | 每帧 update |
| 输入 | 无（从车辆自身状态读取当前路线节点和速度） |
| 输出 | `void` |
| 类型约束 | `() => void` |
| 单位与坐标系 | 世界像素坐标；速度待逆向 |
| 同步/异步 | 同步（每帧更新位置） |
| 异常处理 | 路线结束 → 循环或移除 |
| 副作用 | 更新车辆 sprite 位置 |
| 生命周期 | 车辆注册后每帧 |
| 证据 | 原站 cars 层有车辆移动（FACT）；路线推进细节未逆向 |
| 结论级别 | INFERRED |

#### API-ROUTE-003 车辆位置

| 字段 | 定义 |
|---|---|
| 接口ID | API-ROUTE-003 |
| 调用方 | SYS-CAMERA（遮挡排序） |
| 提供方 | SYS-ROUTE |
| 触发条件 | 需要所有车辆当前位置时 |
| 输入 | 无 |
| 输出 | `VehiclePosition[]`（`{ id, x, y, depth }`） |
| 类型约束 | `() => VehiclePosition[]` |
| 单位与坐标系 | 世界像素坐标 |
| 同步/异步 | 同步 |
| 异常处理 | 无车辆 → 空数组 |
| 副作用 | 无 |
| 生命周期 | 车辆注册后 |
| 证据 | 原站车辆有 depth 550（FACT）；位置查询推断 |
| 结论级别 | INFERRED |

---

### 5.3 SYS-FX 动效与粒子

#### API-FX-001 粒子发射

| 字段 | 定义 |
|---|---|
| 接口ID | API-FX-001 |
| 调用方 | SYS-ZONE / SYS-ENTITY |
| 提供方 | SYS-FX |
| 触发条件 | 进入粒子区域（particles/particles2/particles3 marker）或实体事件 |
| 输入 | `emitter: ParticleEmitterConfig`（`{ type, position, count, duration, depth }`） |
| 输出 | `void` |
| 类型约束 | `(emitter: ParticleEmitterConfig) => void` |
| 单位与坐标系 | 世界像素坐标 |
| 同步/异步 | 同步（启动发射器）；异步（粒子持续播放） |
| 异常处理 | 纹理缺失 → 圆形占位或跳过 |
| 副作用 | 创建 Phaser particle emitter |
| 生命周期 | 发射器启动后至 duration 结束或手动停止 |
| 证据 | 原站有 particles/particles2/particles3 三个 marker 层（FACT）；particles3 消费者 UNKNOWN |
| 结论级别 | INFERRED |

#### API-FX-002 后处理管线

| 字段 | 定义 |
|---|---|
| 接口ID | API-FX-002 |
| 调用方 | SYS-CAMERA（航拍结束时安装） |
| 提供方 | SYS-FX |
| 触发条件 | 航拍结束 / 场景特效切换 |
| 输入 | `pipeline: PostProcessConfig`（`{ type: "HeatHaze" \| "Fire" \| "Morph", strength: number }`） |
| 输出 | `void` |
| 类型约束 | `(pipeline: PostProcessConfig) => void` |
| 单位与坐标系 | 无（后处理作用于整个 canvas） |
| 同步/异步 | 同步（安装管线） |
| 异常处理 | 管线不可用 → `console.warn` + strength 置 0 |
| 副作用 | 安装/更新后处理管线 |
| 生命周期 | 航拍结束时安装；相机销毁时移除 |
| 证据 | 原站航拍结束装 HeatHaze/Fire/Morph 管线（FACT） |
| 结论级别 | INFERRED |

#### API-FX-003 脚印生成

| 字段 | 定义 |
|---|---|
| 接口ID | API-FX-003 |
| 调用方 | SYS-PLAYER（玩家移动时） |
| 提供方 | SYS-FX |
| 触发条件 | 玩家移动时，当前位置 footsteps 网格值为 1 且 depth < 1000 |
| 输入 | `position: {x,y}`（世界像素坐标） |
| 输出 | `void` |
| 类型约束 | `(position) => void` |
| 单位与坐标系 | 世界像素坐标 |
| 同步/异步 | 同步（创建精灵） |
| 异常处理 | 纹理缺失 → 跳过 |
| 副作用 | 创建 footprint 精灵（depth 450, active） |
| 生命周期 | 脚印精灵创建后保留；chunk 卸载时清除 |
| 证据 | 原站 footsteps 368 个 GID=69345 位置 + `BASE-FOOTSTEP-001` VERIFIED（FACT） |
| 结论级别 | INFERRED |

---

## 六、跨系统桥接接口

> 三条桥接接口连接了不同流水线，是"能不能并行"的开关。已冻结的不修改语义。

### BRIDGE-001 这格能走吗

| 字段 | 定义 |
|---|---|
| 接口ID | BRIDGE-001 |
| 调用方 | SYS-MOVE（玩家碰撞、NPC 寻路） |
| 提供方 | SYS-WORLD（通过 SYS-LAYER 的 walls 碰撞数据） |
| 触发条件 | 每帧移动前（玩家）或寻路每步（NPC） |
| 输入 | `worldX: number, worldY: number`（世界 tile 坐标） |
| 输出 | `boolean`（`true` = 可走） |
| 类型约束 | `(worldX, worldY) => boolean` |
| 单位与坐标系 | 世界 tile 坐标（140×140），(0,0) 左上角 |
| 同步/异步 | 同步 |
| 异常处理 | 越界 → false |
| 副作用 | 无 |
| 生命周期 | 世界 ready 后可用 |
| 证据 | `src/move/walls.ts` `isWalkable`；`walls-layer.json` 140×140 0/1 网格 |
| 结论级别 | FACT（已冻结） |

### BRIDGE-002 loadChunksForCamera

| 字段 | 定义 |
|---|---|
| 接口ID | BRIDGE-002 |
| 调用方 | SYS-CAMERA |
| 提供方 | SYS-CHUNK |
| 触发条件 | 相机移动/缩放，约每 500ms |
| 输入 | 相机视口 `{ scrollX, scrollY, width, height, zoom }` |
| 输出 | 无（触发 ChunkCoordinator 更新目标集合） |
| 类型约束 | 事件驱动（非直接返回值） |
| 单位与坐标系 | 世界像素 → chunk 坐标（+1 边距） |
| 同步/异步 | 异步（结果通过 applyChunk/removeChunk 回调） |
| 异常处理 | 越界 → 裁剪 |
| 副作用 | 更新 ChunkCoordinator 目标集合，触发 chunk 加载/卸载 |
| 生命周期 | 世界 ready 后可用 |
| 证据 | `src/chunk/targets.ts` `cameraVisibleChunks`；SYS-CHUNK 卡 §2 |
| 结论级别 | FACT（已冻结） |

### BRIDGE-003 roof/bridge区域判定

| 字段 | 定义 |
|---|---|
| 接口ID | BRIDGE-003 |
| 调用方 | SYS-ZONE（玩家位置判定） |
| 提供方 | SYS-LAYER（roof 淡隐/bridge 状态切换） |
| 触发条件 | 玩家进入/离开 roof 或 bridge 定义区域 |
| 输入 | `regionId: string`（区域标识，如 `"factory"`、`"bridge1"`）+ `event: "enter" \| "leave"` |
| 输出 | SYS-LAYER 执行 roof 淡隐或 bridge 状态切换 |
| 类型约束 | 待定（区域来源未逆向） |
| 单位与坐标系 | 世界像素坐标（区域 bbox/多边形） |
| 同步/异步 | 异步（roof 300ms 淡隐为异步 tween；bridge 切换为同步） |
| 异常处理 | 待定 |
| 副作用 | 修改 roof alpha、bridge 上下层碰撞和可见性 |
| 生命周期 | 世界 ready 后 |
| 证据 | `BASE-ROOF-001` VERIFIED、`BASE-BRIDGE-001` VERIFIED（FACT）；区域判定来源 UNKNOWN |
| 结论级别 | UNKNOWN（区域判定来源待逆向） |

---

## 七、数据字典附录

> 这些是接口中的精确参数/常量，不重复定义，仅为本文档的快速引用。以 `03-执行层/` 对应系统卡为唯一来源。

| 项 | 值 | 引用接口 | 来源 |
|---|---|---|---|
| 世界尺寸 | 140×140 tile × 16px = 2240×2240 px | API-WORLD-001, API-CAMERA-002 | SYS-WORLD §2 |
| chunk 网格 | 5×5 块，每块 28×28 tile | API-CHUNK-001~004 | SYS-CHUNK §2 |
| chunk 索引 | `index = y * 5 + x`，文件 `chunk{index}.json` | API-CHUNK-002 | SYS-CHUNK §2 |
| 图层 | 24 层（layer1-10 + walls + cars + 4 roof + 4 bridge + 3 particles + footsteps） | API-LAYER-001 | SYS-LAYER §2 |
| 移动速度 | 单轴 150，对角 106（150×√2/2） | API-MOVE-001 | SYS-INPUT §2 |
| 玩家深度 | `500 + (y+24) × 0.1`（常态）；桥上 1650 | API-PLAYER-002 | SYS-LAYER §2 |
| 碰撞体 | 20×8 px，offset (14,36) | API-MOVE-002 | SYS-MOVE §2 |
| roof 淡隐 | 300ms，alpha 1 ↔ 0 | API-LAYER-003 | SYS-LAYER §2 |
| bridge depth | 3500（桥墙层）/ 1650（玩家桥上） | API-LAYER-004 | SYS-LAYER §2 |
| 碰撞 GID | walls 层 69345 强制碰撞、69346 强制不碰撞 | API-LAYER-005 | SYS-LAYER §2 |
| 相机边界 | (0, 0, 2240, 2240) | API-CAMERA-002 | SYS-CAMERA §2 |
| 相机跟随 | lerp=1 硬跟随，无平滑 | API-CAMERA-001 | SYS-CAMERA §2 |
| 航拍序列 | 6 点，总约 111s | API-CAMERA-003 | SYS-CAMERA §2 |
| 玩家出生点 | (1088, 304) | API-PLAYER-001 | SYS-PLAYER §2 |
| 空闲阈值 | 8s 小动作，30s 坐下 | API-PLAYER-003 | SYS-PLAYER §2 |
| 换装冷却 | 1000ms | API-PLAYER-004 | SYS-PLAYER §2 |
| 脚印 depth | 450 | API-FX-003 | SYS-LAYER §2 |
| footsteps 标记 | 368 个 GID=69345 位置 | API-FX-003 | SYS-LAYER §2 |
| walls 寻路网格 | 140×140 0/1 矩阵，0=可走 12121 格，1=墙 7479 格 | API-NPC-002 | SYS-MOVE §2 |
| 摇杆参数 | radius 15(tablet 12), base 60(tablet 48), thumb 30(tablet 24), fixed | API-INPUT-004 | SYS-INPUT §2 |
| 摇杆阈值 | 主轴 1.5，单轴 0.3，对角 0.5 | API-INPUT-002 | SYS-INPUT §2 |
| 物理帧率 | 30 FPS（fixedDelta） | API-CAMERA-001 | SYS-CAMERA §2 |
| nativeScale | 运行时设备像素比（DPR），非写死参数 | API-CAMERA-004 | SYS-CAMERA §2 |

---

## 八、冻结规矩

1. **已冻结接口（API契约表.md 中的 8 条）**：本文档只补充细化，不修改语义。要改需同时更新两张表。
2. **FACT 标记接口**：基于原站证据，修改需提供新的反向证据。
3. **INFERRED 标记接口**：当前为推断，逆向完成后升级为 FACT 或修改。
4. **UNKNOWN 标记接口**：待逆向，实现前需补证。
5. **新增接口**：需 Human 签字后才可冻结。未签字前标记为 INFERRED/DECISION。
6. **冲突解决**：常量/公式冲突时以 `03-执行层/` 对应系统卡为准；接口语义冲突时以本表为准。

---

## 九、状态汇总

| 抽屉 | 系统 | 接口数 | FACT | DECISION | INFERRED | UNKNOWN |
|---|---|---|---|---|---|---|
| 地图线 | SYS-ASSET | 3 | 2 | 0 | 1 | 0 |
| 地图线 | SYS-WORLD | 5 | 0 | 5 | 0 | 0 |
| 地图线 | SYS-LAYER | 5 | 3 | 2 | 0 | 0 |
| 地图线 | SYS-CHUNK | 4 | 1 | 3 | 0 | 0 |
| 玩法线 | SYS-INPUT | 4 | 4 | 0 | 0 | 0 |
| 玩法线 | SYS-MOVE | 3 | 3 | 0 | 0 | 0 |
| 玩法线 | SYS-PLAYER | 5 | 5 | 0 | 0 | 0 |
| 玩法线 | SYS-CAMERA | 4 | 4 | 0 | 0 | 0 |
| 内容线 | SYS-ZONE | 3 | 0 | 0 | 3 | 0 |
| 内容线 | SYS-INTERACT | 3 | 0 | 0 | 3 | 0 |
| 独立件 | SYS-APP | 3 | 0 | 0 | 3 | 0 |
| 独立件 | SYS-GAME-UI | 3 | 0 | 0 | 3 | 0 |
| 独立件 | SYS-ENTITY | 3 | 0 | 0 | 3 | 0 |
| 旁支 | SYS-NPC | 3 | 0 | 0 | 3 | 0 |
| 旁支 | SYS-ROUTE | 3 | 0 | 0 | 3 | 0 |
| 旁支 | SYS-FX | 3 | 0 | 0 | 3 | 0 |
| **桥接** | — | 3 | 2 | 0 | 0 | 1 |
| **总计** | — | **60** | **24** | **10** | **25** | **1** |