// 扫描 doc/ 下 .md 里混入的繁体字（本项目文档一律简体）。
// 只读，不改文件。
// 字表用纯 ASCII 的码点写，避免源码里的中文字面量被写坏。
// 只收「简体写法不同形」的字；简繁同形的字（用、文、清、真、片、版、牌、食、首…）不能入表。
import fs from "node:fs";
import path from "node:path";

const TRAD_CODEPOINTS = [
  0x8996, 0x5e7e, 0x95a2, 0x9810, 0x8f09, 0x7db2, 0x8acb, 0x5c0d, 0x500b,
  0x9019, 0x8aaa, 0x6642, 0x6703, 0x70ba, 0x958b, 0x95dc, 0x904e, 0x9084,
  0x9032, 0x904b, 0x52d5, 0x73fe, 0x5be6, 0x767c, 0x9ebc, 0x6a23, 0x9ede,
  0x6578, 0x64da, 0x6aa2, 0x6e2c, 0x9a57, 0x8a3c, 0x74b0, 0x7bc0, 0x8ab2,
  0x5b78, 0x7fd2, 0x8a9e, 0x8b80, 0x5beb, 0x8a8d, 0x8b58, 0x89ba, 0x89c0,
  0x898b, 0x554f, 0x984c, 0x932f, 0x8aa4, 0x78ba, 0x6a19, 0x6e96, 0x865f,
  0x7a2e, 0x985e, 0x7e3d, 0x7d50, 0x69cb, 0x5716, 0x5c64, 0x7d1a, 0x7d71,
  0x7dda, 0x908a, 0x5340, 0x584a, 0x9801, 0x982d, 0x9ad4, 0x5834, 0x614b,
  0x8f49, 0x63db, 0x8b8a, 0x8abf, 0x53c3, 0x8907, 0x96dc, 0x7c21, 0x55ae,
  0x96e3, 0x820a, 0x8207, 0x5f9e, 0x5011, 0x4f86, 0x88e1, 0x96bb, 0x5152,
  0x5169, 0x6771, 0x8eca, 0x9580, 0x9577, 0x99ac, 0x9ce5, 0x9f8d, 0x98a8,
  0x98db, 0x5099, 0x984d, 0x9854, 0x9846, 0x9aee, 0x9bae, 0x9b5a, 0x5132,
  0x5ee3, 0x61c9, 0x64c1, 0x64f4, 0x6a94, 0x6a5f, 0x6b04, 0x6c92, 0x6f22,
  0x71df, 0x7522, 0x9f4a, 0x9f52, 0x9f61,
];
const TRAD = new Set(TRAD_CODEPOINTS.map((cp) => String.fromCodePoint(cp)));

const ROOT = "doc";
const MAX_LINES_PER_FILE = 8;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".md")) out.push(p);
  }
  return out;
}

let totalHits = 0;
let filesHit = 0;
for (const file of walk(ROOT)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const hits = [];
  lines.forEach((line, i) => {
    const found = [...line].filter((ch) => TRAD.has(ch));
    if (found.length > 0) hits.push([i + 1, found]);
  });
  if (hits.length === 0) continue;

  filesHit += 1;
  const allChars = [...new Set(hits.flatMap(([, f]) => f))];
  totalHits += hits.reduce((sum, [, f]) => sum + f.length, 0);
  console.log(`\n${file.split(path.sep).join("/")}`);
  console.log(`  出现字：${allChars.map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase()}`).join(" ")}`);
  for (const [lineNo, found] of hits.slice(0, MAX_LINES_PER_FILE)) {
    console.log(`  :${lineNo}  ${[...new Set(found)].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase()}`).join(" ")}`);
  }
  if (hits.length > MAX_LINES_PER_FILE) {
    console.log(`  …另有 ${hits.length - MAX_LINES_PER_FILE} 行`);
  }
}
console.log(
  totalHits === 0
    ? "\n干净：doc/ 下无繁体字混入"
    : `\n合计 ${totalHits} 处，涉及 ${filesHit} 个文件`,
);
