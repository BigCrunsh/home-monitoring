"""Unit tests for the drift-checked ioBroker deploy.

The live Pi can be ahead of the repo (the vis_card layer existed only on the Pi until
2026-07-19), so a deploy is only safe when the live copy is one the repo already knows.
"""

import hashlib

import pytest
from home_monitoring.scripts.deploy_iobroker import Verdict, blob_id, decide

OLD = blob_id(b"old version\n")
NEW = blob_id(b"new version\n")
LIVE_EDIT = blob_id(b"edited in the admin UI\n")


def test_blob_id_matches_git_hash_object() -> None:
    """The id equals `git hash-object`, so it can be looked up in the file's history."""
    content = b"hello\n"
    expected = hashlib.sha1(b"blob 6\x00hello\n").hexdigest()
    assert blob_id(content) == expected
    assert blob_id(content) == "ce013625030ba8dba906f756967f9e9ca394464a"


def test_live_copy_from_an_earlier_commit_is_deployed() -> None:
    """The Pi runs an older committed version: overwriting it loses nothing."""
    verdict = decide(live=OLD, local=NEW, head=NEW, committed={OLD, NEW})
    assert verdict is Verdict.DEPLOY


def test_live_copy_already_matching_the_repo_is_left_alone() -> None:
    """Nothing to do; the script is not restarted for no reason."""
    verdict = decide(live=NEW, local=NEW, head=NEW, committed={OLD, NEW})
    assert verdict is Verdict.UP_TO_DATE


def test_live_copy_unknown_to_the_repo_is_refused() -> None:
    """Someone edited the Pi: deploying would silently throw that edit away."""
    verdict = decide(live=LIVE_EDIT, local=NEW, head=NEW, committed={OLD, NEW})
    assert verdict is Verdict.LIVE_AHEAD


def test_uncommitted_local_changes_are_refused() -> None:
    """Only committed code goes live, so every live version stays in git."""
    verdict = decide(live=OLD, local=NEW, head=OLD, committed={OLD})
    assert verdict is Verdict.LOCAL_UNCOMMITTED


def test_a_file_the_pi_does_not_have_is_refused() -> None:
    """A brand-new script needs its object created first; this tool only updates."""
    verdict = decide(live=None, local=NEW, head=NEW, committed={NEW})
    assert verdict is Verdict.NOT_ON_PI


@pytest.mark.parametrize(
    ("live", "head"),
    [(LIVE_EDIT, OLD), (None, OLD)],
    ids=["live-ahead-and-uncommitted", "missing-and-uncommitted"],
)
def test_uncommitted_local_changes_win_over_other_problems(
    live: str | None, head: str
) -> None:
    """Uncommitted work is reported first: the person deploying can fix it."""
    verdict = decide(live=live, local=NEW, head=head, committed={OLD})
    assert verdict is Verdict.LOCAL_UNCOMMITTED
