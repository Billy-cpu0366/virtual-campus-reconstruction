---
work-item: WI-VISIBLE-PRODUCT-INTEGRATION-001
phase: P5-human-visual-gate
status: failed-human-visual
candidate-commit: 0fadf309963ba5d23c092ec049654791901f806e
candidate-tree: 86c8f85f1f59106399d1a2f2040851b100eb2f5a
automated-gate: passed
human-gate: failed
updated: 2026-08-22
---

# P5 Human视觉验收

## 自动门禁收据

- Main candidate：`0fadf309963ba5d23c092ec049654791901f806e`，tree=`86c8f85f1f59106399d1a2f2040851b100eb2f5a`，parent=`532d8095`，clean。
- 53 files / 298 tests、typecheck、production/test-hooks串行build PASS。
- production + test-hooks全部browser gates与27-case perf baseline PASS。
- 实测camera=`3067ms`、真实train holding/playable=`5035ms`、完整route=`17081ms`；Retry/shutdown collider=0；production hooks未暴露。
- 以上不替代Human视觉结论。

## 桌面 1920×1080

1. 刷新后肉眼看到Loading进度，再看到Play；不能直接跳进可玩世界。
2. 点击Play：约3秒镜头落玩家；火车可见并在约5秒到站前保持控制锁定，到站后才能移动。
3. 画面保持480×270像素构图并清晰缩放；不因桌面变宽展示超宽世界。
4. 能看到火车、factory smoke；按引导真人移动到Memo 6，弹窗显示真实英文正文和卡图，关闭后恢复控制。
5. 沿可走路线接近sprayer，能看到四人喷洒/级联逃跑；火车完整离场无残影/阻挡。
6. Error/Retry入口需至少确认按钮视觉、focus和页面没有重叠；自动门禁已验证真实失败generation清理。

## 移动 375×667

1. Chrome DevTools启用375×667触摸设备模拟并刷新。
2. Loading/Play/Error壳不被裁切；点击Play后构图仍为480×270逻辑世界的适配显示。
3. 摇杆可见、可操作，不遮挡引导或modal；键盘/触摸不会同时失控。
4. Memo modal可滚动、关闭按钮可见，图片/链接/正文不溢出；关闭后焦点/控制恢复。

## Human实际结果（FAIL）

Human在production candidate实际观看后指出：

1. Loading与原站明显不同；原站有清楚的1→100%过程动画，当前Loading视觉混乱且没有对应动画。
2. 实际运行明显卡顿、帧率/帧节奏不对；现有自动性能PASS不能代表肉眼手感。
3. 初始地图分块应在1→100% Loading阶段完成；当前进入时能看到分块装配，严重影响观感。

对照确认：原站公开HTML/CSS确有白色全屏`#init-load`、`peter-oravec.gif`、进度条/整数百分比；loader 100%后另有网格揭示，再显示Play。当前实现为深色半透明壳且无该GIF/揭示。现有27-case测试主要静止采样rAF，没有覆盖真实移动frame pacing、位置跳步和long frame，因此P5不能通过。

本轮只进入P5.1整体诊断；未接受修正设计前不写功能代码，不用局部CSS遮掩启动时序问题。

## 通过条件

Human明确回复“通过/OK/可以”并指出桌面与移动均可接受后，才允许进入P6文档关闭和最终integration收据；任何明显看不见Loading/相机变化/内容/NPC/route/FX，或存在遮挡、残影、不可操作，都判FAIL并返回有界修复。

## 固定边界

- production约111秒序列触发仍UNKNOWN且禁用。
- 不push、不PR、不同步Windows；Human视觉通过也只授权本地关闭文档，远端仍需独立授权。
