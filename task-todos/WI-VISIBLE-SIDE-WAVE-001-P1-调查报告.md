---
work-item: WI-VISIBLE-SIDE-WAVE-001
phase: P1
report-type: public-evidence-recon
status: candidate-ready-for-p2-review
scope: 只调查公开证据；不授权实现、不修改共享入口
---

# WI-VISIBLE-SIDE-WAVE-001 P1 调查报告

## 0. 结论先行

本轮从公开镜像中选出三条可以进入 P2 评审的最小可见候选：

1. **真实 NPC：`npc-sprayer` 组**——四个公开锚点、等待动画、接近触发、300 ms 组间逃跑、逐点移动和销毁链均可直接追踪。
2. **可见路线：`crowdTrain` 的火车进/离场**——资源和世界坐标明确，进场 5 s、停留 3 s、离场 9 s，并且有移动碰撞带和显式清理；比 `cars` 的随机地图路线更适合首屏/短路径验收。
3. **FX：factory smoke generator**——初始视口附近有真实的白烟粒子发射器，资源、锚点、曲线高度、发射频率和视口启停均可直接追踪。

以上是 **P2 候选设计**，不是已接受的项目决定，也不是实现授权。原 Bundle 中 `startGame()` 会直接调用火车入场，但当前工作项仍要求 Main 负责 Loading/Play 和短相机入口；P2 不得直接恢复原站长相机序列或把 `startGame()` 当作共享入口合同。

## 1. 证据边界与来源

本报告只使用以下公开证据，不读取私有资源，不猜测 source map 或原始源码结构：

| 编号 | 证据 | 用途 |
|---|---|---|
| E-01 | `sample/original-public-build/manifest.json` | 公开镜像文件、URL、哈希和采集状态 |
| E-02 | `sample/original-public-build/mirror/chunk-WMFY56ZM.js` | 资源加载和运行时行为；该文件按 manifest 哈希核对 |
| E-03 | `sample/original-public-build/mirror/assets/maps/final_map.json` | 地图层名称、公开图层计数和 GID 分布 |
| E-04 | `sample/original-public-build/mirror/assets/maps/chunks/master.json` 及 `chunks/*.json` | 28×28 分块布局和分块内 tile 数据 |
| E-05 | `sample/original-public-build/mirror/assets/maps/particle-trajectories.json` | 已公开的粒子区域数据；用于排除“把静态 raw tile 当动态消费者” |
| E-06 | `sample/analysis/module-mapping.md`、`resource-mapping.md`、`runtime-findings.md` | 已有分析索引；仅作导航，直接结论回到 E-01—E-05 |

Bundle 是压缩/打包后的公开实现证据。以下 `offset` 是该 Bundle 内的字节偏移，不代表原始源码文件、类名或模块边界。

关键公开 Bundle 位置：

- 资源加载：`chunk-WMFY56ZM.js` offsets `338148`（`particle_smoke_white`）、`343975`（`train`）、`345077`（`npc-sprayer`/`npc-sprayer-running`）。
- `npc-sprayer` 类及销毁：offsets `235299`—`238197`；四个配置及路线：offsets `547694`—`549760`；视口创建/回收：offsets `550646`—`551142`。
- 原站入口调用：`startGame()` 的 `crowdTrain()` 调用在 offset `415453`；火车创建、进场、乘客、离场和碰撞清理在 offsets `444082`—`447169`。
- factory smoke 初始化/更新：初始化调用在约 `412804`，烟雾生成器在约 `467302`，视口启停/路径更新在约 `407314`、`471175`。

## 2. 候选 A：真实 NPC——`npc-sprayer`

### 2.1 FACT：资源与公开配置

- E-02 预加载 `npc-sprayer`：`/assets/sprites/special/npc-sprayer.webp`，`64×64`，帧 `0..15`。
- E-02 预加载 `npc-sprayer-running`：`/assets/sprites/special/npc-sprayer-running.webp`，`48×48`，帧 `0..63`。
- `createNPCSpecials()` 注册四个同类配置：`(60,25)`、`(67,25)`、`(71,25)`、`(78,25)`，`depth:500`、`scale:.9`、`frameRate:6`。
- 四个实例分别带有公开 `escapeRoute`。其中 `(60,25)` 的路线为 `(60,25)→(60,26)→(0,26)`；`(67,25)` 的路线继续经过 `(56,26)`、`(55,27)`、`(55,35)`，再向地图下方和左侧延伸；其余两条配置也在同一公开配置块中。
- 创建前会检查是否在相机范围；运行时 `checkNPCSpecialVisibility()` 按约 300 px 外扩范围创建或回收；缺少 `spriteKey` 纹理时直接跳过创建，创建异常会记录错误。

