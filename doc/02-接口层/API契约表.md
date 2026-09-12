---
tags:
  - 虚拟校园
  - 接口层
  - API设计
  - 骨架/皮
type: design
created: 2026-08-24
updated: 2026-09-11
皮-骨架-标记: applied
---

# API 细化设计（全 16 系统 L1+L2 精确契约）

> **目的**：为全部 16 个系统提供精确到字段级别的接口契约。
> **层级**：L1 = 全局索引速查表；L2 = 每个接口的 14 字段精确定义。
> **皮/骨架**：每个接口按"换校园时要不要改"分两类——
>   - **骨架（41 个）**= 接口的形状和"它能干什么"不随校园变。参数类型、调用顺序、返回是什么——这些换哪个校园都一样。
>   - **皮（19 个）**= 接口的具体数值随校园变。比如出生点在哪、淡隐要多快、碰撞 GID 是哪些、弹窗写什么话——这些换一个校园就要调。
>   换皮时：骨架不动，只改皮那层的具体数值。好比所有校园都有"门"（骨架），但每扇门的颜色和材质不同（皮）。
>
> ### 皮标注读法（人话版）
>
> L1 索引表里写了 **"皮（X）"** ——括号里的就是"这张皮长什么样"，告诉你这个值属于哪一类。比如看到"皮（公式）"，意思是：这个数是算出来的，公式的结构（骨架）不变，但公式里的常数（像 0.1、500 这种数字）换校园要调。
>
> | 皮标签 | 到底在说什么 | 举个例子 |
> |---|---|---|
> | **皮（公式）** | 值是算出来的。公式本身（`y×系数+基数`）是骨架，但系数和基数换校园要调 | 玩家深度 `500+(y+24)×0.1`——公式结构固定，但 500、24、0.1 换校园可能要改 |
> | **皮（阈值）** | 值是判断用的门槛数字。超过/低于它就触发行为 | 站了 8 秒发呆——8 秒这个数字换校园可能要改成 10 秒 |
> | **皮（坐标）** | 值是地图上的一个点位 | 出生点 (1088,304)——换个校园当然是不同的出生点 |
> | **皮（速度/对角系数）** | 值控制移动快慢，直线和对角走速度不同 | 直走 150、对角 106——速度值换校园可能调 |
> | **皮（桥集合）** | 值是一组桥的名字列表，哪些桥要参与上下切换 | bridge1、bridge2——换校园可能只有 1 座桥，或多出 bridge3 |
> | **皮（GID 集合）** | 值是"哪些 tile ID 算墙、哪些不算"的名单 | walls 层 GID 69345=碰撞、69346=不碰撞——换校园 tileset 不同，这些 GID 数字就不同 |
> | **皮（边界）** | 值是世界的四至范围 | 相机边界 (0,0,2240,2240)——换校园世界尺寸可能不一样 |
> | **皮（序列）** | 值是一个有顺序的列表，每项含多个参数 | 开场航拍 6 个点——换校园的航拍路线不同 |
> | **皮（设备参数）** | 值是按设备类型分档的参数，不同设备用不同值 | 摇杆 radius：手机 15、平板 12——换校园可能把摇杆调大调小 |
> | **皮（文案/图片）** | 值是给人看的文字内容和图片资源 key | 弹窗的标题、正文、配图——换校园内容全换 |
> | **皮（换装集合/尺寸）** | 值是哪些衣服能换上 + 换装后显示多大 | 沙滩装 48×48 ↔ 常服 64×64——换校园可能没有沙滩场景 |
> | **皮（位置/尺寸）** | 值是 UI 元素在屏幕上的位置和大小 | 摇杆放在右下角还是居中——换校园 UI 布局可能不同 |
> | **皮（DOM 位置）** | 值是 HTML 元素（弹窗等）在页面上的放置位置 | 弹窗居中覆盖还是顶部弹出——换校园 UI 设计可能不同 |
> | **皮（depth NNN）** | 值是渲染排序数字——谁在谁上面 | 车辆 depth 550、脚印 depth 450——这些数字是根据图层策略表算出来的，换校园图层变了数字就变 |
> | **皮（效果集合）** | 值是一组可用的特效类型列表 | 粒子效果有哪几种——换校园可能需要不同的视觉效果 |
> | **皮（管线集合）** | 值是一组可用的后处理滤镜列表 | HeatHaze/Fire/Morph——换校园可能只用其中一种或加新的 |
> | **皮（区域 ID 集合）** | 值是一组触发区域的标识符列表 | 工厂屋顶区域叫"factory"、音乐厅叫"concert"——换校园的区域名字和数量都不同 |
>
> 一句话记：括号里的就是这张皮"长什么样"——它是数字、是坐标、是列表、还是文案。换校园时你只改括号里的那类东西，其他不动。

