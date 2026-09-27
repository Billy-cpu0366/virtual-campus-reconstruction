// Find misspelled identifiers in docs: tokens that look like code identifiers but
// do not exist anywhere in the codebase, while a near-miss (edit distance <= 2) does.
// Catches things like LayerMarkerReord -> LayerMarkerRecord, targeChunks -> targetChunks,
// retrun -> return, mater.json -> master.json, which the space-split / charset scans miss.
// Read-only.
import fs from "node:fs";
import path from "node:path";

const DOC_ROOT = "doc";
const CODE_ROOTS = ["src", "game", "tests", "scripts"];
const BUNDLE_ROOTS = ["sample/original-public-build/mirror"];

function walkFiles(dir, test, out = []) {
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
      walkFiles(p, test, out);
    } else if (test(entry.name)) out.push(p);
  }
  return out;
}

// Strip comments before ingesting. Without this the scanner poisons its own
// vocabulary: this file's header lists the very misspellings it hunts for
// ("retrun" -> "return"), scripts/ is a scanned root, so those examples get
// ingested as real identifiers and can never be reported again.
// The `[^:]` guard keeps "https://..." from being read as a comment.
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Build the vocabulary of identifiers that actually exist.
const VOCAB = new Set();
function ingest(text) {
  for (const m of text.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) VOCAB.add(m[0]);
}
for (const root of CODE_ROOTS) {
  for (const f of walkFiles(root, (n) => /\.(ts|tsx|js|mjs)$/.test(n))) {
    ingest(stripComments(fs.readFileSync(f, "utf8")));
  }
}
for (const root of BUNDLE_ROOTS) {
  for (const f of walkFiles(root, (n) => /\.(js|json)$/.test(n))) {
    ingest(fs.readFileSync(f, "utf8"));
  }
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = cur[j];
  }
  return prev[b.length];
}

// Bucket the vocabulary by length so near-miss lookup stays cheap.
const BY_LEN = new Map();
for (const w of VOCAB) {
  const k = w.length;
  if (!BY_LEN.has(k)) BY_LEN.set(k, []);
  BY_LEN.get(k).push(w);
}

function nearMiss(token) {
  let best;
  let bestD = 3;
  for (let len = token.length - 2; len <= token.length + 2; len += 1) {
    for (const w of BY_LEN.get(len) ?? []) {
      if (w === token) continue;
      const d = editDistance(token, w);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
  }
  return best ? [best, bestD] : undefined;
}

// A token worth checking: identifier-shaped, long enough, and not obviously prose.
const CANDIDATE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
// Require internal capitalization: camelCase (fooBar) or PascalCase with >=2 humps
// (LayerMarkerRecord). This excludes plain English words (observations, verified),
// ALL-CAPS prose acronyms (README, PORTAL) and bare filenames (tsconfig, gitignore),
// which made the first pass uselessly noisy.
function worthChecking(t) {
  if (t.length < 6) return false;
  if (!/^(?:[a-z]+[A-Z][A-Za-z0-9]*|[A-Z][a-z]+[A-Z][A-Za-z0-9]*)$/.test(t)) return false;
  return t !== "JavaScript";
}

let hits = 0;
const seen = new Set();

for (const file of walkFiles(DOC_ROOT, (n) => n.endsWith(".md"))) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    // No fence tracking here on purpose. A naive toggle is only correct when
    // every ``` is paired, and these docs are damaged: 03-图层与遮挡.md pairs
    // 231 with 235, so line 235's ```typescript reads as a *closer* and every
    // token after it is skipped — which is exactly how LayerMarkerReord hid.
    // Scan every line instead and let worthChecking() reject prose; the
    // capitalization rule is what keeps this quiet, not the fence state.
    const tokens = [];
    for (const m of line.matchAll(/`([^`\n]+)`/g)) {
      for (const t of m[1].matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) tokens.push(t[0]);
    }
    for (const t of line.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) tokens.push(t[0]);
    for (const t of tokens) {
      if (!CANDIDATE.test(t) || !worthChecking(t)) continue;
      if (VOCAB.has(t)) continue;
      const key = `${file}:${t}`;
      if (seen.has(key)) continue;
      const nm = nearMiss(t);
      if (!nm) continue;
      seen.add(key);
      hits += 1;
      console.log(
        `${file.split(path.sep).join("/")}:${i + 1}  ${t}  ->  ${nm[0]}  (distance ${nm[1]})`,
      );
    }
  });
}
console.log(hits === 0 ? "\nClean: no misspelled identifiers found" : `\n${hits} candidate(s)`);
