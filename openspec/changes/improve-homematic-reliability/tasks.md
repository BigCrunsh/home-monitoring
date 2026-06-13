# Tasks

## 1. Diagnose (CCU, mostly read-only — needs CCU access)
- [ ] 1.1 Access the CCU (192.168.178.81); read the BidCoS-RF DUTY_CYCLE (sample
      around an open command) — confirm/rule out saturation
- [ ] 1.2 KeyMatic RSSI / distance to CCU; battery already OK (LOW_BAT=false)
- [ ] 1.3 Identify the chattiest classic devices (RF traffic load)
- [ ] 1.4 Verify "Öffnen" path is a direct LOCK_TARGET_LEVEL set, not a CCU program

## 2. Recommend / improve
- [ ] 2.1 Based on findings: throttle/relocate chatty devices, improve RF
      (antenna/relay/LAN-gateway near the door), or replace the opener
- [ ] 2.2 Document the decision + any CCU changes
