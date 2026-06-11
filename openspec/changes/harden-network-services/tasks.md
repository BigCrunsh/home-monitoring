# Tasks

## 1. Audit

- [x] 1.1 `ss -tlnp` inventory (2026-06-11). LAN-exposed on 0.0.0.0: 22 (ssh),
      8081 (admin — but `auth: True`), 8082 (vis — `auth: False`), 8086 (influx,
      consumed only locally), 8090 (terminal, admin), 3389 (xrdp, since 2025),
      2010 (hm-rpc callback — legitimate, CCU needs it). Corrections to the
      original review: admin **does** require login; MQTT is client-mode with
      **no open broker** (:1883 not listening) — both earlier findings were wrong
- [ ] 1.2 Check FritzBox port forwards / MyFRITZ shares — **user action**
      (router UI not reachable from here; the whole threat model hinges on this)

## 2. InfluxDB

- [x] 2.1 Decision: **bind to localhost** (collectors use 127.0.0.1, the ioBroker
      adapter uses localhost — nothing off-Pi connects; verified)
- [x] 2.2 No credential work needed (localhost bind, single-host setup)
- [x] 2.3 Container recreated `-p 127.0.0.1:8086:8086`, volume preserved
- [x] 2.4 Verified: LAN reach now refused (curl 000 from the Mac), localhost ping
      204, data intact (288 price rows/24h), and a full post-rebind collector +
      script cycle confirmed (netatmo/solaredge/tibber/sam_digital all stored;
      solaredge_power back in `hybrid` mode reading via localhost)

## 3. ioBroker surface

- [x] 3.1 vis (8082): user chose to **keep open on the trusted LAN** (kiosk-tablet
      friction); admin already authenticated — no change
- [x] 3.2 MQTT: N/A — client-mode, no broker to secure
- [x] 3.3 terminal adapter (:8090): **disabled** (stopped + instance disabled)
- [x] 3.4 xrdp (:3389): **disabled** (`systemctl disable --now`; won't restart on
      boot) — user doesn't use Remote Desktop

## 4. Documentation

- [x] 4.1 README security section: exposure posture + VPN-only remote-access policy
- [x] 4.2 Credential/bind locations documented there
