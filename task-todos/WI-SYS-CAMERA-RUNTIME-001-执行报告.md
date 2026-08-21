# WI-SYS-CAMERA-RUNTIME-001 执行报告

- 工作项：`WI-SYS-CAMERA-RUNTIME-001`
- 分支：`impl/gameplay-serial`
- 基线：`36c1cf5`
- 当前状态：`ready-for-preview`
- Git 状态：未 commit、未 merge、未 push

## 1. 实际修改文件

```text
src/camera/contract.ts
src/camera/index.ts
src/camera/runtime.ts
src/camera/sequence.ts
game/PhaserCameraRuntime.ts
tests/camera/runtime.test.ts
tests/camera/sequence.test.ts
task-todos/WI-SYS-CAMERA-RUNTIME-001-执行报告.md
```

未修改 `game/CampusScene.ts`、`game/PhaserPlayerRuntime.ts`、地图/renderer、`package.json`、共享 browser Smoke、权威状态文档或 `sample/`。

## 2. Production 与测试参数

### Production 默认值

- 6 点序列固定使用 `CAMERA_SEQUENCE`；飞行与停留合计 `111000ms`。
- 返回玩家固定使用 `CAMERA_END_TWEEN_DURATION_MS=3000ms`、`CAMERA_END_TWEEN_EASE="Power2"`。
- 航拍点的 `x/y` 是相机中心世界坐标；运行时按当前 viewport 换算为：
  - `scrollX = centerX - width / (2 * zoom)`
  - `scrollY = centerY - height / (2 * zoom)`
- 正常参数固定恢复为 zoom `1`、lerp `(1,1)`、offset `(0,0)`、deadzone `(0,0)`、`roundPixels=true`。
- `PhaserCameraRuntime.start()` 会先应用 production 相机参数，避免测试或旧状态污染正式默认值。

### 测试缩时

- 只能通过 `CameraRuntime.start({ sequence, returnDuration })` 显式传入短序列和短返回时间。
- 缩时参数属于单次运行，不修改 `CAMERA_SEQUENCE`、`CAMERA_SEQUENCE_DURATION_MS=111000` 或 `CAMERA_END_TWEEN_DURATION_MS=3000`。
- 自动测试同时执行了短序列和完整默认时序检查，证明 production 常量未被污染。

## 3. 6 点时序和总时长

| 点 | 相机中心 `(x,y)` | 飞行 | 停留 | 累计段时长 |
|---|---:|---:|---:|---:|
| 0 | `(944,928)` | `0ms` | `7000ms` | `7000ms` |
| 1 | `(1552,1216)` | `15000ms` | `7000ms` | `22000ms` |
| 2 | `(912,1136)` | `15000ms` | `5000ms` | `20000ms` |
| 3 | `(1216,656)` | `15000ms` | `5000ms` | `20000ms` |
| 4 | `(2048,2048)` | `15000ms` | `7000ms` | `22000ms` |
| 5 | `(944,928)` | `15000ms` | `5000ms` | `20000ms` |

航拍合计 `111000ms`；结束后另加 `3000ms Power2` 返回玩家。自动测试记录 6 次停留、5 次线性航拍 tween 和 1 次返回 tween，并分别核对时长与 easing。

## 4. 控制锁、viewport、返回玩家和硬跟随恢复

- `start()` 首次进入时调用统一控制门 `disableControls()`，随后 `stopFollow()`；相机运行时不接触键盘或摇杆实例。
- 航拍即时点、每个 tween update、每个 tween complete 和返回玩家过程只输出结构化 `CameraViewport`。
- `src/camera/` 和 `game/PhaserCameraRuntime.ts` 均不导入或调用 `ChunkCoordinator`、cache、renderer、Tilemap；目标集合仍由 Main 转交 SYS-CHUNK 计算。
- 返回玩家使用结束时读取的最新只读玩家位置快照，并换算为同一 viewport 的 scroll 目标，避免 `startFollow` 恢复时发生半个视口跳变。
- 成功结束顺序：
  1. 恢复 zoom/offset/deadzone/roundPixels；
  2. 调用 Main 注入的 `startHardFollow(settings)`，其中 lerpX/lerpY 均为 `1`；
  3. 安装或降级可选后处理；
  4. 调用 `enableControls()` 释放统一控制门。

## 5. nativeScale 与后处理降级

- `nativeScale` 由 Main 提供的运行时 provider 读取，不写死设备值；建议 production 接线使用 `() => window.devicePixelRatio`。
- 每次成功航拍结束时基于当时设备值生成：
  - `blurStrength = 16 * nativeScale`
  - `scaleFactor = 1 / nativeScale`
  - `chunkRenderBlockSize = ceil(10 * nativeScale)`
- 这些值只作为设置/安装参数输出；相机运行时不会据此操作 chunk renderer。
- HeatHaze、Fire、Morph 逐项记录 `installed | unavailable`。installer 缺失、返回 `false`、抛错或 nativeScale 无效时都会显式 warning 并保持 `unavailable`。
- 后处理降级和 warning sink 自身失败都不阻断硬跟随与控制恢复；失败/shutdown 路径不安装后处理。

