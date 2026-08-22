---
work-item: WI-GITHUB-WIP-SNAPSHOT-20260822-001
status: active-bundle-preparation
work-item-type: delivery-snapshot
authorization: DEC-WIP-SNAPSHOT-PUSH-001
delivery-id: vc-wip-visible-p51-20260822-01
target-branch: wip/visible-product-p5.1-20260822
updated: 2026-08-22
---

# 当前可见产品进度 WIP 远端快照

## 目的

把当前阶段进度安全同步到GitHub独立WIP分支，避免代码和最新状态只存在本地。该快照不是产品完成版，也不改变P5 Human视觉FAIL。

## 输入

- 功能candidate：`0fadf309963ba5d23c092ec049654791901f806e`
- candidate tree：`86c8f85f1f59106399d1a2f2040851b100eb2f5a`
- 最新状态基线：根`master`上的WIP同步授权提交（生成bundle前记录精确commit/tree）
- 已知有效自动收据：53 files / 298 tests；typecheck；production/test-hooks build；既有browser gates
- Human结果：Loading不似原站、实际卡顿、初始chunk装配可见，视觉Gate FAIL

## 输出

- delivery ID：`vc-wip-visible-p51-20260822-01`
- 统一本地delivery分支：`delivery/vc-wip-visible-p51-20260822-01`
- GitHub目标分支：`wip/visible-product-p5.1-20260822`
- outbox：`.pi/handoff/outbox/vc-wip-visible-p51-20260822-01/`
- bundle、manifest、checks、files、SHA256SUMS、README

## 授权边界

允许：

1. WSL合并功能candidate与最新权威状态，解决文档冲突并形成统一delivery commit；
2. 重跑状态、typecheck、全测试、build和适用browser gate；
3. Windows外部Pi验证bundle/正式仓库/remote/dirty/fetch基线；
4. 验证通过后只推`wip/visible-product-p5.1-20260822`。

禁止：

- PR、merge、更新`main`；
- 把P5状态改成通过或把WIP称为完成版；
- reset、clean、pull、force-push、覆盖正式仓库dirty内容；
- remote不匹配、未知分叉、bundle/hash不符、测试失败后继续。

## 成功收据

外部Pi必须返回远端branch、commit、tree、push后`ls-remote`核对、实际检查结果和未解决风险。没有远端收据前，本任务只算本地bundle prepared，不算synced。
