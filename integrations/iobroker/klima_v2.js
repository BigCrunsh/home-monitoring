// ioBroker JavaScript: Klima tab ("Neu" design system) — renders the Weather/Klima
// view as HTML/CSS foreignObject states, the SAME .mv2 component library as main_v2.js.
//
// Layout (blueprint geometry: hero + 3 columns + nav):
//   klima_hero  (4,4)   1170x178  — outdoor glance: temp now→heute min/max · weather · rain · pressure
//   klima_left  (4,189)  392x487  — 6-Tage Vorhersage (daswetter)
//   klima_mid   (408,189)377x534  — 5 rooms, EXPANDED (today min/max + trend) vs the overview's compact card
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
.mv2 .h-mid{justify-self:center; display:flex; flex-direction:column; align-items:center; gap:var(--s2)}
.mv2 .h-wx img{width:84px; height:84px; object-fit:contain}
.mv2 .h-spark{display:flex; align-items:center; gap:var(--s2); width:300px}
.mv2 .h-spark .lab{font-size:var(--t-cap); color:var(--mute); flex:none}
.mv2 .h-spark svg{flex:1}
.mv2 .h-cond{font-size:var(--t-sub); color:var(--muted); font-weight:500}
.mv2 .h-line{display:flex; align-items:center; gap:var(--s2); font-size:var(--t-label); color:var(--muted)}
.mv2 .h-line b{color:var(--text); font-weight:600; font-size:var(--t-sub)}

/* ROOMS (expanded) — main_v2's Room component, compacted to fit 5 rooms since Studio joined:
   humidity+CO2 share one line, the heute-min/max strip rides in the sparkline row */
