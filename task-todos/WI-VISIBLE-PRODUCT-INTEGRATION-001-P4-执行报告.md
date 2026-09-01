# WI-VISIBLE-PRODUCT-INTEGRATION-001 P4 执行报告

- 工作项：`WI-VISIBLE-PRODUCT-INTEGRATION-001`
- 阶段：P4 Main 最终产品接线
- 授权决定：`DEC-VISIBLE-WAVE-P4-INTEGRATION-001`
- 执行日期：2026-08-22
- 模型：`gpt-5.6-sol`
- 分支：`integration/visible-product-wave`
- clean assembled baseline：`532d8095e4adcae79e5b46cfa766a661c42c1909`
- baseline tree：`d466828f2b1635edbb86f6c1a2f0d6b71601c9bb`
- 状态：自动门禁已通过，`ready-for-human-visual-gate`

## 1. 结论

P4 包五项已在 assembled baseline 上完成接线并通过自动门禁：

1. production 使用 04 `AppRuntime + DomAppUi`，真实 DOM Play/Retry 驱动 generation；不自动 Play。
2. About/Projects/Memo 默认使用 03 `CONTENT_REGISTRY`；CV/Contact/Tech 保留既有 fallback；10 项公开镜像资源离线复制并核对 SHA-256。
3. production 入口使用真实 `PhaserTrainRuntime` route `holding` 收据，不再使用 `TimedTrainArrivalAdapter` 作为产品真值。
4. train shape、sprite、blocking zone 与玩家 Arcade collider 同属一套 train 生命周期，teardown 顺序为 collider → shape/sprite → blocking zone。
5. sprayer、factory smoke 与 train 在同一 Scene generation 内启动并随 Retry/shutdown 清理；未新增 Entity 框架。

未修改产品目标、P2 参数、真实正文、`sample/`、权威文档或其他 owner 私有实现。

## 2. 实现收据

### 2.1 App / Retry generation

- `game/main.ts` 用 `AppRuntime` 管理 Loading、READY、PLAYING、MODAL_OPEN、ERROR 与 generation。
- `index.html` 提供肉眼可见的 Loading/Play/Error/Retry、键盘 focus 和 rich modal 容器。
- Play/Retry 由真实按钮 click 触发；重复调用幂等。
- `src/app/runtime.ts` 支持异步 cleanup；Retry 必须等旧 generation cleanup 完成后才创建新 generation。
- `game/AppGameUiBridge.ts` 将内容 modal open/close 同步为 `PLAYING ↔ MODAL_OPEN`。
- generation 1 必需 chunk 两次失败时进入 ERROR；cleanup 后 canvas=0、Physics collider=0、current generation=null。
- Retry 创建且只创建 generation 2；canvas=1。旧 generation 晚回调不会覆盖 generation 2 的 READY/PLAYING。

### 2.2 内容与资源

- `game/CampusContentResolver.ts` 使用 `CONTENT_REGISTRY` 覆盖 About/Projects/Memo；未复制 registry 正文。
- `CAMPUS_CONTENT_PAYLOADS` 继续承担 CV/Contact/Tech 最小 fallback。
- 新增 `scripts/runtime-content-assets.json`，固定 10 项 source、registry `src` 目标和 SHA-256。
- prepare/check/tests 都校验：
  - source 位于成功公开镜像；
  - target 精确等于 registry `src` 去除前导 `/`；
  - source/runtime SHA-256 与 manifest 一致；
  - 不联网、不猜 URL。
- rich modal 图片失败时仍保留 heading/paragraph/link/tags 与纯文本 body fallback。

### 2.3 真实 train 与 entry lease

- `PhaserTrainArrivalAdapter` 包装唯一 `PhaserTrainRuntime`，调用真实 `start()`。
- arrival 只在 route snapshot 首次进入 `holding` 时 resolve；没有第二个 5 秒产品 timer。
- 实测：camera stable=`3067ms`，此时 entry lease 仍持有；真实 train 到 `holding` 后 playable=`5035ms`。
- entry Smoke 观察到真实 train sprite、Arcade shape、player collider、blocking zone 与 route state。
- route 完整实测：holding=`5057ms`，complete=`17081ms`；complete 后 sprite/shape/collider/blocking zone 均离场。
- `480×270` backing canvas、`3000ms Power2` camera 与正常入口禁用约 111 秒序列保持不变。

### 2.4 side lifecycle

- Scene preload player、sprayer、train、factory smoke 资源；world/player ready 后启动 side runtime。
- sprayer 只读玩家位置；Smoke 通过真实键盘路线穿过 track opening 后触发四名 sprayer，未 teleport。
- sprayer 按约 300ms 级联，至少一名完成并销毁；shutdown 后 sprayer sprite=0。
- factory smoke 只读 camera world viewport；视口外停止发射，返回后复用同一 generation emitter。
- teardown 顺序为 side listener/emitter/collider，再 content/player/world；shutdown 收据：listener=0、timer=0、sprite=0、emitter inactive、entry lease=0、Physics collider=0。
- `ProductEntryRuntime.shutdown()` 会释放其自身 lease，取消/Retry/shutdown 不遗留 lease。

## 3. Browser Gate 实测

所有 gates 均串行运行。

### production build