### 2.2 FACT：创建、更新、触发和销毁

- `npc-sprayer` 使用独立的 Sprite 子类；公开类字段包含 `fleeState`、`escapeRoute`、`fleeSpeed`、`fleeTween` 和 `sprayDelayTimer`。
- 创建后加入静态 `activeSprayers` 集合，随机等待 `0..3000 ms` 后播放喷洒动画。
- 每次更新只有在 `fleeState === "idle"`、有路线、`isPlayerIntroComplete`、玩家有效时才检查触发：玩家与 NPC 的纵向 tile 差为 `0..2`，横向距离不超过 `2` tile 即触发组逃跑。
- 首个符合条件的 NPC 立即开始逃跑，其余 idle NPC 按距离排序，每个相隔 `300 ms` 触发；路线按 tile 点转换为世界坐标，公开默认速度为 `140`。
- 进入逃跑状态后 `checkViewport()` 不再把它当作普通静态特殊 NPC 回收，因此路线中途离开视口不会按普通回收路径销毁。
- `destroy()` 会从 `activeSprayers` 移除，并销毁 `fleeTween`、`sprayDelayTimer`，最后销毁 Sprite。路线 tween 完成后也会进入销毁路径。
- 未观察到该特殊 NPC 注册物理碰撞体；其可见行为是动画和 tween 路线，不应把“接近触发”误写成原站已证明的实体碰撞合同。

### 2.3 FACT / INFERRED：地图与分块关系

- **FACT：**四个锚点和逃跑路线直接写在 Bundle 配置中，不来自 `final_map.json` 的对象层，也不来自 `particle-trajectories.json`。
- **FACT：**按公开 28×28 分块空间计算，四个锚点的空间位置落在 chunk `(2,0)`；这只是空间归属计算，不证明 NPC 由该 chunk 拥有。
- **FACT：**创建/回收依据是相机可见性和 NPC 自身状态；没有看到 `npc-sprayer` 读取某个地图图层或向 chunk registry 登记。
- **INFERRED：**P2 应把它视为“场景特殊行为所有者”，由旁支适配器按世界锚点管理，而不是把其配置伪装成地图 tile 数据。

### 2.4 FACT / INFERRED / DECISION 候选 / UNKNOWN

- **FACT：**这是一个真实公开资源和公开运行链完整的特殊 NPC 候选，不是由静态 tile 推测出的角色。
- **INFERRED：**以当前玩家初始位置约 tile `(68,19)` 估算，NPC 行 `(60..78,25)` 与初始视口有机会同时可见；实际当前运行时相机范围仍须 P2 浏览器验收。
- **DECISION 候选：**P2 以 `npc-sprayer` 组做可见纵切片，最小代码可只保留一个实例，但为了验证真实组行为建议保留公开的四个锚点和 `300 ms` 级联；不抽取通用 NPC 基类，不复制原 Bundle 的静态集合设计作为共享合同。
- **UNKNOWN：**当前新入口是否在何时置 `isPlayerIntroComplete`；静态 `fleeTriggered` 是否跨场景重置；随机喷洒延迟是否属于必须复现的视觉合同；场景销毁时延迟回调和静态集合是否一定被完整清空；长路线经过未加载 chunk 时是否仍应继续。

### 2.5 最小可见验收

P2 在不依赖长相机序列的前提下应能观察到：

1. 进入短入口后，`(60..78,25)` 至少一个喷洒 NPC 在视口内出现并保持喷洒动画。
2. 玩家沿约 6 tile 的短移动到 row 25 附近，横向距离 ≤2 tile、纵向差 `0..2` 时触发。
3. 触发后最近者先跑，其余者以约 `300 ms` 间隔开始；至少一个 NPC 沿公开路线离开，并最终销毁。
4. 回到同一视口时不出现重复实例、不增长的计时器或残留 tween。

若 P2 无法在短路径内展示这四点，应停止该候选，而不是降低触发条件或改用未证实的路线。

