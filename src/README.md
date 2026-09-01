# Src

此目录预留给正式重构源码，也是以后记录当前有效工程入口的位置。

`SYS-CHUNK` 详细设计已经通过 Human 审查。`DEC-SYS-CHUNK-CORE-001` 已接受 Node.js 22 LTS、npm、TypeScript strict 和 Vitest，并授权 `WI-SYS-CHUNK-CORE-001` 实现确定性纯逻辑 CORE。

原子激活提交 `981a21e54ed7cd3eac3ec3bc5b26ce12bd8086a4` 已通过治理检查并进入 clean Git 基线。`WI-SYS-CHUNK-CORE-001` 的确定性 CORE 已在结果提交 `f04568f953821e8cc56c33a694171ddab759051f` 实现并通过26项单元测试。

当前正式入口为 `src/chunk/index.ts`，只包含 master 契约、坐标/索引、玩家3×3、相机+1和目标集合纯逻辑。Phaser、Vite、浏览器、网络请求、缓存、渲染和旧项目修改仍未授权。
