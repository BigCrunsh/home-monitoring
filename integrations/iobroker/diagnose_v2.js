// ioBroker JavaScript: Diagnose tab ("Neu" design system) — answers one question:
// "Is every data source live, and is the Pi healthy?" Calm when all-green, lights up on staleness.
// Same .mv2 token block + components as main_v2.js / klima_v2.js.
//
//   diag_summary (4,4)   1170x72  — overall verdict + Stand
//   diag_left    (4,84)   392x596 — DATENQUELLEN: per-source age + freshness verdict (primary)
//   diag_mid     (408,84) 377x596 — SYSTEM · Pi: CPU / Last / RAM / Disk / Uptime + BACKUP card
//   diag_right   (797,84) 377x596 — ADAPTER: alive/connected dots

var CSS_BASE = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');
.mv2{
  --bg:#0d0e12; --surface:#15161c; --inset:#1c1f28; --border:#262a33;
  --text:#CCCCCC; --muted:#8A8A8A; --mute:#7F8A99;
  --green:#b5fb5b; --amber:#F1BE3D; --blue:#5080AC; --red:#A00629;
  --green-16:rgba(181,251,91,.16); --amber-16:rgba(241,190,61,.16); --blue-16:rgba(80,128,172,.16); --red-16:rgba(160,6,41,.22); --muted-16:rgba(138,138,138,.16);
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px;
  --r2:14px; --r3:10px;
  --t-hero:48px; --t-metric:27px; --t-sub:18px; --t-label:14px; --t-cap:12px;
  box-sizing:border-box; background:var(--bg);
  font-family:'Figtree',system-ui,sans-serif; color:var(--text);
  -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums;
}
.mv2.sumw{width:1170px; height:72px}
.mv2.dlw{width:392px; height:596px}
.mv2.dmw{width:377px; height:596px}
.mv2.drw{width:377px; height:596px}
.mv2 *{margin:0; padding:0; box-sizing:border-box}
.mv2 .u{font-size:12px; color:var(--muted); font-weight:500; margin-left:.1em}
.mv2 .card{background:var(--surface); border:1px solid var(--border); border-radius:var(--r2); padding:var(--s3) var(--s4); height:100%; overflow:hidden; display:flex; flex-direction:column}
.mv2 .card-h{font-size:var(--t-label); font-weight:700; letter-spacing:.06em; color:var(--muted); text-transform:uppercase; padding-bottom:var(--s2); margin-bottom:var(--s2); border-bottom:1px solid var(--border); flex:none}

/* SUMMARY band */
.mv2 .sum{display:flex; align-items:center; gap:var(--s4); height:100%}
.mv2 .sum .dot{width:16px; height:16px; border-radius:50%; flex:none}
.mv2 .sum .txt{font-size:26px; font-weight:600}
.mv2 .sum .stand{margin-left:auto; font-size:var(--t-cap); color:var(--mute)}

