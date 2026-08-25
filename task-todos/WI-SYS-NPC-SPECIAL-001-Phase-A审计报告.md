---
work-item: WI-SYS-NPC-SPECIAL-001
type: audit-report
system: SYS-NPC
issue-class: systemic-failure
status: accepted-b0-complete
decision: DEC-SYS-NPC-PHASE-A-001
public-evidence: sample/original-public-build/mirror/chunk-WMFY56ZM.js
candidate-worktree: .pi/worktrees/visible-product-integration
candidate-head: ea8751260984fa6ef5e4589c2fbf196a6b28aa8c
updated: 2026-08-25
---

# SYS-NPC Phase A 机制与覆盖审计

> 本报告是Human机制Gate的候选输入，不是已接受设计，也不授权实现。公开Bundle证明原站机制；`ea87512`只证明当前失败candidate怎样实现；自动检查与Human视觉结果分开记录。

## 1. 状态与证据基线

- **已接受**：`DEC-SYS-NPC-SPECIAL-001`授权Phase A只读审计，父路线保持`systemic-flow / audit`。
- **已核对**：公开Bundle、`particle-trajectories.json`、SYS-NPC现有卡、05-B/05-D历史报告，以及失败candidate worktree。
- **candidate基线**：`.pi/worktrees/visible-product-integration`，分支`integration/visible-product-wave`，clean HEAD `ea87512`；候选链为`ef9f004 → 70aefe4 → 76beaf0 → ea87512`。
- **当前根检出事实**：根`master`没有`src/npc/`、`tests/npc/`或NPC production probe；当前实现只存在于上述integration worktree，尚未汇入根基线。
- **Human结果**：第三轮candidate虽有历史自动PASS记录，整体视觉仍为`human-visual-rejected`，不能作为正确基线。
- **B0更新**：[证据与合同收口](WI-SYS-NPC-SPECIAL-001-B0证据收口.md)已关闭train正常入口、公开route worker及rat/ghost/birds owner内部机制；铁路策略、三者正常产品入口和完整teardown仍保持UNKNOWN。

六种状态必须分开：`资源存在`、`创建链存在`、`正常入口可达`、`当前candidate已实现`、`自动验证`、`Human视觉通过`。前两项不能推出后四项。

## 2. 完整 owner 与六状态矩阵

| Owner | 公开资源/创建链 | 正常入口 | candidate实现 | 自动覆盖 | Human视觉 | 当前结论 |
|---|---|---|---|---|---|---|
| sprayer×4 | 有；`createNPCSpecials`及四配置 | intro/control条件仍有UNKNOWN | core+Phaser+Main | 单测有；无owner production probe | 未单独通过 | 专属owner；candidate全局创建与原站扩视口创建存在差异 |
| 常规route crowd | 有；11组公开注册 | 场景初始化链有证据 | core+Phaser+Main | 单测+route probe，未逐组覆盖 | 整体失败 | 路线owner；candidate A*是重构实现，不等于原站worker等价 |
| `crowd-train` | 有；离站10人、2400ms、count10 | FACT：正常`startGame→crowdTrain→departTrain→spawnTrainPassengers` | route子owner+Main火车事件 | 单测+route probe | Human曾观察约2人，与FACT目标count10不等价 | 配置10为目标上限，实例受成功路径和帧时序限制；铁路策略仍UNKNOWN |
| `crowd`/`crowd_up` | 有；25/21区域 | 场景初始化链有证据 | core+Phaser+Main | core单测；probe仅局部 | 整体失败 | 区域静态owner；配置人数不等于成功布点人数 |
| concert | 有；3区域 | 场景初始化链有证据 | venue core+Phaser+Main | core单测；无concert专项probe | 整体失败 | candidate缺方向/舞动表现，不能与protest合并验收 |
| `protesters_rising` | 有；1区域 | 场景初始化链有证据 | venue core+Phaser+Main | 单测+局部probe | 整体失败 | candidate“一部分动作”是DECISION，和公开逐NPC循环FACT不同 |
| bug | 有；10人wander | 初始注册链有证据 | 独立core+Phaser+Main | core单测；无Phaser/probe | 未单独通过 | candidate逐点裁剪，且缺朝向/走路呈现 |
| hazmat | 有；8人返回路线 | 初始注册链有证据 | route组内实现 | 仅配置级覆盖；无专项probe | 未单独通过 | 需单独验证纹理、delay、goBack与呈现偏移 |
| reading/eating/cat licking | 有；三固定配置 | 扩视口special创建链有证据 | static-special core+Phaser+Main | 单测+route probe物化 | 未单独通过 | 三个专属配置已实现，但300px逐点裁剪是重构DECISION |
| dancing | 有；8人、四方向资源 | 创建链有证据 | core+Phaser+Main | core单测；无Phaser/probe | 未单独通过 | candidate只有位置/循环动画，编排与运动不足 |
| rat attack | 有；40 rats及玩家回调 | 触发、路径、正常入口仍UNKNOWN | 无 | 无 | 无 | 不得直接实施，先补证据 |
| ghost | 有；class、walls grid、默认5、销毁链 | 延迟构造存在；正常产品触发UNKNOWN | 无 | 无 | 无 | 不得由资源/构造推断正常可达 |
| birds | 有；5随机+1固定路线 | 延迟调用存在；正常产品触发UNKNOWN | 无 | 无 | 无 | 不得由创建方法存在推断正常可达 |
| scientist/monk/dog/DJ/helicopter等 | 仅资源存在 | UNKNOWN | 无 | 无 | 无 | 保持资源-only UNKNOWN，不定义owner身份 |

