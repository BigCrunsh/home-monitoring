#!/bin/bash
# Wrapper for cron-run collectors: runs a home_monitoring module with the repo
# venv/PYTHONPATH, under a per-module lock so a slow run never overlaps the next
# cron tick. Usage: run_home_monitoring.sh <module> [args...]
set -euo pipefail

PROJECT_DIR=/home/pi/src/github.com/BigCrunsh/home-monitoring
PYTHON=/usr/local/bin/python3.12
LOG_DIR=/home/pi/logs

MODULE="${1:?usage: run_home_monitoring.sh <module> [args...]}"

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

# Prevent overlapping runs of the same module (flock auto-releases on exit).
# -n: if the previous run still holds the lock, skip this tick rather than queue.
exec 9>"$LOG_DIR/.lock.${MODULE##*.}"
if ! flock -n 9; then
    echo "{\"event\":\"run_skipped_locked\",\"module\":\"$MODULE\"}" >&2
    exit 0
fi

PYTHONPATH=src exec "$PYTHON" -m "$@"
