# WI-VISIBLE-CONTENT-WAVE-001：P1 公开证据调查报告

- **工作项**：`WI-VISIBLE-CONTENT-WAVE-001`
- **阶段**：`P1` 公开证据调查；未授权 P2 设计或正式实现
- **报告状态**：已形成，待 CRLF-aware diff、范围和提交验证
- **调查范围**：About、Projects、Memo 六张卡、区域触发、弹窗失败/关闭边界、真人可发现路径
- **证据边界**：只读取仓库内原站公开镜像、网络收据、初步分析和当前系统卡；没有新增请求、没有读取私有资源、没有修改 `src/`、没有改动共享权威文件
- **基线**：`8ae7692b45b16f4b0ce6e96faa448197734db3b0`，tree `c825bb6a99f363e30a665d58d4a2eadf7b18f537`，parent `ddec24d29be7bc12051a43a0c22883166f68f34d`；调查开始前工作树 clean
- **唯一允许新增文件**：`task-todos/WI-VISIBLE-CONTENT-WAVE-001-P1-调查报告.md`

> 本报告中的 `FACT` 是公开文件或已保存运行观察直接证明；`INFERRED` 是由公开证据推导但尚未通过正常入口人工行为验收；`DECISION` 是供 P2 评审的候选方案，不是已接受合同；`UNKNOWN` 是当前不能安全补全的内容。

## 1. 结论先行

1. **可安全进入 P2 候选的可见内容至少有三类**：`About`、`Projects`、`Memo`。三类的英文正文、主要图片、触发 marker ID 和弹窗 DOM 均有公开证据。
2. **P2 首选验证内容是 Memo #6**：从公开 Bundle 的出生点和 `walls-layer.json` 计算出的最短候选步行路径约 43 个四方向 tile 步，终点距 `memo6` marker 约 22.6 px，低于严格 `<30px` 触发阈值；这是 `INFERRED`，不是已完成真人发现验收。
3. **不能把已有探针录像/观察当作真人可发现性证据**：`sample/analysis/layer-visual-evidence/observations.json` 明确记录使用了 `player.setPosition` 等 probe-assisted 位置；`handleMenuClick` 和 `openTestModal` 也属于传送/测试快捷路径，必须排除。
4. **英语内容已确认；完整斯洛伐克语 modal 正文未确认**。Bundle 中能看到 `en/sk` 的 intro/NPC 字符串，但当前静态 About、Projects、Memo modal DOM 是英文。P2 不得凭猜测补写 Slovak 正文。
5. **已知资源失败是 `card5_foil.webp` 404 等 3 个 unavailable 资源**。`card5_base.webp` 可用；P2 必须明确降级或停止条件，不能把 foil 效果当作已验证。
6. **动态 marker 来源、缺失 modal target 的产品语义、失败重试、完整 teardown 仍为 `UNKNOWN`**。本报告不冻结这些接口，也不授权实现猜测。

## 2. 证据目录与可复核来源

| 证据 | 可复核位置 | 结论 |
|---|---|---|
| 原站静态页面 | `sample/original-public-build/mirror/index.html:1-304`、`474-536`、`867-1305`、`1382-1454` | `FACT`：页面包含 About、Projects、Memo 导航、静态 modal 正文、图片引用和外链 |
| 原站 Bundle | `sample/original-public-build/mirror/chunk-JI7HG47Y.js`、`chunk-VANY4YOC.js`、`main-RV3Z53H4.js` | `FACT`：marker、区域检测、modal bridge、关闭状态、出生点和内容方法的公开实现 |
| 资源清单 | `sample/original-public-build/network/resource-index.json`、`sample/original-public-build/manifest.json` | `FACT`：内容图片/字体等请求状态及镜像资源路径 |
| 不可用资源收据 | `sample/original-public-build/network/unavailable.json:1-21` | `FACT`：3 个公开请求为 404，其中包括 `card5_foil.webp` |
| 地图碰撞层 | `sample/original-public-build/mirror/assets/maps/walls-layer.json` | `FACT`：保存了 140×140 的公开墙体网格；路线计算输入 |
| 已保存视觉观察 | `sample/analysis/layer-visual-evidence/README.md`、`observations.json` | `FACT`：此前位置记录带有 probe-assisted 限定，不能证明自然路径 |
| 运行时初步分析 | `sample/analysis/runtime-findings.md`、`runtime-network.json` | `FACT`：已有分析记录的运行入口、网络范围和已知限制；不替代本报告的未知项 |
| 当前系统卡 | `03-执行层/03-内容线/01-区域触发.md`、`02-世界交互(弹窗).md` | `FACT/DECISION`：当前触发与交互合同的已确认边界；实现前仍需当前任务 Gate |

