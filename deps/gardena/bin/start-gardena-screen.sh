#!/bin/bash

set -e
 
usage() {
  echo "Start screen to run gardena script as daemon."
  echo
  echo "Usage: $(basename $0) [-h]"
}

function log {
    echo "[$(basename $0): $(date --rfc-3339=seconds)]: $*"
}

# global settings 
SOCKNAME=gardena.collection

while getopts 'h' opt
do
  case "${opt}" in
    h) usage && exit 0;;
  esac
done

if [ -z ${GARDENA_APPLICATION_ID} ]; then 
    log "GARDENA_APPLICATION_ID is not set"
    exit 1;
fi

if [ "$(screen -list|grep $SOCKNAME|grep Detached)" ]; then
    log "screen exists"
else
    log "start screen"
    screen -dmS $SOCKNAME bash -c "$(pwd)/../../../homemonitoring/collect_data_gardena.py > /home/pi/logs/collect_data_gardena.log 2>&1"
    log "done"
fi
