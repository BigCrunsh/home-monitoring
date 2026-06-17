// Publishes real-time energy states anchored on the grid-point meter.
//
// Modes (published in power_calc_mode):
//   hybrid    — grid power from the live Shelly 3EM (mqtt_shelly states) plus the
//               newest SolarEdge production reading (~15 min fresh). Purchase and
//               feed-in are exact for the whole house; consumption and autarky are
//               derived from the grid anchor.
//   solaredge — fallback when the Shelly state is stale: newest COMPLETE SolarEdge
//               row (consumption-side fields present; the SolarEdge cloud delivers
//               them ~2h late and attributes everything to FeedIn until then).
//   stale     — nothing usable; previous values are kept.
//
// Maxxisun: the PV+battery's gross AC is metered by a Shelly Plug S Gen3 (signed apower;
// negative = feeding/producing, positive = charging). In hybrid mode its feed-in is added
// to production, so consumption/autarky now include it; its charging is captured by the
// grid anchor as consumption. The signed value + status are also published for the
// dashboard (power_maxxisun / maxxisun_status). The solaredge fallback row does NOT
// include the Maxxisun. Purchase and feed-in are exact regardless.

createState('power_consumption', 0, {
    desc: 'Aktueller Leistungsverbrauch',
    type: 'number',
    role: 'value',
    unit: 'Watt'
});

createState('power_feedin', 0, {
    desc: 'Aktuelle Leistungseinspeisung',
    type: 'number',
    role: 'value',
    unit: 'Watt'
});

createState('power_production', 0, {
    desc: 'Aktuelle Leistungsproduktion',
    type: 'number',
    role: 'value',
    unit: 'Watt'
});

createState('power_purchased', 0, {
    desc: 'Aktueller Leistungseinkauf',
    type: 'number',
    role: 'value',
    unit: 'Watt'
});

createState('power_selfconsumption', 0, {
    desc: 'Aktuelle Leistungseigenverbrauch',
    type: 'number',
    role: 'value',
    unit: 'Watt'
});

createState('rate_autarky', 0, {
    desc: 'Aktuelle Autarkiequote',
    type: 'number',
    role: 'value',
});

createState('rate_selfconsumption', 0, {
    desc: 'Aktuelle Eigenverbrauchsquote',
    type: 'number',
    role: 'value',
});

createState('power_data_age_seconds', 0, {
    desc: 'Alter der verwendeten Messwerte',
    type: 'number',
    role: 'value',
    unit: 's'
});

createState('power_calc_mode', 'stale', {
    desc: 'Berechnungsmodus (hybrid | solaredge | stale)',
    type: 'string',
    role: 'state',
});

createState('power_maxxisun', 0, {
    desc: 'Maxxisun AC-Leistung (negativ = Einspeisung, positiv = Laden)',
    type: 'number',
    role: 'value',
    unit: 'Watt'
});

createState('maxxisun_status', 'Bereit', {
    desc: 'Maxxisun Lade-/Einspeisestatus (Speist | Laedt | Bereit)',
    type: 'string',
    role: 'state',
});

createState('maxxisun_tile', '', {
    desc: 'Maxxisun-Kachel (SVG fuer das Dashboard)',
    type: 'string',
    role: 'html',
});

createState('energy_flow_card', '', {
    desc: 'Energiefluss-Karte (SVG fuer das Dashboard)',
    type: 'string',
    role: 'html',
});

createState('maxxisun_relay', false, {
    desc: 'Maxxisun-Steckdose an/aus (Shelly-Relais)',
    type: 'boolean', role: 'switch', read: true, write: true,
});

// last createState: its callback triggers the first query, so all states
// exist before the first setState (avoids the create/set race on deploy)
createState('power_data_stale', true, {
    desc: 'Keine vollstaendige Messreihe innerhalb des Zeitfensters',
    type: 'boolean',
    role: 'indicator.maintenance',
}, function () {
    queryInfluxDB();
});