.mv2 .rooms{flex:1; display:grid; grid-template-rows:repeat(5,1fr); gap:6px}
.mv2 .room{display:grid; grid-template-columns:auto 1fr auto; grid-template-rows:auto auto auto auto; column-gap:var(--s3); row-gap:1px; align-items:center; background:var(--bg); border-radius:var(--r3); padding:5px var(--s4)}
.mv2 .thermo{grid-column:1; grid-row:1 / 3; align-self:start; margin-top:1px; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center}
.mv2 .room .name{grid-column:2 / 4; grid-row:1; align-self:start; font-size:19px; font-weight:600; line-height:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .op{grid-column:2; grid-row:2; margin-top:-3px; display:flex; align-items:center; gap:var(--s2); font-size:var(--t-cap); font-weight:500; color:var(--muted); white-space:nowrap}
.mv2 .room .op .batt{display:flex; align-items:center; gap:3px}
.mv2 .room .env{grid-column:2; grid-row:3; display:flex; align-items:center; gap:var(--s2); font-size:var(--t-label); white-space:nowrap}
.mv2 .room .env .un{color:var(--muted); font-weight:500}
.mv2 .room .temp{grid-column:3; grid-row:2 / 4; align-self:center; justify-self:end; font-size:32px; font-weight:600; line-height:.9; white-space:nowrap}
.mv2 .room .mmx{display:flex; align-items:center; gap:6px; font-size:var(--t-cap); color:var(--muted); white-space:nowrap; margin-left:auto}
.mv2 .room .mmx b{color:var(--text); font-weight:600}
/* 24h temperature sparkline — what makes the Klima room out-earn the overview card */
.mv2 .room .spark{grid-column:1 / 4; grid-row:4; display:flex; align-items:center; gap:var(--s2); margin-top:3px; padding-top:3px; border-top:1px solid var(--border)}
.mv2 .room .spark .lab{font-size:var(--t-cap); color:var(--mute); flex:none}

/* 6-TAGE VORHERSAGE */
.mv2 .fc{flex:1; display:flex; flex-direction:column}
.mv2 .fcrow{display:grid; grid-template-columns:34px 30px auto 1fr auto; gap:var(--s2); align-items:center; border-top:1px solid var(--border); padding:var(--s2) 2px}
.mv2 .fcrow:first-child{border-top:none}
.mv2 .fcrow.we .dow{color:var(--blue)}
.mv2 .fcrow .dow{font-size:var(--t-sub); font-weight:600}
.mv2 .fcrow img{width:26px; height:26px; object-fit:contain}
.mv2 .fcrow .cond{font-size:var(--t-cap); color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .fcrow .fcbar{position:relative; height:8px; border-radius:4px; background:var(--inset); align-self:center}
.mv2 .fcrow .fcbar .fill{position:absolute; top:0; height:8px; border-radius:4px; min-width:6px}
/* min sits left of the bar, max right of it — the numbers flank the range they describe.
   Both carry the comfort colour (min was previously muted-grey on the far right). */
.mv2 .fcrow .tmin{font-size:var(--t-label); font-weight:600; white-space:nowrap; text-align:right; min-width:22px}
.mv2 .fcrow .tmax{font-size:var(--t-label); font-weight:600; white-space:nowrap; text-align:left; min-width:22px}
/* short-term hourly outlook (+1/3/6/12h) above the 6-day rows */
.mv2 .hourly{display:grid; grid-template-columns:repeat(4,1fr); gap:var(--s2); flex:none}
.mv2 .hcell{background:var(--bg); border-radius:var(--r3); padding:8px 4px; display:flex; flex-direction:column; align-items:center; gap:2px}
.mv2 .hcell .hlab{font-size:var(--t-cap); color:var(--mute); font-weight:600}
.mv2 .hcell .hico img{width:26px; height:26px; object-fit:contain}
.mv2 .hcell .htemp{font-size:20px; font-weight:600; line-height:1}
.mv2 .hcell .hclk{font-size:11px; color:var(--muted)}
.mv2 .hdiv{height:1px; background:var(--border); margin:10px 0 8px; flex:none}

/* GARTEN — valves + soil, bubble rows */
.mv2 .gsec{font-size:var(--t-cap); font-weight:700; letter-spacing:.06em; color:var(--muted); text-transform:uppercase; margin:var(--s1) 0 2px}
.mv2 .vrow{display:grid; grid-template-columns:1fr auto; gap:var(--s2); align-items:center; background:var(--bg); border-radius:var(--r3); padding:7px var(--s3); margin-bottom:6px}
.mv2 .vrow .vn{font-size:var(--t-label); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .vrow .vs{font-size:var(--t-cap); color:var(--muted); white-space:nowrap; text-align:right}
.mv2 .vrow .badge{font-size:var(--t-cap); font-weight:700; padding:2px 8px; border-radius:999px; white-space:nowrap}
.mv2 .srow{display:grid; grid-template-columns:1fr auto auto; gap:var(--s3); align-items:center; background:var(--bg); border-radius:var(--r3); padding:7px var(--s3); margin-bottom:6px}
.mv2 .srow .sinfo{min-width:0}
.mv2 .srow .sn{font-size:var(--t-label); font-weight:600}
.mv2 .srow .smeta{display:flex; align-items:center; gap:6px; font-size:var(--t-cap); font-weight:500; color:var(--muted); margin-top:1px}
.mv2 .srow .smeta .batt{display:flex; align-items:center; gap:3px}
.mv2 .srow .sv{font-size:var(--t-sub); font-weight:600}
.mv2 .srow .sv .u{font-size:11px}
.mv2 .gstale{font-size:var(--t-cap); color:var(--muted); margin-top:auto; padding-top:var(--s2)}
`;

// ===== palette constants =====
var GREEN = VC_PAL.good, AMBER = VC_PAL.warn, BLUE = VC_PAL.cold, RED = VC_PAL.alarm, LBL = VC_PAL.muted, TEXT = VC_PAL.text;

// ===== state refs =====
var NB = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
// second base station (NAMain "Studio", mains-powered — no BatteryStatus/PressureTrend states)
var NB2 = 'netatmo.0.6a48fde5178fa8d8cd09bd27.70-ee-50-c2-86-aa';
var OUTDOOR = NB + '.02-00-00-32-ae-a4';
var RAINMOD = NB + '.05-00-00-05-d4-18';
var FC = 'daswetter.0.NextDays.Location_1.Day_';   // + N + '.<field>'
var HF = 'daswetter.0.NextHours.Location_1.';      // hourly: Day_d.Hour_h.<field> (hour_value "HH:00")
var HOURS_AHEAD = [1, 3, 6, 12];
// [display name, ioBroker module path, InfluxDB module_name for the 24h sparkline]
var ROOMS = [
    ['Wohnzimmer', NB, 'Wohnzimmer'],
    ['Carlottas Zimmer', NB + '.03-00-00-0e-16-36', 'Kinderzimmer Carlotta'],
    ['Claras Zimmer', NB + '.03-00-00-0f-01-6e', 'Kinderzimmer Clara'],
    ['Cleas Zimmer', NB + '.03-00-00-10-e5-42', 'Kinderzimmer Clea'],
    // the Studio base module still carries Netatmo's default name, hence the influx tag
    ['Studio', NB2, 'Weather Station']
];
var INFLUX = 'influxdb.0';
var SPARK = {};   // module_name -> [hourly mean temps over the last 24h]
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
var comma = vcComma;
var clamp01 = vcClamp01;
var esc = vcEsc;
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
function icoGauge(sz) { sz = sz || 16; return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24"><g fill="none" stroke="' + LBL + '" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><line x1="12" y1="7.5" x2="12" y2="9.2"/><line x1="16.5" y1="12" x2="14.8" y2="12"/><line x1="7.5" y1="12" x2="9.2" y2="12"/><line x1="12" y1="12" x2="15.4" y2="9.2"/></g><circle cx="12" cy="12" r="1.6" fill="' + LBL + '"/></svg>'; }
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
// Barometer/Wetterhäuschen reading: rising pressure → improving, falling → worsening.
function pressureDir(tr) {
    if (tr === 'up') return ['↑ steigend', GREEN];
    if (tr === 'down') return ['↓ fallend', BLUE];
    return ['→ stabil', LBL];
}
function wxImg(id, sz) {
    if (id == null) return '';
    return '<img src="/daswetter.admin/icons/tiempo-weather/galeria1/' + Math.round(id) + '.png" alt=""/>';
}
// 24h temperature sparkline: each segment coloured by that period's comfort band
// (so you read *when* it was hot/cool), last point dotted in the current colour.
function sparkline(vals, w, h, dotCol) {
    if (!vals || vals.length < 2) return '';
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), rng = (hi - lo) || 1, pad = 3;
    function X(i) { return pad + (i / (vals.length - 1)) * (w - 2 * pad); }
    function Y(v) { return pad + (1 - (v - lo) / rng) * (h - 2 * pad); }
    var segs = '';
    for (var i = 0; i < vals.length - 1; i++) {
        var col = comfortCol((vals[i] + vals[i + 1]) / 2);
        segs += '<line x1="' + X(i).toFixed(1) + '" y1="' + Y(vals[i]).toFixed(1)
            + '" x2="' + X(i + 1).toFixed(1) + '" y2="' + Y(vals[i + 1]).toFixed(1)
            + '" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round"/>';
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" preserveAspectRatio="none">'
        + segs + '<circle cx="' + X(vals.length - 1).toFixed(1) + '" cy="' + Y(vals[vals.length - 1]).toFixed(1) + '" r="2.6" fill="' + (dotCol || LBL) + '"/></svg>';
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
    var dew = sNum(OUTDOOR + '.Temperature.DewPoint');
    var pr = sNum(NB + '.Pressure.Pressure'), prt = sStr(NB + '.Pressure.PressureTrend');
    var rain = sNum(RAINMOD + '.Rain.SumRain24');
    var wsym = sNum(FC + '1.Wetter_Symbol_id');

    // Colour rule A (value-ranges): outside temp coloured by comfort band.
    var otc = comfortCol(ot);
    // Pressure as a Wetterhäuschen direction: rising → improving, falling → worsening.
    var pd = pressureDir(prt);

    var h = '<div class="hero">';
    // LEFT: big outdoor temp + today min/max
    h += '<div class="h-left">'
        + '<div class="otemp num" style="color:' + otc + '">' + comma(ot, 1) + '<span class="u">°C</span></div>'
        + '<div class="h-mm"><span>heute</span><span><b>' + (mn != null ? Math.round(mn) : '–') + '°</b> min</span><span><b>' + (mx != null ? Math.round(mx) : '–') + '°</b> max</span></div>'
        + '</div>';
    // CENTER: outdoor 24h curve (more than the overview's snapshot) + today's weather icon
    var osp = SPARK['Gartenhaus'];
    h += '<div class="h-mid">'
        + '<div class="h-wx">' + wxImg(wsym) + '</div>'
        + (osp && osp.length > 1 ? '<div class="h-spark"><span class="lab">24 h</span>' + sparkline(osp, 240, 30, otc) + '</div>' : '')
        + '</div>';
    // RIGHT: overview-style metric lines — humidity (drop) + pressure (gauge, mbar) mirror the
    // Übersicht hero; rain, the pressure-trend word and Taupunkt are the Klima-only extras kept here.
    // "Taupunkt" is the Netatmo DewPoint shown verbatim — NOT a computed feels-like temperature.
    h += '<div class="h-right">'
        + '<div class="h-line">' + icoDrop(rain != null && rain > 0 ? BLUE : LBL, 16) + 'Regen <b>' + (rain != null ? comma(rain, 1) : '0,0') + '</b><span class="u">mm</span></div>'
        + '<div class="h-line">' + icoDrop(BLUE, 16) + 'Luftfeuchte <b>' + (oh != null ? Math.round(oh) : '–') + '</b><span class="u">%</span></div>'
        + '<div class="h-line">' + icoGauge(16) + 'Druck <b>' + (pr != null ? Math.round(pr) : '–') + '</b><span class="u">mbar</span> <span style="color:' + pd[1] + '">' + pd[0] + '</span></div>'
        + '<div class="h-line">Taupunkt <b>' + (dew != null ? Math.round(dew) : '–') + '</b><span class="u">°C</span></div>'
        + '</div>';
    return h + '</div>';
}

// ===== ROOM (expanded) — B′ colouring =====
function buildRoom(name, module, influxName) {
    var t = sNum(module + '.Temperature.Temperature'), hh = sNum(module + '.Humidity.Humidity'),
        c = sNum(module + '.CO2.CO2');
    // base stations (Wohnzimmer, Studio) are mains-powered and have no BatteryStatus state —
    // an unguarded getState would warn-spam the log on every publish
    var bs = existsState(module + '.BatteryStatus') ? sNum(module + '.BatteryStatus') : null;
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
    h += '<div class="env">' + icoDrop(BLUE, 14) + '<span style="color:' + humCol(hh) + '">' + (hh != null ? Math.round(hh) : '–') + '</span><span class="un">%</span>'
        + '<span class="un">·</span>' + (c != null
            ? '<span style="color:' + co2Col(c) + '">' + Math.round(c) + '</span><span class="un">ppm</span>'
            : '<span class="un">–</span>') + '</div>';
    h += '<div class="temp num" style="color:' + cc + '">' + comma(t, 1) + '<span class="u">°C</span></div>';
    // bottom strip: 24h sparkline (from home_monitoring InfluxDB) + today min/max + trend
    var sv = SPARK[influxName];
    h += '<div class="spark">'
        + (sv && sv.length > 1 ? '<span class="lab">24 h</span>' + sparkline(sv, 175, 14, cc) : '')
        + '<div class="mmx">' + trendArrow(tr, cc)
        + '<span>heute <b>' + (tmin != null ? Math.round(tmin) : '–') + '°</b>/<b>' + (tmax != null ? Math.round(tmax) : '–') + '°</b></span></div></div>';
    return h + '</div>';
}
function buildRooms() {
    var h = '<div class="card"><div class="card-h">Räume</div><div class="card-body"><div class="rooms">';
    ROOMS.forEach(function (r) { h += buildRoom(r[0], r[1], r[2]); });
    return h + '</div></div></div>';
}

// Fetch each room's last-24h hourly temperature curve from home_monitoring InfluxDB
// into SPARK, then run `done` (the rooms re-render once the curves are in).
function fetchSparks(done) {
    var mods = ROOMS.map(function (r) { return r[2]; }).concat(['Gartenhaus']);  // + outdoor
    var pending = mods.length;
    mods.forEach(function (mod) {
        var q = 'SELECT mean("Temperature") AS m FROM home_monitoring.autogen.weather_temperature_celsius'
            + " WHERE module_name='" + mod + "' AND time > now()-24h GROUP BY time(1h) fill(none)";
        sendTo(INFLUX, 'query', q, function (res) {
            try {
                var rows = (res && res.result && res.result[0]) || [];
                var vals = rows.map(function (x) { return x.m; }).filter(function (v) { return typeof v === 'number'; });
                if (vals.length > 1) SPARK[mod] = vals;
            } catch (e) { /* leave SPARK[mod] as-is */ }
            if (--pending === 0 && typeof done === 'function') done();
        });
    });
}

// ===== 6-TAGE VORHERSAGE =====
// hourly forecast at now+n hours, matched by day_value + clock-hour index (midnight = 24:00)
function ymd(d) { return '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
function hourFC(n) {
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    var t = new Date(now.getTime() + n * 3600000);
    var H = t.getHours(), clockH = (H === 0) ? 24 : H;
    var dayDate = ymd(H === 0 ? new Date(t.getTime() - 3600000) : t);
    var dayIdx = null;
    for (var d = 1; d <= 4; d++) { if (sStr(HF + 'Day_' + d + '.day_value') === dayDate) { dayIdx = d; break; } }
    if (!dayIdx) return null;
    var base = HF + 'Day_' + dayIdx + '.Hour_' + clockH + '.';
    return { n: n, clock: (clockH === 24 ? 0 : clockH) + ' Uhr', temp: sNum(base + 'temp_value'), sym: sNum(base + 'symbol_value') };
}
function buildHourly() {
    var cells = '';
    HOURS_AHEAD.forEach(function (n) {
        var f = hourFC(n);
        cells += '<div class="hcell"><div class="hlab">+' + n + ' h</div>'
            + (f ? '<div class="hico">' + wxImg(f.sym) + '</div>'
                + '<div class="htemp" style="color:' + comfortCol(f.temp) + '">' + (f.temp != null ? Math.round(f.temp) + '°' : '–') + '</div>'
                + '<div class="hclk">' + f.clock + '</div>'
                : '<div class="htemp" style="color:var(--mute)">–</div>')
            + '</div>';
    });
    return '<div class="hourly">' + cells + '</div>';
}

function buildForecast() {
    var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    // gather all days first to build a shared temperature scale for the range bars
    var days = [];
    for (var i = 1; i <= 6; i++) {
        var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (i - 1));
        days.push({
            mn: sNum(FC + i + '.Minimale_Temperatur_value'),
            mx: sNum(FC + i + '.Maximale_Temperatur_value'),
            sym: sNum(FC + i + '.Wetter_Symbol_id'),
            dow: d.getDay()
        });
    }
    var mns = days.map(function (x) { return x.mn; }).filter(function (v) { return typeof v === 'number'; });
    var mxs = days.map(function (x) { return x.mx; }).filter(function (v) { return typeof v === 'number'; });
    var gmin = mns.length ? Math.min.apply(null, mns) : 0;
    var gmax = mxs.length ? Math.max.apply(null, mxs) : 1;
    var grng = (gmax - gmin) || 1;

    var h = '<div class="card"><div class="card-h">Vorhersage</div><div class="card-body">'
        + buildHourly() + '<div class="hdiv"></div><div class="fc">';
    days.forEach(function (x) {
        var weekend = (x.dow === 0 || x.dow === 6);
        var bar = '';
        if (typeof x.mn === 'number' && typeof x.mx === 'number') {
            var L = ((x.mn - gmin) / grng) * 100, W = ((x.mx - x.mn) / grng) * 100;
            bar = '<div class="fcbar"><div class="fill" style="left:' + L.toFixed(1) + '%;width:' + W.toFixed(1)
                + '%;background:linear-gradient(90deg,' + comfortCol(x.mn) + ',' + comfortCol(x.mx) + ')"></div></div>';
        }
        h += '<div class="fcrow' + (weekend ? ' we' : '') + '">'
            + '<div class="dow">' + DAYS_SHORT[x.dow] + '</div>'
            + '<div>' + wxImg(x.sym) + '</div>'
            + '<div class="tmin" style="color:' + comfortCol(x.mn) + '">' + (x.mn != null ? Math.round(x.mn) : '–') + '°</div>'
            + (bar || '<div class="fcbar"></div>')
            + '<div class="tmax" style="color:' + comfortCol(x.mx) + '">' + (x.mx != null ? Math.round(x.mx) : '–') + '°</div>'
            + '</div>';
    });
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
        // the status text already says open/closed — no redundant badge
        var statusTxt = watering
            ? '<span style="color:' + GREEN + ';font-weight:700">läuft' + (left != null ? ' · ' + Math.round(left / 60) + ' min' : '') + '</span>'
            : 'zu · ' + (agoStr(ats) ? 'vor ' + agoStr(ats) : '–');
        h += '<div class="vrow">'
            + '<div class="vn">' + clip(nm, 18) + '</div>'
            + '<div class="vs">' + statusTxt + '</div>'
            + '</div>';
    });
    h += '<div class="gsec">Bodensensoren</div>';
    SOIL.forEach(function (s) {
        var hum = sNum(s[1] + 'soilHumidity_value'), tmp = sNum(s[1] + 'soilTemperature_value');
        var ts = sStr(s[1] + 'soilHumidity_timestamp');
        // Battery lives on the sibling COMMON service (…SERVICE_SENSOR_<id>. → …SERVICE_COMMON_<id>.).
        var batt = sNum(s[1].replace('SERVICE_SENSOR_', 'SERVICE_COMMON_') + 'batteryLevel_value');
        if (ts && (!anyTs || new Date(ts) > new Date(anyTs))) anyTs = ts;
        // Operational line under the name: last-update age + battery — mirrors the room component.
        var battChip = '';
        if (batt != null) {
            var bcol = batt < 20 ? RED : (batt < 30 ? AMBER : LBL);
            battChip = '<span class="batt" style="color:' + bcol + '">' + icoBatt(batt, bcol) + Math.round(batt) + '%</span>';
        }
        // F4: a sensor that hasn't reported in >24h is offline, not "bone dry" — show "–", never a
        // false dry-verdict. §8.2 escalation: flag the age amber (offline = attention, not a red
        // alarm — a garden probe going quiet isn't urgent) and dim the whole row so a long-dead
        // sensor recedes instead of masquerading as live telemetry.
        var stale = ageMs(ts) == null || ageMs(ts) > 86400000;
        var ageStyle = stale ? ' style="color:' + AMBER + '"' : '';
        var info = '<div class="sinfo"><div class="sn">' + esc(s[0]) + '</div>'
            + '<div class="smeta"><span' + ageStyle + '>' + (agoStr(ts) ? 'vor ' + agoStr(ts) : 'offline') + '</span>' + battChip + '</div></div>';
        if (stale) {
            h += '<div class="srow" style="opacity:.5">' + info
                + '<div class="sv" style="color:var(--mute)">–</div>'
                + '<div class="sv" style="color:var(--mute)">–</div>'
                + '</div>';
            return;
        }
        // soil moisture: value-coloured (dry amber / ok green / wet blue)
        var humCol2 = hum == null ? LBL : (hum < 30 ? AMBER : (hum <= 70 ? GREEN : BLUE));
        h += '<div class="srow">' + info
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
function refreshSparkViews() {
    setState('klima_mid', fo('mw', 377, 534, buildRooms()), true);  // room curves
    setState('klima_hero', fo('hw', 1170, 178, buildHero()), true); // outdoor curve
}
setTimeout(function () { publish(); fetchSparks(refreshSparkViews); }, 2000);
schedule('*/2 * * * *', publish);
// sparklines change slowly — refresh the 24h curves every 15 min
schedule('*/15 * * * *', function () { fetchSparks(refreshSparkViews); });
console.log('[Klima v2] initialized');