## 3. 已确认的可见内容

### 3.1 About

`index.html:474-536` 的 `#about` modal 提供以下英文内容：

- 标题：`About me`
- 人名：`Peter Oravec`
- 职位：`Front-end & MEAN Stack developer`
- 图片：`assets/images/peter-oravec.webp`，alt 为 `Peter Oravec CV photo`。
- LinkedIn 图标链接：`https://www.linkedin.com/in/peteroravec`，使用新窗口打开。
- 小标题：`Bridging the Gap Between Design and Code`
- 正文块一：`I'm Peter Oravec, a creative web developer with over 19 years of experience, currently based in Bratislava, Slovakia.`
- 正文块二：`My primary focus is on Front-End, JavaScript and Angular, but I also have deep experience as a full-stack developer, especially in the MEAN stack (MongoDB, Express, Angular, Node.js).`
- 正文块三：`I feel most at home building Single Page Applications (SPAs) in Angular, especially those requiring complex animations and fluid interactivity. However, my strongest asset isn't just my code—it's my ability to act as the vital link between graphics, front-end, and backend.`
- 正文块四：`I understand the visual language of designers and the structural needs of backend engineers, ensuring a flawless final product.`

`FACT`：About 的标题、人名、职位、四个正文块、头像路径和 LinkedIn URL 是原站公开内容；`peter-oravec.webp` 的资源收据为成功，镜像图像是像素化灰度头像。

`UNKNOWN`：LinkedIn 目标站点在本调查中没有重新请求，因此只能确认页面中的 URL，不能确认外站当前可达性或其最终内容。

### 3.2 Projects

`index.html:1382-1454` 的 `#projects` 静态 DOM，及 `main-RV3Z53H4.js` 编译模板（Projects 字符串约在 byte `143487`，图像模板约在 byte `167411`，渲染指令约在 byte `180098`）提供三个项目。Bundle 模板在项目外链旁包裹对应 portfolio 图片；静态 HTML 本身保留了同一正文和链接。

- 页面引导：标题 `Projects`；正文为 `Here is a selection of my personal projects. Besides these experiments, I have a lot of work on other large projects under my belt. You can find my full career path and a more detailed overview in the Resume (CV) section.`
- **eUTxO.org**
  - 副标题：`Visual Blockchain Explorer for Cardano`
  - 正文：`I have a general interest in crypto and blockchain technologies and this is one of my most complex side projects. It's a visual tool for Cardano cryptocurrency to help you understand the UTXO model and the content of Cardano blocks.`
  - 技术：`Serverless Node.js`、`Google Firestore DB`、`BlockFrost API`、`PhaserJS`、`Tailwind CSS`
  - 链接：`https://eutxo.org`
  - Bundle 图片：`assets/images/portfolio/portfolio-eutxo.webp`，alt 为 `eUTxO.org - Visual Blockchain Explorer`
- **Angular.sk**
  - 副标题：`Free online course for Angular 2+`
  - 正文：`Angular.sk is my side project. I created a series of instructional videos for beginners who want to learn working with Angular 2+.`
  - 链接：`https://angular.sk`
  - Bundle 图片：`assets/images/portfolio/portfolio-angularsk.webp`，alt 为 `Angular.sk`
- **Peter Oravec portfolio v1**
  - 副标题：`100% human-coded, no AI`
  - 正文：`The first version of this pixel art portfolio, which I programmed entirely by myself without any help from artificial intelligence. Every line of code, every sprite and every mechanic is purely my work. The current version you are on right now is its successor.`
  - 技术：`Angular`、`PhaserJS`、`Tiled`
  - 链接：`https://old.peteroravec.com`
  - Bundle 图片：`assets/images/portfolio/peteroravec-v1.webp`，alt 为 `PeterOravec.com portfolio v1`

