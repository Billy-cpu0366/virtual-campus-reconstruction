---
task-id: WI-CONTENT-FOUNDATION-IMPL-A-001
pipeline: PIPELINE-CONTENT-FOUNDATION-001
line: A-SYS-ZONE-INTERACT
status: completed-verified
runtime-base: 798eda67aca9f7e7e1a4fb7f2c76290c83483dcd
design-base: 1cade08
code-base: d2e73b50c6cdb68096c188b585822def853e8722
branch: impl/content-interact
worktree: .pi/worktrees/content-interact-impl
result-tip: 8c2920c43140dc7a0e6af36118c202ab676ea3f8
merged-by: 7f8792c
integration: 8ae7692b45b16f4b0ce6e96faa448197734db3b0
updated: 2026-08-22
---

# A线实现包：SYS-ZONE + SYS-INTERACT CORE

## 目标

实现最小可接线纯运行时：玩家接近marker产生带residenceId的enter/leave；Interact解析内容、原子显示single-active modal、成功后回visited receipt、按residence抑制手动关闭并安全持有control lease。

## 权威输入

- root design commit `1cade08` 的 SYS-ZONE、SYS-INTERACT和API契约；
- shared code baseline `d2e73b50` 的 `src/content/contract.ts`；
- 不修改shared contract；发现歧义立即停止。

## 唯一允许文件

- `src/zone/runtime.ts`
- `src/zone/index.ts`
- `src/interact/runtime.ts`
- `src/interact/index.ts`
- `tests/zone/runtime.test.ts`
- `tests/interact/runtime.test.ts`

禁止修改入口、DOM UI、shared contract、resolver、lease provider、配置、文档、sample和现有runtime。

## 冻结行为

### Zone

- 静态marker至少含 `markerId/menuId/x/y`；位置/viewport由调用方传入。
- 100ms节流；只扫描viewport外扩100px候选，但已inside marker即使移出viewport也必须继续判断并正确leave。
- 欧氏距离严格 `<30px` 进入；outside→inside生成唯一residenceId并只发一次enter；inside持续不重复；inside→outside只发一次匹配leave；再进入生成新ID。
- receipt只有匹配当前marker/menu/residence才记visited；失败/旧receipt忽略并给可测试结果。
- destroy幂等、停止晚到update、清引用；不得创建timer、DOM、physics或Sprite。

### Interact

- 只消费shared contract；同步resolver missing/invalid时不acquire、不show、不visited。
- 首个active申请lease；acquire失败不show。不同residence replace复用现有lease，不重复acquire。
- `show`成功/已显示后才更新active并回visit receipt；replace失败保留旧active和旧lease。
- single-active；旧leave或旧user-close必须同时匹配menuId+residenceId，否则忽略。
- user close成功hide后只抑制该residence；programmatic leave不抑制；离开后再进入可显示。
- lease token与active modal分开保存：末tokenrelease `enable-failed`时保留token供后续/销毁重试，不得丢锁；只释放自己的token。
- destroy顺序：停止消费/取消UI订阅→hide active→UI destroy→finally release自身token→清状态；幂等，不调用provider shutdown。
- memo1..memo6 presentation backdrop=`global`；其他=`none`。

## 必须测试

- viewport/margin、100ms、`<30`边界、enter去重、leave、re-enter新ID、receipt匹配、destroy晚到。
- resolver/acquire/show三类失败；show成功后receipt；already-visible。
- replace成功/失败、旧leave、stale close、manual-close同驻留不重开、离开再进入。
- acquire/release次数、多调用方安全边界、enable-failed token保留、destroy幂等和订阅清理。

## Gate

- `npm run typecheck`
- `npm test -- --run`
- `npm run build`
- `npm run build:test-hooks`
- `git -c core.whitespace=cr-at-eol diff --check`
- diff仅允许6文件；提交正文含Summary/Files/Checks；返回commit/tree/测试数/clean status。