var MAX_AGE_HOURS = 6;            // fallback window for complete SolarEdge rows
var GRID_MAX_AGE_SECONDS = 300;   // Shelly reading older than this -> fallback
// SolarEdge publishes quarter-hour power rows ~60-75 min late, so the newest
// row is normally ~1h old; the gate only catches genuine collection outages
var PRODUCTION_MAX_AGE_SECONDS = 7200;
var GRID_STATE = 'javascript.0.mqtt_shelly.total_act_power';  // negative = export
// Shelly Plug S Gen3 metering the Maxxisun (signed apower: negative = feeding/producing)
var MAXXI_STATE = 'mqtt.0.shellyplugsg3-48f6eeb7af98.status.switch:0';
var MAXXI_MAX_AGE_SECONDS = 120;  // plug publishes every few s; older -> ignore

// Maxxisun AC power (signed; negative = feeding/producing) from the plug's switch:0
// JSON. Returns null if the reading is missing or stale.
function readMaxxiApower() {
    var s = getState(MAXXI_STATE);
    if (!s || s.val === null || s.val === undefined) return null;
    if ((Date.now() - s.ts) / 1000 > MAXXI_MAX_AGE_SECONDS) return null;
    try {
        var d = typeof s.val === 'string' ? JSON.parse(s.val) : s.val;
        return typeof d.apower === 'number' ? d.apower : null;
    } catch (e) { return null; }
}

// --- Maxxisun plug relay control (Shelly Plug S Gen3 local API) ---
var axios = require('axios');
var MAXXI_IP = '192.168.178.122';
// Reflect the plug's actual relay state on the dashboard switch (read-back).
function syncMaxxiRelay() {
    var s = getState(MAXXI_STATE);
    if (!s || !s.val) return;
    try {
        var d = typeof s.val === 'string' ? JSON.parse(s.val) : s.val;
        if (typeof d.output === 'boolean') setState('maxxisun_relay', d.output, true);
    } catch (e) {}
}
// Dashboard toggle (ack=false) -> command the plug over its local API.
on({ id: 'javascript.0.maxxisun_relay', ack: false }, function (obj) {
    axios.get('http://' + MAXXI_IP + '/rpc/Switch.Set?id=0&on=' + (obj.state.val ? 'true' : 'false'))
        .catch(function (e) { console.warn('maxxisun relay set failed: ' + e.message); });
});

// Maxxisun status tile (66x66 SVG) for a vis tplHtml widget: green=feeding,
// amber=charging, grey=idle. Mirrors the socket-row look on Main.
function renderMaxxiTile(apower) {
    var GREEN = '#b5fb5b', AMBER = '#F1BE3D', MUTE = '#7f8a99';
    var feeding = apower < -5, charging = apower > 5;
    var col = feeding ? GREEN : (charging ? AMBER : MUTE);
    var border = feeding ? GREEN : (charging ? AMBER : '#3a4452');
    var watts = Math.round(Math.abs(apower));
    var arrow = feeding ? '▼' : (charging ? '▲' : '—');
    var word = feeding ? 'Speist' : (charging ? 'Lädt' : 'Bereit');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66 66" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">'
        + '<rect x="0.75" y="0.75" width="64.5" height="64.5" rx="10" fill="var(--color-panel)" stroke="' + border + '" stroke-width="1.5"/>'
        + '<text x="33" y="15" fill="#cfd6e0" font-family="Arial,sans-serif" font-size="9" text-anchor="middle">Maxxisun</text>'
        + '<text x="33" y="40" fill="' + col + '" font-family="Arial,sans-serif" font-size="18" text-anchor="middle">' + watts + '<tspan font-size="10">W</tspan></text>'
        + '<text x="33" y="56" fill="' + col + '" font-family="Arial,sans-serif" font-size="10" text-anchor="middle">' + arrow + ' ' + word + '</text>'
        + '</svg>';
}

