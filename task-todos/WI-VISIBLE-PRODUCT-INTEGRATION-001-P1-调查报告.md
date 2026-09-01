---
work-item: WI-VISIBLE-PRODUCT-INTEGRATION-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: main-integration
phase: P1-parallel-recon
baseline-commit: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
baseline-tree: c825bb6a99f363e30a665d58d4a2eadf7b18f537
evidence-boundary: sample/original-public-build + sample/analysis only
status: report-ready-for-p2-human-visual-gate
updated: 2026-08-22
---

# P1：Main 产品入口调查设计报告

> 本报告只做公开证据调查和 P2 候选，不冻结视觉参数、不授权代码实现，也不关闭 `Q-CAMERA-ENTRY-001`。所有“原站事实”均指镜像 Bundle/HTML/CSS 或已有运行时收据直接证明的内容。

## 0. 结论先行

1. **FACT：页面先初始化 Phaser，Loading 不是点击 Play 后才开始。** `ngOnInit` 调用 `initGame()`；`initGame()` 动态导入 `GameScene`，创建 Phaser Game；Scene `preload()` 再通过 `progressCallback` 回报加载进度。
2. **FACT：Play 是独立的用户门。** `onPlayButtonClick()` 设置 `gameStarted`、删除 `.play-box`，然后直接调用 `gameScene.startGame()`；公开运行收据只确认 `ready → play`，没有相机调用栈。
3. **FACT：公开 Bundle 的 Play 后短过渡是秒级。** `startGame()` 将相机以 `Power2` tween 移到玩家出生点，源码时长为 `3000ms`；完成后恢复 `startFollow(player, true, 1, 1)`、`zoom=1`、`deadzone=0`。
4. **FACT：公开 Bundle 的控制交接晚于相机落点。** 玩家创建时 `setUseControls(false)`；`crowdTrain()` 的 `5000ms` train tween 完成后才设置 `isPlayerIntroComplete=true`、放行控制并显示摇杆。相机 3 秒和控制约 5 秒不是同一个状态边界。
5. **UNKNOWN：六点约 111 秒序列的产品语义和真实入口触发。** `GameScene.create()` 中确有 `startCameraSequence()` 调用，Play 又会在 `startGame()` 中取消该序列；静态调用和一次网络收据不足以证明它是正常产品入口的一部分。本报告任何正常入口候选都不使用该序列。

## 1. 证据登记

| 证据 | 定位 | 结论标记 | 直接支持的事实 |
|---|---|---|---|
| 原站 HTML | `sample/original-public-build/mirror/index.html:259-330` | FACT | `#init-load` 白色 Loading 层、进度 GIF/进度条、`.play-box` 与 Play 按钮、`480×270` canvas（CSS 初始为 `1920×1080`）同时存在于页面壳中 |
| 原站脚本加载顺序 | `index.html:1617-1622` | FACT | Phaser 先在 `app-root` 后加载；随后加载两个 module chunk、polyfills 和主 Angular Bundle |
| Angular 初始化 | `main-RV3Z53H4.js` byte `114171` | FACT | `ngOnInit()` 调 `initGame()`，并在固定 `1000ms` 后移除 `#init-load` |
| Phaser 创建 | `main-RV3Z53H4.js` byte `117903-119476` | FACT | 动态导入 `chunk-WMFY56ZM.js` / `chunk-VANY4YOC.js`，构造 `GameScene`，创建 `Phaser.Game`，Scene 作为 config 的 `scene` 和 `parent` |
| Scene 预加载 | `chunk-WMFY56ZM.js` byte `335434-337513` | FACT | 加载地图、tileset、碰撞、粒子、摇杆、玩家/NPC 等资源；`fileerror`/`loaderror` 只写错误日志；`load.on("progress")` 回调进度 |
| Scene 创建与 Play 显示 | `chunk-WMFY56ZM.js` byte `352954-370221`、`417360-417970` | FACT | `create()` 建立地图/相机并在 master 成功回调中调用 `startCameraSequence()`；`createGridOverlay()` 在创建后隐藏进度、分批清理网格并显示 `.play-box` |
| Play 点击 | `main-RV3Z53H4.js` byte `119476-120007` | FACT | `onPlayButtonClick()` 设置 `gameStarted=true`、移除 `.play-box`、调用 `gameScene.startGame()`；随后初始化地图 marker 和延迟显示菜单项 |
| Play 后相机 | `chunk-WMFY56ZM.js` byte `415178-416600` | FACT | `startGame()` 取消序列 tween，创建玩家，执行 `3000ms` `Power2` 相机 tween；完成后恢复硬跟随及相机参数 |
| 控制交接 | `chunk-WMFY56ZM.js` byte `375876`、`443900-445400` | FACT | 创建玩家时控制关闭；train `5000ms` tween 完成后放行控制、显示摇杆和桌面键盘提示 |
| 首次文字引导 | `chunk-WMFY56ZM.js` byte `416842-416950` | FACT | 相机 tween 完成后设置 `firstContactText`，再延迟 `11000ms` 调用 `showFirstContactText()` |
| 运行时收据 | `sample/analysis/runtime-network.json:9-24,3196-3197` | FACT | 一次 `1920×1080` 采集记录 `navigation/ready/play`，ready 时 `playVisible=true`、`canvas=true`；console 与 exception 数组为空，但没有相机状态/调用栈/逐秒 DOM 时间线 |
| 空间运行收据 | `sample/analysis/layer-visual-evidence/observations.json:22-38,851-1098`；`04-roof-before.png` | FACT（probe-assisted） | 出生点 `(1088,304)`、相机在出生场景的收据和一张包含玩家世界、NPC、顶部内容导航、底部地图/UI 的画面；该证据不证明自然入口耗时 |
| 不可用资源 | `sample/original-public-build/network/unavailable.json:1-25` | FACT | `exterior.png`、`card5_foil.webp`、`cables3.png` 曾返回 404；不能把“无 console 异常”当作完整失败恢复已证明 |

