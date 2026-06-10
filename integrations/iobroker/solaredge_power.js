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
// Known limitation: the Maxxisun PV+battery system is not captured yet (CCU2 local
// API pending), so consumption omits its output and autarky is understated. Purchase
// and feed-in are exact regardless.

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

    if (gridFresh && productionFresh) {
        publish(
            computeHybrid(gridState.val, cachedProductionRow.Production || 0),
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

schedule("*/1 * * * *", queryInfluxDB);
