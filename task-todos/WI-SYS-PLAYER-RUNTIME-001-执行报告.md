---
work-item: WI-SYS-PLAYER-RUNTIME-001
status: ready-for-preview
branch: impl/gameplay-serial
baseline: 638d4c6
authorization: DEC-SYS-PLAYER-RUNTIME-001
updated: 2026-08-21
---

# WI-SYS-PLAYER-RUNTIME-001 执行报告

## 1. 当前结论

- **已接受**：Human 已通过 `DEC-SYS-PLAYER-RUNTIME-001` 授权 P1 范围。
- **工作树已实现**：统一玩法控制门、8 秒随机 idle、30 秒 sitting、移动 stand-up、公开资源适配、安全降级、只读位置/控制快照和清理边界均已写入白名单文件。
- **已自动验证**：类型检查和全库单元测试通过。
- **尚未 Git 落地**：当前按任务卡停在 `ready-for-preview`，没有 commit、merge 或 push。
- **尚未集成验证**：`CampusScene` 由 Main 独占，本窗口没有修改；真实场景接线、build 和浏览器 Smoke 待 Main integration 分支完成。

## 2. 实际修改文件

```text
src/player/index.ts
src/player/runtime.ts
game/PhaserPlayerRuntime.ts
tests/player/runtime.test.ts
tests/player/phaser-runtime.test.ts
task-todos/WI-SYS-PLAYER-RUNTIME-001-执行报告.md
```

没有修改 `game/CampusScene.ts`、`game/PhaserVirtualJoystick.ts`、`src/input/`、`src/move/`、`src/camera/`、地图/renderer、`package.json`、共享 Smoke、`sample/` 或权威状态文档。

## 3. 玩家状态与切换

`PlayerRuntimeStateMachine` 使用以下运行时状态：

```text
disabled
normal-idle
walking
idle-action
sitting-down
sitting
standing-up
shutdown
```

切换规则：

1. 控制启用后从 `normal-idle` 开始重新计时。
2. 无移动满 8 秒，从 `eating / scratching / tying-shoe` 的可用动作中随机选择；排除上一次动作，不能连续重复。
3. 动作完成后记录动作完成时间，至少再等待 8 秒才允许下一次小动作。
4. 无移动满 30 秒时 sitting 优先：`sitting-down -> sitting`。
5. `idle-action` 收到移动意图时立即恢复普通玩家外观并进入 `walking`。
6. `sitting-down / sitting` 收到移动意图时进入 `standing-up`，暂存最新方向；反向动画完成后把方向交回 Main。
7. 对应贴图或动画不可用、创建失败或播放抛错时，恢复 `player`、48×48 和最后朝向帧，回到普通 idle，不锁死控制。
8. `shutdown` 后控制不可重新启用，`update` 会显式拒绝调用。

Phaser 动画参数与公开 Bundle 对齐：

| 动作 | 资源 | 帧 | frameRate | repeat | 显示尺寸 |
|---|---|---:|---:|---:|---:|
| eating | `player-eating.webp` | 0–15 | 5 | 0 | 64×64 |
| scratching | `player-scratching.webp` | 0–15 | 5 | 0 | 64×64 |
| tying-shoe | `player-tying-shoe.webp` | 0–15 | 5 | 0 | 64×64 |
| sitting-down | `player-sitting.webp` | 0–15 | 16 | 0 | 64×64 |
| standing-up | `player-sitting.webp` | 15–0 | 16 | 0 | 64×64 |

四个 URL 使用静态 `new URL(..., import.meta.url)` 指向仓库内公开 sample 资源；不修改 sample，也不要求本窗口改共享资源脚本。Main 导入适配器后，Vite 才会把这些资源纳入实际模块图和构建验证。

## 4. 控制、失焦与 shutdown 边界

统一控制门通过注入的三个 effect 管理 Main 已有设备所有权：

```text
resetKeyboard()
resetJoystick()
stopMovement()
```

- `disableControls()`：立即执行三项清理、恢复普通外观、移除动画完成监听，并屏蔽移动。
- `enableControls()`：重新安装动画监听、重置 idle 计时并接受后续设备输入；不会合成或保留禁用期间的旧按键。
- `blur()/reset()`：保持当前控制门启用状态，但立即 reset 键盘/摇杆、停速、取消特殊动作并从普通 idle 重新计时。
- `shutdown()`：只执行一次三项清理，移除监听、恢复普通外观并进入永久 `shutdown`。
- 适配器不拥有键盘、摇杆、Sprite、Body、碰撞层或 depth；这些所有权继续留在 `CampusScene`。

只读输出：

- `runtime.position`：每次返回冻结的 `{ x, y }` 快照，不暴露 Sprite/Body。
- `runtime.control`：返回冻结的 `{ enabled, shutdown, status, visualLocked }`。
- `runtime.update(...)`：返回冻结的 `movementDirection / facing / idleAnimation / pendingDirection / status / visualLocked`，供 Main 决定现有移动和动画分支。

## 5. 测试与结果

### 任务卡客观检查

```text
npm run typecheck
```

结果：PASS。

```text
npm test -- --run
```

结果：PASS，34 个测试文件、182 项测试全部通过。

### 新增覆盖