## 2. 页面 → Loading → Play → Phaser Scene 真实链

### 2.1 已证明的链

```text
HTML 壳
  ├─ #init-load：固定白色 Loading，先于 Angular 完成
  ├─ progress-percentage：GIF + 进度条 + 百分比
  ├─ play-box：logo + Play，初始在 canvas 上方
  └─ game-container：Phaser canvas + DOM UI
       ↓
Angular ngOnInit
  ├─ initGame()
  │    ├─ 动态导入 GameScene / rexVirtualJoystick chunk
  │    ├─ new GameScene(nativeScale, progressCallback, ...)
  │    └─ new Phaser.Game({ scene: gameScene, parent: gameContainer })
  └─ 1000ms 后移除 #init-load（固定计时，不等于 Scene ready）
       ↓
GameScene.preload()
  ├─ 加载地图、外观、碰撞、粒子、摇杆、玩家、NPC 等
  ├─ progressCallback → Angular loadProgress
  └─ fileerror/loaderror → console.error（原站证据未发现用户 Retry UI）
       ↓
GameScene.create()
  ├─ master 数据成功后创建 Tilemap、图层、边界、zoom/roundPixels
  ├─ 静态 Bundle 直接调用 startCameraSequence() —— 方法调用 FACT，产品语义 UNKNOWN
  ├─ loadInitialChunk()
  └─ createGridOverlay()：隐藏进度、揭示场景、使 Play 可见
       ↓
用户点击 Play
  └─ onPlayButtonClick()
       ├─ gameStarted = true
       ├─ 删除 .play-box
       └─ gameScene.startGame()
            ├─ 取消相机序列和相关 tween
            ├─ createPlayer()，出生点 (1088,304)，初始不可控/可淡入
            ├─ 相机 3000ms Power2 到玩家中心
            ├─ 完成后恢复硬跟随
            ├─ train 5000ms 完成后放行控制
            └─ 相机完成后另延迟 11000ms 显示首次文字引导
```

### 2.2 Loading 状态不能合并

- **FACT**：`#init-load` 的移除只由 `ngOnInit` 后的 `1000ms` 计时器控制。
- **FACT**：Phaser 进度由 Scene loader 回调驱动；`gameLoaded` 在主 Bundle 收到 `100%` 后再延迟约 `1000ms` 标记。
- **FACT**：Scene 自己还用网格揭示控制进度隐藏与 Play 显示；源码中进度隐藏约在创建后 `500ms`，Play 显示约在创建后 `1100ms`，实际墙钟时间取决于 Scene 创建完成和浏览器调度。
- **INFERRED**：P2 应至少分开 `page-init`、`asset-loading`、`scene-ready`、`entry-transition`、`playable` 五态；`loadProgress=100` 不能单独当作“可玩”。
- **UNKNOWN**：当前镜像未给出正式用户错误页、Retry 入口、加载失败后重建 Scene 的完整状态图；04 独立件 P1 仍需补证。

