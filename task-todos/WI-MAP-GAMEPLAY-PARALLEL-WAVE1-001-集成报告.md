# WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001 集成报告

- 分支：`integration/map-gameplay-p0`
- 接收提交：地图 `ff860cc`（来源 `5290eca`）、玩家 `b5f969b`（来源 `482b52f`）
- 当前状态：`ready-for-preview`
- 提交状态：Main 接线未 commit、未 merge、未 push
- SYS-CAMERA：继续 gated，未启动

## 1. Main 实际修改

```text
game/CampusScene.ts
game/PhaserPlayerRuntime.ts
tests/player/phaser-runtime.test.ts
scripts/browser-layer-smoke.mjs
scripts/browser-mobile-input-smoke.mjs
task-todos/WI-MAP-GAMEPLAY-PARALLEL-WAVE1-001-集成报告.md
```

接线内容：

1. preload 粒子 tileset 和四个玩家 idle/sitting spritesheet；
2. Tilemap 注册第三个 `tileset-particles`，并交给现有 renderer；
3. 创建 `PhaserPlayerRuntime`，由注入 effect 统一 reset 键盘/摇杆和停速；
4. update 保留现有速度、`body.blocked`、walk 动画、碰撞和 depth，只在玩家适配器未锁定视觉时写普通 idle；
5. blur/visibility 统一经过玩家控制门；shutdown 先清玩家控制/监听，再销毁 joystick 和动态世界；
6. chunk target 改读只读玩家位置快照；公式、相机 viewport 和缓存逻辑不变；
7. test-hooks 本次新增字段只包含只读玩家状态、粒子纹理和 raw particle layer 数量；既有诊断字段保持，production 运行时继续不暴露 hooks。

## 2. 集成审查发现并关闭的问题

1. `movementDirection === null` 曾被 `?? resolvedDirection` 回退，可能让 sitting stand-up 期间提前移动。现改为仅当玩家适配器不存在时才使用原始方向。
2. 本地精简 Phaser 声明未覆盖 Scene/Sprite 完整接口；采用与现有摇杆相同的有界适配器类型转换，不扩大全局声明。
3. lifecycle Smoke 发现 Scene shutdown 时 Sprite 动画控制器可能已释放，适配器仍恢复普通外观。现改为 shutdown 只清控制 effect、pending 状态和动画监听，不再触碰即将销毁的视觉对象；新增回归断言。

## 3. 自动验证

基础门禁全部 PASS：

- `npm run typecheck`
- `npm test -- --run`：35 个测试文件 / 184 项测试
- `npm run prepare:runtime`
- `npm run check:runtime`
- `npm run build`
- `npm run build:test-hooks`
- `npm run check:perf-baseline-evidence`：9 groups / 27 samples
- `git -c core.whitespace=cr-at-eol diff --check`

production 浏览器门禁：

- `browser:smoke` PASS：canvas 1，异常/失败请求/坏响应均 0，25 个资源响应 200；
- `browser:runtime-safety-smoke` PASS：diagnostics 为空，debug/collision hooks 均未暴露。

test-hooks 浏览器门禁：

- chunk PASS：初始 20 chunks，移动后新增 4；
- layer PASS：420 renderer layers、719 markers、86 particles3 diagnostics、40 raw particle layers、100 collision layers；
- collision PASS：玩家 y `304 -> 348`，57 个 blocked samples，runtime errors 0；
- lifecycle PASS：重复验证均为初始 20 chunks；异步采样观察到 335–337 renderer layers、422–492 markers，均低于既有上界；销毁后 debug/lifecycle/collision hooks 全部清理；
- mobile input PASS：桌面摇杆隐藏，移动端 ownership/释放/键盘恢复正常；玩家控制为 enabled，移动状态为 walking 且 visualLocked=false；
- 所有浏览器检查无 Runtime exception、失败请求或坏响应。仅 Chromium 软件 WebGL fallback warning，不是项目错误。

## 4. 视觉抽查

production 截图：

```text
/home/mizhou/pi-sandbox/workspace/.pi/verification/wave1-integration-production.png
```

Main 抽查：地图、玩家、列车/遮挡和场景布局无明显视觉破坏；粒子纹理与 raw particle layers 已由运行时断言证明加载/创建。截图不是 idle/sitting 30 秒完整视觉验收。

## 5. 边界与尚未解决

- 本报告只验证第一波 M1+P1 集成，不宣称完整 SYS-ASSET/LAYER/PLAYER/CAMERA 完成。
- `Q-LAYER-002`、`Q-LAYER-003` 继续 UNKNOWN；不实现车辆、NPC、trajectory、footprint、抗议者。
- 性能收据仍是当前环境 baseline，不是最终 FPS/GPU/纹理内存门槛。
- SYS-CAMERA 虽已接受范围，但必须等本集成结果经 Human 接受、Main 接线 commit 和状态同步后才能启动。
- integration 未 push、未带回 master；WSL 结果不会自动同步到 Windows/Obsidian。

## 6. 结论

第一波 integration 自动检查、浏览器行为和 production 视觉抽查均通过，无已知阻塞缺陷。当前 `ready-for-preview`，等待 Human 接受后才创建 Main integration 本地提交。
