---
tags: [虚拟校园, 执行层, 系统卡]
system: SYS-NPC
status: designed
updated: 2026-09-02
---

# NPC 与环境实体（SYS-NPC）—— 执行层细化

> 对照理解层的 5 个骨架 + 7 张皮 + 9 个配置点，逐一落到代码位置。

---

## 👀 先看这里（给 Human 的人话总结）

**当前状态**：所有 7 类 NPC 都有完整实现——核心逻辑在 `src/npc/`（7 个 Runtime 类 + 1 个 A* 寻路器），表现适配在 `game/`（6 个 PhaserRuntime 类）。代码结构清晰：核心层纯 TypeScript 逻辑，表现层只负责 Phaser 精灵的创建/销毁/动画。

**还没做的**：所有 NPC 配置数据硬编码（区域坐标、人数、速度、精灵图分配），将来要从后端配置下发。

---

## 总览图：骨架→代码 对照

```
骨架                              代码
─────────────────────────    ─────────────────────────────────
① 固定生命周期                src/npc/ 各 Runtime（start/tick/cancel/shutdown）
                              game/Phaser*Runtime.ts（适配层）

② 视口裁剪                    src/npc/ 各 Runtime（materialized 标志位计算）
                              game/Phaser*Runtime.ts（sync/syncView 创建/销毁精灵）

③ 核心逻辑与表现分离            src/npc/*.ts（纯逻辑）
                              game/Phaser*Runtime.ts（Phaser 适配）

④ 按区域/路线放置              src/npc/staticCrowd.ts（多边形 + 密度公式 + random 撒点）
                              src/npc/routeCrowd.ts（grid → A* 路径）
                              src/npc/venueCrowdRuntime.ts（区域内 random 撒点 + 间距约束）

⑤ 可取消/暂停/分组             src/npc/routeCrowd.ts（pauseGroup/resumeGroup）
                              各 Runtime（cancel/shutdown 方法）
```

---

## 一、骨架落地 —— 每根骨头对应哪块代码

### 骨架 1：固定生命周期

> 理解层说的是"每个 NPC 都有确定的生老病死流程"。
> 在代码里，每一类 NPC 都是一个 Runtime 类，统一遵循 **start → tick → cancel → shutdown** 四步。

**它怎么工作的**：

```
start(now, viewport)
  │  初始化 NPC 队伍（计算位置、选精灵、算路径）
  │  设 started=true
  ▼
tick(now, viewport)  ← 每帧调用
  │  更新位置（走一步、播动画）
  │  计算 materialized（在不在屏幕内）
  │  返回 snapshot（让表现层知道该画什么）
  ▼
cancel()
  │  清空所有 NPC 实例
  │  started=false，但 Runtime 还活着（可以重新 start）
  ▼
shutdown()
  │  设 dead=true
  │  清空所有实例
  │  Runtime 不可再用了
```

**代码在哪**：