---

## L1：全局接口索引

> 看表时请配合上面「皮标注读法」——看到括号里的标注就去查上面的表，一秒看懂。

### 地图线（4 系统，串行）

| 接口ID          | 接口名            | 调用方 → 提供方           | 作用（人话）                                            | 皮/骨架      |
| ------------- | -------------- | ------------------- | ------------------------------------------------- | --------- |
| API-ASSET-001 | 资源清单查询         | WORLD/LAYER → ASSET | 查询某个资源 key 对应的 URL 和加载状态                          | 骨架        |
| API-ASSET-002 | 瓦片集（tileset）发现 | WORLD → ASSET       | 从 final_map_small.json 元数据推导出全部切块瓦片集 key          | 骨架        |
| API-ASSET-003 | 资源就绪检查         | WORLD/CHUNK → ASSET | 检查某个资源 key 是否已加载完成                                | 骨架        |
| API-WORLD-001 | createWorld    | APP/CHUNK → WORLD   | 创建全局 Tilemap（瓦片地图）和所有图层实例，返回 ready 世界             | 骨架        |
| API-WORLD-002 | destroyWorld   | APP → WORLD         | 销毁世界：禁止新写入、断开碰撞、释放图层和 Tilemap                     | 骨架        |
| API-WORLD-003 | applyChunk     | CHUNK → WORLD       | 把一块已验证的 chunk（地图分块）数据写入世界 Tilemap 对应区域            | 骨架        |
| API-WORLD-004 | removeChunk    | CHUNK → WORLD       | 清除一块 chunk 在世界 Tilemap 中的对应区域                     | 骨架        |
| API-WORLD-005 | worldSpec      | 任意系统 → WORLD        | 只读查询世界规格（尺寸、tile（瓦片）大小、像素范围）                      | 骨架        |
| API-LAYER-001 | 图层策略查询         | WORLD/CHUNK → LAYER | 按层名取得该层的处理策略（depth（渲染排序深度值）/可见性/碰撞/GID（全局瓦片ID）过滤） | 骨架        |
| API-LAYER-002 | 玩家深度计算         | PLAYER → LAYER      | 按玩家 Y 坐标计算动态深度（常态 + 桥上/特殊覆盖）                      | 皮（公式）     |
| API-LAYER-003 | roof（屋顶）淡隐控制   | ZONE → LAYER        | 玩家进入/离开 roof 区域时，对应 roof 层 300ms 淡隐/恢复            | 骨架        |
| API-LAYER-004 | bridge（桥）状态切换  | ZONE → LAYER        | 玩家上下桥时，切换上下层可见性、碰撞和玩家深度                           | 皮（桥集合）    |
| API-LAYER-005 | 碰撞GID判定        | MOVE → LAYER        | 查询某个 tile GID 是否应该参与碰撞                            | 皮（GID 集合） |
| API-CHUNK-001 | 目标集合计算         | CHUNK → CHUNK       | 给定玩家位置和相机视口，计算需要加载的 chunk（地图分块）坐标集合               | 骨架        |
| API-CHUNK-002 | chunk坐标索引      | CHUNK → CHUNK       | 世界坐标 (x,y) → chunk 坐标 (cx,cy) 和文件索引               | 骨架        |
| API-CHUNK-003 | 玩家邻域           | CHUNK → CHUNK       | 给定玩家世界坐标，返回 3×3 邻域 chunk 坐标集合                     | 骨架        |
| API-CHUNK-004 | 相机可见范围         | CAMERA → CHUNK      | 给定相机视口参数，返回可见 chunk 坐标集合（含 +1 边距）                 | 骨架        |

### 玩法线（4 系统，串行）

