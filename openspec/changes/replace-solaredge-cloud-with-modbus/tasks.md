# Tasks

## 1. Counters (deploy first, so data accumulates)

- [ ] 1.1 `solaredge_modbus.js`: read the lifetime AC energy counter (SunSpec 40093–40095)
      in the same request as the power; publish `solaredge_modbus_energy_total` (Wh)
- [ ] 1.2 `mqtt_shelly.js`: publish the grid meter's lifetime import and export counters
      (`emdata:0` `total_act` / `total_act_ret`, Wh)
- [ ] 1.3 Log the three counters to InfluxDB (influxdb adapter, on change); deploy and verify

## 2. Energy totals

- [ ] 2.1 Rewrite `collect_solaredge_data`: 15-minute energy from counter differences
      (+ Maxxisun share from its metered power) into `electricity_energy_watthour`,
      same fields and tags; resume from the newest point; skip intervals with a counter gap
- [ ] 2.2 Remove the SolarEdge cloud client, its settings and tests
- [ ] 2.3 Deploy to the Pi checkout; verify fresh points after one cron run

## 3. Live states

- [ ] 3.1 `solaredge_power.js`: drop the cloud fallback and query; inverter offline after
      sunset → production 0 W; offline in daylight → stale

## 4. Healthcheck

- [ ] 4.1 Daily reconciliation: Shelly import yesterday vs. Tibber grid consumption
      yesterday; alert once when they differ by more than 5 % and 0.5 kWh
- [ ] 4.2 `conf/healthcheck.json`: drop the `electricity_power_watt` SLA; keep
      `electricity_energy_watthour`

## 5. Docs

- [ ] 5.1 README (Supported Systems, measurements), `INFLUXDB_MEASUREMENTS_DOCUMENTATION.md`
