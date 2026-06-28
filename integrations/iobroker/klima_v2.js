// ioBroker JavaScript: Klima tab ("Neu" design system) — renders the Weather/Klima
// view as HTML/CSS foreignObject states, the SAME .mv2 component library as main_v2.js.
//
// Layout (blueprint geometry: hero + 3 columns + nav):
//   klima_hero  (4,4)   1170x178  — outdoor glance: temp now→heute min/max · weather · rain · pressure
//   klima_left  (4,189)  392x487  — 6-Tage Vorhersage (daswetter)
//   klima_mid   (408,189)377x534  — 4 rooms, EXPANDED (today min/max + trend) vs the overview's compact card
//   klima_right (797,189)377x534  — Garten: Gardena valves + soil sensors
//
// Colour rule B′ (calm by default): values stay near-white; an accent (icon-disc / dot / badge)
// appears ONLY when a metric needs attention (comfort blue/amber/red, CO₂ ≥1000, soil dry, valve
// watering). Green/good = no accent. The board lights up only to ask for action.

// ===== shared .mv2 design system (token block identical to main_v2.js) =====
var CSS_BASE = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');
.mv2{
  --bg:#0d0e12; --surface:#15161c; --inset:#1c1f28; --border:#262a33;
  --text:#CCCCCC; --muted:#8A8A8A; --mute:#7F8A99;
  --green:#b5fb5b; --amber:#F1BE3D; --blue:#5080AC; --red:#A00629;
  --green-16:rgba(181,251,91,.16); --amber-16:rgba(241,190,61,.16); --blue-16:rgba(80,128,172,.16); --red-16:rgba(160,6,41,.22); --muted-16:rgba(138,138,138,.16);
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px;
  --r2:14px; --r3:10px;
  --t-hero:98px; --t-clock:126px; --t-metric:27px; --t-sub:18px; --t-date:23px; --t-label:14px; --t-cap:12px;
  --sym-wx:108px; --inset-x:22px;
  box-sizing:border-box; background:var(--bg);
  font-family:'Figtree',system-ui,sans-serif; color:var(--text);
  -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums;
}
.mv2.hw{width:1170px; height:178px; display:grid; grid-template-rows:1fr}
.mv2.lw{width:392px;  height:487px; display:grid; grid-template-rows:1fr}
.mv2.mw{width:377px;  height:534px; display:grid; grid-template-rows:1fr}
.mv2.rw{width:377px;  height:534px; display:grid; grid-template-rows:1fr}
.mv2 *{margin:0; padding:0; box-sizing:border-box}
.mv2 .num{font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1}
.mv2 .u{font-size:max(12px,.42em); color:var(--muted); font-weight:500; letter-spacing:0; margin-left:.06em}
.mv2 .card{background:var(--surface); border:1px solid var(--border); border-radius:var(--r2); padding:var(--s3); overflow:hidden; display:flex; flex-direction:column}
.mv2 .card-body{flex:1; min-height:0; display:flex; flex-direction:column; gap:var(--s2)}
.mv2 .card-h{font-size:var(--t-label); font-weight:700; letter-spacing:.06em; color:var(--muted); text-transform:uppercase; padding-bottom:var(--s2); margin-bottom:var(--s1); border-bottom:1px solid var(--border); flex:none}

/* HERO — outdoor glance, two-tier like main_v2 (glyph top / metadata baseline) */
.mv2 .hero{display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:var(--s3) var(--inset-x); overflow:hidden}
.mv2 .h-left{justify-self:start; display:flex; flex-direction:column; gap:var(--s2)}
.mv2 .h-mid{justify-self:center; display:flex; flex-direction:column; align-items:center; gap:var(--s1)}
.mv2 .h-right{justify-self:end; display:flex; flex-direction:column; align-items:flex-end; gap:var(--s2)}
.mv2 .otemp{font-size:var(--t-hero); font-weight:600; line-height:.82; letter-spacing:-.03em}
.mv2 .h-mm{display:flex; gap:var(--s4); font-size:var(--t-sub); color:var(--muted)}
.mv2 .h-mm b{color:var(--text); font-weight:600}
.mv2 .h-wx img{width:var(--sym-wx); height:var(--sym-wx); object-fit:contain}
.mv2 .h-cond{font-size:var(--t-sub); color:var(--muted); font-weight:500}
.mv2 .h-line{display:flex; align-items:center; gap:var(--s2); font-size:var(--t-label); color:var(--muted)}
.mv2 .h-line b{color:var(--text); font-weight:600; font-size:var(--t-sub)}

