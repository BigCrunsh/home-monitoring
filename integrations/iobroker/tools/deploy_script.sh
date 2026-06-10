#!/bin/bash
# Deploy one repo script into ioBroker (creates or updates the script object).
# The javascript adapter restarts the script automatically on change.
# Run on the ioBroker host.
#
# Usage: ./tools/deploy_script.sh <name>     (e.g. ./tools/deploy_script.sh tibber_states)
set -euo pipefail

NAME="${1:?usage: deploy_script.sh <script-name>}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILE="$REPO_DIR/$NAME.js"
ID="script.js.common.$NAME"

[ -f "$FILE" ] || { echo "no such repo script: $FILE" >&2; exit 1; }

if iobroker object get "$ID" >/dev/null 2>&1; then
    SRC="$(cat "$FILE")"
    iobroker object set "$ID" common.source="$SRC"
    echo "deployed $NAME"
else
    # new script: create the full object, disabled, for review in the admin UI
    OBJ="$(python3 - "$FILE" "$NAME" <<'EOF'
import json, sys
print(json.dumps({
    "type": "script",
    "common": {
        "name": sys.argv[2],
        "engineType": "Javascript/js",
        "engine": "system.adapter.javascript.0",
        "enabled": False,
        "source": open(sys.argv[1]).read(),
        "debug": False,
        "verbose": False,
    },
    "native": {},
}))
EOF
)"
    iobroker object set "$ID" "$OBJ"
    echo "created $NAME (disabled — review and enable it in the admin UI)"
fi
