#!/usr/bin/env python3
"""Validate the git-handoff candidate with a focused Draft-07 subset.

This is a static package validator, not a full JSON Schema implementation.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


PACKAGE_ROOT = Path(__file__).resolve().parent.parent
PACKAGE_VERSION = "0.1.0-alpha.4"
DRAFT_07 = "http://json-schema.org/draft-07/schema#"

EXPECTED_FILES = {
    "AGENTS.md",
    "README.md",
    "package.json",
    "skills/git-handoff/SKILL.md",
    "skills/git-handoff/references/failure-rules.md",
    "skills/git-handoff/references/protocol.md",
    "schemas/adapter-extension.v1.schema.json",
    "schemas/manifest.v1.schema.json",
    "schemas/receipt.v1.schema.json",
    "examples/adapter-extension.v1.json",
    "examples/manifest.v1.json",
    "examples/prepare-receipt.v1.json",
    "examples/verify-receipt.v1.json",
    "examples/push-receipt.v1.json",
    "scripts/core.mjs",
    "scripts/prepare.mjs",
    "scripts/verify-push.mjs",
    "scripts/validate-package.py",
    "tests/executors.test.mjs",
}

JSON_FILES = {
    "package.json",
    "schemas/adapter-extension.v1.schema.json",
    "schemas/manifest.v1.schema.json",
    "schemas/receipt.v1.schema.json",
    "examples/adapter-extension.v1.json",
    "examples/manifest.v1.json",
    "examples/prepare-receipt.v1.json",
    "examples/verify-receipt.v1.json",
    "examples/push-receipt.v1.json",
}

SCHEMA_FILES = {
    "schemas/adapter-extension.v1.schema.json": (
        "https://schemas.pi.local/git-handoff/adapter-extension.v1.schema.json",
        "examples/adapter-extension.v1.json",
    ),
    "schemas/manifest.v1.schema.json": (
        "https://schemas.pi.local/git-handoff/manifest.v1.schema.json",
        "examples/manifest.v1.json",
    ),
    "schemas/receipt.v1.schema.json": (
        "https://schemas.pi.local/git-handoff/receipt.v1.schema.json",
        None,
    ),
}

GENERIC_SCAN_FILES = {
    "skills/git-handoff/SKILL.md",
    "skills/git-handoff/references/failure-rules.md",
    "skills/git-handoff/references/protocol.md",
    "scripts/core.mjs",
    "scripts/prepare.mjs",
    "scripts/verify-push.mjs",
    "tests/executors.test.mjs",
    *SCHEMA_FILES,
}

PROJECT_SPECIFIC_FRAGMENTS = (
    "virtual" + "-campus-reconstruction",
    "virtual" + "-campus-prototype",
    "peter" + "-oravec-clone",
    "peter" + "-oravec",
    "billy" + "-cpu0366",
)

FORBIDDEN_CONTENT = (
    ("current project name", re.compile(
        "(?:" + "|".join(re.escape(value) for value in PROJECT_SPECIFIC_FRAGMENTS) + ")",
        re.IGNORECASE,
    )),
    ("real GitHub remote", re.compile(
        r"(?:https?://github\.com/|ssh://git@github\.com/|"
        r"git@github\.com:)",
        re.IGNORECASE,
    )),
    ("Windows user path", re.compile(
        r"[A-Za-z]:[\\/]+Users[\\/][^\s\"'<>]+", re.IGNORECASE
    )),
    ("/home path", re.compile(r"/home/", re.IGNORECASE)),
)

SUPPORTED_SCHEMA_KEYS = {
    "$defs",
    "$id",
    "$ref",
    "$schema",
    "additionalProperties",
    "allOf",
    "const",
    "contains",
    "description",
    "enum",
    "format",
    "if",
    "items",
    "maximum",
    "minItems",
    "minLength",
    "minProperties",
    "minimum",
    "pattern",
    "properties",
    "propertyNames",
    "required",
    "then",
    "title",
    "type",
    "uniqueItems",
}


class Validator:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.json_values: dict[str, Any] = {}

    def error(self, location: str, message: str) -> None:
        self.errors.append(f"ERROR {location}: {message}")

    def load_json(self, relative: str) -> Any | None:
        path = PACKAGE_ROOT / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            self.error(relative, f"cannot read file ({exc.strerror or 'read error'})")
            return None
        try:
            value = json.loads(text)
        except json.JSONDecodeError as exc:
            self.error(relative, f"invalid JSON at line {exc.lineno} column {exc.colno}")
            return None
        self.json_values[relative] = value
        return value

    def check_inventory(self) -> None:
        actual: set[str] = set()
        for path in PACKAGE_ROOT.rglob("*"):
            relative = path.relative_to(PACKAGE_ROOT)
            if path.is_file() and "__pycache__" not in relative.parts:
                actual.add(relative.as_posix())
        for relative in sorted(EXPECTED_FILES - actual):
            self.error(relative, "required package file is missing")
        for relative in sorted(actual - EXPECTED_FILES):
            self.error(relative, "unexpected package file")

    def check_package_metadata(self, package: Any | None) -> None:
        if not isinstance(package, dict):
            self.error("package.json", "root must be an object")
            return
        if package.get("name") != "pi-git-handoff":
            self.error("package.json#/name", "must be pi-git-handoff")
        if package.get("version") != PACKAGE_VERSION:
            self.error("package.json#/version", f"must be {PACKAGE_VERSION}")
        if package.get("private") is not True:
            self.error("package.json#/private", "must be true")
        pi = package.get("pi")
        if not isinstance(pi, dict):
            self.error("package.json#/pi", "must be an object")
            return
        if pi.get("skills") != ["./skills/git-handoff/SKILL.md"]:
            self.error(
                "package.json#/pi/skills",
                "must contain exactly ./skills/git-handoff/SKILL.md",
            )

    def check_skill(self) -> None:
        relative = "skills/git-handoff/SKILL.md"
        path = PACKAGE_ROOT / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            self.error(relative, f"cannot read file ({exc.strerror or 'read error'})")
            return

        lines = text.splitlines()
        if not lines or lines[0] != "---":
            self.error(relative, "frontmatter must start with ---")
            return
        try:
            end = lines.index("---", 1)
        except ValueError:
            self.error(relative, "frontmatter must end with ---")
            return

        fields: dict[str, str] = {}
        for line in lines[1:end]:
            if not line.strip() or ":" not in line:
                self.error(relative, "frontmatter contains an invalid line")
                continue
            key, value = line.split(":", 1)
            key = key.strip()
            if key in fields:
                self.error(relative, f"frontmatter repeats {key}")
            fields[key] = value.strip()
        if fields.get("name") != "git-handoff":
            self.error(relative, "frontmatter name must be git-handoff")
        if not fields.get("description"):
            self.error(relative, "frontmatter description must be non-empty")
        if fields.get("disable-model-invocation") != "true":
            self.error(relative, "frontmatter disable-model-invocation must be true")
        if set(fields) != {"name", "description", "disable-model-invocation"}:
            self.error(relative, "frontmatter keys are not the fixed contract")

        lowered = " ".join(text.lower().split())
        required_phrases = (
            "do not improvise",
            "project-level json adapter",
            "never run it from wsl",
            "prepare",
            "verify-push",
        )
        for phrase in required_phrases:
            if phrase not in lowered:
                self.error(relative, f"missing executor boundary text: {phrase}")

    def check_readme(self) -> None:
        relative = "README.md"
        path = PACKAGE_ROOT / relative
        try:
            lowered = path.read_text(encoding="utf-8").lower()
        except OSError as exc:
            self.error(relative, f"cannot read file ({exc.strerror or 'read error'})")
            return
        for phrase in ("real windows/github round trip", "not verified", "fake git runner"):
            if phrase not in lowered:
                self.error(relative, f"missing local-only verification boundary text: {phrase}")

    def check_schema_metadata(self, relative: str, schema: Any | None, expected_id: str) -> None:
        if not isinstance(schema, dict):
            self.error(relative, "root must be an object")
            return
        if schema.get("$schema") != DRAFT_07:
            self.error(relative, "root $schema must be Draft-07")
        if schema.get("$id") != expected_id:
            self.error(relative, "root $id is not the stable absolute package id")
        if not self.is_absolute_uri(schema.get("$id")):
            self.error(relative, "root $id must be an absolute URI")
        if schema.get("additionalProperties") is not False:
            self.error(relative, "root additionalProperties must be false")
        self.inspect_schema(schema, f"{relative}#")

    @staticmethod
    def is_absolute_uri(value: Any) -> bool:
        if not isinstance(value, str):
            return False
        parsed = urlparse(value)
        return bool(parsed.scheme and parsed.netloc)

    def inspect_schema(self, schema: Any, location: str) -> None:
        if not isinstance(schema, dict):
            self.error(location, "schema must be an object")
            return
        for key in sorted(set(schema) - SUPPORTED_SCHEMA_KEYS):
            self.error(location, f"unsupported schema keyword {key}")

        if "$ref" in schema:
            ref = schema["$ref"]
            if not isinstance(ref, str) or not ref.startswith("#/$defs/"):
                self.error(location, "only local #/$defs references are supported")
        if "$defs" in schema:
            defs = schema["$defs"]
            if not isinstance(defs, dict):
                self.error(location + "/$defs", "must be an object")
            else:
                for name in sorted(defs):
                    self.inspect_schema(defs[name], location + "/$defs/" + name)
        if "properties" in schema:
            properties = schema["properties"]
            if not isinstance(properties, dict):
                self.error(location + "/properties", "must be an object")
            else:
                for name in sorted(properties):
                    self.inspect_schema(properties[name], location + "/properties/" + name)
        for keyword in ("additionalProperties", "items", "contains", "propertyNames", "if", "then"):
            if keyword not in schema:
                continue
            value = schema[keyword]
            if keyword == "additionalProperties" and isinstance(value, bool):
                continue
            self.inspect_schema(value, location + "/" + keyword)
        for keyword in ("allOf",):
            if keyword in schema:
                value = schema[keyword]
                if not isinstance(value, list):
                    self.error(location + "/" + keyword, "must be an array")
                else:
                    for index, item in enumerate(value):
                        self.inspect_schema(item, f"{location}/{keyword}/{index}")
        if "format" in schema and schema["format"] != "date-time":
            self.error(location + "/format", "only date-time format is supported")
        if "pattern" in schema:
            try:
                re.compile(schema["pattern"])
            except (re.error, TypeError):
                self.error(location + "/pattern", "must be a valid regular expression")

    def resolve_ref(self, root: dict[str, Any], ref: Any, location: str) -> Any | None:
        if not isinstance(ref, str) or not ref.startswith("#/$defs/"):
            self.error(location, "only local #/$defs references are supported")
            return None
        name = ref[len("#/$defs/"):]
        defs = root.get("$defs")
        if not isinstance(defs, dict) or name not in defs:
            self.error(location, f"unresolved local reference {ref}")
            return None
        return defs[name]

    def validate_instance(
        self,
        instance: Any,
        schema: Any,
        root: dict[str, Any],
        location: str,
        report: bool = True,
    ) -> bool:
        start = len(self.errors)
        if not isinstance(schema, dict):
            if report:
                self.error(location, "schema must be an object")
            return False
        if "$ref" in schema:
            target = self.resolve_ref(root, schema["$ref"], location)
            if target is None:
                return False
            self.validate_instance(instance, target, root, location, report)

        expected = schema.get("type")
        if expected is not None and not self.matches_type(instance, expected):
            if report:
                self.error(location, f"must have type {self.type_text(expected)}")

        if "const" in schema and not self.json_equal(instance, schema["const"]):
            if report:
                self.error(location, f"must equal const {self.render(schema['const'])}")
        if "enum" in schema:
            values = schema["enum"]
            if isinstance(values, list) and not any(
                self.json_equal(instance, candidate) for candidate in values
            ):
                if report:
                    self.error(location, "must equal one of enum values")

        if isinstance(instance, dict):
            self.validate_object(instance, schema, root, location, report)
        elif isinstance(instance, list):
            self.validate_array(instance, schema, root, location, report)
        elif isinstance(instance, str):
            self.validate_string(instance, schema, location, report)
        elif self.is_number(instance):
            self.validate_number(instance, schema, location, report)

        for index, subschema in enumerate(schema.get("allOf", [])):
            self.validate_instance(
                instance, subschema, root, f"{location}/allOf/{index}", report
            )

        if "if" in schema and self.condition_matches(instance, schema["if"], root):
            if "then" in schema:
                self.validate_instance(instance, schema["then"], root, location, report)

        return len(self.errors) == start

    def condition_matches(self, instance: Any, schema: Any, root: dict[str, Any]) -> bool:
        if not isinstance(instance, dict) and isinstance(schema, dict) and "properties" in schema:
            return False
        if isinstance(instance, dict) and isinstance(schema, dict):
            properties = schema.get("properties")
            if isinstance(properties, dict) and any(
                name not in instance for name in properties
            ):
                return False
        probe = Validator()
        probe.validate_instance(instance, schema, root, "<condition>")
        return not probe.errors

    def validate_object(
        self,
        instance: dict[str, Any],
        schema: dict[str, Any],
        root: dict[str, Any],
        location: str,
        report: bool,
    ) -> None:
        required = schema.get("required", [])
        if isinstance(required, list):
            for name in required:
                if name not in instance and report:
                    self.error(location, f"missing required property {name}")
        if "minProperties" in schema and len(instance) < schema["minProperties"] and report:
            self.error(location, "has fewer than minProperties")

        properties = schema.get("properties", {})
        if not isinstance(properties, dict):
            return
        for name in sorted(properties):
            if name in instance:
                self.validate_instance(
                    instance[name], properties[name], root, f"{location}/{name}", report
                )

        additional = schema.get("additionalProperties", True)
        for name in sorted(set(instance) - set(properties)):
            if isinstance(additional, bool):
                if not additional and report:
                    self.error(location, f"unexpected property {name}")
            else:
                self.validate_instance(
                    instance[name], additional, root, f"{location}/{name}", report
                )

        property_names = schema.get("propertyNames")
        if property_names is not None:
            for name in sorted(instance):
                self.validate_instance(name, property_names, root, f"{location}/<property-name:{name}>", report)

    def validate_array(
        self,
        instance: list[Any],
        schema: dict[str, Any],
        root: dict[str, Any],
        location: str,
        report: bool,
    ) -> None:
        if "minItems" in schema and len(instance) < schema["minItems"] and report:
            self.error(location, "has fewer than minItems")
        if schema.get("uniqueItems") is True:
            seen: set[str] = set()
            for index, item in enumerate(instance):
                marker = self.render(item)
                if marker in seen and report:
                    self.error(location, f"contains duplicate item at index {index}")
                seen.add(marker)
        if "items" in schema:
            for index, item in enumerate(instance):
                self.validate_instance(item, schema["items"], root, f"{location}/{index}", report)
        if "contains" in schema:
            matches = any(
                self.validate_instance(item, schema["contains"], root, f"{location}/{index}", False)
                for index, item in enumerate(instance)
            )
            if not matches and report:
                self.error(f"{location}/contains", "must contain at least one item matching schema")

    def validate_string(
        self, instance: str, schema: dict[str, Any], location: str, report: bool
    ) -> None:
        if "minLength" in schema and len(instance) < schema["minLength"] and report:
            self.error(location, "is shorter than minLength")
        if "pattern" in schema:
            try:
                matched = re.search(schema["pattern"], instance) is not None
            except (re.error, TypeError):
                matched = False
            if not matched and report:
                self.error(location, "does not match pattern")
        if schema.get("format") == "date-time" and not self.valid_date_time(instance) and report:
            self.error(location, "is not a valid date-time")

    def validate_number(
        self, instance: int | float, schema: dict[str, Any], location: str, report: bool
    ) -> None:
        if "minimum" in schema and instance < schema["minimum"] and report:
            self.error(location, "is below minimum")
        if "maximum" in schema and instance > schema["maximum"] and report:
            self.error(location, "is above maximum")

    @staticmethod
    def valid_date_time(value: str) -> bool:
        if not re.fullmatch(
            r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})",
            value,
        ):
            return False
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return False
        return parsed.tzinfo is not None

    @staticmethod
    def matches_type(value: Any, expected: Any) -> bool:
        expected_types = expected if isinstance(expected, list) else [expected]
        for kind in expected_types:
            if kind == "object" and isinstance(value, dict):
                return True
            if kind == "array" and isinstance(value, list):
                return True
            if kind == "string" and isinstance(value, str):
                return True
            if kind == "boolean" and isinstance(value, bool):
                return True
            if kind == "null" and value is None:
                return True
            if kind == "integer" and isinstance(value, int) and not isinstance(value, bool):
                return True
            if kind == "number" and Validator.is_number(value):
                return True
        return False

    @staticmethod
    def is_number(value: Any) -> bool:
        return isinstance(value, (int, float)) and not isinstance(value, bool)

    @staticmethod
    def json_equal(left: Any, right: Any) -> bool:
        if type(left) is not type(right):
            return False
        if isinstance(left, dict) and isinstance(right, dict):
            return (
                left.keys() == right.keys()
                and all(Validator.json_equal(left[key], right[key]) for key in left)
            )
        if isinstance(left, list) and isinstance(right, list):
            return len(left) == len(right) and all(
                Validator.json_equal(a, b) for a, b in zip(left, right)
            )
        return left == right

    @staticmethod
    def render(value: Any) -> str:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)

    @staticmethod
    def type_text(value: Any) -> str:
        if isinstance(value, list):
            return " or ".join(str(item) for item in value)
        return str(value)

    def check_snapshot_risk_contains_regression(
        self, relative: str, schema: dict[str, Any], example: Any
    ) -> None:
        if not isinstance(example, dict):
            return
        candidate = json.loads(json.dumps(example))
        candidate["history-mode"] = "snapshot"
        candidate["unresolved-risks"] = []
        probe = Validator()
        probe.validate_instance(candidate, schema, schema, relative)
        expected_path = "/unresolved-risks/contains"
        if not any(expected_path in error for error in probe.errors):
            self.error(relative, "snapshot risk contains regression: empty risks were accepted")

    def check_forbidden_content(self) -> None:
        for relative in sorted(GENERIC_SCAN_FILES):
            path = PACKAGE_ROOT / relative
            try:
                text = path.read_text(encoding="utf-8")
            except OSError as exc:
                self.error(relative, f"cannot read file ({exc.strerror or 'read error'})")
                continue
            for label, pattern in FORBIDDEN_CONTENT:
                match = pattern.search(text)
                if match:
                    self.error(relative, f"forbidden {label}: {match.group(0)}")


def main() -> int:
    validator = Validator()
    validator.check_inventory()

    loaded: dict[str, Any | None] = {}
    for relative in sorted(JSON_FILES):
        loaded[relative] = validator.load_json(relative)

    validator.check_package_metadata(loaded.get("package.json"))
    validator.check_skill()
    validator.check_readme()

    schemas: dict[str, dict[str, Any]] = {}
    for relative, (expected_id, _) in SCHEMA_FILES.items():
        value = loaded.get(relative)
        validator.check_schema_metadata(relative, value, expected_id)
        if isinstance(value, dict):
            schemas[relative] = value

    example_schema_pairs = (
        ("examples/adapter-extension.v1.json", "schemas/adapter-extension.v1.schema.json"),
        ("examples/manifest.v1.json", "schemas/manifest.v1.schema.json"),
        ("examples/prepare-receipt.v1.json", "schemas/receipt.v1.schema.json"),
        ("examples/verify-receipt.v1.json", "schemas/receipt.v1.schema.json"),
        ("examples/push-receipt.v1.json", "schemas/receipt.v1.schema.json"),
    )
    for example, schema_file in example_schema_pairs:
        instance = loaded.get(example)
        schema = schemas.get(schema_file)
        if schema is not None and instance is not None:
            validator.validate_instance(instance, schema, schema, example)

    manifest_schema = schemas.get("schemas/manifest.v1.schema.json")
    manifest_example = loaded.get("examples/manifest.v1.json")
    if manifest_schema is not None and manifest_example is not None:
        validator.check_snapshot_risk_contains_regression(
            "examples/manifest.v1.json", manifest_schema, manifest_example
        )
    receipt_schema = schemas.get("schemas/receipt.v1.schema.json")
    receipt_example = loaded.get("examples/verify-receipt.v1.json")
    if receipt_schema is not None and receipt_example is not None:
        validator.check_snapshot_risk_contains_regression(
            "examples/verify-receipt.v1.json", receipt_schema, receipt_example
        )

    validator.check_forbidden_content()

    if validator.errors:
        for error in validator.errors:
            print(error)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
