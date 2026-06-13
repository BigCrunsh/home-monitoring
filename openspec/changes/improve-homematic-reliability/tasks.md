# Tasks

## 1. Instrument (done)
- [x] 1.1 Enrol central duty cycle + lock command/state for InfluxDB logging
      (`deps/general/bin/enable_homematic_logging.sh`)
- [x] 1.2 Confirm the influxdb.0 adapter logs them to db `iobroker`

## 2. Establish the cause (done)
- [x] 2.1 Capture slow opens: 63 s @ 11 % and 62 s @ 8 % central duty cycle
- [x] 2.2 Compute actuation latency (`LOCK_TARGET_LEVEL`→`OPEN` until `PROCESS`/`LOCK_STATE`)
- [x] 2.3 Refute radio congestion (slow opens at LOW duty cycle) — metering throttle dropped
- [x] 2.4 Inspect DLD MASTER paramset: no command-receive tunable (`CYCLIC_INFO_MSG*`,
      `DUTYCYCLE_LIMIT` are device→CCU status only); receiver proven fine by the remote

## 3. Low-confidence CCU tweaks (with the user)
- [ ] 3.1 Try `ENABLE_ROUTING` 1→0 on the DLD, re-test latency over several opens
- [x] 3.2 Confirmed: 24 CCU programs (ALARM/LICHT/ROLLLADEN), none touches the lock; and
      a direct `setValue(LOCK_TARGET_LEVEL)` isn't intercepted by programs anyway

## 4. Settle the pragmatic answer
- [ ] 4.1 Document the dashboard "Öffnen" as best-effort; instant path = direct-linked remote
      (or add a directly-linked wall button)
- [ ] 4.2 Add optimistic UI feedback to the dashboard open button ("Öffne …")
- [ ] 4.3 Disable logging when the investigation is closed (`enable_homematic_logging.sh -d`)
