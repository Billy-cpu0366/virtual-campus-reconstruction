---
workflow: PIPELINE-CONTENT-FOUNDATION-001
work-item: WI-PARALLEL-CONTENT-FOUNDATION-RECON-001
status: accepted-persisted-verified-blocked-p3
authorization: DEC-PARALLEL-CONTENT-FOUNDATION-PIPELINE-001
pipeline-commit: 6fdefb1
updated: 2026-08-21
---

# INTERACT / GAME-UI / ENTITY 三线一条龙执行流程

## 1. 授权与完成边界

Human 已明确授权：流程设计完成后直接连续执行三个窗口的调查、详细设计、自动派工、有界代码实现、Main 合并审查和本地验证，中间不再设置 Human Gate。

本授权终点：

```text
三线调查与设计完成
  + 证据支持的三线有界实现完成
  + Main 统一接线与本地 merge 完成
  + 自动检查和文档状态闭环完成
  + 最终结果报告
```

本授权不包含：GitHub push、PR、远端同步、Windows 正式仓库修改、破坏性操作、猜测未公开内容、开始页/航拍入口、完整 NPC/车辆/Route/FX 实现。

## 2. 核心原则

1. **三个窗口可以并行调查、设计和写各自拥有的代码。**
2. **Main 必须先冻结接口与文件所有权，才可自动派发实现包。**
3. **三个实现窗口不得修改共享接线文件。** `game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`、共享 browser smoke、API、系统卡、总账和动态状态归 Main。
4. **Main 最后串行合并与接线。** 并行窗口不自行互相 merge，也不 push。
5. **证据不足不强行写码。** 特别是 `SYS-ENTITY`：如果没有至少两个独立真实生命周期支撑稳定抽象，窗口 C 必须提交 no-code 收据或更窄的证据支持实现，不能预造通用 Entity 框架。
6. **原始报告不是权威。** 只有 Main 复核后写入系统卡/API/总账的内容才成为当前设计。
7. **不把自动检查冒充视觉验收。** 最终可标记 automated-verified；没有新的 Human 实时查看就不标 human-visual-verified。

## 3. 分支与窗口拓扑

### 阶段 D：调查与设计

| 窗口 | 分支 | worktree | 唯一产物 |
|---|---|---|---|
| A INTERACT | `recon/content-interact` | `.pi/worktrees/content-interact-recon` | A 调查＋七格设计报告 |
| B GAME-UI | `recon/game-ui` | `.pi/worktrees/game-ui-recon` | B 调查＋七格设计报告 |
| C ENTITY | `recon/entity-lifecycle` | `.pi/worktrees/entity-lifecycle-recon` | C 调查＋七格设计报告 |

共同调查基线：`42e445d`。最新流程文档在 Main；窗口通过绝对路径只读最新任务包，仍只在各分支提交自己的报告。

### 阶段 I：有界实现

Main 完成设计合并后，先按下述“统一 implementation baseline”步骤把相机入口修复运行时 `798eda6` 与仅文档提交合流，再创建三个新的实现分支/worktree。调查分支不直接演变成实现分支。

候选命名：

| 窗口 | 实现分支 | worktree | 默认文件所有权 |
|---|---|---|---|
| A CONTENT | `impl/content-interact-runtime` | `.pi/worktrees/content-interact-impl` | `src/zone/**`、`src/interact/**`、`tests/zone/**`、`tests/interact/**` |
| B GAME-UI | `impl/game-ui-runtime` | `.pi/worktrees/game-ui-impl` | `src/game-ui/**`、`tests/game-ui/**`、`game/DomGameUiRuntime.ts`、`game/game-ui.css` |
| C ENTITY | `impl/entity-runtime` | `.pi/worktrees/entity-impl` | 仅证据支持时：`src/entity/**`、`tests/entity/**`、`game/PhaserEntityRuntime.ts`；否则只交 no-code 报告 |

Main 在 P3 可进一步缩小路径，但不得扩大到另一窗口或 Main-owned 路径；未写入允许清单的文件默认禁止修改。

Main-owned 精确范围：

- `src/content/contract.ts`、`tests/content/contract.test.ts`；
- `game/CampusContentResolver.ts`、`game/GameplayControlLeaseRuntime.ts`；
- `game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`、`vite.config.ts`；
- `scripts/browser-*.mjs`（包括新增 content/game-ui/entity smoke）；
- `02-接口层/API契约表.md`、`03-执行层/**`、`task_plan.md`、`决策记录.md`、`工作日志.md`；
- 流程、实现任务包、integration 报告和最终关闭报告。

### 统一 implementation baseline

