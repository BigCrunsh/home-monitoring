# Tasks

## 1. Spike (1 evening)

- [ ] 1.1 Check inverter for Modbus TCP support (model/firmware); enable if available
- [ ] 1.2 Choose the first controlled load + actuator path (HomeMatic plug via which
      bridge? Shelly natively?) — record decision + comfort constraints in design.md
- [ ] 1.3 Confirm Pi resource headroom for the evcc container

## 2. Deploy

- [ ] 2.1 evcc container + config in repo (`conf/evcc/evcc.yaml`, secrets via env):
      Tibber tariff, SolarEdge site (Modbus or cloud)
- [ ] 2.2 Verify evcc sees prices, PV production, and grid power correctly (compare
      against InfluxDB values)
- [ ] 2.3 Wire the first load with cheap-hour/surplus rules + deadline; test manual
      override behavior

## 3. Observe & evaluate

- [ ] 3.1 Bridge evcc decision/state into ioBroker (MQTT) for a dashboard tile
      (optional but cheap)
- [ ] 3.2 Record baseline week (automation off) vs. automation weeks
- [ ] 3.3 30-day review: shifted kWh, € saved, comfort complaints; decide load #2
