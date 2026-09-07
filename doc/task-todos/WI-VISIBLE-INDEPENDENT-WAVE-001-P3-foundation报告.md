# WI-VISIBLE-INDEPENDENT-WAVE-001 / P2.1 Foundation 执行报告

- **工作项**：`WI-VISIBLE-INDEPENDENT-WAVE-001`
- **阶段**：P2.1 shared-content-bridge 期间的 04 foundation
- **状态**：`ready-for-main-shared-contract-sync`
- **实现基线**：`d4d848379489843984962d4616eb7cc9ab46b819`
- **授权输入**：P2.1 共享内容桥任务卡 `WI-VISIBLE-CONTENT-BRIDGE-001`（Main authority commit `0a5253933c94938917221721c9cfdafeee6c7dcf`）及 P2 实现包；本报告不复制或修改该共享契约。
- **现场规则**：保留进入本步时的 dirty 修改；没有 reset、clean、stash、覆盖、push 或修改权威文件。

## 1. 本步范围与结果

本步只收敛不依赖 rich sections 的 foundation：

- App 纯状态：`BOOT`、`LOADING`、`READY`、`ENTERING_GAME`、`PLAYING`、`MODAL_OPEN`、`ERROR`、`RETRYING`、`SHUTDOWN`；
- loader 只接收调用方提供的真实 `0..1` progress，单调更新，不在错误或 ready 中伪造 `100%`；
- Play/Retry 幂等；Retry 先清理旧 generation；晚到 progress/ready/entry 回调不能污染新 generation；
- App loading handle、cleanup、entry error 和 shutdown 均有边界；cleanup 失败会阻止启动下一代并保留 `ERROR`；
- DOM Loading/Play/Error-Retry 壳、真实进度文字/宽度、generation reset、响应式 `100dvh`/viewport 高度、visible focus ring、optional 图片 fallback；
- 现有 modal 继续以 `textContent` 渲染纯文本 body；新增与富内容无关的 focus 初始定位、Tab 边界、Escape 关闭契约和关闭/销毁后的焦点恢复；
- 所有生命周期和 DOM listener 都有幂等 destroy/cleanup。

明确未做：

- 未修改 `src/content/contract.ts`；
- 未新增、校验或渲染 `sections`；
- 未猜测图片 URL、正文、Slovak 内容或 future schema；
- 未接 `game/main.ts`、`game/CampusScene.ts`、`index.html`、`package.json`、Main resolver、Phaser、地图或 Entity；
- 未实现 rich DOM renderer；该部分等待 Main shared contract commit 同步后再继续。

## 2. 变更文件

### 允许范围内的实现

- `src/app/contract.ts`
  - 冻结 App 状态、错误类别、snapshot、真实 loader callbacks、loading handle 和 effects port。
- `src/app/runtime.ts`
  - 实现状态迁移、generation 隔离、单调真实进度、幂等 Play/Retry/modal/shutdown、cleanup-first Retry、stale callback 防护和 observer 异常隔离。
- `src/app/index.ts`
  - 导出 App runtime 与 contract 类型。
- `src/game-ui/app-shell.ts`
  - 注入式 DOM Loading/Play/Error-Retry shell；不依赖实际页面入口；保留 optional image 的布局空间并显示 fallback 文本；绑定并清理 Play/Retry/resize/image error listeners。
- `src/game-ui/dom-modal.ts`
  - 保留现有纯文本 body fallback；增加可选 keyboard/focus port、Escape、Tab focus boundary、close 初始 focus、focus ring 和 previous focus 恢复；未改变共享内容 payload 类型。
- `src/game-ui/index.ts`
  - 导出 foundation provider 和 accessibility 类型。

### 对应测试

- `tests/app/runtime.test.ts`：5 项 App 状态、progress、generation、cleanup、entry 和 shutdown 测试；
- `tests/game-ui/app-shell.test.ts`：3 项 DOM shell、generation reset、响应式、focus、Play/Retry、optional image fallback 和 destroy 测试；
- `tests/game-ui/dom-modal-accessibility.test.ts`：2 项 focus/Escape/Tab/恢复焦点测试；
- `tests/game-ui/dom-modal.test.ts`：既有 15 项 modal/body fallback/rollback/lifecycle 测试，fixture 仅补充新 optional style 类型。

## 3. 共享桥边界

- `src/content/contract.ts` 当前保持原样；已有 `GameUiContentPayload.body` 仍是唯一被 foundation 读取的 payload 字段。
- `DomModalGameUi` 的 Escape 使用现有 `UserCloseEvent` 的 close contract 交给上层；没有扩展 `UserCloseSource`，没有制造第二套内容事件协议。
- `app-shell` 只接收 `AppSnapshot` 和注入式 DOM targets；它不解析 payload、resolver 或内容 registry。
- 未来 `sections` 的 heading/paragraphs/image/links/tags 结构、协议安全校验和富渲染均不在本提交；等待 Main shared contract cherry-pick 后再单独实现。

## 4. 验证收据

| 命令 | 结果 |
|---|---|
| `npx vitest run tests/app/runtime.test.ts tests/game-ui/dom-modal.test.ts tests/game-ui/dom-modal-accessibility.test.ts tests/game-ui/app-shell.test.ts` | PASS：4 文件、25 项 |
| `npm run typecheck` | PASS：TypeScript strict，无错误 |
| `npm test` | PASS：45 文件、255 项 |
| `npm run build` | PASS：runtime asset check、Vite production build 均通过 |

全量测试中已有的 chunk/world 失败诊断 stderr 和 renderer stdout 均未导致测试失败；本步未引入新的未处理异常收据。

## 5. 范围与清理检查

- 允许实现/测试文件之外没有本步目标修改；
- `src/content/contract.ts` 未修改；
- `game/main.ts`、`game/CampusScene.ts`、`index.html`、`package.json`、`sample/` 未修改；
- 未创建 `src/entity/**`，没有提取 Entity/registry/base class；
- App stale generation、loader cancel、effects cleanup、DOM resize/click/error/keyboard listeners 均有测试覆盖或幂等清理路径；
- 最终 CRLF-aware diff、范围、禁止路径和状态一致性检查均已通过；parent/tree/clean 收据在提交后复核。

## 6. 尚未解决与下一步

- **已落盘、待最终提交**：App/UI foundation 和对应测试；自动测试与 typecheck/build 已通过。
- **等待 Main**：先接收并 cherry-pick 独立 shared contract commit，再进入 rich sections DOM renderer；本报告不擅自改变 contract。
- **仍未实现**：富内容 sections 安全渲染、resolver registry、Main 入口接线、真实页面视觉/浏览器验收。
- **交付停止点**：foundation commit 后停在等待 Main shared commit 同步；不继续 rich renderer，不 push。