/* DATENQUELLEN + ADAPTER rows */
.mv2 .rows{flex:1; display:flex; flex-direction:column; gap:6px}
.mv2 .drow{display:grid; grid-template-columns:auto 1fr auto; gap:var(--s3); align-items:center; background:var(--bg); border-radius:var(--r3); padding:9px var(--s3)}
.mv2 .drow .dot{width:10px; height:10px; border-radius:50%; flex:none}
.mv2 .drow .nm{font-size:var(--t-sub); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .drow .ag{font-size:var(--t-label); font-weight:600; white-space:nowrap}
.mv2 .drow .sub{font-size:var(--t-cap); color:var(--mute)}

/* SYSTEM bars */
.mv2 .sys{flex:1; display:flex; flex-direction:column; justify-content:space-evenly}
.mv2 .srow .top{display:flex; align-items:baseline; justify-content:space-between; margin-bottom:5px}
.mv2 .srow .l{font-size:var(--t-label); color:var(--muted)}
.mv2 .srow .v{font-size:var(--t-metric); font-weight:600}
.mv2 .track{height:7px; border-radius:4px; background:var(--inset); overflow:hidden}
.mv2 .fill{height:7px; border-radius:4px; min-width:3px; display:block}
.mv2 .srow.plain{display:flex; align-items:baseline; justify-content:space-between}

/* mid column stacks two cards (System · Pi fills, Backup keeps its natural height) */
.mv2 .mcol{height:100%; display:flex; flex-direction:column; gap:8px}
.mv2 .mcol .card{height:auto}
.mv2 .mcol .card.grow{flex:1}
`;

var GREEN = '#b5fb5b', AMBER = '#F1BE3D', BLUE = '#5080AC', RED = '#A00629', LBL = '#8A8A8A', TEXT = '#CCCCCC';
var NB = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
var NB2 = 'netatmo.0.6a48fde5178fa8d8cd09bd27.70-ee-50-c2-86-aa';   // Studio base station
var GVALVE = 'smartgarden.0.LOCATION_28b39c94-2D8503-2D4ee7-2D8a95-2D7c5a0f50a8d7.DEVICE_b193e1f6-2Db1bc-2D4488-2D9f9d-2Deabf9771e46c.SERVICE_VALVE_b193e1f6-2Db1bc-2D4488-2D9f9d-2Deabf9771e46c';
var HOST = 'system.host.raspberrypi';

// [label, state id, fresh<=sec (green), amber<=sec] — age from the state's last-write ts
var SOURCES = [
    ['SolarEdge', 'javascript.0.solaredge_modbus_production', 60, 300],
    ['Shelly 3EM', 'javascript.0.mqtt_shelly.total_act_power', 60, 300],
    ['SAM Heizung', 'javascript.0.sam_digital.heating_flow_temperature', 300, 900],
    ['Netatmo', NB + '.Temperature.Temperature', 900, 1800],
    ['Netatmo Studio', NB2 + '.Temperature.Temperature', 900, 1800],
    ['Tibber Preis', 'javascript.0.tibber_states.energy_price_euro', 4200, 10800],
    ['Tankstelle', 'tankerkoenig.0.stations.1.diesel.feed', 3600, 21600],
    ['Gardena', GVALVE + '-3A1.activity_value', 21600, 86400],
    ['Kalender', 'ical.0.data.table', 86400, 172800]
];
// [label, adapter instance]
var ADAPTERS = [
    ['Netatmo', 'netatmo.0'], ['InfluxDB', 'influxdb.0'], ['JavaScript', 'javascript.0'],
    ['MQTT · Shelly', 'mqtt.0'], ['Gardena', 'smartgarden.0'], ['daswetter', 'daswetter.0'],
    ['Hue', 'hue.0'], ['Homematic', 'hm-rpc.1'], ['vis-2', 'vis-2.0']
];

function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function sBool(id) { var s = getState(id); return s ? !!s.val : null; }
// adapter health that understands schedule-mode adapters (alive=false between runs is normal)
function adapterHealth(inst) {
    var obj = getObject('system.adapter.' + inst);
    var c = (obj && obj.common) || {};
    var alive = sBool('system.adapter.' + inst + '.alive');
    var conn = sBool('system.adapter.' + inst + '.connected');
    if (c.enabled === false) return { col: RED, st: 'deaktiviert' };
    if (c.mode === 'schedule') return alive ? { col: GREEN, st: 'läuft' } : { col: GREEN, st: 'geplant' };
    // daemon
    if (alive === false) return { col: RED, st: 'offline' };
    if (conn === false) return { col: AMBER, st: 'verbindet…' };
    return { col: GREEN, st: 'ok' };
}
function ageOf(id) { var s = getState(id); if (!s || !s.ts) return null; return Math.max(0, Math.round((Date.now() - s.ts) / 1000)); }
function comma(v, d) { return (typeof v === 'number') ? v.toFixed(d == null ? 1 : d).replace('.', ',') : '–'; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtAge(sec) {
    if (sec == null) return '–';
    if (sec < 60) return sec + ' s';
    if (sec < 3600) return Math.round(sec / 60) + ' min';
    if (sec < 86400) return Math.round(sec / 3600) + ' h';
    return Math.round(sec / 86400) + ' d';
}
function freshCol(sec, fresh, amber) { return sec == null ? RED : (sec <= fresh ? GREEN : (sec <= amber ? AMBER : RED)); }
function dot(col) { return '<span class="dot" style="background:' + col + '"></span>'; }
function bar(frac, col) {
    var p = (Math.max(0, Math.min(1, frac || 0)) * 100).toFixed(1);
    return '<div class="track"><span class="fill" style="width:' + p + '%;background:' + col + '"></span></div>';
}
function fo(cls, w, h, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
        + '<foreignObject width="' + w + '" height="' + h + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml" class="mv2 ' + cls + '">'
        + '<style>' + CSS_BASE + '</style>' + body + '</div></foreignObject></svg>';
}

// ===== SUMMARY =====
function buildSummary() {
    var red = 0, amber = 0;
    SOURCES.forEach(function (s) {
        var c = freshCol(ageOf(s[1]), s[2], s[3]);
        if (c === RED) red++; else if (c === AMBER) amber++;
    });
    ADAPTERS.forEach(function (a) {
        var hc = adapterHealth(a[1]).col;
        if (hc === RED) red++; else if (hc === AMBER) amber++;
    });
    var col, txt;
    if (red > 0) { col = RED; txt = red + (red === 1 ? ' Quelle offline' : ' Quellen offline'); }
    else if (amber > 0) { col = AMBER; txt = amber + (amber === 1 ? ' Quelle veraltet' : ' Quellen veraltet'); }
    else { col = GREEN; txt = 'Alle Quellen aktuell'; }
    var now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
    return '<div class="card"><div class="sum">' + dot(col)
        + '<span class="txt" style="color:' + col + '">' + txt + '</span>'
        + '<span class="stand">Stand ' + now + ' Uhr</span></div></div>';
}

// ===== DATENQUELLEN =====
function buildSources() {
    var h = '<div class="card"><div class="card-h">Datenquellen</div><div class="rows">';
    SOURCES.forEach(function (s) {
        var age = ageOf(s[1]), col = freshCol(age, s[2], s[3]);
        h += '<div class="drow">' + dot(col)
            + '<span class="nm">' + esc(s[0]) + '</span>'
            + '<span class="ag" style="color:' + col + '">' + fmtAge(age) + '</span></div>';
    });
    return h + '</div></div>';
}

// ===== SYSTEM · Pi =====
function buildSystem() {
    var cpu = sNum(HOST + '.cpu'), load = sNum(HOST + '.load');
    var freem = sNum(HOST + '.freemem'), disk = sNum(HOST + '.diskFree'), up = sNum(HOST + '.uptime');
    var cpuCol = cpu == null ? LBL : (cpu < 50 ? GREEN : cpu < 80 ? AMBER : RED);
    var loadCol = load == null ? LBL : (load < 2 ? GREEN : load < 4 ? AMBER : RED);
    // freemem/diskFree are MB; low = bad
    var freeGB = freem != null ? freem / 1024 : null, diskGB = disk != null ? disk / 1024 : null;
    var memCol = freeGB == null ? LBL : (freeGB > 0.4 ? GREEN : freeGB > 0.15 ? AMBER : RED);
    var diskCol = diskGB == null ? LBL : (diskGB > 3 ? GREEN : diskGB > 1 ? AMBER : RED);
    var upTxt = up == null ? '–' : (up < 86400 ? Math.round(up / 3600) + ' h' : Math.round(up / 86400) + ' d');

    var h = '<div class="card grow"><div class="card-h">System · Pi</div><div class="sys">';
    h += '<div class="srow"><div class="top"><span class="l">CPU</span><span class="v" style="color:' + cpuCol + '">' + (cpu != null ? Math.round(cpu) : '–') + '<span class="u">%</span></span></div>' + bar((cpu || 0) / 100, cpuCol) + '</div>';
    h += '<div class="srow plain"><span class="l">Last (1 min)</span><span class="v" style="color:' + loadCol + '">' + comma(load, 2) + '</span></div>';
    h += '<div class="srow plain"><span class="l">RAM frei</span><span class="v" style="color:' + memCol + '">' + (freeGB != null ? comma(freeGB, 1) : '–') + '<span class="u">GB</span></span></div>';
    h += '<div class="srow plain"><span class="l">Disk frei</span><span class="v" style="color:' + diskCol + '">' + (diskGB != null ? comma(diskGB, 1) : '–') + '<span class="u">GB</span></span></div>';
    h += '<div class="srow plain"><span class="l">Uptime</span><span class="v">' + upTxt + '</span></div>';
    return h + '</div></div>';
}

// ===== BACKUP =====
// One row per backup in the chain: the backitup app backup (its own states), and the two
// filesystem markers bridged into states by deps/general/bin/export_backup_states.sh.
// Thresholds follow conf/healthcheck.json (SLA 1560 min): green within 26 h, amber to 48 h.
var BK_FRESH = 26 * 3600, BK_AMBER = 48 * 3600;
function epochAge(id) {
    var s = getState(id);
    var ts = s && s.val != null ? Number(s.val) : 0;    // exporter may write it as a string
    return ts > 0 ? Math.max(0, Math.round(Date.now() / 1000 - ts)) : null;
}
function backupRows() {
    var rows = [];
    var last = null;
    try { last = JSON.parse(getState('backitup.0.history.json').val)[0]; } catch (e) { /* no history yet */ }
    var age = last && last.timestamp ? Math.max(0, Math.round((Date.now() - last.timestamp) / 1000)) : null;
    var failed = !!(last && last.error && last.error !== 'none');
    rows.push({ nm: 'ioBroker', txt: failed ? 'Fehler' : fmtAge(age), col: failed ? RED : freshCol(age, BK_FRESH, BK_AMBER) });
    [['NAS · Synology', 'javascript.0.backup_nas_ts'], ['InfluxDB-Dump', 'javascript.0.backup_influx_ts']].forEach(function (b) {
        var a = epochAge(b[1]);
        rows.push({ nm: b[0], txt: a == null ? 'nie' : fmtAge(a), col: freshCol(a, BK_FRESH, BK_AMBER) });
    });
    return rows;
}
function buildBackup() {
    var h = '<div class="card"><div class="card-h">Backup</div><div class="rows">';
    backupRows().forEach(function (r) {
        h += '<div class="drow">' + dot(r.col)
            + '<span class="nm">' + esc(r.nm) + '</span>'
            + '<span class="ag" style="color:' + r.col + '">' + r.txt + '</span></div>';
    });
    return h + '</div></div>';
}

// ===== ADAPTER =====
function buildAdapters() {
    var h = '<div class="card"><div class="card-h">Adapter</div><div class="rows">';
    ADAPTERS.forEach(function (a) {
        var hh = adapterHealth(a[1]);
        h += '<div class="drow">' + dot(hh.col)
            + '<span class="nm">' + esc(a[0]) + '</span>'
            + '<span class="ag sub" style="color:' + (hh.col === GREEN ? 'var(--mute)' : hh.col) + '">' + hh.st + '</span></div>';
    });
    return h + '</div></div>';
}

function publish() {
    setState('diag_summary', fo('sumw', 1170, 72, buildSummary()), true);
    setState('diag_left', fo('dlw', 392, 596, buildSources()), true);
    setState('diag_mid', fo('dmw', 377, 596, '<div class="mcol">' + buildSystem() + buildBackup() + '</div>'), true);
    setState('diag_right', fo('drw', 377, 596, buildAdapters()), true);
}

['diag_summary', 'diag_left', 'diag_mid', 'diag_right'].forEach(function (id) {
    createState('javascript.0.' + id, '', { type: 'string', role: 'html', desc: 'Diagnose tab ' + id });
});
// filesystem backup markers (epoch seconds), written by deps/general/bin/export_backup_states.sh
createState('javascript.0.backup_nas_ts', 0, { type: 'number', role: 'value.time', desc: 'NAS-Pull Erfolgs-Marker' });
createState('javascript.0.backup_influx_ts', 0, { type: 'number', role: 'value.time', desc: 'Influx-Dump Marker' });

// freshness is time-based — refresh every minute (also catches adapter/host changes)
setTimeout(publish, 2000);
schedule('* * * * *', publish);
console.log('[Diagnose v2] initialized');
