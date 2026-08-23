---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.1-batch-implement
status: active-r7-complete-regression
decision: DEC-P5.1-SYSTEMIC-REPAIR-001
candidate-baseline: 0fadf309963ba5d23c092ec049654791901f806e
integration-owner: Main
integration-worktree: .pi/worktrees/visible-product-integration
updated: 2026-08-23
---

# P5.1 方案 A：完整证据补救实施包

## 目标

按P5.1统一差异表的五个根因簇连续实施R1–R7；不再按Loading、火车、NPC等表面症状建立独立调查流程。每包完成后重放同一正常Human路径，全部完成后跑完整回归并进入一次Human整体验收。

## 固定输入

- candidate：`0fadf309` / tree `86c8f85f`。
- 审计与差异表：[P5.1系统审计](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1-系统审计.md)。
- Human选择：`完整证据补救（推荐）`。
- 原站公开证据、16张系统卡、API契约和当前代码合同继续有效。

## 全程硬边界

1. 六点约111秒序列不进入production；真实触发继续`UNKNOWN`。
2. 保留原站30FPS物理FACT；视觉平滑另设render层，不用擅改physics FPS掩盖问题。
3. `Q-LAYER-002/003`继续UNKNOWN；不得根据计数/空间吻合伪造particles3/69360消费者。
4. `sample/`只读；只使用已公开、仓库内可复核资源。
5. 不PR、不merge、不改`main`、不发起新的远端操作。
6. 自动状态、对象计数和test hooks不能替代正常production截图、screen bounds、可见时长和Human视觉Gate。
7. Main独占`CampusScene.ts`、`game/main.ts`、`index.html`、共享入口、权威状态和最终integration。

## 顺序与包

### R1 App / Loading / Play / Retry

**目标**：恢复公开证据支持的白色`#init-load`、仓库内`peter-oravec.gif`、进度/100%/揭示/Play层次；修正viewport owner，不再把loading section、Play或error拉成全屏高子节点。

**允许**：`index.html`、`src/game-ui/app-shell.ts`、必要`src/app/`、`game/main.ts`/Scene progress桥、运行资源准备脚本、对应tests与正常路径视觉审计脚本。

**检查**：慢网0→100单调且100%不冒充world ready；桌面1920×1080和移动375×667壳不裁切、不拉伸；Retry/Error保持generation清理；production无debug hook。

**R1收据（bounded verified）**：integration提交`ae2bf33`；53文件/298测试、typecheck、runtime assets、两build、production smoke/runtime-safety、test-hooks串行entry/app-retry/mobile-input、桌面/移动慢网截图与独立复核PASS。详见[R1收据](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1-R1-收据.md)。最终Human视觉Gate仍未通过。

### R2 入口原子性 / viewport / chunk reveal

**目标**：在揭示canvas前准备camera corridor所需chunk渲染并等待mutation idle；固定初始/resize/mobile viewport合同；Play过程中不暴露装配。

**允许**：`game/CampusScene.ts`、camera/chunk/world scheduler/adapter、对应tests和browser evidence。

**检查**：正常production 0/3/5/8/17秒截图无空洞/reveal；动态卸载仍工作，不以永久渲染25块替代；桌面/移动resize可重复。

**R2收据（bounded verified）**：integration提交`00c38dd`；READY/ENTERING/cameraStable保持25块走廊完整渲染，入口后恢复15块动态target；scheduler queue+active idle、Scale FIT刷新、850ms网格揭示、299测试与全browser门禁PASS。详见[R2收据](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1-R2-收据.md)。

### R3 视觉平滑 / 性能证据

**目标**：30Hz physics不变，玩家与相机显示层在60Hz render中连续；建立Human路径LoAF、input latency、位置连续性和mutation预算收据。

**允许**：player/camera Phaser adapter、必要只读快照、性能审计脚本与tests。

