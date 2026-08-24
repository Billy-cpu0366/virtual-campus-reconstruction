---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.2-04a-map-navigation
status: accepted-implementation-authorized
authorization: DEC-P5.2-04A-MAP-NAVIGATION-001
owner: Main
updated: 2026-08-24
---

# P5.2 04-A 地图导航与内容发现闭环实施包

## 目标

把已接入的 SYS-GAME-UI 地图能力收敛为一个可见、可验收的玩家闭环：持续小地图 → 打开大地图 → 玩家位置和内容点 → 选择已核验内容 → 关闭并回到探索。

## 已接受范围

1. 在 1920×1080 与 375×667 检查并修正小地图位置、尺寸和控制区避让。
2. 小地图能打开/关闭大地图；大地图显示玩家点、可用内容点与本轮 Visited 状态。
3. 只允许由大地图打开已核验的 About、Projects、Memo 1–6；内容 modal 与大地图互斥。
4. 内容关闭后恢复地图/探索，控制租约和 UI 状态无残留。
5. 不新增内容或 UI 框架，只修现有 `PhaserCampusMapRuntime`、内容 modal 和必要样式/测试/浏览器收据。

## 明确不做

- 顶部全菜单、移动 quick-actions、CV/Contact/Tech、新内容。
- NPC、路线、FX、SYS-ENTITY、地图/相机/入口/Loading 与 C3 已验收行为。
- `sample/`、111 秒序列、30FPS 物理、train 路线/scale/timing、远端、PR、merge、main。

## 实施步骤

1. 以 production 和 test-hooks 重放既有 map/content 路径，登记桌面/移动端实际差异。
2. 仅在差异证据支持时修正地图 HUD、big-map、modal 互斥、visited 或控制租约。
3. 跑 typecheck、受影响测试、全量测试、两种 build、地图/内容 browser smoke 及 production 双视口路径。
4. 回写 SYS-GAME-UI、总账、任务状态和收据；停在 Human 视觉验收。

## 验收

- 小地图在桌面可读，在 375×667 不遮挡右下摇杆。
- 大地图能开关，玩家点随移动更新；可用点可进入已授权内容，未授权点不可打开。
- 地图与内容 modal 不同时可见；关闭后无残留遮罩、监听或控制锁。
- 页面 console/pageerror/network error 为零；C3 入口、地图移动、factory/concert 屋顶不回归。

## Human Gate

Human 回复 `ok。开始吧`（2026-08-24），接受本包并授权实现。自动检查和 WSL 浏览器结果不替代最终视觉验收。
