#!/bin/bash
# Publish backup freshness into ioBroker states for the Diagnose tab's Backup card.
#
# The dashboard runs inside ioBroker and cannot see the filesystem, so this
# bridges the two on-disk markers into javascript.0.* states (created by
# diagnose_v2.js — deploy that script before scheduling this one):
#   /home/pi/.last_nas_backup_success  touched by backup_pi.sh after a NAS pull
#   /home/pi/influx_backup             replaced atomically by influx_backup.sh
#
# Run on the ioBroker host via cron, e.g.:
#   */15 * * * * /home/pi/home-monitoring/deps/general/bin/export_backup_states.sh
set -euo pipefail

mtime() { stat -c %Y "$1" 2>/dev/null || echo 0; }

iobroker state set javascript.0.backup_nas_ts "$(mtime /home/pi/.last_nas_backup_success)" true >/dev/null
iobroker state set javascript.0.backup_influx_ts "$(mtime /home/pi/influx_backup)" true >/dev/null
