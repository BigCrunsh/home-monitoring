// Dachterrasse
createState('valve_last_activity_dachterrasse', 0,{
    desc: 'Letzte Bewässerung Modus im Dachterrasse',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_dachterrasse', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Dachterrasse',
    type: 'number',
    role: 'value',
});

// Garten
createState('valve_last_activity_garten', 0,{
    desc: 'Letzte Bewässerung Modus im Garten',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_garten', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Garten',
    type: 'number',
    role: 'value',
});

// Hochbeet
createState('valve_last_activity_hochbeet', 0,{
    desc: 'Letzte Bewässerung Modus im Hochbeet',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_hochbeet', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Hochbeet',
    type: 'number',
    role: 'value',
});

// Randbeet
createState('valve_last_activity_randbeet', 0,{
    desc: 'Letzte Bewässerung Modus im Randbeet',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_randbeet', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Randbeet',
    type: 'number',
    role: 'value',
});

// Traufkiesstreifen
createState('valve_last_activity_traufkiesstreifen', 0,{
    desc: 'Letzte Bewässerung Modus im Traufkiesstreifen',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_traufkiesstreifen', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Traufkiesstreifen',
    type: 'number',
    role: 'value',
});

// Vorgarten
createState('valve_last_activity_vorgarten', 0,{
    desc: 'Letzte Bewässerung Modus im Vorgarten',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_vorgarten', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Vorgarten',
    type: 'number',
    role: 'value',
});


function queryInfluxDBGardena() {
    sendTo('influxdb.0', 'query', "SELECT last(state), valve_name, activity FROM home_monitoring.autogen.garden_valves_activity WHERE activity != 'CLOSED' AND state = 1 GROUP BY valve_name", function (result) {
        log(result.result[0])
        if (result.error) {
            console.error(result.error);
        } else {
            for (let i = 0; i < result.result[0].length; i++) {
                const date = new Date(result.result[0][i].ts)

                // Dachterrasse
                if (result.result[0][i].valve_name === 'Dachterrasse') {
                    setState('valve_last_activity_dachterrasse', result.result[0][i].activity);
                    setState('valve_last_activity_ts_dachterrasse', result.result[0][i].ts);
                }
                // Garten
                if (result.result[0][i].valve_name === 'Garten') {
                    setState('valve_last_activity_garten', result.result[0][i].activity);
                    setState('valve_last_activity_ts_garten', result.result[0][i].ts);
                }
                // Hochbeet
                if (result.result[0][i].valve_name === 'Hochbeet') {
                    setState('valve_last_activity_hochbeet', result.result[0][i].activity);
                    setState('valve_last_activity_ts_hochbeet', result.result[0][i].ts);
                }
                // Randbeet
                if (result.result[0][i].valve_name === 'Randbeet') {
                    setState('valve_last_activity_randbeet', result.result[0][i].activity);
                    setState('valve_last_activity_ts_randbeet', result.result[0][i].ts);
                }
                // Traufkiesstreifen
                if (result.result[0][i].valve_name === 'Traufkiesstreifen') {
                    setState('valve_last_activity_traufkiesstreifen', result.result[0][i].activity);
                    setState('valve_last_activity_ts_traufkiesstreifen', result.result[0][i].ts);
                }
                // Vorgarten
                if (result.result[0][i].valve_name === 'Vorgarten') {
                    setState('valve_last_activity_vorgarten', result.result[0][i].activity);
                    setState('valve_last_activity_ts_vorgarten', result.result[0][i].ts);
                }
            }
        };
    })
}

queryInfluxDBGardena()

schedule("*/5 * * * *", queryInfluxDBGardena);


// ============================================================================
// IRRIGATION PANEL (SVG state for a vis HTML widget) — appended 2026-06-13
// ============================================================================

// Renders the irrigation overview as an SVG state for a vis HTML widget.
// Reads live garden_* data from InfluxDB and draws one row per watering zone
// (soil moisture where a sensor exists, last watering, health). Uses the
// dashboard's classic palette. Rebuilt every 5 minutes.

var STATE = 'garden_panel';
var INFLUX = 'influxdb.0';
var ZONES = [
    'Vorgarten', 'Garten', 'Hochbeet',
    'Randbeet', 'Traufkiesstreifen', 'Dachterrasse',
];
// soil sensors that are not also a valve zone get appended as extra rows
var EXTRA_SENSORS = ['Gemüsebeet'];

var GREEN = '#b5fb5b', AMBER = '#F1BE3D', RED = '#A00629';
var BG = 'var(--color-panel)', FG = '#e8e8e8', MUTE = '#9a9a9a';

createState(STATE, '', { desc: 'Bewässerung Panel (SVG)', type: 'string', role: 'html' });

function query(sql) {
    return new Promise(function (resolve) {
        sendTo(INFLUX, 'query', sql, function (res) {
            resolve(res && !res.error && res.result && res.result[0] ? res.result[0] : []);
        });
    });
}

// latest row per group key from a GROUP BY result (rows are time-desc per group)
function latestByKey(rows, key) {
    var out = {};
    for (var i = 0; i < rows.length; i++) {
        var k = rows[i][key];
        if (k !== undefined && out[k] === undefined) out[k] = rows[i];
    }
    return out;
}