## 3. 候选 B：可见路线——`crowdTrain` 火车进/离场

### 3.1 FACT：资源与路线行为

- E-02 预加载 `train`：`/assets/sprites/train.webp`。
- 公开 `crowdTrain()` 先销毁已有 `trainSprite`，再创建世界坐标 `(2480,310)` 的火车，原点 `(0,.5)`，缩放表达式为 `1/3*.75*4.1`，深度 `1001`。
- 火车以 `Cubic.easeOut` 从 `x=2480` 移到 `x=480`，持续 `5000 ms`；完成后将 `isPlayerIntroComplete` 设为真、启用玩家控制、显示摇杆，并在 `3000 ms` 后调用 `departTrain()`。
- `departTrain()` 将目标设为当前 `x-4000`，以 `Quad.easeIn` 持续 `9000 ms`；更新过程中持续更新碰撞带，火车离开相机左侧 200 px 后恢复 `loop-crowd`。
- `updateTrainCollision()` 创建或移动静态矩形碰撞体，覆盖火车横向范围和 tile row 20 附近，并向 CrowdManager 写入 train blocking zone；`cleanupTrainCollision()` 销毁 collider、矩形和 debug tile，并清空 blocking zone。
- 离场完成后销毁 `trainSprite`。乘客由 `spawnTrainPassengers()` 注册 `crowd-train`：起点为 `(63..84,19)`，终点列表为 `(68,121)`、`(8,100)`、`(36,117)`、`(129,108)`、`(106,46)`、`(21,86)`，`npcCount:10`、`movementSpeed:35`、`mode:"oneWay"`、`deleteAfterComplete:true`、`beforeDelay:2400`。

### 3.2 FACT：入口、地图/分块和所有权

- **FACT：**公开原站 `startGame()` 在创建玩家后调用 `crowdTrain()`，同时还做相机移动。这证明原站确实把火车用于入口序列，但不授权当前项目直接恢复该入口实现。
- **FACT：**火车路线本身没有读取 `final_map.json` 的 `cars` 图层，也没有在公开代码中按 chunk 创建；其起止位置和碰撞 row 直接写在运行时逻辑中。`y=310` 约为 tile row 19.4，碰撞计算固定使用 row 20 附近。
- **FACT：**火车相关场景所有者是 `trainSprite`、`trainCollisionRect`、`trainCollider`、`trainDebugTiles` 和 CrowdManager 的 `crowd-train`/blocking zone；公开代码没有把它们放进统一 Entity registry。
- **INFERRED：**这是一个“全局世界坐标的短路线对象”，不能因为它穿过多个空间 chunk 就把火车拆成多个 chunk-owned 实体；P2 应在相机/世界已就绪后显式启动和停止。

### 3.3 FACT / INFERRED / DECISION 候选 / UNKNOWN

- **FACT：**火车具有确定的 `5 s` 进场、`3 s` 停留触发、`9 s` 离场和销毁链，具备比随机车辆流更容易重复验收的可见行为。
- **INFERRED：**它是本轮最合适的“短路线”候选：不需要猜测道路 tile 的连通性，也不需要等待随机车流选中某条路线。
- **DECISION 候选：**P2 以独立的 `startTrainRoute()`/等价旁支适配器承接该行为；由 Main 在已冻结的短入口之后显式触发，不能直接调用原站 `startGame()`，不能接入 111 s 相机序列，不能修改共享入口文件来绕过 Gate。乘客 crowd 可作为同一候选的第二阶段，第一阶段先验收火车本体、碰撞带和 teardown。
- **UNKNOWN：**当前产品是否要把火车作为入口动画还是 Play 后的旁支事件；当前相机缩放和初始世界视口下火车的完整可见时刻；P2 当前 CrowdManager 是否已提供 `registerCrowd`、pause/resume 和 blocking zone 合同；中途切场景/取消 tween 时原站是否完整清理；train 资源缺失时 Phaser 版本的实际显示和错误行为。

### 3.4 最小可见验收

在 Main 提供的明确旁支触发后：

1. `0..5 s` 内火车从视口右侧向 `(480,310)` 移动，位置连续且碰撞阻挡带随移动更新。
2. 到达后玩家控制/旁支状态按已接受入口合同切换；约 `3 s` 后开始离场。
3. `9 s` 离场结束后，火车 Sprite、碰撞体、debug tile、CrowdManager blocking zone 均不存在；若启用乘客，`crowd-train` 也必须按 `deleteAfterComplete` 或显式取消清理。
4. 触发两次不会同时存在两个火车、两个碰撞体或两个 blocking zone。

