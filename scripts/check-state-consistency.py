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
7. 修正任务：issue-class ↔ active-route ↔ correction-phase ↔ DECISION引用

用法（从项目根运行）：
    python scripts/check-state-consistency.py
    python scripts/check-state-consistency.py --self-test

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

CORRECTION_ROUTES = {
    "not-applicable": "standard-workflow",
    "adjustment": "adjustment-flow",
    "defect": "defect-flow",
    "systemic-failure": "systemic-flow",
}
CORRECTION_PHASES = {
    "not-applicable": {"none"},
    "adjustment": {
        "classify", "desired-outcome", "impact-check", "implement",
        "targeted-verify", "completed",
    },
    "defect": {
        "classify", "reproduce", "diagnose", "failing-proof", "implement",
        "regression-verify", "completed",
    },
    "systemic-failure": {
        "freeze", "frozen-awaiting-wip-sync", "audit", "cluster",
        "human-plan-gate", "batch-implement", "full-regression",
        "human-acceptance", "completed",
    },
}
CORRECTION_DECISION = "DEC-AI-CORRECTION-ROUTING-001"
CORRECTION_PROTOCOL = "03-执行层/修正任务分流协议.md"


def read(rel):
    return io.open(os.path.join(ROOT, rel), encoding="utf-8").read()


def work_item_ids(text):
    return re.findall(r"WI-[A-Z0-9-]+", text)


def relpath(p):
    return os.path.relpath(p, ROOT).replace("\\", "/")


def frontmatter_value(text, key):
    match = re.search(r"^" + re.escape(key) + r":\s*(\S+)", text, re.M)
    return match.group(1).strip() if match else None


def correction_state_errors(fields, current_work_item, decision_text):
    errors = []
    required = (
        "correction-ref", "issue-class", "active-route", "correction-phase",
        "classification-trigger", "classification-ref",
    )
    for key in required:
        if not fields.get(key):
            errors.append(f"task_plan: 缺修正分流字段 {key}")

    issue_class = fields.get("issue-class")
    if issue_class not in CORRECTION_ROUTES:
        if issue_class is not None:
            errors.append(f"task_plan: 未知 issue-class = {issue_class}")
        return errors

    route = fields.get("active-route")
    expected_route = CORRECTION_ROUTES[issue_class]
    if route != expected_route:
        errors.append(
            f"task_plan: issue-class={issue_class} 但 active-route={route}"
            f"（应 {expected_route}）"
        )

    phase = fields.get("correction-phase")
    if phase not in CORRECTION_PHASES[issue_class]:
        allowed = "/".join(sorted(CORRECTION_PHASES[issue_class]))
        errors.append(
            f"task_plan: issue-class={issue_class} 但 correction-phase={phase}"
            f"（允许 {allowed}）"
        )

    trigger = fields.get("classification-trigger", "")
    if trigger and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", trigger):
        errors.append(
            "task_plan: classification-trigger 必须是非空小写短横线标识"
        )

    protocol_ref = fields.get("correction-ref")
    if protocol_ref != CORRECTION_PROTOCOL:
        errors.append(
            f"task_plan: correction-ref={protocol_ref}（应 {CORRECTION_PROTOCOL}）"
        )

    classification_ref = fields.get("classification-ref")
    if issue_class == "not-applicable":
        if classification_ref != "none":
            errors.append(
                "task_plan: issue-class=not-applicable 时 classification-ref 应为 none"
            )
    else:
        if current_work_item == "none":
            errors.append(
                f"task_plan: issue-class={issue_class} 但 current-work-item=none"
            )
        if classification_ref != CORRECTION_DECISION:
            errors.append(
                f"task_plan: issue-class={issue_class} 但 classification-ref="
                f"{classification_ref}（应 {CORRECTION_DECISION}）"
            )
        if CORRECTION_DECISION not in decision_text:
            errors.append(
                f"决策记录.md 找不到修正分流决定 {CORRECTION_DECISION}"
            )

    return errors


def run_self_test():
    decision_text = CORRECTION_DECISION
    base = {
        "correction-ref": CORRECTION_PROTOCOL,
        "classification-trigger": "self-test",
    }
    valid = [
        ({**base, "issue-class": "not-applicable", "active-route": "standard-workflow",
          "correction-phase": "none", "classification-ref": "none"}, "none"),
        ({**base, "issue-class": "adjustment", "active-route": "adjustment-flow",
          "correction-phase": "implement", "classification-ref": CORRECTION_DECISION}, "WI-TEST-001"),
        ({**base, "issue-class": "defect", "active-route": "defect-flow",
          "correction-phase": "reproduce", "classification-ref": CORRECTION_DECISION}, "WI-TEST-001"),
        ({**base, "issue-class": "systemic-failure", "active-route": "systemic-flow",
          "correction-phase": "audit", "classification-ref": CORRECTION_DECISION}, "WI-TEST-001"),
    ]
    for fields, work_item in valid:
        assert not correction_state_errors(fields, work_item, decision_text)

    mismatch = {
        **base,
        "issue-class": "defect",
        "active-route": "adjustment-flow",
        "correction-phase": "audit",
        "classification-ref": "none",
    }
    failures = correction_state_errors(mismatch, "none", "")
    assert len(failures) >= 4
    print("PASS 修正分流状态机自测通过（4条合法路径 + 1组反例）")


def main():
    errors = []

    # ---- 1/2. task_plan 一致性（原有） ----
    tp = read("task_plan.md")
    m = re.search(r"^current-work-item:\s*(\S+)", tp, re.M)
    wi_fm = m.group(1).strip() if m else "<缺失>"

    correction_fields = {
        key: frontmatter_value(tp, key)
        for key in (
            "correction-ref", "issue-class", "active-route", "correction-phase",
            "classification-trigger", "classification-ref",
        )
    }
    errors.extend(
        correction_state_errors(correction_fields, wi_fm, read("决策记录.md"))
    )
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
    non_system_docs = {
        "README.md",
        "00-总账.md",
        "GitHub交付中转协议.md",
        "修正任务分流协议.md",
    }
    cards = [c for c in cards if os.path.basename(c) not in non_system_docs]

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

    print(
        f"PASS 状态一致性检查通过（当前工作项 = {wi_fm}，"
        f"修正路线 = {correction_fields['active-route']}，{len(cards)} 张执行卡无漂移）"
    )
    sys.exit(0)


if __name__ == "__main__":
    if "--self-test" in sys.argv[1:]:
        run_self_test()
    else:
        main()