| 接口ID | 接口名 | 调用方 → 提供方 | 作用（人话） | 皮/骨架 |
|---|---|---|---|---|
| API-INPUT-001 | 键盘方向解析 | INPUT → INPUT | 合并方向键+WASD 键态，解析为 8 方向 | 骨架 |
| API-INPUT-002 | 摇杆方向解析 | INPUT → INPUT | 读摇杆 forceX/forceY，量化为主轴/对角 8 方向 | 皮（阈值） |
| API-INPUT-003 | 方向归一化 | MOVE → INPUT | 统一入口：键盘或摇杆 → 8 方向 + 速度 | 骨架 |
| API-INPUT-004 | 摇杆参数 | UI → INPUT | 查询当前设备摇杆参数（radius（摇杆半径）/位置/阈值） | 皮（设备参数） |
| API-MOVE-001 | 速度计算 | PLAYER → MOVE | 给定方向和 blocked 标志，返回 (vx, vy) | 皮（速度/对角系数） |
| API-MOVE-002 | 这格能走吗 | MOVE → WORLD/LAYER | 给定世界坐标(x,y)，判定该格是否可走（非墙壁） | 骨架 |
| API-MOVE-003 | blocked方向判定 | PLAYER → MOVE | 给定 Phaser body.blocked 标志，判定哪些方向被卡住 | 骨架 |
| API-PLAYER-001 | 出生点 | WORLD → PLAYER | 返回玩家出生世界坐标 (1088, 304) | 皮（坐标） |
| API-PLAYER-002 | 动态深度 | PLAYER → LAYER | 请求当前玩家 depth（渲染排序深度值）（常态 Y排序 + 桥上/特殊覆盖） | 皮（公式） |
| API-PLAYER-003 | 空闲动作判定 | PLAYER → PLAYER | 给定静止时长，判定当前应播放的空闲动作 | 皮（阈值） |
| API-PLAYER-004 | 换装状态 | ZONE → PLAYER | 触发沙滩换装（脱衣/穿衣动画 + 尺寸切换） | 皮（换装集合/尺寸） |
| API-PLAYER-005 | 朝向 | MOVE → PLAYER | 查询/设置玩家当前朝向（8 方向之一，默认 south） | 骨架 |
| API-CAMERA-001 | startFollow | PLAYER → CAMERA | 相机硬跟随玩家（lerp（线性插值）=1 逐帧贴住） | 骨架 |
| API-CAMERA-002 | 相机边界 | WORLD → CAMERA | 返回相机世界边界 (0,0,2240,2240) | 皮（边界） |
| API-CAMERA-003 | 航拍序列 | APP → CAMERA | 返回开场 6 点航拍序列（坐标+耗时+停留） | 皮（序列） |
| API-CAMERA-004 | 可见范围 | CHUNK → CAMERA | 给定相机当前 scrollX/Y/zoom/width/height，返回视口矩形 | 骨架 |

### 内容线（2 系统，串行）

| 接口ID | 接口名 | 调用方 → 提供方 | 作用（人话） | 皮/骨架 |
|---|---|---|---|---|
| API-ZONE-001 | 区域注册 | WORLD → ZONE | 注册一个触发区域（矩形/多边形 + 进入/离开回调） | 骨架 |
| API-ZONE-002 | 玩家进入判定 | ZONE → ZONE | 每帧检查玩家位置是否落入任一注册区域（bbox（边界框）判定） | 骨架 |
| API-ZONE-003 | 区域查询 | INTERACT → ZONE | 查询玩家当前所在区域列表 | 骨架 |
| API-INTERACT-001 | 弹窗触发 | ZONE → INTERACT | 玩家进入触发区域时，弹出对应内容弹窗 | 骨架 |
| API-INTERACT-002 | 弹窗关闭 | GAME-UI → INTERACT | 玩家关闭弹窗，恢复游戏控制 | 骨架 |
| API-INTERACT-003 | 弹窗内容 | INTERACT → INTERACT | 查询弹窗配置（标题/正文/图片/按钮） | 皮（文案/图片） |

### 独立件（3 系统，并行）

| 接口ID | 接口名 | 调用方 → 提供方 | 作用（人话） | 皮/骨架 |
|---|---|---|---|---|
| API-APP-001 | 应用启动 | 浏览器 → APP | 初始化 Angular/Phaser（游戏框架）框架，加载首页 | 骨架 |
| API-APP-002 | 场景切换 | APP → APP | 首页 → 游戏场景的切换（含 play 按钮） | 骨架 |
| API-APP-003 | 页面生命周期 | 浏览器 → APP | 页面可见性变化、卸载前保存状态 | 骨架 |
| API-GAME-UI-001 | HUD（抬头显示器）更新 | VARIOUS → GAME-UI | 更新 HUD 显示（坐标/状态/调试信息） | 骨架 |
| API-GAME-UI-002 | 摇杆UI | INPUT → GAME-UI | 创建/显示/隐藏虚拟摇杆 DOM 元素 | 皮（位置/尺寸） |
| API-GAME-UI-003 | 对话框UI | INTERACT → GAME-UI | 渲染弹窗 UI（标题/正文/按钮/卡牌） | 皮（DOM 位置） |
| API-ENTITY-001 | 实体注册 | NPC/ROUTE/FX → ENTITY | 注册一个游戏实体（sprite（精灵/游戏对象）等）到全局生命周期管理 | 骨架（undesign） |
| API-ENTITY-002 | 实体销毁 | ENTITY → ENTITY | 销毁一个实体及其所有关联资源 | 骨架（undesign） |
| API-ENTITY-003 | 生命周期钩子（hook） | ENTITY → ENTITY | 场景暂停/恢复/销毁时的全局通知 | 骨架（undesign） |

### 旁支（3 系统，世界盖好后并行）

