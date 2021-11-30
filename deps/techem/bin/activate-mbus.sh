#!/bin/bash
 
usage() {
  echo "Activate m-bus on nano cul."
  echo
  echo "Usage: $(basename $0) [-h]"
}

function log {
    echo "[$(basename $0): $(date --rfc-3339=seconds)]: $*"
}

# global settings 
SLEEP_TIME=300s
SOCKNAME=nano_cul
PORT=/dev/serial/by-id/usb-SHK_NANO_CUL_868-if00-port0
BAUDRATE=38400

while getopts 'h' opt
do
  case "${opt}" in
    h) usage && exit 0;;
  esac
done


if [ "$(screen -list|grep $SOCKNAME|grep Detached)" ]; then
    log "screen exists"
else
    log "start screen"
    screen -dmS $SOCKNAME $PORT $BAUDRATE

    sleep $SLEEP_TIME;
    screen -X -S $SOCKNAME quit  # the screen is blocking any other interaction with the serial device; to be investigated
    log "set wmode"
    echo "brt" > $PORT
fi
