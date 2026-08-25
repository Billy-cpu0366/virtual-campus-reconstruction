#!/usr/bin/env bash
set -euo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source="$root/tools/pi-extensions/empty-final-recovery.ts"
target_dir="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/extensions"
target="$target_dir/empty-final-recovery.ts"

if [ ! -f "$source" ]; then
  printf 'Missing extension source: %s\n' "$source" >&2
  exit 1
fi

mkdir -p "$target_dir"
cp "$source" "$target"
printf 'Installed empty-final recovery extension: %s\n' "$target"
printf 'Return to Pi and enter /reload to activate it.\n'