## 3. 正常入口的秒级相机、最终构图和控制交接

### 3.1 公开 Bundle 直接证明的短入口

**FACT：** Play 事件直接进入 `startGame()`。`startGame()` 先将 `isCameraSequencePlaying=false`、杀掉相机 tween，然后从当前相机位置 tween 到玩家出生点中心：

- 起点：Scene 创建时先把相机放到 `cameraSequence[0]` 的中心坐标 `(944,928)`；这只是公开方法当前的初始相机锚点，不把它解释为正常产品采用了 111 秒序列。
- 终点：玩家出生点 `(1088,304)` 减去相机视口半宽/半高。
- 动画：`3000ms`、`Power2`。
- 完成后：`startFollow(player,true,1,1)`、`setFollowOffset(0,0)`、`setZoom(1)`、`setDeadzone(0,0)`。

因此，**可作为 P2 证据基线的最终构图是“玩家居中、无缩放、无死区、硬跟随”**。这不是对 P2 视觉参数的冻结；Human 仍需在视觉 Gate 决定是否保留该时长、是否允许首屏引导的短暂构图变化。

### 3.2 控制交接边界

| 阶段 | 公开行为 | 本报告判断 |
|---|---|---|
| Loading / Scene ready | 玩家尚未由 `startGame()` 创建或尚未启用控制 | FACT：必须锁输入 |
| 相机 3 秒过渡 | 玩家创建、相机向出生点移动；玩家可能仍不可见/淡入 | FACT：不应把移动输入交给玩家 |
| train intro | `crowdTrain()` 运行 `5000ms`，玩家控制保持关闭 | FACT：控制门仍关闭 |
| intro complete | train 完成后设置 `isPlayerIntroComplete=true`、`setUseControls(true)`、显示摇杆 | FACT：公开 Bundle 的控制放行点 |
| 可玩 | 相机硬跟随、玩家可动；首次文字引导另延迟 `11000ms` | FACT + DECISION候选：引导不应阻塞控制，除非 P2 明确批准 control lease |

**INFERRED：** 原站把“镜头落点”和“可以操作”故意分开，避免玩家在镜头尚未稳定时移动；但公开收据没有逐帧记录 `Play click → camera complete → control enabled`，时间关系仍需新浏览器 Smoke 复核。

### 3.3 六点约 111 秒序列的硬边界

- **FACT：** `cameraSequence` 包含 6 个点，总飞行/停留约 `111s`；`startCameraSequence()` 会停跟随、隐藏摇杆、预载相机范围并创建灯光/动态对象；点间推进为 `Linear` tween。
- **FACT：** `GameScene.create()` 的公开 Bundle 代码中存在 `this.startCameraSequence()`；`startGame()` 又明确将 `isCameraSequencePlaying=false` 并终止相机 tween。
- **UNKNOWN：** 这组代码在真实产品中的用户可见触发、Play 前/Play 后归属、是否只是等待 Play 时的展示能力，当前运行收据没有记录。
- **DECISION候选（硬排除）：** P2 正常入口不接 `startCameraSequence()`，不等待约 111 秒，不将其作为 loading、short entrance 或 final composition。若未来要呈现该能力，必须新立显式体验入口并先过 Human Gate。

## 4. 首屏空间事实与引导约束

### 4.1 已有空间锚点

| 锚点 | 坐标/证据 | 含义 |
|---|---|---|
| 玩家出生 | `(1088,304)`；Bundle marker/玩家代码、`observations.json` | 正常 Play 的最终玩家中心候选 |
| 初始相机点 | `(944,928)`；Bundle `cameraSequence[0]` | `startGame()` 的公开相机过渡起点；不等于正常入口序列授权 |
| About marker | `(944,768)`；Bundle `markers` byte `334450` 附近 | 首个内容引导可引用的公开内容目标候选 |
| Projects marker | `(1264,1264)`；同上 | 三类内容验收中的公开目标之一 |
| Memo marker | `memo1=(1760,1280)` 等；同上 | Memo 类内容的公开目标候选 |
| 出生场景画面 | `04-roof-before.png` | 可见 NPC、顶部内容导航、底部地图/UI 与世界构图的真实空间参考 |

