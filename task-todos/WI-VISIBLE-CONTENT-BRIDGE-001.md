---
work-item: WI-VISIBLE-CONTENT-BRIDGE-001
parent: WI-THREE-BOARD-VISIBLE-WAVE-001
status: active-main-contract-and-04-foundation
phase: P2.1-shared-content-bridge
authorization: DEC-VISIBLE-CONTENT-BRIDGE-001
authority-commit: 0a5253933c94938917221721c9cfdafeee6c7dcf
authority-tree: df621a66391323443142cc8c9f1b4a9036479c5f
main-branch: integration/visible-product-wave
content-blocked-commit: 4b36ad40ede8f0cff8428bb6ae7877a572a3db4f
updated: 2026-08-22
---

# P2.1 共享内容桥修正

## 1. 触发事实

03内容线在任何功能代码前正确停止：真实payload当前只存在于Main-owned `game/CampusContentResolver.ts`，共享`GameUiContentPayload`只有纯文本`body`，04-owned `src/game-ui/dom-modal.ts`也只用`textContent`渲染合并正文。03白名单内新增数据无法进入运行时或显示图片/链接。

- 阻塞收据：`4b36ad40ede8f0cff8428bb6ae7877a572a3db4f`，tree=`f49186a20c5e3e2a6ac8b1b3ce34cd30d74e7d8b`，parent=`0a5091db237ca7cd6be6a4b8ef24da6ac43abf97`，clean。
- 04已开始App/UI实现但未改`src/content/contract.ts`，当前dirty修改必须保留。
- Main尚未写代码且clean，适合作为共享契约owner。
- 05旁支无依赖，继续P3。

## 2. 接受的修正

采用兼容共享桥，不扩大03跨owner权限：

1. `GameUiContentPayload.body`继续保留为必需纯文本fallback。
2. 新增optional `sections`，每节只允许结构化`heading`、`paragraphs`、本地`image(src/alt/fallbackText)`、外部`links(label/href)`和`tags`；不允许任意HTML。
3. Main更新共享contract和resolver校验/深冻结；这一提交不含真实正文、不导入尚不存在的03 registry。
4. 03只在`src/content/**`实现evidence-backed registry，同时提供`body`和`sections`。
5. 04只在`src/game-ui/**`安全渲染：文本用`textContent`，链接只允许已验证协议并加`noopener noreferrer`，图片失败显示fallback但不丢正文。
6. Main最终把默认resolver切到03 registry并接线；不复制内容数据。

## 3. 提交与同步顺序

1. 根权威提交本P2.1修正；此前04/Main保持暂停，03保持blocked，05继续。
2. Main从clean分支先做**单独共享契约提交**，只改`src/content/contract.ts`、`game/CampusContentResolver.ts`和对应contract/resolver tests；typecheck、全测试、build必须PASS。
3. 04保留现有dirty修改，只完成与富内容无关且可独立验证的App/UI foundation并形成明确提交；禁止reset/clean/stash。
4. 用Main共享契约commit分别cherry-pick到03与04；两者必须进入clean可追溯基线。
5. 03继续payload实现；04继续rich DOM renderer；Main继续自身入口。三者完成后按既定04→03→05串行集成。

## 4. 停止条件

- Main共享提交混入入口、真实内容或04 DOM实现；
- 03修改Main/UI owner；04修改真实内容或resolver；
- 共享schema要求远程图片请求、任意HTML或猜测Slovak；
- 04现有dirty修改被覆盖/丢弃；
- 任一同步出现冲突而未由Main明确审查。

## 5. Gate

- **Human选择**：共享契约桥（推荐方案），2026-08-22。
- **当前状态**：accepted，待根authority clean提交。
- **完成证据**：Main共享commit/tree/clean + 03/04 cherry-pick收据 + 三侧定向测试、typecheck、全测试和build。
