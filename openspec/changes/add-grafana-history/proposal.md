# Add Grafana for history and analytics views

## Why

InfluxDB holds years of clean history (energy, prices, heating, weather), but vis-2
shows almost exclusively instantaneous values — the history is invisible. vis-2 is the
wrong tool for time-series exploration; Grafana on top of the existing database is the
cheap, standard path and was decided on 2026-06-10.

## What Changes

- Grafana container on the Pi (docker, alongside the influxdb container) with the
  InfluxDB 1.8 datasource.
- Provisioned-as-code: datasource and dashboards live in this repo and are mounted into
  the container (no click-built, unbackuped dashboards).
- Initial dashboards: (1) energy day/week (production, consumption, self-consumption,
  autarky), (2) price vs. consumption (when do we consume relative to price), (3)
  heating flow/return vs. outdoor temperature, (4) base load (nightly minimum trend).
- Link from the vis-2 navigation to Grafana.
- Requires authentication (builds on `harden-network-services`).

## Capabilities

### New Capabilities
- `history-dashboards`: requirements for historical/analytical views.

### Modified Capabilities
- (none)

## Impact

- Pi: new container (~150–250 MB RAM — verify against the Pi's 1.5 GB available).
- Repo: `conf/grafana/` provisioning files, README run instructions.
- Depends on: `harden-network-services` (don't add another service to an
  unauthenticated host); `spike-tsdb-migration` outcome may later change the
  datasource — provisioning-as-code keeps that cheap.