// One flow arrow (line + arrowhead at x2,y2). Stroke width scales with the flow
// magnitude (sqrt) so the dominant flow is obvious at a glance.
function efArrow(x1, y1, x2, y2, col, watts) {
    var a = Math.atan2(y2 - y1, x2 - x1);
    var sw = Math.max(2, Math.min(13, 2 + Math.sqrt(Math.abs(watts || 0)) / 55 * 11));
    var s = 5 + sw * 0.6;
    var lx2 = (x2 - s * 0.5 * Math.cos(a)).toFixed(1), ly2 = (y2 - s * 0.5 * Math.sin(a)).toFixed(1);
    var ax = (x2 - s * Math.cos(a - 0.5)).toFixed(1), ay = (y2 - s * Math.sin(a - 0.5)).toFixed(1);
    var bx = (x2 - s * Math.cos(a + 0.5)).toFixed(1), by = (y2 - s * Math.sin(a + 0.5)).toFixed(1);
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + lx2 + '" y2="' + ly2
        + '" stroke="' + col + '" stroke-width="' + sw.toFixed(1) + '" stroke-linecap="round"/>'
        + '<polygon points="' + x2 + ',' + y2 + ' ' + ax + ',' + ay + ' ' + bx + ',' + by + '" fill="' + col + '"/>';
}

// Flat line-icons drawn as SVG paths (no emoji), recoloured by state. ~26px box.
function efIcon(kind, cx, cy, col) {
    var g = '<g stroke="' + col + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">';
    if (kind === 'sun') {
        g += '<circle cx="' + cx + '" cy="' + cy + '" r="6"/>';
        for (var i = 0; i < 8; i++) {
            var a = i * Math.PI / 4;
            g += '<line x1="' + (cx + 9 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + 9 * Math.sin(a)).toFixed(1)
              + '" x2="' + (cx + 12 * Math.cos(a)).toFixed(1) + '" y2="' + (cy + 12 * Math.sin(a)).toFixed(1) + '"/>';
        }
    } else if (kind === 'house') {
        g += '<path d="M' + (cx - 13) + ' ' + (cy - 1) + ' L' + cx + ' ' + (cy - 13) + ' L' + (cx + 13) + ' ' + (cy - 1) + '"/>';
        g += '<rect x="' + (cx - 10) + '" y="' + (cy - 1) + '" width="20" height="13" rx="1.5"/>';
    } else if (kind === 'grid') {
        g += '<line x1="' + (cx - 9) + '" y1="' + (cy + 13) + '" x2="' + (cx - 2) + '" y2="' + (cy - 13) + '"/>';
        g += '<line x1="' + (cx + 9) + '" y1="' + (cy + 13) + '" x2="' + (cx + 2) + '" y2="' + (cy - 13) + '"/>';
        g += '<line x1="' + (cx - 9) + '" y1="' + (cy - 13) + '" x2="' + (cx + 9) + '" y2="' + (cy - 13) + '"/>';
        g += '<line x1="' + (cx - 6) + '" y1="' + (cy - 1) + '" x2="' + (cx + 6) + '" y2="' + (cy - 1) + '"/>';
        g += '<line x1="' + (cx - 8) + '" y1="' + (cy + 8) + '" x2="' + (cx + 8) + '" y2="' + (cy + 8) + '"/>';
    } else if (kind === 'battery') {
        g += '<rect x="' + (cx - 13) + '" y="' + (cy - 7) + '" width="24" height="14" rx="2.5"/>';
        g += '<line x1="' + (cx + 13) + '" y1="' + (cy - 3) + '" x2="' + (cx + 13) + '" y2="' + (cy + 3) + '" stroke-width="3"/>';
    }
    return g + '</g>';
}

