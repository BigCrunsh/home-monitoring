// Energy tab v2 — HTML/CSS rebuild (same pattern as main_v2.js).
// Five states published; the vis Energy view shows them via tplValueStringRaw widgets
// plus the existing price_forecast_chart at the top (w000900, resized to 110 px).
//   et_v2_left      — LIVE-LEISTUNG: SolarEdge modbus PV/grid + Shelly 3EM phases
//   et_v2_mid_top   — KOSTEN: live €/h breakdown
//   et_v2_mid_bot   — VERLAUF: cost history table
//   et_v2_right_top — AUTARKIE: self-sufficiency spectra
//   et_v2_right_bot — HEIZUNG + WARMWASSER: temps + valve %

var FEEDIN_RATE = 0.1048;   // €/kWh feed-in tariff

// ===== CSS (shared design tokens identical to main_v2.js) =====
// No backticks — array join keeps the source CLI-safe.
var CSS = [
    "@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');",
    '.et2{',
    '  --bg:#0d0e12; --surface:#15161c; --inset:#1c1f28; --border:#262a33;',
    '  --text:#CCCCCC; --muted:#8A8A8A;',
    '  --green:#b5fb5b; --amber:#F1BE3D; --blue:#5080AC; --red:#A00629;',
    '  --s1:4px; --s2:8px; --s3:12px; --s4:16px;',
    '  --r2:14px; --r3:10px;',
    // type scale — minimum 13px (caption floor), up to 30px hero KPI
    '  --t-hero:30px; --t-big:22px; --t-sub:18px; --t-label:15px; --t-cap:13px;',
    '  box-sizing:border-box; background:var(--bg);',
    "  font-family:'Figtree',system-ui,sans-serif; color:var(--text);",
    '  -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums;',
    '  overflow:hidden;',
    '}',
    '.et2 *{margin:0;padding:0;box-sizing:border-box}',
    // lw: left panel (full height); mw/rw: mid/right panels (height set by inline style)
    '.et2.lw{width:386px;height:568px}',
    '.et2.mw{width:386px}',
    '.et2.rw{width:386px}',
    '.et2 .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:12px 16px;display:flex;flex-direction:column;gap:8px;overflow:hidden}',
    '.et2 .card-h{font-size:var(--t-label);font-weight:700;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid var(--border);flex-shrink:0}',
    '.et2 .card-body{flex:1;display:flex;flex-direction:column;gap:8px;min-height:0}',
    '.et2 .mrow{display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
    '.et2 .mrow .ml{font-size:var(--t-label);color:var(--muted);flex-shrink:0}',
    '.et2 .mrow .mv{font-size:var(--t-sub);font-weight:600}',
    '.et2 .mrow .mu{font-size:var(--t-cap);color:var(--muted);margin-left:2px}',
    // section header inside a column (Heizkreis / Warmwasser)
    '.et2 .sec-h{font-size:var(--t-label);font-weight:700;color:var(--text);padding-bottom:4px;border-bottom:1px solid var(--border);flex-shrink:0}',
    '.et2 .pbar{height:6px;border-radius:3px;background:var(--inset);overflow:hidden;flex-shrink:0}',
    '.et2 .pfill{height:6px;border-radius:3px;min-width:2px}',
    // spectrum: red(0%)→amber→green(100%) — higher is better for Autarkie/Eigenverbrauch
    '.et2 .spec{display:flex;flex-direction:column;gap:3px}',
    '.et2 .spec .bar{height:5px;border-radius:3px;position:relative;background:linear-gradient(90deg,var(--red),var(--amber),var(--green));opacity:.82;overflow:visible}',
    '.et2 .spec .knob{position:absolute;top:50%;width:10px;height:10px;border-radius:50%;background:var(--text);border:2px solid var(--surface);transform:translate(-50%,-50%)}',
    '.et2 .spec .mmrow{display:flex;justify-content:space-between;font-size:13px}',
    '.et2 .spec .lo{color:var(--red)} .et2 .spec .hi{color:var(--green)}',
    // power table (Shelly 3-phase detail)
    '.et2 .ptable{font-size:var(--t-cap);border-collapse:collapse;width:100%}',
    '.et2 .ptable th{color:var(--muted);font-weight:600;text-align:right;padding:3px 4px}',
    '.et2 .ptable th:first-child{text-align:left}',
    '.et2 .ptable td{text-align:right;padding:4px 4px;font-weight:500;color:var(--muted)}',
    '.et2 .ptable td:first-child{text-align:left}',
    '.et2 .ptable tr.hi td{font-weight:700;font-size:var(--t-label);color:var(--text)}',
    '.et2 .ptable .div td,.et2 .ptable .div th{border-top:1px solid var(--border)}',
    // cost history table
    '.et2 .vlf{font-size:var(--t-sub);width:100%;border-collapse:collapse}',
    '.et2 .vlf th{color:var(--muted);font-weight:600;font-size:var(--t-cap);padding:2px 6px;text-align:right}',
    '.et2 .vlf th:first-child{text-align:left}',
    '.et2 .vlf td{padding:5px 6px;text-align:right;font-weight:600;color:var(--muted)}',
    '.et2 .vlf td:first-child{text-align:left;color:var(--muted);font-size:var(--t-label);font-weight:400}',
    '.et2 .vlf .vv{color:var(--text)}',
    '.et2 .vlf tr+tr td{border-top:1px solid var(--inset)}',
    '.et2 .divl{border-top:1px solid var(--border);margin:2px 0;flex-shrink:0}'
].join('\n');

