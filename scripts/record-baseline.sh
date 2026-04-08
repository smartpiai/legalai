#!/usr/bin/env bash
# record-baseline.sh — Emit baseline metrics JSON for Sprint 3 S3-019.
#
# Usage: record-baseline.sh <artifacts-dir> <output-json>
#
# Reads CI artifacts (pytest junit xml, vitest junit xml, coverage.xml,
# frontend coverage summary, build metrics json) and emits a consolidated
# baseline.json capturing: git sha, timestamp, backend/frontend test counts,
# coverage percentages, and docker compose build duration.
set -euo pipefail

ARTIFACTS_DIR=${1:-artifacts}
OUTPUT=${2:-baseline.json}

python3 - "$ARTIFACTS_DIR" "$OUTPUT" <<'PY'
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

artifacts = Path(sys.argv[1])
output = Path(sys.argv[2])


def git(*args, default=""):
    try:
        return subprocess.check_output(["git", *args], text=True).strip()
    except Exception:
        return default


def parse_junit(path: Path):
    if not path or not path.exists():
        return {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
    totals = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    for suite in suites:
        for key in totals:
            totals[key] += int(suite.attrib.get(key, 0) or 0)
    return totals


def parse_cobertura(path: Path):
    if not path or not path.exists():
        return None
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return None
    rate = root.attrib.get("line-rate")
    if rate is not None:
        try:
            return round(float(rate) * 100, 2)
        except ValueError:
            return None
    return None


def parse_vitest_coverage(summary_path: Path):
    if not summary_path or not summary_path.exists():
        return None
    try:
        data = json.loads(summary_path.read_text())
    except json.JSONDecodeError:
        return None
    total = data.get("total", {}).get("lines", {}).get("pct")
    return round(float(total), 2) if total is not None else None


def find(root: Path, *names):
    for name in names:
        for match in root.rglob(name):
            return match
    return None


backend_junit = find(artifacts / "backend", "pytest-report.xml", "junit.xml")
frontend_junit = find(artifacts / "frontend", "vitest-report.xml", "junit.xml")
backend_cov = find(artifacts / "backend", "coverage.xml")
frontend_cov_summary = find(artifacts / "frontend", "coverage-summary.json")
build_metrics_path = find(artifacts / "build", "build.json")

build_metrics = {}
if build_metrics_path and build_metrics_path.exists():
    try:
        build_metrics = json.loads(build_metrics_path.read_text())
    except json.JSONDecodeError:
        build_metrics = {}

payload = {
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "git": {
        "sha": git("rev-parse", "HEAD"),
        "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
    },
    "backend": {
        "tests": parse_junit(backend_junit),
        "coverage_pct": parse_cobertura(backend_cov),
    },
    "frontend": {
        "tests": parse_junit(frontend_junit),
        "coverage_pct": parse_vitest_coverage(frontend_cov_summary),
    },
    "build": {
        "duration_seconds": build_metrics.get("build_duration_seconds"),
    },
}

output.write_text(json.dumps(payload, indent=2))
print(f"Wrote baseline metrics to {output}")
PY