| 接口ID | 接口名 | 调用方 → 提供方 | 作用（人话） | 皮/骨架 |
|---|---|---|---|---|
| API-NPC-001 | NPC注册 | WORLD → NPC | 在世界中注册一个 NPC（非玩家角色）实例（位置/贴图/动画） | 骨架 |
| API-NPC-002 | 寻路查询 | NPC → MOVE | 查询 walls-layer.json 网格 `grid[y][x]` 是否可走 | 骨架 |
| API-NPC-003 | NPC动画状态 | ENTITY → NPC | 查询/设置 NPC 当前动画状态（idle（待机）/walk（走路）/talk（说话）） | 骨架 |
| API-ROUTE-001 | 车辆注册 | WORLD → ROUTE | 注册一辆车（位置/路线/速度/贴图） | 皮（depth 550） |
| API-ROUTE-002 | 车辆路线推进 | ROUTE → ROUTE | 每帧推进车辆沿路线移动 | 骨架 |
| API-ROUTE-003 | 车辆位置 | CAMERA → ROUTE | 查询所有车辆当前位置（用于遮挡/渲染） | 骨架 |
| API-FX-001 | 粒子发射 | ZONE/ENTITY → FX | 在指定位置发射粒子效果（参数：类型/数量/时长） | 皮（效果集合） |
| API-FX-002 | 后处理管线 | CAMERA → FX | 安装/卸载后处理（post-processing）效果（HeatHaze/Fire/Morph） | 皮（管线集合） |
| API-FX-003 | 脚印生成 | PLAYER → FX | 玩家移动时在 footsteps（脚印）标记格上生成脚印 sprite（精灵） | 皮（depth 450） |

### 跨系统桥接

| 接口ID | 接口名 | 连接 | 作用 | 皮/骨架 |
|---|---|---|---|---|
| BRIDGE-001 | 这格能走吗 | MOVE ⇄ WORLD/LAYER | 移动前问地图"前面是不是墙" | 骨架 |
| BRIDGE-002 | loadChunksForCamera | CAMERA → CHUNK | 相机视口决定加载哪些 chunk（含 +1 边距） | 骨架 |
| BRIDGE-003 | roof/bridge区域判定 | ZONE → LAYER | 玩家是否进入 roof/bridge 触发区域 | 皮（区域 ID 集合） |

> **总计**：16 系统，57 个系统接口，3 条跨系统桥接（bridge）（合计 60 个接口）。

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
| 14 | 皮/骨架 | 标记换皮时是否需要改值（详见 L1 索引表） |

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
| 证据 | `src/asset/tilesets.ts` 的 `discoverOptimizedTilesets`；SYS-ASSET 卡 §1 「切块瓦片动态发现」 |

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
| 证据 | SYS-ASSET 卡 §1 「两套加载机制」；原站 `collisions` 瓦片集失败打印严重错误 |

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
| 证据 | SYS-LAYER 卡 §1 「roof 300ms 淡隐」；`BASE-ROOF-001` VERIFIED |

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
| 证据 | SYS-LAYER 卡 §1 「bridge 上下层切换 + 玩家 depth 1650」；`BASE-BRIDGE-001` VERIFIED |

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
| 证据 | `src/input/keyboard.ts` `keyboardDirection`；SYS-INPUT 卡 §1 「键盘归一化：if/else 链，8 方向」 |

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
| 证据 | `src/input/joystick.ts` `joystickDirection`；SYS-INPUT 卡 §1 「主轴判定 1.5、阈值 0.3/0.5」 |

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
| 证据 | `src/move/blocked.ts` `blockedInDirection`；SYS-MOVE 卡 §1 「卡墙则 anims.stop + 第一帧」 |

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
| 证据 | `src/player/clothing.ts` `CHANGE_CLOTHES_COOLDOWN_MS=1000`；SYS-PLAYER 卡 §1 「沙滩换装」 |

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
| 证据 | `src/player/facing.ts` `facingDirection`、`DEFAULT_FACING="south"`；SYS-PLAYER 卡 §1 「getFacingDirection」 |

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
| 证据 | `src/camera/params.ts` `FOLLOW_LERP=1`；SYS-CAMERA 卡 §1 「硬跟随 lerp=1」 |

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

---

## 三、内容线（SYS-ZONE / SYS-INTERACT）

