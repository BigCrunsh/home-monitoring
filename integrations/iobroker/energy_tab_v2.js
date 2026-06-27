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
// NOTE: string concatenation (no template literals) so the source is backtick-free and
// can be passed through bash argument parsing without misinterpretation.
var CSS = [
    "@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');",
    '.et2{',
    '  --bg:#0d0e12; --surface:#15161c; --inset:#1c1f28; --border:#262a33;',
    '  --text:#CCCCCC; --muted:#8A8A8A;',
    '  --green:#b5fb5b; --amber:#F1BE3D; --blue:#5080AC; --red:#A00629;',
    '  --s1:4px; --s2:8px; --s3:12px; --s4:16px;',
    '  --r2:14px; --r3:10px;',
    '  --t-sub:18px; --t-label:14px; --t-cap:12px;',
    "  box-sizing:border-box; background:var(--bg);",
    "  font-family:'Figtree',system-ui,sans-serif; color:var(--text);",
    '  -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums;',
    '  overflow:hidden;',
    '}',
    '.et2 *{margin:0;padding:0;box-sizing:border-box}',
    '.et2.lw{width:386px;height:568px}',
    '.et2.mw{width:386px;height:568px;display:flex;flex-direction:column;gap:8px}',
    '.et2.rw{width:386px;height:568px;display:flex;flex-direction:column;gap:8px}',
    '.et2 .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r2);padding:12px 16px;display:flex;flex-direction:column;gap:8px;overflow:hidden}',
    '.et2 .card.tall{flex:1}',
    '.et2 .card-h{font-size:var(--t-label);font-weight:700;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid var(--border)}',
    '.et2 .card-body{flex:1;display:flex;flex-direction:column;gap:8px;min-height:0}',
    '.et2 .mrow{display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
    '.et2 .mrow .ml{font-size:var(--t-label);color:var(--muted)}',
    '.et2 .mrow .mv{font-size:var(--t-sub);font-weight:600}',
    '.et2 .mrow .mu{font-size:var(--t-cap);color:var(--muted);margin-left:2px}',
    '.et2 .pbar{height:6px;border-radius:3px;background:var(--inset);overflow:hidden;flex-shrink:0}',
    '.et2 .pfill{height:6px;border-radius:3px;min-width:2px}',
    '.et2 .spec{display:flex;flex-direction:column;gap:3px}',
    '.et2 .spec .bar{height:5px;border-radius:3px;position:relative;background:linear-gradient(90deg,var(--green),var(--amber),var(--red));opacity:.82}',
    '.et2 .spec .knob{position:absolute;top:50%;width:10px;height:10px;border-radius:50%;background:var(--text);border:2px solid var(--surface);transform:translate(-50%,-50%)}',
    '.et2 .spec .mmrow{display:flex;justify-content:space-between;font-size:11px}',
    '.et2 .spec .lo{color:var(--green)} .et2 .spec .hi{color:var(--red)}',
    '.et2 .ptable{font-size:13px;border-collapse:collapse;width:100%}',
    '.et2 .ptable th{color:var(--muted);font-weight:600;text-align:right;padding:2px 4px;font-size:var(--t-cap)}',
    '.et2 .ptable th:first-child{text-align:left}',
    '.et2 .ptable td{text-align:right;padding:3px 4px;font-weight:500}',
    '.et2 .ptable td:first-child{text-align:left;color:var(--muted)}',
    '.et2 .ptable tr.sum td{font-weight:700;font-size:var(--t-sub);color:var(--text)}',
    '.et2 .ptable .div td,.et2 .ptable .div th{border-top:1px solid var(--border)}',
    '.et2 .vlf{font-size:13px;width:100%;border-collapse:collapse}',
    '.et2 .vlf th{color:var(--muted);font-weight:600;font-size:var(--t-cap);padding:2px 4px;text-align:right}',
    '.et2 .vlf th:first-child{text-align:left}',
    '.et2 .vlf td{padding:4px 4px;text-align:right;font-weight:500;color:var(--muted)}',
    '.et2 .vlf td:first-child{text-align:left;color:var(--muted);font-size:var(--t-label)}',
    '.et2 .vlf .vv{color:var(--text);font-size:var(--t-sub);font-weight:600}',
    '.et2 .vlf tr+tr td{border-top:1px solid var(--inset)}',
    '.et2 .divl{border-top:1px solid var(--border);margin:2px 0}'
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

function n0(v) { return v != null ? String(Math.round(v)) : '–'; }
function n1(v) { return v != null ? v.toFixed(1).replace('.', ',') : '–'; }
function n2(v) { return v != null ? v.toFixed(2).replace('.', ',') : '–'; }
function eur(v) { return v != null ? n2(v) + ' €' : '–'; }

function semCol(watt, favourable) {
    var m = Math.abs(watt || 0);
    if (favourable) return m < 75 ? 'var(--muted)' : 'var(--green)';
    if (m < 150) return 'var(--muted)';
    return m < 2000 ? 'var(--amber)' : 'var(--red)';
}

function pbar(frac, col) {
    var pct = (Math.min(Math.max(frac || 0, 0), 1) * 100).toFixed(1);
    return '<div class="pbar"><div class="pfill" style="width:' + pct + '%;background:' + col + '"></div></div>';
}

function spec(frac) {
    var pct = (Math.min(Math.max(frac || 0, 0), 1) * 100).toFixed(1);
    return '<div class="spec"><div class="bar"><div class="knob" style="left:' + pct + '%"></div></div>'
        + '<div class="mmrow"><span class="lo">0 %</span><span class="hi">100 %</span></div></div>';
}

function mrow(label, val, unit, col, bold) {
    return '<div class="mrow"><span class="ml"' + (bold ? ' style="font-weight:600;color:var(--text)"' : '') + '>' + label + '</span>'
        + '<span class="mv"' + (col ? ' style="color:' + col + '"' : '') + '>' + val
        + (unit ? '<span class="mu"> ' + unit + '</span>' : '') + '</span></div>';
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

    var pvCol  = pv > 75 ? 'var(--green)' : 'var(--muted)';
    var importing = grid >= 0;
    var gridAbs = Math.abs(grid);
    var gridCol = importing
        ? (grid > 2000 ? 'var(--red)' : grid > 150 ? 'var(--amber)' : 'var(--muted)')
        : 'var(--green)';
    var gridLabel = importing ? 'Bezug' : 'Einspeisung';
    var total = pv + (importing ? grid : 0);
    var totCol = semCol(total, false);

    var html = '<div class="card" style="height:' + H + 'px">'
        + '<div class="card-h">Live-Leistung</div>'
        + '<div class="card-body">'

        + '<div style="display:flex;flex-direction:column;gap:4px">'
        + mrow('<span style="color:var(--green);font-weight:600">Solar PV</span>', n0(pv), 'W', pvCol)
        + pbar(pv / 6000, pvCol)
        + '</div>'

        + '<div style="display:flex;flex-direction:column;gap:4px">'
        + mrow('Netz <span style="font-size:11px;font-weight:400;color:var(--muted)">(' + gridLabel + ')</span>',
               (importing ? '' : '−') + n0(gridAbs), 'W', gridCol, true)
        + pbar(gridAbs / 6000, gridCol)
        + '</div>'

        + '<div class="divl"></div>'
        + mrow('Gesamt', n0(total), 'W', totCol, true)

        + '<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end">'
        + '<table class="ptable">'
        + '<tr class="div"><th>Shelly 3EM</th><th>Σ</th><th>L1</th><th>L2</th><th>L3</th></tr>'
        + '<tr class="sum"><td>Wirkl. W</td><td>' + n0(wt)  + '</td><td>' + n0(wa)  + '</td><td>' + n0(wb)  + '</td><td>' + n0(wc)  + '</td></tr>'
        + '<tr><td>Schein VA</td><td>' + n0(vat) + '</td><td>' + n0(vaa) + '</td><td>' + n0(vab) + '</td><td>' + n0(vac) + '</td></tr>'
        + '<tr><td>Strom A</td><td>'  + n1(it)  + '</td><td>' + n1(ia)  + '</td><td>' + n1(ib)  + '</td><td>' + n1(ic)  + '</td></tr>'
        + '</table>'
        + '</div>'

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
    var stale  = getState('javascript.0.power_data_stale');

    var html = '<div class="card" style="height:' + H + 'px">'
        + '<div class="card-h">Stromkosten</div>'
        + '<div class="card-body">'
        + mrow('Preis', n2(price), '€/kWh')
        + '<div class="divl"></div>'
        + mrow('Einkauf', n2(einkauf), '€/h', semCol(pur, false))
        + mrow('Einspeisung', '+' + n2(gewinn), '€/h', semCol(feed, true))
        + mrow('Eigenverbr. gespart', n2(gespart), '€/h', semCol(self, true))
        + (stale && stale.val ? '<div style="font-size:11px;color:var(--muted);margin-top:auto">≈ geschätzt · Cloud-Verzögerung</div>' : '')
        + '</div></div>';

    return fo('mw', W, H, html);
}

// ===== MID BOTTOM: VERLAUF (cost history) =====
function buildMidBot() {
    var W = 386, H = 282;

    function vrow(label, cur, prev) {
        return '<tr><td>' + label + '</td>'
            + '<td class="vv">' + eur(cur) + '</td>'
            + '<td>' + eur(prev) + '</td></tr>';
    }

    var html = '<div class="card" style="height:' + H + 'px">'
        + '<div class="card-h">Verlauf</div>'
        + '<div class="card-body" style="justify-content:center">'
        + '<table class="vlf">'
        + '<tr><th></th><th>Aktuell</th><th>Vorige</th></tr>'
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
        return '<div style="display:flex;flex-direction:column;gap:4px">'
            + mrow(label, pct != null ? String(pct) : '–', '%', 'var(--green)', true)
            + spec(cur || 0)
            + (wk != null ? '<div style="font-size:11px;color:var(--muted)">Ø 7 Tage: ' + Math.round(wk * 100) + ' %</div>' : '')
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

// ===== RIGHT BOTTOM: HEIZUNG + WARMWASSER =====
function buildRightBot() {
    var W = 386, H = 282;
    var hkV = sam('heating_valve_signal');
    var wwV = sam('hotwater_valve_signal');
    var hkF = sam('heating_flow_temperature');
    var hkR = sam('heating_return_temperature');
    var wwS = sam('hotwater_storage_temperature');
    var wwR = sam('hotwater_return_temperature');
    var hkOn = hkV != null && hkV > 5;
    var wwOn = wwV != null && wwV > 5;

    function tempRows(f, r) {
        return mrow('Vorlauf', n1(f), '°C') + mrow('Rücklauf', n1(r), '°C');
    }
    function valveRow(pct, on) {
        var col = on ? 'var(--amber)' : 'var(--muted)';
        return '<div style="display:flex;flex-direction:column;gap:2px">'
            + '<div class="mrow"><span class="ml" style="color:' + col + '">Ventil' + (on ? ' · aktiv' : '') + '</span>'
            + '<span class="mv" style="color:' + col + '">' + (pct != null ? Math.round(pct) : '–')
            + '<span class="mu"> %</span></span></div>'
            + pbar(pct != null ? pct / 100 : 0, col)
            + '</div>';
    }

    var html = '<div class="card" style="height:' + H + 'px">'
        + '<div class="card-h">Heizung</div>'
        + '<div class="card-body">'
        + '<div style="font-size:13px;font-weight:600;color:var(--muted)">Heizkreis</div>'
        + tempRows(hkF, hkR)
        + valveRow(hkV, hkOn)
        + '<div class="divl"></div>'
        + '<div style="font-size:13px;font-weight:600;color:var(--muted)">Warmwasser</div>'
        + tempRows(wwS, wwR)
        + valveRow(wwV, wwOn)
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
 'javascript.0.tibber_states.cost_this_hour', 'javascript.0.tibber_states.cost_this_day',
 'javascript.0.tibber_states.cost_this_month', 'javascript.0.tibber_states.cost_this_year'].forEach(function (id) {
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