公开证据定位：`chunk-WMFY56ZM.js`中`createNPCSpecials`约byte 546761、`spawnTrainPassengers`约445171、`createBirds`约545709、`createDancingNPCs`约549787、`createRatAttack`约550178；`particle-trajectories.json`共有88区域，其中`crowd=25`、`crowd_up=21`、`concert=3`、`protesters_rising=1`。

## 3. 每类 owner 固定机制表

### 3.1 Sprayer special

1. **配置/资源**：四个固定tile配置`(60,25)/(67,25)/(71,25)/(78,25)`，idle/running资源。
2. **激活/数量**：intro完成，玩家横向不超过2 tile、纵向差0..2；最近者先触发，余者按距离每300ms启动。
3. **位置/身份**：四锚点身份固定，不属于chunk tile owner。
4. **移动/动作**：速度140，沿各自公开逃跑路线，方向动画随路线段更新。
5. **生命周期**：扩视口范围内按配置创建；idle/spraying→fleeing→completed/destroyed。
6. **接口**：viewport、玩家位置、intro/control、Phaser tween/animation。
7. **失败/清理**：路线完成销毁；完整scene shutdown、跨场景intro复位、长路线跨chunk仍UNKNOWN。
8. **candidate覆盖**：`src/npc/sprayer.ts`、`game/PhaserSprayerRuntime.ts`、`tests/npc/sprayer.test.ts`；缺production probe，且candidate在场景开始创建全部四人。

### 3.2 Route manager（常规、train、bug、hazmat）

1. **配置/资源**：公开有11组常规路线配置；train离站另建10人；bug为10人wander；hazmat为8人返回路线。
2. **激活/数量**：常规组按路径配置启动；train由离站事件触发；实际实例上限受成功路径数量约束。
3. **位置/随机性**：公开机制会打乱已算路径、随机路径起点、速度与delay；精确随机结果不是FACT。
4. **移动/动作**：路线组含one-way/loop/goBack/wander等差异；bug速度15、2–4秒换目标；train速度35、2400ms延迟。
5. **生命周期**：路线按path语义激活；train与`loop-crowd`暂停/恢复连接；不能用单一屏幕点替代完整路径状态。
6. **接口**：墙/路径网格、viewport、火车事件、动画/深度。
7. **失败/清理**：候选有owner shutdown，但现有shutdown收据未覆盖route/bug的sprite/timer完整归零。
8. **candidate覆盖**：`routeCrowd.ts`使用8向A*、seeded edge noise和候选路径唯一分配；bug另有`bugCrowd.ts`。production probe偏重route/train，未单独覆盖bug/hazmat和完整teardown。