P2 若只能通过恢复原站长相机或改写共享入口才能让火车出现，必须停止并回到 Main/Human Gate，不得扩大本工作项范围。

## 4. 候选 C：FX——factory smoke generator

### 4.1 FACT：资源、创建与参数

- E-02 预加载 `particle_smoke_white`：`/assets/sprites/smoke-white.webp`。
- 初始化流程约在 1 s 延迟后调用粒子创建；factory smoke generator 的公开配置锚点为 `x=50.5*16`、`y=33.7*16`，即约 `(808,539.2)` 世界像素。
- 配置包含 `width:7`、`widthEnd:32`、`pathHeight:35`、`quantity:2`、`frequency:80`、白色、`scaleStart:1.6`、`alphaStart:.1`、`maxAlpha:.25`、`scaleEnd:4`、`lifespan:2000`、`depth:500`；`reactCars:false`、`reactPlayer:false`。
- 生成器选择 `particle_smoke_white` 纹理，创建 Phaser Particle Emitter，并将生成器数据保存到 `smokeGenerators`；其路径图形/路径数据也由场景侧保存和更新。

### 4.2 FACT：更新、视口关系、地图/分块和销毁

- `updateSmokePaths()` 按约 `50 ms` 更新路径；在相机可见范围外停止发射并隐藏相关对象，在可见范围内恢复发射/显示，并按曲线更新粒子位置。
- **FACT：**该选定 factory smoke 使用硬编码世界锚点，不来自 `particle-trajectories.json` 的区域记录，不来自地图对象层。
- **FACT：**按 28×28 分块空间计算，锚点约落在 chunk `(1,1)`；这只是空间位置，公开代码没有证明 `smokeGenerators` 由该 chunk 拥有或随 chunk unload 销毁。
- **FACT：**公开 Bundle 对一般 `particleData` 有单独的相机可见性销毁/重建路径；factory smoke 使用的是 `smokeGenerators` 的启停/隐藏路径，不能把两者的 teardown 证据混为一谈。
- **UNKNOWN：**factory smoke 是否在场景 shutdown/destroy 时显式销毁 emitter、路径图形和更新定时器；公开搜索没有找到该候选的统一销毁入口。`createSmokeGenerator` 本身也没有看到与一般粒子创建相同的明确 try/catch 失败边界。

### 4.3 FACT / INFERRED / DECISION 候选 / UNKNOWN

- **FACT：**这是资源可核验、参数可复现、初始世界坐标明确的真实粒子效果，不是由静态 tile 或文件名推测出的 FX。
- **INFERRED：**以公开玩家起点/短入口的世界范围估算 `(808,539.2)` 很可能落在首屏下方区域；当前新运行时的实际相机和缩放仍需 P2 浏览器确认。
- **DECISION 候选：**P2 先实现一个 factory smoke emitter，保留公开锚点和时序，使用 FX 自己的 owner 明确持有 emitter、path data、visibility timer 和 teardown；不接入 cars/player 反应，不把它包装成通用粒子系统。
- **UNKNOWN：**当前正式 runtime 是否已经纳入 `smoke-white.webp`；当前渲染器/设备下的透明度和粒子密度；离开再返回视口时 emitter 是复用还是重建；当前项目是否已有可调用的场景 teardown hook。

### 4.4 最小可见验收

1. 进入短入口后约 `1 s`，在约 `(808,539.2)` 处能看到烟雾上升、放大、淡出；至少连续观察 `2 s`。
2. 相机离开该锚点超过公开可见边界后，发射停止/对象隐藏；返回后恢复，且不产生重复 emitter。
3. 销毁旁支或场景后，emitter、路径数据、可见性 timer 和更新监听均无残留；重复进入不会线性增加粒子或 timer。
4. 若资源不存在或创建失败，P2 必须有可诊断的失败结果，不得静默把另一种烟雾或 raw tile 当作替代。

## 5. 未选备选与为什么不在本轮冻结

### 5.1 `cars` 地图路线（未选为本轮短路线）

