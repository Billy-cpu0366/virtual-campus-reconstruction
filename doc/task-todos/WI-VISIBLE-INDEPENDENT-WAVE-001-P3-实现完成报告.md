# WI-VISIBLE-INDEPENDENT-WAVE-001 / P3 Rich Renderer 执行完成报告

- **工作项**：`WI-VISIBLE-INDEPENDENT-WAVE-001`
- **阶段**：P3 rich sections renderer
- **状态**：`ready-for-integration`
- **实现基线**：`4309399b68e8f18d8a3cea28d8323f1e388eff5a`（P2.1 shared contract 已同步，clean）
- **前置 foundation**：`db0fd9d1a83cd233db152ea49c0657cb2eb65a12`
- **共享桥收据**：Main shared `f243764f2523f1c833c598630df71b61e4f41625`；04 sync `4309399b...`
- **交付边界**：只修改 `src/game-ui/**`、`tests/game-ui/**` 和本报告；不 push。

## 1. 已实现

### 结构化 sections

- `sections` 存在时按输入顺序渲染 `section`、`h3`、`p`、`figure`、`ul`、`li` 和 `a` 节点；
- heading、paragraph、tag、link label、image alt/fallback 全部通过 `textContent`；
- 未使用 `innerHTML`、raw HTML 或字符串模板注入；
- `sections` 缺失时清理 rich children，继续以必需 `body` 纯文本 fallback 显示；
- sections 或嵌套字段不符合共享白名单时返回 `invalid-payload`，旧 modal identity、标题、正文和滚动位置保持不变。

### 图片与链接安全

- image `src` 只接受与共享 resolver 一致的本地路径规则；远程 scheme、协议相对路径和反斜杠路径被拒绝；
- 图片初始保留布局空间；加载失败后保留 image 节点，设置可见 `fallbackText`，不清除其他正文；
- 图片 error listener 捕获当前 `menuId + residenceId`，旧 identity、hide 后和 destroy 后的事件均不再修改当前 UI；
- link `href` 只接受共享契约验证的 `http:`/`https:` 且带 hostname 的值；节点使用 `textContent`，并设置 `target="_blank"`、`rel="noopener noreferrer"`；
- 提供注入式 `DomModalContentPort`，并在真实浏览器且 body 支持 `replaceChildren` 时使用 native `document` adapter；Node/无 adapter 时安全回退到 body 文本。

### 既有 modal 语义保持

- `menuId + residenceId` identity、single-active、same identity scroll 保留、不同 identity 原子替换保留；
- close button/backdrop、Escape、Tab focus boundary、visible focus ring、previous focus 恢复不变；
- rich image listener、resize、keyboard、close/backdrop 和 DOM teardown 均幂等清理；
- 未修改 App/Scene/Main/resolver/入口，也未新建 Entity 或第二套生命周期。

## 2. 允许文件变更

### 实现

- `src/game-ui/dom-modal.ts`
  - 加入 sections/image/link 白名单校验和 defensive copy；
  - 加入安全 DOM content node/port 类型与 native adapter；
  - 加入 rich sections 构造、纯文本写入、链接安全属性、图片失败 fallback、identity guard 和 listener cleanup；
  - 保留无 sections 的 body fallback 和原有原子 modal rollback。
- `src/game-ui/index.ts`
  - 导出 content adapter 类型与 `createDomModalContentPort`。

### 测试

- `tests/game-ui/dom-modal-rich-renderer.test.ts`
  - sections 顺序和节点类型；
  - heading/paragraph/tag/link/image 的 text/attribute 安全；
  - body fallback；
  - javascript link/remote image/unsafe sections 拒绝与旧 UI 保持；
  - 图片失败布局、正文、stale identity、hide/destroy listener teardown。
- 原有 `tests/game-ui/dom-modal.test.ts`、`dom-modal-accessibility.test.ts` 和 `app-shell.test.ts` 继续回归。

## 3. 验证收据

| 命令 | 结果 |
|---|---|
| `npx vitest run tests/app/runtime.test.ts tests/game-ui/app-shell.test.ts tests/game-ui/dom-modal.test.ts tests/game-ui/dom-modal-accessibility.test.ts tests/game-ui/dom-modal-rich-renderer.test.ts` | PASS：5 文件、28 项 |
| `npm run typecheck` | PASS |
| `npm test` | PASS：46 文件、262 项 |
| `npm run build` | PASS：runtime asset check、Vite production build |
| `rg 'innerHTML\|outerHTML\|insertAdjacentHTML\|raw HTML\|dangerouslySetInnerHTML' src/game-ui` | PASS：无匹配 |
| owner boundary scan | PASS：无 Main/content contract/package/sample/Entity 文件变更；测试仅按既有契约类型导入，未编辑共享契约 |

全量测试中的既有 chunk/world 诊断输出未产生失败；无新增未处理异常。

## 4. 未解决与集成边界

- **已落盘、已验证**：04-owned rich renderer、纯文本 fallback、图片/链接安全规则、identity/focus/teardown 测试。
- **待 Main integration**：Main 入口最终接线、03 registry 的真实 sections payload、浏览器真实 DOM rich content 视觉验收；本提交不复制内容数据、不修改 resolver。
- **尚未宣称**：完整原站作品内容 parity、图片网络可达性、浏览器截图视觉 Gate、最终 Main 全链路 Memo/Projects rich content Smoke。
- **Entity**：仍保持 NO-GO；本步没有第二个真实生命周期消费者，也未创建 `src/entity/**`。

交付停止在 `ready-for-integration`，等待 Main 按“04 → 03 → 05”顺序接收；不 push、不修改其他 owner 文件。