`FACT`：三个项目的标题、正文、技术标签、图片 URL 和外链 URL 均有静态 HTML/编译模板证据；三个 portfolio 图片的请求收据为成功，镜像中有对应文件。

`UNKNOWN`：三个外链的实时可达性、跳转后的安全策略和站外页面内容未在本调查中验证；静态 HTML 与运行时模板的最终 DOM 替换时序也未单独做行为验收。

### 3.3 Memo 六张卡

`index.html:867-1305` 的 `#memo1`–`#memo6` 使用 `memo-nav-wrapper` 提供六张卡；标题和正文如下：

1. **100% Vibe coding**
   - `This entire website was created as an experiment with a modern approach to development – so-called vibe coding. My goal was to test the limits of human-AI collaboration when building a complex digital product completely from scratch.`
   - `The result? A fascinating synergy that has its clear rules.`
   - `AI provided speed, but I had to provide direction, logical consistency and the final integration of all parts into a functional whole.`
   - `Context is king: Without deep understanding of the code and the ability to precisely define the task, AI quickly gets tangled up.`
   - `Critical thinking: Every line generated by the machine went through rigorous human review and manual fine-tuning of details that escape the machine.`
   - `This website is proof that AI can push the boundaries of what's possible, but only in the hands of someone who knows exactly what they're doing. It's a brilliant assistant, but you must remain the captain and architect.`
2. **Automatic testing**
   - `Nobody likes bugs. I personally have experience with automatic testing of both backend and frontend.`
   - `My favorite tools for End-To-End frontend testing include Midnight, Playwright and Puppeteer. With them, I can create tests that run in a CI environment before every deployment or other browser automation.`
   - `When API testing is needed, I use Mocha and Chai libraries. I'm a fan of automation.`
3. **From Node.js logic to visual art in Canvas**
   - `I've been specializing in the JS ecosystem for a long time, where I feel at home. Whether it's a robust backend in Node.js and Express.js, dynamic frontends in Angular, or creative visual solutions in Canvas, I see JavaScript as a tool with unlimited possibilities.`
   - `My main strength is that I'm a mix of designer, front-end developer and backend developer in one. It has always been this way and I'm used to covering all the pain points of development.`
4. **Technologies I buried**
   - `They say what doesn't kill you makes you stronger. Lotus Notes didn't kill me, although it tried very hard. After years of fighting with it, PHP and WordPress, I closed this chapter with relief (and a mild celebration).`
   - `Today I use these battle scars to create better, faster and more stable solutions. Exclusively in JavaScript.`
5. **AI: Competitor or colleague?**
   - `The ability to write syntactically correct code is no longer rare. AI does it faster, for free, and 24/7.`
   - `However, programming isn't about writing lines, but knowing which lines not to write. AI is just a powerful generator and I am the filter.`
6. **I'm not a game developer**
   - `Don't be fooled by the visuals – I'm not a game developer. My priority is large, long-term projects that require clean architecture and logical solutions.`
   - `At the same time, I can be creative and flexible when the situation calls for it.`

各卡都使用 `assets/images/cards/cardN_base.webp`；共享 pointer-hand 和 prev/next/list 导航已在 DOM 中确认，卡片效果按卡片不同使用 shine、glare、foil、pattern、sparkles 或 prism 等层。

资源状态：

- `card1_base.webp` 至 `card6_base.webp` 有成功镜像/请求收据。
- `card2_foil.webp` 等部分效果资源成功；`card5_foil.webp` 在 `resource-index.json:775-781` 和 `unavailable.json:13-18` 中为 404。
- 同一 unavailable 收据还记录两个其它公开资源 404；具体状态必须以收据为准，P2 不得自动重试或猜测替代 URL。

`FACT`：六张 Memo 的标题、正文、导航结构和 base 图片路径已证实；失败收据已证实。

`UNKNOWN`：每张卡的完整动态效果是否为必要内容、404 时原站是否有降级、卡片动画在移动端的精确行为尚未证实。

### 3.4 语言范围

