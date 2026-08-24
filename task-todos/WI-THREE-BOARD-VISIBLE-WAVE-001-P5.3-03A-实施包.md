---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.3-03a-world-content-discovery
status: accepted-implementation-authorized
authorization: DEC-P5.3-03A-WORLD-CONTENT-DISCOVERY-001
owner: Main
updated: 2026-08-24
---

# P5.3 03-A 世界内容发现闭环实施包

## 目标

验证并在必要时修正玩家从校园内真实 marker 自然发现、打开和关闭已核验内容的路径；Memo6 是首个正常路径目标。

## 已接受范围

- 只用现有11个公开 marker 与严格 `<30px`、100ms 检查规则。
- 复现世界内提示、About/Projects/Memo1–6显示、手动关闭、离开再进入、物理 Visited 与地图同步。
- 桌面与移动端验证；只修已复现的提示/显示/关闭/同步缺陷。

## 禁止

不新增内容、CV/Contact/Tech、动态 marker、NPC/路线/FX/Entity；不改 C3、地图、相机、入口、30FPS、train、sample、远端、PR、merge 或 main。

## 验收

玩家正常移动至 Memo6 时可见非阻塞引导/内容入口；打开后内容正确、关闭恢复探索；离开并再进入可重新触发，Visited 与地图同步；无控制锁、DOM或浏览器错误残留。

## Human Gate

Human 回复 `ok`（2026-08-24）接受本包并授权实施；自动结果不替代最终视觉验收。
