#!/bin/bash
# Produce a CONSISTENT InfluxDB backup on the Pi, so the nightly NAS pull captures
# a portable snapshot instead of live, mid-write data files. Runs before the NAS
# pull (see crontab). Output dir is replaced atomically and lives under /home/pi
# so the existing rsync includes it.
#
# Usage: influx_backup.sh [output-dir] [container]
set -euo pipefail

OUT="${1:-/home/pi/influx_backup}"
CONTAINER="${2:-influxdb}"
STAMP="$(date +%Y%m%d-%H%M%S)"
CTMP="/tmp/influx_backup_${STAMP}"

log() { echo "{\"event\":\"$1\",\"ts\":\"$(date --rfc-3339=seconds)\"${2:+,$2}}"; }

# portable backup of all databases (small; includes home_monitoring + others)
if ! docker exec "$CONTAINER" sh -c "rm -rf $CTMP && influxd backup -portable $CTMP" \
        >/dev/null 2>&1; then
    log influx_backup_failed
    exit 1
fi

rm -rf "${OUT}.new"
docker cp "${CONTAINER}:${CTMP}" "${OUT}.new" >/dev/null
docker exec "$CONTAINER" rm -rf "$CTMP" >/dev/null 2>&1 || true

# atomic swap so the rsync never catches a half-written dump
rm -rf "${OUT}.old"
[ -d "$OUT" ] && mv "$OUT" "${OUT}.old"
mv "${OUT}.new" "$OUT"
rm -rf "${OUT}.old"

COUNT="$(find "$OUT" -type f | wc -l | tr -d ' ')"
log influx_backup_done "\"files\":${COUNT}"