- `index.html:6` 的文档语言为 `en`；语言 alternate 入口位于 `index.html:240-242`，包含英文、斯洛伐克语和 x-default URL。
- Bundle 中确有 `en/sk` 选择逻辑和斯洛伐克语 intro/NPC 字符串，例如 `Vitaj v mojom portfóliu!`、`Protestujeme!`。
- 但当前 About、Projects、Memo 的静态 DOM 和编译模板只确认了上述英文正文；调查到的 Bundle 文本没有相应完整 Slovak modal 正文。

结论：

- `FACT`：P1 可交付内容范围是英文 About、Projects、Memo。
- `UNKNOWN`：Slovak 版三类 modal 正文、翻译切换后的实际可见结果和语言资源路径。
- `DECISION`（待 Human 接受）：P2 第一轮只实现已证实英文正文；若验收要求 Slovak modal，先补公开证据或取得 Human 提供并接受的内容，不由 AI 翻译冒充原站事实。

## 4. 区域触发和弹窗行为

### 4.1 公开实现中可确认的触发语义

`chunk-JI7HG47Y.js` 中的 `GameScene` 内容 marker 逻辑提供以下证据：

- 静态 marker 列表包含 11 项：`about`、`projects`、`memo1`–`memo6`、`kontakt`、`cv`。
- marker 数据带有 `id`、`name`、`x`、`y`、`menuId`；内容 marker 的入口与 `menuId` 对应。
- `create()` 为静态列表创建 `ContentMarker`，再启动 marker 检查；公开分析记录的出生点是 `(1088,304)`。
- `updateContentMarkers()` 以 100 ms 定时检查玩家与 marker 的距离；进入条件是严格 `distance < 30`，不是 `<=30`。
- 进入时设置 `wasManuallyClosed=false` 并调用 `window.showModalWithBackdrop(menuId)`；玩家离开后调用 `window.hideModalWithBackdrop()` 并清除进入状态。
- modal 关闭会通过 `window.closeMarker(menuId)` 设定 `wasManuallyClosed=true` 并隐藏该 marker 文本；离开区域再回来时可重新进入。
- 页面层的 `updateModalState` 在有 modal 打开时隐藏其它内容 marker；全部 modal 关闭后延迟恢复显示。

这些与当前 `03-执行层/03-内容线/01-区域触发.md`、`02-世界交互(弹窗).md` 的已确认边界一致。触发阈值、单次进入和手动关闭语义可作为 P2 测试输入，但仍需正常入口行为验收。

### 4.2 动态 marker

`FACT`：保存的 Bundle 可见 `addContentMarker(markerData)`、`removeContentMarker(markerId)` 和静态列表创建路径；`removeContentMarker` 会调用 marker 的 `destroy()` 并从数组移除。

`FACT`：在已调查的 Bundle 静态调用路径中，只看到了静态 marker 列表在 `create()` 中创建；没有找到第二个公开数据源或运行时调用者把新内容 marker 加入列表。

`UNKNOWN`：这不能证明其它运行时注入、未来版本或未捕获入口不存在；也不能证明 `addContentMarker` 是产品支持的稳定接口。P2 不得自行发明动态 marker 注册协议，也不得把 `openTestModal()` 中的测试入口当作动态内容。

### 4.3 手动菜单和测试快捷路径的排除

- `handleMenuClick()` 会按菜单 marker 位置执行 teleport/镜头序列，属于菜单导航快捷路径，不是玩家自然步行。
- Bundle 还存在 `openTestModal()` 这类直接打开 modal 的测试入口。
- `sample/analysis/layer-visual-evidence/observations.json` 的观察记录使用了 `player.setPosition` 等 probe-assisted 方法，README 明确要求将其排除在自然路径证据之外。

因此，本报告只把地图碰撞网格计算出的路线列为 `INFERRED` 候选；没有把上述快捷路径列为“真人可发现”证据。

## 5. 真人可发现路径候选

### 5.1 计算方法

使用公开出生点、公开 marker 坐标和 `walls-layer.json` 进行静态四方向 BFS：