- 控制门禁用立即停速并 reset 键盘/摇杆，启用后恢复输入；
- 8 秒阈值与动作完成后的再次等待；
- 随机动作排除上一次；
- 30 秒阈值、sitting-down、sitting、standing-up；
- idle 动作收到移动立即退出；
- stand-up 后恢复暂存方向；
- 单个资源缺失时选择其他可用动作；
- 全部动作或 sitting 资源缺失时普通 idle 降级；
- 动画播放抛错时恢复普通玩家；
- blur/reset 计时和输入清理；
- shutdown 幂等清理与永久拒绝；
- 公开资源 URL、128×128 切帧、0–15、5/16 FPS 与反向 sitting 帧；
- 冻结的位置和控制快照；
- 移动状态不抢占 Main 现有 `body.blocked` 走路动画分支。

附加检查：`git diff --check` PASS；新增源码/测试无尾随空白。独立只读复核最终结论 PASS；首轮发现的“shutdown 后可误重装动画监听”缺口已增加入口守卫和回归覆盖后关闭。

## 6. 给 Main 的 CampusScene 接线说明

本窗口没有修改 `CampusScene`。Main integration 建议按以下顺序接线。

### 6.1 preload

导入并在 `CampusScene.preload()` 调用：

```ts
preloadPhaserPlayerRuntimeAssets(this.load);
```

它只登记四个 idle/sitting spritesheet；现有 `player.webp` 加载保持原样。

### 6.2 create

在现有玩家、键盘和 `PhaserVirtualJoystick` 都创建后实例化：

```ts
this.playerRuntime = new PhaserPlayerRuntime(this, this.player, {
  effects: {
    resetKeyboard: () => {
      this.heldMovementKeys.clear();
      this.input.keyboard?.resetKeys?.();
    },
    resetJoystick: () => this.joystick.reset(),
    stopMovement: () => this.stopPlayerMovement(),
  },
});
this.playerRuntime.createAnimations();
this.playerRuntime.enableControls(this.time.now);
```

不要把 Sprite/Body 交给相机或其他模块；只消费 `position` 快照。

### 6.3 update

保留当前 `keyboardDirection -> resolveMovement`，把结果先交给：

```ts
const playerUpdate = this.playerRuntime.update(direction, this.time.now);
```

- `playerUpdate.movementDirection !== null`：继续走现有速度、`body.blocked`、walk 动画和最后方向逻辑。
- `movementDirection === null && visualLocked === true`：速度保持 0，不覆盖适配器正在播放的 idle/sitting/stand-up 动画。
- `movementDirection === null && visualLocked === false`：继续使用现有普通 idle 朝向帧。
- depth、桥状态和动态分块目标仍读取同一个 `this.player.x/y`，不改现有公式和顺序。

适配器在 `walking` 时只恢复普通贴图和朝向帧，不播放 walk 动画；因此现有撞墙静帧和 walk 动画仍由 Main 原逻辑唯一负责。

### 6.4 控制门与清理

- 现有 `handleWindowBlur` / visibility hidden 路径改为调用 `playerRuntime.blur(this.time.now)`；避免再额外维护第二套 reset 顺序。
- scene shutdown 时先 `playerRuntime.shutdown()`，再销毁 joystick 和其他场景资源，保证 shutdown effect 仍能安全调用 `joystick.reset()`。
- 第二波相机只能调用 `disableControls()` / `enableControls()`，不能直接管理键盘、摇杆或玩家速度。
- test hook 如需输出，只读 `playerRuntime.position` 和 `playerRuntime.control`；不要输出 Sprite/Body 引用。

## 7. Diff 摘要与风险

### Diff 摘要

- 新增约 340 行纯 TypeScript 玩家运行时状态机和只读契约。
- 新增约 517 行有界 Phaser 资源/动画适配器；不含移动、碰撞、depth 或相机逻辑。
- 新增 14 项运行时/适配器测试；原有玩家 13 项继续通过，玩家目录合计 27 项。
- `src/player/index.ts` 仅新增运行时导出，并统一为 LF 行尾以通过 diff 检查。

### 尚未解决 / 待 Main 验证

1. **真实接线未验证**：本窗口不能修改 `CampusScene`，因此浏览器中的动画、键盘/摇杆、碰撞和 depth 组合仍待 Main integration。
2. **production 资源产物待验证**：静态 `new URL` 已建立 Vite 可发现入口，但只有 Main 导入适配器后 build 才会实际发射资源；需在 integration 分支执行 build 和浏览器 Smoke。
3. **sitting 的 Z 粒子未实现**：本任务卡要求 30 秒 sitting 和公开 sitting 资源，没有授权扩展 SYS-FX；当前只保留 sitting 动画状态。
4. **完整玩法明确未实现**：没有沙滩触发、换装流程、怪物、传送、内容线或 SYS-CAMERA 航拍。
5. **单 Sprite 边界**：适配器按当前 `CampusScene` 单 Sprite 结构工作；没有引入原站双 Sprite 或通用实体框架。

## 8. 停止点

当前状态：`ready-for-preview`。

按任务卡停止：不 commit、不 merge、不 push，不进入 SYS-CAMERA。Human 接受实际 diff 后，再按 Main 指令使用明确路径提交。
