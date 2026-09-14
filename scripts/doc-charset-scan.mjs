// 扫描 doc/ 下所有 .md，报告不可见字符 / 损坏字符。
// 只读，不修改任何文件。
import fs from "node:fs";
import path from "node:path";

const ROOT = "doc";
const BAD = [
  [0xfffd, "FFFD 替换符"],
  [0x0000, "NUL 空字节"],
  [0xfeff, "BOM/ZWNBSP"],
  [0x200b, "ZWSP"],
  [0x200c, "ZWNJ"],
  [0x200d, "ZWJ"],
  [0x200e, "LRM"],
  [0x200f, "RLM"],
  [0x00ad, "软连字符"],
  [0x00a0, "NBSP"],
  [0x2002, "ENSP"],
  [0x2003, "EMSP"],
  [0x2009, "THINSP"],
  [0x202f, "NNBSP 窄不换行空格"],
  [0x2007, "FIGSP"],
  [0x2008, "PUNCTSP"],
  [0x200a, "HAIRSP"],
  [0x3000, "IDEOGRAPHIC SPACE"],
  [0x205f, "MMSP"],
  [0x2060, "WJ"],
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".md")) out.push(p);
  }
  return out;
}

let flagged = 0;
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, "utf8");
  const hits = [];
  for (const [cp, name] of BAD) {
    const ch = String.fromCharCode(cp);
    let count = 0;
    let i = text.indexOf(ch);
    while (i !== -1) {
      count += 1;
      i = text.indexOf(ch, i + 1);
    }
    if (count > 0) hits.push(`${name} x${count}`);
  }
  if (hits.length > 0) {
    flagged += 1;
    console.log(file.split(path.sep).join("/"), "->", hits.join("  "));
  }
}
console.log(flagged === 0 ? "干净：doc/ 下无不可见/损坏字符" : `共 ${flagged} 个文件有问题`);
