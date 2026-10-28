// ioBroker JavaScript: logs power outages. The Pi has no UPS and no clock battery, so an outage shows up
// as a boot after a stop this script did not see coming: the outage began at the last heartbeat before
// that boot and ended when the Pi booted again (it powers up the moment the power returns). Accurate to
// the one-minute heartbeat. Outages that leave the Pi's circuit powered go unnoticed.
//
// Each outage lands in Influx (electricity_outage_seconds, at its start) and the latest one in
// javascript.0.power.last_outage for the Diagnose tab.

var os = require('os');
var http = require('http');

var HEARTBEAT = 'javascript.0.power.heartbeat';
var CLEAN_STOP = 'javascript.0.power.clean_stop';
var LAST_OUTAGE = 'javascript.0.power.last_outage';
// the Pi boots at 1970 and only NTP sets the clock; nothing before this date is a real reading
var CLOCK_SET_AFTER = Date.UTC(2026, 0, 1);
var CLOCK_RETRY_MS = 30 * 1000;

function stateVal(id) {
    var s = getState(id);
    return s ? s.val : null;
}

function outageBefore(bootMs, lastHeartbeat, cleanStop) {
    if (!lastHeartbeat || cleanStop || bootMs <= lastHeartbeat) return null;
    return { start: lastHeartbeat, end: bootMs };
}

function logToInflux(outage) {
    var line = 'electricity_outage_seconds duration=' + Math.round((outage.end - outage.start) / 1000) + ' ' + outage.start;
    var req = http.request({ host: 'localhost', port: 8086, method: 'POST', path: '/write?db=home_monitoring&precision=ms' }, function (res) {
        if (res.statusCode !== 204) console.warn('[power_outage] Influx write failed: HTTP ' + res.statusCode);
        res.resume();
    });
    req.on('error', function (e) { console.warn('[power_outage] Influx write failed: ' + e.message); });
    req.end(line);
}

function beat() { setState(HEARTBEAT, Date.now(), true); }

function checkLastBoot() {
    var lastHeartbeat = stateVal(HEARTBEAT);
    if (Date.now() < Math.max(CLOCK_SET_AFTER, lastHeartbeat || 0)) {
        setTimeout(checkLastBoot, CLOCK_RETRY_MS);
        return;
    }
    var bootMs = Date.now() - os.uptime() * 1000;
    var outage = outageBefore(bootMs, lastHeartbeat, stateVal(CLEAN_STOP) === true);
    if (outage) {
        console.log('[power_outage] power was out ' + Math.round((outage.end - outage.start) / 60000) + ' min');
        setState(LAST_OUTAGE, JSON.stringify(outage), true);
        logToInflux(outage);
    }
    setState(CLEAN_STOP, false, true);
    beat();
    schedule('* * * * *', beat);
}

onStop(function (callback) {
    setState(CLEAN_STOP, true, true);
    callback();
}, 2000);

createState(HEARTBEAT, 0, { type: 'number', role: 'value.time', read: true, write: false, desc: 'Stromausfall-Erkennung: letzte Lebensmeldung (ms)' });
createState(CLEAN_STOP, false, { type: 'boolean', role: 'indicator', read: true, write: false, desc: 'Stromausfall-Erkennung: Skript wurde sauber beendet' });
createState(LAST_OUTAGE, '', { type: 'string', role: 'json', read: true, write: false, desc: 'Letzter Stromausfall {start, end} in ms' }, checkLastBoot);