- **FACT：**E-03 有名为 `cars` 的地图图层，公开解析计数为 `623`；Bundle 对道路/起止标记 GID（包含 `69345..69352`、`69350`、`69351`）有路径搜索、车辆生成和逐帧更新逻辑。E-04 是 `28×28` 分块布局，`master.json` 声明 `5×5` 分块。
- **FACT：**公开 Bundle 会从 `cars` layer 的 marker pair 构建路线，并以 `car1` 等公开 sprite 创建车辆；车辆按路径点、速度、刹车/转向状态更新，离屏后可能回收/补充。
- **INFERRED：**它确实是可实现的真实路线候选，也比静态道路 tile 更有证据；但首屏出现受已加载分块、随机 route/start point、idle 调度和车流数量影响，短验收不如火车确定。
- **UNKNOWN：**当前 runtime 在正式短入口时会加载哪些 marker 所在 chunk；公开随机车流是否能稳定在首屏展示；route endpoint 跨 chunk 时的生命周期；P2 是否已有可用的车辆所有权和碰撞合同。
- **DECISION 候选：**本轮不以 `cars` 作为最小可见路线；待火车或 Main 入口验收后再单独开工作项。不得只凭 `cars` layer 的 raw tile 计数宣称路线已实现。

### 5.2 `protesters_rising` / `particles3`（未选为 NPC/FX）

- **FACT：**公开 Bundle 存在 `protesters_rising` 的动态消费者和 `particles3` 相关粒子/区域数据。
- **UNKNOWN：**其与地图/分块、实际运行触发点及首屏可见范围的完整直接关系仍未收敛；不能仅凭区域 JSON 或图层 raw tile 选作本轮最小候选。
- **DECISION 候选：**保留为后续调查，不替换已经有完整创建—更新—销毁链的 `npc-sprayer` 或 factory smoke。

## 6. 所有权、失败与销毁总账

| 候选 | 创建 owner | 更新 owner | 失败边界 | 已证实销毁 | P2 必补 |
|---|---|---|---|---|---|
| `npc-sprayer` | scene 的 `npcSpecials` + NPC 自身 | Sprite `preUpdate`、scene 视口检查 | 纹理缺失时视口创建跳过；构造异常记录错误 | route tween 完成或视口回收；NPC 清理 tween/timer/set | scene teardown、静态状态复位、重复进入幂等 |
| `crowdTrain` | scene 的 `trainSprite` + `crowdManager` 乘客 | scene tween、`updateTrainCollision`、CrowdManager zone | `trainSprite` 缺失时 update/depart 有 no-op 保护；其余资源/manager失败未闭合 | 离场完成清理 collider/rect/debug/zone 并销毁 Sprite；乘客声明 delete-after-complete | 中断 tween、切场景、重复触发、资源缺失诊断 |
| factory smoke | scene 的 `smokeGenerators` / particle emitter | `updateSmokePaths`、可见性更新 | 资源存在于公开镜像；创建失败捕获边界不完整 | 公开证据只证明启停/隐藏，不足以证明场景销毁 | emitter/path/timer/listener 的显式 teardown、重复创建幂等 |

**当前结论：**未发现一个已经被两个独立场景证明稳定的共享生命周期抽象。P2 不得因为三者都“有 Sprite/粒子”就提前提取通用 Entity 或通用旁支基类。

## 7. P2 允许文件与禁止范围

只有在 P2 的 Main/视觉 Gate 已接受并建立 clean Git 基线后，允许修改以下新增或旁支专属范围；本报告本身不授权现在修改：

- `src/npc/**`：仅 `npc-sprayer` 候选的专属配置、状态和视口适配。
- `src/route/**`：仅火车短路线及其碰撞/取消清理适配。
- `src/fx/**`：仅 factory smoke 的 emitter、视口和 teardown 适配。
- `tests/npc/**`、`tests/route/**`、`tests/fx/**`：对应纯逻辑、生命周期和行为测试。
- 如现有正式 runtime 约定需要旁支专属入口胶水，只能新增明确命名的 `src/**` 旁支适配文件，并在 P2 预览中列出；不得修改共享 `main`、Loading/Play、相机合同或现有 Phaser 主场景来绕过 Gate。
- 资源只可通过已经批准的正式资源接入流程使用；不得修改、重命名、重组或刷新 `sample/original-public-build/**`，不得猜测下载 URL。

本 P1 禁止修改：`src/`、`tests/`、`sample/`、任何 `03-执行层/` 系统卡、`task_plan.md`、共享入口、包配置和现有 Phaser 主场景。

