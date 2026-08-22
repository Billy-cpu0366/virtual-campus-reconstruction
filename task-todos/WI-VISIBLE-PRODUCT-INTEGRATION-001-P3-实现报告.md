---
work-item: WI-VISIBLE-PRODUCT-INTEGRATION-001
phase: P3-main-entry-implementation
status: ready-for-branch-integration
baseline-commit: f243764f2523f1c833c598630df71b61e4f41625
authorization: DEC-VISIBLE-WAVE-P2-001
shared-bridge: f243764f2523f1c833c598630df71b61e4f41625
branch: integration/visible-product-wave
updated: 2026-08-22
---

# Main 产品入口 P3 实现报告

## 1. 结论

Main 自有入口已在 `f243764f` clean 基线上完成有界实现，当前状态为 `ready-for-branch-integration`：

- 真实 Phaser loader progress → 首批 world/chunk apply 完成 → READY → Play；
- Play 幂等，Play 前玩家隐藏且控制禁用；
- Play 后相机从公开锚点 `(944,928)` 以 `3000ms Power2` 落到玩家；
- Main 同时启动 05 可替换的 train 窄端口 fake；`5000ms arrived` 前不释放统一 entry lease；
- playable 后发布非阻塞 Memo 6 目标，只给 `menuId=memo6 / west36 / north7`，不传送、不自动打开、不写 visited；
- Phaser 逻辑世界固定 `480×270`，使用 FIT/CSS 缩放；终态 zoom=1、玩家居中、硬跟随、offset/deadzone=0、roundPixels=true；
- production 不调用六点约 111 秒序列；既有 `camera-smoke` 仍只在显式 test-hooks 中可用。

本提交没有接收、复制或实现 03 真实内容 registry、04 完整 App/富内容 renderer、05 火车 Sprite/NPC/Route/FX。真实 train 仍待 05 分支接入；当前 fake 只按冻结接口在 5000ms 返回 arrived，不能冒充可见火车成果。

## 2. Main 所有权内实现

### 入口与协调

- `game/ProductEntryRuntime.ts`
  - 只协调 camera stable 与 train arrived 两个收据；
  - 首次 Play acquire `entry-transition` lease；
  - 两个收据都到后才 release；
  - 任一端口失败时保持控制锁定并清理端口；
  - shutdown 阻断晚到收据；
  - guide 失败不阻断 playable。
- `game/ProductEntryAdapters.ts`
  - `ProductEntryCameraAdapter` 显式传入单点序列与 `returnDuration=3000`，不会走默认 `CAMERA_SEQUENCE`；
  - `TimedTrainArrivalAdapter` 是可替换的 5000ms arrival fake，拥有 timer 取消与幂等 shutdown。
- `src/content/contract.ts`
  - 只给既有 lease reason 增加兼容值 `entry-transition`；未改 P2.1 富内容 schema。

### Scene 与页面

- `game/CampusScene.ts`
  - loader progress、required load failure、首批动态 world ready 回调；
  - READY 前不发布 Play；
  - Play 前玩家隐藏/禁用控制；
  - Main entry runtime、相机 adapter、train fake、Memo 6 guide port 接线；
  - 入口相机 viewport 继续交给既有 SYS-CHUNK 唯一目标公式；
  - production 与显式 camera test-hook 路径保持分离；
  - shutdown 清 entry/camera/train/lease，既有 World/Content 生命周期顺序保留。
- `game/main.ts`、`index.html`
  - Loading/Ready/Play/Error 最小入口壳；
  - `480×270` Phaser logical viewport + FIT；
  - 非阻塞 Memo 6 guide slot；
  - `__campusEntryTest` 仅 DEV/test-hooks 暴露，production 不存在。
- `game/phaser.d.ts`
  - 只补本实现实际消费的 Sprite `setVisible` 编译面。

### 测试与 Smoke