| 做什么         | 文件路径                                                                   | 关键类/方法                                                                |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 静态 NPC 生命周期 | [src/npc/staticNpc.ts](src/npc/staticNpc.ts)                           | `StaticNpcRuntime` → `start(tick) → tick() → cancel() → shutdown()`   |
| 静态人群生命周期    | [src/npc/staticCrowd.ts](src/npc/staticCrowd.ts)                       | `StaticCrowdRuntime` → `start(tick) → tick() → cancel() → shutdown()` |
| 路线人群生命周期    | [src/npc/routeCrowd.ts](src/npc/routeCrowd.ts)                         | `RouteCrowdRuntime` → `start() → tick() → cancel() → shutdown()`      |
| 跳舞人群生命周期    | [src/npc/dancingCrowd.ts](src/npc/dancingCrowd.ts)                     | `DancingCrowdRuntime` → `start() → tick() → shutdown()`               |
| 虫子群生命周期     | [src/npc/bugCrowd.ts](src/npc/bugCrowd.ts)                             | `BugCrowdRuntime` → `start() → tick() → cancel() → shutdown()`        |
| 场馆人群生命周期    | [src/npc/venueCrowdRuntime.ts](src/npc/venueCrowdRuntime.ts)           | `VenueCrowdRuntime` → `start() → tick() → shutdown()`                 |
| 喷水器生命周期     | [src/npc/sprayer.ts](src/npc/sprayer.ts)                               | `SprayerGroupRuntime` → `start() → tick() → cancel() → shutdown()`    |
| Phaser 适配层  | [game/PhaserStaticNpcRuntime.ts](game/PhaserStaticNpcRuntime.ts)       | 六个 Phaser Runtime，每个包裹一个 src Runtime                                  |
| Phaser 适配层  | [game/PhaserStaticCrowdRuntime.ts](game/PhaserStaticCrowdRuntime.ts)   | 同步 snapshot → 创建/销毁 sprite                                            |
| Phaser 适配层  | [game/PhaserRouteCrowdRuntime.ts](game/PhaserRouteCrowdRuntime.ts)     | 同上，额外处理 17 种纹理                                                        |
| Phaser 适配层  | [game/PhaserDancingCrowdRuntime.ts](game/PhaserDancingCrowdRuntime.ts) | 8 方向跳舞动画                                                              |
| Phaser 适配层  | [game/PhaserBugCrowdRuntime.ts](game/PhaserBugCrowdRuntime.ts)         | 虫子 4 方向爬行动画                                                           |
| Phaser 适配层  | [game/PhaserVenueCrowdRuntime.ts](game/PhaserVenueCrowdRuntime.ts)     | 抗议者 + 对话框                                                             |

---

### 骨架 2：视口裁剪

> 理解层说的是"屏幕外的 NPC 销毁精灵，屏幕内的创建精灵"。
> 在代码里，这叫 **materialized 标志位 + sync/syncView 机制**。

**它怎么工作的**：

核心层每帧只做一件事：检查每个 NPC 的位置是否在 viewport + margin 范围内。

```
viewport: { left, top, width, height }
NPC 位置: { x, y }

检查公式：
  x >= viewport.left - margin &&
  x <= viewport.left + viewport.width + margin &&
  y >= viewport.top - margin &&
  y <= viewport.top + viewport.height + margin

结果：
  true  → materialized = true  （Phaser 适配层创建/保持精灵）
  false → materialized = false （Phaser 适配层销毁精灵，保留数据）
```

**额外机制**：
- 静态人群：用了"扩展边距"——如果区域当前在视野内，margin 多加 100px（防止频繁进出裁剪边界导致闪烁）
- 场馆人群：用了"预热边距"400px + "回收边距"500px——第一次看见时离远一点就准备，已经激活后要走更远才回收

**代码在哪**：