## 8. P2 测试与浏览器验证要求

### 8.1 纯逻辑/生命周期测试

- NPC：触发窗口边界（横向 2 tile、纵向 0/2 tile）、300 ms 级联顺序、路线完成销毁、重复创建幂等、取消 tween/timer 后无残留。
- Route：5 s 进场、3 s 延迟、9 s 离场的状态转移；碰撞带随 x 更新；离场/取消/重复触发后 Sprite、collider、blocking zone 数量均为 0/1 的预期值。
- FX：公开参数和锚点换算；视口内启动、视口外停止、返回恢复；场景 teardown 后 emitter、timer、listener 均为 0；资源失败有明确结果。
- 所有异步测试必须有有限 timeout、fake clock 或等价可控时间，测试结束显式清理 tween、timer、listener 和 scene；不得用无限等待证明“应该可见”。

### 8.2 浏览器首屏/短路径验收

- 从当前正式 Loading/Play 入口进入，不跳过入口，不启动原站 111 s 相机序列。
- 记录浏览器、viewport、渲染器（Canvas/WebGL）、触发时刻和截图/录像；至少验证一次桌面路径，若 P2 声称移动端也支持则另行验证。
- 在同一运行中依次验证：factory smoke 出现；sprayer 静止喷洒并在接近后逃跑；火车短路线进场、停留、离场并清理。
- 检查 console 无新增未处理异常，重复进入/退出不出现对象、粒子、timer、collision 或 listener 单调增长。
- 只有在上述行为证据和对应测试都通过后，才能把候选状态从“P2 待评审”改为“实现已验证”；文档、代码、测试和 Git 收据必须同步回写到正式权威位置。

## 9. P2 依赖、风险与停止条件

### 依赖

1. Main 先冻结短入口、相机边界和可调用的旁支触发时机；旁支不能自行接管共享入口。
2. 正式资源流程确认 `npc-sprayer`、`npc-sprayer-running`、`train`、`smoke-white` 在目标 runtime 可用；镜像证据不等于正式 runtime 已接入。
3. P2 确认 CrowdManager 是否纳入当前实现；若不纳入，第一阶段不得假装已实现乘客或 train blocking zone，需缩小为火车本体并明确差距。
4. P2 需要可控的 scene teardown 和浏览器行为验证入口；没有 teardown 证据不得报告完成。

### 风险

- 原站 `npc-sprayer` 使用静态 `fleeTriggered`/`activeSprayers`，直接照搬可能导致重复进入后不再触发或跨场景泄漏。
- 原站火车 tween 未以本报告可见的独立字段保存；中断、切场景和重复触发需要 P2 自己建立可取消 owner。
- factory smoke 的公开证据强调视口启停而非完整销毁；若不补 teardown，粒子和定时器会成为首要泄漏风险。
- `cars` 路线虽然证据充分，但其分块加载和随机车流会使首屏验收不稳定；不得把它作为火车候选的隐式替代。
- 公开 Bundle 的时序和类结构是可观察实现细节，不得据此声称恢复了原始源码结构。

### 必须停止的条件

- 缺少公开资源或正式资源 owner 未确认：停止，不猜路径、不换未证实资源。
- 只能通过修改共享入口、恢复长相机序列或扩大当前工作项才能显示候选：停止，回到 Main/Human Gate。
- 首屏/短路径无法重复观察到候选的创建、更新和销毁：停止，不降低验收标准。
- 任一 teardown、重复触发或有限超时测试失败：停止，不报告“已完成”。
- 发现新的共享抽象需求但没有第二个独立真实场景：停止抽象，先记录复用观察并申请确认。

## 10. P1 交付状态

- **已调查：**公开资源、创建、更新、地图/分块关系、所有权、失败边界和销毁证据；候选为 `npc-sprayer`、`crowdTrain`、factory smoke。
- **已形成：**P2 候选设计、首屏/短路径验收、允许文件、测试、依赖、风险和停止条件。
- **未做：**没有修改代码、`sample/`、系统卡、`task_plan.md` 或共享入口；没有进行 P2 实现；没有宣称 Human 接受或行为已验证。
- **待确认：**Main 短入口触发合同、正式资源接入、CrowdManager 现状、三候选在当前 runtime 的浏览器可见性和 teardown 结果。
