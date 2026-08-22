# WI-VISIBLE-INDEPENDENT-WAVE-001 / P1 独立调查报告

- **工作项**：`WI-VISIBLE-INDEPENDENT-WAVE-001`
- **调查板块**：A 应用启动与页面、B 游戏 UI、C 实体生命周期
- **调查阶段**：P1 只读公开证据调查
- **基线**：`8ae7692b`（调查前工作树 clean；本报告之外不应产生修改）
- **证据边界**：只读取仓库已有的公开镜像、采集收据、分析文件和当前玩家实现；没有重新请求公开站点，没有读取 source map、私有资源或旧项目，也没有修改 `src/`、`game/`、`sample/`、权威文档或 `task_plan.md`。
- **报告状态**：P1 证据已整理；不等于 P2 设计批准、实现授权、Human 接受或已验证完成。

## 0. 先给结论

1. **Loading → Play 的直接证据成立。** 原站先显示全屏 `#init-load`，随后由 Phaser loader 回传 `0..1` 文件队列进度；加载完成后有独立的网格揭示过渡，最后显示 Play 区域。Play 点击后移除 Play 区域并启动游戏入口。公开运行收据在 `1920×1080` 记录了 `ready`、`play` 和四个方向输入状态，`playVisible: true`、`canvas: true`、无运行时 exception。
2. **该百分比是真实 loader 队列比例，不是字节进度、时间进度或总下载进度。** 不能据此伪造“还剩多少秒”，也不能把后续动态 chunk、可选图片和世界分块下载折算进同一个百分比。
3. **公开证据没有面向用户的 Retry 状态。** Bundle 中的 `MAX_RETRY_COUNT` 是地图 marker 初始化的内部重试，不是 Loading/Play 失败页；`fileerror`/`loaderror` 目前只记录错误。失败状态、Retry 按钮、重复点击保护和重建边界必须作为 P2 候选设计，不能写成原站事实。
4. **正式 Game UI 的视觉骨架有证据：** DOM loading/play UI 与 Phaser canvas 同页，NES 像素风按钮/文字、modal-backdrop/modal、移动端方向提示、`100dvh` 和 mobile joystick 都已存在。**Escape、焦点陷阱、焦点返回和图片失败回退没有被证实；最终 CSS 还会取消默认 focus ring。**
5. **Entity 公共框架继续 NO-GO。** 当前重构只有玩家这一真实消费者；公开 Bundle 中的 NPC/车辆行为只能作为调查证据，不能替代当前项目第二个已实现消费者。玩家、NPC、车辆在附件、physics、路线、timer、可见性和清理责任上存在明显差异。
6. **P2 的安全边界：** 只可候选新增/修改 `src/app/**`、扩展 `src/game-ui/**`、对应测试以及经主线负责人另行授权的新适配器；不得修改 Main 共享入口、现有 Phaser 场景、公开镜像、权威协议或自行引入 `src/entity/**`。

### 0.1 结论标签

- **`FACT`**：由现有公开文件、固定哈希或既有运行收据直接证明；Bundle 事实仅代表公开行为，不代表原始源码结构。
- **`INFERRED`**：由多个 `FACT` 归纳出的工作状态或风险，例如把 `#init-load → loader → play-box` 命名为状态链、把定时移除 loading 层判断为失败可见性风险。
- **`DECISION`（候选，未接受）**：本报告给 P2 的状态机、失败分类、Retry、视觉验收和文件边界建议；未写入权威设计，也未获 Human 签字。
- **`UNKNOWN`**：现有证据不能回答的事项，例如用户 Retry、Escape/focus、404 的 required/optional 分类和第二个真实 Entity 消费者。

---

## 1. 证据账本

### 1.1 公开页面与运行证据