> ✅ 状态：已定稿（`status: designed`）。两个系统卡均已按写作规范重写（9-1 文档重写周），接口签名/语义和原站可观察行为一致；未实现部分（弹窗实际渲染/双语内容）由 SYS-INTERACT 单独工作项跟进。

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
| 证据 | 原站 roof/bridge 区域判定存在，但 zone 注册机制是独立系统 |

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
| 证据 | 原站 roof 淡隐在玩家进入工厂区域时触发，表明存在区域判定逻辑；已定稿（designed，具体实现细节见 SYS-ZONE 系统卡） |

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
| 证据 | 原站 roof/bridge 区域判定已确认由 SYS-ZONE 负责；已定稿（designed） |

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
| 证据 | 原站弹窗可关闭；关闭机制已定稿（designed，见 SYS-INTERACT 系统卡） |

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
| 证据 | 原站有卡牌/作品集弹窗内容；内容结构已定稿（designed，见 04-内容层/作品集内容.md） |

---

## 四、独立件（SYS-APP / SYS-GAME-UI / SYS-ENTITY）

> ✅ **SYS-APP / SYS-GAME-UI** 状态：已定稿（`status: designed`）。两个系统卡均已按写作规范重写（9-1 文档重写周），接口签名/语义和原站可观察行为一致；运行时安全有界修复（`632a0c9`）和 Loading/Ready/Play 三状态已验证。
> ⚠️ **SYS-ENTITY** 状态：undesign（保留）。实体生命周期由各实体系统（NPC/ROUTE/FX）自治，尚未抽出独立职责；接口基于系统架构推断，正式授权前不进入设计态。

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
| 证据 | 原站 `button.btn-play` 点击触发游戏场景创建 |

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
| 证据 | 原站 `localStorage` 存 UI 状态；页面生命周期未定位 |

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
| 证据 | 原站 `localStorage` 存 `debug` 开关；HUD 实现已定稿（designed，见 SYS-GAME-UI 系统卡） |

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
| 证据 | 原站 `createJoystick` + `toggleJoystick` |

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
| 证据 | 原站有卡牌 UI 和作品集弹窗；UI 层已定稿（designed，见 SYS-GAME-UI 系统卡） |

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
| 证据 | 原站有 NPC、车辆、粒子等实体生命周期；统一管理推断 |

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
| 证据 | 原站有实体销毁（如 NPC 移除）；统一管理推断 |

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
| 证据 | 原站场景 `shutdown` 监听只移除一个 keydown handler；完整钩子推断 |

---

## 五、旁支（SYS-NPC / SYS-ROUTE / SYS-FX）

> ✅ 状态：已定稿（`status: designed`）。三个系统卡均已按写作规范重写（9-1 文档重写周），接口签名/语义和原站可观察行为一致；正式实现需单独工作项授权（不在当前工作项范围）。

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
| 证据 | 原站有 `NpcGhost`、`Rats` 类；注册接口已定稿（designed，见 SYS-NPC 系统卡） |

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
| 证据 | 原站 `walls-layer.json` 140×140 0/1 网格 + `NpcGhost.isWalkable` |

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
| 证据 | 原站有 NPC 动画；动画状态接口已定稿（designed，见 SYS-NPC 系统卡） |

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
| 证据 | 原站 `carTraffic()` 扫描 cars 层 GID 69350/69351 建立车辆 |

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
| 证据 | 原站 cars 层有车辆移动；路线推进细节未逆向 |

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
| 证据 | 原站车辆有 depth 550；位置查询已定稿（designed，见 SYS-ROUTE 系统卡） |

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
| 证据 | 原站有 particles/particles2/particles3 三个 marker 层；particles3 消费者未确认 |

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
| 证据 | 原站航拍结束装 HeatHaze/Fire/Morph 管线 |

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
| 证据 | 原站 footsteps 368 个 GID=69345 位置 + `BASE-FOOTSTEP-001` VERIFIED |

---

## 六、跨系统桥接接口

> 三条桥接接口连接了不同流水线，是"能不能并行"的开关。皮/骨架标记见 L1 索引表；变更规则见第八节。

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
| 证据 | `BASE-ROOF-001` VERIFIED、`BASE-BRIDGE-001` VERIFIED；区域判定来源未确认 |

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

## 八、皮/骨架标记与变更规则

1. **每个接口都标了皮/骨架**（见 L1 索引表）—— 皮 = 换校园时需改具体值；骨架 = 接口签名和语义不随校园变化。
2. **改皮**：直接在本表和 `03-执行层/` 对应系统卡改具体值，不改接口签名；同步更新两张表。
3. **改骨架**：必须先获得 Human 签字，再改接口签名/语义；同步更新本表和 `03-执行层/` 对应系统卡。
4. **新增接口**：必须先在 `01-理解层/` 写出原站事实或推断，再在 `03-执行层/` 写设计，最后加到本表 L1+L2；不需要签字流程（全新接口不涉及改变已有约定）。
5. **冲突解决**：常量/公式冲突时以 `03-执行层/` 对应系统卡为准；接口语义冲突时以本表为准。

---

## 九、状态汇总

