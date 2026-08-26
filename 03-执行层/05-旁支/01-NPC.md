---
tags: [虚拟校园, 执行层, 系统卡]
system: SYS-NPC
status: designed
audit-status: deferred-after-b1-automated-verification
work-item: WI-SYS-NPC-SPECIAL-001
updated: 2026-08-25
---

# NPC 与环境实体（SYS-NPC）

## 👀 先看这里（人话总结，给 Human）

**当前结论候选**：SYS-NPC不是一个统一运行时，而是多类独立owner组成的家族：路线/事件群众、区域静态群众、venue人群、固定special、sprayer、encounter、ghost和moving-sprite。不同owner的激活、动作、视口、回收和失败路径有实质差异，不能再用一套“NPC出现/移动/消失”模型统一修补。

**当前状态**：Human已接受[Phase A机制与覆盖报告](../../task-todos/WI-SYS-NPC-SPECIAL-001-Phase-A审计报告.md)中的owner家族、六状态、RC-NPC-1..6与`B0→B5`顺序；[B0证据收口](../../task-todos/WI-SYS-NPC-SPECIAL-001-B0证据收口.md)已完成。B1候选`b6a4e6c`虽通过自动门禁，但Human决定NPC留到最后再修，状态为human-deferred-not-accepted；第三轮candidate仍为human-visual-rejected。

**当前硬边界**：整个SYS-NPC专项已按`DEC-SYS-NPC-DEFER-001`延期；B1不合并、不视觉签字，B2-B5不授权，其他板块不得夹带NPC修改。rat、ghost、birds正常产品入口，铁路合法性、完整shutdown和resource-only对象身份仍是UNKNOWN；恢复专项时从这些未解决项继续，不建立通用NPC/Entity框架。

## 新增Human视觉证据（2026-08-25，未授权修复）

Human在同一编译production路径新增观察：Stop AI附近NPC会闪烁/闪现；部分NPC行走到某处消失，固定位置又突然冒出；同时直升机和警车没有贴图。这些是有效的视觉失败证据，但不等于取消NPC延期或授权修改。

- **资源链缺口（已定位）**：公开镜像存在`npc-helicopter.webp`、两个rotor、high-resolution及`car-police.webp`等文件，公开Bundle也有preload和创建配置；当前`prepare-runtime-assets.mjs`/`check-runtime-assets.mjs`的白名单没有它们，`CampusScene`也没有moving-sprite/vehicle owner或对应preload/创建链。因此不是单个图片URL失败，而是资源→preload→owner→附属部件整链缺失。
- **Stop AI闪烁（尚未完全定位）**：公开`protesters_rising-87`区域与Stop AI相邻/重叠；当前`PhaserVenueCrowdRuntime.ts`每次`sync`最多新建16个sprite（约128–143），而Stop AI fog深度1100高于当前NPC约`500+y*.1`的呈现深度，烟雾遮挡和分帧物化都可能造成闪烁。必须用逐帧owner ID、sprite create/destroy、depth和fog可见性区分，不能先把观察定性为单一NPC逻辑Bug。
- **行走后消失/固定点冒出（route高可信）**：`src/npc/routeCrowd.ts:557-593`在非`goBack`且非`deleteAfterComplete`完成时直接把NPC重置到`start`并将alpha置0；`PhaserRouteCrowdRuntime.ts:254-286`按materialized/destroyed清理sprite。公开Bundle是`fadeOut→hidden→reset/fadeIn`，当前直接重置会制造突兀消失和固定点重新出现；static/venue仍不能套用此结论。

**处理决定**：以上只进入统一跨系统差异表；NPC继续`human-deferred-not-accepted`，不在SYS-FX修复中夹带代码。若恢复，先由Human重新接受NPC方案，再按route、static/venue、资源owner分别固定路径和修复。

## 1. 逆向结论（从 sample 读出来的事实）

- **FACT**：公开前端至少存在以下不同owner：
  1. `CrowdManager`路线与事件人群：11组常规route、`crowd-train`、bug、hazmat；
  2. `particle-trajectories.json`区域owner：`crowd=25`、`crowd_up=21`、`concert=3`、`protesters_rising=1`；
  3. fixed special：reading、eating、cat licking；
  4. sprayer×4、dancing×8、rat attack×40、ghost默认5、birds 5随机+1固定waypoint；
  5. 只有资源而没有完整创建链/入口证据的scientist、monk、dog、DJ、helicopter等UNKNOWN对象。
