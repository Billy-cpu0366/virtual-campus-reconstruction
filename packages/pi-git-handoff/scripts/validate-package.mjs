import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const command = isWindows ? "py.exe" : "python3";
const args = isWindows
  ? ["-3", "scripts/validate-package.py"]
  : ["scripts/validate-package.py"];
const result = spawnSync(command, args, { stdio: "inherit" });

if (result.error) {
  console.error(`${command} failed to start: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