- 起点：`(1088,304)`，按 16 px tile 归一为 `(68,19)`。
- 墙体输入：公开 `walls-layer.json`，140×140 网格；本次计算将公开可通行格按 `0` 处理。
- 触发判定：以 marker 中心为终点，并保留 `<30px` 的实际触发半径。
- 限制：没有把 camera sequence、真实 normal Play 入口、玩家刚体尺寸/运行时动态障碍、摇杆输入误差和实际视觉遮挡当作已证实事实。

### 5.2 首选 Memo #6

- marker：`memo6`，像素坐标 `(496,176)`，对应 tile `(31,11)`。
- BFS 选择的最近可触发格：`(32,12)`。
- 压缩步行候选：从 `(68,19)` **向左 36 格，再向上 7 格**（约 43 个四方向 tile 步），到 `(32,12)`。
- 终点与 marker 中心距离约 `22.6px`，满足严格 `<30px`。

结论：`INFERRED`。这是可复核的静态路线候选，不是“已通过真人正常入口”的事实。P2 的第一条手工验收必须从正常 Play 入口开始，不能使用 teleport、`setPosition`、直接 modal bridge 或测试 hook；在实际画面中沿该方向移动并记录首次触发、离开、手动关闭和再次进入。

### 5.3 About 备用候选

- marker：`about`，像素坐标 `(944,768)`，对应 tile `(59,48)`。
- 最近可触发格：`(60,47)`。
- 一条压缩 BFS 候选为：**向右 20 格、向下 7 格、向左 9 格、向下 9 格、向左 16 格、向下 3 格、向左 1 格、向下 7 格、向左 2 格、向下 2 格**，约 76 步。
- 终点与 marker 中心距离约 `22.6px`，满足 `<30px`。

同样标记为 `INFERRED`，只用于 P2 规划，不替代现场行为验收。Projects 和其余 Memo 的 marker 坐标已由静态 marker 列表确认，但本 P1 不把它们的路线宣称为已验证。

## 6. 失败、关闭和 teardown 边界

### 6.1 已观察到的正常关闭/重入语义

`FACT`：正常 marker 进入会通过页面 bridge 打开对应 modal；手动关闭会标记当前内容为手动关闭并隐藏 marker 文本；玩家离开后清除区域状态，再次进入可重新触发。打开任一 modal 时，其他内容 marker 会暂时隐藏，全部关闭后恢复。

`FACT`：页面层 modal 是现有静态 DOM，关闭按钮、遮罩/close bridge 和 `closeMarker` 共同参与关闭；P2 必须保持 `menuId` 与 marker 之间的对应关系。

### 6.2 已知失败和未确认语义

- `UNKNOWN`：如果 `menuId` 没有对应 modal DOM，页面 bridge 是否应显示错误、静默忽略、回退到通用错误内容，当前没有产品合同。现有公开代码对缺失元素使用可选访问/静默路径，不能据此定义重构语义。
- `UNKNOWN`：modal 打开失败、图片解码失败、外链失败是否需要重试、toast、占位内容或 telemetry；没有发现可作为合同的失败协议。
- `FACT`：资源收据已经有 404；P2 不得请求未列入白名单的 guessed URL。`card5_base` 可作为已证实的可用候选，但“foil 失败时自动用 base”目前只是 `DECISION` 候选，不是原站事实。
- `UNKNOWN`：`ContentMarker.destroy()` 有显式销毁 DOM/Phaser 对象的能力，但在已调查的正常 scene shutdown 路径中没有证据表明所有 marker、定时器、window/viewport 监听器和 modal bridge 都被统一清理。
- `UNKNOWN`：多次打开/关闭、快速离开区域、resize/orientation 中断 camera/teleport 相关定时器后的最终状态；该问题属于 P2 集成验收前置风险。

### 6.3 P2 的保守失败决定候选

`DECISION`（待 Human 接受，不是原站 FACT）：

1. 内容 resolver 找不到已登记 `menuId` 时不抛出未捕获异常，不打开空 modal；记录可诊断错误并保持当前世界状态。
2. 图片加载失败时保留正文和可关闭 modal；只对已批准的本地 fallback 做降级，禁止隐式网络重试或猜路径。
3. `card5` 首轮使用已确认的 `card5_base.webp`；foil 作为可选效果，失败不阻断正文可见性，并在验收收据中明确“特效未复现”。
4. scene teardown 必须有可测试的释放边界；在该边界被证实前，不宣称没有 listener/timer 泄漏。

