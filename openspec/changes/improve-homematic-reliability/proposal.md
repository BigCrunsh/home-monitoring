# Improve HomeMatic opener (HmIP-DLD) reliability

## Why

Pressing "Öffnen" on the dashboard actuates the front-door lock. Response is
unreliable — sometimes instant, sometimes ~1 minute. Investigation on 2026-06-13
(with logging now in place) produced **measured evidence**, which overturned the
first two theories:

- The lock is an **HmIP-DLD** battery door-lock drive (`hm-rpc.1.002A226996B89C`,
  FW 1.4.12) on the **HmIP** radio of a **CCU3** (192.168.178.81) — not classic
  BidCoS-RF (first wrong theory: the "1% BidCoS duty-cycle" idea never applied).
- At rest the lock is **healthy**: RSSI −45/−49 dBm, `LOW_BAT=false`, `UNREACH=false`,
  no `CONFIG_PENDING`, not jammed. So the delay is intermittent, not a standing fault.
- The dashboard writes **`LOCK_TARGET_LEVEL` directly via `hm-rpc.1` XML-RPC** (not the
  polled hm-rega layer), so the ioBroker→CCU hop is fast and not the cause.
- **A directly device-linked remote opens the lock instantly, every time**, while the
  dashboard is sometimes slow and, when slow, **the door physically does not move**.
  The remote bypasses the CCU (direct HmIP device link); the dashboard command must
  originate from the CCU's central radio.

**Captured events (InfluxDB, db `iobroker`):**

| When (Berlin) | press → actuation | central DUTY_CYCLE_LEVEL |
|---|---|---|
| morning ×3 | instant | ~12 % |
| 20:27 | 63 s | 11 % |
| 21:13 | 62 s | 8 % |

**Conclusion — second wrong theory refuted:** both slow opens happened at **low** duty
cycle (8–11 %; it sat at 8–15 % all evening). Central-radio **transmit congestion is
NOT the cause**, so throttling the metering actuators would not help. The DLD's MASTER
paramset has **no command-receive tunable** — `CYCLIC_INFO_MSG*` and `DUTYCYCLE_LIMIT`
govern the device→CCU status direction, not how fast it *receives*; and the instant
remote proves the receiver itself is fine.

**Current best explanation:** the latency is inherent to **CCU-routed commands reaching
this battery security lock** (receive timing / AES challenge-response / HmIP routing —
`ENABLE_ROUTING=1`). When the lock's receive opportunity aligns it's instant; when it
misses, it waits ~1 min. A directly-peered remote sidesteps the CCU entirely, so it is
always instant.

## What Changes

Diagnosis is essentially done (above). Remaining work is to attempt low-confidence CCU
tweaks, then settle on the pragmatic answer:

- **Try (low confidence, with the user):** disable HmIP **routing** on the DLD
  (`ENABLE_ROUTING` 1→0) and re-test; confirm no CCU **program/automation** also fires
  on the lock around an open (could add its own delay).
- **Pragmatic answer if those don't help:** the dashboard "Öffnen" is inherently
  best-effort (~up to a minute) for this battery lock. The **instant** path is the
  directly device-linked **remote / a wall button** (bypasses the CCU). Add **optimistic
  UI feedback** ("Öffne …") so the dashboard button never feels dead.
- Logging stays on (`deps/general/bin/enable_homematic_logging.sh`) until we close this
  out, then can be disabled (`-d`).

## Capabilities

### New Capabilities
- `homematic-reliability`: requirements for actuator responsiveness backed by
  measurement, and an honest expectation for the dashboard vs the direct-link path.

### Modified Capabilities
- (none)

## Impact

- Logging is live + reversible; writes to the separate `iobroker` InfluxDB database.
- Any CCU device-config change (routing) is made on 192.168.178.81 with the user, and is
  reversible.
- Dashboard UI feedback would be a small vis change in the repo.
