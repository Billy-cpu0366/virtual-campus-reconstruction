---
window: A
system: SYS-INTERACT
status: planned
branch: recon/content-interact
worktree: .pi/worktrees/content-interact-recon
parent: WI-PARALLEL-CONTENT-FOUNDATION-RECON-001
updated: 2026-08-21
---

# 窗口 A：SYS-INTERACT 调查包

## 目标

查清原站从 `menuId` 请求到内容弹窗打开、关闭、离开、重复进入和销毁的状态流程，为 SYS-INTERACT 七格设计提供证据。

## 只回答这些问题

1. 哪个对象接收 `menuId`，如何选择 Technologies/About/CV/Projects/Contact/Memo 内容？
2. 自动进入、手动关闭、离开半径、再次进入分别如何改变状态？
3. 弹窗打开时玩家、键盘、摇杆、相机或 scene 是否暂停/锁定？关闭后何时恢复？
4. 同一内容重复请求、快速进入/离开、缺失内容或 DOM 不存在时怎么处理？
5. listener、timer、Promise、DOM 引用和 scene shutdown 如何清理？
6. `SYS-ZONE → SYS-INTERACT` 和 `SYS-INTERACT → SYS-GAME-UI` 需要哪些语义数据？

## 证据白名单

- `03-执行层/03-内容线/01-区域触发.md`
- `03-执行层/03-内容线/02-世界交互(弹窗).md`
- `04-内容层/作品集内容.md`
- `02-接口层/API契约表.md`
- `sample/original-public-build/mirror/index.html`
- `sample/original-public-build/mirror/chunk-WMFY56ZM.js`
- 由上述文件直接引用且确实与 modal 行为相关的公开 CSS/JS；扩展前在报告登记理由
- 当前实现仅用 `git show 798eda6:<path>` 查控制门和 scene shutdown 边界

## 所有权边界

- A 决定业务状态证据，不设计 CSS、布局、响应式或视觉组件；这些归 B。
- 不重查 marker 坐标和 `<30px` 判定；直接引用已接受的 SYS-ZONE。
- 不补写完整作品文案或 Slovak 内容。
- 唯一允许写入：`task-todos/WI-PARALLEL-CONTENT-FOUNDATION-RECON-001-窗口A-SYS-INTERACT调查报告.md`。

## 报告必须产出

- modal 状态机与事件表；
- open/close/leave/re-enter/shutdown 流程；
- 控制锁/暂停的直接证据或 UNKNOWN；
- 面向 B 的呈现需求清单；
- proposed 接口字段，不冻结 TypeScript 签名；
- 失败与清理缺口；
- FACT/INFERRED/UNKNOWN、证据定位和检查收据。

## 客观检查

```text
只新增本窗口一份报告
不修改 sample、系统卡、API、代码和其他任务文件
报告中每条 FACT 均有公开文件位置
所有无直接链路结论保持 INFERRED/UNKNOWN
CRLF-aware diff --check PASS
```

完成后提交自己的报告分支并停止，不 merge、不 push。