1. P1原始报告保留在各自不可变分支commit（A `1b29908`、B `6b5970a`、C `125691d`），作为审计来源，不要求进入runtime tree。Main cherry-pick报告曾被WSL safe allowlist拒绝，必须保持未绕过。
2. Main P2把已复核语义完整写入系统卡/API/总账/决策；记录 P0流程提交和P2权威设计提交的有序清单。P2提交不得包含runtime代码。
3. 从 runtime `798eda6` 创建本地分支/worktree：`integration/content-foundation` / `.pi/worktrees/content-foundation-integration`；design `1cade08` 作为外部immutable authority，不要求进入runtime tree。
4. Main在integration worktree实现并测试共享冻结边界：`src/content/contract.ts`、`tests/content/contract.test.ts`、`game/CampusContentResolver.ts`、`game/GameplayControlLeaseRuntime.ts`及其Main-owned测试。代码必须逐项对应design commit，不能修改旧runtime行为入口。
5. 任何既有 `src/`、`game/`、`public/`、`tests/` 或 `sample/` 非允许变化都必须中止baseline并诊断。
6. 运行CRLF-aware diff、typecheck、全测试和两种build；通过后记录 shared code baseline commit/tree/clean status，以及runtime/design双输入hash。
7. A/B实现分支必须从该同一 immutable code baseline创建；C保留no-code。任务包写明runtime/design/code三个hash，不能用浮动branch名。
8. P7由root权威文档记录所有code commit/tree收据；不为合并文档而绕过guard。

### 当前 P3 阻塞收据

- 尝试从 runtime `798eda6` 创建 `.pi/worktrees/content-foundation-integration` / `integration/content-foundation` 时，WSL guard 返回 `[ACCEPT EDITS] Command is not in the safe allowlist.`。
- 未创建分支/worktree，未修改runtime代码，未尝试copy/patch/同目录并发等替代绕过。
- 因 immutable shared code baseline 不存在，A/B实现包不得派发；C继续no-code。

### 阶段 M：Main integration

Main 在独立 `integration/content-foundation` worktree 中：

- 逐个核对并合并 A/B/C 允许提交；
- 独占修改 `CampusScene`、启动入口、DOM 接线、共享 Smoke、`package.json` 与权威文档；
- 内容闭环优先按 `Zone → Interact → Game UI → 一个证据充分的真实内容入口` 串行接线；
- Entity 只接入实际消费者；无消费者时保留已验证 CORE/no-code，不冒充 runtime integrated。

## 4. 一条龙阶段合同

| 阶段 | 状态值 | 输入 | 执行与输出 | 通过 Gate | 失败/停止 |
|---|---|---|---|---|---|
| P0 PIPELINE-FREEZE | `pipeline-freeze` | Human 一条龙授权、现有三窗口包、runtime `798eda6` | 固化本流程、动态状态、Todo、边界并创建本地文档提交 | state consistency、CRLF-aware diff、独立 workflow review 全部 PASS，工作树 clean | 任一合同缺字段或文档未提交，不进入 P1 |
| P1 THREE-WINDOW-DESIGN | `three-window-design` | P0 commit、共同调查基线 `42e445d`、三个窗口包 | A/B/C 各提交唯一调查＋七格设计报告和检查收据 | 文件范围、证据定位、四色标记、七格完整、diff check、clean commit | 越界/证据冲突退回对应窗口，最多两轮；不影响其他窗口 |
| P2 MAIN-DESIGN-SYNTHESIS | `main-design-synthesis` | 三份报告 commit、关键证据 | Main 裁决 A↔B、控制门、销毁语义、C抽象资格；写三卡/API/总账/决策/状态并提交 | consistency、链接、接口无冲突、复用观察、独立 design review PASS | 两轮仍不合格则缩小该线并保持 UNKNOWN/no-go |
| P3 AUTO-WORK-PACKAGING | `auto-work-packaging` | P2设计commit、runtime `798eda6`、文档commit清单 | 建 unified baseline；生成 A/B/C 精确实现包和 go/no-go 收据 | baseline hash/tree/clean；typecheck、全测试、两build；三包无共享写路径 | baseline 出现代码冲突或任一包边界不完整，不启动该实现窗 |
| P4 THREE-WINDOW-IMPLEMENTATION | `three-window-implementation` | 同一 immutable baseline、三个实现包 | A/B/C 各提交允许范围实现或 no-code 收据 | scope guard、typecheck、相关单测、diff check、clean commit | 超范围立即拒绝；本窗最多两轮自修；两轮无进展转 diagnostician |
| P5 MAIN-INTEGRATION | `main-integration` | A/B/C 有效实现commit、冻结接口、clean integration worktree | Main 按 A→B→C 合并并串行接共享文件；每线生成 merge/接线收据 | 每次 merge 无未决冲突、范围符合；局部测试 PASS；接线后 worktree clean | 共享文件被窗口修改则拒绝；既有回归失败则停止该候选，不削弱测试 |
| P6 SYSTEM-VERIFICATION | `system-verification` | P5完整 integration tree | 运行全量自动检查和新增行为 Smoke，生成验证收据/截图/日志 | typecheck、全测试、两build、既有browser gates、新增gates、console/network 0异常、diff/state PASS | 失败按归属回 P4 或 P5；两轮无进展诊断，不进入关闭 |
| P7 CLOSE | `pipeline-close` | P6 clean verified commit/tree | 回写代码位置、验证、差距、复用观察、UNKNOWN；创建本地integration/文档提交；输出最终收据 | 权威状态一致、提交范围清楚、工作树 clean、未push、独立 final review PASS | 任一状态/链接/收据缺失或残余dirty，保持 active，不宣称完成 |

