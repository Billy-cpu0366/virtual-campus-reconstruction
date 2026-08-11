---
title: 图层与遮挡：怎样验证做对了（SYS-LAYER 验证计划）
type: system-verification-plan
status: approved
version: v0.2
node-id: SYS-LAYER
design-ref: ../03-具体怎么做/系统/图层与遮挡：24层怎样显示和清理（SYS-LAYER）.md#SYS-LAYER
implementation-status: not-authorized
updated: 2026-08-11
---

# 图层与遮挡：怎样验证做对了（SYS-LAYER 验证计划）

> **一句话：每个图层都必须有明确用途、depth、写入和清除规则；视觉遮挡还要用有边界的运行证据确认。**

> 本计划验证Human已接受的正式设计，但不代表代码已授权或实现。

## 1. 原站事实基准

| ID | 要证明什么 | 证据与方法 |
|---|---|---|
| LAYER-FACT-001 | 25个chunk均有同顺序24层 | 逐文件结构签名，必须25/25一致 |
| LAYER-FACT-002 | 24层可无损拼成final_map | 470400格逐格差异必须为0 |
| LAYER-FACT-003 | 地图visible与运行时可见策略不同 | 对照JSON字段与Bundle create/setVisible调用 |
| LAYER-FACT-004 | 初始基础层、roof、walls、bridge和cars depth可定位 | Bundle搜索`createBlankLayer`与`setDepth` |
| LAYER-FACT-005 | 玩家depth有常态Y排序和桥/剧情覆盖 | 搜索全部`player.setDepth`调用 |
| LAYER-FACT-006 | footsteps grid与tilelayer位置相同 | 140×140坐标集合比较，交集368且双方独有0 |
| LAYER-FACT-007 | 优化路径22层、卸载11层，特殊13层无额外tile清空 | 搜索固定层名单、3个`putTilesAt`调用点和`unloadChunk` |

## 2. 正式设计验收

| ID | 操作 | 通过条件 | 失败判定 |
|---|---|---|---|
| LAYER-DESIGN-001 | 枚举策略表 | 24个已知层恰好各出现一次 | 漏层、重复或未知层被静默忽略 |
| LAYER-DESIGN-002 | 检查每层策略 | 每层均有role、tileset、render、depth、GID过滤、apply/remove和unknown处理 | 任一字段靠调用方猜测 |
| LAYER-DESIGN-003 | 应用/移除任一chunk | 所有视觉、碰撞和marker结果对称收敛 | 特殊13层遗留或marker泄漏 |
| LAYER-DESIGN-004 | 基础层与玩家Y排序 | 常态遮挡符合已接受depth规则 | 玩家始终位于所有层前或后 |
| LAYER-DESIGN-005 | 切换bridge上下状态 | 可见性、碰撞和玩家depth覆盖同一事务更新并可恢复 | 只改显示不改碰撞，或退出后depth未恢复 |
| LAYER-DESIGN-006 | 进入/离开roof区域 | 对应roof组幂等淡隐/恢复，其他roof不受影响 | 反复触发漂移或错误组变化 |
| LAYER-DESIGN-007 | 读取footsteps | tilelayer可产生与外部grid相同的368个位置 | 两份运行状态分叉 |
| LAYER-DESIGN-008 | particles3没有消费者 | 数据保留并明确报告未完成 | 静默删除后宣称24层完成 |
| LAYER-DESIGN-009 | 注入非法GID或缺层 | 整个chunk转换失败且错误含层名、坐标和GID | 部分写入或静默降级 |

## 3. `Q-LAYER-001`行为补证计划

静态证据不足以证明最终视觉顺序。若Human单独允许有边界补证，只采集以下最小场景，不扩大资源镜像：

1. 玩家从layer1–5区域移动到layer6–10遮挡区域；
2. 进入和离开factory或concert roof区域；
3. 从桥下切换到桥上并反向离开；
4. 包含particles3或footsteps标记的位置；
5. 每个场景只记录必要截图、玩家世界坐标、玩家depth、相关层visible/alpha/depth和碰撞状态。

通过条件：静态depth、动态状态和实际前后遮挡能相互解释。若无法访问运行状态，只能保留UNKNOWN，不能凭截图猜内部规则。

## 4. 未来实现测试

正式代码另行授权后至少建立：

- 24层策略覆盖和未知层失败测试；
- 每层GID过滤与tileset映射测试；
- chunk apply/remove对称性测试；
- walls和bridge碰撞切换测试；
- 玩家常态depth及覆盖恢复测试；
- roof重复进入/离开测试；
- footsteps 368位置一致性测试；
- particles未消费诊断和销毁清理测试；
- 桌面与移动视口的关键遮挡截图对比。

## 5. 当前状态

- 数据事实：24层完整性、footsteps等价和主要Bundle锚点已验证；
- `Q-LAYER-001`：open；等待Human决定是否允许最小行为补证；
- 正式设计：Human已接受；
- 实现：未授权；
- 节点：`designed`；
- 复用观察：未发现。
