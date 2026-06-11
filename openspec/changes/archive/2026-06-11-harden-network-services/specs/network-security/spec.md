# network-security (delta)

## ADDED Requirements

### Requirement: Administrative and data services require authentication
ioBroker admin, the MQTT broker, and InfluxDB SHALL reject unauthenticated access.
InfluxDB MAY alternatively be bound to localhost only.

#### Scenario: Unauthenticated InfluxDB query
- **WHEN** a client on the LAN sends `SHOW DATABASES` to port 8086 without credentials
- **THEN** the request is rejected (or the port is not reachable from the LAN)

#### Scenario: ioBroker admin access
- **WHEN** a browser opens port 8081
- **THEN** a login is required before any adapter or state is visible

#### Scenario: Collectors keep working after hardening
- **WHEN** authentication is enabled and credentials are configured via environment
  variables
- **THEN** all cron collectors and the ioBroker `influxdb.0` adapter continue to write
  successfully

### Requirement: No raw service exposure to the internet
No router port-forward SHALL target the Pi's service ports (8081, 8082, 8086, 8090,
1883). Remote access SHALL be provided via VPN only.

#### Scenario: Router audit
- **WHEN** the FritzBox port-forwarding configuration is reviewed
- **THEN** no rule forwards to the Pi's service ports, and the finding is documented
  in the README security section
