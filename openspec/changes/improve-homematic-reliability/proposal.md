# Improve HomeMatic opener (HmIP-DLD) reliability

## Why

Pressing "Öffnen" on the dashboard actuates the front-door lock. Response is
unreliable — usually seconds, sometimes minutes. Live investigation on the system
(2026-06-13) corrected the original assumption and localised the bottleneck:

- The lock is an **HmIP-DLD** battery door-lock drive (`hm-rpc.1.002A226996B89C`,
  FW 1.4.12) on the **HmIP** radio of a **CCU3** (192.168.178.81) — **not** classic
  BidCoS-RF as first assumed. So the classic "1% BidCoS duty-cycle" theory does not
  apply; HmIP tracks duty cycle **per device** and on the **central** radio.
- At rest the lock is **healthy**: RSSI −45/−49 dBm (excellent), `LOW_BAT=false`,
  `UNREACH=false`, no `CONFIG_PENDING`, not jammed, per-device `DUTY_CYCLE=false`.
  So the delay is **intermittent**, not a standing fault.
- The dashboard button writes **`hm-rpc.1.…LOCK_TARGET_LEVEL` directly via XML-RPC**
  (not through the polled hm-rega layer). The ioBroker→CCU command path is therefore
  fast and **not** the cause.
- **Decisive clue from the user:** a directly device-linked **remote always opens the
  lock instantly**, while the dashboard is sometimes slow, and when slow **the door
  physically does not move** (not merely a delayed status). The remote bypasses the
  CCU (direct HmIP device link); the dashboard command must originate from the CCU's
  **central transmitter**. This proves the lock's *receiver* is fine and points at
  the **CCU3 central HmIP radio** (its transmit duty-cycle budget / send queue).
- The radio carries **28 HmIP devices**, including **6 continuously-reporting
  metering actuators** (5× HmIP-PSM + 1× HmIP-BSM) and 3 motion sensors. Central
  `DUTY_CYCLE_LEVEL` was observed fluctuating (3 % → 12 %) within minutes.

**Hypothesis:** background RF traffic (chiefly the 6 metering actuators) transiently
loads the CCU3 central radio's transmit budget; an "Öffnen" command then queues
until the radio has duty-cycle headroom and a clear channel — seconds when idle, up
to minutes when loaded. The instant remote (direct link) confirms the lock itself is
not the limiter.

## What Changes

Investigation + concrete setup improvements (mostly CCU/ioBroker config, not a code
feature). Logging is **already in place** (see below) to turn the hypothesis into a
measurement:

- **Logging (done):** the central `DUTY_CYCLE_LEVEL`/`CARRIER_SENSE_LEVEL` and the
  lock's `LOCK_TARGET_LEVEL`/`LOCK_STATE`/`PROCESS`/`RSSI_DEVICE`/`UNREACH`/
  `DUTY_CYCLE` are now logged to InfluxDB via the ioBroker influxdb.0 adapter,
  reproducibly via `deps/general/bin/enable_homematic_logging.sh`.
- **Confirm the cause:** after a few slow opens, correlate each slow "Öffnen" with a
  spike in central `DUTY_CYCLE_LEVEL` / `CARRIER_SENSE_LEVEL`; measure actuation
  latency as `LOCK_TARGET_LEVEL→OPEN` until `PROCESS`/`LOCK_STATE` moves.
- **Reduce central-radio load (primary lever):** raise the report interval / power
  delta of the 6 metering actuators so they transmit far less, freeing the CCU3
  radio's duty-cycle and receive attention. Re-measure.
- **Check the DLD's CCU config:** receive/transmit settings, FW level, and whether a
  CCU **program/automation** also touches the lock around open commands.
- **If load reduction is insufficient:** evaluate offloading the HmIP radio to an
  external **HmIP access point (HAP)** instead of the CCU3's internal module, or a
  direct device-link path for the dashboard's most-used action.

## Capabilities

### New Capabilities
- `homematic-reliability`: requirements for actuator responsiveness + RF health,
  backed by measurement rather than assumption.

### Modified Capabilities
- (none)

## Impact

- Logging change is live and reversible (`enable_homematic_logging.sh -d`); writes to
  the separate `iobroker` InfluxDB database, not the collectors' DB.
- RF/device-config changes are on the CCU (192.168.178.81), made with the user.
- Repo artifacts: the enablement script (done) + this change's docs; no new collector
  expected unless we choose to mirror duty cycle into the main DB.