// Live "Energiefluss" hub (386x281): house centre (hero), PV left, Netz right,
// Akku below. Arrow thickness scales with flow; colour shows direction. One font
// (RobotoCondensed), 2-tier greys (value #CCCCCC, label #8A8A8A); palette via CSS vars.
// `eigen` kept in the signature for the call site but no longer shown (moves to Energy tab).
function renderEnergyFlow(se, maxxi, grid, haus, autark, eigen, price, priceMin, priceMax, stale, ageMin) {
    var VAL = 'var(--color-font)', LBL = 'var(--color-text-muted)',
        GREEN = 'var(--color-green)', BLUE = 'var(--color-blue)', AMBER = 'var(--color-yellow)',
        RED = 'var(--color-red)',
        PANEL = 'var(--color-panel)', BORDER = 'var(--color-border)', NODE = '#1a1c24',
        F = 'font-family="RobotoCondensed-Regular,sans-serif"';
    var FEEDIN_RATE = 0.1048;
    function w(v) { return Math.round(Math.abs(v || 0)) + ' W'; }
    var p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 386 281" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">'];
    p.push('<rect x="1" y="1" width="384" height="279" rx="12" fill="' + PANEL + '" stroke="' + BORDER + '"/>');

    function kw(v) { var a = Math.abs(v || 0); return a >= 1000 ? (a / 1000).toFixed(1).replace('.', ',') + ' kW' : Math.round(a) + ' W'; }
    var imp = grid > 50, exp = grid < -50,
        feed = maxxi !== null && maxxi < -50, chg = maxxi !== null && maxxi > 50, seOn = se > 50;
    // price position on today's range -> red→green spectrum colour
    var pf = (typeof price === 'number' && typeof priceMin === 'number' && typeof priceMax === 'number' && priceMax > priceMin)
        ? Math.max(0, Math.min(1, (price - priceMin) / (priceMax - priceMin))) : 0.5;
    var priceCol = pf < 0.34 ? GREEN : (pf < 0.67 ? AMBER : RED);

    // ===== title + status (status smaller; net balance ALWAYS shown, even when balanced) =====
    var net = grid > 0 ? grid / 1000 * (price || 0) : grid / 1000 * FEEDIN_RATE;
    var earning = net < -0.0005;
    var headCol = exp ? GREEN : (imp ? priceCol : LBL);
    var statusWord = exp ? 'Einspeisung' : (imp ? 'Netzbezug' : 'Ausgeglichen');
    p.push('<text x="14" y="22" fill="' + VAL + '" ' + F + ' font-size="16">Energiefluss</text>');
    p.push('<text x="14" y="42" fill="' + headCol + '" ' + F + ' font-size="15">' + statusWord + ' ' + kw(grid) + '</text>');
    p.push('<text x="372" y="42" fill="' + (Math.abs(net) < 0.005 ? LBL : (earning ? GREEN : priceCol)) + '" ' + F + ' font-size="14" text-anchor="end">'
        + (earning ? '+' : '') + Math.abs(net).toFixed(2).replace('.', ',') + ' €/h</text>');

    // ===== price: value + günstig/mittel/teuer + spectrum track =====
    if (typeof price === 'number' && price > 0) {
        var word = pf < 0.34 ? 'günstig' : (pf < 0.67 ? 'mittel' : 'teuer');
        p.push('<text x="14" y="60" fill="' + LBL + '" ' + F + ' font-size="12">Strompreis '
            + '<tspan fill="' + priceCol + '">' + price.toFixed(2).replace('.', ',') + ' €/kWh</tspan> '
            + '<tspan fill="' + priceCol + '">· ' + word + '</tspan></text>');
        if (priceMax > priceMin) {
            var tx0 = 250, tw = 122, ty = 55;
            p.push('<defs><linearGradient id="efprg" x1="0" x2="1"><stop offset="0" stop-color="' + GREEN + '"/><stop offset="0.5" stop-color="' + AMBER + '"/><stop offset="1" stop-color="' + RED + '"/></linearGradient></defs>');
            p.push('<rect x="' + tx0 + '" y="' + ty + '" width="' + tw + '" height="4" rx="2" fill="url(#efprg)" opacity="0.6"/>');
            p.push('<circle cx="' + (tx0 + pf * tw).toFixed(1) + '" cy="' + (ty + 2) + '" r="4" fill="' + VAL + '"/>');
        }
    }

    // ===== breakdown (numbers-led): icon + name + magnitude bar + value =====
    var maxV = Math.max(Math.abs(se || 0), Math.abs(maxxi || 0), Math.abs(grid || 0), Math.abs(haus || 0), 1);
    function row(yy, kind, name, val, barCol, valCol, prefix) {
        var frac = Math.min(1, Math.abs(val || 0) / maxV);
        p.push(efIcon(kind, 26, yy, barCol));
        p.push('<text x="48" y="' + (yy + 4) + '" fill="' + LBL + '" ' + F + ' font-size="13">' + name + '</text>');
        p.push('<rect x="132" y="' + (yy - 3) + '" width="158" height="7" rx="3" fill="' + BORDER + '" opacity="0.5"/>');
        p.push('<rect x="132" y="' + (yy - 3) + '" width="' + (158 * frac).toFixed(0) + '" height="7" rx="3" fill="' + barCol + '"/>');
        p.push('<text x="372" y="' + (yy + 5) + '" fill="' + valCol + '" ' + F + ' font-size="15" text-anchor="end">' + (prefix || '') + w(val) + '</text>');
    }
    row(84, 'sun', 'SolarEdge', se, seOn ? GREEN : LBL, VAL, '');
    row(116, 'battery', 'Maxxisun', maxxi, feed ? GREEN : (chg ? AMBER : LBL), feed ? GREEN : (chg ? AMBER : VAL), '');
    row(148, 'grid', 'Netz', grid, exp ? GREEN : (imp ? priceCol : LBL), exp ? GREEN : (imp ? priceCol : VAL), '');
    row(180, 'house', 'Haus', haus, LBL, LBL, '≈ ');

    // ===== Autarkie (derived from house → marked ≈ until Modbus) =====
    var aPct = Math.round((autark || 0) * 100);
    p.push('<text x="14" y="212" fill="' + LBL + '" ' + F + ' font-size="11">Autarkie <tspan font-size="10">(≈ geschätzt)</tspan></text>');
    p.push('<text x="372" y="212" fill="' + LBL + '" ' + F + ' font-size="13" text-anchor="end">' + aPct + '%</text>');
    p.push('<rect x="14" y="218" width="358" height="6" rx="3" fill="' + BORDER + '"/>');
    p.push('<rect x="14" y="218" width="' + (3.58 * Math.min(aPct, 100)).toFixed(0) + '" height="6" rx="3" fill="' + GREEN + '"/>');

    if (stale) {
        p.push('<text x="14" y="242" fill="' + AMBER + '" ' + F + ' font-size="10">● Stand: vor ' + (ageMin || 0) + ' min (Cloud-Verzögerung)</text>');
    }
    p.push('</svg>');
    return p.join('');
}

