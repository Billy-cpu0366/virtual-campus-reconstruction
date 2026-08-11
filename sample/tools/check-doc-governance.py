#!/usr/bin/env python3
"""Deterministic document-governance checks for the virtual-campus project.

This tool validates structure only. It never decides whether a FACT, inference,
design boundary, reuse claim, or Human judgment is semantically correct.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOC_ROOT = PROJECT_ROOT / "doc" / "v0.1"

FINAL_PLAN = DOC_ROOT / "文档怎样保持清楚（治理方案）.md"
OLD_PLAN = DOC_ROOT / "旧版文档治理方案（已被替代）.md"
LEDGER = DOC_ROOT / "谁确认过什么（来源与决策记录）.md"
NODE_REGISTRY = DOC_ROOT / "02-整体怎么运作" / "功能总目录（节点清单）.md"
CAPABILITY_INDEX = DOC_ROOT / "01-目标与范围" / "原站有哪些功能（能力清单）.md"
ORIGINAL_BASELINE = DOC_ROOT / "04-怎么验证与还差什么" / "原站实际表现是什么（行为基准）.md"
UNKNOWN_QUEUE = DOC_ROOT / "05-还不清楚什么" / "还缺哪些答案（未知问题队列）.md"
TASK_PLAN = PROJECT_ROOT / "task_plan.md"
WORKFLOW_GUIDE = DOC_ROOT / "每轮工作怎么推进（流程速查）.md"
VERIFICATION_REPORT = DOC_ROOT / "04-怎么验证与还差什么" / "文档有没有对齐（治理检查报告）.md"

REQUIRED_FILES = [
    PROJECT_ROOT / "AGENTS.md",
    PROJECT_ROOT / "README.md",
    TASK_PLAN,
    WORKFLOW_GUIDE,
    DOC_ROOT / "README.md",
    FINAL_PLAN,
    OLD_PLAN,
    LEDGER,
    NODE_REGISTRY,
    CAPABILITY_INDEX,
    ORIGINAL_BASELINE,
    UNKNOWN_QUEUE,
]

EXPECTED_NODE_COLUMNS = [
    "ID",
    "名称",
    "类型",
    "父级引用",
    "范围处置",
    "原站理解状态",
    "重构工程状态",
    "证据等级",
    "来源引用",
    "唯一主定义",
    "处置理由或合并目标",
    "优先级",
]

ALLOWED_NODE_TYPES = {"系统", "对象", "事件", "能力", "数据", "约定"}
ALLOWED_SCOPE = {
    "candidate",
    "in-scope",
    "out-of-scope",
    "not-applicable",
    "merged",
}
ALLOWED_UNDERSTANDING = {"discovered", "partial", "confirmed"}
ALLOWED_ENGINEERING = {"undesign", "designed", "implemented", "verified"}
ALLOWED_EVIDENCE_TOKENS = {"FACT", "INFERRED", "UNKNOWN"}
ALLOWED_SYNC_STATUS = {"updated", "verified"}
ALLOWED_WORK_ITEM_LEVELS = {"level-1", "level-2"}
ALLOWED_WORK_ITEM_TYPES = {
    "investigation",
    "design",
    "implementation",
    "verification",
    "governance",
    "defect",
}
ALLOWED_CURRENT_WORK_ITEM_STATUS = {
    "awaiting-authorization",
    "active",
    "blocked",
    "paused",
}
ALLOWED_WORK_ITEM_PHASES = {
    "selection",
    "investigation",
    "design",
    "implementation-authorization",
    "implementation",
    "verification",
    "closure",
}
ALLOWED_CLOSED_WORK_ITEM_RESULTS = {
    "completed",
    "cancelled",
    "rejected",
    "superseded",
}

SOURCE_ARTIFACTS = {
    Path(r"C:\Users\inertnet\Desktop\项目讨论\luyin.txt"):
        "daddc72cb3d7999e73e747919b46e86a769b48d5e95f58a56776530fd01095d1",
    Path(r"C:\Users\inertnet\Desktop\项目讨论\文件结构说明(1).md"):
        "c5cc071dc522ec5a9fe4907d7b371be7033b8688d5f85b6863d13e722c971a03",
    Path(r"C:\Users\inertnet\Desktop\项目讨论\36264740f3a43475d4d037020804bf39.png"):
        "4ca042b8602de2e218e465491fcef4d6b1575003f24fb2f8845e8aa988122c85",
    Path(r"C:\Users\inertnet\Desktop\项目讨论\51a00f67e453420895a026db821a294f.jpg"):
        "18e207caa2985786fa415d5fd1825c64a30169158aa63075bab4f24c87c0d591",
    Path(r"C:\Users\inertnet\Desktop\项目讨论\8a3c1a30ad974875a494cb7350dd8499.jpg"):
        "1d79250f65f8ecb82e48034c2e29cbf4e6ca517bf404ab35f5be1418d28f524b",
    Path(r"C:\Users\inertnet\Desktop\项目讨论\a46d5fc63d375da2ca7e81bd75ba6691.png"):
        "579c64e9c718dd354a19197c69d4adb68616afc1711267a6064a3f8959a01d51",
}


@dataclass
class Result:
    errors: list[str]
    warnings: list[str]
    checks: int = 0

    def check(self, condition: bool, message: str) -> None:
        self.checks += 1
        if not condition:
            self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def frontmatter(path: Path) -> dict[str, str]:
    text = read_text(path)
    parts = text.split("---", 2)
    if len(parts) != 3 or parts[0] != "":
        return {}
    values: dict[str, str] = {}
    for line in parts[1].splitlines():
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*?)\s*$", line)
        if match:
            values[match.group(1)] = match.group(2)
    return values


def clean_cell(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value.startswith("`") and value.endswith("`"):
        return value[1:-1]
    return value


def split_table_row(line: str) -> list[str]:
    protected = re.sub(
        r"\[\[[^\]]+\]\]",
        lambda match: match.group(0).replace("|", "\x00"),
        line.strip("|"),
    ).replace(r"\|", "\x00")
    return [clean_cell(cell.replace("\x00", "|")) for cell in protected.split("|")]


def markdown_tables(path: Path) -> list[tuple[list[str], list[list[str]], int]]:
    lines = read_text(path).splitlines()
    tables: list[tuple[list[str], list[list[str]], int]] = []
    index = 0
    while index < len(lines):
        if not lines[index].startswith("|"):
            index += 1
            continue
        start = index + 1
        block: list[list[str]] = []
        while index < len(lines) and lines[index].startswith("|"):
            block.append(split_table_row(lines[index]))
            index += 1
        if len(block) >= 2 and all(re.fullmatch(r":?-+:?", cell) for cell in block[1]):
            tables.append((block[0], block[2:], start))
    return tables


def find_table(path: Path, first_header: str) -> tuple[list[str], list[list[str]], int] | None:
    for header, rows, line in markdown_tables(path):
        if header and header[0] == first_header:
            return header, rows, line
    return None


def heading_set(path: Path) -> set[str]:
    text = read_text(path)
    headings = {
        match.group(1).strip()
        for match in re.finditer(r"(?m)^#{1,6}\s+(.+?)\s*$", text)
    }
    explicit_anchors = {
        match.group(1)
        for match in re.finditer(r'<a\s+id=["\']([^"\']+)["\']\s*></a>', text)
    }
    return headings | explicit_anchors


def doc_files() -> list[Path]:
    return sorted(DOC_ROOT.rglob("*.md"))


def resolve_wiki_file(source: Path, path_part: str, files: list[Path]) -> set[Path]:
    relative = Path(path_part)
    if relative.suffix.lower() != ".md":
        relative = relative.with_suffix(".md")
    candidates = {
        candidate.resolve()
        for candidate in (
            source.parent / relative,
            PROJECT_ROOT / relative,
            DOC_ROOT / relative,
        )
        if candidate.exists()
    }
    if candidates:
        return candidates
    name = Path(path_part).name
    return {path.resolve() for path in files if path.stem == name}


def check_links(result: Result) -> None:
    files = doc_files() + [PROJECT_ROOT / "AGENTS.md", PROJECT_ROOT / "README.md", TASK_PLAN]
    unique_files = sorted({path.resolve() for path in files})
    for source in unique_files:
        text = read_text(source)
        source_headings = heading_set(source)
        for raw in re.findall(r"\[\[([^\]]+)\]\]", text):
            target = raw.split("|", 1)[0].strip()
            if target.startswith("#"):
                result.check(
                    target[1:] in source_headings,
                    f"missing internal heading link in {source.relative_to(PROJECT_ROOT)}: {raw}",
                )
                continue
            path_part, _, anchor = target.partition("#")
            candidates = resolve_wiki_file(source, path_part, unique_files)
            result.check(
                len(candidates) == 1,
                f"wiki link must resolve once in {source.relative_to(PROJECT_ROOT)}: {raw} ({len(candidates)} matches)",
            )
            if len(candidates) == 1 and anchor:
                target_file = next(iter(candidates))
                result.check(
                    anchor in heading_set(target_file),
                    f"missing target heading in {target_file.relative_to(PROJECT_ROOT)}: {anchor}",
                )
        for raw in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
            if re.match(r"^[a-z]+://", raw, re.IGNORECASE) or raw.startswith("mailto:"):
                continue
            path_part = raw.split("#", 1)[0]
            if not path_part:
                continue
            target = (source.parent / path_part).resolve()
            result.check(
                target.exists(),
                f"missing Markdown link in {source.relative_to(PROJECT_ROOT)}: {raw}",
            )


def check_markdown_shape(result: Result) -> None:
    files = doc_files() + [PROJECT_ROOT / "AGENTS.md", PROJECT_ROOT / "README.md", TASK_PLAN]
    for path in sorted({item.resolve() for item in files}):
        text = read_text(path)
        result.check(
            text.count("```") % 2 == 0,
            f"unbalanced fenced code blocks: {path.relative_to(PROJECT_ROOT)}",
        )
        lines = text.splitlines()
        index = 0
        while index < len(lines):
            if not lines[index].startswith("|"):
                index += 1
                continue
            counts: list[int] = []
            start = index + 1
            while index < len(lines) and lines[index].startswith("|"):
                counts.append(len(split_table_row(lines[index])))
                index += 1
            result.check(
                len(set(counts)) == 1,
                f"inconsistent Markdown table at {path.relative_to(PROJECT_ROOT)}:{start}",
            )


def check_human_first_titles(result: Result) -> None:
    for path in doc_files():
        if path.name == "README.md":
            continue
        text = read_text(path)
        title = re.search(r"(?m)^title: (.+)$", text)
        heading = re.search(r"(?m)^# (.+)$", text)
        result.check(
            title is not None and title.group(1) == path.stem,
            f"frontmatter title must match human-first file name: "
            f"{path.relative_to(PROJECT_ROOT)}",
        )
        result.check(
            heading is not None and heading.group(1) == path.stem,
            f"H1 must match human-first file name: "
            f"{path.relative_to(PROJECT_ROOT)}",
        )
        result.check(
            "> **一句话：" in text,
            f"missing human summary after title: "
            f"{path.relative_to(PROJECT_ROOT)}",
        )


def collect_table_ids(path: Path, first_header: str, prefix: str) -> set[str]:
    table = find_table(path, first_header)
    if not table:
        return set()
    _, rows, _ = table
    return {row[0] for row in rows if row and row[0].startswith(prefix)}


def check_frontmatter_and_decisions(result: Result) -> None:
    final = frontmatter(FINAL_PLAN)
    result.check(final.get("status") == "approved", "final plan status must be approved")
    result.check(final.get("decision-status") == "accepted", "DEC-DOC-GOV-001 must be accepted")
    result.check(final.get("persistence-status") == "persisted", "DEC-DOC-GOV-001 must be persisted")
    verification_status = final.get("verification-status")
    result.check(
        verification_status in {"pending", "verified"},
        "final plan verification status must be pending or verified",
    )
    if verification_status == "pending":
        result.check(final.get("verified-at") in {None, "", "null"}, "pending decision has verified-at")
        result.check(final.get("verified-commit") in {None, "", "null"}, "pending decision has verified-commit")
        result.check(final.get("verification-report") in {None, "", "null"}, "pending decision has verification-report")
    elif verification_status == "verified":
        verified_commit = final.get("verified-commit", "")
        report_ref = final.get("verification-report", "")
        result.check(bool(re.fullmatch(r"[0-9a-f]{40}", verified_commit)), "verified-commit must be a full SHA")
        result.check(final.get("verified-at") not in {None, "", "null"}, "verified-at missing")
        result.check(report_ref not in {None, "", "null"}, "verification-report missing")
        report_path = PROJECT_ROOT / report_ref
        result.check(report_path.exists(), f"verification report missing: {report_ref}")
        if report_path.exists():
            report = frontmatter(report_path)
            result.check(report.get("verification-status") == "verified", "report must be verified")
            result.check(report.get("baseline-commit") == verified_commit, "report baseline differs from verified-commit")
        try:
            subprocess.run(
                ["git", "-C", str(PROJECT_ROOT), "cat-file", "-e", f"{verified_commit}^{{commit}}"],
                check=True,
                capture_output=True,
            )
            git_status = subprocess.run(
                ["git", "-C", str(PROJECT_ROOT), "status", "--porcelain=v1"],
                check=True,
                capture_output=True,
                text=True,
            )
            result.check(not git_status.stdout.strip(), "verified attestation requires a clean worktree")
        except (OSError, subprocess.CalledProcessError):
            result.check(False, f"verified commit is not available: {verified_commit}")
    result.check(
        final.get("implementation-authorization") == "governance-sync-only",
        "implementation authorization must remain governance-sync-only",
    )
    old = frontmatter(OLD_PLAN)
    result.check(old.get("decision-id") == "DEC-DOC-GOV-000", "old proposal decision ID missing")
    result.check(old.get("decision-status") == "superseded", "old proposal must be superseded")
    result.check(old.get("superseded-by") == "DEC-DOC-GOV-001", "old proposal replacement link missing")
    ledger = read_text(LEDGER)
    decision_ids = re.findall(r"(?m)^### (DEC-[A-Z0-9-]+)\s", ledger)
    source_ids = re.findall(r"(?m)^### (SRC-[A-Z0-9-]+)\s", ledger)
    result.check(len(decision_ids) == len(set(decision_ids)), "decision IDs must be unique in ledger")
    result.check(len(source_ids) == len(set(source_ids)), "source IDs must be unique in ledger")
    result.check("### DEC-DOC-GOV-001 " in ledger, "DEC-DOC-GOV-001 ledger record missing")
    decision_section = ledger.split("### DEC-DOC-GOV-001 ", 1)[-1].split("## 4.", 1)[0]
    result.check("| 决策状态 | `accepted` |" in decision_section, "ledger accepted state missing")
    result.check("| 持久化状态 | `persisted`" in decision_section, "ledger persisted state missing")
    result.check("### DEC-WORK-RELAY-001 " in ledger, "DEC-WORK-RELAY-001 ledger record missing")
    relay_section = ledger.split("### DEC-WORK-RELAY-001 ", 1)[-1].split("### DEC-", 1)[0]
    result.check("| 决策状态 | `accepted` |" in relay_section, "work relay decision must be accepted")
    result.check("| 持久化状态 | `persisted`" in relay_section, "work relay decision must be persisted")
    result.check("### DEC-WORK-RELAY-002 " in ledger, "DEC-WORK-RELAY-002 ledger record missing")
    idle_section = ledger.split("### DEC-WORK-RELAY-002 ", 1)[-1].split("### DEC-", 1)[0]
    result.check("| 决策状态 | `accepted` |" in idle_section, "idle work-item decision must be accepted")
    result.check("| 持久化状态 | `persisted`" in idle_section, "idle work-item decision must be persisted")


def project_ref_path(raw: str) -> Path:
    path_part = raw.split("#", 1)[0]
    return PROJECT_ROOT / path_part


def decision_section(decision_id: str) -> str:
    marker = f"### {decision_id} "
    ledger = read_text(LEDGER)
    if marker not in ledger:
        return ""
    return ledger.split(marker, 1)[1].split("\n### ", 1)[0].split("\n## 4.", 1)[0]


def check_task_state(result: Result) -> dict[str, str]:
    values = frontmatter(TASK_PLAN)
    base_required = {
        "workflow-ref",
        "current-work-item",
        "current-phase",
        "current-gate",
        "gate-status",
        "next-phase",
    }
    for key in sorted(base_required):
        result.check(values.get(key) not in {None, ""}, f"task plan field missing: {key}")
    workflow_ref = values.get("workflow-ref", "")
    result.check(project_ref_path(workflow_ref).resolve() == WORKFLOW_GUIDE.resolve(), "workflow-ref must target the stable guide")
    result.check(project_ref_path(workflow_ref).exists(), "workflow-ref does not exist")

    work_item = values.get("current-work-item", "")
    active_fields = {
        "work-item-level",
        "work-item-type",
        "work-item-status",
        "node-refs",
        "scope-ref",
        "exit-criteria-ref",
        "authorization-ref",
        "preauthorized-next-work-item",
    }
    if work_item == "none":
        result.check(values.get("current-phase") == "work-item-selection", "no-current-WI state must select a work item")
        result.check(values.get("current-gate") == "none", "no-current-WI state must not claim a gate")
        result.check(values.get("gate-status") == "not-applicable", "no-current-WI gate status must be not-applicable")
        result.check(values.get("next-phase") == "pending-work-item-selection", "no-current-WI next phase is invalid")
        for key in sorted(active_fields):
            result.check(values.get(key) in {None, ""}, f"no-current-WI state must omit field: {key}")
    else:
        for key in sorted(active_fields):
            result.check(values.get(key) not in {None, ""}, f"task plan field missing: {key}")
        result.check(bool(re.fullmatch(r"WI-[A-Z0-9-]+", work_item)), f"invalid work item ID: {work_item}")
        result.check(values.get("work-item-level") in ALLOWED_WORK_ITEM_LEVELS, "invalid work item level")
        result.check(values.get("work-item-type") in ALLOWED_WORK_ITEM_TYPES, "invalid work item type")
        result.check(values.get("work-item-status") in ALLOWED_CURRENT_WORK_ITEM_STATUS, "invalid current work item status")
        phase = values.get("current-phase")
        result.check(phase in ALLOWED_WORK_ITEM_PHASES, f"unknown current phase: {phase}")
        result.check(values.get("next-phase") in ALLOWED_WORK_ITEM_PHASES, "invalid next phase")
        if values.get("work-item-level") == "level-1":
            result.check(values.get("current-gate") == "none", "level-1 work item must not claim a gate")
            result.check(values.get("gate-status") == "not-applicable", "level-1 gate status must be not-applicable")
        else:
            result.check(values.get("current-gate", "").startswith("GATE-"), "level-2 current gate ID is invalid")
        next_work_item = values.get("preauthorized-next-work-item", "")
        result.check(
            next_work_item == "none" or bool(re.fullmatch(r"WI-[A-Z0-9-]+", next_work_item)),
            "invalid preauthorized next work item",
        )
        if phase == "implementation-authorization":
            result.check(values.get("work-item-status") == "awaiting-authorization", "authorization phase must await authorization")
            result.check(
                values.get("gate-status") == "pending-human-implementation-authorization",
                "implementation authorization gate status is invalid",
            )
            result.check(values.get("authorization-ref") == "pending", "pending authorization must not cite a decision")
        if phase == "implementation":
            result.check(values.get("work-item-status") == "active", "implementation phase requires an active work item")
            result.check(values.get("gate-status") == "passed", "implementation phase requires a passed gate")
            result.check(values.get("authorization-ref", "").startswith("DEC-"), "active implementation requires a decision reference")
    text = read_text(TASK_PLAN)
    result.check(text.count("## 当前任务：") == 1, "exactly one current task is required")
    result.check(text.count("## 当前审查包：") == 0, "stale current review-package heading remains")
    for heading in ("## 已阻塞或暂停工作项", "## 近期候选", "## 已关闭工作项索引"):
        result.check(heading in text, f"work item section missing: {heading}")
    return values


def check_work_item_contract(
    result: Result,
    values: dict[str, str],
    nodes: dict[str, dict[str, str]],
) -> None:
    closed_table = find_table(TASK_PLAN, "工作项 ID")
    result.check(closed_table is not None, "closed work-item index missing")
    closed_ids: set[str] = set()
    if closed_table:
        header, rows, _ = closed_table
        result.check(
            header == ["工作项 ID", "结果", "涉及节点", "产物", "result-commit", "Human 决定"],
            "closed work-item index columns changed",
        )
        for row in rows:
            result.check(len(row) == 6, f"closed work-item row width invalid: {row[:1]}")
            if len(row) != 6 or row[0] == "—":
                continue
            item_id, outcome, node_cell, artifacts, result_commit, decision_refs = row
            result.check(bool(re.fullmatch(r"WI-[A-Z0-9-]+", item_id)), f"invalid closed work item ID: {item_id}")
            result.check(item_id not in closed_ids, f"duplicate closed work item ID: {item_id}")
            closed_ids.add(item_id)
            result.check(outcome in ALLOWED_CLOSED_WORK_ITEM_RESULTS, f"invalid closed work item result: {item_id}={outcome}")
            result.check(artifacts not in {"", "—"}, f"closed work item has no artifact: {item_id}")
            result.check(bool(re.fullmatch(r"[0-9a-f]{40}", result_commit)), f"closed work item result commit is invalid: {item_id}")
            result.check(decision_refs not in {"", "—"}, f"closed work item decision reference missing: {item_id}")
            for node_id in [part.strip() for part in node_cell.split(";") if part.strip()]:
                result.check(node_id in nodes, f"closed work item node does not exist: {item_id}={node_id}")
            if re.fullmatch(r"[0-9a-f]{40}", result_commit):
                try:
                    subprocess.run(
                        ["git", "-C", str(PROJECT_ROOT), "cat-file", "-e", f"{result_commit}^{{commit}}"],
                        check=True,
                        capture_output=True,
                    )
                except (OSError, subprocess.CalledProcessError):
                    result.check(False, f"closed work item result commit is unavailable: {item_id}={result_commit}")

    work_item = values.get("current-work-item", "")
    if work_item == "none":
        return
    result.check(work_item not in closed_ids, f"current work item is already closed: {work_item}")
    node_refs = {part.strip() for part in values.get("node-refs", "").split(";") if part.strip()}
    result.check(bool(node_refs), "current work item has no node reference")
    for node_id in sorted(node_refs):
        result.check(node_id in nodes, f"current work item node does not exist: {node_id}")
    scope_path = project_ref_path(values.get("scope-ref", ""))
    exit_path = project_ref_path(values.get("exit-criteria-ref", ""))
    result.check(scope_path.exists(), f"work item scope reference missing: {scope_path}")
    result.check(exit_path.exists(), f"work item exit reference missing: {exit_path}")
    if not scope_path.exists():
        return
    package = frontmatter(scope_path)
    level = values.get("work-item-level")
    status = values.get("work-item-status")
    authorization = values.get("authorization-ref", "")
    if level == "level-1":
        result.check(package.get("type") == "work-item-task-card", "level-1 scope-ref must be a task card")
        result.check(package.get("work-item-id") == work_item, "task card work item mismatch")
        result.check(package.get("work-item-level") == level, "task card level mismatch")
        result.check(package.get("work-item-type") == values.get("work-item-type"), "task card type mismatch")
        result.check(package.get("node-refs") == values.get("node-refs"), "task card node scope mismatch")
        result.check(package.get("main-definition") == "false", "task card must not be a main definition")
        result.check(package.get("status") == status, "task card status mismatch")
        section = decision_section(authorization)
        result.check(bool(section), f"level-1 selection decision missing: {authorization}")
        result.check("| 决策状态 | `accepted` |" in section, "level-1 selection decision is not accepted")
        result.check(work_item in section, "level-1 selection decision does not name current work item")
        for node_id in sorted(node_refs):
            result.check(node_id in section, f"level-1 selection decision does not include node: {node_id}")
        return

    result.check(package.get("type") == "implementation-authorization-package", "level-2 scope-ref must be an authorization package")
    result.check(package.get("work-item-id") == work_item, "authorization package work item mismatch")
    result.check(package.get("node-refs") == values.get("node-refs"), "authorization package node scope mismatch")
    result.check(package.get("main-definition") == "false", "authorization package must not be a main definition")
    if status == "awaiting-authorization":
        result.check(package.get("status") == "proposed", "awaiting work item package must be proposed")
        result.check(package.get("implementation-authorization") == "pending", "awaiting package authorization must be pending")
    if status == "active" and values.get("work-item-type") == "implementation":
        result.check(package.get("status") == "approved", "active implementation package must be approved")
        result.check(package.get("decision-status") == "accepted", "active implementation package decision must be accepted")
        result.check(package.get("implementation-authorization") == "authorized", "active implementation package must be authorized")
        section = decision_section(authorization)
        result.check(bool(section), f"authorization decision missing: {authorization}")
        result.check("| 决策状态 | `accepted` |" in section, "authorization decision is not accepted")
        result.check(work_item in section, "authorization decision does not name current work item")
        for node_id in sorted(node_refs):
            result.check(node_id in section, f"authorization decision does not include node: {node_id}")


def check_activation(result: Result, values: dict[str, str]) -> None:
    result.check(values.get("work-item-status") == "active", "activation mode requires an active work item")
    result.check(values.get("current-phase") == "implementation", "activation mode requires implementation phase")
    try:
        status = subprocess.run(
            ["git", "-C", str(PROJECT_ROOT), "status", "--porcelain=v1", "--untracked-files=all"],
            check=True,
            capture_output=True,
            text=True,
        )
        result.check(not status.stdout.strip(), "activation requires a clean worktree")
        changed = subprocess.run(
            ["git", "-C", str(PROJECT_ROOT), "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        )
        formal_src = [
            path for path in changed.stdout.splitlines()
            if path.replace("\\", "/").startswith("src/")
            and path.replace("\\", "/") != "src/README.md"
        ]
        result.check(not formal_src, f"activation commit contains formal source: {formal_src}")
    except (OSError, subprocess.CalledProcessError) as error:
        result.check(False, f"activation Git check failed: {error}")


def check_node_registry(result: Result) -> dict[str, dict[str, str]]:
    group_table = find_table(NODE_REGISTRY, "分组 ID")
    node_table = find_table(NODE_REGISTRY, "ID")
    result.check(group_table is not None, "concept group table missing")
    result.check(node_table is not None, "node registry table missing")
    if not group_table or not node_table:
        return {}
    group_header, group_rows, _ = group_table
    node_header, node_rows, line = node_table
    result.check(group_header == ["分组 ID", "名称", "父级", "主定义"], "group table columns changed")
    result.check(node_header == EXPECTED_NODE_COLUMNS, f"node columns changed at line {line}")
    groups = {row[0] for row in group_rows if row}
    for row in group_rows:
        result.check(len(row) == 4, f"group row width invalid: {row[:1]}")
        if len(row) == 4:
            result.check(row[2] in groups | {"ROOT"}, f"unresolved group parent: {row[0]}={row[2]}")
            result.check(row[3] not in {"", "—"}, f"group main definition missing: {row[0]}")
    nodes: dict[str, dict[str, str]] = {}
    for row in node_rows:
        result.check(len(row) == len(EXPECTED_NODE_COLUMNS), f"node row width invalid: {row[:1]}")
        if len(row) != len(EXPECTED_NODE_COLUMNS):
            continue
        item = dict(zip(EXPECTED_NODE_COLUMNS, row))
        node_id = item["ID"]
        result.check(node_id not in nodes, f"duplicate node ID: {node_id}")
        nodes[node_id] = item
        result.check(item["类型"] in ALLOWED_NODE_TYPES, f"invalid node type: {node_id}")
        result.check(item["范围处置"] in ALLOWED_SCOPE, f"invalid scope disposition: {node_id}")
        result.check(item["原站理解状态"] in ALLOWED_UNDERSTANDING, f"invalid understanding state: {node_id}")
        result.check(item["重构工程状态"] in ALLOWED_ENGINEERING, f"invalid engineering state: {node_id}")
        evidence_tokens = item["证据等级"].split("+")
        result.check(
            bool(evidence_tokens)
            and len(evidence_tokens) == len(set(evidence_tokens))
            and set(evidence_tokens) <= ALLOWED_EVIDENCE_TOKENS,
            f"invalid evidence level: {node_id}={item['证据等级']}",
        )
    valid_parents = groups | set(nodes) | {"ROOT"}
    main_definitions: dict[str, str] = {}
    for node_id, item in nodes.items():
        result.check(item["父级引用"] in valid_parents, f"unresolved parent for {node_id}: {item['父级引用']}")
        result.check(item["来源引用"] not in {"", "—"}, f"source reference missing: {node_id}")
        if item["重构工程状态"] == "undesign":
            pass
        else:
            main_ref = item["唯一主定义"]
            result.check(main_ref not in {"", "—"}, f"main definition missing: {node_id}")
            if main_ref not in {"", "—"}:
                result.check(main_ref not in main_definitions, f"duplicate main definition: {main_ref}")
                main_definitions[main_ref] = node_id
                path_part, _, anchor = main_ref.partition("#")
                target = PROJECT_ROOT / path_part
                result.check(target.exists(), f"main definition path missing for {node_id}: {main_ref}")
                if target.exists() and anchor:
                    result.check(anchor in heading_set(target), f"main definition anchor missing for {node_id}: {main_ref}")
        if item["范围处置"] in {"out-of-scope", "not-applicable", "merged"}:
            result.check(
                item["处置理由或合并目标"] not in {"", "—"},
                f"disposition reason missing: {node_id}",
            )
        if item["范围处置"] == "merged":
            result.check(
                item["处置理由或合并目标"] in nodes,
                f"merged target must be a node ID: {node_id}",
            )
    known_refs = set()
    known_refs |= collect_table_ids(CAPABILITY_INDEX, "ID", "CAP-")
    known_refs |= collect_table_ids(ORIGINAL_BASELINE, "ID", "BASE-")
    known_refs |= collect_table_ids(UNKNOWN_QUEUE, "ID", "Q-")
    ledger_text = read_text(LEDGER)
    known_refs |= set(re.findall(r"(?m)^### ((?:SRC|DEC)-[A-Z0-9-]+)\s", ledger_text))
    for node_id, item in nodes.items():
        for ref in [part.strip() for part in item["来源引用"].split(";")]:
            if re.fullmatch(r"(?:CAP|BASE|Q|SRC|DEC)-[A-Z0-9-]+", ref):
                result.check(ref in known_refs, f"unresolved source ID for {node_id}: {ref}")
            else:
                path_part, _, anchor = ref.partition("#")
                target = PROJECT_ROOT / path_part
                result.check(target.exists(), f"unresolved source path for {node_id}: {ref}")
                if target.exists() and anchor:
                    result.check(anchor in heading_set(target), f"unresolved source anchor for {node_id}: {ref}")
    capability_ids = collect_table_ids(CAPABILITY_INDEX, "ID", "CAP-")
    referenced = {
        ref.strip()
        for item in nodes.values()
        for ref in item["来源引用"].split(";")
        if ref.strip().startswith("CAP-")
    }
    result.check(capability_ids <= referenced, f"unmapped capability IDs: {sorted(capability_ids - referenced)}")
    return nodes


def check_affected_files(result: Result) -> None:
    table = next(
        (
            item
            for item in markdown_tables(LEDGER)
            if item[0] == ["文件", "目的", "状态"]
        ),
        None,
    )
    result.check(table is not None, "affected-file table missing")
    if not table:
        return
    header, rows, _ = table
    result.check(header == ["文件", "目的", "状态"], "affected-file table columns changed")
    for row in rows:
        if len(row) != 3:
            result.check(False, f"affected-file row width invalid: {row}")
            continue
        raw_path, _, status = row
        path = PROJECT_ROOT / raw_path
        result.check(path.exists(), f"affected file missing: {raw_path}")
        result.check(status in ALLOWED_SYNC_STATUS, f"affected file not synchronized: {raw_path}={status}")


def check_source_artifacts(result: Result) -> None:
    for path, expected in SOURCE_ARTIFACTS.items():
        if not path.exists():
            result.warn(f"restricted source unavailable on this machine: {path}")
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        result.check(actual == expected, f"restricted source hash mismatch: {path}")


def check_known_drift(result: Result) -> None:
    quick = read_text(WORKFLOW_GUIDE)
    plain = read_text(DOC_ROOT / "项目为什么这样做（通俗说明）.md")
    architecture = read_text(DOC_ROOT / "02-整体怎么运作" / "各部分怎样配合（系统依赖）.md")
    roadmap = read_text(DOC_ROOT / "项目走到哪一步（路线图与关卡）.md")
    report = read_text(VERIFICATION_REPORT)
    src_readme = read_text(PROJECT_ROOT / "src" / "README.md")
    result.check("系统全景与文档框架      🔄 正在确认" not in quick, "stale quick-guide phase remains")
    result.check("验收当前文档框架和执行约束" not in plain, "stale plain-guide next step remains")
    result.check(
        "原站地图分块是否按位置动态装载或卸载" not in architecture,
        "closed Q-MAP-001 still appears as open UNKNOWN",
    )
    result.check("| 阶段 6B Human 审查 | 是否接受 P0 差距映射和先研究地图分块的建议 | 等待 Human |" not in roadmap, "stale stage-6B roadmap state remains")
    result.check("| 阶段 6C | blocked |" not in report, "stale stage-6C report state remains")
    result.check("首个系统尚未完成详细设计" not in src_readme, "stale src entry remains")


def check_write_boundaries(result: Result, allow_formal_src: bool) -> None:
    commands = (
        ["git", "diff", "--name-only", "-z"],
        ["git", "diff", "--cached", "--name-only", "-z"],
        ["git", "ls-files", "--others", "--exclude-standard", "-z"],
    )
    changed: set[str] = set()
    try:
        for command in commands:
            completed = subprocess.run(
                [command[0], "-C", str(PROJECT_ROOT), *command[1:]],
                check=True,
                capture_output=True,
            )
            changed.update(
                path.replace("\\", "/")
                for path in completed.stdout.decode("utf-8", errors="replace").split("\0")
                if path
            )
    except (OSError, subprocess.CalledProcessError) as error:
        result.warn(f"git boundary check unavailable: {error}")
        return
    for path in sorted(changed):
        result.check(
            not path.startswith("sample/original-public-build/"),
            f"protected evidence path changed: {path}",
        )
        if path.startswith("src/") and path != "src/README.md":
            result.check(allow_formal_src, f"formal source changed without active authorization: {path}")


def check_pilot(result: Result, nodes: dict[str, dict[str, str]]) -> None:
    for node_id in ("SYS-CHUNK", "SYS-NPC"):
        result.check(node_id in nodes, f"pilot node missing: {node_id}")
    if "SYS-CHUNK" in nodes:
        chunk = nodes["SYS-CHUNK"]
        result.check(chunk["重构工程状态"] != "undesign", "pilot requires SYS-CHUNK detailed design")
        result.check(chunk["唯一主定义"] not in {"", "—"}, "pilot requires SYS-CHUNK main definition")
    if "SYS-NPC" in nodes:
        result.check(nodes["SYS-NPC"]["来源引用"] not in {"", "—"}, "NPC sample source missing")


def check_final_coverage(result: Result, nodes: dict[str, dict[str, str]]) -> None:
    candidates = [node_id for node_id, item in nodes.items() if item["范围处置"] == "candidate"]
    result.check(not candidates, f"final coverage has unresolved candidate nodes: {candidates}")
    destination_text = read_text(NODE_REGISTRY).split("## 候选关注点去向", 1)[-1]
    result.check("延后登记" not in destination_text, "final coverage has deferred candidate destinations")
    for node_id, item in nodes.items():
        if item["范围处置"] == "in-scope":
            result.check(item["重构工程状态"] == "verified", f"in-scope node not verified: {node_id}")


def run(mode: str) -> Result:
    result = Result(errors=[], warnings=[])
    for path in REQUIRED_FILES:
        result.check(path.exists(), f"required file missing: {path.relative_to(PROJECT_ROOT)}")
    if result.errors:
        return result
    check_frontmatter_and_decisions(result)
    task_values = check_task_state(result)
    check_markdown_shape(result)
    check_human_first_titles(result)
    check_links(result)
    nodes = check_node_registry(result)
    check_work_item_contract(result, task_values, nodes)
    check_affected_files(result)
    check_source_artifacts(result)
    check_known_drift(result)
    allow_formal_src = (
        mode != "activation"
        and task_values.get("work-item-status") == "active"
        and task_values.get("authorization-ref", "").startswith("DEC-")
    )
    check_write_boundaries(result, allow_formal_src)
    if mode in {"pilot", "final-coverage"}:
        check_pilot(result, nodes)
    if mode == "final-coverage":
        check_final_coverage(result, nodes)
    if mode == "activation":
        check_activation(result, task_values)
    return result


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=("sync", "pilot", "final-coverage", "activation"),
        default="sync",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)
    try:
        result = run(args.mode)
    except Exception as error:  # deterministic internal-error exit
        print(f"DOC_GOVERNANCE_INTERNAL_ERROR: {error}", file=sys.stderr)
        return 2
    status = "PASS" if not result.errors else "FAIL"
    print(f"DOC_GOVERNANCE_{status} mode={args.mode} checks={result.checks}")
    for warning in result.warnings:
        print(f"WARNING: {warning}")
    for error in result.errors:
        print(f"ERROR: {error}")
    return 0 if not result.errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
