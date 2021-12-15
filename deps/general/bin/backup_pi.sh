#!/bin/bash

usage() {
  echo "Usage: $(basename $0) [-h] [-u user] [-i RASPBERRY_PI]"
  echo "Backups a named Raspberry Pi at a given IP address."
  echo "Three rotating backups are kept. If rsync fails then the preceding backups are retained."
  echo "The script expects authorized keys: https://wiki.qnap.com/wiki/SSH:_How_To_Set_Up_Authorized_Keys"
  echo
  echo '   -u USER          User name on raspberrypi'
  echo '   -i RASPBERRY_PI  raspberrypi IP'
  echo
  echo 'This script is based on https://www.cososo.co.uk/2015/09/backup-and-restore-raspberry-pi-to-synology-diskstation/'
}

function log {
    echo "[$(basename $0): $(date --rfc-3339=seconds)]: $*" >> $LOGFILE 2>&1
}

# global settings
USER=pi
SERVER=raspberrypi
NOW=$(date +"%Y-%m-%d")
BACKUP_DIR="/volume1/rpi_backup"
SERVERDIR="$BACKUP_DIR/$SERVER"
LOGFILE="$BACKUP_DIR/logs/$SERVER-$NOW.log"
BASENAME="$SERVERDIR/$SERVER"

while getopts 'hu:i:' opt
do
  case "${opt}" in
    h) usage && exit 0;;
    u) USER="${OPTARG}"
       ;;
    i) RASPBERRY_PI="${OPTARG}"
       ;;
  esac
done

# check for mandatory arguments
if [ -z "$RASPBERRY_PI" ] ; then
    log "Missing RASPBERRY_PI"
    exit 1
fi

# Create top level backup directory if it does not exist
if ! [ -d $SERVERDIR ] ; then
    log "Create backup directory $SERVERDIR"
    mkdir $SERVERDIR ;
fi


# Clean up failed backups (backups are stored to $BASENAME.0 and moved if successful)
if [ -d $BASENAME.0 ] ; then
    log "Remove failed backup"
    rm -rf $BASENAME.0 ;
fi;

log "Run backup"
rsync \
    --exclude-from=$BACKUP_DIR/scripts/rsync-exclude.txt \
    --verbose \
    --archive \
    --delete \
    --rsh "ssh -p 22" $USER@$RASPBERRY_PI:/ \
    $BASENAME.0 >> $LOGFILE 2>&1

error_code=$?
if [ "$error_code" -ne "0" ] ; then
    log "$error_code: rsync failed"
    exit 1
fi

log "Rotate the existing backups"
if [ -d $BASENAME.3 ] ; then
    log "Remove oldest backup $BASENAME.3"
    rm -rf $BASENAME.3 ;
fi;
if [ -d $BASENAME.2 ] ; then
    log "mv $BASENAME.2 $BASENAME.3"
    mv $BASENAME.2 $BASENAME.3 ;
fi;
if [ -d $BASENAME.1 ] ; then
    log "mv $BASENAME.1 $BASENAME.2"
    mv $BASENAME.1 $BASENAME.2 ;
fi;
if [ -d $BASENAME.0 ] ; then
    log "mv $BASENAME.0 $BASENAME.1"
    mv $BASENAME.0 $BASENAME.1 ;
fi;
log "Done"