| 证据 | 定位 | 结论 | 标记 |
|---|---|---|---|
| `sample/original-public-build/mirror/index.html` | `:254-290` | `#init-load`、loading 进度 DOM、`.play-box`、Play 按钮和社交按钮位于同一页面入口 | `FACT` |
| 同上 | `:310-327` | Phaser `#game-container`、`#joystick-container`、modal backdrop 和 modal DOM 同页 | `FACT` |
| 同上 | `:1613-1623` | 移动端 landscape overlay、Phaser/game UI 脚本和根应用脚本的加载顺序 | `FACT` |
| `sample/analysis/runtime-network.json` | `:6-25`、`:3197` | 已有运行收据为 `1920×1080`；状态含 `navigation/ready/play/up/right/down/left`；`playVisible: true`、`canvas: true`；该次收据 `exceptions: []` | `FACT` |
| `sample/analysis/runtime-network.json` | `:25` | 收据合计 `responseCount: 404`；不能因为页面成功进入 Play 就把所有资源视为成功 | `FACT` |
| `sample/original-public-build/network/unavailable.json` | `:5-22` | `maps/exterior.png`、`images/cards/card5_foil.webp`、`images/ui/cables3.png` 有 404 记录 | `FACT` |

### 1.2 Bundle/CSS 证据与固定哈希

以下偏移是对应压缩文件的 **UTF-8 字节偏移**；压缩文件均为单行，因此不把 Bundle 偏移误称为原始源码行号。Bundle 公开实现细节只用于行为证据，不用于断言原始源码模块结构。

| 文件 | SHA-256 | 关键偏移 | 证据用途 |
|---|---|---|---|
| `sample/original-public-build/mirror/main-RV3Z53H4.js` | `3444bdf01a04328dc62aac9d10ebffc3da9764d5fd9c96686795239a5ea26b38` | `loadProgress@105984`、`removeInitLoad@113829`、`initGame@117768`、`onPlayButtonClick@119475`、`showModal@123372`、`hideModal@123923`、`updateModalState@124263` | Angular/页面状态、Play、modal、进度绑定和内部 marker retry | `FACT` |
| `sample/original-public-build/mirror/chunk-WMFY56ZM.js` | `c85817ab7f3422b1688333a26c4e84379cd8ffde9d2773e092859f134d7442cb` | `preload@335434`、`fileerror@337182`、`loaderror@337414`、`progress@337508`、玩家 `$e@12322`、NPC `qe@31045`、CrowdManager `st@169948`、`startGame@415178` | Phaser loader、游戏进入和玩家/NPC/车辆行为 | `FACT` |
| `sample/original-public-build/mirror/styles-DVTBSD34.css` | `3f63fc0b7b15b88fcdee05ba78427cc1c9bbf3d1edbaefe0a71bfe750a24dc13` | `.modal-backdrop@1719`、`.modal@1995`、`*:focus@79286`、`.progress-percentage-cover@80044`、`.progress-percentage@80225`、`100dvh@2294` | UI 层级、响应式、进度视觉、focus 结果 | `FACT` |
| `sample/original-public-build/mirror/index.html` | `65375062cbac80f1d1d09273a9db210a911176e172ae2dd322d0ea0ba0507855` | 页面文件整体 | 页面结构收据 | `FACT` |
| `sample/analysis/runtime-network.json` | `5daebab061e3e41d5d66a0de52fe44c4303563f6e0f36ffc44260b6c65be8d74` | 运行收据整体 | 行为收据固定版本 | `FACT` |
| `sample/original-public-build/network/unavailable.json` | `76cf5cd35cdae5a98d04d695096d7286db1f7d82f7fed4c848fe01a2e0e5e894` | 失败资源收据整体 | 404 收据固定版本 | `FACT` |

镜像来源和文件清单仍以 `sample/original-public-build/manifest.json:697-831,2651` 为准；本报告不改变清单或快照。

---

## 2. 页面状态机：Loading / Play / Retry

### 2.1 已观察到的状态链

```text
页面初始
  -> INIT_LOADING
  -> ASSET_LOADING
  -> READY / PLAY_VISIBLE
  -> ENTERING_GAME
  -> PLAYING
  -> MODAL_OPEN <-> PLAYING
```

上图是对已观察行为的命名整理，不是原站源码状态名；`ERROR` 和 `RETRYING` 是 P2 候选，不是原站已证实状态。

