#!/usr/bin/env node
// Prepare the ignored runtime directory from versioned public evidence.
// This is the only supported way to create public/ for the playable prototype.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = resolve(
  ROOT,
  "sample/original-public-build/mirror/assets",
);
const RUNTIME_ROOT = resolve(ROOT, "public");
const SANITIZER = resolve(ROOT, "scripts/sanitize-runtime-maps.mjs");
const CONTENT_MANIFEST = resolve(ROOT, "scripts/runtime-content-assets.json");

const FILES = [
  ["maps/exterior-final.webp", "maps/exterior-final.webp"],
  ["maps/collisions-objects.png", "maps/collisions-objects.png"],
  ["maps/tileset-particles.png", "maps/tileset-particles.png"],
  ["sprites/player.webp", "sprites/player.webp"],
  ["js/phaser.min.js", "vendor/phaser.min.js"],
  ["maps/chunks/master.json", "maps/chunks/master.json"],
  ...Array.from({ length: 25 }, (_, index) => [
    `maps/chunks/chunk${index}.json`,
    `maps/chunks/chunk${index}.json`,
  ]),
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function safeResolve(root, relative, label) {
  const path = resolve(root, relative);
  if (path !== root && !path.startsWith(`${root}/`)) {
    throw new Error(`${label} escapes its root: ${relative}`);
  }
  return path;
}

for (const [sourceRelative, targetRelative] of FILES) {
  const source = safeResolve(SOURCE_ROOT, sourceRelative, "runtime source");
  const target = safeResolve(RUNTIME_ROOT, targetRelative, "runtime target");
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`copied ${sourceRelative} -> public/${targetRelative}`);
}

const contentAssets = JSON.parse(readFileSync(CONTENT_MANIFEST, "utf8"));
if (!Array.isArray(contentAssets) || contentAssets.length !== 10) {
  throw new Error("content runtime manifest must contain exactly 10 assets");
}
for (const asset of contentAssets) {
  const expectedTarget = String(asset.src).replace(/^\/+/, "");
  if (asset.targetRelative !== expectedTarget) {
    throw new Error(`content target does not match registry src: ${asset.src}`);
  }
  const source = safeResolve(SOURCE_ROOT, asset.sourceRelative, "content source");
  const target = safeResolve(RUNTIME_ROOT, asset.targetRelative, "content target");
  const sourceHash = sha256(source);
  if (sourceHash !== asset.sha256) {
    throw new Error(`content source hash mismatch: ${asset.sourceRelative}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  if (sha256(target) !== asset.sha256) {
    throw new Error(`content runtime hash mismatch: ${asset.targetRelative}`);
  }
  console.log(`copied ${asset.sourceRelative} -> public/${asset.targetRelative}`);
}

execFileSync(process.execPath, [SANITIZER], {
  cwd: ROOT,
  stdio: "inherit",
});

console.log("runtime assets prepared from sample public evidence");