- **INFERRED：** 在 `1920×1080` 采集的初始 `480×270` logical canvas 中，出生点与 About marker 的纵向差为 `464px`，不能保证同一普通首屏同时完整显示玩家和 About marker。因此“首个内容引导”更稳妥的候选是 HUD/箭头/文字提示或一段受控短路径，而不是凭空把 marker 放进出生画面。
- **UNKNOWN：** 03 内容线尚未在 Main worktree 提交 P1 报告；About→Projects→Memo 的真人可发现路径、引导是否允许高亮 marker、以及 `/sk/` 内容映射不能由本报告补猜。

### 4.2 NPC / FX 首屏关系

- **FACT：** `startCameraSequence()` 内有延迟创建 NPC、粒子、移动精灵、工厂动画、灯光、风机、云和鸟的调用；这证明公开 Bundle 存在分层动态能力，不证明它们在正常 Play 首帧的可见集合。
- **FACT（probe-assisted）：** `observations.json` 记录出生场景/其他坐标存在 `particleEmitterCount=15`、`areaParticleEmitterCount=29`、`depth450PoolCount` 和 NPC/人群状态；截图 `04-roof-before.png`、`11-particles3.png` 证明真实场景可同时呈现世界、NPC、FX 和内容导航/文字。
- **UNKNOWN：** 05 旁支 P1 尚未向 Main 提交确定的“一个 NPC + 一段路线 + 一个 FX”首屏纵切片；Main 不能自行挑选资源或把全局加载资源当作首屏消费者。
- **DECISION候选：** Main 只冻结“首屏槽位/遮挡和进入时机”，由 05 旁支提供真实对象；不得在 Main 入口中创建第二套 NPC/Route/FX 生命周期，也不得用粒子 tileset/raw marker 冒充动态 FX。

## 5. P2 可比较的秒级入口 / 最终构图候选

> 三个候选都**排除约 111 秒序列**。表内时长、偏移、延迟和可见强度均为 P2 视觉比较参数，不是当前冻结值；只有“公开 Bundle 已有 3000ms / 5000ms”等被标为 FACT 的数字可作为证据基线。

| 候选 | Loading / Play | 秒级入口与最终构图 | 首个内容引导 | NPC / FX 首屏关系 | 取舍与风险 |
|---|---|---|---|---|---|
| **A 玩家中心·证据兼容** | 保留“白色 init → 进度 → Scene ready → Play”分层；Play 只在 Scene ready 后可见。 | 以公开 `3000ms Power2` 回玩家为比较基线；最终采用玩家中心、`zoom=1`、无 offset/deadzone、硬跟随的事实构图；具体时长由 P2 视觉 Gate 决定。 | 在相机落点/控制放行后显示一个非阻塞的 About 方向提示、speech bubble 或 HUD 高亮；不自动打开 modal，不传送玩家。 | 仅让一个真实 NPC、路线或 FX 占据玩家周边的背景/边缘安全区；密集人群不得盖住玩家和提示。 | **优点：** 最接近公开 `startGame()`，控制和相机职责清楚。**风险：** About 不在出生首屏，提示样式和真人路径要等 03 报告；5 秒 train 交接是否保留需视觉复核。 |
| **B 内容路标·双锚点** | Loading 完成后先显示 Play 和一个“探索第一个内容点”的非阻塞提示；不以空白 canvas 代替加载。 | Play 后做一段短、可取消的镜头 settle，使玩家仍可辨认，同时让公开 About 路线/标记成为视觉锚点；之后恢复玩家中心硬跟随。具体 offset、持续时间和是否二次 settle 不冻结。 | 首个目标明确指向公开 `About`，用户点击/移动后才能进入内容；保持 `residenceId/menuId` 交给内容线，不自动猜 payload。 | NPC/FX 先放在引导视线的外围，避免动态对象与内容提示抢焦点；05 线只提交一个真实首屏对象。 | **优点：** 最快让 Human 看见“可发现内容”。**风险：** 偏离原站无 offset/deadzone 的常态构图；窄屏可能无法同时容纳玩家、路标和 NPC/FX；需要 03/05 证据，Main 不得自行实现。 |
| **C 世界先醒·立即可玩** | 保留最小 Loading/Play 门，但不增加额外强制观赏段；Scene ready 后尽快进入可玩态。 | 采用玩家中心硬跟随或极短 fade/settle；不移动镜头去找 marker，把稳定构图和控制响应优先级置于戏剧性之上。具体“立即”阈值不冻结。 | 首次输入后显示一条非阻塞的“从地图/HUD 找 About、Projects、Memo”提示，或沿用公开 first-contact 文本风格；不自动弹窗。 | 让一个真实 NPC/路线/FX 在首屏形成“世界活着”的证据，但必须避开玩家、文本和控制 UI；若 05 线无法证明首屏对象，候选降级为 UNKNOWN。 | **优点：** 控制交接最清楚、手机风险最低。**风险：** 内容发现弱，可能复现“有地图但没有产品变化”的问题；与公开 train intro 的控制时序差距最大。 |