- **FACT**：资源存在、创建链存在、正常入口可达、当前实现、自动验证和Human视觉通过是六种不同状态，不能互相替代。
- **FACT**：route按路径/事件运行；static与venue按整个region边界激活；sprayer和fixed special有专属触发；ghost、rat、birds不是普通CrowdManager配置。
- **FACT（B0）**：正常入口的火车链为`startGame→crowdTrain→5秒到站→3秒等待→departTrain→spawnTrainPassengers`；乘客目标10，实际实例受成功路径数约束；离站暂停`loop-crowd`，离开阈值或完成后恢复。
- **FACT（B0）**：公开route使用`walls-layer` 0/1 grid、inline Blob Worker和seeded 8向A*；动态火车占格会让NPC等待，但没有发现静态铁路禁站mask。
- **FACT（B0）**：rat的40只/玩家距离触发/8向BFS，ghost的5只/dark+区域+viewport激活/flashlight，birds的5随机+1 waypoint及视口保存重建均有直接创建与类内机制证据。
- **FACT**：公开随机位置、人物选择、朝向和路径顺序不是稳定精确坐标FACT；配置人数也不保证每次成功布点人数。
- **INFERRED**：Human看到的单列、弹出/消失、动作单调等现象，主要与owner生命周期粒度、呈现状态机和自动probe偏斜有关；具体每个视觉症状仍需按owner固定路径重放。
- **UNKNOWN**：rat、ghost和birds正常产品入口仍依赖未关闭的六点相机序列触发；铁路禁站原站数据流、所有owner完整scene teardown、sprayer跨chunk路线和resource-only对象身份未解决。

主证据：`sample/original-public-build/mirror/chunk-WMFY56ZM.js`、`sample/original-public-build/mirror/assets/maps/particle-trajectories.json`、`sample/original-public-build/mirror/assets/maps/walls-layer.json`。完整定位与矩阵见[Phase A审计报告](../../task-todos/WI-SYS-NPC-SPECIAL-001-Phase-A审计报告.md)。

## 2. 数据与约定

- **FACT**：`particle-trajectories.json`共有88个region；无名region只保留ID与polygon/bbox，不补造地点名。
- **FACT**：路线配置分别声明start/end tiles、sprite pool、速度/变化、delay、one-way/loop/goBack/wander、最大活跃数和偏移；不能把所有路线压成单一数组。
- **FACT**：静态/venue布点在polygon内随机采样并有最小间距；region存活期间身份与位置应稳定。
- **DECISION候选**：每个owner合同至少记录`config/resource → activate/count → identity/randomness → path/action → lifecycle → interfaces → cleanup/failure → verification`八项。
- **DECISION候选**：owner状态台账固定分开记录六状态；自动测试只证明测试内容，Human视觉另记。
- **DECISION候选**：失败candidate固定为integration worktree clean HEAD `ea87512`，在新实施包接受前只读保留。

## 3. 怎么做

> Human已接受以下分批顺序；B0已完成，B1有界实现已授权，B2-B5仍未授权。

1. **B0 证据与合同收口（完成）**：train正常入口和route worker已关闭；rat/ghost/birds owner内部机制已关闭；产品入口、铁路策略和完整teardown残余UNKNOWN已登记。
2. **B1 static + venue（自动验证完成，Human视觉待验）**：恢复`crowd/crowd_up`的region生命周期、稳定身份、方向池和每秒2–4人公开选择机制，以及concert/protest逐NPC动作；双视口production门禁已PASS。
3. **B2 route + train + bug/hazmat**：冻结每组配置、候选路径、delay/goBack/wander、火车暂停恢复及呈现策略。
4. **B3 sprayer + fixed special + dancing + rat**：保持专属owner；rat仅在B0证据足够后进入。
5. **B4 ghost + birds**：只在正常入口和生命周期证据成立后实现。
6. **B5 联合关闭**：完整正常路径、慢镜头边界、shutdown、性能和Human整体验收。