// ===== helpers =====
function fo(cls, w, h, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
        + '<foreignObject width="' + w + '" height="' + h + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml" class="et2 ' + cls
        + '" style="width:' + w + 'px;height:' + h + 'px">'
        + '<style>' + CSS + '</style>' + body
        + '</div></foreignObject></svg>';
}

function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function shelly(id) { return sNum('javascript.0.mqtt_shelly.' + id); }
function sam(id)    { return sNum('javascript.0.sam_digital.' + id); }
function tibber(id) { return sNum('javascript.0.tibber_states.' + id); }

function n0(v)  { return v != null ? String(Math.round(v)) : '–'; }
// German locale integer — dot as thousands separator
function n0L(v) { return v != null ? Math.round(v).toLocaleString('de-DE') : '–'; }
function n1(v)  { return v != null ? v.toFixed(1).replace('.', ',') : '–'; }
function n2(v)  { return v != null ? v.toFixed(2).replace('.', ',') : '–'; }
function eur(v) { return v != null ? n2(v) + ' €' : '–'; }

function pbar(frac, col) {
    var pct = (Math.min(Math.max(frac || 0, 0), 1) * 100).toFixed(1);
    return '<div class="pbar"><div class="pfill" style="width:' + pct + '%;background:' + col + '"></div></div>';
}

// Autarkie/Eigenverbrauch spectrum — knob clamped so it never overflows the bar ends
function spec(frac) {
    var f = Math.min(Math.max(frac || 0, 0), 1);
    var knobPct = (Math.min(Math.max(f, 0.014), 0.986) * 100).toFixed(1);
    var pct = Math.round(f * 100);
    return '<div class="spec"><div class="bar"><div class="knob" style="left:' + knobPct + '%"></div></div>'
        + '<div class="mmrow"><span class="lo">0 %</span><span class="hi">100 %</span></div></div>';
}

function mrow(label, val, unit, col, bold) {
    return '<div class="mrow"><span class="ml"' + (bold ? ' style="font-weight:600;color:var(--text)"' : '') + '>' + label + '</span>'
        + '<span class="mv"' + (col ? ' style="color:' + col + '"' : '') + '>' + val
        + (unit ? '<span class="mu"> ' + unit + '</span>' : '') + '</span></div>';
}