### 3.3 Region static（`crowd`/`crowd_up`）

1. **配置/资源**：JSON 25个`crowd`、21个`crowd_up`区域；无名区域只用region ID，不补造地点名。
2. **激活/数量**：区域面积推导目标数，polygon rejection最多尝试目标数×20，最小间距20；人数不是成功布点保证。
3. **位置/随机性**：每次region实例维护稳定位置列表；人物/朝向来自分组池，随机精确结果不冻结为FACT。
4. **移动/动作**：主体静态，公开机制有方向池和1秒look-around。
5. **生命周期**：按整个region bbox与相机worldView外扩100px创建/回收presentation。
6. **接口**：trajectory JSON、相机、纹理、动画和动态depth。
7. **失败/清理**：纹理缺失应形成owner失败；原站完整shutdown仍UNKNOWN。
8. **candidate覆盖**：`staticCrowd.ts`+`PhaserStaticCrowdRuntime.ts`采用400/500px滞后、每次最多16 sprite和显示层轨道偏移，均为重构DECISION；缺46区域完整视觉与Phaser专项probe。

### 3.4 Venue（concert/protest）

1. **配置/资源**：concert 3区域；protest 1区域、目标30、最小间距20。
2. **激活/数量**：均按region bbox外扩100px的公开生命周期；polygon内随机布点。
3. **位置/随机性**：位置在owner存活期间稳定，初始朝向来自各自池。
4. **移动/动作**：concert有方向/舞动表现；protest每NPC随机延迟0–2秒，动作0–2次后等待500–2000ms继续，并拥有口号气泡。
5. **生命周期**：region级创建/回收，不是逐点裁剪。
6. **接口**：trajectory JSON、相机、动画、气泡canvas/DOM定位。
7. **失败/清理**：候选有shutdown，但production probe不覆盖concert和气泡/方向/完整清理。
8. **candidate覆盖**：concert仅使用单一人物显示；protest固定约三分之一可动作、2–6秒idle、最多2人同时动作，这是DECISION而非公开FACT。

### 3.5 固定special、dancing、rat、ghost、birds

- **reading/eating/cat**：固定tile、scale和动画时长；candidate覆盖core/Phaser/物化probe，但300px逐点裁剪是DECISION。
- **dancing**：公开8人、区域、四方向资源；candidate只有随机位置/方向与循环动画，缺专属编排、Phaser测试和production probe。
- **rat**：公开40只及玩家回调；触发、路径、完成与清理证据不足，candidate完全未实现。
- **ghost**：公开读取walls grid、默认5、速度30–50、方向/depth/flashlight关系及显式destroy；正常入口触发UNKNOWN，candidate未实现。
- **birds**：公开5随机移动+1固定waypoint；正常入口与完整cleanup UNKNOWN，candidate未实现。

## 4. 统一差异与根因聚类

| 根因包 | 涉及owner | expected source | candidate实际 | Human/风险 | 结论 |
|---|---|---|---|---|---|
| RC-NPC-1 owner范围不完整 | rat/ghost/birds/resource-only、浅层concert/dancing | 公开创建链与任务A1 | 三类完全缺失，两类只有浅呈现 | “很多毛病”可在route自动PASS后继续存在 | 未知触发者先补证据；不得用通用框架填空 |
| RC-NPC-2 生命周期粒度错配 | sprayer、bug、dancing、static/venue | special扩视口、route path、region bbox+100 | 全局创建、逐点裁剪、400/500滞后混用 | 镜头内生成/消失与身份不稳定风险 | 按owner分别冻结，不统一成一种viewport算法 |
| RC-NPC-3 呈现行为丢失 | concert、protest、bug、dancing、static | 方向池、逐NPC动作/等待、走路/舞动 | 简化或缺失 | 计数与稳定ID probe无法发现 | 每owner必须有presentation测试和可见probe |
| RC-NPC-4 路线算法/地形仍是重构近似 | route/train/static | 公开路径配置、walls输入；铁路禁站未直接证实 | candidate A*、显示层轨道位移 | 可能“数值PASS、画面仍错” | 先把FACT、DECISION和产品偏好分开，不宣称原站等价 |
| RC-NPC-5 自动覆盖偏斜 | 全部 | owner级行为与Human Gate | 唯一production probe集中route/train与少量静态场景 | 357测试仍未阻止Human FAIL | 补owner级正常production路径与shutdown收据 |
| RC-NPC-6 状态源分叉 | 全部 | 根动态权威+candidate | 根master无NPC代码，candidate留在integration worktree | 不能把历史PASS冒充当前根基线 | Gate前固定candidate commit；实施与集成由Main统一接收 |

