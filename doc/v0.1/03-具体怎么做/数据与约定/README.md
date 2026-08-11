---
title: 数据与约定详细设计模板
status: approved
version: v0.2
updated: 2026-08-10
---

# 数据与约定

本目录记录跨系统共用的数据格式和统一规则，例如地图格式、坐标、图层深度、资源键和事件命名。

## 建议主题

- 地图与分块数据格式；
- 图层和 Tileset 定义；
- 世界坐标与屏幕坐标；
- 玩家、NPC和车辆配置；
- 区域与触发器配置；
- 资源路径与资源键命名；
- 事件和状态命名；
- Phaser 使用边界；
- 错误处理和测试约定。

## 文件命名

```text
<DATA或CONV节点ID>-<名称>.md
```

数据节点使用 `DATA-*`，统一约定节点使用 `CONV-*`。只有具有独立契约、多个明确使用者或近期验证价值时才登记节点；普通字段和局部常量留在所属主定义中。

## 统一模板

```markdown
---
title: 数据或约定名称
type: data-or-convention-detail
status: draft
version: v0.1
node-id: DATA-EXAMPLE
node-type: 数据
parent-ref: SYS-EXAMPLE
scope-disposition: in-scope
understanding-status: partial
engineering-status: designed
source-refs:
  - CAP-EXAMPLE-001
decision-refs:
  - DEC-EXAMPLE-001
main-definition: true
---

<a id="DATA-EXAMPLE"></a>

# 数据或约定名称

## 1. 适用范围
## 2. 原站证据
## 3. 字段或规则
## 4. 约束和边界
## 5. 示例
## 6. 被哪些系统使用
## 7. 重构决定
## 8. 未知问题
## 9. 验证方式
## 10. 复用观察
是否有多个实际系统共享该格式或约定；记录稳定字段和变化字段，没有真实重复时写“未发现”。发现真实重复时必须同步详细设计入口的观察表；Human 批准提取后，由观察表指定唯一主归属文档。
```

同一规则只在这里定义一次，其他文档通过节点 ID 和链接引用。若规则尚未达到独立节点条件，继续保留在所属系统主定义中，不创建空约定文件。