// ===== LEFT: LIVE-LEISTUNG (full height 568px) =====
function buildLeft() {
    var W = 386, H = 568;
    var pv   = sNum('javascript.0.solaredge_modbus_production') || 0;
    var grid = sNum('javascript.0.solaredge_modbus_grid') || 0;    // pos=import, neg=export

    var wa = shelly('a_act_power'), wb = shelly('b_act_power'), wc = shelly('c_act_power');
    var wt = shelly('total_act_power');
    var vaa = shelly('a_aprt_power'), vab = shelly('b_aprt_power'), vac = shelly('c_aprt_power');
    var vat = shelly('total_aprt_power');
    var ia = shelly('a_current'), ib = shelly('b_current'), ic = shelly('c_current');
    var it = shelly('total_current');

    // PV: green only when meaningfully producing (≥200W)
    var pvCol = pv >= 200 ? 'var(--green)' : 'var(--muted)';
    var importing = grid >= 0;
    var gridAbs = Math.abs(grid);
    var gridCol = importing
        ? (grid > 2000 ? 'var(--red)' : grid > 150 ? 'var(--amber)' : 'var(--muted)')
        : 'var(--green)';
    var gridLabel = importing ? 'Netz · Bezug' : 'Netz · Einspeisung';
    var gridSign = importing ? '' : '−';

    // House consumption = PV output + signed grid; dash on measurement race
    var hausv = pv + grid;
    var hausvStr = hausv >= 0 ? n1(hausv / 1000) : '–';
    var hausvCol = hausv > 1500 ? 'var(--amber)' : hausv > 0 ? 'var(--text)' : 'var(--muted)';

    // 3-section card-body with space-between fills 568px without void in middle
    var html = '<div class="card" style="height:' + H + 'px">'
        + '<div class="card-h">Live-Leistung</div>'
        + '<div class="card-body" style="justify-content:space-between">'

        // Section 1: power sources (Solar + Netz)
        + '<div style="display:flex;flex-direction:column;gap:16px">'

        + '<div style="display:flex;flex-direction:column;gap:6px">'
        + '<div class="mrow"><span style="font-size:var(--t-label);color:var(--green);font-weight:700">Solar PV</span>'
        + '<span style="font-size:var(--t-hero);font-weight:700;color:' + pvCol + '">' + n1(pv / 1000)
        + '<span style="font-size:var(--t-cap);color:var(--muted);margin-left:3px"> kW</span></span></div>'
        + pbar(pv / 6000, pvCol)
        + '</div>'

        + '<div style="display:flex;flex-direction:column;gap:6px">'
        + '<div class="mrow"><span style="font-size:var(--t-label);color:' + gridCol + ';font-weight:700">' + gridLabel + '</span>'
        + '<span style="font-size:var(--t-hero);font-weight:700;color:' + gridCol + '">' + gridSign + n1(gridAbs / 1000)
        + '<span style="font-size:var(--t-cap);color:var(--muted);margin-left:3px"> kW</span></span></div>'
        + pbar(gridAbs / 6000, gridCol)
        + '</div>'

        + '</div>'  // end section 1

        // Section 2: net house consumption — centred by space-between
        + '<div>'
        + '<div class="divl"></div>'
        + '<div class="mrow" style="padding:6px 0">'
        + '<span style="font-size:var(--t-label);font-weight:700;color:var(--text)">Hausverbrauch</span>'
        + '<span style="font-size:var(--t-big);font-weight:700;color:' + hausvCol + '">' + hausvStr
        + (hausv >= 0 ? '<span style="font-size:var(--t-cap);color:var(--muted);margin-left:3px"> kW</span>' : '')
        + '</span></div>'
        + '<div class="divl"></div>'
        + '</div>'  // end section 2

        // Section 3: Shelly 3EM phase detail
        + '<div style="display:flex;flex-direction:column;gap:6px">'
        + '<div style="color:var(--muted);font-size:var(--t-cap);font-weight:600;letter-spacing:.06em;text-transform:uppercase">Phasen · Shelly 3EM</div>'
        + '<table class="ptable">'
        + '<tr><th></th><th>Σ</th><th>L1</th><th>L2</th><th>L3</th></tr>'
        + '<tr class="hi div"><td>Wirkl. W</td><td>' + n0L(wt) + '</td><td>' + n0L(wa) + '</td><td>' + n0L(wb) + '</td><td>' + n0L(wc) + '</td></tr>'
        + '<tr><td>Schein VA</td><td>' + n0L(vat) + '</td><td>' + n0L(vaa) + '</td><td>' + n0L(vab) + '</td><td>' + n0L(vac) + '</td></tr>'
        + '<tr><td>Strom A</td><td>' + n1(it) + '</td><td>' + n1(ia) + '</td><td>' + n1(ib) + '</td><td>' + n1(ic) + '</td></tr>'
        + '</table>'
        + '</div>'  // end section 3

        + '</div></div>';

    return fo('lw', W, H, html);
}

