#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""状态一致性检查（单一事实源防漂移）。

核对以下漂移点（防止「改了 A 忘改 B」）：
1. task_plan.md frontmatter current-work-item 与顶部状态块一致
2. 理解层进度文件不复制工作项 ID（应指路 task_plan.md）
3. 逐系统：执行卡 status=designed 必须有人话块「## 👀 先看这里」
4. 逐系统：执行卡 status ↔ 理解卡「📌 进度」图标
5. 逐系统：执行卡 status ↔ 总账「16 系统总账」工程状态
6. 逐系统：执行卡 status ↔ 进度总览图标

用法（从项目根运行）：
    python scripts/check-state-consistency.py

退出码：0 = 通过；1 = 漂移（需要修）。
"""
import re
import sys
import io
import os
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 执行卡 frontmatter status 的取值约定
DESIGNED_STATES = {"designed", "implemented", "verified"}   # 已定稿及以上
UNDESIGNED_STATES = {"空槽", "undesign"}                    # 未定稿
DONE_ICONS = {"📐", "✅"}                                   # 已定稿对应的理解图标
TODO_ICONS = {"🔍", "🟡"}                                   # 未定稿对应的理解图标


def read(rel):
    return io.open(os.path.join(ROOT, rel), encoding="utf-8").read()


def work_item_ids(text):
    return re.findall(r"WI-[A-Z0-9-]+", text)


def relpath(p):
    return os.path.relpath(p, ROOT).replace("\\", "/")


def main():
    errors = []

    # ---- 1/2. task_plan 一致性（原有） ----
    tp = read("task_plan.md")
    m = re.search(r"^current-work-item:\s*(\S+)", tp, re.M)
    wi_fm = m.group(1).strip() if m else "<缺失>"
    m2 = re.search(r"# 原站逆向重构计划\s*\n(.*?)\n## 目标", tp, re.S)
    block = m2.group(1) if m2 else ""
    wi_block = work_item_ids(block)
    if wi_fm == "none":
        if wi_block:
            errors.append(f"task_plan: frontmatter = none，但顶部状态块出现工作项 {wi_block}")
    else:
        if not wi_block:
            errors.append(f"task_plan: frontmatter = {wi_fm}，但顶部状态块没写任何 WI- 工作项")
        elif wi_fm not in wi_block:
            errors.append(f"task_plan: frontmatter = {wi_fm} 与顶部状态块 {wi_block} 不一致")

    for rel in ["01-理解层/00-当前进度.md", "01-理解层/00-进度总览.md"]:
        wis = work_item_ids(read(rel))
        if wis:
            errors.append(f"{rel} 复制了工作项 ID {wis}，应改为指路 task_plan.md")

    # ---- 3-6. 逐系统漂移（执行卡 ↔ 理解卡 / 总账 / 进度总览） ----
    # 解析总账「16 系统总账」表：SYS-ID → (中文名, 工程状态)
    ledger = read("03-执行层/00-总账.md")
    ledger_systems = {}
    for line in ledger.splitlines():
        if line.startswith("| SYS-"):
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 7:
                ledger_systems[parts[1]] = (parts[2], parts[6])  # 中文名, 工程状态

    overview = read("01-理解层/00-进度总览.md")

    cards = sorted(
        glob.glob(os.path.join(ROOT, "03-执行层", "**", "*.md"), recursive=True)
    )
    cards = [c for c in cards if os.path.basename(c) not in ("README.md", "00-总账.md")]

    for card in cards:
        crel = relpath(card)
        text = read(crel)

        m = re.search(r"^system:\s*(\S+)", text, re.M)
        sysid = m.group(1).strip() if m else "<缺失>"
        m = re.search(r"^status:\s*(\S+)", text, re.M)
        status = m.group(1).strip() if m else "<缺失>"

        if status not in DESIGNED_STATES and status not in UNDESIGNED_STATES:
            errors.append(f"{crel}: 未知 status = {status}")
            continue

        is_designed = status in DESIGNED_STATES

        # 3. 人话块
        if is_designed and "## 👀 先看这里" not in text:
            errors.append(f"{sysid}: 执行卡 status={status} 但缺人话块「## 👀 先看这里」")

        # 4. 理解卡进度图标
        ud_rel = "01-理解层/" + crel[len("03-执行层/"):]
        try:
            ud_text = read(ud_rel)
        except IOError:
            errors.append(f"{sysid}: 找不到对应理解卡 {ud_rel}")
            continue
        m = re.search(r"📌 进度：([🔍🟡📐✅])", ud_text)
        if not m:
            errors.append(f"{sysid}: 理解卡 {ud_rel} 缺「📌 进度」行")
        else:
            icon = m.group(1)
            ok = DONE_ICONS if is_designed else TODO_ICONS
            if icon not in ok:
                want = "📐/✅" if is_designed else "🔍/🟡"
                errors.append(f"{sysid}: 执行卡 status={status} 但理解卡进度图标={icon}（应 {want}）")

        # 5/6. 总账工程状态 + 进度总览图标
        if sysid not in ledger_systems:
            errors.append(f"{sysid}: 总账「16 系统总账」表里找不到该系统的行")
            continue

        cn, eng = ledger_systems[sysid]
        if is_designed:
            if eng not in ("designed", "implemented", "verified"):
                errors.append(f"{sysid}: 执行卡 status={status} 但总账工程状态={eng}")
        else:
            if eng != "undesign":
                errors.append(f"{sysid}: 执行卡 status={status} 但总账工程状态={eng}（应 undesign）")

        pat = r"\|\s*" + re.escape(cn) + r"\s*\|\s*([🔍🟡📐✅])"
        m = re.search(pat, overview)
        if not m:
            errors.append(f"{sysid}: 进度总览找不到系统「{cn}」")
        else:
            icon = m.group(1)
            ok = DONE_ICONS if is_designed else TODO_ICONS
            if icon not in ok:
                want = "📐/✅" if is_designed else "🔍/🟡"
                errors.append(f"{sysid}: 执行卡 status={status} 但进度总览图标={icon}（应 {want}）")

    if errors:
        print("FAIL 状态一致性检查未通过：")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    print(f"PASS 状态一致性检查通过（当前工作项 = {wi_fm}，{len(cards)} 张执行卡无漂移）")
    sys.exit(0)


if __name__ == "__main__":
    main()
