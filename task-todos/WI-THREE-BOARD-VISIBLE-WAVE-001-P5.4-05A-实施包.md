---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.4-05a-train-route
status: accepted-multi-collider-implementation
authorization: DEC-P5.4-05A-TRAIN-ROUTE-001
owner: Main
updated: 2026-08-24
---

# P5.4 05-A 火车完整路线实施包

## 目标

验证并只在必要时修正 crowdTrain 的完整可见路径：5秒进场、到站、约3秒停留、9秒离场、碰撞带随动及所有运行对象清理。

## 已接受范围

- 以既有公开路线 `(2480,310)→(480,310)`、现有 scale 与 `5s+3s+9s` 时序为准；不改变这些事实。
- 检查火车与玩家/NPC的遮挡、控制开放、碰撞带与离场清理。
- 桌面与移动端 production 重放；只修能复现的视觉、生命周期或碰撞差异。

## 禁止

不加入乘客 CrowdManager、cars或其他路线；不改30FPS、C3入口/相机、地图、NPC/FX、sample、远端、PR、merge或main。

## 验收

火车进场至到站连续；玩家不被错误画在车厢前；控制只按既有5秒边界开放；离场后Sprite/collider/blocking zone为零，且不影响后续移动、内容、屋顶与地图路径。

## 修正升级

Human连续确认移动火车仍可被主角穿过；`3af774d`的body同步与`6dd4522`/`3670e31`的单矩形范围修正均未解决。停止单带补丁，升级为火车真实车厢几何审计；下一步必须提出多碰撞区方案并经过Human计划Gate。

## 已接受多碰撞区修复

Human回复`ok`（2026-08-24），接受审计建议：以4个随火车x同步的车厢下缘Rectangle替代单一带，局部区间为`0..365`、`360..720`、`715..1078`、`1073..1435`，共同`y=323..359`；相邻5px重叠。此为重构DECISION，不冒充原站碰撞FACT。

## 当前基线

`browser-side-smoke` 已通过火车到站、遮挡、离场与清理断言，随后因 smoke 可见仅`673ms`而失败。该失败来自 C3 已接受的“直达主角”镜头取消烟雾中间预览，属于后续05-E FX范围；05-A 不以改火车/烟雾掩盖该差异。

## Human Gate

Human回复`ok。开始吧`（2026-08-24）接受本包并授权实施；自动检查不替代最终视觉验收。