| 状态 | 公开行为 | 当前证据与边界 |
|---|---|---|
| `INIT_LOADING` | 页面 HTML 有全屏 `#init-load`，z-index 极高；Angular `ngOnInit` 调用 `initGame()`，随后 `removeInitLoad()` 清除它 | `index.html:254-290`、`main` `initGame@117768/removeInitLoad@113829`。`removeInitLoad` 延迟约 1 秒，**不是加载成功判定**；这是当前错误可见性的风险 |
| `ASSET_LOADING` | `loadProgress` 初始为 0；Phaser `preload()` 为 map、tile、角色、NPC、UI 等资源入队，loader `progress` 回调转为 `Math.floor(value * 100)`；DOM 更新 bar 宽度和文字 | `chunk` `preload@335434`、`progress@337508`、`main` `loadProgress@105984`。这是 Phaser 文件项比例，不是 bytes/time |
| `READY` | `gameLoaded` 在 loader 达到 100 后延迟约 1 秒变为 true；`createGridOverlay()` 先隐藏进度文本，再以网格揭示场景，最后把 `.play-box` 加上 `visible` | `chunk` `createGridOverlay` 调用约 `370226`、实现约 `417025`；进度隐藏和 Play 显示是独立视觉过渡。运行收据确认 `playVisible: true` |
| `ENTERING_GAME` | 点击 Play 后 `gameStarted=true`、Play 区域移除，调用 `startGame()`；菜单等 UI 分阶段出现 | `main` `onPlayButtonClick@119475`、`chunk` `startGame@415178`。Bundle 中的 camera/player 过渡不能直接作为本工作项的 111 秒入口结论 |
| `PLAYING` | Phaser canvas 可见，方向输入状态可推进；运行收据覆盖 `play/up/right/down/left` | `runtime-network.json:9-22`。收据只证明一次成功路径，不证明失败路径或长期运行 |
| `MODAL_OPEN` | `.modal-backdrop` 和对应 `.modal` 以 `visibility`/class 控制，modal 内部滚动；打开时隐藏部分游戏 UI/joystick 的逻辑存在 | `index.html:326-327,1337-1467`、`main` `showModal/hideModal/updateModalState`。Escape 行为未证实 |
| `RETRY` | 未发现用户 Retry 文案、按钮或统一加载失败状态 | `index.html` 无 Retry UI；`main` 中 `MAX_RETRY_COUNT` 只出现在 map marker 初始化内部逻辑约 `125074-127333`，不应冒充用户恢复能力 | `UNKNOWN` |

### 2.2 真实进度与可见进度的边界

**已确认：**

- 进度来源是 Phaser loader 的 `progress` 事件；当前公开实现将一个 `0..1` 值直接换算为整数百分比。
- 资源队列包括地图、tileset、角色/动画、NPC/车辆相关资源及其他图片；队列完成不等于所有后续动态 import、世界分块或可选 DOM 图片都完成。
- `createGridOverlay()` 的白色网格、延迟销毁和 Play 显示是视觉过渡，不应继续增加或回写百分比。
- 运行证据同时记录了 `404` 和 `exceptions: []`，说明“成功进入 Play”与“所有请求成功”是两个独立指标。

**P2 设计候选：**

1. `progressSource = phaser-file-queue` 时才显示百分比；保持 loader 回调提供的值，禁止按时间、请求数量猜测剩余比例。
2. 动态 chunk、可选图片和进入游戏后的世界资源使用独立的 `loading detail`/`degraded` 标记，不塞入初始百分比。
3. 在 `100%` 后进入显式 `READY`，网格/淡入动画只属于 `transition`，Play 只在状态守卫通过后可用。
4. 若 loader 失败，进度显示应停止在最后一个真实值或切换为“加载失败”，不得补到 100%。

### 2.3 失败与恢复事实

