#!/usr/bin/env node
// Prepare the ignored runtime directory from versioned public evidence.
// This is the only supported way to create public/ for the playable prototype.
import { copyFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = resolve(
  ROOT,
  "sample/original-public-build/mirror/assets",
);
const RUNTIME_ROOT = resolve(ROOT, "public");
const SANITIZER = resolve(ROOT, "scripts/sanitize-runtime-maps.mjs");

const FILES = [
  ["maps/exterior-final.webp", "maps/exterior-final.webp"],
  ["maps/collisions-objects.png", "maps/collisions-objects.png"],
  ["sprites/player.webp", "sprites/player.webp"],
  ["js/phaser.min.js", "vendor/phaser.min.js"],
  ["maps/chunks/master.json", "maps/chunks/master.json"],
  ...Array.from({ length: 25 }, (_, index) => [
    `maps/chunks/chunk${index}.json`,
    `maps/chunks/chunk${index}.json`,
  ]),
];

for (const [sourceRelative, targetRelative] of FILES) {
  const source = resolve(SOURCE_ROOT, sourceRelative);
  const target = resolve(RUNTIME_ROOT, targetRelative);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`copied ${sourceRelative} -> public/${targetRelative}`);
}

execFileSync(process.execPath, [SANITIZER], {
  cwd: ROOT,
  stdio: "inherit",
});

console.log("runtime assets prepared from sample public evidence");
