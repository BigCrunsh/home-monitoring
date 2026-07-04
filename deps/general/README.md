# General Helper Scripts
This is a place for general helper scripts to manage the raspberry.

## Backup
The backup script for the Raspberry PI is running on a Synology Diskstation.
1. Add `authorized_keys` on raspberry (see, e.g., [How To Set Up Authorized Keys](https://wiki.qnap.com/wiki/SSH:_How_To_Set_Up_Authorized_Keys))
2. The `backup_pi.sh` is scheduled as task on the Synology.
3. `influx_backup.sh` runs nightly on the Pi (crontab `30 3 * * *`) so the NAS pull
   captures a consistent InfluxDB dump instead of live data files.
4. `export_backup_states.sh` bridges the two success markers
   (`~/.last_nas_backup_success`, `~/influx_backup`) into ioBroker states so the
   Diagnose tab's Backup card can show their age. Schedule it on the Pi:

       */15 * * * * /home/pi/home-monitoring/deps/general/bin/export_backup_states.sh

   Deploy `diagnose_v2.js` first — it creates the two states the script writes to.

