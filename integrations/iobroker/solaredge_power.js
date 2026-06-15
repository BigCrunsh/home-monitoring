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
            maxxiApower < -5 ? 'Speist' : (maxxiApower > 5 ? 'Laedt' : 'Bereit'));
    }

    if (gridFresh && productionFresh) {
        publish(
            computeHybrid(gridState.val, (cachedProductionRow.Production || 0) + maxxiProd),
            'hybrid',
            rowAgeSeconds(cachedProductionRow)
        );
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
});

schedule("*/1 * * * *", queryInfluxDB);