// ===== MID TOP: KOSTEN (live €/h) =====
function buildMidTop() {
    var W = 386, H = 278;
    var price  = tibber('energy_price_euro');
    var pur    = sNum('javascript.0.power_purchased') || 0;
    var feed   = sNum('javascript.0.power_feedin') || 0;
    var self   = sNum('javascript.0.power_selfconsumption') || 0;
    var einkauf = (pur / 1000) * (price || 0);
    var gewinn  = (feed / 1000) * FEEDIN_RATE;
    var gespart = (self / 1000) * (price || 0);
    // Net cost: positive = paying, negative = earning more than buying
    var netto   = einkauf - gewinn;
    var nettoCol = netto <= 0 ? 'var(--green)' : netto < 0.05 ? 'var(--muted)' : netto < 0.3 ? 'var(--amber)' : 'var(--red)';
    var nettoSign = netto < -0.005 ? '−' : '';

    // Feed-in: green for any real feed-in, muted for zero
    var feedCol = feed > 10 ? 'var(--green)' : 'var(--muted)';
    // Suppress '+' on zero
    var gewinnStr = (gewinn > 0.005 ? '+' : '') + n2(gewinn);

    var stale = getState('javascript.0.power_data_stale');
    var tsLabel = (stale && stale.val)
        ? '≈ Schätzwert (Cloud-Verzögerung)'
        : 'Live · Tibber + SolarEdge';

    var html = '<div class="card" style="height:' + H + 'px">'
        + '<div class="card-h">Stromkosten</div>'
        + '<div class="card-body">'

        // Hero: net cost right now
        + '<div class="mrow"><span class="ml">Jetzt</span>'
        + '<span style="font-size:var(--t-hero);font-weight:700;color:' + nettoCol + '">'
        + nettoSign + n2(Math.abs(netto))
        + '<span style="font-size:var(--t-cap);color:var(--muted);margin-left:3px"> €/h</span></span></div>'

        + '<div class="divl"></div>'
        + mrow('Preis', n2(price), '€/kWh', 'var(--muted)')
        + '<div class="divl"></div>'
        + mrow('Einkauf', n2(einkauf), '€/h', einkauf > 0.01 ? 'var(--amber)' : 'var(--muted)')
        + mrow('Einspeisung', gewinnStr, '€/h', feedCol)
        + mrow('Eigenverbr. gespart', n2(gespart), '€/h', gespart > 0.01 ? 'var(--green)' : 'var(--muted)')

        + '<div style="font-size:var(--t-cap);color:var(--muted);margin-top:auto">' + tsLabel + '</div>'
        + '</div></div>';

    return fo('mw', W, H, html);
}