| 抽屉 | 系统 | 接口数 | 骨架 | 皮 | 状态 |
|---|---|---|---|---|---|
| 地图线 | SYS-ASSET | 3 | 3 | 0 | designed |
| 地图线 | SYS-WORLD | 5 | 5 | 0 | designed |
| 地图线 | SYS-LAYER | 5 | 2 | 3 | designed |
| 地图线 | SYS-CHUNK | 4 | 4 | 0 | designed |
| 玩法线 | SYS-INPUT | 4 | 2 | 2 | designed |
| 玩法线 | SYS-MOVE | 3 | 2 | 1 | designed |
| 玩法线 | SYS-PLAYER | 5 | 1 | 4 | designed |
| 玩法线 | SYS-CAMERA | 4 | 2 | 2 | designed |
| 内容线 | SYS-ZONE | 3 | 3 | 0 | designed |
| 内容线 | SYS-INTERACT | 3 | 2 | 1 | designed |
| 独立件 | SYS-APP | 3 | 3 | 0 | designed |
| 独立件 | SYS-GAME-UI | 3 | 1 | 2 | designed |
| 独立件 | SYS-ENTITY | 3 | 3 | 0 | **undesign** |
| 旁支 | SYS-NPC | 3 | 3 | 0 | designed |
| 旁支 | SYS-ROUTE | 3 | 2 | 1 | designed |
| 旁支 | SYS-FX | 3 | 1 | 2 | designed |
| **桥接** | — | 3 | 2 | 1 | — |
| **总计** | — | **60** | **41** | **19** | 15/16 designed + 1 undesign |

> 皮/骨架统计说明：
> - **骨架（41）**：换校园时签名和语义不变；具体值在系统卡/配置文件中维护。
> - **皮（19）**：换校园时要改具体值（坐标、时长、阈值、GID、文案、DOM 位置等）；改动在本表和 `03-执行层/` 系统卡同步更新。
> - **STATUS**：15/16 系统 `designed`，1 个系统（SYS-ENTITY）保留 `undesign`（实体生命周期由各实体系统自治，尚未抽出独立职责）。

---

## 十、未覆盖范围：网络协议层

> 本表 60 个接口是 **软件层接口**（系统 A → 系统 B 的调用契约：谁调谁、传递什么、返回什么、签名和语义）。**网络协议细节不在本表覆盖范围内**——它们是另一个独立的设计层，属于"系统如何从网络获取数据"而不是"系统之间如何互调"。

### 网络协议层与接口层的分工

| 层 | 负责 | 示例 | 当前权威位置 |
|---|---|---|---|
| **接口层（本表）** | 系统之间的调用契约 | `API-ASSET-001`：WORLD 向 ASSET 查询资源 URL | 本表 + `03-执行层/` 系统卡 §5 |
| **网络协议层（未覆盖）** | HTTP 层面的数据传输细节 | chunk 文件请求用什么缓存头、CDN URL 模板 | `sample/analysis/runtime-network.json`（证据，非设计） |

### 具体未覆盖项

1. **Chunk HTTP 缓存头**：单个 chunk JSON（如 `0_0.json`）在 HTTP 响应中应带什么 `Cache-Control`/`ETag`/`Expires`。本表的 `API-CHUNK-004`（相机可见范围）只说"返回可见 chunk 坐标集合"，不规定 HTTP 层如何缓存这些 chunk 文件。当前 `sample/analysis/` 有原站实际 HTTP 响应的抓取记录（`runtime-network.json`）但未转化为设计。

2. **CDN URL 模板**：chunk JSON 和 tileset 图片的实际 CDN 路径模板（如 `https://<origin>/assets/chunks/{z}/{x}/{y}.json`）。本表的 `API-ASSET-001`（资源清单查询）返回的是逻辑 URL，不规定 URL 的物理构造方式。原站公开 build 的 `master.json` 中包含了 chunk 文件名列表，可作为 URL 构造的参考。

3. **并发请求限制**：浏览器对同一 origin 的并发连接数有限制（HTTP/1.1 通常 6 个），chunk 批量加载时需要排队和优先级策略。本表的 `API-CHUNK-001`（目标集合计算）只规定"算出需要哪些 chunk"，不规定"同时只能发几个请求"。`03-执行层/01-地图线/04-地图分块.md` §4 有请求去重和取消的讨论，但并发上限未定稿。

4. **请求超时默认值**：chunk/tileset/资源请求的超时时间（例如 10s、30s）、超时后是重试还是降级。本表所有接口的 L2 字段"异常处理"只说"超时 → 重试/降级"，不指定具体毫秒数。`03-执行层/统一失败处理策略.md` 给出了可恢复/可降级/致命三级分类和 N 次重试框架，但 N 的值和超时毫秒数未定稿（属于 Phase 2 网络基础设施配置）。

