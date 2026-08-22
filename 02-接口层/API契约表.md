---
tags:
  - 虚拟校园
  - 接口层
  - 接口
type: handoff
created: 2026-08-14
updated: 2026-08-22
---

# API 契约表（系统之间的接口约定）

> **两个系统"对接"的接口，全部写在这。** 框先定死，细节后补；对齐接口，两个人背对背干活也不乱。
> 铁规矩：**歧义不能留在接口里**——这里每一条都要精确。
>
> ⚠️ **接口名 = 语义名**：用来对齐理解、表达"谁给谁什么"，**不指定 TypeScript 文件 / 类 / 签名**；真实签名留到签字写码时再定。

---

## 一、接口契约（模块之间怎么连接）

> 每行一条接口：**名字** + 谁调谁 + **它干吗（人话）** + 精确细节去哪看。这里只当**索引**，详细在对应系统卡。

| 接口名 | 谁 → 谁 | 作用（人话） | 详细 |
|---|---|---|---|
| 这格能走吗 | 移动 → 地图 | 人物往前走之前，先问地图一句"前面是不是墙"；地图答能走 / 不能走 | [SYS-MOVE](../03-执行层/02-玩法线/02-移动与碰撞.md) |
| `applyChunk` / `removeChunk` | 分块 → 世界 | 地图切成 25 块，搬来一块就"放上地图"，走远就"撤掉"（像只摆眼前这几块布景） | [SYS-WORLD](../03-执行层/01-地图线/02-世界与地图.md) |
| `createWorld` / `destroyWorld` | 世界 → 所有人 | 进游戏搭起整个"舞台"（地图 + 图层），退游戏 / 切场景时拆掉 | [SYS-WORLD](../03-执行层/01-地图线/02-世界与地图.md) |
| 归一化 | 输入 → 移动/玩家 | 键盘 / WASD / 摇杆三种按法，统一翻译成"往哪个方向走"，移动组不用管用的是哪种 | [SYS-INPUT](../03-执行层/02-玩法线/01-输入.md) |
| 玩家位置快照 / `startFollow` | 玩家 → 相机 / 分块 | 玩家只读世界坐标供镜头硬跟随和玩家 3×3 分块目标计算；不把可变 Sprite/Body 所有权交出去 | [SYS-PLAYER](../03-执行层/02-玩法线/03-玩家.md)、[SYS-CAMERA](../03-执行层/02-玩法线/04-相机.md) |
| 玩法控制门 / lease | Main provider ← 相机 / SYS-INTERACT | acquire返回成功token或失败reason；调用方只释放自己的opaque token；首token立即停速/reset，末token释放后恢复；Main在消费者shutdown后再shutdown provider并保持scene禁用 | [SYS-PLAYER](../03-执行层/02-玩法线/03-玩家.md)、[SYS-CAMERA](../03-执行层/02-玩法线/04-相机.md)、[SYS-INTERACT](../03-执行层/03-内容线/02-世界交互(弹窗).md) |
| 动态深度 | 玩家 → 图层 | 决定谁挡谁：人走到灌木后面就该被挡住，按位置排前后 | [SYS-PLAYER](../03-执行层/02-玩法线/03-玩家.md) |
| 相机视口目标更新 / `loadChunksForCamera` | 相机 → 分块 | 航拍和正常跟随都只提交相机视口；分块统一计算“玩家 3×3 ∪ 相机可见 +1”，相机不直接操作 cache/Tilemap | [SYS-CHUNK](../03-执行层/01-地图线/04-地图分块.md) |
| 地图运行时收敛 | Main → 分块 / 世界 | Main 可等待请求和 mutation idle；shutdown 按控制/相机→请求→mutation→collider/layer/Tilemap 收敛 | [SYS-WORLD](../03-执行层/01-地图线/02-世界与地图.md)、[SYS-CHUNK](../03-执行层/01-地图线/04-地图分块.md) |
| 资源加载 | 资源 → 各系统 | 进货：图片 / 地图走 Phaser Loader，切块数据走 HttpClient，两条补给线 | [SYS-ASSET](../03-执行层/01-地图线/01-资源加载.md) |
| 玩家位置 → 区域判定 | 玩家 → SYS-ZONE | 以当前Sprite世界坐标和camera scroll/zoom计算；100ms检查、视口外扩100px、严格`<30px`；有界接线已在`8ae7692b`验证 | [SYS-ZONE](../03-执行层/03-内容线/01-区域触发.md) |
| 区域驻留事件 | SYS-ZONE → SYS-INTERACT | 只在 outside↔inside 边沿输出 `markerId/menuId/residenceId/enter|leave`；重复100ms检查不重复发 enter，DOM、控制和手动关闭不归 Zone | [SYS-ZONE](../03-执行层/03-内容线/01-区域触发.md)、[SYS-INTERACT](../03-执行层/03-内容线/02-世界交互(弹窗).md) |
| 内容访问收据 | SYS-INTERACT → SYS-ZONE | UI 确认 `shown/already-visible` 后回传 marker/residence/menu，Zone 再记 visited；失败不产生虚假访问 | [SYS-INTERACT](../03-执行层/03-内容线/02-世界交互(弹窗).md) |
| 内容解析 | Main ContentResolver → SYS-INTERACT | 同步按menuId返回evidence-backed payload或missing/invalid；不联网、不retry，Interact/UI不猜正文 | [SYS-INTERACT](../03-执行层/03-内容线/02-世界交互(弹窗).md)、[内容层](../04-内容层/作品集内容.md) |
| 游戏UI呈现端口 | SYS-INTERACT ↔ SYS-GAME-UI | Interact 调用带`menuId+residenceId`的原子`show/hide/destroy`；UI只原样回报identity和close-button/backdrop动作；programmatic hide不发user-close，stale close被Interact忽略 | [SYS-INTERACT](../03-执行层/03-内容线/02-世界交互(弹窗).md)、[SYS-GAME-UI](../03-执行层/04-独立件/02-游戏UI.md) |

