#!/bin/bash
# Export the vis-2 dashboard layout (project "main") from ioBroker into the repo
# at integrations/iobroker/vis/main/. Run on the ioBroker host.
#
# Usage: ./tools/export_vis.sh
set -euo pipefail

TARGET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/vis/main"
mkdir -p "$TARGET_DIR"

for f in vis-views.json vis-user.css; do
    iobroker file read "/vis-2.0/main/$f" "$TARGET_DIR/$f" >/dev/null
    echo "exported $TARGET_DIR/$f"
done