| 失败位置 | 证据 | 原站当前结果 | P2 候选处理 |
|---|---|---|---|
| Angular/Phaser 动态初始化失败 | `initGame()` 调用链中已定位片段没有统一用户错误分支 | `#init-load` 可能按定时器消失，用户可能只看到空页面/未完成画面 | `ERROR_BOOT`：保留可见错误容器、记录错误类别、提供显式 Retry；不自动刷新 |
| Phaser required asset `fileerror/loaderror` | `chunk@337182/337414` 有监听 | 目前主要是 `console.error`；没有统一 Retry | required 资源失败阻断 `READY`，Retry 前先 teardown 当前 generation |
| 可选 DOM 图片 | `unavailable.json:5-22` 有 3 个 404；HTML 没有图片 `onerror` 回退 | 具体视觉影响未在现有收据中确认 | 图片按 required/optional 分级；optional 使用稳定尺寸和可访问 fallback，不阻断游戏 |
| 地图 marker 初始化 | Bundle 内部 `MAX_RETRY_COUNT` 约 `125074-127333` | 有内部有限重试 | 保持为内部机制；不能复用为 Loading Retry，也不能让它重建整个 App |
| 进度停滞/重复 Play | 没有失败收据和明确幂等契约 | 行为未知 | Play/Retry 都使用 generation/idempotency guard；过期回调不能再次显示旧 UI |

**禁止推断：** 不能把一次成功运行中的 `404` 自动归类为“可忽略”；要根据资源是否阻断当前页面视觉或 Phaser loader 成功来决定 required/optional。若无法分类，保持 `UNKNOWN` 并停止扩展采集。

---

## 3. 正式 Game UI 与可见交互审计

### 3.1 已确认的视觉结构

| 区域 | 公开事实 | P2 可验证的可见目标 |
|---|---|---|
| Loading | 白色全屏层、居中的 GIF/品牌图、黑色进度条和百分比；CSS 有 `.progress-percentage-cover`/`.progress-percentage` | 初始加载不露出空 canvas；真实进度、失败信息和 Retry 的占位不跳动 |
| Play | `.play-box` 有 logo、介绍文本、NES 像素风 Play 按钮和 LinkedIn 按钮；Bundle 的网格揭示结束后显示 | loading → ready 的过渡独立于百分比；Play 只触发一次进入流程 |
| Canvas/game shell | `#game-container` 包含 Phaser canvas；当前运行收据证明 canvas 可见 | canvas 覆盖正确 viewport，DOM UI 层不被 canvas 截获；进入后键盘/触控拥有明确控制权 |
| Modal | backdrop 与 modal 分层；CSS 约 `z-index: 9998/9999`，modal 可滚动，内容区有 `max-height: 90dvh` 等响应式约束 | 打开时 backdrop 覆盖 canvas，关闭后恢复原来 UI/焦点；modal 内容不造成 body 横向滚动 |
| 像素按钮和 focus | NES 按钮/像素字体样式存在，但 CSS 在约 `79286` 的 `*:focus` 规则中移除 outline/box-shadow | P2 需显式设计可见 focus ring；不能把当前“没有 focus ring”当作验收标准 |
| 移动端 | CSS 使用 `100dvh`；`index.html:1613-1623` 有宽高条件的 landscape/rotate 提示；主 Bundle 有移动端高度/resize 适配和 joystick 初始化 | 竖屏可操作、横屏提示稳定、浏览器地址栏变化不遮挡内容、joystick 与 modal 不同时抢输入 |

### 3.2 Escape、焦点和图片失败

- **Escape：`UNKNOWN`。** 已定位的应用层 Bundle 片段没有 `document.addEventListener('keydown', ...)` 的 Escape modal 关闭证据；HTML 的通用键名表或框架内部键盘枚举不能等同于处理器。P2 如采用 Escape 关闭，必须把它写成测试契约，并规定游戏控制、modal 和 overlay 的优先级。
- **焦点陷阱/焦点返回：`UNKNOWN`。** HTML 有 close/scroll/next 等按钮的 `aria-label`（如 `index.html:331,478,536,1342`），但未发现 `role=dialog`、`aria-modal`、`tabindex`、`autofocus` 或 `activeElement/focus()` 的应用层证据。不能宣称已有焦点陷阱。
- **默认 focus 可见性：风险已确认。** final CSS 有全局 `*:focus` 规则清除 outline/box-shadow；因此键盘用户可能看不到当前控件。P2 需在 UI 层增加局部、可测的 focus ring，并验证不破坏像素视觉。
- **图片失败：失败收据已确认，回退行为未知。** `unavailable.json` 中的 `exterior.png`、`card5_foil.webp`、`cables3.png` 都有 404；页面 HTML 没有 `img onerror`，应用层也没有可据此确认的通用图片失败 UI。P2 只能实现经过分类的 fallback，不能声称原站已有失败图。

