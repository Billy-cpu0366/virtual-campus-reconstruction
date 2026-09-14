// 扫描 doc/ 下 .md 的「反引号代码片段」里被空格劈开的标识符。
// 判定方式很硬：把空格去掉拼起来，如果拼出来的词真的是代码里存在的标识符，
// 那这个空格就是损坏（例如 `setDept h` -> setDepth 确实存在于 src/）。
// 这样能避开 `npm run`、`git diff` 这类正常写法。
// 只读；输出供人工确认。
import fs from "node:fs";
import path from "node:path";

const DOC_ROOT = "doc";
const CODE_ROOTS = ["src", "game", "tests", "scripts"];

function collect(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      collect(p, out);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

// 代码里出现过的所有标识符
const IDENTIFIERS = new Set();
for (const file of CODE_ROOTS.flatMap((r) => collect(r))) {
  for (const m of fs.readFileSync(file, "utf8").matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
    IDENTIFIERS.add(m[0]);
  }
}

function collectDocs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collectDocs(p, out);
    else if (entry.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const SPAN = /`([^`\n]+)`/g;
let hits = 0;
for (const file of collectDocs(DOC_ROOT)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(SPAN)) {
      const span = m[1];
      if (!span.includes(" ")) continue;
      // 逐个空格试：把这一段空格去掉后是不是个真实标识符
      const words = span.split(" ");
      for (let k = 0; k < words.length - 1; k += 1) {
        const joined = words[k] + words[k + 1];
        if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(joined) && IDENTIFIERS.has(joined)) {
          hits += 1;
          console.log(
            `${file.split(path.sep).join("/")}:${i + 1}  ${JSON.stringify(span)}  -> "${joined}" 存在于代码中`,
          );
        }
      }
    }
  });
}
console.log(hits === 0 ? "\n干净：未发现被空格劈开的真实标识符" : `\n合计 ${hits} 处待确认`);
