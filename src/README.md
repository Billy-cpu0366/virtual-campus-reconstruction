# Src

此目录预留给正式重构源码，也是以后记录当前有效工程入口的位置。

`SYS-CHUNK` 详细设计已经通过 Human 审查。`DEC-SYS-CHUNK-CORE-001` 已接受 Node.js 22 LTS、npm、TypeScript strict 和 Vitest，并授权 `WI-SYS-CHUNK-CORE-001` 实现确定性纯逻辑 CORE。

原子激活提交通过治理检查并进入 clean Git 基线后，只允许建立 `src/chunk/*.ts`、`tests/chunk/*.test.ts` 及授权包列出的最小工程文件。Phaser、Vite、浏览器、网络请求、缓存、渲染和旧项目修改当前均未授权。
