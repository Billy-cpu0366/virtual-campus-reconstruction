---
work-item: WI-THREE-BOARD-VISIBLE-WAVE-001
phase: p5.4-05d1-route-crowds
status: accepted-implementation-authorized
updated: 2026-08-24
---

# 05-D-1 路线群众实施包

## 范围（FACT）

实现公开 Bundle 已配置的 9 组路线群众：main-crowd、loop-crowd、drinkers、concert_crowd、vertical-crowd、vertical-crowd-reverse、walking-crowd、outside_concert1、crowd-train；资源池为 17 个公开 48×48、64帧人物 spritesheet。

每组保留公开人数、tile 起终候选、速度/variation、延迟、随机起始位置、`goBack` 和 train 的 `deleteAfterComplete`。实际 world path 由可取消 path provider 提供；失败的单位不创建，不伪造直线路径。

## 边界

- 不包含 beach/静态区域群众、hazmat、bug、ghost、抗议者、动物或车辆。
- 不建立通用 Entity/NPC 框架。
- `maxActiveInViewport`、`visualOffset` 无公开消费者，不实现为原站事实。
- worker 内路径随机算法、完整 Scene teardown 调用链为 UNKNOWN；实现必须有本地可清理 fallback，不能冒充原站事实。

## 生命周期与验收

- path bounds 与视口相交时创建/更新，完全离开时销毁 sprite；返回时恢复当前路线状态。
- `goBack:true` 往返；`goBack:false` 完成后 fade 并从起点重生；train 单程组完成后删除。
- 固定随机源下，资源、速度、起始 waypoint 和延迟可重放。
- path provider 初始化失败、单路径失败、Retry/shutdown 均无 sprite/timer/listener 残留。
- Human 在 production 确认：至少普通路线群众、演唱会群众和 train 乘客可见且移动自然。

## 修正合同（DECISION；Human 已接受）

- 路线群众的 64 帧 spritesheet 按既有玩家 FACT 消费为 8 个方向 × 每方向 8 帧，移动时播放对应方向，停止/等待时停在最后方向的首帧。
- 火车动态占用路径下一 waypoint 对应格时，群众在当前格原地等待、保持最后朝向；占用解除后继续既有路径。
- 不动态绕行、不销毁重生；公开 Bundle 尚未直接证实火车与群众的精确避让算法，上述为本轮重构 DECISION。

## 证据

`sample/original-public-build/mirror/chunk-WMFY56ZM.js`：`publicCrowdSprites` 约 byte 318344、组初始化约 328283、Crowd manager update/destroy 约 180000/193985、path 约194272、train passengers约445171。