**P2 当前建议（DECISION候选，未接受）：** 先用 A 作为最小证据兼容基线，与 B 做首屏可发现性对照；C 作为低锁定/移动端 fallback。Human 视觉 Gate 应一次比较三种实际录屏/截图后再决定，不由本报告冻结。

## 6. P2 接口、状态和文件所有权候选

### 6.1 共享状态边界

```text
Main-owned entry state
  page-init → asset-loading → scene-ready → entry-transition → playable → error
                                      │                 │
                                      │                 └─ control gate: locked → open
                                      └─ Play gate: hidden/disabled → visible/enabled

Content / NPC / FX are downstream consumers of the final playable viewport;
Main does not own their private marker, entity, route or particle lifecycle.
```

- **Main owns / P2 must freeze:** 页面状态机的共享接线、Play gate、entry transition、control gate、最终相机构图、`CampusScene` 与 Phaser Scene 的交接。
- **Loading boundary:** `asset-loading` 只能报告真实 progress/失败；`scene-ready` 还必须包含 Scene 创建、必要 master/world ready 和 Play 显示条件；不能用固定 `1000ms` 代替 ready。
- **Control boundary:** loading 和 entry transition 期间强制 locked；何时从 locked 变 open 由 A/B/C 的 Human 视觉选择和真实玩家适配器能力共同确定；不得把相机 `onComplete` 或 111 秒序列自动当作控制授权。
- **Content boundary:** 首个引导只发公开证据支持的目标/身份；Zone/Interact/Game UI 继续拥有 marker residence、payload、modal、manual close 和 visit receipt。引导失败不得伪造 visited 或成功打开。
- **NPC/FX boundary:** Main 只提供 final viewport/可见时机/遮挡验收；NPC、Route、FX 各自拥有创建、更新、失败和销毁。没有第二个真实消费者前不创建 Entity registry。

### 6.2 P2 文件所有权

| 所有者 | 可候选修改 | 明确禁止 |
|---|---|---|
| **Main integration** | `game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`、共享 browser Smoke、integration merge；另冻结共享 contract 与 Main-owned resolver/lease 的版本 | 其他 worktree 直接改这些文件；Main 之外自行 merge/push；把未接受候选写入系统卡/总账 |
| **04 independent** | P2 通过后候选 `src/app/**`、扩展 `src/game-ui/**`、对应测试/新适配器 | 修改 Main 共享入口；把 Retry、Escape/focus 或图片失败的猜测写成原站 FACT |
| **03 content** | P2 通过后候选 `src/content/**`、必要的 `src/zone/**` / `src/interact/**`、对应测试和公开内容派生资源 | 修改 Main 共享入口；猜未公开文案、图片、语言或传送路径；单方面改 shared contract |
| **05 side** | P2 通过后候选 `src/npc/**`、`src/route/**`、`src/fx/**`、必要 Phaser 适配器和对应测试 | 修改 Main 共享入口、地图核心；创建通用 Entity registry；用 no-code/placeholder 冒充可见对象 |
| **既有地图/玩法 CORE** | 本报告只读消费玩家位置、相机 viewport、chunk/world 生命周期和既有 content contract | 本 P1 不改 `src/`、`game/`、`sample/`、API、系统卡或 `task_plan.md` |

## 7. P2 可见验收候选

### 自动/浏览器验收

