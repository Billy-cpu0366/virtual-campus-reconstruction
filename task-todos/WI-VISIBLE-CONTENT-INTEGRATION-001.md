---
work-item: WI-VISIBLE-CONTENT-INTEGRATION-001
program: PROGRAM-THREE-BOARD-VISIBLE-001
workstream: 03-content
phase: P4-selective-integration-audit
status: implementation-authorized-in-progress
authorization: DEC-CONTENT-ENGLISH-INTEGRATION-IMPLEMENT-001
root-branch: master
root-baseline-commit: 66b9fd6ba9cb37947a4bd169998a76c6ecef94b6
root-baseline-tree: f0138fd74b7a0fca9cb617acc7bf7c33f58e7d99
candidate-branch: integration/visible-product-wave
candidate-commit: 1d163939c6b57cc9dcdab9d3dd98dd5c2c7e187e
candidate-tree: e051be264b4ce152e238406da806191f82968abd
merge-base: 638d4c60347d6adf323e612b61595e73afb2bd05
human-gate: implementation-authorized
updated: 2026-08-28
---

# 已验收英文内容选择性集成

## 已接受路线

Human选择“选择性集成英文内容”，接受先建立独立集成工作项；不接受把`integration/visible-product-wave`整条历史分支直接合并到根`master`。

## 目标

从根`master`建立可审查的内容集成方案，只把已通过Human Gate的About、Projects、Memo1–6及其必要运行时依赖带入；保持NPC、相机、车辆、动效和其他未授权范围的边界。

## 当前阶段：审计完成，待实现授权

- **基线说明**：根工作树保留5个既有未跟踪文件（3张PNG、2个规则脚本），本任务不读取其内容、不修改、不纳入提交；它们不属于本次审计变更。

1. 对照根基线`0cbf995`和候选`1d16393`的提交、文件与运行时入口；
2. 划分内容最小依赖闭包、Main共享接线、候选中无关历史改动；
3. 检查是否存在必须一起移植的`CampusScene`、入口、构建资源、测试或运行时依赖；
4. 形成实现包：允许文件、禁止文件、移植顺序、验证命令、停止条件和剩余风险；
5. 审计完成后停在`implementation-authorization`，由Main复核并另行进入代码实现Gate。

## 审计结果（Main复核，2026-08-28）

- **Git边界**：根固定为`master@66b9fd6`/tree=`f0138fd`，候选为`integration/visible-product-wave@1d16393`/tree=`e051be2`，merge-base=`638d4c6`；候选工作树干净，根tracked/index干净，5个已登记未跟踪例外保持原样。
- **差异结论**：merge-base到候选的差异为159个文件、约38912行；直接比较当前根与候选为469个路径差异。候选整体混入NPC、车辆、相机、火车、烟雾、动效、应用入口和地图/UI历史改动，不能整条合并。
- **内容隔离结论**：`src/content/**`、`src/zone/**`、`src/interact/**`、`src/game-ui/dom-modal.ts`及其内容/区域/交互测试没有发现对NPC、车辆或动效的静态依赖。

### 实现包草案（尚未授权代码）

**A. 内容核心（允许移植）**

- `src/content/contract.ts`、`src/content/index.ts`、`src/content/registry.ts`；
- `src/zone/index.ts`、`src/zone/runtime.ts`；
- `src/interact/index.ts`、`src/interact/runtime.ts`；
- `src/game-ui/dom-modal.ts`；`src/game-ui/index.ts`暂不移植，因为它会通过`app-shell.ts`牵出未授权`src/app/**`；
- `game/CampusContentResolver.ts`、`game/GameplayControlLeaseRuntime.ts`、`game/AppGameUiBridge.ts`；
- 对应的`tests/content/**`、`tests/zone/runtime.test.ts`、`tests/interact/runtime.test.ts`、`tests/game-ui/dom-modal*.test.ts`。

**B. 已接受入口的必要地图接线（允许移植，但必须手工接入）**

