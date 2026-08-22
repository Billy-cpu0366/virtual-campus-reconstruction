---
work-item: WI-VISIBLE-PRODUCT-INTEGRATION-001
phase: P4-branch-review-and-main-integration
status: automated-verified-human-visual-failed
authority-commit: 9d430d026365f9a73e1d356190b3774b1bb50ce0
authority-tree: 70316c30c49f2cea7ab4d9e160e1c288d6e70d34
assembled-commit: 532d8095e4adcae79e5b46cfa766a661c42c1909
assembled-tree: d466828f2b1635edbb86f6c1a2f0d6b71601c9bb
integration-commit: 0fadf309963ba5d23c092ec049654791901f806e
integration-tree: 86c8f85f1f59106399d1a2f2040851b100eb2f5a
authorization: DEC-VISIBLE-WAVE-P4-INTEGRATION-001
integration-branch: integration/visible-product-wave
integration-base: 3513ccacf4595fb4742f15116aaf43facdbcffd2
updated: 2026-08-22
---

# P4 Main串行集成包

## 1. P3交付收据

| 线 | commit | tree | parent | 验证 |
|---|---|---|---|---|
| 04 foundation | `db0fd9d1a83cd233db152ea49c0657cb2eb65a12` | `2a6782f7c0c04f58d2035e0e1a0e207221ae8156` | `d4d84837` | 45文件/255项、typecheck/build PASS |
| 04 rich renderer | `c1156cd86455d83d59ab9799e82467788fe32825` | `730de2093ca00a0b330946b3360b4accc1240bb1` | `4309399b` | 46文件/262项、定向28项、typecheck/build PASS |
| 03 blocked receipt | `4b36ad40ede8f0cff8428bb6ae7877a572a3db4f` | `f49186a20c5e3e2a6ac8b1b3ce34cd30d74e7d8b` | `0a5091db` | report-only、clean |
| 03 registry | `71b00851ddb69c65a7ad6309373c2cdbb7ba63d8` | `e95a0e51e539ce4a046fb9e1c199048e09227402` | `c2567b5d` | 43文件/255项、定向20项、typecheck/build PASS |
| 05 side | `0c04913085a25c5429a4b4196f4968e3b83da789` | `e03fe98d3d62bcde4b84728883fbe4eb972202af` | `035017ae` | 45文件/258项、定向13项、typecheck/build PASS |
| Main entry | `3513ccacf4595fb4742f15116aaf43facdbcffd2` | `cbab9c91539d3a0866d1264f1ff46b121fd03383` | `f243764f` | 44文件/259项、两build及10个browser gates PASS |

以上证明各owner交付，不证明最终集成或Human视觉通过。

## 2. 串行接收

Main必须从`3513ccac` clean开始，依次cherry-pick：

1. 04 foundation `db0fd9d1`；
2. 04 rich renderer `c1156cd8`；跳过已由Main拥有的shared等价提交`4309399`；
3. 03 blocked receipt `4b36ad40`；
4. 03 registry `71b00851`；跳过shared等价提交`c2567b5`；
5. 05 side `0c049130`。

每步冲突即停止；禁止`-m`、ours/theirs批量覆盖、reset或丢弃报告。五步完成后先跑typecheck、全测试、production build，形成assembled clean baseline，再写Main integration代码。

## 3. Main必须完成的五个接线缺口

### A. App / Retry generation

- 用04 `AppRuntime`与`DomAppUi`替换Main临时入口状态；真实loader progress只进入当前generation。
- `startLoading`创建当前Phaser Game/Scene，`cleanup`销毁旧generation并清Scene/side/content/entry；Retry只有cleanup成功后创建新generation。
- Play调用当前Scene的`startProductEntry`；完成回PLAYING，失败进入ERROR；Play/Retry幂等。
- modal shown/hidden通过Main薄适配器同步`PLAYING ↔ MODAL_OPEN`；不能让UI拥有Scene。
- `index.html`提供可见Loading/Play/Error/Retry/focus目标；production不自动Play。

### B. 内容registry与10项资源

- `CampusContentResolver`默认source用03 `CONTENT_REGISTRY`覆盖About/Projects/Memo，CV/Contact/Tech保留当前已核对最小fallback；不复制正文。
- `scripts/prepare-runtime-assets.mjs`从P1已确认的10个sample镜像路径复制到registry精确`src`；`check-runtime-assets`和测试核对SHA-256、缺失/篡改失败。
- 不联网、不猜URL；图片失败由04 renderer显示fallback且正文仍可读。

### C. 真实train替换fake与到站收据

- 删除production `TimedTrainArrivalAdapter`使用点；可以保留其单元测试或显式test fake，但production只能包装真实`PhaserTrainRuntime`。
- Main adapter调用真实`start(now)`并从真实route snapshot进入`holding`（即5秒到站）时resolve `waitForArrival`；不得另装5秒真值timer。
- shutdown移除adapter listener并shutdown train；失败保持entry lease并进入ERROR。
- 3秒相机完成仍不得提前放控制，必须等待真实到站收据。

### D. train玩家碰撞

- 给`PhaserTrainRuntime`增加窄`connectCollision(shape) → cleanup`注入点或等价显式端口；Main用现有Arcade player连接真实collider。
- runtime teardown先销毁collider handle，再清shape/sprite/blocking zone；重复/cancel/retry/shutdown均无残留。
- 不新建第二套地图碰撞或共享Entity框架。

### E. sprayer / smoke / side lifecycle

- preload阶段调用三个专属adapter资源入口；world/player ready后创建animations/start。
- sprayer只消费玩家只读位置；smoke只消费相机world viewport；train由entry runtime启动。
- shutdown/Retry先停止side listeners/emitter/collider，再销毁Scene/World；不得出现对象、listener、timer、粒子或blocking zone单调增长。

## 4. Main允许文件

- 既有Main owner：`game/CampusScene.ts`、`game/main.ts`、`index.html`、`package.json`、`game/phaser.d.ts`、Main adapters/contracts。
- 最终接线需要的`game/CampusContentResolver.ts`、`game/PhaserTrainRuntime.ts`和对应测试。
- runtime asset scripts/tests、browser Smoke和最终integration报告。
- 已接收的03/04/05 owner文件只允许修复明确集成接口，不允许改正文、视觉参数或旁支内部行为。

## 5. 自动与Human门禁

自动验证至少包括：

1. typecheck、全测试、production/test-hooks串行build；
2. 既有全部browser gates；
3. 新增真实Loading/Play/Error/Retry generation Smoke；
4. entry Smoke证明相机约3秒、真实train约5秒到站才开放控制、480×270；
5. 正常移动到Memo 6并显示真实sections/图片fallback；
6. sprayer短路径触发、train进/停/离与碰撞、factory smoke视口启停；
7. Retry/shutdown后资源、listener、collider、emitter、lease和debug hook无残留。

自动全绿后启动实际预览，由Human在桌面1920×1080和移动375×667确认Loading、构图、入场、内容、NPC/路线/FX。Human通过前不得写关闭文档，不push/PR/同步Windows。

## 6. 复用观察

本轮仍是三个专属side owner与一个Main协调器；没有第二个独立场景证明Entity通用抽象，`Q-ENTITY-001`继续NO-GO。
