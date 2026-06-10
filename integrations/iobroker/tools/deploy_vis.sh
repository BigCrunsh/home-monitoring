#!/bin/bash
# Deploy the repo's vis-2 dashboard layout into ioBroker, OVERWRITING the live
# project "main". Open vis-2 clients pick the change up on reload.
#
# CAUTION: any layout edits made in the vis editor since the last export_vis.sh
# are lost. Run export_vis.sh + commit first if unsure.
#
# Usage: ./tools/deploy_vis.sh
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/vis/main"

[ -f "$SRC_DIR/vis-views.json" ] || { echo "no layout in repo: $SRC_DIR" >&2; exit 1; }

# refuse to deploy invalid JSON (a broken vis-views.json bricks the dashboard)
python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$SRC_DIR/vis-views.json" \
    || { echo "vis-views.json is not valid JSON; aborting" >&2; exit 1; }

read -r -p "Overwrite the LIVE dashboard layout with the repo version? [y/N] " ans
[ "$ans" = "y" ] || { echo "aborted"; exit 1; }

for f in vis-views.json vis-user.css; do
    [ -f "$SRC_DIR/$f" ] && iobroker file write "$SRC_DIR/$f" "/vis-2.0/main/$f" >/dev/null \
        && echo "deployed $f"
done
echo "done — reload the vis client(s)"
