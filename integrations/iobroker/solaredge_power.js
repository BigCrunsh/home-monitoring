// Publishes real-time energy states anchored on the grid-point meter.
//
// Modes:
//   modbus    — live inverter production over Modbus TCP (SunSpec, via the
//               solaredge_modbus script) plus the live Shelly 3EM grid. Preferred:
//               consumption and autarky are real-time, no cloud lag.
//   hybrid    — grid power from the live Shelly 3EM (mqtt_shelly states) plus the
//               newest SolarEdge production reading (~15 min fresh). Purchase and
//               feed-in are exact for the whole house; consumption and autarky are
//               derived from the grid anchor. Fallback when Modbus is asleep/offline.
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
var MODBUS_MAX_AGE_SECONDS = 30;  // live SolarEdge production via Modbus; older -> cloud row
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

function publish(values) {
    setState('power_consumption', values.consumption);
    setState('power_feedin', values.feedin);
    setState('power_production', values.production);
    setState('power_purchased', values.purchased);
    setState('power_selfconsumption', values.selfconsumption);
    setState('rate_autarky', values.rate_autarky);
    setState('rate_selfconsumption', values.rate_selfconsumption);
    setState('power_data_stale', false);
}

// hybrid: grid anchor (live Shelly) + freshest production reading.
// `production` = SolarEdge + Maxxisun feed-in (generation feeding the house bus).
// `maxxiCharge` = Maxxisun battery charging (W): storage, NOT household load, so it is
// excluded from Haus — otherwise charging off a solar surplus inflates consumption.
function computeHybrid(grid, production, maxxiCharge) {
    var purchased = Math.max(0, grid);    // grid import (exact)
    var feedin = Math.max(0, -grid);      // grid export (exact)
    // Haus = household appliance load = generation + net grid import − battery charging.
    var consumption = Math.max(0, production + grid - (maxxiCharge || 0));
    // self-consumption = generation used on-site (incl. battery charging), i.e. not exported.
    var selfconsumption = Math.max(0, production - feedin);
    return {
        consumption: consumption,
        feedin: feedin,
        production: production,
        purchased: purchased,
        selfconsumption: selfconsumption,
        rate_autarky: consumption > 0 ? Math.max(0, Math.min(1, (consumption - purchased) / consumption)) : 0,
        rate_selfconsumption: production > 0 ? Math.min(1, selfconsumption / production) : 0
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

    // Prefer live SolarEdge production over Modbus (SunSpec, via solaredge_modbus);
    // fall back to the newest cloud row when Modbus is offline/stale (inverter asleep).
    var mbOnline = getState('javascript.0.solaredge_modbus_online');
    var mbProd = getState('javascript.0.solaredge_modbus_production');
    var modbusLive = mbOnline && mbOnline.val === true
        && mbProd && typeof mbProd.val === 'number'
        && (Date.now() - mbProd.ts) / 1000 < MODBUS_MAX_AGE_SECONDS;

    // Maxxisun (Shelly plug): publish its live signed power + status for the dashboard.
    // Feed-in (negative apower) adds to generation; charging (positive apower) is battery
    // storage, subtracted from Haus below so it isn't counted as household consumption.
    var maxxiApower = readMaxxiApower();
    var maxxiProd = 0;
    if (maxxiApower !== null) {
        maxxiProd = Math.max(0, -maxxiApower);
        setState('power_maxxisun', Math.round(maxxiApower * 10) / 10);
        setState('maxxisun_status',
            maxxiApower < -5 ? 'Speist' : (maxxiApower > 5 ? 'Lädt' : 'Bereit'));
    } else {
        // stale/unreachable plug: production already counts Maxxisun as 0, so show idle too
        setState('power_maxxisun', 0);
        setState('maxxisun_status', 'Bereit');
    }

    // Pick the SolarEdge production source: live Modbus, else newest cloud row.
    var seProd, productionFresh;
    if (modbusLive) {
        seProd = Math.max(0, mbProd.val);
        productionFresh = true;
    } else if (cachedProductionRow) {
        seProd = cachedProductionRow.Production || 0;
        productionFresh = rowAgeSeconds(cachedProductionRow) < PRODUCTION_MAX_AGE_SECONDS;
    } else {
        return false;   // nothing usable yet
    }

    // Power states are only published when the data is fresh.
    var gridVal = (gridState && gridState.val !== null) ? gridState.val : 0;
    var maxxiCharge = (maxxiApower !== null) ? Math.max(0, maxxiApower) : 0;
    var vals = computeHybrid(gridVal, seProd + maxxiProd, maxxiCharge);
    var fresh = gridFresh && productionFresh;
    if (fresh) {
        publish(vals);
        return true;
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
            var rows = (result.result && result.result[0]) || [];
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
                publish(computeFromRow(row));
                return;
            }

            console.warn('no usable energy data; keeping previous values');
            setState('power_data_stale', true);
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

// live recompute on every fresh Modbus production reading (~6s)
on({ id: 'javascript.0.solaredge_modbus_production', change: 'ne' }, function () {
    recompute();
});

schedule("*/1 * * * *", queryInfluxDB);
