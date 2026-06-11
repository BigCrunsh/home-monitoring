#!/bin/bash
# Export the vis-2 dashboard layout (project "main") from ioBroker into the repo
# at integrations/iobroker/vis/main/. Run on the ioBroker host.
#
# `iobroker file read` writes as the iobroker user, which has no access to the
# repo checkout — stage via a world-writable temp dir and copy as the caller.
#
# Usage: ./tools/export_vis.sh
set -euo pipefail

TARGET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/vis/main"
mkdir -p "$TARGET_DIR"

STAGE_DIR="$(mktemp -d)"
chmod 777 "$STAGE_DIR"
trap 'rm -rf "$STAGE_DIR"' EXIT

for f in vis-views.json vis-user.css; do
    iobroker file read "/vis-2.0/main/$f" "$STAGE_DIR/$f" >/dev/null
    cp "$STAGE_DIR/$f" "$TARGET_DIR/$f"
    echo "exported $TARGET_DIR/$f"
done
