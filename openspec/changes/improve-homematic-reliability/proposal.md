# Improve HomeMatic opener (KeyMatic) reliability

## Why

Pressing "Öffnen" on the dashboard actuates a HomeMatic **KeyMatic** door lock
(`hm-rpc.1.002A226996B89C`, classic BidCoS-RF 868 MHz). Response is unreliable —
sometimes seconds, sometimes minutes. Initial diagnosis (2026-06-13):

- KeyMatic **battery is fine** (`LOW_BAT = false`) — not a flat battery.
- The CCU (192.168.178.81) carries **~1342 HM objects** (many classic devices).
- No duty-cycle datapoint surfaced in ioBroker yet.

Variable seconds-to-minutes latency on classic HomeMatic is the textbook symptom
of the **BidCoS-RF 1% duty-cycle limit**: when the RF module saturates, commands
queue until it recovers. KeyMatic compounds this — it's battery-powered (wake-up
windows) and uses **AES-signed commands** (challenge-response = extra RF
round-trips).

## What Changes

Investigation + concrete setup improvements (not a code feature):

- Measure the **BidCoS-RF duty cycle** on the CCU (web UI / `DUTY_CYCLE` datapoint),
  ideally sampled around an open command, to confirm saturation.
- Quantify **RF chatter**: which classic devices report most often (motion sensors,
  switch actuators with frequent POWER) and could be throttled or moved to HmIP.
- Check the **KeyMatic RF signal/RSSI** and distance to the CCU; consider an RF
  relay / LAN gateway (HM-LGW) nearer the door.
- Verify "Öffnen" sends a **direct** `LOCK_TARGET_LEVEL`, not via a slow CCU program.
- Recommend a path: reduce duty-cycle load, improve RF, or replace the battery
  BidCoS KeyMatic with a more reliable (wired / HmIP / dedicated) opener.

## Capabilities

### New Capabilities
- `homematic-reliability`: requirements for actuator responsiveness + RF health.

### Modified Capabilities
- (none)

## Impact

- Diagnosis on the CCU (192.168.178.81) — read-only first; any RF/device config
  changes are on the CCU, with the user. No repo code expected beyond docs.
