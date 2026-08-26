---
work-item: WI-SYS-FX-FACTORY-SMOKE-001
subtask: 05E-S1-StopAI-smoke
system: SYS-FX
issue-class: systemic-failure
correction-phase: batch-implement
status: automated-verified-awaiting-human-visual
decision: DEC-P5.4-05E-S1-STOP-AI-001
repair-decision: DEC-P5.4-05E-S1-SMOOTHNESS-001
candidate-base: 8586196
updated: 2026-08-25
---

# 05-E S1 Stop AI烟雾实施包

## Human已接受目标

当前只实现并验收Stop AI场景，不自动进入S2–S4：

1. 三处烟雾罐独立owner：`(1800,1352)`、`(1480,1272)`、`(1672,1304)`；每处back/main/front三层，共9个emitter及3个canister graphics；
2. 独立fog owner只装配`orange_smoke` polygon，按公开32px算法得到13个cell emitter；
3. 两个owner共同进入Stop AI production视觉Gate，但代码、生命周期与收据保持分离；
4. 彩烟离屏destroy/recreate后显式续接wind loop；
5. fog保留并自动测试cars 40px清雾注入接口，当前无cars production输入时明确报告未集成。

## 公开Oracle

权威明细见[全量审计](WI-SYS-FX-FACTORY-SMOKE-001-05E公开烟雾审计.md)。S1固定：

- canister emitter：`particle_smoke_white`、speed15..35、scale.1→3、lifespan1800、quantity2、frequency20、gravityY -20、Circle radius3、tint `[16724787,16716049,13369344]`；main alpha1→.3，back/front .6→.15；depth350/1160/1550。
- main depth在player前后动态调整；back/front固定。
- 彩烟/graphics按camera边界控制；emitter每500ms离屏destroy、返回重建；graphics按外扩100px显示；wind每3–6秒触发，gravityX 15..40持续1.5–4秒，shutdown取消全部timer。
- `orange_smoke` polygon直接来自`particle-trajectories.json` region75；cellSize32，13 cells，depth1100，NORMAL，scale8、alpha.3、speed5、quantity4、frequency20、lifespan350..2000、respawn500ms。
- Fog按camera worldView逐cell启停，四边外扩公开`cellSize=32`；玩家移动按前方85×35椭圆清雾；注入cars按40px半径清雾；500ms恢复。

## 已落盘与自动验证（Human视觉已拒绝；审计完成，等待修复方案Gate）