### 为什么这是有意的边界

Phase 1 的逆向和复刻验证重点是**恢复系统知识和建立骨架**——接口层定义了系统之间的调用契约，骨架够用了。网络协议细节（缓存策略、CDN 路径、并发控制、超时参数）属于：

- **部分依赖 Phase 2 基础设施**：当 Phase 2 补后端和 CDN 时，这些参数自然会确定
- **部分可在 Phase 1 后期补**：如果在 Phase 1 中需要完整的网络层实现（例如做性能基准测试），届时单独立项设计网络协议层，不作为当前接口层的缺口

当下：如果需要在 `src/` 中实现网络请求，使用合理的工程默认值（超时 10s、最多 6 个并发、无缓存）并在系统卡 §4 记录；正式的网络协议设计另行授权。

---

## 十一、专有名词速查（本表所有英文术语中文对照）

> 本表使用了大量游戏开发和项目专属英文词，这里一次性列出中文含义和上下文，方便阅读 L1/L2 时对照。
> 术语的完整定义见 [术语表.md](../术语表.md)，本节只列出本文档中出现的词。

### 游戏引擎与框架

| 英文 | 中文 | 一句话解释 |
|---|---|---|
| **Phaser** | Phaser 游戏框架 | 本项目使用的开源 2D 游戏引擎（TypeScript/JS） |
| **Tilemap** | 瓦片地图 | Phaser 内置的地图数据类型——由一个个小格子（tile）拼成的完整地图 |
| **Arcade** | Arcade 物理引擎 | Phaser 内置的轻量物理引擎，处理碰撞和移动 |
| **DOM** | 文档对象模型 / 页面元素 | 浏览器里的 HTML 元素（弹窗、按钮等），和游戏 Canvas 是两个层 |

### 地图与坐标

| 英文 | 中文 | 一句话解释 |
|---|---|---|
| **chunk** | 地图分块 | 大世界切成的小块，每块 28×28 tile。25 个 chunk 拼成完整世界（5×5 网格） |
| **tile** | 瓦片 | 地图的最小网格单元——16×16 px 的小方格 |
| **GID** | 全局瓦片 ID | tileset 里每个 tile 的唯一编号。用 GID 区分墙、地面、装饰 |
| **tileset** | 瓦片集 | 一堆 tile 的图片集合（一张大图切成很多小图），每个 tile 有唯一 GID |
| **tileset firstgid** | 瓦片集起始 GID | tileset 的第一个 tile 的 GID——后续 tile 依次 +1 |
| **world / pixel coordinates** | 世界 / 像素坐标 | 以世界左上角为原点 (0,0) 的像素坐标。世界 2240×2240 px |
| **tile coordinates** | 瓦片坐标 | 以 tile 为单位的坐标，范围 0-139（140×140 格），换算：`pixel = tile × 16` |

### 图层与渲染

| 英文 | 中文 | 一句话解释 |
|---|---|---|
| **layer** | 图层 | 地图的一层——像透明胶片叠起来，共 24 层（visual/collision/marker/dynamic 四种角色） |
| **depth** | 渲染排序深度值 | 数字越大越靠前显示。玩家 depth 在 500-726 之间，桥墙层 3500 |
| **alpha** | 透明度 | 0=全透明、1=不透明。屋顶淡隐就是 alpha 从 1 渐变到 0 |
| **roof** | 屋顶（层） | 4 个 roof 层（factory×2 + concert×2），玩家进入下方区域时淡隐 |
| **bridge** | 桥（层） | 4 个桥上下墙层（bridge1/2），玩家上桥/下桥时切换碰撞和可见性 |
| **visual** | 视觉层 | 给人看的——直接写入 Tilemap 显示 |
| **collision** | 碰撞层 | 不显示，只供物理引擎检测碰撞（如 walls 层） |
| **marker** | 标记层 | 不显示，存坐标数据——供车、粒子、脚印等系统读出世界位置 |
| **dynamic-visual / dynamic-collision** | 动态视觉 / 动态碰撞层 | 比 static 多一个动态状态（如 roof alpha 变化、bridge 上下切换） |
| **walls** | 墙壁碰撞层 | 第 19 层（索引 19），GID 69345=墙=不可走、69346=不碰撞 |
| **particles / particles2 / particles3** | 粒子 1/2/3 层 | 3 个粒子特效标记层。particles3 消费者仍未知（Q-LAYER-002 待解） |
| **footsteps** | 脚印层 | 第 24 层（索引 23），记录脚下沙地 368 个 GID 位置 |
| **cars** | 车辆标记层 | 第 11 层（索引 10），存放车辆路线 marker（8 个 GID） |

### 实体与行为