- 新增 `tests/app/product-entry-runtime.test.ts`、`tests/app/product-entry-adapters.test.ts`；
- 新增 `scripts/browser-entry-smoke.mjs`；
- 既有 test-hooks Smoke 使用显式 `entry-autoplay=1` 真实触发 Play，不让 production 自动进入；
- 固定逻辑视口下，mobile Smoke 将 logical joystick 坐标换算到 canvas CSS client 坐标；
- chunk Smoke 同时支持正常动态新增与入口锚点已合法预载全部 25 块两种收据，仍检查去重、失败和目标状态；
- runtime safety 新增 production `__campusEntryTest === undefined` 检查。

## 3. 自动验证收据

### TypeScript / Vitest / Build

- 定向：6 个测试文件、34 项 PASS；
- `npm run typecheck`：PASS；
- `npm test`：44 个测试文件、259 项 PASS；
- `npm run build`：PASS，runtime asset check PASS，60 modules；
- `npm run build:test-hooks`：PASS，runtime asset check PASS，60 modules；
- 全部 `scripts/browser-*.mjs`：`node --check` PASS。

### Browser gates

Test-hooks build（隔离 preview `4213`，CDP `9223`）：

| Gate | 结果 | 关键收据 |
|---|---|---|
| entry | PASS | Loading/Ready 可观察；camera stable `3054ms`；playable `5025ms`；3秒时仍locked；5秒后lease=0/control enabled；480×270；Memo6 guide；tour runtime=null |
| chunk | PASS | 入口锚点按唯一公式预载25块；移动后无重复请求；failed=[] |
| layer | PASS | visual/marker/raw particles/roof 状态有效 |
| lifecycle | PASS | shutdown 后 debug/lifecycle/collision hooks 清除 |
| camera | PASS | 普通入口无tour；显式 `camera-smoke` 才运行缩时六点能力并恢复控制 |
| content | PASS | entry playable 后既有 modal lease、关闭/离开/重入和移动端行为通过 |
| mobile-input | PASS | desktop隐藏摇杆；mobile单指、死区、east移动、键盘恢复通过 |
| collision | PASS | 玩家移动、blocked、碰撞层和body合同通过 |

Production build（隔离 preview `4214`，CDP `9223`）：

- `browser:smoke`：PASS；canvas backing size=`480×270`，资源/异常/失败请求为0；
- `browser:runtime-safety-smoke`：PASS；`__campusDebug`、`__campusCollisionTest`、`__campusEntryTest` 全部 `undefined`，诊断为空。

初次同时运行 production/test-hooks build 曾因两个 Vite 进程竞争清理同一 `dist/` 出现 `ENOTEMPTY`；改为协议要求的串行构建后两者均 PASS。首次并行 browser gates 因 25 块渲染资源竞争触发旧固定等待超时；改为状态轮询并串行复跑后全部 PASS。两项均不是运行时功能失败。

## 4. 边界与待集成项

- 03：未导入真实 registry，`CAMPUS_CONTENT_PAYLOADS` 真实内容未改；
- 04：未导入 App generation/Retry 或 rich DOM renderer；当前 Main 页面只提供可替换的最小入口壳；
- 05：未导入真实 train/NPC/Route/FX；当前 train adapter 无 Sprite、碰撞带、blocking zone、depart timer 或视觉成果；
- production 六点约111秒序列仍未调用，真实产品触发继续为 `UNKNOWN`；
- 未修改 `sample/`，未增加资源路径，未猜 Slovak/内容/NPC/FX；
- 未发现第二个稳定 Entity 生命周期消费者，`Q-ENTITY-001` 继续 NO-GO，未提取通用框架；
- 未 merge 03/04/05，未 push、PR 或同步 Windows。

## 5. 交接

当前 Main 提交完成后应停止在 `ready-for-branch-integration`。后续只能按已冻结顺序由 Main 审查并串行接收 04 → 03 → 05；接入真实 05 route 时替换 `TimedTrainArrivalAdapter`，不得保留第二套 train 生命周期。最终全线集成后仍需同基线桌面 `1920×1080` 与移动 `375×667` Human 视觉 Gate。
