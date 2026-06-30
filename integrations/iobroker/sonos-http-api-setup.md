# Sonos HTTP API (jishi) — setup for the Musik tab

The Musik (Sonos) dashboard tab is driven by **jishi's `node-sonos-http-api`**, not the native
`iobroker.sonos` adapter. The adapter (v3.0.0, latest; built on the old `sonos-discovery` 1.7.3) cannot
group this Sonos **S2** system — grouping returns **HTTP 500** on `/MediaRenderer/AVTransport/Control`,
and its room names were stale (e.g. it reported "Kinderzimmer/Move" for what Sonos actually calls
"Claras Zimmer / Carlottas Zimmer"). jishi reads the live topology and groups correctly.

## Install (on the Pi)

```bash
git clone --depth 1 https://github.com/jishi/node-sonos-http-api.git /home/pi/node-sonos-http-api
cd /home/pi/node-sonos-http-api && npm install --production
```

## Run as a service

`/etc/systemd/system/sonos-http-api.service`:

```ini
[Unit]
Description=Sonos HTTP API (jishi node-sonos-http-api)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/node-sonos-http-api
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now sonos-http-api
```

Listens on **localhost:5005**. Verify: `curl -s http://localhost:5005/zones`.

## How the dashboard uses it

`musik_v2.js` (ioBroker script) polls `GET /zones` every 4 s for state (room names, volume,
now-playing, group membership) and renders the 8 room cards. Native tap-overlays write to
`javascript.0.musik_cmd`; the script turns commands into jishi calls:

- `<room>:playpause` → `/<room>/play` or `/<room>/pause` (explicit, chosen from the known state —
  the `/playpause` toggle does **not** reliably start a *stopped* room, which made play "revert")
- `<room>:vol:up|down` → `/<room>/volume/+1|-1`
- `group:alle` → each room `/<room>/join/Wohnzimmer`
- `group:wohnen` → Küche+Fernsehzimmer join Wohnzimmer, others `/leave`
- `group:einzeln` → each room `/<room>/leave`

Controls are **optimistic**: the script updates its local `ZONES` cache and re-publishes the grid
immediately (play icon flip, volume step, group membership `↪ coordinator`), then reconciles against
`/zones` on the next poll. This gives instant on-tap feedback instead of waiting for the 4 s poll.

Room names are the live Sonos names (URL-encoded by the script): Fernsehzimmer, Küche, Wohnzimmer,
Sauna, Bad, Claras Zimmer, Carlottas Zimmer, Studio. Adjust the `Wohnen` preset / coordinator in
`musik_v2.js` (`WOHNEN`, `COORD`).
