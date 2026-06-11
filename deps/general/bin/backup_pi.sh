#!/bin/bash

usage() {
  echo "Usage: $(basename "$0") [-h] [-u user] [-i RASPBERRY_PI]"
  echo "Backs up a named Raspberry Pi to the Synology via rsync."
  echo "Uses --link-dest hardlink incrementals: each daily snapshot is a full"
  echo "browsable tree, but unchanged files cost no extra space. Keeps 14 days."
  echo "On success it touches a marker on the Pi so the freshness healthcheck can"
  echo "alert if backups stop. If rsync fails, existing snapshots are retained."
  echo "Expects authorized keys NAS->Pi: https://wiki.qnap.com/wiki/SSH:..."
  echo
  echo '   -u USER          User name on raspberrypi (default: pi)'
  echo '   -i RASPBERRY_PI  raspberrypi IP/host'
}

function log {
    echo "[$(basename "$0"): $(date --rfc-3339=seconds)]: $*" >> "$LOGFILE" 2>&1
}

# global settings
USER=pi
SERVER=raspberrypi
NOW=$(date +"%Y-%m-%d")
KEEP=14
BACKUP_DIR="/volume1/rpi_backup"
SERVERDIR="$BACKUP_DIR/$SERVER"
LOGFILE="$BACKUP_DIR/logs/$SERVER-$NOW.log"
LATEST="$SERVERDIR/latest"
DEST="$SERVERDIR/$NOW"

while getopts 'hu:i:' opt; do
  case "${opt}" in
    h) usage && exit 0;;
    u) USER="${OPTARG}";;
    i) RASPBERRY_PI="${OPTARG}";;
  esac
done

if [ -z "${RASPBERRY_PI:-}" ]; then
    log "Missing RASPBERRY_PI"
    exit 1
fi

mkdir -p "$SERVERDIR" "$BACKUP_DIR/logs"

# Clean up a previous failed/partial run
rm -rf "$DEST.partial"

log "Run backup -> $DEST (link-dest: ${LATEST})"
# --link-dest hardlinks unchanged files against the previous snapshot.
rsync \
    --archive \
    --compress \
    --delete \
    --link-dest="$LATEST" \
    --exclude-from="$BACKUP_DIR/scripts/rsync-exclude.txt" \
    --rsync-path='/usr/bin/sudo /usr/bin/rsync' \
    --rsh "ssh -p 22" "$USER@$RASPBERRY_PI:/" \
    "$DEST.partial" >> "$LOGFILE" 2>&1

error_code=$?
if [ "$error_code" -ne 0 ]; then
    log "$error_code: rsync failed; keeping existing snapshots"
    rm -rf "$DEST.partial"
    exit 1
fi

# Promote the partial snapshot atomically and repoint 'latest'
rm -rf "$DEST"
mv "$DEST.partial" "$DEST"
ln -sfn "$DEST" "$LATEST"
chmod 0750 "$DEST"

# Prune to the newest $KEEP dated snapshots
log "Prune to newest $KEEP snapshots"
# shellcheck disable=SC2012
ls -1d "$SERVERDIR"/20*-*-* 2>/dev/null | sort | head -n "-$KEEP" | while read -r old; do
    log "Remove old snapshot $old"
    rm -rf "$old"
done

# Touch a success marker on the Pi for the freshness healthcheck
ssh -p 22 "$USER@$RASPBERRY_PI" 'touch /home/pi/.last_nas_backup_success' \
    >> "$LOGFILE" 2>&1 || log "warning: could not touch success marker on Pi"

log "Done"