每批先固定owner expected、失败/差异证据和允许文件，再做有界实现；Main负责共享入口、权威状态和最终集成。不得按截图中每个NPC建立零散补丁。

## 4. 失败怎么办

- 资源或配置缺失：返回可定位owner/config/key失败，不替换为猜测资源。
- 路径失败：记录owner、config、起终点和失败原因；配置人数与成功路径人数分别记，不伪造NPC补数。
- region失败：已创建presentation必须按owner对称回收；部分写入不能登记成功。
- trigger/入口UNKNOWN：停止对应实现，保留UNKNOWN，不把测试hook或延迟构造接入production。
- shutdown：每个owner清sprite、timer、tween、listener、path/region状态；重复shutdown幂等；最终收据必须覆盖route、bug、venue、dancing等当前缺口。
- Human视觉失败：回到同一RC-NPC差异表和owner根因包，不重开症状式工作项，也不以更多测试数量代签。

## 5. 接口

- 入←Main：world ready、playable/control gate、viewport/worldView、player position/facing、train departure/leave/complete、walls/path grid、scene shutdown。
- 入←资源/地图：公开sprite/animation、`particle-trajectories.json`、`walls-layer.json`、owner配置。
- 出→Main：owner ready/failure、logical/materialized/visible count、trigger/complete/destroy receipt、shutdown receipt和必要的Human probe状态。
- owner不得直接管理chunk cache、相机、玩家输入或其他owner；train事件只通过冻结事件接口连接route crowd。
- `SYS-ENTITY`继续NO-GO：route/path、region、special、encounter、moving-sprite尚未显示稳定共同生命周期合同。

## 6. 怎样算做对

每批至少同时满足：

1. 配置与资源契约测试；
2. owner核心状态/路径/动作测试；
3. Phaser presentation与资源失败测试；
4. 对应正常production区域/事件probe，而非仅test hook或对象计数；
5. 慢相机边界和静止相机身份稳定验证；
6. owner shutdown后sprite/timer/tween/listener归零收据；
7. 该批owner级Human视觉通过。

B5还需重放完整入口→地图→NPC区域→火车事件→scene shutdown路径，运行受影响全量回归和性能检查，再由Human整体视觉验收。任何自动PASS都不能单独把完整SYS-NPC晋升为`implemented/verified`。

## 7. 代码位置

- **当前根基线**：根`master`尚无`src/npc/`、`tests/npc/`或NPC production probe。
- **失败candidate（只读对照）**：`.pi/worktrees/visible-product-integration`，clean HEAD `ea87512`。
- candidate core：`src/npc/sprayer.ts`、`routeCrowd.ts`、`gridPathProvider.ts`、`staticCrowd.ts`、`staticNpc.ts`、`venueCrowd.ts`、`venueCrowdRuntime.ts`、`bugCrowd.ts`、`dancingCrowd.ts`。
- candidate presentation：`game/PhaserSprayerRuntime.ts`、`PhaserRouteCrowdRuntime.ts`、`PhaserStaticCrowdRuntime.ts`、`PhaserStaticNpcRuntime.ts`、`PhaserVenueCrowdRuntime.ts`、`PhaserBugCrowdRuntime.ts`、`PhaserDancingCrowdRuntime.ts`及`game/CampusScene.ts`。
- candidate tests/probe：`tests/npc/**`、`scripts/browser-route-crowd-production.mjs`。
- Phase A过程与差异主表：[SYS-NPC Phase A审计报告](../../task-todos/WI-SYS-NPC-SPECIAL-001-Phase-A审计报告.md)。
- B0证据结果：[B0证据与合同收口](../../task-todos/WI-SYS-NPC-SPECIAL-001-B0证据收口.md)。
- 下一候选实施包：[B1静态与Venue实施包](../../task-todos/WI-SYS-NPC-SPECIAL-001-B1静态与Venue实施包.md)。

复用观察：多个真实owner已有不同机制，但当前根基线没有两个已集成且Human通过的owner显示稳定共同合同；不提取通用NPC/Entity框架。`GridRouteCrowdPathProvider`仅是candidate中被多个route配置消费的有界能力，是否进入根基线须后续集成Gate。