// ===== MID BOTTOM: VERLAUF (cost history) =====
function buildMidBot() {
    var W = 386, H = 282;

    // cur < prev → green (spending less), cur > prev → amber (spending more)
    function vrow(label, cur, prev) {
        var col = (cur != null && prev != null && prev > 0.001)
            ? (cur < prev ? 'var(--green)' : cur > prev ? 'var(--amber)' : 'var(--text)')
            : 'var(--text)';
        return '<tr><td>' + label + '</td>'
            + '<td><span class="vv" style="color:' + col + '">' + eur(cur) + '</span></td>'
            + '<td>' + eur(prev) + '</td></tr>';
    }

    var html = '<div class="card" style="height:' + H + 'px">'
        + '<div class="card-h">Verlauf</div>'
        + '<div class="card-body" style="justify-content:center">'
        + '<table class="vlf">'
        + '<tr><th></th><th>Aktuell</th><th>Vorig</th></tr>'
        + vrow('Stunde',  tibber('cost_this_hour'),  tibber('cost_last_hour'))
        + vrow('Tag',     tibber('cost_this_day'),   tibber('cost_last_day'))
        + vrow('Monat',   tibber('cost_this_month'), tibber('cost_last_month'))
        + vrow('Jahr',    tibber('cost_this_year'),  null)
        + '</table>'
        + '</div></div>';

    return fo('mw', W, H, html);
}

// ===== RIGHT TOP: AUTARKIE =====
function buildRightTop() {
    var W = 386, H = 278;
    var a  = sNum('javascript.0.rate_autarky');
    var s  = sNum('javascript.0.rate_selfconsumption');
    var a7 = sNum('javascript.0.rate_autarky_7d');
    var s7 = sNum('javascript.0.rate_selfconsumption_7d');

    function block(label, cur, wk) {
        var pct = cur != null ? Math.round(cur * 100) : null;
        // colour: green ≥ 80%, amber 40-80%, red < 40% (for Autarkie)
        var col = pct == null ? 'var(--muted)' : pct >= 80 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';
        return '<div style="display:flex;flex-direction:column;gap:4px">'
            + '<div class="mrow"><span class="ml" style="font-weight:600;color:var(--text)">' + label
            + '<span style="font-size:var(--t-cap);color:var(--muted);margin-left:6px;font-weight:400">Heute</span></span>'
            + '<span style="font-size:var(--t-hero);font-weight:700;color:' + col + '">'
            + (pct != null ? String(pct) : '–')
            + '<span style="font-size:var(--t-cap);color:var(--muted);margin-left:2px"> %</span></span></div>'
            + spec(cur || 0)
            + (wk != null
                ? '<div style="font-size:var(--t-cap);color:var(--muted);text-align:right">Ø 7 Tage: ' + Math.round(wk * 100) + ' %</div>'
                : '')
            + '</div>';
    }

    var html = '<div class="card" style="height:' + H + 'px">'
        + '<div class="card-h">Autarkie & Eigenverbrauch</div>'
        + '<div class="card-body" style="justify-content:space-evenly">'
        + block('Autarkie', a, a7)
        + '<div class="divl"></div>'
        + block('Eigenverbrauch', s, s7)
        + '</div></div>';

    return fo('rw', W, H, html);
}