### 3.3 可见性与输入候选规则

**P2 设计候选：**

1. `READY` 时 Play 是唯一主要行动；loading/error 层拥有最高输入权。
2. `ENTERING_GAME` 时禁用重复 Play、保持 UI 层稳定；camera/scene 的正常入口由 Main 工作项负责，本报告不定义 111 秒边界。
3. `PLAYING` 时键盘、触屏 joystick 和 DOM 菜单的输入 ownership 必须单一；modal 打开后暂停或隔离游戏输入，关闭后恢复。
4. `MODAL_OPEN` 时 focus 初始落到 close 或标题后的第一个可操作控件；若采用 focus trap，Tab/Shift+Tab、Escape、关闭后的焦点返回必须有浏览器测试证据。
5. optional 图片失败必须保留占位尺寸、alt/可读文本和 close/导航能力；required 图片失败切换到 `ERROR` 或明确的 degraded UI。

---

## 4. Entity 复用条件审计

### 4.1 当前项目实现与公开行为对照

| 对象 | 当前重构状态 | 公开行为证据 | 生命周期差异 |
|---|---|---|---|
| Player | 当前唯一真实消费者。`CampusScene` 创建/持有 `PhaserPlayerRuntime`，在 scene shutdown 中依次清理 runtime、joystick、窗口/文档 listener；`PhaserPlayerRuntime.ts:290-299` 和 `src/player/runtime.ts:176-183` 有幂等 shutdown | `chunk` 玩家类 `$e@12322`、`createPlayer@375796`；玩家含 Arcade Sprite、body、输入、动画、timer/对话/睡眠等行为 | 输入 ownership、相机跟随、动画和玩家状态是特有责任，不能从 NPC 需求提前抽象 |
| Future NPC | 当前 worktree 没有 `game/` NPC/route 实现，也没有 `src/entity/` | Bundle NPC 类 `qe@31045`、destroy 约 `76005`；支持 sprite/physics、scene update listener、path/timer，以及 car/heli accessory 分支 | NPC 的可见性、路径、附件和异步清理与玩家不同；公开类名/压缩结构不证明本项目应复制一个基类 |
| Vehicle/route（辅助审计） | 当前 worktree 没有对应真实消费者 | `CrowdManager st@169948` 持有 `registeredCars`，`registerCar@170820/unregisterCar@170927`；Bundle 还有路线车生成和 `spawnNewCarFromStart` 清理约 `524440` | 路线 waypoint、碰撞注册、轮子/旋翼/刹车附件、出屏销毁/重生使其与 Player/NPC 都不同 |

当前实现路径中没有 `src/entity`、NPC 或 route 文件；这不是缺失需要马上补上的代码任务，而是本次门禁结论。

### 4.2 稳定部分、变化部分和复用门禁

**只可记录为观察，不能提取：**

- 稳定候选：都有 scene ownership、display object、可选 physics、每帧或事件更新、timer/tween/listener、destroy/shutdown 需求。
- 变化部分：输入来源、body/碰撞形状、路线/路径、附件对象、异步资源、可见性策略、重生策略、与 CrowdManager 的关系、scene shutdown 顺序。
- 目前只有 Player 一个本项目消费者；公开原站 NPC/车辆不是本项目已落地的第二个独立场景。

**复用结论：`NO-GO`。** 在以下条件全部满足前，不新增 `Entity` 基类、公共 registry、泛型 update/destroy adapter 或 `src/entity/**`：

1. 第二个独立真实消费者已在本项目实现，而不是仅有 Bundle 证据或未来设想；
2. 两个消费者至少各自完成 create/update/destroy/shutdown 和失败清理；
3. 对照实际修改记录，确认确有重复行为且稳定部分与变化部分可分离；
4. Human 接受复用观察和提取方案；
5. 对应系统卡、总账、测试和 Git 状态同步。