## 7. P2 可见内容实现候选（待评审，不代表授权）

以下三项满足“至少三类可见内容”的候选范围。它们不是本 P1 的代码任务，也没有冻结新的 API。

| 候选 | 证据绑定 | P2 可见验收候选 | 主要风险 |
|---|---|---|---|
| **A. About modal** | `#about`、`peter-oravec.webp`、LinkedIn URL、`about` marker | 正常 Play 后真人步行进入 About 区域；`About me`、`Peter Oravec`、职位、四个英文正文块、头像和 LinkedIn 链接可见；关闭后走出区域，再进入可再次打开；窄屏内容不被底部操作区遮挡 | 真人路线尚未验证；外链实时可达性未知；Slovak 正文未知 |
| **B. Projects modal** | `#projects`、编译模板中的三个 portfolio 图片、三个项目文本和 URL、`projects` marker | 正常 Play 后真人步行进入；三个项目标题/正文/技术标签/缩略图均可见；每个 href 与静态证据一致；modal 可关闭并重入；桌面和移动视图均不出现不可滚动/遮挡 | 三个外链未重新验证；资源复制必须保留镜像 URL 语义；静态 HTML 与运行时模板的替换时序、图片失败处理未知 |
| **C. Memo collection** | `#memo1`–`#memo6`、六个 marker、六张英文卡正文和 base 图片 | 首先以 Memo #6 的候选真人路径做 gate；进入后能看到 `I'm not a game developer` 的完整正文和卡图；通过 prev/next 或正常 marker 访问其它五卡；手动关闭、离开、重入均符合区域语义 | `card5_foil.webp` 404；六卡完整自然路径尚未验证；特效与移动端性能/teardown 未知 |

P2 共同验收必须同时覆盖：

- **行为**：`distance < 30`、一次进入一次打开、手动关闭抑制、离开后重入；不能只测函数调用。
- **真人发现**：至少一条桌面和一条移动端正常 Play 路径；测试 hook 可以用于单元/边界测试，但不能作为“玩家发现内容”的证据。
- **内容准确性**：英文文案逐字对照 `index.html`；图片路径必须对照 `resource-index.json`/manifest；缺失资源必须记录降级。
- **可关闭性**：关闭按钮/遮罩/离开区域不留下不可关闭 modal，也不阻塞后续内容 marker。
- **生命周期**：销毁场景后不再触发旧 marker、旧 modal bridge 或旧 interval；该项目前只是必须验收的未知，不是假定通过。

## 8. P2 允许文件与明确不允许范围

### 8.1 若 Human 通过当前 Gate 后授权 P2，03 内容线候选允许范围

仅限与可见内容直接对应的新增/修改，具体文件须在 P2 授权包中再次列出：

- `src/content/**`：About、Projects、Memo 的内容模型、已证实英文 payload、资源映射和显式 fallback。
- `src/zone/**` 或任务卡指定的内容区域实现文件：消费已接受的区域事件，不自行改变系统卡契约。
- `src/interact/**` 或任务卡指定的 modal 交互实现文件：内容显示、关闭和错误边界。
- `tests/content/**`、`tests/zone/**`、`tests/interact/**`：内容精确性、阈值、手动关闭/重入、失败与 teardown 测试。
- `public/**` 中由已批准镜像资源生成的副本（如确有必要）：保持原公开 URL 语义，登记来源和哈希；不得新增未捕获资源请求。

这些是 **P2 候选白名单**，不构成本次 P1 的写入授权。

### 8.2 本次和后续 03 内容线不允许擅自修改

- 本次除本报告外的任何文件，尤其是 `src/`、`tests/`、`index.html`、`sample/`、`03-执行层/`、`02-接口层/`、`task_plan.md`、根 `决策记录.md`。
- Main 入口/游戏生命周期、共享 UI、摄像机入口、菜单传送和现有 Phaser 项目；这些属于 Main 或既定 owner 范围。
- 公开镜像的重命名、重组、刷新、source map、私有或猜测 URL。
- 未被证据证明的 Slovak modal 文案、动态 marker 注册协议、外链失败策略和通用复用模块。

