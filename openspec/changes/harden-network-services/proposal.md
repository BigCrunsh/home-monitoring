# Harden network services on the Pi

## Why

Every service on the Pi is reachable without authentication on the LAN: ioBroker admin
(:8081), vis-2/web (:8082, serves the full dashboard config), InfluxDB (:8086, accepts
arbitrary queries and writes), MQTT broker (:1883, bound 0.0.0.0), and a `terminal`
adapter (:8090, run as admin). A public hostname (`monitoring.sawade.me`) is actively
maintained via Dynu, so a single router misconfiguration would expose all of this to
the internet.

## What Changes

- Enable authentication on ioBroker (admin login), the MQTT broker, and InfluxDB
  (or bind InfluxDB to localhost — collectors and ioBroker run on the same host).
- Disable or restrict the `terminal` adapter (:8090).
- Update collectors' `.env` and the ioBroker `influxdb.0` adapter with credentials.
- Audit the FritzBox for port forwards to the Pi; document the result.
- Document the remote-access policy: VPN (WireGuard) only; never port-forward raw
  services.

## Capabilities

### New Capabilities
- `network-security`: authentication and exposure requirements for services on the Pi.

### Modified Capabilities
- (none)

## Impact

- Pi: ioBroker config, MQTT adapter, InfluxDB container config, terminal adapter.
- Repo: `.env.example` (new credential vars), `src/home_monitoring/config.py` if
  InfluxDB credentials are not already supported, README security section.
- Risk: every consumer of InfluxDB (collectors, `influxdb.0` adapter, future Grafana)
  must be updated in the same maintenance window or data collection stops.
