# Src

此目录保存正式重构源码。当前源码分为两类：已授权的确定性纯逻辑 CORE，以及尚未接入 Phaser 的运行时能力模型。

## 当前 CORE 入口

- `src/asset/`：资源 URL 和切块 tileset 发现
- `src/chunk/`：master 契约、坐标换算和目标 chunk 集合
- `src/world/`：世界规格、chunk 写入/清除和生命周期模型
- `src/layer/`：24 层策略、depth、roof/bridge 和 marker 规则
- `src/input/`：键盘/摇杆方向归一化
- `src/move/`：速度、碰撞体参数和 blocked 方向
- `src/player/`：玩家外观、帧映射、idle/换装状态模型
- `src/camera/`：相机参数、航拍序列和 nativeScale 换算

这些模块的当前实现主要是确定性纯逻辑；网络请求、真实 Phaser Tilemap、物理碰撞、触摸监听、渲染生命周期和浏览器行为仍由后续运行时工作项接入。

当前最小 Phaser 雏形位于 `game/`，只消费基础地图渲染、键盘移动、玩家走路动画和基础相机能力。
