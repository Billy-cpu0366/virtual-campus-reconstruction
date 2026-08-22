---
task-id: WI-CONTENT-FOUNDATION-IMPL-B-001
pipeline: PIPELINE-CONTENT-FOUNDATION-001
line: B-SYS-GAME-UI
status: ready
runtime-base: 798eda67aca9f7e7e1a4fb7f2c76290c83483dcd
design-base: 1cade08
code-base: d2e73b50c6cdb68096c188b585822def853e8722
branch: impl/content-game-ui
worktree: .pi/worktrees/content-game-ui-impl
updated: 2026-08-22
---

# B线实现包：SYS-GAME-UI DOM modal CORE

## 目标

实现可由Main接线的generic DOM modal `GameUiPort`：原子show/replace、精确identity、标准/memo backdrop、滚动和移动端resize、用户关闭事件与幂等destroy。只负责呈现，不接管业务状态。

## 权威输入

- root design commit `1cade08` 的 SYS-GAME-UI、SYS-INTERACT和API契约；
- shared code baseline `d2e73b50` 的 `src/content/contract.ts`；
- 不修改shared contract；发现歧义立即停止。

## 唯一允许文件

- `src/game-ui/dom-modal.ts`
- `src/game-ui/index.ts`
- `tests/game-ui/dom-modal.test.ts`

禁止修改HTML/scene/入口、A线文件、shared contract、resolver、lease provider、配置、文档、sample和现有runtime。

## 冻结行为

- 实现shared `GameUiPort`；所有show/hide/user-close identity均为 `menuId+residenceId`。
- DOM元素由构造参数注入；不得假定Angular component存在，不得在模块加载时查询全局DOM。
- show先完整验证targets、residence、payload menu一致、title/body和presentation，再构建安全text节点；验证/构建失败保持旧DOM和identity不变。
- hidden→visible归零modal scroll；相同identity already-visible保留scroll；不同identity原子replace并归零scroll。
- DOM层级：canvas wrapper不归本runtime；backdrop 9998、modal 9999；modal独立滚动；hidden UI不接pointer。
- standard (`backdrop=none`) 不显示global backdrop；memo (`global`) 显示。只有visible global backdrop点击可发事件。
- close-button/backdrop从当前state发一次带identity的UserCloseEvent；programmatic hide不发；stale hide返回target-mismatch且不改变当前UI。
- 关闭后根节点hidden、pointer禁用、backdrop隐藏；内容可以清理，但不得影响后续show。
- resize：desktop modal max-height=90 viewport height，`<=767px`为70；viewport变化后更新。尺寸来源可注入，listener必须在destroy移除。
- destroy幂等：移除close/backdrop/resize listeners、隐藏DOM、清订阅/state；之后show/hide返回destroyed。
- 不实现Escape/focus trap、网络图片fallback、业务manual-close/visited/control lease。

## 必须测试

- missing target/invalid payload/空residence无DOM突变；安全text写入。
- first show、same identity、replace、replace失败保留旧内容和scroll。
- standard/memo backdrop、层级/pointer、close和backdrop事件、programmatic hide无事件、stale hide。
- desktop/mobile阈值与resize listener；scroll reset/preserve。
- unsubscribe、destroy listeners、重复destroy、destroy后show/hide。
- 测试使用项目现有能力或最小fake DOM，不新增依赖、不改配置。

## Gate

- `npm run typecheck`
- `npm test -- --run`
- `npm run build`
- `npm run build:test-hooks`
- `git -c core.whitespace=cr-at-eol diff --check`
- diff仅允许3文件；提交正文含Summary/Files/Checks；返回commit/tree/测试数/clean status。
