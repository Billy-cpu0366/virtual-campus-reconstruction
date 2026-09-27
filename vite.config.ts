import { cpSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
// 从 `vitest/config` 而不是 `vite` 导入：同一个 `defineConfig`，但多认下面的 `test` 段。
// 构建和开发时这两者等价。
import { defineConfig, type Plugin } from "vitest/config";

import {
  CONFIG_SETS_ROOT,
  isConfigSetName,
} from "./config/骨架/公共/config-location.ts";

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

/**
 * 磁盘上的配置集目录名 = 网址根去掉两边的斜杠。
 *
 * 从 `CONFIG_SETS_ROOT` 现算，不另写一个 "config"：这两处必须是同一个词，
 * 各写一份迟早会改成一根筋不一样。
 */
const CONFIG_DIR = CONFIG_SETS_ROOT.replace(/^\/+|\/+$/g, "");

/**
 * 把 `config/<集名>/` 下的 JSON 当作**普通静态文件**对外提供。
 *
 * 为什么非做不可：游戏是运行时才去取这些 JSON 的（见 骨架/公共/fetch-config-source.ts），
 * 取不到就进不去。而它们放在 `config/` 里是**有意为之**——和 `src/` 平级，
 * 换校园的人一眼就能找到，不该为了能被取到就塞进 `public/`。
 *
 * **一个校园一套**：网址上是 `/config/default/…` 还是 `/config/set1/…`，就读哪一套。
 * 哪些目录算「一套」由 `isConfigSetName()` 说了算——**只许小写英文、数字、`-`、`_`**。
 * 中文名的 `骨架/`、`文档/`、`工具/` 天然不合格，不必额外挡。
 *
 * 两件事：
 * - **开发时**：请求直接落到磁盘上的原文件。所以改一个数、刷新页面就生效，
 *   不需要重新构建——这是 1.3 的验收标准。
 * - **打包时**：每个集里的 JSON 复制进 `dist/config/<集名>/`，线上服务器照
 *   `/config/<集名>/` 就能取到。复制的是**文件**不是代码，所以上线之后想改配置，
 *   改 `dist/` 里那份、刷新即可，同样不用重新构建。以后新加 `set1/` 不用改这里。
 *
 * 只复制 `.json`：配置集里将来也可能有别的文件，那些不该出现在部署产物里。
 */
function configFiles(): Plugin {
  let root = process.cwd();

  /**
   * 网址 `/config/<集名>/…` 里的集名。不是这个形状的请求一概不管。
   *
   * 网址里的中文是百分号编码的（`%E9%85%8D…`），调用方要先 `decodeURIComponent`
   * 还原了再递进来，否则和前缀对不上。
   */
  const setFromRequest = (url: string): string | undefined => {
    if (!url.startsWith(CONFIG_SETS_ROOT)) return undefined;
    const rest = url.slice(CONFIG_SETS_ROOT.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return undefined;
    const set = rest.slice(0, slash);
    return isConfigSetName(set) ? set : undefined;
  };

  const isConfigRequest = (url: string): boolean =>
    url.endsWith(".json") && setFromRequest(url) !== undefined;

  return {
    name: "config-files",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // 先还原百分号编码，再比对前缀和集名。
        const raw = (req.url ?? "").split("?")[0] ?? "";
        let url: string;
        try {
          url = decodeURIComponent(raw);
        } catch {
          return next();
        }
        if (!isConfigRequest(url)) return next();
        const set = setFromRequest(url);
        if (set === undefined) return next();
        const setRoot = resolve(root, CONFIG_DIR, set);
        const filePath = resolve(root, url.slice(1));
        // 只许读这一个集底下的文件，挡住 `../` 这类越界请求。
        if (filePath !== setRoot && !filePath.startsWith(setRoot + sep)) {
          res.statusCode = 403;
          res.end("forbidden");
          return;
        }
        let body: string;
        try {
          body = readFileSync(filePath, "utf8");
        } catch {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
      });
    },
    closeBundle() {
      const from = resolve(root, CONFIG_DIR);
      const to = resolve(root, "dist", CONFIG_DIR);
      if (!existsSync(from) || !existsSync(resolve(root, "dist"))) return;
      for (const entry of readdirSync(from)) {
        if (!isConfigSetName(entry)) continue;
        cpSync(resolve(from, entry), resolve(to, entry), {
          recursive: true,
          filter: (source) =>
            statSync(source).isDirectory() || source.endsWith(".json"),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [jsToTs(), configFiles()],
  server: {
    port: 4175,
    strictPort: true,
  },
  preview: {
    port: 4175,
    strictPort: true,
  },
  test: {
    /**
     * 只跑 `tests/` 下的测试——**白名单，不是黑名单**。
     *
     * 为什么不写成「排除 `bak/`」：`bak/<阶段>-<日期>/` 是改动前的整份快照，里面
     * 可能带着当时那一版的 `tests/`。vitest 默认的收集范围是整个项目，于是快照里
     * 那份副本会被当成真测试跑起来，而它里面的相对 import（`../../config/...`）
     * 是相对快照目录解析的，必然失败——凭空多出一堆红。`tsconfig.json` 用的是同一
     * 个思路（`include` 里列白名单，`bak/` 天然不在内），这里对齐它。
     */
    include: ["tests/**/*.test.ts"],
  },
});
