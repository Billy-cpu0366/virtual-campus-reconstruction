# SYS-LAYER最小视觉补证

## 范围

- 公开原站：`https://peteroravec.com/`
- 采集时间：见`observations.json`
- 视口：1280×720，Headless Chrome
- 工作项：`WI-SYS-LAYER-VISUAL-EVIDENCE-001`
- 只覆盖任务卡规定的5个场景，不是全站行为采集。

## 方法边界

采集脚本在浏览器内存中给公开`main-RV3Z53H4.js`增加一个只暴露既有`game`和`gameScene`引用的探针；公开站点和本地镜像均未被修改。探针匹配1处。

为了直接到达相隔较远的场景，脚本使用`player.setPosition + body.reset`临时移动玩家，再由原站自己的update、tween、碰撞和输入逻辑处理状态。bridge和footsteps的关键切换由方向键进入触发区。由此得到的证据证明“该坐标和输入下的运行行为”，不证明自然步行路线耗时或完整路径。

## 场景结果

| 场景 | 结果 | 直接运行证据 |
|---|---|---|
| layer6–10遮挡 | VERIFIED | 玩家从clear tile `(68,74)`进入layer8非零tile `(68,75)`；玩家depth由621.6变为623.2，layer8 depth为1700；截图中上层灌木覆盖玩家下半身，离开后恢复 |
| factory roof | VERIFIED | 进入`(360,904)`后`roof_factory`与`roof_factory2` alpha由1降为0；离开后恢复1；concert两层保持1 |
| bridge1 | VERIFIED | 从左入口自然方向键进入后down wall隐藏且碰撞tile从14变0，up wall碰撞tile从0变82，玩家depth变1650；从右出口离开后down wall与玩家常态depth恢复 |
| particles3位置 | VERIFIED_WITH_RESIDUAL_UNKNOWN | 优化运行Tilemap没有`particles3`层；玩家位于86格marker范围时，同时落入`protesters_rising(tileCount=86)`和`crowd_up`运行region，截图显示抗议人群；marker到trajectory region的直接消费者关系仍未在Bundle中定位 |
| footsteps | VERIFIED | 优化运行Tilemap没有`footsteps`层；在外部grid对应路径上方向键移动后，active `footprint` sprites由0增至5，depth均为450，截图显示脚印轨迹 |

## 关键文件

- `observations.json`：13个阶段状态、坐标、图层visible/alpha/depth、碰撞tile数和动态对象摘要；
- `01-upper-before.png`至`03-upper-after.png`：上层遮挡；
- `04-roof-before.png`至`06-roof-after.png`：roof淡隐与恢复；
- `07-bridge-before.png`至`10-bridge-exit.png`：bridge状态切换；
- `11-particles3.png`：particles3 marker区域；
- `12-footsteps-before.png`与`13-footsteps-after.png`：脚印生成前后。

## 结论标记

- `FACT`：截图与`observations.json`直接记录的坐标、depth、visible、alpha、碰撞tile数和active footprint数；
- `INFERRED`：particles3的86个marker与`protesters_rising(tileCount=86)`很可能表达同一抗议区域；
- `UNKNOWN`：particles3 tilelayer到trajectory region或动态消费者的直接转换链路；
- `DECISION`：重构仍按正式SYS-LAYER设计把particles3保留为marker数据，并在消费者明确前报告未完成。