阶段只能按 P0→P7 前进；失败只回到表中指定阶段。动态状态每次只写 `task_plan.md`，Todo 仅显示摘要。

## 5. 自动派工规则

Main 只有在 P2 通过后才能生成实现任务。

每个实现包必须包含：

- 目标和明确非目标；
- 设计提交与统一 runtime baseline；
- 允许读取和唯一允许写入路径；
- 冻结接口、错误语义、shutdown 语义；
- 单元测试与浏览器验收；
- 最多两轮本窗口自修；
- 超范围、冲突、证据不足时的停止条件；
- commit 标题、显式路径和 `Summary / Files / Checks` 正文。

### A 自动派工条件

- SYS-ZONE 已设计事实可直接引用；
- Interact 状态机、manual close、leave/re-enter 和控制门语义已冻结；
- 不要求 A 修改 DOM 或 `CampusScene`。

### B 自动派工条件

- UI port、关闭动作、可见状态和内容 payload 已由 Main 与 A 对账；
- DOM/Phaser 边界、移动端和销毁方式已冻结；
- 不要求 B 修改 `index.html`、`CampusScene` 或共享入口。

### C 自动派工条件

- 至少两个独立真实对象生命周期显示稳定部分与变化部分；或存在更窄、直接证据支持的实体能力；
- 如果不满足，C 不创建通用框架，提交 no-code 收据，Main 保持 SYS-ENTITY 的对应 UNKNOWN/设计差距。

## 6. 跨线冻结接口

P2 必须至少冻结语义，不必提前锁死实现类名：

```text
ZoneEvent
  menuId
  phase: enter | leave
  marker identity

InteractState
  closed | open | manually-closed-until-leave
  active menuId
  close reason

ContentResolverPort
  resolve(menuId) -> resolved(payload) | missing | invalid
  synchronous; no network/retry

GameUiPort
  show(menuId + residenceId + payload + presentation)
  hide(menuId + residenceId + reason)
  report user-close(menuId + residenceId + source)
  destroy

GameplayControlLease
  acquire(reason) -> success token | failure reason
  caller owns/releases only its opaque token
  Main shuts provider after consumers; shutdown invalidates all and keeps scene disabled

EntityLifecycle（仅若证据支持）
  create/register/update/disable/destroy ownership
  idempotent destroy
  no timer/listener/body leaks
```

最终字段由三份设计和 Main 对账确定；窗口不能单方面改冻结合同。

## 7. Main 合并顺序与冲突策略

1. 合并 A 的纯状态/Zone CORE，运行相关单测；
2. 合并 B 的 UI CORE/adapter，运行相关单测；
3. Main 接 A↔B、控制门和 scene shutdown；
4. 合并 C 的有效实现或登记 no-code；
5. Main 接实际 Entity 消费者；
6. 运行全量自动验证；
7. 回写权威状态和验证收据。

冲突策略：

- 窗口修改 Main-owned 文件：拒绝该提交，退回窗口重做；
- A/B 接口不一致：Main 以已冻结合同裁决，不在 merge 时临时双向兼容；
- 同类修复两轮无进展：调用 diagnostician 只诊断根因；
- 现有功能回归：先回退未合并候选，不修改/削弱既有 Smoke；
- 发现产品偏好未知：选择最小可逆方案并标记 DECISION；若无法安全可逆则停止该子线，其余线继续。

## 8. 失败与停止条件

整条流水线只有以下情况需要停止相关范围：

- 需要访问凭据、私有/未公开资源、source map 或扩大网络采集；
- 需要破坏性 Git、覆盖 dirty 工作、remote 操作或 Windows 宿主修改；
- 无法从 FACT/明确 DECISION 得出可逆实现；
- 共享接口经两轮仍无法一致；
- 自动检查出现无法归因的既有运行时错误；
- 文件范围守卫失败或提交包含未知修改。

默认只停止受影响窗口，不阻塞其他独立窗口。安全、破坏性、不可逆边界仍必须停下，不被“一条龙”授权绕过。

## 9. Todo 可见进度

Todo 保持一个 in-progress 总项，metadata 显示：

- 当前 P0–P7 阶段；
- A/B/C 各自状态；
- Main synthesis/integration 状态；
- implementation 是否已过 Gate；
- 当前提交/验证收据。

另保留一个被总项阻塞的 `Main合并三线设计` 后置任务；进入代码阶段时再创建实现和 integration 后置任务，避免提前制造虚假进度。

## 10. 完成定义

只有同时满足以下条件，才能报告本轮一条龙完成：

- A/B/C 调查设计均有提交或明确 no-code 结论；
- 三张权威系统卡和 API/总账/决策/状态一致；
- 所有 evidence-backed 实现均有允许范围提交；
- Main integration clean；
- 全量自动检查有可复核收据；
- 复用观察已检查，不提前抽象；
- 未解决项明确保持 UNKNOWN；
- 未 push、未宣称 Human visual verified。