| 英文 | 中文 | 一句话解释 |
|---|---|---|
| **NPC** | 非玩家角色 | 游戏里自动行为的角色（幽灵、老鼠等），不由玩家控制 |
| **sprite** | 精灵 / 游戏对象 | Phaser 里所有可显示、可移动的东西（玩家、NPC、车、脚印等）都是 sprite |
| **idle** | 待机 / 发呆动作 | 玩家/NPC 长时间没操作时的自动动画（如坐下、挠头） |
| **walk** | 走路动画 | 移动中的动画帧序列 |
| **body** | 物理体 | 精灵在物理引擎里的"碰撞盒子"——玩家碰撞体 20×8 px |
| **blocked** | 卡住标志 | Phaser body.blocked 的四个方向标志——碰上墙就变 true |
| **collider** | 碰撞器 | Phaser Arcade 的一种碰撞检测对象（两个 body 碰到就触发） |

### 动画与特效

| 英文 | 中文 | 一句话解释 |
|---|---|---|
| **tween** | 补间动画 | Phaser 内置的"从 A 渐变成 B"动画。屋顶 300ms alpha 渐变就是 tween |
| **lerp** | 线性插值 | "在两个值之间匀速过渡"。相机 lerp=1 就是逐帧直接贴到目标（不平滑） |
| **post-processing / pipeline** | 后处理 / 渲染管线 | 画面渲染完之后再叠加的效果滤镜（热浪 HeatHaze/火焰 Fire/变形 Morph） |
| **emitter** | 粒子发射器 | 持续产生粒子精灵的对象——如烟雾、火花 |
| **keyframe / animation** | 关键帧 / 动画序列 | 按顺序播放的精灵贴图帧——走路动效就是一系列关键帧 |

### 路径与寻路

| 英文 | 中文 | 一句话解释 |
|---|---|---|
| **pathfinding** | 寻路 | 在网格地图上找到从 A 到 B 的最短可走路径 |
| **walls-layer.json** | 墙壁网格文件 | 140×140 的 0/1 矩阵——0=可走（12121 格）、1=墙（7479 格） |
| **bbox** | 边界框 / bounding box | 用左上角和右下角坐标定义的矩形区域 |
| **marker route** | 标记路线 | 从 cars 层 marker GID 解析出的车辆行驶路径节点序列 |

### UI 与交互

| 英文 | 中文 | 一句话解释 |
|---|---|---|
| **HUD** | 抬头显示器 | 游戏画面上叠加的调试信息（坐标、速度、FPS 等） |
| **joystick / 摇杆** | 虚拟摇杆 | 移动端触摸屏上的模拟摇杆控件 |
| **interaction / dialog** | 交互弹窗 | 玩家进入区域后弹出的内容窗口（卡牌、文字、图片） |
| **canvas** | 画布 | HTML5 `<canvas>` 元素——Phaser 画的游戏世界就在这张画布上 |
| **lifecycle / 生命周期** | 生命周期 | 一个东西从创建到销毁的完整阶段：创建→运行中→暂停→销毁 |

### 坐标换算速记

| 问题 | 答案 |
|---|---|
| tile 坐标 → 世界像素坐标 | `pixelX = tileX × 16`，`pixelY = tileY × 16` |
| 世界像素坐标 → chunk 坐标 | `chunkX = floor(pixelX / (28×16))`，`chunkY = floor(pixelY / (28×16))` |
| chunk 坐标 → 文件索引 | `index = chunkY × 5 + chunkX`，文件名 `{chunkX}_{chunkY}.json` |
| 世界 tile 坐标 | 范围 0-139（140×140 格），左上角是 (0,0) |
| chunk 坐标范围 | cx∈[0,4]，cy∈[0,4]，共 25 个 chunk |

### 项目专属缩写

| 缩写          | 全称 / 中文                                | 含义                                       |
| ----------- | -------------------------------------- | ---------------------------------------- |
| **SYS-**    | System / 系统                            | 一个独立的功能系统（如 SYS-CHUNK）                   |
| **API-**    | Application Programming Interface / 接口 | 一个系统对外的调用契约                              |
| **BRIDGE-** | 桥接接口                                   | 连接两条不同流水线的接口                             |
| **WI-**     | Work Item / 工作项                        | 一个可执行的开发任务单元                             |
| **Q-**      | Question / 未解问题                        | 待调查或待确认的未知项                              |
| **L1 / L2** | Level 1 / Level 2                      | L1=索引总表，L2=每个接口的 14 字段精确定义               |
| **CORE**    | 核心 / 确定性逻辑                             | 纯 TypeScript 逻辑——不依赖 Phaser/网络/浏览器就能跑和测试 |
| **皮 / 骨架**  | Skin / Skeleton                        | 皮=换校园要改的具体值；骨架=换校园不变的接口形状和语义             |