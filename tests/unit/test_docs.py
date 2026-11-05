"""The agent and contributor docs name only paths and make targets that exist.

Agents follow AGENTS.md/CLAUDE.md literally, so a renamed file or target there sends
them down a dead end (CLAUDE.md once listed checks `make check` did not run).
"""

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
DOCS = ["AGENTS.md", "CLAUDE.md", "README.md"]
REPO_TOP_LEVEL = (
    "src/",
    "tests/",
    "integrations/",
    "conf/",
    "deps/",
    "openspec/",
    ".claude/",
    ".github/",
)


def repo_paths(text: str) -> set[str]:
    """Return the backticked repo paths in text, with <placeholders> left out."""
    paths = set()
    for token in re.findall(r"`([^`\s]+)`", text):
        templated = any(mark in token for mark in ("<", "*", "..."))
        if token.startswith(REPO_TOP_LEVEL) and not templated:
            paths.add(token.rstrip("/"))
    return paths


def make_targets_named(text: str) -> set[str]:
    """Return the make targets in backticks or at the start of a code line."""
    return set(re.findall(r"(?:`|^\s*)make ([a-z][a-z0-9-]*)", text, re.MULTILINE))


def makefile_targets(makefile: str) -> set[str]:
    """Return the targets a Makefile defines."""
    return set(re.findall(r"^([a-z][a-z0-9-]*):", makefile, re.MULTILINE))


@pytest.mark.parametrize("doc", DOCS)
def test_every_repo_path_a_doc_names_exists(doc: str) -> None:
    """A path in the docs points at a file or folder in the repo."""
    missing = [
        p for p in repo_paths((ROOT / doc).read_text()) if not (ROOT / p).exists()
    ]
    assert missing == []


@pytest.mark.parametrize("doc", DOCS)
def test_every_make_target_a_doc_names_exists(doc: str) -> None:
    """`make <target>` in the docs is a target the Makefile defines."""
    defined = makefile_targets((ROOT / "Makefile").read_text())
    named = make_targets_named((ROOT / doc).read_text())
    assert sorted(named - defined) == []


def test_a_renamed_path_is_reported() -> None:
    """A path the repo no longer has is caught."""
    text = "Deploy with `integrations/iobroker/tools/deploy_all.sh`."
    assert repo_paths(text) == {"integrations/iobroker/tools/deploy_all.sh"}
    assert not (ROOT / "integrations/iobroker/tools/deploy_all.sh").exists()


def test_placeholders_and_pi_paths_are_not_taken_for_repo_paths() -> None:
    """`<name>` templates, elisions and absolute paths on the Pi are not repo paths."""
    text = (
        "Edit `integrations/iobroker/<name>.js` or `openspec/.../x`;"
        " logs: `/opt/iobroker/log`."
    )
    assert repo_paths(text) == set()


def test_a_make_target_missing_from_the_makefile_is_reported() -> None:
    """A target the docs name but the Makefile lacks is caught."""
    named = make_targets_named(
        "Run `make verify`, then make sure it worked:\n  make deploy-all\n"
    )
    defined = makefile_targets("verify: check\n\tpytest\n")
    assert named - defined == {"deploy-all"}
