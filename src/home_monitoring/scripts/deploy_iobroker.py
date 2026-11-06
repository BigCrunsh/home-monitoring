#!/usr/bin/env python3
"""Deploy an ioBroker dashboard script or the vis-2 layout from the workstation.

The live Pi can be ahead of the repo (the vis_card layer existed only on the Pi until
2026-07-19), so every deploy first checks that the live copy is one the repo already
knows: some committed version of the file. Anything else was edited on the Pi and
would be lost, and the deploy is refused. Only committed code is deployed, so every
version that ever ran stays recoverable from git.

Usage:
    python -m home_monitoring.scripts.deploy_iobroker script <name> [--dry-run]
    python -m home_monitoring.scripts.deploy_iobroker vis [--dry-run]

Environment: PI_HOST (default pi@raspberrypi), PI_SSH_OPTS (extra ssh/scp options).
"""

import argparse
import hashlib
import json
import os
import shlex
import subprocess
import sys
import tempfile
from enum import Enum
from pathlib import Path

IOBROKER_DIR = Path("integrations/iobroker")
VIS_FILE = IOBROKER_DIR / "vis/main/vis-views.json"
VIS_LIVE_PATH = "/vis-2.0/main/vis-views.json"


class Verdict(Enum):
    """What a deploy may do, given the live copy and the repo's history."""

    DEPLOY = "live copy is an earlier committed version; deploying"
    UP_TO_DATE = "live copy already matches the repo; nothing to do"
    LOCAL_UNCOMMITTED = "local file has uncommitted changes; commit first"
    LIVE_AHEAD = "live copy matches no committed version: it was edited on the Pi"
    NOT_ON_PI = "not on the Pi yet; create it there first"


def blob_id(content: bytes) -> str:
    """Return the git blob id of content, as `git hash-object` computes it."""
    header = f"blob {len(content)}\0".encode()
    return hashlib.sha1(header + content, usedforsecurity=False).hexdigest()


def live_blob(live: bytes, known: set[str]) -> str:
    """Return the blob id of the live copy, matched against the known versions.

    Deploying with common.source="$(cat file)" drops the file's final newline, so a
    live copy without one is also tried with it restored. A file committed without a
    final newline matches as it is; a copy matching neither keeps its own id.
    """
    exact = blob_id(live)
    if exact in known or live.endswith(b"\n"):
        return exact
    restored = blob_id(live + b"\n")
    return restored if restored in known else exact


def decide(
    live: str | None, local: str, head: str | None, committed: set[str]
) -> Verdict:
    """Decide whether a deploy is safe.

    Args:
        live: blob id of the live copy, None when the Pi doesn't have it
        local: blob id of the working-tree file
        head: blob id of the file at HEAD, None when it was never committed
        committed: blob ids of every committed version of the file

    Returns:
        The verdict
    """
    if local != head:
        return Verdict.LOCAL_UNCOMMITTED
    if live is None:
        return Verdict.NOT_ON_PI
    if live == local:
        return Verdict.UP_TO_DATE
    if live in committed:
        return Verdict.DEPLOY
    return Verdict.LIVE_AHEAD


def _git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True
    ).stdout


def committed_blobs(path: Path) -> set[str]:
    """Return the blob ids of every committed version of path."""
    raw = _git("log", "--format=", "--raw", "--no-abbrev", "--", str(path))
    blobs: set[str] = set()
    # a raw line is ":<old mode> <new mode> <old blob> <new blob> <status>\t<path>"
    for line in raw.splitlines():
        if line.startswith(":"):
            _, _, old, new, *_ = line.split()
            blobs.update((old, new))
    blobs.discard("0" * 40)
    return blobs


def head_blob(path: Path) -> str | None:
    """Return the blob id of path at HEAD, None when it was never committed."""
    try:
        return _git("rev-parse", f"HEAD:{path}").strip()
    except subprocess.CalledProcessError:
        return None


def _pi() -> tuple[str, list[str]]:
    return os.environ.get("PI_HOST", "pi@raspberrypi"), shlex.split(
        os.environ.get("PI_SSH_OPTS", "")
    )


def on_pi(command: str) -> subprocess.CompletedProcess[str]:
    """Run a shell command in the ioBroker directory on the Pi."""
    host, opts = _pi()
    return subprocess.run(
        ["ssh", *opts, host, f"cd /opt/iobroker && {command}"],
        check=False,
        capture_output=True,
        text=True,
    )


