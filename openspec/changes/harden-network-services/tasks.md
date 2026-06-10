# Tasks

## 1. Audit

- [ ] 1.1 Inventory listening services on the Pi (`ss -tlnp`) and record current
      exposure in the change's design notes
- [ ] 1.2 Check FritzBox port forwards / MyFRITZ shares; document result

## 2. InfluxDB

- [ ] 2.1 Decide: enable auth vs. bind to localhost (both acceptable per spec)
- [ ] 2.2 Add credential support to `.env.example` / `config.py` if needed
- [ ] 2.3 Apply on the Pi; update all collectors and the ioBroker `influxdb.0` adapter
      in one maintenance window
- [ ] 2.4 Verify: unauthenticated query rejected; fresh data arriving in all
      measurements afterwards

## 3. ioBroker surface

- [ ] 3.1 Enable admin authentication (and vis-2 access control if family devices allow)
- [ ] 3.2 Set MQTT broker credentials; update the Shelly device(s) to match
- [ ] 3.3 Disable or localhost-restrict the `terminal` adapter (:8090)

## 4. Documentation

- [ ] 4.1 README security section: what is protected how, VPN-only remote access policy
- [ ] 4.2 Document credential locations (.env on Pi, ioBroker adapter configs)
