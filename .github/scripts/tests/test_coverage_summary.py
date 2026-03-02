import importlib.util
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


TEST_DIR = pathlib.Path(__file__).resolve().parent
REPO_ROOT = TEST_DIR.parents[2]
SCRIPT_PATH = REPO_ROOT / ".github" / "scripts" / "coverage_summary.py"
FIXTURES_DIR = TEST_DIR / "fixtures"


def load_coverage_summary_module():
    spec = importlib.util.spec_from_file_location("coverage_summary", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load script from {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CoverageSummaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.coverage_summary = load_coverage_summary_module()

    def _copy_fixture_workspace(self, fixture_name: str) -> pathlib.Path:
        fixture_workspace = FIXTURES_DIR / fixture_name / "workspace"
        temp_root = pathlib.Path(tempfile.mkdtemp(prefix=f"coverage-summary-{fixture_name}-"))
        workspace = temp_root / "workspace"
        shutil.copytree(fixture_workspace, workspace)
        self.addCleanup(lambda: shutil.rmtree(temp_root, ignore_errors=True))
        return workspace

    def _run_script(self, workspace: pathlib.Path, mode: str) -> tuple[int, str]:
        summary_path = workspace / "summary.md"
        env = os.environ.copy()
        env["GITHUB_WORKSPACE"] = str(workspace)
        env["GITHUB_STEP_SUMMARY"] = str(summary_path)
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        result = subprocess.run(
            [sys.executable, str(SCRIPT_PATH), "--mode", mode, "--coverage-dir", "coverage-reports"],
            cwd=workspace,
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )
        summary = summary_path.read_text(encoding="utf-8") if summary_path.exists() else ""
        return result.returncode, summary

    def test_general_mode_matches_golden_summary_for_relative_sf_paths(self):
        workspace = self._copy_fixture_workspace("general_relative_sf_paths")
        expected = (FIXTURES_DIR / "general_relative_sf_paths" / "expected_summary.md").read_text(
            encoding="utf-8"
        )

        returncode, summary = self._run_script(workspace, mode="general")

        self.assertEqual(returncode, 0)
        self.assertEqual(summary, expected)

    def test_general_mode_passes_when_no_coverage_reports_are_found(self):
        workspace = self._copy_fixture_workspace("general_no_coverage")
        expected = (FIXTURES_DIR / "general_no_coverage" / "expected_summary.md").read_text(
            encoding="utf-8"
        )

        returncode, summary = self._run_script(workspace, mode="general")

        self.assertEqual(returncode, 0)
        self.assertEqual(summary, expected)

    def test_pr_mode_uses_src_only_package_totals_and_enforces_threshold(self):
        coverage = {
            "packages/server/src/index.ts": {10: 1, 11: 0},
            "packages/server/test/index.test.ts": {1: 0},
        }
        stats = self.coverage_summary.file_stats(coverage)
        package_roots = {"packages/server": "@verii/server"}
        added_lines = {
            "packages/server/src/index.ts": {10, 11},
            "packages/server/README.md": {1},
        }
        changed_files = set(added_lines.keys())

        with tempfile.TemporaryDirectory(prefix="coverage-summary-pr-mode-") as temp_dir:
            summary_path = pathlib.Path(temp_dir) / "summary.md"
            with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(summary_path)}, clear=False):
                with mock.patch.object(self.coverage_summary, "parse_added_lines", return_value=added_lines):
                    with mock.patch.object(
                        self.coverage_summary, "parse_changed_files", return_value=changed_files
                    ):
                        returncode = self.coverage_summary.run_pr_mode(
                            coverage=coverage,
                            stats=stats,
                            package_roots=package_roots,
                            compare_branch="origin/main",
                            target=98.0,
                        )

            summary = summary_path.read_text(encoding="utf-8")

        self.assertEqual(returncode, 2)
        self.assertIn("- New-line count: **3**", summary)
        self.assertIn("- New uncovered lines: **1**", summary)
        self.assertIn("- Diff coverage: **50.00%**", summary)
        self.assertIn("| `@verii/server` | 50.00% | 1 / 2 |", summary)


if __name__ == "__main__":
    unittest.main()