def copy_to_pi(local: Path, remote: str) -> None:
    """Copy a file to the Pi."""
    host, opts = _pi()
    subprocess.run(["scp", "-q", *opts, str(local), f"{host}:{remote}"], check=True)


def live_script(name: str) -> tuple[str, bytes] | None:
    """Return the object id and source of a deployed script, None when absent.

    Shared helpers like vis_card live under script.js.global, the rest under common.
    """
    for folder in ("common", "global"):
        object_id = f"script.js.{folder}.{name}"
        result = on_pi(f"iob object get {object_id}")
        if result.returncode == 0 and result.stdout.strip():
            source = json.loads(result.stdout)["common"]["source"]
            return object_id, source.encode()
    return None


def live_vis() -> bytes | None:
    """Return the live vis-2 layout, None when the Pi has none."""
    result = on_pi(f"iob file read {VIS_LIVE_PATH} /tmp/live-vis-views.json")
    if result.returncode != 0:
        return None
    return on_pi("cat /tmp/live-vis-views.json").stdout.encode()


def check(path: Path, live: bytes | None) -> Verdict:
    """Compare a repo file with its live copy."""
    local = blob_id(path.read_bytes())
    committed = committed_blobs(path)
    return decide(
        live=live_blob(live, committed | {local}) if live is not None else None,
        local=local,
        head=head_blob(path),
        committed=committed,
    )


def keep_live_copy(live: bytes, name: str) -> Path:
    """Save the live copy locally so the Pi-side edit can be diffed and committed."""
    out = Path(tempfile.gettempdir()) / f"live-{name}"
    out.write_bytes(live)
    return out


def deploy_script(name: str, dry_run: bool) -> int:
    """Deploy integrations/iobroker/<name>.js if the drift check allows it."""
    path = IOBROKER_DIR / f"{name}.js"
    if not path.is_file():
        print(f"no such script: {path}", file=sys.stderr)
        return 1
    found = live_script(name)
    verdict = check(path, found[1] if found else None)
    print(f"{name}: {verdict.value}")
    if verdict is Verdict.LIVE_AHEAD and found:
        print(f"live copy saved to {keep_live_copy(found[1], path.name)}")
    if verdict is not Verdict.DEPLOY or dry_run or not found:
        return 0 if verdict in (Verdict.DEPLOY, Verdict.UP_TO_DATE) else 1
    object_id = found[0]
    copy_to_pi(path, f"/tmp/{path.name}")
    result = on_pi(
        f'SRC="$(cat /tmp/{path.name})";'
        f' iob object set {object_id} common.source="$SRC"'
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        return 1
    after = live_script(name)
    local = blob_id(path.read_bytes())
    if not after or live_blob(after[1], {local}) != local:
        print(f"{name}: live copy does not match after deploy", file=sys.stderr)
        return 1
    print(f"{name}: deployed to {object_id}; the script restarts on its own")
    return 0


def deploy_vis(dry_run: bool) -> int:
    """Deploy the vis-2 layout if the drift check allows it, then reload the clients."""
    try:
        json.loads(VIS_FILE.read_text())
    except json.JSONDecodeError as e:
        print(f"{VIS_FILE} is not valid JSON: {e}", file=sys.stderr)
        return 1
    live = live_vis()
    verdict = check(VIS_FILE, live)
    print(f"vis-views.json: {verdict.value}")
    if verdict is Verdict.LIVE_AHEAD and live is not None:
        print(f"live copy saved to {keep_live_copy(live, VIS_FILE.name)}")
    if verdict is not Verdict.DEPLOY or dry_run:
        return 0 if verdict in (Verdict.DEPLOY, Verdict.UP_TO_DATE) else 1
    copy_to_pi(VIS_FILE, "/tmp/vis-views.json")
    result = on_pi(
        f"iob file write /tmp/vis-views.json {VIS_LIVE_PATH} >/dev/null"
        " && iob state set vis-2.0.control.command refresh"
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        return 1
    print("vis-views.json: deployed; open dashboards reload")
    return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(description="Drift-checked ioBroker deploy")
    sub = parser.add_subparsers(dest="target", required=True)
    script = sub.add_parser("script", help="deploy integrations/iobroker/<name>.js")
    script.add_argument("name")
    script.add_argument("--dry-run", action="store_true", help="only run the check")
    vis = sub.add_parser("vis", help="deploy the vis-2 layout")
    vis.add_argument("--dry-run", action="store_true", help="only run the check")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if args.target == "script":
        sys.exit(deploy_script(args.name, args.dry_run))
    sys.exit(deploy_vis(args.dry_run))
