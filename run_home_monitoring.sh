#!/bin/bash
PROJECT_DIR=/home/pi/src/github.com/BigCrunsh/home-monitoring
PYTHON=/usr/local/bin/python3.12
LOG_DIR=/home/pi/src/github.com/BigCrunsh/home-monitoring/logsg

# Ensure log directory exists
mkdir -p "$LOG_DIR"

cd "$PROJECT_DIR" || exit 1
PYTHONPATH=src $PYTHON -m "$@"
