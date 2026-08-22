---
work-item: WI-VISIBLE-PRODUCT-INTEGRATION-001
phase: P5.1-loading-startup-performance-diagnosis
status: active-read-only-diagnosis
trigger: human-visual-fail
authorization: diagnosis-only
candidate: 0fadf309963ba5d23c092ec049654791901f806e
updated: 2026-08-22
---

# P5.1 Loading、启动装配与卡顿整体诊断

## Human失败输入

1. 原站有清楚的1→100% Loading过程动画，当前Loading混乱且明显不一样。
2. 实际画面/移动明显卡顿，肉眼帧节奏不对。
3. 初始地图分块必须在Loading阶段加载好，进入后看到分块装配严重影响观感。

## 已确认事实

### 原站Loading

- `sample/original-public-build/mirror/index.html`直接证明白色全屏`#init-load`、`assets/images/peter-oravec.gif`、进度条、整数百分比、logo/Play壳。
- Phaser loader `0..1`文件队列比例是百分比唯一事实源；不能按时间或字节猜。
- loader 100%后仍有独立scene-ready阶段：约1秒状态等待、白色网格分批揭示、最后显示Play。百分比、世界ready和视觉reveal不能合并。
- GIF与logo均有成功公开镜像记录；允许候选使用必须核对hash并走runtime asset pipeline。

### 当前实现

- `index.html`使用深色半透明`#app-shell/#app-panel`，没有原站GIF、白底或网格揭示；canvas可能从遮罩后透出。
- `CampusScene.initializeDynamicWorld()`在`onReady`前等待当前coordinator target完成，但缺少“所有初始绘制提交完成并至少经过稳定渲染帧”的显式reveal receipt。
- entry camera锚点`(944,928)`加当前`camera visible +1`公式可把初始target扩展到25 chunks；每chunk按layer创建TilemapLayer，可能同时造成装配可见性和运行时layer成本。
- 原站物理30FPS fixed step是FACT；当前不能仅因Human看到卡顿就直接改60FPS，否则会把未经比较的重构决定冒充修复。
- 现有27-case perf baseline在静止位置采样1500ms rAF；它不测真实键盘移动时的rAF delta分布、long frame、玩家位置重复/跳步、camera scroll步进或每帧render layer成本，因此门禁不足。

## 必须回答的诊断问题

1. Human看到的“分块加载”发生在Loading半透明透出、Play后首帧flush，还是动态target后续apply？需时间戳/录像/状态联合证明。
2. 初始25 chunk的网络fetch、cache、world apply、TilemapLayer创建和首个稳定render分别何时完成？READY当前缺哪个receipt？
3. 真实移动卡顿的主要来源是30Hz物理位置步进、per-chunk TilemapLayer数量、chunk mutation、DOM/粒子、软件/硬件渲染还是组合？
4. 在保持“所有初始chunk于Loading阶段获取”的前提下，是否应分离“prefetch全部数据”与“只render入口路径/视口+margin”，以减少常驻layer对象？
5. 原站Loading视觉应复刻到什么精度：白底/GIF/黑条/%/网格揭示均有FACT；具体网格格数/时序需继续从Bundle精确提取，不猜。

## 诊断证据与新门禁

- 录制从首次HTML绘制→loader progress→world apply→stable render→grid reveal→Play的时间线；canvas在reveal前必须完全不可见。
- 正常键盘移动至少5秒，采样每个rAF delta、p50/p95/p99/max、>25ms/>50ms long frames、玩家/camera逐帧位置、重复帧比例和最大位置跳步。
- 记录loaded/cached/applied/rendered chunk集合、TilemapLayer数量、mutation耗时和首次稳定帧；不能只记录最终集合。
- 在1920×1080桌面实际硬件与WSL自动环境分别记录，明确环境差异；自动阈值不能覆盖Human实感。
- 形成至少两个修正方案，比较原站证据一致性、首屏观感、运行成本和改动风险；Human接受后才进入P5.2。

## 当前禁止

- 不先改CSS、固定延时、假进度、physics FPS、chunk公式或layer架构；
- 不把Loading遮罩变不透明后就宣称解决chunk时序；
- 不用静态rAF均值反驳Human；
- 不关闭任务、不push/PR/同步Windows。