/* ROOMS (expanded) — same Room component as main_v2 + a min/max/trend strip */
.mv2 .rooms{flex:1; display:grid; grid-template-rows:repeat(4,1fr); gap:var(--s2)}
.mv2 .room{display:grid; grid-template-columns:auto 1fr auto; grid-template-rows:auto auto auto auto; column-gap:var(--s3); row-gap:2px; align-items:center; background:var(--bg); border-radius:var(--r3); padding:var(--s2) var(--s4)}
.mv2 .thermo{grid-column:1; grid-row:1 / 3; align-self:start; margin-top:1px; width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center}
.mv2 .room .name{grid-column:2 / 4; grid-row:1; align-self:start; font-size:24px; font-weight:600; line-height:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .op{grid-column:2; grid-row:2; margin-top:-4px; display:flex; align-items:center; gap:var(--s2); font-size:var(--t-cap); font-weight:500; color:var(--muted); white-space:nowrap}
.mv2 .room .op .batt{display:flex; align-items:center; gap:3px}
.mv2 .room .env{grid-column:2; display:flex; align-items:center; gap:var(--s1); font-size:var(--t-label); white-space:nowrap}
.mv2 .room .env.hum{grid-row:3} .mv2 .room .env.co2{grid-row:4}
.mv2 .room .env .un{color:var(--muted); font-weight:500}
.mv2 .room .env .dot{display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; flex:none}
.mv2 .room .temp{grid-column:3; grid-row:2 / 4; align-self:center; justify-self:end; font-size:48px; font-weight:600; line-height:.9; white-space:nowrap}
.mv2 .room .mmx{grid-column:3; grid-row:4; justify-self:end; display:flex; align-items:center; gap:6px; font-size:var(--t-cap); color:var(--muted); white-space:nowrap}
.mv2 .room .mmx b{color:var(--text); font-weight:600}

/* 6-TAGE VORHERSAGE */
.mv2 .fc{flex:1; display:flex; flex-direction:column}
.mv2 .fcrow{display:grid; grid-template-columns:34px 30px 1fr auto; gap:var(--s2); align-items:center; border-top:1px solid var(--border); padding:var(--s2) 2px}
.mv2 .fcrow:first-child{border-top:none}
.mv2 .fcrow.we .dow{color:var(--blue)}
.mv2 .fcrow .dow{font-size:var(--t-sub); font-weight:600}
.mv2 .fcrow img{width:26px; height:26px; object-fit:contain}
.mv2 .fcrow .cond{font-size:var(--t-cap); color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .fcrow .mm{font-size:var(--t-label); white-space:nowrap; text-align:right}
.mv2 .fcrow .mm .mx{color:var(--text); font-weight:600}
.mv2 .fcrow .mm .mn{color:var(--muted); margin-left:6px}

/* GARTEN — valves + soil, bubble rows */
.mv2 .gsec{font-size:var(--t-cap); font-weight:700; letter-spacing:.06em; color:var(--muted); text-transform:uppercase; margin:var(--s1) 0 2px}
.mv2 .vrow{display:grid; grid-template-columns:auto 1fr auto; gap:var(--s2); align-items:center; background:var(--bg); border-radius:var(--r3); padding:7px var(--s3); margin-bottom:6px}
.mv2 .vrow .vn{font-size:var(--t-label); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .vrow .vs{font-size:var(--t-cap); color:var(--muted); white-space:nowrap}
.mv2 .vrow .badge{font-size:var(--t-cap); font-weight:700; padding:2px 8px; border-radius:999px; white-space:nowrap}
.mv2 .srow{display:grid; grid-template-columns:1fr auto auto; gap:var(--s3); align-items:center; background:var(--bg); border-radius:var(--r3); padding:7px var(--s3); margin-bottom:6px}
.mv2 .srow .sn{font-size:var(--t-label); font-weight:600}
.mv2 .srow .sv{font-size:var(--t-sub); font-weight:600}
.mv2 .srow .sv .u{font-size:11px}
.mv2 .gstale{font-size:var(--t-cap); color:var(--muted); margin-top:auto; padding-top:var(--s2)}
`;

// ===== palette constants =====
var GREEN = '#b5fb5b', AMBER = '#F1BE3D', BLUE = '#5080AC', RED = '#A00629', LBL = '#8A8A8A', TEXT = '#CCCCCC';

// ===== state refs =====
var NB = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
var OUTDOOR = NB + '.02-00-00-32-ae-a4';
var RAINMOD = NB + '.05-00-00-05-d4-18';
var FC = 'daswetter.0.NextDays.Location_1.Day_';   // + N + '.<field>'
var ROOMS = [
    ['Wohnzimmer', NB],
    ['Carlottas Zimmer', NB + '.03-00-00-0e-16-36'],
    ['Claras Zimmer', NB + '.03-00-00-0f-01-6e'],
    ['Cleas Zimmer', NB + '.03-00-00-10-e5-42']
];
// Gardena
var GLOC = 'smartgarden.0.LOCATION_28b39c94-2D8503-2D4ee7-2D8a95-2D7c5a0f50a8d7.';
var GVALVE = GLOC + 'DEVICE_b193e1f6-2Db1bc-2D4488-2D9f9d-2Deabf9771e46c.SERVICE_VALVE_b193e1f6-2Db1bc-2D4488-2D9f9d-2Deabf9771e46c';
var VALVES = ['-3A1', '-3A2', '-3A3', '-3A4', '-3A5', '-3A6'];
var SOIL = [
    ['Gemüsebeet', GLOC + 'DEVICE_747c45b4-2Da2d0-2D4eb5-2D84f3-2D38f37e85bdc5.SERVICE_SENSOR_747c45b4-2Da2d0-2D4eb5-2D84f3-2D38f37e85bdc5.'],
    ['Hochbeet', GLOC + 'DEVICE_c080e523-2De083-2D49d5-2D98d8-2D004a9a2ed9b1.SERVICE_SENSOR_c080e523-2De083-2D49d5-2D98d8-2D004a9a2ed9b1.'],
    ['Dachterrasse', GLOC + 'DEVICE_daa34269-2D042f-2D4657-2D9a59-2D1e9ca9d1e9c2.SERVICE_SENSOR_daa34269-2D042f-2D4657-2D9a59-2D1e9ca9d1e9c2.']
];
var DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// ===== helpers =====
function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function sStr(id) { var s = getState(id); return (s && s.val != null) ? String(s.val) : null; }
function comma(v, d) { return (typeof v === 'number') ? v.toFixed(d == null ? 1 : d).replace('.', ',') : '–'; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function clip(s, n) { s = String(s == null ? '' : s); return esc(s.length > n ? s.slice(0, n - 1) + '…' : s); }
function ageMs(v) { if (!v) return null; var t = new Date(v).getTime(); return isNaN(t) ? null : Date.now() - t; }
function agoStr(v) {
    var ms = ageMs(v); if (ms == null) return null;
    var m = Math.round(ms / 60000); if (m < 1) return 'jetzt'; if (m < 60) return m + ' min';
    var h = Math.round(m / 60); if (h < 24) return h + ' h'; return Math.round(h / 24) + ' d';
}
// comfort bands (owner's): ≤3 grey · <12 blue · <20 green · <27 amber · ≥27 red
function comfortCol(t) { return t == null ? LBL : (t <= 3 ? LBL : (t < 12 ? BLUE : (t < 20 ? GREEN : (t < 27 ? AMBER : RED)))); }
function comfortTint(t) { return t == null ? 'var(--muted-16)' : (t <= 3 ? 'var(--muted-16)' : (t < 12 ? 'var(--blue-16)' : (t < 20 ? 'var(--green-16)' : (t < 27 ? 'var(--amber-16)' : 'var(--red-16)')))); }
function co2Col(c) { return c == null ? LBL : (c < 1000 ? GREEN : (c < 1400 ? AMBER : RED)); }
function humCol(h) { return h == null ? LBL : (h < 40 ? AMBER : (h <= 60 ? GREEN : BLUE)); }
// B′: a verdict colour "needs attention" when it isn't green/neutral
function attention(col) { return col !== GREEN && col !== LBL; }

function icoThermo(col) { return '<svg width="16" height="22" viewBox="0 0 16 22"><rect x="6" y="1" width="4" height="13" rx="2" fill="' + col + '"/><circle cx="8" cy="17" r="4.5" fill="' + col + '"/></svg>'; }
function icoDrop(col, sz) { sz = sz || 14; return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24"><path d="M12 2.5 C12 2.5 5.5 10.5 5.5 15.2 a6.5 6.5 0 0 0 13 0 C18.5 10.5 12 2.5 12 2.5 Z" fill="' + col + '"/></svg>'; }
function icoBatt(pct, col) {
    var w = (pct == null ? 0 : clamp01(pct / 100) * 10.0).toFixed(1);
    return '<svg width="17" height="11" viewBox="0 0 17 11"><rect x="1" y="2" width="12" height="7" rx="1.4" fill="none" stroke="' + col + '" stroke-width="1.2"/>'
        + '<rect x="13.4" y="4" width="1.8" height="3" rx=".6" fill="' + col + '"/>'
        + '<rect x="2.3" y="3.2" width="' + w + '" height="4.6" rx=".7" fill="' + col + '"/></svg>';
}
function trendArrow(tr, col) {
    // netatmo trend: "up" / "down" / "stable"
    if (tr === 'up') return '<span style="color:' + col + '">↑</span>';
    if (tr === 'down') return '<span style="color:' + col + '">↓</span>';
    return '';
}
function wxImg(id, sz) {
    if (id == null) return '';
    return '<img src="/daswetter.admin/icons/tiempo-weather/galeria1/' + Math.round(id) + '.png" alt=""/>';
}
function fo(cls, w, h, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
        + '<foreignObject width="' + w + '" height="' + h + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml" class="mv2 ' + cls + '">'
        + '<style>' + CSS_BASE + '</style>' + body
        + '</div></foreignObject></svg>';
}

// ===== HERO — outdoor glance =====
function buildHero() {
    var ot = sNum(OUTDOOR + '.Temperature.Temperature');
    var otr = sStr(OUTDOOR + '.Temperature.TemperatureTrend');
    var mn = sNum(FC + '1.Minimale_Temperatur_value'), mx = sNum(FC + '1.Maximale_Temperatur_value');
    var oh = sNum(OUTDOOR + '.Humidity.Humidity');
    var pr = sNum(NB + '.Pressure.Pressure'), prt = sStr(NB + '.Pressure.PressureTrend');
    var rain = sNum(RAINMOD + '.Rain.SumRain24');
    var wsym = sNum(FC + '1.Wetter_Symbol_id');
    var cond = sStr(FC + '1.Wetterbedingungen_value');

    // Colour rule A (value-ranges): outside temp coloured by comfort band.
    var otc = comfortCol(ot);
    var h = '<div class="hero">';
    h += '<div class="h-left">'
        + '<div class="otemp num" style="color:' + otc + '">' + comma(ot, 1) + '<span class="u">°C</span></div>'
        + '<div class="h-mm"><span>heute</span><span><b>' + (mn != null ? Math.round(mn) : '–') + '°</b> min</span><span><b>' + (mx != null ? Math.round(mx) : '–') + '°</b> max</span>'
        + (trendArrow(otr, otc) ? '<span>' + trendArrow(otr, otc) + '</span>' : '') + '</div>'
        + '</div>';
    // condition: weather icon only — daswetter has no reliable short text label
    h += '<div class="h-mid"><div class="h-wx">' + wxImg(wsym) + '</div></div>';
    h += '<div class="h-right">'
        + '<div class="h-line">' + icoDrop(rain != null && rain > 0 ? BLUE : LBL, 16) + 'Regen heute <b>' + (rain != null ? comma(rain, 1) : '0,0') + '</b><span class="u">mm</span></div>'
        + '<div class="h-line">Luftfeuchte <b>' + (oh != null ? Math.round(oh) : '–') + '</b><span class="u">%</span></div>'
        + '<div class="h-line">Druck <b>' + (pr != null ? Math.round(pr) : '–') + '</b><span class="u">hPa</span> ' + trendArrow(prt, LBL) + '</div>'
        + '</div>';
    return h + '</div>';
}

// ===== ROOM (expanded) — B′ colouring =====
function buildRoom(name, module) {
    var t = sNum(module + '.Temperature.Temperature'), hh = sNum(module + '.Humidity.Humidity'),
        c = sNum(module + '.CO2.CO2'), bs = sNum(module + '.BatteryStatus');
    var tmin = sNum(module + '.Temperature.TemperatureMin'), tmax = sNum(module + '.Temperature.TemperatureMax');
    var tr = sStr(module + '.Temperature.TemperatureTrend');
    var lu = getState(module + '.LastUpdate'), luv = lu && lu.val ? lu.val : null, ago = agoStr(luv);
    var luMs = ageMs(luv), stale = luMs != null && luMs > 3600000;
    var cc = comfortCol(t);   // colour rule A: the value carries the verdict

    var h = '<div class="room">';
    h += '<div class="thermo" style="background:' + comfortTint(t) + '">' + icoThermo(cc) + '</div>';
    h += '<div class="name">' + esc(name) + '</div>';
    h += '<div class="op"><span' + (stale ? ' style="color:' + RED + '"' : '') + '>vor ' + (ago || '–') + '</span>';
    if (bs != null) { var bcol = bs < 20 ? RED : (bs < 30 ? AMBER : LBL); h += '<span class="batt" style="color:' + bcol + '">' + icoBatt(bs, bcol) + Math.round(bs) + '%</span>'; }
    h += '</div>';
    h += '<div class="env hum">' + icoDrop(BLUE, 14) + '<span style="color:' + humCol(hh) + '">' + (hh != null ? Math.round(hh) : '–') + '</span><span class="un">%</span></div>';
    h += '<div class="env co2">' + (c != null
        ? '<span style="color:' + co2Col(c) + '">' + Math.round(c) + '</span><span class="un">ppm</span>'
        : '<span class="un">–</span>') + '</div>';
    h += '<div class="temp num" style="color:' + cc + '">' + comma(t, 1) + '<span class="u">°C</span></div>';
    // expanded detail: today min/max + trend
    h += '<div class="mmx">' + trendArrow(tr, cc)
        + '<span>heute <b>' + (tmin != null ? Math.round(tmin) : '–') + '°</b>/<b>' + (tmax != null ? Math.round(tmax) : '–') + '°</b></span></div>';
    return h + '</div>';
}
function buildRooms() {
    var h = '<div class="card"><div class="card-h">Räume</div><div class="card-body"><div class="rooms">';
    ROOMS.forEach(function (r) { h += buildRoom(r[0], r[1]); });
    return h + '</div></div></div>';
}

// ===== 6-TAGE VORHERSAGE =====
function buildForecast() {
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    var h = '<div class="card"><div class="card-h">6-Tage Vorhersage</div><div class="card-body"><div class="fc">';
    for (var i = 1; i <= 6; i++) {
        var mn = sNum(FC + i + '.Minimale_Temperatur_value'), mx = sNum(FC + i + '.Maximale_Temperatur_value');
        var sym = sNum(FC + i + '.Wetter_Symbol_id');
        var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (i - 1));
        var dow = d.getDay(), weekend = (dow === 0 || dow === 6);
        // condition: icon only (no reliable short text from daswetter); max coloured by band
        h += '<div class="fcrow' + (weekend ? ' we' : '') + '">'
            + '<div class="dow">' + DAYS_SHORT[dow] + '</div>'
            + '<div>' + wxImg(sym) + '</div>'
            + '<div class="cond"></div>'
            + '<div class="mm"><span class="mx" style="color:' + comfortCol(mx) + '">' + (mx != null ? Math.round(mx) : '–') + '°</span><span class="mn">' + (mn != null ? Math.round(mn) : '–') + '°</span></div>'
            + '</div>';
    }
    return h + '</div></div></div>';
}

// ===== GARTEN — Gardena =====
function buildGarden() {
    var anyTs = null;
    var h = '<div class="card"><div class="card-h">Garten · Bewässerung</div><div class="card-body">';
    h += '<div class="gsec">Ventile</div>';
    VALVES.forEach(function (suf) {
        var base = GVALVE + suf;
        var nm = sStr(base + '.name_value') || suf;
        var act = sStr(base + '.activity_value') || '–';
        var left = sNum(base + '.duration_leftover_i');
        var ats = sStr(base + '.activity_timestamp');
        if (ats && (!anyTs || new Date(ats) > new Date(anyTs))) anyTs = ats;
        var watering = /WATERING|MANUAL|SCHEDULED/i.test(act);
        var badgeCol = watering ? GREEN : LBL;
        var badgeBg = watering ? 'var(--green-16)' : 'var(--muted-16)';
        var statusTxt = watering
            ? (left != null ? 'läuft · ' + Math.round(left / 60) + ' min' : 'läuft')
            : 'zu · ' + (agoStr(ats) ? 'vor ' + agoStr(ats) : '–');
        h += '<div class="vrow">'
            + '<div class="vn">' + clip(nm, 16) + '</div>'
            + '<div class="vs">' + statusTxt + '</div>'
            + '<div class="badge" style="color:' + badgeCol + ';background:' + badgeBg + '">' + (watering ? 'AN' : 'ZU') + '</div>'
            + '</div>';
    });
    h += '<div class="gsec">Bodensensoren</div>';
    SOIL.forEach(function (s) {
        var hum = sNum(s[1] + 'soilHumidity_value'), tmp = sNum(s[1] + 'soilTemperature_value');
        var ts = sStr(s[1] + 'soilHumidity_timestamp');
        if (ts && (!anyTs || new Date(ts) > new Date(anyTs))) anyTs = ts;
        // soil moisture: value-coloured (dry amber / ok green / wet blue)
        var humCol2 = hum == null ? LBL : (hum < 30 ? AMBER : (hum <= 70 ? GREEN : BLUE));
        h += '<div class="srow">'
            + '<div class="sn">' + esc(s[0]) + '</div>'
            + '<div class="sv" style="color:' + humCol2 + '">' + (hum != null ? Math.round(hum) : '–') + '<span class="u">%</span></div>'
            + '<div class="sv" style="color:var(--muted)">' + (tmp != null ? Math.round(tmp) : '–') + '<span class="u">°C</span></div>'
            + '</div>';
    });
    var ago = agoStr(anyTs);
    h += '<div class="gstale">' + (ago ? 'Aktualisiert vor ' + ago : 'Gardena – wartet auf Daten') + '</div>';
    return h + '</div></div>';
}

// ===== publish =====
function publish() {
    setState('klima_hero', fo('hw', 1170, 178, buildHero()), true);
    setState('klima_left', fo('lw', 392, 487, buildForecast()), true);
    setState('klima_mid', fo('mw', 377, 534, buildRooms()), true);
    setState('klima_right', fo('rw', 377, 534, buildGarden()), true);
}

['klima_hero', 'klima_left', 'klima_mid', 'klima_right'].forEach(function (id) {
    createState('javascript.0.' + id, '', { type: 'string', role: 'html', desc: 'Klima tab ' + id });
});

// ===== reactive subscriptions =====
ROOMS.forEach(function (r) {
    ['.Temperature.Temperature', '.Humidity.Humidity', '.CO2.CO2', '.LastUpdate'].forEach(function (s) {
        on({ id: r[1] + s, change: 'ne' }, function () { setState('klima_mid', fo('mw', 377, 534, buildRooms()), true); });
    });
});
[OUTDOOR + '.Temperature.Temperature', NB + '.Pressure.Pressure', RAINMOD + '.Rain.SumRain24',
 FC + '1.Maximale_Temperatur_value'].forEach(function (id) {
    on({ id: id, change: 'ne' }, function () { setState('klima_hero', fo('hw', 1170, 178, buildHero()), true); });
});
on({ id: FC + '1.Wetter_Symbol_id', change: 'ne' }, function () {
    setState('klima_hero', fo('hw', 1170, 178, buildHero()), true);
    setState('klima_left', fo('lw', 392, 487, buildForecast()), true);
});
VALVES.forEach(function (suf) {
    on({ id: GVALVE + suf + '.activity_value', change: 'ne' }, function () { setState('klima_right', fo('rw', 377, 534, buildGarden()), true); });
});
SOIL.forEach(function (s) {
    on({ id: s[1] + 'soilHumidity_value', change: 'ne' }, function () { setState('klima_right', fo('rw', 377, 534, buildGarden()), true); });
});

// initial + periodic refresh (covers states without change events)
setTimeout(publish, 2000);
schedule('*/2 * * * *', publish);
console.log('[Klima v2] initialized');