1. 冷启动先看到真实 Loading，不出现空白 canvas；progress、Play 和 canvas 的状态有可观察边界。
2. Play 只接受一次；Play 层消失后不重复创建 Scene、不重复注册 listener、不重复请求入口资源。
3. 正常 production 入口在 Human 选定的秒级窗口内完成相机 settle；**不得播放或等待约 111 秒序列**。
4. 终态截图同时证明：玩家可辨认、选定的构图稳定、控制 UI 不遮挡玩家、地图/菜单层级正确；桌面至少 `1920×1080`，移动端至少 `375×667`。
5. Loading/transition 期间键盘、摇杆和内容打开均被锁；control gate 打开后，键盘和触摸输入能工作且释放恢复；不以 debug/test hook 代替生产行为。
6. 首个引导必须指向仓库已有公开证据支持的 About/Projects/Memo 之一；用户能沿真实路径打开实际内容，不能用自动传送、虚构正文或空 modal 通过。
7. 由 05 线提供的至少一个真实 NPC、路线行为和 FX 在选定首屏/短路径内可见；其失败/销毁不留下异常、重复对象或遮挡入口。
8. 缺少必要资源、Scene rejected、Play 后入口失败时显示受控错误/Retry 候选并清理旧 Scene；当前原站没有完整 Retry 事实，P2 前不能把此项冒充已实现。
9. 窗口 resize、移动端方向切换、modal 打开/关闭和 Scene shutdown 后无多余 timer/listener/控制锁/晚到 DOM 更新。

### Human 视觉 Gate

- 对 A/B/C 使用同一干净基线、同一桌面/移动端尺寸，分别录制 Loading→Play→最终构图的短视频和截图。
- Human 明确接受：Loading 是否可信、入口是否秒级、最终玩家/世界构图、首个内容提示强度、NPC/FX 是否抢焦点、控制何时交接。
- Human 未接受前：不写正式入口功能、不把候选写入系统卡、不关闭 `Q-CAMERA-ENTRY-001`，也不进入 P8。

## 8. 风险、未知和停止条件

### 风险 / UNKNOWN

- `create()` 内的 `startCameraSequence()` 与 `Play → startGame()` 的先后竞态没有被现有网络收据逐秒记录；不能从代码存在推断产品意图。
- `init-load`、Angular `gameLoaded`、Scene progress/grid reveal 各自有计时器；低速设备、资源失败和 Scene rejected 时可能出现互相覆盖，04 需补失败状态证据。
- 公开资源收据有 3 个 404，但一次运行仍无 console/exception；哪些请求是可选旧引用、哪些应阻断 loading 未确认。
- `nativeScale`、不同 viewport 下的相机可见范围、移动端真实首屏构图和 FX 性能未在本任务证实。
- 已有空间截图由 probe-assisted warp 得到，证明坐标处的行为，不证明自然步行路径耗时。
- 03/05 的 P1 报告尚未出现在 Main worktree；内容路线和首屏 NPC/Route/FX 目前只能做接口候选，不能做产品事实。

### 必须停止的条件

1. 发现任何候选需要把六点约 111 秒序列接到普通 Play/Loading/Scene 入口：立即停止并保留 UNKNOWN。
2. 发现首屏内容需要猜文案、资源、marker 坐标、自动传送或未证实的动态消费者：停止，退回 03 内容线补证。
3. 发现 NPC/路线/FX 只有资源文件名或 no-code 记录，没有创建/更新/销毁和可见证据：停止，退回 05 旁支换候选。
4. 发现 Loading/Retry 需要修改 Main 共享文件而 P2 所有权、失败合同或 Human 视觉目标尚未接受：停止，不写代码。
5. 发现相机候选会绕过 SYS-CHUNK 唯一 viewport/目标集合、玩家控制门或现有 lifecycle teardown：停止，不建立第二套状态。
6. Human 未完成 A/B/C 实际视觉比较前，不提交 P2 冻结参数、不关闭工作项、不推送或创建 PR。

## 9. 本轮状态与交接

- **已确认：** 页面壳、Loading 资源层、Phaser 初始化、Play 调用、公开 3 秒回玩家、最终硬跟随、公开控制放行函数和首次文字引导调用。
- **已形成候选：** A 玩家中心、B 内容路标、C 世界先醒；均为 `DECISION候选`，未冻结。
- **仍 UNKNOWN：** 六点序列的真实产品触发；完整 Retry/错误 UI；自然入口逐秒录屏；首个内容真实路径；05 线首屏 NPC/Route/FX；多设备最终构图。
- **交给 P2：** Main 按本报告和 03/04/05 三份报告冻结共享状态、文件所有权和一次性视觉目标；Human 视觉 Gate 后才授权实现。

## 证据安全收据

- 只读范围：`sample/original-public-build/mirror/`、`sample/original-public-build/network/`、`sample/analysis/`。
- 未请求外部公开站点、未修改 `sample/`、未修改代码或权威文档。
- 本报告不关闭未知队列，不把 Bundle 的公开实现细节宣称为原始源码结构。