// ===== RIGHT BOTTOM: HEIZUNG + WARMWASSER (2-column layout) =====
function buildRightBot() {
    var W = 386, H = 282;
    var hkV = sam('heating_valve_signal');
    var wwV = sam('hotwater_valve_signal');
    var hkF = sam('heating_flow_temperature');
    var hkR = sam('heating_return_temperature');
    // hotwater_storage_temperature = Speicher (tank), not flow
    var wwS = sam('hotwater_storage_temperature');
    var wwR = sam('hotwater_return_temperature');
    var hkOn = hkV != null && hkV > 5;
    var wwOn = wwV != null && wwV > 5;

    function col(title, f, fLabel, r, rLabel, v, on) {
        var col = on ? 'var(--amber)' : 'var(--muted)';
        return '<div style="flex:1;display:flex;flex-direction:column;gap:6px">'
            + '<div class="sec-h">' + title + '</div>'
            + '<div class="mrow"><span class="ml">' + fLabel + '</span>'
            + '<span style="font-size:var(--t-big);font-weight:700">' + n1(f)
            + '<span style="font-size:var(--t-cap);color:var(--muted);margin-left:2px"> °C</span></span></div>'
            + '<div class="mrow"><span class="ml">' + rLabel + '</span>'
            + '<span style="font-size:var(--t-big);font-weight:700">' + n1(r)
            + '<span style="font-size:var(--t-cap);color:var(--muted);margin-left:2px"> °C</span></span></div>'
            + '<div style="display:flex;flex-direction:column;gap:3px">'
            + '<div class="mrow"><span class="ml" style="color:' + col + '">Ventil' + (on ? ' · aktiv' : '') + '</span>'
            + '<span style="font-size:var(--t-sub);font-weight:700;color:' + col + '">'
            + (v != null ? Math.round(v) : '–')
            + '<span style="font-size:var(--t-cap);color:var(--muted);margin-left:2px"> %</span></span></div>'
            + pbar(v != null ? v / 100 : 0, col)
            + '</div>'
            + '</div>';
    }

    var html = '<div class="card" style="height:' + H + 'px">'
        + '<div class="card-h">Heizung</div>'
        + '<div class="card-body">'
        + '<div style="display:flex;gap:16px;flex:1;min-height:0">'
        + col('Heizkreis',  hkF, 'Vorlauf',  hkR, 'Rücklauf', hkV, hkOn)
        + '<div style="width:1px;background:var(--border);flex-shrink:0"></div>'
        + col('Warmwasser', wwS, 'Speicher', wwR, 'Rücklauf', wwV, wwOn)
        + '</div>'
        + '</div></div>';

    return fo('rw', W, H, html);
}

// ===== publish all =====
function renderAll() {
    setState('et_v2_left',      buildLeft());
    setState('et_v2_mid_top',   buildMidTop());
    setState('et_v2_mid_bot',   buildMidBot());
    setState('et_v2_right_top', buildRightTop());
    setState('et_v2_right_bot', buildRightBot());
}

// ===== state bootstrap =====
function htmlState(id) { createState(id, '', { type: 'string', role: 'html' }); }
['et_v2_left', 'et_v2_mid_top', 'et_v2_mid_bot', 'et_v2_right_top', 'et_v2_right_bot']
    .forEach(htmlState);
createState('rate_autarky_7d', 0, { type: 'number', role: 'value' });
createState('rate_selfconsumption_7d', 0, { type: 'number', role: 'value' }, function () {
    renderAll();
});

// ===== reactive subscriptions =====
['javascript.0.mqtt_shelly.total_act_power',
 'javascript.0.solaredge_modbus_production',
 'javascript.0.solaredge_modbus_grid'].forEach(function (id) {
    on({ id: id, change: 'ne' }, function () { setState('et_v2_left', buildLeft()); });
});

['javascript.0.tibber_states.energy_price_euro',
 'javascript.0.power_purchased', 'javascript.0.power_feedin', 'javascript.0.power_selfconsumption',
 'javascript.0.tibber_states.cost_this_hour',  'javascript.0.tibber_states.cost_last_hour',
 'javascript.0.tibber_states.cost_this_day',   'javascript.0.tibber_states.cost_last_day',
 'javascript.0.tibber_states.cost_this_month', 'javascript.0.tibber_states.cost_last_month',
 'javascript.0.tibber_states.cost_this_year'].forEach(function (id) {
    on({ id: id, change: 'ne' }, function () {
        setState('et_v2_mid_top', buildMidTop());
        setState('et_v2_mid_bot', buildMidBot());
    });
});

['javascript.0.sam_digital.heating_flow_temperature', 'javascript.0.sam_digital.heating_return_temperature',
 'javascript.0.sam_digital.hotwater_storage_temperature', 'javascript.0.sam_digital.hotwater_return_temperature',
 'javascript.0.sam_digital.heating_valve_signal', 'javascript.0.sam_digital.hotwater_valve_signal'].forEach(function (id) {
    on({ id: id, change: 'ne' }, function () { setState('et_v2_right_bot', buildRightBot()); });
});

on({ id: 'javascript.0.rate_autarky', change: 'ne' }, function () {
    setState('et_v2_right_top', buildRightTop());
});

schedule('*/30 * * * * *', renderAll);
