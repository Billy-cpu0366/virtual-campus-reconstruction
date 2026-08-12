---
title: 对象详细设计模板
status: approved
version: v0.2
updated: 2026-08-10
---

# 对象详细设计

对象是被系统管理的事物，例如玩家、NPC、火车、地图、分块和区域。

## 文件命名

```text
<节点ID>-<对象名称>.md
```

## 统一模板

```markdown
---
title: 对象名称
type: object-detail
status: draft
version: v0.1
node-id: OBJ-EXAMPLE
node-type: 对象
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

<a id="OBJ-EXAMPLE"></a>

# 对象名称

## 1. 说人话解释
对象代表什么。

## 2. 原站证据与状态
哪些是事实、推断和未知。

## 3. 属性
对象有哪些稳定数据。

## 4. 状态
对象可能处于哪些状态，怎样变化。

## 5. 行为
对象能执行或承受哪些行为。

## 6. 管理系统
由哪些系统创建、更新和销毁。

## 7. 相关事件
对象触发或响应哪些事件。

## 8. 资源与配置
使用哪些图片、动画、地图或配置。

## 9. 现有代码映射与差距
当前复刻做到哪里。

## 10. 未知问题与验收
还需调查什么，怎样证明正确。

## 11. 复用观察
是否有多个实际对象共享相同模型、生命周期或变化规则；没有真实证据时写“未发现”，不得提前抽象。发现真实重复时必须同步详细设计入口的观察表；Human 批准提取后，由观察表指定唯一主归属文档。
```

对象文档只定义对象本身；移动、碰撞、路线等通用规则写在对应系统文档中。普通 NPC、车辆、分块等实例不创建节点；实例证据归入对象主定义或来源记录。
