---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
repair-package: P5.1-R7
status: auto-verified-human-rejected
implementation-commit: 1e24fd1e9e4cfa7e06ed8db0243b4f214364569c
implementation-tree: 657101daa0419409ea046a3716badd9d6fd57a61
base-commit: 32e7f74506085c9d6ba23d7fa518e4f4fb2f9ec1
verified-date: 2026-08-23
---

# P5.1 R7 完整production回归收据

## 1. 结论

R7自动回归已完成，当前只等待Human整体验收：

1. 新增单一正常production主路径：冷启动Loading→READY→Play→0/1/3/5/8/17秒入口→真人键盘Memo6→物理Visited big-map→真人键盘sprayer→factory roof进入/离开→camping footsteps。
2. 1920×1080桌面使用慢网模拟，同一session记录6个不同进度（0→100）和完整路径；375×667移动使用正常网络，同一session记录4个不同进度及相同完整路径。
3. 主路径不调用项目test hook、不teleport、不auto-trigger、不写产品状态；CDP只读取Phaser实例坐标决定何时释放真实键盘输入。最终debug/entry/collision/lifecycle/content hooks全部`undefined`。
4. production构建与smoke、runtime-safety、visible-entry、map、performance均PASS；test-hooks只作定位辅助，map/lifecycle/side/entry/chunk/layer/camera/collision/mobile/content/visual smoothing/Retry/roof-footsteps全部PASS。
5. Main已逐张检查桌面与移动Loading、entry smoke/train、Memo6、Visited、sprayer、roof和footsteps关键截图；自动/截图仍不能代替Human在实际设备上的整体视觉与卡顿判断。

## 2. 主路径覆盖

### Desktop 1920×1080（slow network）

- Loading：6个单调不同进度，截图含41%与后段进度，最终100% READY；
- 入口：0/1/3/5/8/17秒均无chunk空洞；1秒factory smoke可见，5秒train构图完整，17秒trackside guide已发布；
- 真人路线：2段到Memo6、4段到sprayer、3段回出生点、22段roof/camping路线；
- 可见结果：Memo6真实正文、Memo6 Visited、sprayer三人同屏、factory roof淡隐/恢复、连续脚印；
- console/exception/failed request/bad response均0。

### Mobile 375×667（normal network）

- Loading：4个单调不同进度，截图含92%，最终100% READY；
- 与desktop相同入口时点和真人键盘路线全部完成；
- guide、地图HUD、modal、sprayer、roof和footsteps在letterbox构图中不互相遮挡；
- console/exception/failed request/bad response均0。

## 3. 完整自动回归

- `npm test`：56 files / 312 tests PASS；
- typecheck、runtime assets、production/test-hooks两种build PASS；
- production：完整双视口主路径 + smoke/runtime-safety/visible-entry/map/performance PASS；
- test-hooks辅助：map/lifecycle/side/entry/chunk/layer/camera/collision/mobile-input/content/visual-smoothing/app-retry/roof-footsteps PASS；
- 性能：入口P95约16.8ms、4秒移动P95约16.7ms，>34ms帧、LoAF和long task均0，最大input handler延迟2.2ms；
- 根状态一致性PASS；独立verifier确认R7无teleport/项目hook/产品状态写入，双视口JSON与截图齐全，Human Gate未被代签。

R7脚本前两次运行只暴露门禁自身问题：最早DOM采样未容忍`body`尚未创建；sprayer返回路线少了先向东绕障碍。两项只修改脚本，最终以原超时和原产品构建完整重跑PASS。

证据目录：[`task-todos/evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R7/`](evidence/WI-THREE-BOARD-VISIBLE-WAVE-001-P5.1/R7/)

## 4. Human整体验收结果

2026-08-23，Human实际操作后明确选择“仍有问题”，并报告：

1. 垃圾堆附近存在一些不能通过的位置，需核对是否为碰撞Bug；
2. 开头一段会卡住一会；
3. 开头火车开走时玩家出现穿模。

因此R7只能保持**自动验证通过、Human验收失败**。candidate `1e24fd1`已冻结，父`systemic-flow`回到同一差异表的`audit`阶段；三项完成复现与根因聚类前不改产品代码。

## 5. 状态

- **accepted**：方案A及R1–R7边界已由`DEC-P5.1-SYSTEMIC-REPAIR-001`授权。
- **persisted**：R1–R7实现链、R7门禁、双视口收据/截图、性能与本收据已落盘。
- **verified**：R7自动、production主路径、test-hooks辅助和独立复核在WSL范围内PASS。
- **Human未通过**：实际设备整体验收报告垃圾堆不可通行、开头停顿、火车离场玩家穿模；工作项不关闭并回到systemic audit。
- **尚未解决**：Human硬件trace未取得；CV/Contact/Technologies完整内容、顶部全菜单/mobile quick-actions parity、particles3/69360、111秒序列及其他UNKNOWN不属于R1–R7自动关闭项。
