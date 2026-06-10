// Publishes real-time energy states from InfluxDB (electricity_power_watt).
//
// SolarEdge delivers consumption-meter fields (Consumption, Purchased,
// SelfConsumption) ~2h later than Production/FeedIn, and attributes all
// production to FeedIn until then. The newest rows are therefore incomplete:
// consumption-side fields are 0 and FeedIn can exceed Production. This script
// picks the newest COMPLETE row instead of the newest row, and publishes the
// age of the row used so dashboards can show staleness.

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

// last createState: its callback triggers the first query, so all states
// exist before the first setState (avoids the create/set race on deploy)
createState('power_data_stale', true, {
    desc: 'Keine vollstaendige Messreihe innerhalb des Zeitfensters',
    type: 'boolean',
    role: 'indicator.maintenance',
}, function () {
    queryInfluxDB();
});

var MAX_AGE_HOURS = 6;

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
            var row = null;
            for (var i = 0; i < rows.length; i++) {
                if (isComplete(rows[i])) {
                    row = rows[i];
                    break;
                }
            }

            if (!row) {
                console.warn('no complete electricity_power_watt row within '
                    + MAX_AGE_HOURS + 'h; keeping previous values');
                setState('power_data_stale', true);
                return;
            }

            var power_consumption = row.Consumption || 0;
            var power_feedin = row.FeedIn || 0;
            var power_production = row.Production || 0;
            var power_purchased = row.Purchased || 0;
            var power_selfconsumption = row.SelfConsumption || 0;
            var rate_autarky = power_consumption > 0
                ? power_selfconsumption / power_consumption
                : 0;
            var rate_selfconsumption = power_production > 0
                ? power_selfconsumption / power_production
                : 0;
            // the influxdb adapter returns the row timestamp as `ts` (ms epoch)
            var row_ts = row.ts !== undefined ? row.ts : row.time;
            var age_seconds = Math.round(
                (Date.now() - new Date(row_ts).getTime()) / 1000
            );

            setState('power_consumption', power_consumption);
            setState('power_feedin', power_feedin);
            setState('power_production', power_production);
            setState('power_purchased', power_purchased);
            setState('power_selfconsumption', power_selfconsumption);
            setState('rate_autarky', rate_autarky);
            setState('rate_selfconsumption', rate_selfconsumption);
            setState('power_data_age_seconds', age_seconds);
            setState('power_data_stale', false);
        }
    );
}

schedule("*/5 * * * *", queryInfluxDB);