- 代码提交：隔离分支 `integration/visible-product-wave` 的 `e07d2c7`，未push。
- PASS：typecheck、S1 FX专项10项、全量68 files / 363 tests、build、performance smoke。
- PASS：`browser:stop-ai-smoke-production`无production debug/test hook，真实键盘到Stop AI后9层彩烟与13-cell fog active；离场后彩烟destroy/Fog inactive；返回后generation=2且wind重建续接；shutdown后两类owner均清0；无console/exception/failed request/bad response。
- 证据：`.pi/worktrees/visible-product-integration/.pi/audit-evidence/05e-s1/receipt.json`（SHA-256 `b36e41537972e9e1331f65ea909f785d1013a912f01de6e5c883f8bd8577265e`）、`performance.json`（SHA-256 `8a188bc019f283b1bcd9889d0a6e0481622dbb22e028813ce8e439267c9a32a3`）及`screenshots/`。
- 独立verifier：所有客观检查PASS，结论为`UNVERIFIED`，未代替Human视觉。
- Human Gate结果（2026-08-25）：拒绝当前编译production视觉，明确反馈红烟运动“卡卡的，不知道怎么回事，很不丝滑”。该反馈覆盖整体视觉体验，自动PASS不能覆盖；S2–S4未授权。
- 当前处理：统一审计已完成。定点控制显示orange fog透明粒子绘制是最高可信负载根因，runtime每帧同步不是主因；旧`e07d2c7`保留为失败candidate，修复candidate为`c4b2d6a`，当前等待Human重新视觉Gate。
- Human Plan Gate已通过（2026-08-25）：接受`DEC-P5.4-05E-S1-SMOOTHNESS-001`，只优化`orange_smoke`呈现密度，将Phaser adapter的`quantity`从公开FACT `4`改为重构DECISION `2`；保留13-cell核心、清雾/respawn、owner/lifecycle和红烟9层公开参数。`quantity1`仅为诊断上限，不预授权。
- 修复已落盘：代码提交`c4b2d6a`；公开FACT quantity4仍保留，Phaser presentation使用quantity2；Stop AI定点帧门禁已加入production probe。
- 客观停止条件：Stop AI编译production定点停留至少10秒，p95≤20ms、max≤34ms、无长任务/异常/坏请求，9红+13fog和离屏/返回/shutdown回归通过，再交Human视觉复验。当前最终收据：10,001ms、575帧、p95 16.8ms、max33.4ms、longtask0、>34ms=0；截图与收据见`.pi/audit-evidence/05e-s1/correction-round-1/final/`。若Human视觉仍失败，回到同一差异表，不自动降到quantity1或启动S2。
- 审计收据：`.pi/worktrees/visible-product-integration/.pi/audit-evidence/05e-s1/correction-round-1/`；定点帧`stop-ai-frame-before-capture.json` SHA-256 `5eb4f920064bbd4b9746a96716d4088e460cd63d0a69b9ad66961bc4c34cafa0`，渲染关闭/同步保留`render-off-sync-active.json` SHA-256 `cf86106699f8d9c0ff86fd9decff053a2abfa6a67661328a506db25e5076d5dc`，quantity实验`fog-quantity-sensitivity.json` SHA-256 `d9250f0205c4853bd8bee461cbe8b0324b6a8891e05ff3778446793a40d27feb`。

## 实现边界

允许在`.pi/worktrees/visible-product-integration`内修改/新增：

- `src/fx/stop-ai-smoke.ts`、`src/fx/fog.ts`、`src/fx/index.ts`；
- `game/PhaserStopAiSmokeRuntime.ts`、`game/PhaserFogRuntime.ts`、`game/CampusScene.ts`；
- 对应`tests/fx/`测试；
- S1 production probe及`package.json`命令。

禁止：

- 修改现有`factory-smoke`行为或借S1补S2 white；
- 修改NPC、玩家控制、地图、相机、火车路线、roof、30FPS、`sample/`或远端；
- 建立脱离这两个真实owner的通用粒子框架；
- 声称production cars clearing已接线。

## 实现要求

- core保存不可变公开配置、polygon/cell计算、视口和clear/respawn状态；Phaser adapter只负责对象、timer和scene接线。
- scene复用现有smoke-white asset key，不重复加载不同纹理。
- 配置/运行快照至少暴露site/layer、emitter generation、active/destroyed、wind active；fog暴露region/cell/active/cleared/respawn与carsInputIntegrated。
- scene shutdown幂等清理9个彩烟emitter、3 graphics、13个fog cell emitter、所有timer/listener。
- production probe必须沿正常键盘路径或真实运行scene观测；不可依赖production debug/test hook改变状态。

## 最小验证

1. typecheck；
2. S1专项测试：坐标/层数/参数、13 cell、viewport、player clear、cars注入clear、500ms respawn、wind重建续接、shutdown；
3. 全量单测与build；
4. Stop AI production浏览器probe：三site/九层与13 cell装配、屏内活跃、离屏/返回、generation/wind续接、shutdown；
5. performance smoke；
6. Human在Stop AI道路两边确认彩烟与orange fog形态、颜色和深度正常。

## 停止条件

- 公开polygon、Phaser API、玩家位置/速度或depth语义无法从权威输入确定；
- 需要修改禁止路径；
- 自动与Human视觉冲突；
- S1实现要求被迫扩大到S2/S3。