这一结论与当前 `SYS-ENTITY` 的门禁一致；本报告不改变系统卡或总账。

---

## 5. P2 状态机设计候选（待 Human/P2 Gate）

以下是给 P2 的候选接口/状态，不是已接受设计：

```text
BOOT
  -> LOADING
       -> READY
            -> ENTERING_GAME
                 -> PLAYING <-> MODAL_OPEN
       -> ERROR
            -> RETRYING -> LOADING

任何状态 -> SHUTDOWN
```

### 5.1 状态不变量

| 状态 | 输入与 UI 不变量 | 资源/清理不变量 |
|---|---|---|
| `BOOT` | 不允许 Play；显示初始 loading 容器 | 建立一次 generation；所有异步结果带 generation 校验 |
| `LOADING` | 只显示真实 loader 进度；Play disabled/不可触发 | required asset 失败转 `ERROR`；取消旧 loader/timer/listener |
| `READY` | Play 可见且只允许一次进入；进度不再变化 | Phaser/DOM bridge 已准备；不再接受旧 loading 回调 |
| `ENTERING_GAME` | Play 禁用；控制权交给入口过渡 | camera/scene 过渡由 Main 负责，本工作项不改其入口；过渡失败转 `ERROR` 或定义的 degraded 状态 |
| `PLAYING` | canvas、正式 Game UI、joystick 的 ownership 明确 | 可打开 modal；scene shutdown 必须可重复调用 |
| `MODAL_OPEN` | modal/backdrop/focus 优先；游戏输入隔离 | 关闭只恢复当前 generation，不重建游戏 |
| `ERROR` | 错误摘要和显式 Retry 可见；不伪装成 100% 或 READY | 旧 canvas/UI/listener 不得继续响应；保留可诊断原因 |
| `RETRYING` | Retry 按钮幂等；重复点击无额外重建 | abort/cancel 当前 generation，释放旧资源，再创建新 generation |
| `SHUTDOWN` | 所有操作返回 false/no-op；UI 不再恢复 | 清 timer、tween、listener、DOM bridge、Phaser 对象和请求；重复 shutdown 安全 |

### 5.2 Retry 语义候选

- Retry 只能由用户明确触发，不自动刷新页面、不无限重试。
- Retry 前先停止当前 loading/scene generation；旧 Promise、loader event、timer 和 DOM 回调即使晚到也不能修改新状态。
- Retry 不复用内部 `MAX_RETRY_COUNT`；内部地图 marker 重试和 App 重建必须是两层机制。
- 若失败属于 optional 图片，优先进入 `DEGRADED`/可运行状态并显示 fallback；若失败属于 required 入口资源，进入 `ERROR`。
- 每次 Retry 应能由测试观察到：generation 增加一次、旧 listener 数量归零、Play 不重复注册、失败状态真正离开后才重新显示真实进度。

---

## 6. 桌面与移动端可见验收矩阵

这些是 P2 的候选验收，不是本次已验证结果；截图/人工视觉签字仍需要 Human Gate。