| 做什么 | 文件路径 + 行号 | 关键常量 |
|---|---|---|
| 静态 NPC 裁剪 | [src/npc/staticNpc.ts:90-101](src/npc/staticNpc.ts#L90-L101) — `isNearViewport()` | `STATIC_NPC_VIEWPORT_MARGIN = 300` |
| 静态人群裁剪 | [src/npc/staticCrowd.ts:4042-4055](src/npc/staticCrowd.ts#L4042-L4055) — `tick()` 中 region AABB 相交判断 | `STATIC_CROWD_VIEWPORT_MARGIN = 300` |
| 路线人群裁剪 | [src/npc/routeCrowd.ts:245-284](src/npc/routeCrowd.ts#L245-L284) — `pointInSafeRange()` + `pathIntersectsSafeRange()` | `ROUTE_CROWD_SAFE_MARGIN = 100` |
| 跳舞者裁剪 | [src/npc/dancingCrowd.ts:4-5](src/npc/dancingCrowd.ts) — `tick()` 中直接 AABB 判断 | 无 margin（精确裁剪） |
| 虫子裁剪 | [src/npc/bugCrowd.ts:17](src/npc/bugCrowd.ts) — `view()` 中直接 AABB 判断 | 无 margin（精确裁剪） |
| 场馆裁剪 | [src/npc/venueCrowdRuntime.ts:96-103](src/npc/venueCrowdRuntime.ts#L96-L103) — 预热/回收双 margin | `VENUE_PREWARM_MARGIN = 400`, `VENUE_RECYCLE_MARGIN = 500` |
| 喷水器 | 无裁剪（只有 4 个，始终可见） | — |
| Phaser 适配-静态 NPC 同步 | [game/PhaserStaticNpcRuntime.ts](game/PhaserStaticNpcRuntime.ts) `sync()` | 根据 materialized 创建/销毁 sprite |
| Phaser 适配-静态人群同步 | [game/PhaserStaticCrowdRuntime.ts](game/PhaserStaticCrowdRuntime.ts) `sync()` | 同上，额外处理 track band 避开 |

---

### 骨架 3：核心逻辑与表现分离

> 理解层说的是"规则代码在 src/，画图代码在 game/"。
> 在代码里，这就是 **Runtime 模式 + `*Like` 接口抽象**。

**它怎么工作的**：

```
src/npc/staticNpc.ts         → StaticNpcRuntime        （纯逻辑：位置、裁剪、状态）
game/PhaserStaticNpcRuntime.ts → PhaserStaticNpcRuntime （表现：精灵创建/销毁/动画）

分层规则：
  src/  文件 → 零 DOM/Canvas/timer 依赖，可脱离浏览器单元测试
  game/ 文件 → 通过 *Like 接口接入 Phaser，不依赖 Phaser 具体实现类

数据流：
  StaticNpcRuntime.tick(viewport) → StaticNpcSnapshot
    └─ StaticNpcInstanceSnapshot { id, position, materialized }
        ↓
  PhaserStaticNpcRuntime.sync(snapshot)
    └─ materialized=true  → Phaser sprite 创建/更新
    └─ materialized=false → Phaser sprite 销毁
```

**代码在哪**：

| 层 | 文件 | Runtime 名 | 对应适配层 |
|---|---|---|---|
| 核心 | [src/npc/staticNpc.ts](src/npc/staticNpc.ts) | `StaticNpcRuntime` | [game/PhaserStaticNpcRuntime.ts](game/PhaserStaticNpcRuntime.ts) |
| 核心 | [src/npc/staticCrowd.ts](src/npc/staticCrowd.ts) | `StaticCrowdRuntime` | [game/PhaserStaticCrowdRuntime.ts](game/PhaserStaticCrowdRuntime.ts) |
| 核心 | [src/npc/routeCrowd.ts](src/npc/routeCrowd.ts) | `RouteCrowdRuntime` | [game/PhaserRouteCrowdRuntime.ts](game/PhaserRouteCrowdRuntime.ts) |
| 核心 | [src/npc/dancingCrowd.ts](src/npc/dancingCrowd.ts) | `DancingCrowdRuntime` | [game/PhaserDancingCrowdRuntime.ts](game/PhaserDancingCrowdRuntime.ts) |
| 核心 | [src/npc/bugCrowd.ts](src/npc/bugCrowd.ts) | `BugCrowdRuntime` | [game/PhaserBugCrowdRuntime.ts](game/PhaserBugCrowdRuntime.ts) |
| 核心 | [src/npc/venueCrowdRuntime.ts](src/npc/venueCrowdRuntime.ts) | `VenueCrowdRuntime` | [game/PhaserVenueCrowdRuntime.ts](game/PhaserVenueCrowdRuntime.ts) |
| 核心 | [src/npc/sprayer.ts](src/npc/sprayer.ts) | `SprayerGroupRuntime` | （内嵌在 `gamescene` 中直接使用 snapshot） |
| 核心 | [src/npc/gridPathProvider.ts](src/npc/gridPathProvider.ts) | `GridRouteCrowdPathProvider` | 被 `RouteCrowdRuntime` 使用 |

**接口抽象示例**（路线人群寻路器）：

```typescript
// 核心层只依赖接口，不依赖具体寻路实现
interface RouteCrowdPathProvider {
  findPath(request: RouteCrowdPathRequest): RouteCrowdPathResult;
}
// 可以注入任何实现：A*、Dijkstra、Web Worker 寻路……
```

---

### 骨架 4：按区域/路线放置，不逐个写死

> 理解层说的是"不写死坐标，而是写区域 + 公式"。
> 在代码里，这分三条路：**静态人群 = 多边形撒点**，**路线人群 = 格子起点终点 + A***，**场馆人群 = 区域内随机撒 + 间距约束**。

**① 静态人群：多边形 + 密度公式**（[src/npc/staticCrowd.ts](src/npc/staticCrowd.ts)）

```
46 个源区域（SOURCE_REGIONS）→ 每个区域有 outline 多边形 + tileCount + type

人数计算公式（staticCrowdRequestedCount）：
  · 足球队（id=football_team_blue/red）→ 固定 10 人
  · STOP_AI 背景区（index=64）→ 固定 2 人
  · 普通区 → max(5, floor(width × height × factor))
    · 稀疏区 factor = 0.004
    · 密集区 (crowd_up) factor = 0.016

撒点逻辑（makePlacements）：
  ① 对每个区域，随机选 point within bounding box
  ② 用 pointInPolygon 判断是否在 outline 内
  ③ 检查与已放置 NPC 的距离 ≥ STATIC_CROWD_MIN_SPACING(20px)
  ④ 咖啡区域用 COFFEE_STATIC_MIN_SPACING(56px) 加大间距
  ⑤ 最多尝试 STATIC_CROWD_MAX_PLACEMENT_ATTEMPTS_PER_INSTANCE(20) 次

精灵分配：按区域 category（ordinary/beach/football）分配不同精灵池
方向分配：crowd_up 区域只朝上（north-east/north/north-west），火车站只朝前
```

**② 路线人群：格子起点终点 + A***（[src/npc/routeCrowd.ts](src/npc/routeCrowd.ts) + [src/npc/gridPathProvider.ts](src/npc/gridPathProvider.ts)）

```
11 条路线配置（ROUTE_CROWD_CONFIGS）：
  每条路线有：startTiles[] / endTiles[] / count / movementSpeed / goBack / deleteAfterComplete

启动流程（beginBatchedStart → processBatchedStart，每次 4 个）：
  ① 遍历 11 条 config，为每条 config 生成 count × 3 个候选 (startTile, endTile) 组合
  ② 对每个候选，调用 pathProvider.findPath() 算 A* 路径
  ③ 路径有效 → 取随机起点（randomPositions=true 时）→ 检查 occupied/visual spacing → 创建实例
  ④ 路径失败 → batchedPathFailures++

实例状态机：
  delay → moving → (goBack ? delay(returning) : gone)
                 → (completionExit ? returning → [沿反向路径离屏] : done)
  moving 中若下一格被 block → waiting → (不 blocked 后) → moving
```

**③ 场馆人群：区域内随机撒 + 间距约束**（[src/npc/venueCrowdRuntime.ts](src/npc/venueCrowdRuntime.ts)）

```
4 个区域（VENUE_CROWD_REGIONS）：3 个音乐会 + 1 个抗议区
撒点：同静态人群的随机撒点方式，外加 spacing 最小间距约束
```

**代码在哪**：

| 做什么 | 文件路径 | 关键函数/数据 |
|---|---|---|
| 静态人群区域定义 | [src/npc/staticCrowd.ts:90-3793](src/npc/staticCrowd.ts) | `SOURCE_REGIONS`（46 个多边形区域） |
| 静态人群人数计算 | [src/npc/staticCrowd.ts:3833-3845](src/npc/staticCrowd.ts) | `staticCrowdRequestedCount()` |
| 静态人群撒点 | [src/npc/staticCrowd.ts:3926-3990](src/npc/staticCrowd.ts) | `makePlacements()` |
| 路线人群配置 | [src/npc/routeCrowd.ts:165-177](src/npc/routeCrowd.ts) | `ROUTE_CROWD_CONFIGS`（11 条路线） |
| 路线人群启动 | [src/npc/routeCrowd.ts:372-562](src/npc/routeCrowd.ts) | `beginBatchedStart()` + `processBatchedStart()` |
| A* 寻路器 | [src/npc/gridPathProvider.ts](src/npc/gridPathProvider.ts) | `GridRouteCrowdPathProvider.findPath()` |
| 场馆区域定义 | [src/npc/venueCrowd.ts](src/npc/venueCrowd.ts) | `VENUE_CROWD_REGIONS`（4 个区域） |
| 场馆撒点 | [src/npc/venueCrowdRuntime.ts:60-89](src/npc/venueCrowdRuntime.ts) | `VenueCrowdRuntime.start()` |
| 跳舞者配置 | [src/npc/dancingCrowd.ts:1](src/npc/dancingCrowd.ts) | `DANCING_CROWD_CONFIG` |
| 虫子配置 | [src/npc/bugCrowd.ts:12](src/npc/bugCrowd.ts) | `BUG_CROWD_CONFIG` |
| 喷水器配置 | [src/npc/sprayer.ts:27-136](src/npc/sprayer.ts) | `SPRAYER_CONFIGS`（4 个喷水器 + 逃跑路线） |

---

### 骨架 5：可取消、可暂停、可分组管理

> 理解层说的是"不同组可以独立控制"。
> 在代码里，每个 Runtime 独立管理生命周期，外加 `pauseGroup/resumeGroup` 分组暂停。

**它怎么工作的**：

```
Runtime 独立生命周期：
  cancel()  → 清空 items[]，started=false，但 Runtime 仍可重新 start()
  shutdown() → dead=true，再也无法 start()

分组暂停（RouteCrowdRuntime）：
  pauseGroup("crowd-train")   → 该组的所有实例停止 tick（state 不变）
  resumeGroup("crowd-train")  → 该组恢复正常更新

典型场景：火车到站时需要清空铁路区域的人：
  ① pauseGroup("crowd-train")    ← 火车到站前暂停
  ② 火车开走后 resumeGroup("crowd-train")
```

**代码在哪**：

| 做什么 | 文件路径 + 行号 | 关键方法 |
|---|---|---|
| 路线人群分组暂停 | [src/npc/routeCrowd.ts:677-684](src/npc/routeCrowd.ts) | `pauseGroup()` / `resumeGroup()` |
| 通用取消 | 各 Runtime 文件 | `cancel()` / `shutdown()` |
| 静态 NPC 取消 | [src/npc/staticNpc.ts:150-159](src/npc/staticNpc.ts) | `cancel()` / `shutdown()` |
| 静态人群取消 | [src/npc/staticCrowd.ts:4075-4086](src/npc/staticCrowd.ts) | `cancel()` / `shutdown()` |

---

## 二、皮落地 —— 每张皮对应哪个文件

| 皮 | 精确值 | 在哪 |
|---|---|---|
| NPC 大类 | 7 类：staticNpc/staticCrowd/routeCrowd/dancingCrowd/bugCrowd/venueCrowd/sprayer | [src/npc/index.ts](src/npc/index.ts)（所有导出） |
| 静态 NPC（3 个） | special-reading(tileX=72,tileY=53,scale=0.9,frameRate=3)、special-eating(54,63,0.73,4)、cat-licking(12,106,1.0,6) | [src/npc/staticNpc.ts:49-81](src/npc/staticNpc.ts) `STATIC_NPC_CONFIGS` |
| 静态人群区域数 | 46 个（regionIndex 29~74），含海滩(beach_crowd)、足球队(football_team_blue/red)、抗议区(protest_zone)、火车站(station_static_crowd) | [src/npc/staticCrowd.ts:88-3793](src/npc/staticCrowd.ts) `SOURCE_REGIONS` |
| 静态人群精灵池 | ordinary: npc-man ~ npc-woman8 (17种)、beach: npc-man-beach ~ npc-woman-beach2 (4种)、football: npc_footballer_blue/red (2种) | [src/npc/staticCrowd.ts:75-86](src/npc/staticCrowd.ts) `DEFAULT_SPRITE_POOLS` |
| 路线人群（11 条） | main-crowd(10人)/loop-crowd(10人)/drinkers(5人)/concert_crowd(40人)/beach_crowd_walk(4人)/vertical-crowd(10人)/vertical-crowd-reverse(10人)/walking-crowd(8人)/hazmat-crowd(8人)/outside_concert1(10人)/crowd-train(10人) | [src/npc/routeCrowd.ts:165-177](src/npc/routeCrowd.ts) `ROUTE_CROWD_CONFIGS` |
| 跳舞者 | 8 人，区域 tileX 114~131 / tileY 100~102，depth=500，scale=0.9，frameRate=6，4 方向 | [src/npc/dancingCrowd.ts:1](src/npc/dancingCrowd.ts) `DANCING_CROWD_CONFIG` |
| 虫子 | 10 只，tileX 5~23 / tileY 128~133，speed=15，sprite="npc-bug"，maxActive=40 | [src/npc/bugCrowd.ts:12](src/npc/bugCrowd.ts) `BUG_CROWD_CONFIG` |
| 场馆区域 | 3 个音乐会(concert-84/85/86，共 460 人，spacing=18) + 1 个抗议区(protesters_rising-87，30 人，spacing=20) | [src/npc/venueCrowd.ts:3-5](src/npc/venueCrowd.ts) `VENUE_CROWD_REGIONS` |
| 喷水器（4 个） | sprayer-60-25/67-25/71-25/78-25，escapeRoute 长度 3~59 点，frameRate=6，scale=0.9，depth=500 | [src/npc/sprayer.ts:27-136](src/npc/sprayer.ts) `SPRAYER_CONFIGS` |
| 寻路算法 | 自定义 A*，8 方向（对角 cost 1.41），每帧 64 迭代，max 50000 迭代，seeded random 打破对称 | [src/npc/gridPathProvider.ts](src/npc/gridPathProvider.ts) |
| Phaser 适配-静态 NPC | 3 个精灵图 key: npc-special-reading/eating, npc-cat-licking，depth=500+y*0.1 | [game/PhaserStaticNpcRuntime.ts](game/PhaserStaticNpcRuntime.ts) |
| Phaser 适配-静态人群 | walk 动画帧起点按方向映射(walkFrameStart)，keepStaticCrowdOffTrack 避开 | [game/PhaserStaticCrowdRuntime.ts](game/PhaserStaticCrowdRuntime.ts) |
| Phaser 适配-路线人群 | 17 种 NPC 纹理分 normal/train 两组，各组有 spriteKey+offset+visualOffset | [game/PhaserRouteCrowdRuntime.ts](game/PhaserRouteCrowdRuntime.ts) |
| Phaser 适配-跳舞者 | 8 方向 × 16 帧，frameRate=6，depth=500，scale=0.9 | [game/PhaserDancingCrowdRuntime.ts](game/PhaserDancingCrowdRuntime.ts) |
| Phaser 适配-虫子 | 24 帧，10fps，38×38 帧尺寸，scale=0.63，origin(0.5,0.85)，4 方向面对 | [game/PhaserBugCrowdRuntime.ts](game/PhaserBugCrowdRuntime.ts) |
| Phaser 适配-场馆 | 抗议者 idle/acting 阶段切换，方向随机变换，对话框系统（"People, not machines!"等），depth≥700 | [game/PhaserVenueCrowdRuntime.ts](game/PhaserVenueCrowdRuntime.ts) |

---

## 三、配置点 —— 现在硬编码，将来后端下发

| 能改什么       | 现在硬编码在哪                                                                                             | 现在的值                                                        | 将来           |
| ---------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------ |
| NPC 类型清单   | 各 Runtime config 文件                                                                                 | 7 大类，硬编码                                                    | 后端 JSON 统一下发 |
| 静态人群区域坐标   | [src/npc/staticCrowd.ts](src/npc/staticCrowd.ts)                                                    | 46 个多边形（数千行坐标）                                              | 后端配置下发       |
| 密度系数       | [src/npc/staticCrowd.ts:63-64](src/npc/staticCrowd.ts)                                              | `STATIC_CROWD_FACTOR=0.004`, `STATIC_CROWD_UP_FACTOR=0.016` | 后端配置         |
| 裁剪安全边距     | [src/npc/staticNpc.ts:45](src/npc/staticNpc.ts)、[src/npc/staticCrowd.ts:65](src/npc/staticCrowd.ts) | 300px（静态），100~500px（路线/场馆）                                  | 后端配置         |
| 各路线 NPC 数量 | [src/npc/routeCrowd.ts:165-177](src/npc/routeCrowd.ts)                                              | 4~40 人不等                                                    | 后端配置         |
| NPC 移动速度   | [src/npc/routeCrowd.ts:122](src/npc/routeCrowd.ts)、[src/npc/bugCrowd.ts:12](src/npc/bugCrowd.ts)    | baseSpeed=48，虫子 15                                          | 后端配置         |
| 随机等待时间     | [src/npc/routeCrowd.ts:167-177](src/npc/routeCrowd.ts)                                              | 0~35000ms 不等                                                | 后端配置         |
| 各 NPC 深度值  | 各 game/Phaser*Runtime.ts                                                                            | 500~700+，部分动态 y×0.1                                         | 后端配置         |
| 视口内创建上限    | [src/npc/routeCrowd.ts:165-177](src/npc/routeCrowd.ts)                                              | 各 config 不同（5~40）                                           | 后端配置         |

---

## 四、所有代码位置一页速查

```
src/npc/
  index.ts              — 所有导出统一入口
  staticNpc.ts          — StaticNpcRuntime（3 个固定 NPC 核心逻辑）
  staticCrowd.ts         — StaticCrowdRuntime（46 区域静态人群核心逻辑 + 多边形撒点）
  routeCrowd.ts          — RouteCrowdRuntime（11 路线人群核心逻辑 + 状态机 + 分组暂停）
  routeCrowdRuntime.ts   — 空壳（实际在 routeCrowd.ts）
  gridPathProvider.ts    — GridRouteCrowdPathProvider（A* 寻路，8 方向，分帧计算）
  dancingCrowd.ts        — DancingCrowdRuntime（8 个跳舞者核心逻辑）
  bugCrowd.ts            — BugCrowdRuntime（10 只虫子 wander 逻辑）
  venueCrowd.ts          — VENUE_CROWD_REGIONS（4 个场馆区域定义）
  venueCrowdRuntime.ts   — VenueCrowdRuntime（场馆人群 + 双 margin 裁剪）
  sprayer.ts             — SprayerGroupRuntime（4 个喷水器 + 触发逃跑逻辑）

game/
  PhaserStaticNpcRuntime.ts     — 静态 NPC Phaser 适配（3 spritesheet + 动画）
  PhaserStaticCrowdRuntime.ts   — 静态人群 Phaser 适配（walk 动画 + track 避开）
  PhaserRouteCrowdRuntime.ts    — 路线人群 Phaser 适配（17 纹理 + 分批创建）
  PhaserDancingCrowdRuntime.ts  — 跳舞者 Phaser 适配（8 方向跳舞动画）
  PhaserBugCrowdRuntime.ts      — 虫子 Phaser 适配（4 方向爬行动画）
  PhaserVenueCrowdRuntime.ts    — 场馆人群 Phaser 适配（抗议者 + 对话框）
```