### 并行实施接口状态（`DEC-MAP-GAMEPLAY-PARALLEL-DESIGN-001`）

| 接口 | 契约状态 | 工程状态 | 当前边界 |
|---|---|---|---|
| 玩家位置快照 | Frozen | Bounded Integrated + Verified（`f2fe106`） | `PhaserPlayerRuntime.position` 返回冻结坐标，不转移 Sprite/Body 所有权；chunk target 已消费 |
| 玩法控制门 | Frozen | Bounded Integrated + Verified（`f2fe106`） | disable/blur/shutdown 停速并 reset 键盘/摇杆；SYS-CAMERA 只能调用门，不能直接管理设备 |
| 相机视口目标更新 | Frozen | Bounded Integrated + Verified（`cd3691a`） | 单一 pending viewport 由既有500ms循环消费；目标公式、请求/cache/Tilemap仍唯一归 SYS-CHUNK/WORLD |
| 地图运行时收敛 | Frozen | Bounded Integrated + Verified（`f2fe106`） | 复用现有请求取消、mutation idle 与 `destroyAsync`，不新建第二套生命周期 |

> Frozen 表示语义边界已接受；`f2fe106` 只验证第一波有界接口，不表示完整 M1/P1 系统或 SYS-CAMERA 已完成。

### 内容基础接口状态（`DEC-CONTENT-FOUNDATION-DESIGN-001`）

| 接口 | 契约状态 | 工程状态 | 当前边界 |
|---|---|---|---|
| 区域驻留事件 | Frozen | Bounded Integrated + Verified（`8ae7692b`） | Zone每次驻留唯一`residenceId`，只发enter/leave边沿；100ms、viewport+100和`<30`已测试/浏览器验证 |
| 内容访问收据 | Frozen | Bounded Integrated + Verified（`8ae7692b`） | 仅UI show成功后记visited；失败无虚假访问；about/re-enter真实Smoke PASS |
| 内容解析 | Frozen | Bounded Integrated + Verified（`8ae7692b`） | Main同步resolver；仅11项已核对标题/名称，不联网、不补长文/图片/Slovak |
| 游戏UI呈现端口 | Frozen | Bounded Integrated + Verified（`8ae7692b`） | identity=`menuId+residenceId`；原子replace；standard无backdrop、memo有；desktop/mobile真实DOM PASS |
| 玩法控制 lease | Frozen | Bounded Integrated + Verified（`8ae7692b`） | modal和camera共用provider；首token禁用、末token恢复；消费者后provider shutdown |
| 通用 Entity 生命周期 | No Contract | Verified No-Code | `Q-ENTITY-001`保持open；`8ae7692b`审计无shared runtime/registry/entity paths |

> 本节只证明内容基础有界CORE和当前Main integration，不晋升完整系统；完整内容、accessibility和Entity消费者仍按系统卡保持UNKNOWN。

## 二、数据字典（常量 / 公式，不是接口）

> 这些是"一个值 / 一个公式"，没有"谁调谁"，不是接口；但它们是接口里的精确参数。**冲突时以 `../03-执行层/` 对应系统卡为准。**

| 项 | 值 | 备注 |
|---|---|---|
| 地图分块 | 5×5 块，每块 28×28 格；块编号 `index = y*5 + x`；文件名 `chunk-{index}.json` | ✅ 已定死 |
| 世界尺寸 | 140×140 格 × 16px = 2240×2240 px | ✅ 已确认 |
| chunk 尺寸 | 28×28 格 | ✅ 已确认（"32"是旧学习导图实测，以工程区 28 为准） |
| chunk 可见范围 | 玩家 3×3 邻域 ∪ 相机范围 +1 | ✅ 已确认 |
| 图层 | 24 层（layer1-10 + walls + cars + 4 roof + 4 bridge + 3 particles + footsteps） | ✅ 已确认（特殊 13 层卸载语义见 SYS-WORLD UNKNOWN） |
| 移动速度 | 单轴 150 / 对角 106 | ✅ 已定死 |
| 玩家动态深度 | 原站事实：`500 + y*0.1`；当前重构决定：`500 + (y + 24)*0.1`（桥上 1650 等为显式覆盖） | ✅ 已定死（重构实现以 SYS-LAYER 卡和 `DEC-SYS-LAYER-CORE-001` 为准；两者不能混写） |
| 内容 menuId | `about/cv/projects/contact/tech/memo1..memo6` | ✅ 11个 Zone 内容 ID；big-map/under-hood 不在当前接口 |
| 内容弹窗策略 | single-active；standard backdrop=`none`，memo backdrop=`global` | ✅ 重构 DECISION；原站多 visible 技术可能不作为产品合同 |

## 三、待定接口（还没定死）

| 接口名 | 谁 → 谁 | 待定什么 | 状态 |
|---|---|---|---|
| roof / bridge 区域判定 | 图层 → 区域触发 | roof 区域判定来源、bridge 状态来源（"玩家是否进入区域"的判定） | 【TBD】归 SYS-ZONE（本轮内容 marker 调查未覆盖） |

---

## 冻结规矩

说"行"之后不能默默改；要改，就**一起改这张表**，改完两边同步代码和文档，别留旧规矩坑人。