P2 若发现必须修改 owner 外文件、API 契约或系统卡，先停在 Human Gate，不以内容实现顺便修改。

## 9. 测试与验证计划

本节是 P2 的验收候选，不是本次已运行结果。

### 9.1 静态/单元测试

1. About/Projects/Memo fixture 与 `index.html`/编译 Bundle 正文逐项匹配：标题、段落顺序、标签、href、图片 URL。
2. 资源映射只引用已登记成功资源；`card5_foil.webp` 作为 unavailable fixture 覆盖失败分支。
3. zone 边界测试：`29.999px` 进入、`30px` 不进入；重复 update 不重复打开；手动关闭后区域内不立即重开；离开后重入可以再开。
4. modal 测试：打开/关闭、未知 `menuId`、正文保留时的图片失败、连续关闭/重入、scene teardown 后旧事件不再改变 DOM。
5. 如需测试动态 marker，必须先有明确 Human 接受的来源/接口；在此之前只测试静态登记表，不测试猜测的动态协议。

### 9.2 浏览器行为验证

- 桌面：从正常 Play 入口开始，禁止 teleport、`player.setPosition`、`openTestModal` 和直接调用 modal bridge 作为发现步骤；沿 Memo #6 候选路线移动，记录首次打开、离开、手动关闭、再次进入。
- 移动端：使用可见摇杆/正常输入完成同类路径，检查 modal 高度、滚动、关闭按钮和底部 UI 遮挡。
- 资源失败：在不增加网络范围的前提下复现/注入已知 `card5_foil` failure，确认正文仍可见或按 Human 接受的停止条件停止。
- 生命周期：重复打开/关闭、resize/orientation、scene 退出/重进后检查 marker、modal、listener、timer 的行为。

### 9.3 本 P1 的验证命令

交付前只对本报告执行：

- `git diff --check -- task-todos/WI-VISIBLE-CONTENT-WAVE-001-P1-调查报告.md`
- CRLF-aware 检查：确认新增文件只使用 LF，且 `git diff --ignore-space-at-eol --numstat` 的变更只对应本报告。
- 范围检查：`git status --short` 只能列出本报告；`git diff --name-only` 只能列出本报告。
- 报告提交后复核 `git show --stat --oneline HEAD`、`git rev-parse HEAD^`、`git rev-parse HEAD^{tree}` 和 `git status --short`。

## 10. 停止条件

满足任一项即停止 P2 候选推进并回到 Human Gate，不猜测、不扩展采集：

1. 正常 Play 入口不能在不使用快捷路径的情况下到达候选 marker，或实际路线与静态网格不一致。
2. `menuId`、区域事件或 modal close 语义需要改变既有系统卡/API 契约。
3. 需要补写未证实的 Slovak modal 正文、外部内容或未公开资源。
4. 404 资源没有被接受的 fallback，或正文可见性依赖不可用的 `card5_foil.webp`。
5. 缺失 modal target、图片失败、重复进入或 teardown 的实际行为无法建立可验证合同。
6. 需要修改 Main owner、共享权威文档、`sample/` 快照或本白名单外文件。
7. 任何测试只能通过 warp/test hook 通过，而不能证明真人正常入口路径。

## 11. 当前状态分离

- **已讨论/已调查**：三类英文可见内容、静态 marker/阈值/关闭语义、资源状态、静态路线候选、P2 候选白名单和停止条件。
- **已形成但未接受为设计**：P2 英文首轮、Memo #6 首 gate、card5 base fallback、缺失内容静默失败的保守候选。
- **本报告已落盘**：仅限本文件；提交和最终 clean/tree 收据待本轮验证。
- **尚未验证**：真人正常入口可发现性、完整 Slovak modal、动态 marker 来源、真实失败重试策略、场景 teardown、card5 特效降级。
- **未授权**：P2 设计冻结、正式 `src/` 实现、资源刷新、API/系统卡修改。

## 12. 停止点

本报告不继续进入 P2，不修改代码或共享文件。完成本文件的 CRLF-aware diff、范围验证后，只提交该报告，并返回 commit、tree、parent 和 clean 状态。
