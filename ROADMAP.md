# Home Monitoring — Roadmap

Source: multi-perspective review of the repo, the Raspberry Pi, and the ioBroker
vis-2 dashboard (2026-06-10; smart-home, software-engineering, data-visualization,
and energy-optimization perspectives). Each roadmap item is an OpenSpec change under
`openspec/changes/<id>/` with its own proposal, spec deltas, and task list.

## Decisions taken (2026-06-10)

- **Energy automation**: closed-loop track via an **evcc sidecar** next to the
  existing stack (not a Home Assistant migration, not hand-rolled ioBroker JS).
- **Address leak**: rewrite git history and stay public (exposure is two device-name
  strings in one file, one commit).
- **Dashboard**: incremental vis-2 fixes **plus** Grafana for history/analytics.
- **InfluxDB 1.8 EOL**: evaluation spike first; migration is a follow-up change.

## Phases

### P0 — Security & privacy (do first, small)

| Change | Goal | Effort |
|---|---|---|
| `scrub-address-history` | Remove home address from repo + git history; sanitize device names at collection time | ~½ day |
| `harden-network-services` | Auth on ioBroker admin/MQTT/terminal + InfluxDB; router port-forward audit; remote-access policy | ~½ day |

### P1 — Reliability & single source of truth

| Change | Goal | Effort |
|---|---|---|
| `add-freshness-healthcheck` | Telegram alert when any measurement goes stale (rain was dead 5 months unnoticed) | ~½ day |
| `version-iobroker-scripts` | All 14 deployed JS scripts in git; deploy-from-git; reconcile drift (deployed `tibber_states` is outdated) | ~1 day |
| `fix-solaredge-power-metrics` | Fix the always-0 Autarkie/Eigenverbrauch (SolarEdge ~2 h consumption-data lag vs. latest-row query) — **deployed 2026-06-10**, dashboard shows real autarky for the first time | ~½ day |
| `harden-collector-runtime` | Timeouts/retries on API calls, cron locking, shell safety, logging consistency | ~1 day |

### P2 — Engineering hygiene

| Change | Goal | Effort |
|---|---|---|
| `restore-engineering-hygiene` | GitHub Actions CI (Travis is dead), truthful `.ai/context.md` + README, one dependency source | ~1 day |

### P3 — Dashboard

| Change | Goal | Effort |
|---|---|---|
| `improve-dashboard-data-states` | Tiles distinguish live/stale/unavailable; no rendered `NaN`; de-DE number formatting; WCAG-AA alert colors | ~2 days |
| `add-tibber-price-curve` | 24 h hourly price curve on Main (the single highest-value visual for a dynamic tariff) | ~1 day |
| `add-grafana-history` | Grafana on the existing InfluxDB: energy, price-vs-consumption, heating-vs-outdoor history | ~1–2 days |

### P4 — Energy automation (the money phase)

| Change | Goal | Effort |
|---|---|---|
| `add-realtime-hybrid-energy-states` | Anchor energy states on the live Shelly grid meter: purchase/feed-in exact in seconds, autarky near-real-time (added 2026-06-10 after the 2 h SolarEdge lag surfaced) | ~½ day |
| `add-maxxisun-integration` | **PENDING (CCU2 local API not yet open)** — capture the second PV system + battery; until then whole-house autarky is understated | blocked |
| `deploy-evcc-energy-automation` | evcc sidecar: Tibber tariff + SolarEdge PV (incl. Modbus TCP spike for local real-time inverter data), first price/PV-surplus-controlled load; battery-aware once Maxxisun lands (~€75–150/yr upside) | ~2–3 days |

### P5 — Platform modernization

| Change | Goal | Effort |
|---|---|---|
| `spike-tsdb-migration` | Evaluate VictoriaMetrics / InfluxDB 3 / TimescaleDB against real constraints (aioinflux, ioBroker adapter, InfluxQL scripts); decision doc | ~1 day |
| `upgrade-pi-os` | 64-bit current OS via fresh SD + restore drill (tests the backup), unattended-upgrades, rebuild runbook | ~1 day + cutover |

## Dependencies

- `version-iobroker-scripts` should land before or with `fix-solaredge-power-metrics`
  (the fix is deployed through the new from-git workflow).
- `fix-solaredge-power-metrics` feeds `improve-dashboard-data-states` (staleness state).
- `harden-network-services` before `add-grafana-history` and `deploy-evcc-energy-automation`
  (don't add services to an unauthenticated host).
- `spike-tsdb-migration` outcome gates any storage migration; everything else is
  independent of it.

## Non-spec chores (no OpenSpec change needed)

- Replace the Netatmo rain-gauge batteries (hardware dead since 2025-12-30).
- `git pull` on the Pi (checkout is behind master) — folded into `version-iobroker-scripts`.
- **Pi timezone is Europe/London, house is in Berlin** (found 2026-06-10; UTC/NTP are
  correct). Cron schedules and local-time day boundaries (e.g. Tibber "yesterday"
  aggregations) are shifted 1 h vs. the Berlin billing day. Fix = `timedatectl
  set-timezone Europe/Berlin`, but review cron timings and day-boundary logic in the
  same window — treat as a small maintenance task, not a drive-by change.

## Open questions

- **Gardena**: keep (re-auth the `smartgarden` adapter) or retire (remove adapter,
  `gardena_valve` script, Python service, dashboard tiles)? Blocks part of
  `improve-dashboard-data-states`.
- **Router port forwarding**: is anything forwarded to the Pi? (`monitoring.sawade.me`
  is actively updated.) Answered as part of `harden-network-services`.
- **First controlled load for evcc**: which device (hot-water, dishwasher, other)?
  Decided in the `deploy-evcc-energy-automation` spike task.
- **Maxxisun CCU2 local API**: in progress upstream, not open yet (state 2026-06-10).
  `add-maxxisun-integration` re-checks ~monthly; community adapters
  (ioBroker.maxxi-charge) target the older CCU and need verification against CCU2.
