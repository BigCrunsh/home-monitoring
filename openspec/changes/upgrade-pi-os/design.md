# Design: rebuilding the Pi on 64-bit Raspberry Pi OS

## Python delivery (task 1.2, decided 2026-11-08)

**Today:** Python 3.12.3 compiled from source into `/usr/local/bin/python3.12` (July 2024),
104 project packages installed with `pip --user` into `~/.local`, and the interpreter path
hard-coded in `run_home_monitoring.sh` and the `home-monitoring-gardena` unit. Nothing of
this is reproducible from the repo.

**Options:**

| | Distro Python | Build from source | **uv (chosen)** |
|---|---|---|---|
| Version | bookworm 3.11, trixie 3.13 (project targets 3.12) | any | any, pinned |
| Effort on rebuild | none, but wrong version | ~1 h compile on a Pi 4 | one static binary, minutes |
| Dependencies | pip `--break-system-packages` or a venv | venv | `uv sync` from `pyproject.toml` into `.venv` |
| Reproducible from the repo | no | no | yes |

**Decision:** install [uv](https://docs.astral.sh/uv/) and let it provide Python 3.12 and the
project's `.venv` from `pyproject.toml`. The collectors run with
`<repo>/.venv/bin/python`, so `run_home_monitoring.sh` and the Gardena unit must point there
instead of `/usr/local/bin/python3.12`. Change both in the repo before the cutover, keeping
the old path as the fallback only until the new card is live.

## Restore principle

The NAS keeps daily snapshots of the whole root filesystem, but that filesystem is 32-bit
bullseye: restore **data and configuration**, never binaries. Native ioBroker modules are
rebuilt by reinstalling the adapters; InfluxDB is restored from its portable backup, not from
the hot-copied Docker volume.
