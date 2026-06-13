# Tasks

## 1. Instrument (done)
- [x] 1.1 Enrol central `DUTY_CYCLE_LEVEL`/`CARRIER_SENSE_LEVEL` + lock
      `LOCK_TARGET_LEVEL`/`LOCK_STATE`/`PROCESS`/`RSSI_DEVICE`/`UNREACH`/`DUTY_CYCLE`
      for InfluxDB logging (`deps/general/bin/enable_homematic_logging.sh`)
- [x] 1.2 Confirm the influxdb.0 adapter logs them to the `iobroker` database

## 2. Confirm the cause (needs a few real slow opens)
- [ ] 2.1 After several "Öffnen" presses, correlate each slow open with a spike in
      central `DUTY_CYCLE_LEVEL` / `CARRIER_SENSE_LEVEL`
- [ ] 2.2 Compute actuation latency: `LOCK_TARGET_LEVEL`→`OPEN` until `PROCESS`/
      `LOCK_STATE` moves; tabulate fast vs slow opens
- [ ] 2.3 Confirm no CCU program/automation also fires on the lock around open

## 3. Reduce central-radio load (primary remediation)
- [ ] 3.1 On the CCU, raise the report interval / power delta of the 6 metering
      actuators (5× HmIP-PSM + 1× HmIP-BSM)
- [ ] 3.2 Re-measure central duty cycle and re-test opener latency

## 4. Escalate only if needed
- [ ] 4.1 If load reduction is insufficient: evaluate an external HmIP access point
      (offload the radio from the CCU3 internal module), or a direct device-link path
      for the dashboard's open action
- [ ] 4.2 Document the decision + any CCU changes; turn logging off again if no longer
      needed (`enable_homematic_logging.sh -d`)