| 场景 | 建议视口 | 必须可见/可操作 | 必须排除 |
|---|---:|---|---|
| Desktop loading | `1920×1080` | 全屏 loading、真实进度、无空白 canvas；加载完成后进入稳定 Play | 伪造百分比、Play 提前可触发、body 滚动条 |
| Desktop ready/play | `1920×1080` | logo/文字/像素 Play 可读；点击后 canvas 与正式 Game UI 出现，Play 不重复触发 | 旧 loading 覆盖 canvas、111 秒误连到本工作项、点击多次生成多个 scene |
| Desktop modal | `1024×768`、`1920×1080` | backdrop 覆盖 canvas；modal 内容可滚动；close 可见；键盘 focus ring 可见 | modal 被 canvas 遮挡、内容截断、body 横向滚动、关闭后焦点丢失 |
| Mobile portrait | `390×844`、`375×667` | `100dvh` 不被地址栏变化破坏；Play/loading/failure 文本不溢出；进入游戏后 joystick 可用 | 固定 `100vh` 造成底部裁切、页面滚动、joystick 与 modal 同时接收输入 |
| Narrow portrait | `320×568` | logo、主按钮、错误和 Retry 仍可读且可点；modal close 不被内容覆盖 | 固定宽度导致横向滚动、按钮被安全区遮挡 |
| Mobile landscape | `844×390`、`1000×550` 边界 | 按已观察规则显示方向提示或稳定适配；提示可关闭/不会抢占错误 Retry | 方向提示与 error/modal 同时出现、canvas 仍可操作但 UI 不可见 |
| Keyboard | 桌面任一视口 | Tab 顺序可预测；Play、Retry、close、modal 导航有可见 focus；Escape 行为符合 P2 契约 | 仅依赖默认 outline（当前被 CSS 清除）、焦点落入 canvas 后无法返回 |
| Image failure | 注入 404/断网 | required/optional 分类结果可见；fallback 有稳定尺寸和 alt/文本；Retry 后可恢复 | 失败图片无限请求、布局跳动、错误只在 console、假装加载完成 |
| Shutdown/retry | 任一视口 | 旧 UI 不再响应，新 generation 可重新 loading；重复 Retry/shutdown 不增加 listener | stale callback 改写状态、重复 Phaser 实例、计时器/resize listener 泄漏 |

**视觉签字边界：** 自动化只能验证 DOM 状态、尺寸、可见性、焦点、网络/console 和 listener 行为；像素间距、logo 比例、NES 视觉一致性仍需要 Human 预览并接受，不能由本报告代签。

---

## 7. P2 允许文件与明确禁止范围

### 7.1 可候选范围

P2 通过设计 Gate、授权包和 Human 决定后，才可考虑：

- `src/app/**`：App loading/ready/error/retry 状态机、generation/进度/失败分类等纯逻辑和边界契约；
- `src/game-ui/**`：loading、Play、error/Retry、modal/focus、responsive DOM UI 的扩展；
- 与上述逻辑直接对应的测试目录/测试文件；
- 经 Main 负责人明确授权的**新适配器**，且必须不改 Main 共享入口并有对应测试。

### 7.2 本工作项禁止修改

- `game/main.ts`、`game/CampusScene.ts`、现有 Phaser 入口和 Main 共享 camera/scene 逻辑；
- `index.html`、`package.json`、构建/依赖配置，除非另有明确授权；
- `sample/` 镜像、manifest、network 收据和分析证据；
- `03-执行层/`、根 `决策记录.md`、`task_plan.md` 等权威文件；
- `src/entity/**` 或任何公共 Entity 抽象；
- 旧 Phaser 项目和 `migration-history/`。

P2 若发现必须突破上述边界，先停在设计差异报告，不自行修改。

---

## 8. P2 测试候选

### 8.1 纯状态/进度测试

- `BOOT → LOADING → READY → ENTERING_GAME → PLAYING` 正常路径；
- `BOOT` 动态 import 失败、required loader `fileerror/loaderror`、optional 图片 404、进度停滞；
- 进度只接受真实 loader 回调；未收到回调不能自动增长，失败不能补到 100%；
- Play/Retry 重复点击幂等；旧 generation 的 Promise/event/timer 不能污染新 generation；
- Retry 先 cleanup 后重新 loading；shutdown 可重复调用且最终为 no-op；
- modal 与游戏输入 ownership 切换后不产生重复 listener。

### 8.2 DOM/可访问性测试

- loading、ready、error、Retry、playing、modal 的可见性互斥关系；
- Play/Retry/close 按钮有名称、可键盘触发、可见 focus ring；
- 若 P2 选择 Escape：只关闭最内层 modal/overlay，不能误触发游戏动作；关闭后焦点返回触发来源；
- 若 P2 选择 focus trap：Tab/Shift+Tab 不逃出 modal；没有焦点陷阱实现时必须保持明确的可达顺序；
- modal/backdrop 层级、滚动、`100dvh` 和 body overflow；
- 图片 `onerror`/资源错误 fallback 只触发一次，保留布局尺寸和替代文本。

### 8.3 浏览器 smoke/行为收据

至少覆盖 `1920×1080`、`1024×768`、`390×844`、`375×667`、`844×390`；收集：

