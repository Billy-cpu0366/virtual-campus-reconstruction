import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

// src/ 与 game/ 遵循 NodeNext 约定，相对导入带 `.js` 后缀但磁盘上是 `.ts` 源文件；
// 让 Vite 把 `./foo.js` 解析到 `./foo.ts`。
function jsToTs(): Plugin {
  return {
    name: "js-to-ts",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.startsWith(".") || !source.endsWith(".js")) return null;
      const base = importer ? dirname(importer) : process.cwd();
      const tsPath = resolve(base, source.slice(0, -3) + ".ts");
      return existsSync(tsPath) ? tsPath : null;
    },
  };
}

export default defineConfig({
  plugins: [jsToTs()],
});