## 6. 重复开始、失败与 shutdown 边界

- 同一次运行中的重复 `start()` 返回同一个 Promise，不重复控制锁、timer 或 tween。
- 已完成运行再次 `start()` 仍返回原结果，不重播开场航拍。
- viewport 输出、timer/tween 创建或回调等运行错误会：取消当前 timer/tween、恢复相机参数、恢复硬跟随、释放控制门，并返回 `{status:"failed"}`。
- 失败结果允许上层明确重试；重试重新建立单一运行，不复用旧 timer/tween。
- `shutdown()` 幂等取消活动 timer/tween，执行同一相机/跟随/控制恢复，不安装后处理；活动结果返回 `{status:"cancelled"}`，后续 `start()` 明确拒绝。
- 尚未启动就 shutdown 不会无故触发控制启用或硬跟随回调。
- Phaser timer/tween 取消适配器自身幂等，避免重复 remove/destroy。

## 7. 自动测试与结果

### 通过

```text
npm run typecheck
```

结果：PASS。

```text
npm test -- --run
```

结果：PASS，`36` 个测试文件、`192` 项测试全部通过；其中 camera 为 `4` 个测试文件、`18` 项测试。

覆盖：

- 6 点 production 数据与 `111000ms` 总时长；
- 5 次线性航拍、6 次停留和 `3000ms Power2` 返回；
- 控制锁与单次恢复；
- 中心坐标到 viewport scroll 的换算和逐更新输出；
- 硬跟随参数恢复；
- runtime nativeScale 计算；
- HeatHaze/Fire/Morph 显式降级与非阻断 warning；
- 重复开始；
- 同步 driver 回调的 active handle 边界；
- viewport 失败恢复；
- shutdown 取消、清理和后续启动拒绝；
- 测试缩时不污染 production 默认值。

### Git whitespace 检查

```text
git -c core.whitespace=cr-at-eol diff --check
```

主执行调用曾被沙箱白名单拒绝；最终只读独立复核在同一工作树成功执行原命令，exit `0`，最终 diff PASS。未使用等价命令绕过。

## 8. 给 Main 的 CampusScene 接线说明

1. 在 `CampusScene` 增加 `PhaserCameraRuntime` 字段；不要把状态机复制进 Scene。
2. 玩家、基础相机和动态世界 coordinator ready 后创建并启动运行时：
   - `controlGate.disableControls` → `playerRuntime.disableControls(this.time.now)`；
   - `controlGate.enableControls` → `playerRuntime.enableControls(this.time.now)`；
   - `getPlayerPosition` → `playerRuntime.position`；
   - `nativeScaleProvider` → `() => window.devicePixelRatio`。
3. `startHardFollow(settings)` 由 Main 闭包持有玩家 Sprite，并执行：
   - `camera.startFollow(player, true, settings.lerpX, settings.lerpY)`；
   - Sprite/Body 不得传入或保存到 `PhaserCameraRuntime`。
4. `onViewport(viewport)` 只把 viewport 交给现有 SYS-CHUNK 目标更新路径；继续复用唯一的 `targetChunks`、coordinator、cache 和 mutation 生命周期，不建立第二套状态。Main 可保留现有约 `500ms` 收敛节奏，避免每帧重复请求调度。
5. 当前仓库没有可用 HeatHaze/Fire/Morph installer 时可省略 `effectInstallers`，运行时会逐项 warning 并降级；若 Main 后续确认真实 pipeline，可注入 installer，并使用回调收到的 nativeScale settings。
6. Scene shutdown 顺序应先调用 `cameraRuntime.shutdown()`，再 shutdown 玩家控制门和地图生命周期，确保相机 timer/tween 不再继续输出 viewport。
7. 对 `start()` 结果显式处理 `completed / failed / cancelled`，避免未处理 Promise；真实 build 与 browser Smoke 由 Main 完成。

## 9. 未解决风险

- 本窗口按所有权约束未修改 `CampusScene`，因此真实 Scene 接线、production build 和浏览器行为尚未验证。
- Phaser 3 真实 Tween/TimerEvent 的取消、场景 shutdown 顺序和实际 viewport clamp 仍需 Main 浏览器 Smoke 验证；当前只有结构适配器单元测试。
- 当前没有仓库内已确认可用的 HeatHaze/Fire/Morph installer，预期行为是显式降级，不代表真实后处理已恢复。
- `nativeScale` 已按运行时注入实现并做多值单元测试，但尚未做多 DPR 真机视觉验证。
- 航拍 tween 可能高频产生 viewport；Main 应复用既有目标更新节奏，不能把回调直接扩展成第二套 chunk 请求/cache 状态。
- 主执行环境曾阻止 Git whitespace 命令，但最终只读独立复核已在同一工作树执行原命令并 PASS；Main 仍需在接线后对新的 integration diff 重跑。

## 10. 结论

允许范围内的 SYS-CAMERA 运行时代码、适配器和自动测试已落盘；typecheck、全量 192 项测试和最终 Git whitespace 检查均通过。当前状态为 `ready-for-preview`，本窗口在此停止，不修改 `CampusScene`，不 commit、merge 或 push。