// A row is complete once the consumption meter has reported: consumption-side
// fields are present and feed-in cannot exceed production (1W tolerance).
function isComplete(row) {
    var consumption = row.Consumption || 0;
    var purchased = row.Purchased || 0;
    var production = row.Production || 0;
    var feedin = row.FeedIn || 0;
    if (consumption <= 0 && purchased <= 0) {
        return false;
    }
    if (feedin > production + 1) {
        return false;
    }
    return true;
}

function rowAgeSeconds(row) {
    // the influxdb adapter returns the row timestamp as `ts` (ms epoch)
    var row_ts = row.ts !== undefined ? row.ts : row.time;
    return Math.round((Date.now() - new Date(row_ts).getTime()) / 1000);
}

function publish(values, mode, ageSeconds) {
    setState('power_consumption', values.consumption);
    setState('power_feedin', values.feedin);
    setState('power_production', values.production);
    setState('power_purchased', values.purchased);
    setState('power_selfconsumption', values.selfconsumption);
    setState('rate_autarky', values.rate_autarky);
    setState('rate_selfconsumption', values.rate_selfconsumption);
    setState('power_data_age_seconds', ageSeconds);
    setState('power_calc_mode', mode);
    setState('power_data_stale', false);
}

// hybrid: grid anchor (live Shelly) + freshest production reading
function computeHybrid(grid, production) {
    var purchased = Math.max(0, grid);
    var feedin = Math.max(0, -grid);
    // clamp to physical bounds: stale-high production with live export could
    // otherwise yield negative values
    var consumption = Math.max(purchased, production + grid);
    var selfconsumption = Math.min(
        Math.max(0, production - feedin),
        consumption
    );
    return {
        consumption: consumption,
        feedin: feedin,
        production: production,
        purchased: purchased,
        selfconsumption: selfconsumption,
        rate_autarky: consumption > 0 ? (consumption - purchased) / consumption : 0,
        rate_selfconsumption: production > 0 ? selfconsumption / production : 0
    };
}

function computeFromRow(row) {
    var consumption = row.Consumption || 0;
    var production = row.Production || 0;
    var selfconsumption = row.SelfConsumption || 0;
    return {
        consumption: consumption,
        feedin: row.FeedIn || 0,
        production: production,
        purchased: row.Purchased || 0,
        selfconsumption: selfconsumption,
        rate_autarky: consumption > 0 ? selfconsumption / consumption : 0,
        rate_selfconsumption: production > 0 ? selfconsumption / production : 0
    };
}

