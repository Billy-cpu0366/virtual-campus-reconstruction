#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""状态一致性检查。

核对三处是否漂移（防止「改了 A 忘改 B」）：
1. `task_plan.md` frontmatter 的 `current-work-item`
2. `task_plan.md` 顶部「⏱ 当前状态」块里出现的工作项 ID
3. 理解层进度文件不应复制工作项 ID（应指路 task_plan.md）

用法（从项目根运行）：
    python scripts/check-state-consistency.py

退出码：0 = 通过；1 = 漂移（需要修）。
"""
import re
import sys
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    return io.open(os.path.join(ROOT, rel), encoding="utf-8").read()


def work_item_ids(text):
    return re.findall(r"WI-[A-Z0-9-]+", text)


def main():
    errors = []
    tp = read("task_plan.md")

    m = re.search(r"^current-work-item:\s*(\S+)", tp, re.M)
    wi_fm = m.group(1).strip() if m else "<缺失>"

    m2 = re.search(r"# 原站逆向重构计划\s*\n(.*?)\n## 目标", tp, re.S)
    block = m2.group(1) if m2 else ""
    wi_block = work_item_ids(block)

    if wi_fm == "none":
        if wi_block:
            errors.append(f"frontmatter = none，但顶部状态块出现工作项 {wi_block}")
    else:
        if not wi_block:
            errors.append(f"frontmatter = {wi_fm}，但顶部状态块没写任何 WI- 工作项")
        elif wi_fm not in wi_block:
            errors.append(f"frontmatter = {wi_fm} 与顶部状态块 {wi_block} 不一致")

    for rel in ["01-理解层/00-当前进度.md", "01-理解层/00-进度总览.md"]:
        wis = work_item_ids(read(rel))
        if wis:
            errors.append(f"{rel} 复制了工作项 ID {wis}，应改为指路 task_plan.md")

    if errors:
        print("FAIL 状态一致性检查未通过：")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    print(f"PASS 状态一致性检查通过（当前工作项 = {wi_fm}）")
    sys.exit(0)


if __name__ == "__main__":
    main()
