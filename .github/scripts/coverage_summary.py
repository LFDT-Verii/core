#!/usr/bin/env python3
"""Generate coverage summaries for PR and non-PR workflow runs."""

from __future__ import annotations

import argparse
import os
import pathlib
import re
import subprocess
import sys
from collections import defaultdict


HUNK_RE = re.compile(r"@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
DA_RE = re.compile(r"^DA:(\d+),(-?\d+)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("pr", "general"), required=True)
    parser.add_argument("--coverage-dir", default="coverage-reports")
    parser.add_argument("--compare-branch", default="")
    parser.add_argument("--target", type=float, default=98.0)
    return parser.parse_args()


def summary_path() -> pathlib.Path:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        return pathlib.Path(path)
    return pathlib.Path("coverage-summary.md")


def normalize_path(path: str, workspace: str) -> str:
    value = path.strip().replace("\\", "/")
    if value.startswith("file://"):
        value = value[7:]

    workspace_norm = workspace.replace("\\", "/").rstrip("/")
    if workspace_norm and value.startswith(f"{workspace_norm}/"):
        value = value[len(workspace_norm) + 1 :]
    elif value.startswith("./"):
        value = value[2:]
    elif os.path.isabs(value):
        rel = os.path.relpath(value, workspace).replace("\\", "/")
        if not rel.startswith("../"):
            value = rel

    return value.lstrip("/")


def package_name(file_path: str) -> str:
    parts = file_path.split("/")
    if len(parts) >= 2 and parts[0] in {"packages", "servers", "tools"}:
        return f"{parts[0]}/{parts[1]}"
    if parts and parts[0]:
        return parts[0]
    return "(root)"


def find_lcov_files(coverage_dir: str) -> list[pathlib.Path]:
    base = pathlib.Path(coverage_dir)
    if not base.exists():
        return []
    return sorted(base.rglob("lcov.info"))


def parse_lcov(files: list[pathlib.Path], workspace: str) -> dict[str, dict[int, int]]:
    coverage: dict[str, dict[int, int]] = defaultdict(dict)

    for file_path in files:
        current_file = ""
        for raw_line in file_path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw_line.strip()
            if line.startswith("SF:"):
                current_file = normalize_path(line[3:], workspace)
                continue

            if line == "end_of_record":
                current_file = ""
                continue

            if not current_file:
                continue

            match = DA_RE.match(line)
            if not match:
                continue

            line_no = int(match.group(1))
            hits = int(match.group(2))
            existing = coverage[current_file].get(line_no, 0)
            coverage[current_file][line_no] = existing + hits

    return coverage


def file_stats(coverage: dict[str, dict[int, int]]) -> dict[str, dict[str, float]]:
    stats: dict[str, dict[str, float]] = {}
    for file_path, line_hits in coverage.items():
        total = len(line_hits)
        if total == 0:
            continue
        covered = sum(1 for hits in line_hits.values() if hits > 0)
        uncovered = total - covered
        percentage = (covered / total) * 100
        stats[file_path] = {
            "covered": float(covered),
            "total": float(total),
            "uncovered": float(uncovered),
            "coverage": percentage,
        }
    return stats


def aggregate_packages(stats: dict[str, dict[str, float]], package_filter: set[str] | None = None) -> list[dict[str, float | str]]:
    aggregates: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
    for file_path, data in stats.items():
        pkg = package_name(file_path)
        if package_filter is not None and pkg not in package_filter:
            continue
        aggregates[pkg][0] += data["covered"]
        aggregates[pkg][1] += data["total"]

    rows: list[dict[str, float | str]] = []
    if package_filter is not None:
        for pkg in package_filter:
            covered, total = aggregates.get(pkg, [0.0, 0.0])
            coverage_pct = (covered / total * 100) if total > 0 else float("nan")
            rows.append(
                {
                    "package": pkg,
                    "covered": covered,
                    "total": total,
                    "coverage": coverage_pct,
                }
            )
    else:
        for pkg, (covered, total) in aggregates.items():
            coverage_pct = (covered / total * 100) if total > 0 else float("nan")
            rows.append(
                {
                    "package": pkg,
                    "covered": covered,
                    "total": total,
                    "coverage": coverage_pct,
                }
            )

    measurable = [row for row in rows if row["total"] > 0]
    empty = [row for row in rows if row["total"] == 0]
    measurable.sort(key=lambda row: (float(row["coverage"]), str(row["package"])))
    empty.sort(key=lambda row: str(row["package"]))
    return measurable + empty


def format_percentage(value: float) -> str:
    if value != value:  # NaN
        return "N/A"
    return f"{value:.2f}%"


def parse_added_lines(compare_branch: str) -> dict[str, set[int]]:
    if not compare_branch:
        return {}

    result = subprocess.run(
        ["git", "diff", "--unified=0", "--no-color", f"{compare_branch}...HEAD"],
        check=True,
        capture_output=True,
        text=True,
    )

    added_lines: dict[str, set[int]] = defaultdict(set)
    current_file = ""

    for line in result.stdout.splitlines():
        if line.startswith("+++ "):
            candidate = line[4:]
            if candidate.startswith("b/"):
                candidate = candidate[2:]
            current_file = "" if candidate == "/dev/null" else candidate
            continue

        if not current_file:
            continue

        if line.startswith("@@ "):
            match = HUNK_RE.search(line)
            if not match:
                continue
            start = int(match.group(1))
            count = int(match.group(2)) if match.group(2) is not None else 1
            if count <= 0:
                continue
            for line_no in range(start, start + count):
                added_lines[current_file].add(line_no)

    return added_lines


def total_coverage(stats: dict[str, dict[str, float]]) -> tuple[float, float, float]:
    covered = sum(item["covered"] for item in stats.values())
    total = sum(item["total"] for item in stats.values())
    percentage = (covered / total * 100) if total > 0 else float("nan")
    return covered, total, percentage


def worst_files(
    stats: dict[str, dict[str, float]],
    limit: int,
    file_filter: set[str] | None = None,
) -> list[tuple[str, dict[str, float]]]:
    entries: list[tuple[str, dict[str, float]]] = []
    for path, data in stats.items():
        if file_filter is not None and path not in file_filter:
            continue
        if data["uncovered"] <= 0:
            continue
        entries.append((path, data))

    entries.sort(key=lambda item: (-item[1]["uncovered"], item[1]["coverage"], item[0]))
    return entries[:limit]


def write_summary(lines: list[str]) -> None:
    target = summary_path()
    with target.open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
        handle.write("\n")


def render_package_table(rows: list[dict[str, float | str]]) -> list[str]:
    if not rows:
        return ["- None"]

    lines = [
        "| Package | Coverage | Covered / Total |",
        "| --- | ---: | ---: |",
    ]
    for row in rows:
        covered = int(row["covered"])
        total = int(row["total"])
        lines.append(
            f"| `{row['package']}` | {format_percentage(float(row['coverage']))} | {covered} / {total} |"
        )
    return lines


def render_worst_files_section(rows: list[tuple[str, dict[str, float]]], title: str) -> list[str]:
    lines = [f"<details><summary>{title}</summary>", ""]
    if not rows:
        lines.append("- None")
    else:
        lines.extend(
            [
                "| File | Uncovered lines | Coverage | Covered / Total |",
                "| --- | ---: | ---: | ---: |",
            ]
        )
        for file_path, data in rows:
            lines.append(
                f"| `{file_path}` | {int(data['uncovered'])} | {format_percentage(data['coverage'])} | "
                f"{int(data['covered'])} / {int(data['total'])} |"
            )
    lines.extend(["", "</details>"])
    return lines


def run_pr_mode(
    coverage: dict[str, dict[int, int]],
    stats: dict[str, dict[str, float]],
    compare_branch: str,
    target: float,
) -> int:
    added_lines = parse_added_lines(compare_branch)
    changed_files = set(added_lines.keys())

    total_new_lines = sum(len(lines) for lines in added_lines.values())
    executable_new_lines = 0
    uncovered_new_lines = 0

    for file_path, lines in added_lines.items():
        line_hits = coverage.get(file_path)
        if not line_hits:
            continue
        for line_no in lines:
            if line_no not in line_hits:
                continue
            executable_new_lines += 1
            if line_hits[line_no] <= 0:
                uncovered_new_lines += 1

    diff_coverage = float("nan")
    if executable_new_lines > 0:
        diff_coverage = ((executable_new_lines - uncovered_new_lines) / executable_new_lines) * 100

    affected_packages = {package_name(path) for path in changed_files}
    package_rows = aggregate_packages(stats, affected_packages)
    worst_changed_files = worst_files(stats, limit=5, file_filter=changed_files)

    summary = [
        "### Coverage Summary (PR)",
        "",
        f"- New-line count: **{total_new_lines}**",
        f"- New uncovered lines: **{uncovered_new_lines}**",
        f"- Diff coverage: **{format_percentage(diff_coverage)}**",
        f"- Executable new lines in coverage data: **{executable_new_lines}**",
        "",
        "#### Per Affected Package Total Coverage (Worst to Best)",
        "",
        *render_package_table(package_rows),
        "",
        *render_worst_files_section(
            worst_changed_files,
            "Detailed view: 5 worst changed files by uncovered lines",
        ),
    ]
    write_summary(summary)

    if executable_new_lines > 0 and diff_coverage < target:
        print(
            f"Diff coverage check failed: {diff_coverage:.2f}% is below required {target:.2f}%",
            file=sys.stderr,
        )
        return 2
    return 0


def run_general_mode(stats: dict[str, dict[str, float]]) -> int:
    covered, total, percentage = total_coverage(stats)
    package_rows = aggregate_packages(stats, None)
    worst_overall_files = worst_files(stats, limit=5, file_filter=None)

    summary = [
        "### Coverage Summary (General Run)",
        "",
        f"- Total coverage: **{format_percentage(percentage)}**",
        f"- Total covered lines: **{int(covered)} / {int(total)}**",
        "",
        "#### Per Package Total Coverage (Worst to Best)",
        "",
        *render_package_table(package_rows),
        "",
        *render_worst_files_section(
            worst_overall_files,
            "Detailed view: 5 worst files by uncovered lines",
        ),
    ]
    write_summary(summary)
    return 0


def main() -> int:
    args = parse_args()
    workspace = os.environ.get("GITHUB_WORKSPACE", os.getcwd())
    lcov_files = find_lcov_files(args.coverage_dir)

    if not lcov_files:
        write_summary(
            [
                "### Coverage Summary",
                "",
                f"- No coverage reports found under `{args.coverage_dir}/**/lcov.info`.",
                "- Check passed without coverage input.",
            ]
        )
        return 0

    coverage = parse_lcov(lcov_files, workspace)
    stats = file_stats(coverage)
    if not stats:
        write_summary(
            [
                "### Coverage Summary",
                "",
                "- Coverage reports were found, but no executable line data could be parsed.",
                "- Check passed without coverage metrics.",
            ]
        )
        return 0

    if args.mode == "pr":
        return run_pr_mode(coverage, stats, args.compare_branch, args.target)

    return run_general_mode(stats)


if __name__ == "__main__":
    raise SystemExit(main())