function hhmm(ts) {
    var d = new Date(ts).toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return d;
}

function moistColor(p) {
    if (p === null) return MUTE;
    if (p < 30) return RED;
    if (p < 50) return AMBER;
    return GREEN;
}

function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function build() {
    var DB = 'home_monitoring.autogen.';
    var wateredRows = await query(
        "SELECT last(state) FROM " + DB + "garden_valves_activity"
        + " WHERE activity != 'CLOSED' AND state = 1 GROUP BY valve_name");
    var moistRows = await query(
        'SELECT last(humidity) FROM ' + DB + 'garden_humidity_percentage GROUP BY "name"');
    var tempRows = await query(
        'SELECT last(temperature) FROM ' + DB + 'garden_temperature_celsius GROUP BY "name"');
    var batRows = await query(
        'SELECT last(battery_level) FROM ' + DB + 'garden_system_battery_percentage GROUP BY "name"');
    var rainRows = await query('SELECT last(*) FROM ' + DB + 'weather_rain_mm');

    var watered = latestByKey(wateredRows, 'valve_name');
    var moist = latestByKey(moistRows, 'name');
    var temp = latestByKey(tempRows, 'name');
    var bat = latestByKey(batRows, 'name');

    // rain only if fresh (the gauge battery can die — then show unavailable)
    var rainTxt = 'Regen heute: – (Sensor leer)';
    if (rainRows.length) {
        var rt = new Date(rainRows[0].ts).getTime();
        if (Date.now() - rt < 24 * 3600 * 1000) {
            var mm = rainRows[0].last || rainRows[0].last_rain || 0;
            rainTxt = 'Regen heute: ' + Number(mm).toFixed(1).replace('.', ',') + ' mm';
        }
    }

    var W = 620, H = 320, rh = 34, y0 = 58;
    var p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '">'];
    p.push('<rect width="' + W + '" height="' + H + '" rx="12" fill="' + BG + '"/>');
    p.push('<text x="16" y="30" fill="' + FG + '" font-size="18" font-weight="bold">Bewässerung</text>');
    p.push('<text x="' + (W - 16) + '" y="30" fill="' + MUTE + '" font-size="13" text-anchor="end">☔ ' + esc(rainTxt) + '</text>');
    p.push('<text x="16" y="' + y0 + '" fill="' + MUTE + '" font-size="11">Zone</text>');
    p.push('<text x="250" y="' + y0 + '" fill="' + MUTE + '" font-size="11">Feuchte</text>');
    p.push('<text x="430" y="' + y0 + '" fill="' + MUTE + '" font-size="11">zuletzt</text>');
    p.push('<text x="510" y="' + y0 + '" fill="' + MUTE + '" font-size="11">Status</text>');
    p.push('<line x1="16" y1="' + (y0 + 6) + '" x2="' + (W - 16) + '" y2="' + (y0 + 6) + '" stroke="#333"/>');

    var allRows = ZONES.map(function (z) { return { zone: z, sensorName: z }; });
    EXTRA_SENSORS.forEach(function (s) {
        allRows.push({ zone: s + '  ·Sensor', sensorName: s });
    });

    allRows.forEach(function (row, i) {
        var y = y0 + 28 + i * rh;
        var m = moist[row.sensorName] ? moist[row.sensorName].last : null;
        var t = temp[row.sensorName] ? temp[row.sensorName].last : null;
        var b = bat[row.sensorName] ? bat[row.sensorName].last : null;
        var w = watered[row.zone];

        p.push('<text x="16" y="' + y + '" fill="' + FG + '" font-size="14">' + esc(row.zone) + '</text>');
        if (m !== null && m !== undefined) {
            var col = moistColor(m), filled = Math.round(m / 100 * 4);
            for (var seg = 0; seg < 4; seg++) {
                p.push('<rect x="' + (250 + seg * 16) + '" y="' + (y - 12)
                    + '" width="13" height="13" rx="2" fill="' + (seg < filled ? col : '#3a3a3a') + '"/>');
            }
            var lbl = Math.round(m) + '%' + (t !== null && t !== undefined ? '  ' + Math.round(t) + '°' : '');
            p.push('<text x="320" y="' + y + '" fill="' + FG + '" font-size="13">' + lbl + '</text>');
        } else {
            p.push('<text x="250" y="' + y + '" fill="' + MUTE + '" font-size="13">–</text>');
        }
        var last = w ? hhmm(w.ts) + ' ✓' : '–';
        p.push('<text x="430" y="' + y + '" fill="' + (w ? FG : MUTE) + '" font-size="13">' + last + '</text>');
        if (b !== null && b !== undefined && b <= 10) {
            p.push('<text x="510" y="' + y + '" fill="' + RED + '" font-size="13">⚠ Batterie ' + Math.round(b) + '%</text>');
        } else {
            p.push('<text x="510" y="' + y + '" fill="' + GREEN + '" font-size="13">ok</text>');
        }
    });

    p.push('</svg>');
    setState(STATE, p.join(''), true);
}

setTimeout(build, 2000);
schedule('*/5 * * * *', build);
