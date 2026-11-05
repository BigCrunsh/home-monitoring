#!/bin/sh
# Claude Code PostToolUse hook: check a dashboard file the moment it is edited, not at commit
# time. An ioBroker script with a syntax error, or a vis layout that is not valid JSON, would
# otherwise only surface on the Pi. Exit 2 hands the error back to Claude to fix.
file="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))')"

check() {
    out="$("$@" 2>&1)" || { printf '%s\n' "$out" | tail -5 >&2; exit 2; }
}

case "$file" in
    */integrations/iobroker/*.js)
        check node --check "$file" ;;
    */integrations/iobroker/vis/*.json)
        check python3 -c '
import json, sys
try:
    json.load(open(sys.argv[1]))
except ValueError as e:
    sys.exit(f"{sys.argv[1]} is not valid JSON: {e}")' "$file" ;;
esac
exit 0
