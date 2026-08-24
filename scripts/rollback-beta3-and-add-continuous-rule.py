#!/usr/bin/env python3
"""Rollback global workflow beta.3 to beta.2, then add a small execution rule."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[1]
BETA3 = WORKSPACE / ".pi" / "designs" / "pi-project-workflow-v0.1.0-beta.3"
ROLLBACK = BETA3 / "scripts" / "upgrade-from-beta2.py"
START = "<!-- continuous-execution:start -->"
END = "<!-- continuous-execution:end -->"
BLOCK = """<!-- continuous-execution:start -->
## Continuous execution and completion

When Human asks to repair, investigate, or implement something, continue the
current task within its stated budget while local code, runtime behavior,
reproduction, browsing, or verification remains available.

A finished subtask, failed check, or insufficient evidence does not stop the
main task. Stop only when the task is complete, Human must decide, necessary
external information is unavailable, a safety or authorization boundary applies,
or the stated work budget is reached.

A passing automated check proves only that check. Report completion only after
the task's completion evidence exists, the normal path was replayed, and any
required Human Gate has passed.
<!-- continuous-execution:end -->"""


def atomic_write(path: Path, text: str) -> None:
    temporary = path.with_name(f".{path.name}.continuous.tmp")
    try:
        temporary.write_text(text, encoding="utf-8", newline="\n")
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--agent-dir", type=Path, required=True)
    args = parser.parse_args()
    agent_dir = args.agent_dir.expanduser().resolve()
    agents = agent_dir / "AGENTS.md"
    if not args.apply:
        print(json.dumps({"status": "preview", "changes": ["rollback-beta3-to-beta2", "append-continuous-rule"]}))
        return 0
    if not ROLLBACK.is_file() or not agents.is_file():
        raise SystemExit("required beta.3 rollback script or AGENTS.md is missing")
    before = agents.read_text(encoding="utf-8")
    if START in before and END not in before:
        raise SystemExit("continuous rule marker is incomplete")
    rollback = subprocess.run(
        [sys.executable, str(ROLLBACK), "--rollback", "--agent-dir", str(agent_dir)],
        text=True,
        capture_output=True,
        check=False,
    )
    if rollback.returncode != 0:
        raise SystemExit(rollback.stdout or rollback.stderr)
    rollback_receipt = json.loads(rollback.stdout)
    text = agents.read_text(encoding="utf-8")
    added = False
    if START not in text:
        atomic_write(agents, text.rstrip() + "\n\n" + BLOCK + "\n")
        added = True
    print(json.dumps({
        "status": "applied",
        "rollback": rollback_receipt,
        "continuousRule": "added" if added else "already-present",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
