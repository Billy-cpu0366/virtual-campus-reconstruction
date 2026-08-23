---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
repair-package: P5.1-R5
status: bounded-verified
implementation-commit: 6c8c66d6961d1de4e86a12a969b07ddf9f955ac9
implementation-tree: c8b0cde3bfa7bee20f7bd8248f9edc26b4ecaa35
base-commit: da68d0887995b9cfff9749dcf7ad179702afcb95
verified-date: 2026-08-23
---

# P5.1 R5 factory roof / confirmed footsteps 收据

## 1. 结论

R5已在integration分支完成并有界验证：

1. 玩家进入factory矩形`x=112..640, y=736..1152`时，只把factory两层roof用`300ms Power2`淡到alpha 0；离开后对称恢复到1，concert roof保持1。
2. 新增Scene-owned脚印消费者，只读取当前已加载chunk中`footsteps / GID 69345` marker；外部grid继续只作368位置Oracle，不建立第二份运行状态。
3. 脚印保持直接证据参数：间距14px、depth 450、alpha 0.6、可见10秒后1秒淡出；95个Sprite池在chunk移除和Scene shutdown时回收/销毁。
4. 正常production通过22段纯键盘路线进入、离开factory并到达camping脚印区域；桌面与390×844移动视口均未暴露test hooks，roof三态和连续脚印截图已由Main逐张检查。
5. `particles3/69360`没有实现或补猜；现有particles3 diagnostics继续保留。

自动和截图证据只证明R5有界合同；最终仍由R1–R7后的Human整体视觉Gate签字。

## 2. FACT与DECISION边界

### 保持的FACT

- factory触发矩形：`x=112..640, y=736..1152`；
- factory roof进入/离开均为300ms，alpha `1→0→1`，concert不受影响；
- footsteps grid与tilelayer的368个`GID=69345`位置一致；
- 运行脚印depth 450、alpha 0.6、间距14px、10秒可见后1秒淡出、pool 95；
- `particles3/69360`消费者继续UNKNOWN。

### R5主动DECISION

- 由`CampusScene`直接消费玩家位置并驱动factory roof状态，不引入新的通用Zone或Entity抽象；
- `PhaserFootstepRuntime`消费chunk-owned marker，并在控制可用、真实移动、非teleport、玩家depth低于1000时生成脚印；
- production browser证据通过CDP查询Phaser实例坐标，仅用于决定何时释放键盘，不向页面增加window hook，也不代替截图验收。

## 3. 量化证据

- factory roof：`visible → faded(alpha 0) → visible(alpha 1)`；concert全程alpha 1；
- marker Oracle：368；脚印截图时active count至少5，全部depth 450 / alpha 0.6；
- lifecycle：footstep active count=0、factory roof tween inactive，且train/sprayer/smoke既有owner同样清零；
- production性能：入口P95约16.8ms、4秒移动P95约16.7ms，>34ms帧、LoAF和long task均为0，最大input handler延迟1ms；
- production hooks：debug/collision/lifecycle均为`undefined`。

## 4. 验证

- `npm test`：55 files / 307 tests PASS；
- typecheck、runtime assets、production/test-hooks两种build PASS；
- R5专属test-hooks正常键盘路线、desktop/mobile production正常键盘路线PASS；
- lifecycle、side、entry、chunk、layer、camera、collision、mobile-input、content、visual-smoothing、app-retry PASS；
- production smoke、runtime-safety、visible-entry、performance PASS；
- 独立verifier确认roof/footsteps FACT、lifecycle、production hook隔离、`renderer→worldRenderer`改名及目标测试均PASS。

一次并行加载双视口时desktop在30秒READY超时；保持原超时、改为单独重放后PASS，不计为产品通过证据。最终路线停止线从同一marker格的`y=1832`提前到`y=1824`，避免50ms采样落入相邻碰撞边缘；双视口和test-hooks均已重验。

证据目录：[`task-todos/evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R5/`](evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R5/)

## 5. 状态

- **accepted**：方案A及R5边界已由`DEC-P5.1-SYSTEMIC-REPAIR-001`授权。
- **persisted**：实现提交、自动门禁、双视口截图、哈希与本收据已落盘。
- **verified**：R5在WSL本机范围内bounded verified。
- **尚未解决**：R6证据支持的HUD/导航/地图/对话/视觉密度、R7完整回归、Human硬件trace与最终Human整体视觉；父流程继续R6。
