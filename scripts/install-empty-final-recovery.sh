#!/usr/bin/env bash
set -euo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source="$root/tools/pi-extensions/empty-final-recovery.ts"
sandbox_home="$(dirname -- "$root")-home"

if [ -n "${PI_CODING_AGENT_DIR:-}" ]; then
  agent_dir="$PI_CODING_AGENT_DIR"
elif [ -d "$sandbox_home/.pi/agent" ]; then
  agent_dir="$sandbox_home/.pi/agent"
else
  agent_dir="$HOME/.pi/agent"
fi

target_dir="$agent_dir/extensions"
target="$target_dir/empty-final-recovery.ts"

if [ "${1:-}" = "--print-target" ]; then
  printf '%s\n' "$target"
  exit 0
fi
if [ "$#" -gt 0 ]; then
  printf 'Usage: %s [--print-target]\n' "$0" >&2
  exit 2
fi
if [ ! -f "$source" ]; then
  printf 'Missing extension source: %s\n' "$source" >&2
  exit 1
fi

mkdir -p "$target_dir"
cp "$source" "$target"
printf 'Installed empty-final recovery extension: %s\n' "$target"
printf 'Return to Pi, enter /reload, then run '
printf '/empty-final-recovery-status.\n'
