#!/bin/bash

usage() {
  echo "Usage: $(basename "$0") [-h] [-d]"
  echo "Enrols the HmIP door-lock + central-radio datapoints for InfluxDB logging"
  echo "via the ioBroker influxdb.0 adapter (writes to the 'iobroker' database)."
  echo "Run ON the Pi (it shells out to the local 'iobroker' CLI)."
  echo
  echo "Purpose: diagnose the intermittent 'Öffnen' latency. The dashboard sends"
  echo "the open command through the CCU's central HmIP radio; a directly-linked"
  echo "remote (which bypasses the CCU) is always instant. So the suspect is the"
  echo "central radio's transmit duty cycle, loaded by ~28 HmIP devices (notably"
  echo "6 continuously-reporting metering actuators). Logging DUTY_CYCLE_LEVEL +"
  echo "the lock's command/state lets us correlate a slow open with a duty spike,"
  echo "and measure actuation latency (LOCK_TARGET_LEVEL->OPEN vs PROCESS/LOCK_STATE)."
  echo
  echo "Idempotent: 'object extend' deep-merges, so re-running is safe."
  echo
  echo '   -h   show this help'
  echo '   -d   disable logging again (sets enabled=false on each datapoint)'
}

ENABLED=true
while getopts "hd" opt; do
  case "$opt" in
    d) ENABLED=false ;;
    h) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done

# Central CCU3 HmIP radio (the suspected transmit bottleneck)
CENTRAL=hm-rpc.1.001F9D89979B49
# HmIP-DLD door lock ("Öffnen")
LOCK=hm-rpc.1.002A226996B89C

DATAPOINTS=(
  "${CENTRAL}.0.DUTY_CYCLE_LEVEL"     # central radio transmit duty cycle (%) -- PRIME suspect
  "${CENTRAL}.0.CARRIER_SENSE_LEVEL"  # channel-busy indicator
  "${LOCK}.1.LOCK_TARGET_LEVEL"       # the command (OPEN / UNLOCKED / LOCKED) -- marks t0
  "${LOCK}.1.LOCK_STATE"              # actual state -- confirms actuation
  "${LOCK}.1.PROCESS"                 # motor running -- start/stop of actuation
  "${LOCK}.0.RSSI_DEVICE"             # signal context (was -45 dBm, excellent)
  "${LOCK}.0.UNREACH"                 # reachability
  "${LOCK}.0.DUTY_CYCLE"              # per-device duty cycle (control: device side)
)

# changesOnly=false + debounce 0 => log every value the CCU pushes, no smoothing,
# so short OPEN->PROCESS transitions and duty-cycle spikes are not lost.
CFG="{\"common\":{\"custom\":{\"influxdb.0\":{\"enabled\":${ENABLED},\"changesOnly\":false,\"debounce\":0,\"debounceTime\":0,\"retention\":0}}}}"

for id in "${DATAPOINTS[@]}"; do
  if iobroker object extend "$id" "$CFG" >/dev/null 2>&1; then
    echo "logging enabled=${ENABLED}: $id"
  else
    echo "FAILED: $id" >&2
  fi
done

echo
echo "Query later (InfluxDB 1.x, db 'iobroker'):"
echo "  docker exec influxdb influx -database iobroker -execute \\"
echo "    'SELECT value FROM \"${CENTRAL}.0.DUTY_CYCLE_LEVEL\" WHERE time > now()-1d'"