**检查**：碰撞/blocked/速度合同不变；位置不再每隔一帧静止后跳4.67px；Human硬件trace未取得时不伪造最终阈值。

**R3收据（bounded verified）**：integration提交`5d0d96d`；保持30Hz physics/body不变，render mirror与camera约97%帧连续，入口屏外块4.71秒收敛早于5.02秒PLAYING；production入口/移动无LoAF/long task，最大input handler延迟约4.4ms。详见[R3收据](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1-R3-收据.md)。

### R4 train / sprayer / smoke可见编排

**目标**：以存在→入口→screen bounds→连续可见时长→销毁五层合同保证可见结果；解决train与玩家/NPC遮挡、sprayer发现路径和smoke入口可见窗口。

**允许**：route/NPC/FX Phaser owners、入口编排、guide/content提示、对应tests和视觉证据。

**检查**：保持原站路线/scale/timing FACT；任何主动偏离标记为重构DECISION；正常production路径不用teleport即可验证。

**R4收据（bounded verified）**：integration提交`da68d08`；train/smoke真实进屏约10.62s/2.10s，train/player/sprayers层级可辨识；train离场与sprayer触发后按顺序发布无teleport环境路线；desktop/mobile production截图、304测试和完整browser门禁PASS。详见[R4收据](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1-R4-收据.md)。

### R5 factory roof / confirmed footsteps

**目标**：先收敛factory区域证据，再接300ms真实tween和对称恢复；实现有直接证据的footsteps视觉消费者。

**允许**：SYS-LAYER/ZONE边界、renderer、player位置消费者、footsteps owner及tests。

**检查**：其他roof不受影响；chunk移除/Retry/shutdown清理；368位置Oracle保持；particles3/69360不实现。

**R5收据（bounded verified）**：integration提交`6c8c66d`；factory矩形内两层roof以300ms Power2淡隐并对称恢复，concert保持alpha 1；368个`GID=69345` marker驱动14px间距、depth450、alpha0.6脚印。55文件/307测试、两build、完整browser门禁、desktop/mobile production正常键盘路线及独立复核PASS。详见[R5收据](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1-R5-收据.md)。

### R6 证据支持的HUD、导航、地图、对话和视觉密度

**目标**：把原站公开截图/HTML/Bundle已确认且Phase1范围内的持续chrome、导航、地图、对话及已证实动态消费者接入；证据不足项保留阻塞。

**允许**：对应系统卡已确认资源与接口；新资源必须来自当前公开镜像并纳入可复现流程。

**检查**：桌面/移动不遮挡控制、guide/modal；不把静态截图或marker冒充动态消费者；内容和输入控制合同不回归。

**R6收据（bounded verified）**：integration提交`32e7f74`；持续mini-map、big-map、11个真实位置点、动态玩家点和Visited已接入，About/Projects/Memo1–6复用现有内容链，CV/Contact/Tech保持禁用UNKNOWN。56文件/312测试、双build、完整browser门禁、1920×1080与375×667 production正常路径、性能及独立复核PASS。详见[R6收据](WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1-R6-收据.md)。

### R7 门禁重建与完整回归

**目标**：正常production路径成为主证据；test-hooks仅作定位辅助。

**必需路径**：冷启动慢网Loading→Play→0/3/5/8/17秒入口→真人Memo6→真人sprayer→factory roof进入/离开→移动性能→Retry/shutdown；桌面1920×1080与移动375×667。

**完整检查**：typecheck、全测试、production/test-hooks build、现有browser gates、新正常路径视觉/性能门禁、状态一致性、CRLF-aware diff、独立验证。全部通过后才进入Human整体验收。

## 停止条件

- 需要猜测私有资源、source map、未公开源码或UNKNOWN行为；
- 需要改变已接受产品目标、原站30FPS物理FACT或111秒入口边界；
- 同一根因包两轮无进展；
- 正常路径与自动门禁再次冲突且根因不在统一差异表；
- 出现安全、破坏性、远端或不可逆操作。