- `browser:smoke`：PASS；App=`READY`、generation=1、Play 可见、canvas=`480×270`，无异常、失败请求或坏响应；未自动 Play。
- `browser:runtime-safety-smoke`：PASS；`__campusDebug`、`__campusCollisionTest`、`__campusEntryTest` 全为 `undefined`。

### test-hooks build

- `browser:entry-smoke`：PASS；camera=`3067ms`，真实 train playable=`5035ms`。
- `browser:app-retry-smoke`：PASS；generation 1 ERROR 完整清理后 generation 2 READY/PLAYING；旧代回调无效。
- `browser:content-smoke`：PASS；正常 Play 后真实键盘移动到 Memo 6 `<30px`，显示 title、1 个 rich section 和 `/assets/images/cards/card6_base.webp`；关闭后回 PLAYING。
- `browser:side-smoke`：PASS；真实 train holding/complete、player collider、sprayer 短路径、smoke 离屏暂停/返回复用、shutdown 全清。
- `browser:chunk-smoke`：PASS。
- `browser:layer-smoke`：PASS。
- `browser:lifecycle-smoke`：PASS；shutdown Physics collider=0。
- `browser:camera-smoke`：PASS；仅显式 `camera-smoke` test-hook 执行调查序列。
- `browser:collision-smoke`：PASS；normal 与 `--bridge-test` 两种模式均通过。
- `browser:mobile-input-smoke`：PASS；desktop keyboard 与 mobile joystick 都通过。
- `browser:perf-baseline`：PASS；3 viewport × 3 zoom × 3 position 共 27 个 case，target/render 全匹配、无增量 chunk 请求，采样约 60fps。

Browser 脚本中的 Play/Retry 都使用 CDP 真实鼠标点击；Memo 6 和 sprayer 使用真实键盘移动。功能成功不依赖直接调用 App `play()/retry()` 或 teleport hook。

## 4. 自动验证

- 定向 App/content/assets：5 files / 25 tests，PASS。
- 定向 App/train：6 files / 35 tests，PASS。
- 定向 NPC/Route/FX/entry/lease：6 files / 33 tests，PASS。
- 全库：53 files / 298 tests，PASS。
- `npm run typecheck`：PASS。
- `npm run build`：PASS，74 modules；runtime asset check PASS。
- `npm run build:test-hooks`：PASS，74 modules；runtime asset check PASS。
- `npm run check:runtime`：PASS。
- 所有 `scripts/browser-*.mjs`、prepare/check asset scripts 的 `node --check`：PASS。
- `git diff --check`：PASS。
- production build 与 test-hooks build 严格串行；Browser gates 严格串行。

## 5. 范围审计

P4 commit 预期只包含：

- Main/接线：`game/`、`src/app/`、`index.html`、`package.json`；
- 必要 side connector：train/sprayer/smoke adapter；
- tests 与 browser scripts；
- runtime asset prepare/check/manifest；
- 本执行报告。

确认：

- `sample/` 无修改；
- `03-执行层/`、`task_plan.md`、`决策记录.md`、API 表无修改；
- 未复制 03/04/05 私有 worktree 实现；assembled baseline 中已有 owner 代码仅通过公开 contract 接线；
- 未修改 `CONTENT_REGISTRY` 正文或 P2 参数；
- 未新增远程请求；
- test-hooks bundle 未包含 fake train marker；production runtime 未使用 `TimedTrainArrivalAdapter`；
- 无新增通用 Entity 抽象。

`prepare-runtime-assets.mjs` 的 assembled baseline 原有 CRLF；本次只修改必要行且 `git diff --check` PASS，未做全文件格式重写。

## 6. 调试中发现并已解决

- 初版 Retry 在 Scene stop 后等待 Arcade removal queue，导致 120 个 collider 无下一帧可清；已改为先完成 side/world collider 清理并等待 pool 归零，再 stop Scene，并设置 2 秒明确失败上限。
- cleanup receipt 与 Phaser canvas DOM removal 可相差一帧；Smoke 现在等待 receipt、current generation=null 且 canvas=0 三项同时成立，不放宽残留要求。
- Memo 6 候选“west36/north7”会在进入 `<30px` 时先打开 modal并锁控制；Smoke 以真实 marker 触发为停止条件并核对实际距离，而不是强迫玩家越过锁定状态。
- sprayer 直下路径被真实 wall/track 阻挡；Smoke 使用公开 wall 网格确认的真实可走路径，从 east opening 绕行，未修改碰撞或 teleport。

## 7. 复用观察与未解决项

- 未发现第二个稳定 Entity 生命周期消费者；`Q-ENTITY-001` 继续 NO-GO。
- 本次只增加窄 `AppGameUiBridge`、train arrival/collider connector，没有提取未经 Human 确认的通用框架。
- production 约 111 秒六点相机序列的真实产品触发仍为 `UNKNOWN`；正常入口继续禁用，仅显式 camera Smoke 可执行。
- CV/Contact/Tech 仍为 P4 授权的既有最小 fallback，不冒充 03 已提供真实内容。
- 尚待 Human 在同一提交基线上完成桌面 `1920×1080` 与移动 `375×667` 视觉 Gate。
- 未 push、未创建 PR、未合并、未操作 Windows 正式仓库。
