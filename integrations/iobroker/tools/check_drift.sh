#!/bin/bash
# Compare every deployed ioBroker JavaScript script with its repo counterpart.
# Exit non-zero if any script diverges or is missing on either side.
# Run on the ioBroker host.
#
# Usage: ./tools/check_drift.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

"$(dirname "${BASH_SOURCE[0]}")/export_scripts.sh" "$TMP_DIR" >/dev/null

DRIFT=0
for deployed in "$TMP_DIR"/*.js; do
    name="$(basename "$deployed")"
    if [ ! -f "$REPO_DIR/$name" ]; then
        echo "MISSING IN REPO: $name (deployed but not versioned)"
        DRIFT=1
    elif ! diff -q "$deployed" "$REPO_DIR/$name" >/dev/null; then
        echo "DIVERGED: $name (deployed differs from repo)"
        DRIFT=1
    fi
done

for repo_file in "$REPO_DIR"/*.js; do
    name="$(basename "$repo_file")"
    if [ ! -f "$TMP_DIR/$name" ]; then
        echo "NOT DEPLOYED: $name (in repo but no deployed script)"
        DRIFT=1
    fi
done

[ "$DRIFT" -eq 0 ] && echo "no drift: all deployed scripts match the repo"
exit "$DRIFT"