## 5. 推荐分批方案（PROPOSED）

### B0：证据与合同收口（推荐先做）

- 补齐train正常离站重放、rat触发/路径、ghost正常入口、birds正常入口、route worker/配置的直接链。
- 明确铁路/不可站区域究竟是原站FACT还是重构产品DECISION。
- 输出每owner六状态台账；UNKNOWN未解决时不进入对应实现。
- **成本/风险**：中等只读工作；主要风险是正常入口不可重放，只能继续UNKNOWN。

### B1：静态与venue呈现

- `crowd/crowd_up`、concert、protest分别实现region生命周期、稳定身份、方向与逐NPC动作。
- **验收**：region边界慢镜头、静止镜头、每类单独production probe、owner级Human视觉。
- **风险**：高密度sprite性能；公开随机无固定seed，验收应看语义而非像素级人物一致。

### B2：路线、train、bug、hazmat

- 分别冻结配置、路径候选、delay/goBack/wander、火车暂停恢复和呈现偏移。
- **验收**：逐组配置测试、路径/事件测试、普通production重放、train事件重放、Human视觉。
- **风险**：公开count10与Human观察冲突；A*等价和铁路策略仍需明确DECISION。

### B3：sprayer、固定special、dancing、rat

- 保持专属owner，不合并为通用NPC；rat只有B0证据足够后才进入。
- **验收**：触发、动作、路线/encounter完成、回收、owner级Human视觉。
- **风险**：跨chunk sprayer和rat触发仍可能UNKNOWN。

### B4：ghost与birds

- 仅在B0证明正常入口与生命周期后实施。
- **验收**：区域/flashlight/waypoint、销毁、正常production与Human视觉。
- **风险**：最高；不得从资源或延迟构造推断产品必达。

### B5：联合关闭

- 全owner正常路径、慢镜头边界、scene shutdown、sprite/timer/tween/listener收据、性能回归。
- 最后由Human整体验收；自动检查不能代签。

## 6. 复用观察

`route/path`、`region-static`、`special-trigger`、`encounter`和`moving-sprite`的激活、状态与清理差异显著。当前根检出也没有两个已集成、Human通过的owner显示稳定共同合同。因此继续`NO-GO`：不建立通用NPC/Entity框架。只保留已经有多个真实route消费者的`GridRouteCrowdPathProvider`候选能力，是否进入根基线仍由后续集成Gate决定。

## 7. Human机制Gate结果

Human在结构化Gate选择`接受并开始B0 (Recommended)`，已接受：

1. “SYS-NPC是owner家族，不是统一NPC runtime”的机制理解；
2. 六状态分离和上述RC-NPC-1..6统一差异表；
3. `B0→B1→B2→B3→B4→B5`顺序，先补证据再实现UNKNOWN owner；
4. 每批owner级Human视觉，最后再做一次整体视觉；
5. 保持不抽取通用NPC/Entity框架。

B0只读证据与合同收口已完成并落盘。当前B1静态与Venue实施包仍待Human授权；尚未授权修改`src/`、`game/`、测试、运行资源、`sample/`或失败candidate，B2-B5同样未授权。