// cached newest production row, refreshed by the scheduled InfluxDB query;
// grid-change events recompute from this cache so Main reacts in seconds
var cachedProductionRow = null;

function recompute() {
    var gridState = getState(GRID_STATE);
    var gridFresh = gridState && gridState.val !== null
        && (Date.now() - gridState.ts) / 1000 < GRID_MAX_AGE_SECONDS;
    var productionFresh = cachedProductionRow
        && rowAgeSeconds(cachedProductionRow) < PRODUCTION_MAX_AGE_SECONDS;

    // Maxxisun (Shelly plug): publish its live signed power + status for the dashboard,
    // and add only its feed-in (negative apower) to production. Its charging (positive
    // apower) is already captured by the grid anchor as consumption, so it needs nothing.
    var maxxiApower = readMaxxiApower();
    var maxxiProd = 0;
    if (maxxiApower !== null) {
        maxxiProd = Math.max(0, -maxxiApower);
        setState('power_maxxisun', Math.round(maxxiApower * 10) / 10);
        setState('maxxisun_status',
            maxxiApower < -5 ? 'Speist' : (maxxiApower > 5 ? 'Lädt' : 'Bereit'));
        setState('maxxisun_tile', renderMaxxiTile(maxxiApower));
    }

    // Always render the hub with best-available data + a staleness flag, so it never
    // silently freezes. Power states are still only published when the data is fresh.
    if (cachedProductionRow) {
        var seProd = cachedProductionRow.Production || 0;
        var gridVal = (gridState && gridState.val !== null) ? gridState.val : 0;
        var vals = computeHybrid(gridVal, seProd + maxxiProd);
        var priceS = getState('javascript.0.tibber_states.energy_price_euro');
        var pMinS = getState('javascript.0.tibber_states.energy_price_euro_min');
        var pMaxS = getState('javascript.0.tibber_states.energy_price_euro_max');
        var price = priceS && typeof priceS.val === 'number' ? priceS.val : null;
        var pMin = pMinS && typeof pMinS.val === 'number' ? pMinS.val : null;
        var pMax = pMaxS && typeof pMaxS.val === 'number' ? pMaxS.val : null;
        var fresh = gridFresh && productionFresh;
        setState('energy_flow_card', renderEnergyFlow(
            seProd, maxxiApower, gridVal, vals.consumption,
            vals.rate_autarky, vals.rate_selfconsumption, price, pMin, pMax,
            !fresh, Math.round(rowAgeSeconds(cachedProductionRow) / 60)));
        if (fresh) {
            publish(vals, 'hybrid', rowAgeSeconds(cachedProductionRow));
            return true;
        }
    }
    return false;
}

function queryInfluxDB() {
    sendTo('influxdb.0', 'query',
        'SELECT * FROM home_monitoring.autogen.electricity_power_watt'
        + ' WHERE time > now() - ' + MAX_AGE_HOURS + 'h'
        + ' ORDER BY time DESC LIMIT 30',
        function (result) {
            if (result.error) {
                console.error(result.error);
                return;
            }
            var rows = result.result[0] || [];
            cachedProductionRow = rows.length ? rows[0] : null;

            if (recompute()) {
                return;
            }

            // fallback: newest complete SolarEdge row
            var row = null;
            for (var i = 0; i < rows.length; i++) {
                if (isComplete(rows[i])) {
                    row = rows[i];
                    break;
                }
            }
            if (row) {
                publish(computeFromRow(row), 'solaredge', rowAgeSeconds(row));
                return;
            }

            console.warn('no usable energy data; keeping previous values');
            setState('power_data_stale', true);
            setState('power_calc_mode', 'stale');
        }
    );
}

// live recompute on every Shelly reading (~10s); cheap, no InfluxDB round-trip
on({ id: GRID_STATE, change: 'ne' }, function () {
    recompute();
});

// live recompute when the Maxxisun plug reports (negative apower = feeding)
on({ id: MAXXI_STATE, change: 'ne' }, function () {
    recompute();
    syncMaxxiRelay();
});

schedule("*/1 * * * *", queryInfluxDB);