- `game/PhaserCampusMapRuntime.ts`及`tests/game-ui/campus-map-runtime.test.ts`：该运行时只静态依赖内容合同，用于保留已验收的正常地图UI入口；
- 根`game/CampusScene.ts`：只手工接入11个marker中已启用的About、Projects、Memo1–6、100ms Zone检查、Interact/lease/receipt、地图选择和shutdown；不得复制候选整文件；
- 根`index.html`：只补地图HUD/marker和`content-ui-root`/modal所需DOM与样式；
- 根`package.json`及`scripts/browser-content-smoke.mjs`、必要的`browser-map-production.mjs`测试接线：只补内容验证命令，不带入候选其他Smoke套件。

**C. 公开资源闭包**

- `scripts/runtime-content-assets.json`及现有`prepare-runtime-assets.mjs`/`check-runtime-assets.mjs`的内容manifest接线；
- 10项已登记公开资源由现有sample镜像派生并验SHA-256，不手工猜路径、不修改`sample/`，生成的`public/assets/images/**`只按仓库现有跟踪/生成规则处理。

### 明确排除与UNKNOWN

- 排除`src/npc/**`、`src/route/**`、`src/fx/**`、`src/app/**`、相机/车辆/火车/Stop-AI/工厂/粒子运行时，以及`ProductEntry*`和无关Smoke/证据/历史任务卡；
- 排除`src/game-ui/app-shell.ts`及候选`src/game-ui/index.ts`，避免静态引入未授权应用层；
- `CampusScene.ts`的现有玩家控制、相机和动态地图结构与候选不同，必须由Main手工重接；若内容或地图接线被证明必须引入未授权owner，立即停止并把依赖标为UNKNOWN；
- 本包不授权Slovak、CV/Contact/Tech、完整顶部菜单、NPC、S2–S4、merge、push或PR。

### 实施顺序与门禁

1. Human接受本实现包后，在当前根基线建立干净的专用实现worktree；
2. 先移植A和测试，再接入C资源检查；
3. Main手工修改B中的`CampusScene.ts`、`index.html`、package/scripts，保持共享入口单一；
4. 运行内容/地图定向测试、typecheck、全量测试、build、资源hash、普通production content/map Smoke；
5. 重新进行Memo6正常Play真实步行和About/Projects/Memo1–5普通production Human Gate；
6. 通过后停在新的交付/集成Gate，不自动合并根`master`。

## 允许读取

- 根`master`当前跟踪文件及其Git历史；
- 候选worktree`.pi/worktrees/visible-product-integration`及其Git历史；
- 已落盘的内容任务卡、SYS-ZONE、SYS-INTERACT、SYS-GAME-UI、总账、`task_plan.md`和决定记录；
- 为确认依赖所需的公开证据索引，不修改任何证据。

## 禁止操作

- 审计阶段不得写入或修改根/候选的`src/`、`game/`、`public/`、`tests/`、`sample/`；
- 不得`merge`、`cherry-pick`、`reset`、`clean`、覆盖既有未跟踪文件或切换他人工作树；
- 不得把NPC、相机、车辆、动效、完整UI、Slovak、CV/Contact/Tech带入内容授权；
- 不得执行push、PR、远端同步或修改`main`。

## 输出与客观检查

- 输出一份短审计报告，列出文件路径、提交来源、最小依赖闭包和排除项；
- `git diff --stat/name-status`、候选与根工作树状态、merge-base和提交关系可复核；
- 明确所有不能在当前证据下安全选择的依赖，并转为UNKNOWN；
- 若发现内容无法与未授权owner隔离，立即停止并报告冲突，不扩大范围。

## 实施状态

Human已选择“按实现包执行”，批准写入内容核心、10项资源manifest、独立地图运行时和必要DOM/共享接线；实现将在专用worktree中进行，不整条合并候选。

## 下一道门

实现完成后必须通过定向/全量自动验证、资源hash、普通production content/map Smoke和新的Human视觉Gate。候选不会自动合并到根`master`；若实现中发现依赖越过未授权owner，立即停止并回报UNKNOWN。
