#!/bin/bash
# Export the source of all deployed ioBroker JavaScript scripts into this
# directory's parent (integrations/iobroker/<name>.js). Run on the ioBroker host.
#
# Usage: ./tools/export_scripts.sh [target-dir]
set -euo pipefail

TARGET_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

EXTRACT='
import json, sys
obj = json.load(sys.stdin)
source = obj.get("common", {}).get("source")
if source is not None:
    with open(sys.argv[1], "w") as f:
        f.write(source)
        if not source.endswith("\n"):
            f.write("\n")
    print("exported", sys.argv[1])
'

for id in $(iobroker object list "script.js.common.*" 2>/dev/null \
        | grep -o 'script\.js\.common\.[a-zA-Z0-9_]*' | sort -u); do
    name="${id##*.}"
    iobroker object get "$id" | python3 -c "$EXTRACT" "$TARGET_DIR/$name.js"
done