- 页面状态序列和截图/DOM snapshot；
- canvas、loading、Play、modal、joystick 的 bounding box 与 computed visibility；
- `pageerror`、console error、404/failed response、资源分类；
- Tab/Escape/触摸/方向输入；
- Retry 前后 Phaser 实例数、listener/timer 清理和旧回调污染；
- 断网或可控 404 注入后的恢复路径。

### 8.4 Entity 门禁测试

本工作项只需维持现状并在 P2 变更时防回归：

- 保持当前没有 `src/entity/**` 公共框架；
- Player shutdown 的现有测试继续通过；
- 只有第二个真实消费者实际落地后，才增加对照 lifecycle matrix；
- 在 Human 接受复用方案前，禁止用测试文件名或空壳接口制造“第二个消费者”。

---

## 9. 风险与未知

1. **Bundle 不是原始源码。** 压缩类名、偏移和调用顺序能证明公开行为，不能证明原始目录、组件边界或应复刻的架构。
2. **失败路径没有完整运行收据。** 当前运行收据是一条成功进入 Play 的路径；404 收据说明资源问题存在，但没有证明每个 404 对用户的实际影响。
3. **进度口径不完整。** Phaser 文件队列完成、动态 chunk 完成、DOM 图片完成和世界分块完成不是同一件事；需要在 P2 明确 required/optional 分级。
4. **Loading 覆盖层有定时器风险。** `removeInitLoad` 与真实 `gameLoaded` 分开，加载失败时可能过早暴露空页面；该结论是代码风险，不是已观察的失败画面。
5. **焦点可访问性存在明确风险。** HTML 的按钮有部分 `aria-label`，但没有发现 dialog/focus 管理；CSS 还覆盖了默认焦点样式。
6. **图片失败回退未知。** 不能因为网络层记录 404 就猜测原站会显示什么，也不能为了“视觉完整”扩大公开采集范围。
7. **入口 camera 归属不清。** Bundle 有 `startGame` 的短时过渡和其他场景计时器；111 秒 hard boundary 的正常入口归 Main 工作项核对，本报告不接管、不重写。
8. **重试重建容易泄漏。** Phaser loader、DOM bridge、resize/visualViewport、joystick、scene timer 和旧 Promise 若没有 generation 约束，Retry 可能产生重复实例或 stale UI。
9. **Entity 复用容易过早抽象。** Player、NPC、车辆的共同名词不足以证明共同生命周期；当前仍未发现第二个本项目真实消费者。

---

## 10. 停止条件

遇到以下任一情况，停止 P2 实现并回到 Human Gate/调查，不自行扩大范围：

- 需要 source map、私有资源、未公开路径或刷新镜像才能回答问题；
- 无法确认某资源是 required 还是 optional，却准备据此改变成功/失败状态；
- 准备用时间、请求数量或猜测值伪造加载百分比；
- Retry 方案必须修改 Main 共享入口、`CampusScene`、`index.html` 或构建配置，但没有明确授权；
- 试图在没有第二个真实消费者和 Human 接受前建立 Entity 公共框架；
- 正常入口与 111 秒 camera boundary 尚未由 Main 收敛，却要在本工作项改动 camera/scene；
- 浏览器验证出现 stale callback、重复 listener、重复 Phaser 实例、无法恢复的 body scroll 或焦点丢失；
- Human 尚未接受视觉预览/差异，或报告结论尚未同步到要求的权威记录和 clean Git 基线。

## 11. 当前交付边界

- **已确认**：公开 Loading/Play 阶段、Phaser 文件队列进度、成功运行可见状态、正式 UI 骨架、移动端 CSS/提示、404 资源收据、Player/NPC/车辆生命周期差异。
- **已整理但待接受**：P2 状态机、失败分类、Retry 清理协议、桌面/移动验收矩阵、允许文件与测试候选。
- **尚未解决**：用户可见 Retry 的最终文案/交互、Escape/focus 契约、404 的 required/optional 分类、正常入口 camera 与 111 秒边界、第二个真实 Entity 消费者。
- **本报告没有**：代码实现、权威文档更新、正式设计签字、测试通过声明或可复用模块。
