// Energy-tab detail cards (the drill-down behind the Main "Energiefluss" hub).
// Each panel is an SVG card published to a state and shown via a vis
// tplValueStringRaw widget, exactly like the hub. Same design language:
// one font (RobotoCondensed), 2-tier greys (value var(--color-font),
// label var(--color-text-muted)), magnitude bars, palette via CSS vars.
//
// Cards:
//   et_power_card     Live-Leistung    Shelly 3EM, 3-phase Wirk/Schein/Strom
//   et_costs_card     Stromkosten      €/h breakdown + Heute/Monat (tibber)
//   et_autarky_card   Autarkie & EV    current rate + 7-day context tick
//   et_heizkreis_card Heizkreis        Vorlauf/Rücklauf + Ventil
//   et_warmwasser_card Warmwasser      Speicher/Rücklauf + Ventil
//   et_outdoor_card   Außentemperatur  big value + heating summary
//
// The 7-day autarky/self-consumption come from an InfluxDB mean over the
// electricity_power_watt measurement (SolarEdge-cloud figures).

var VAL = 'var(--color-font)',
    LBL = 'var(--color-text-muted)',
    GREEN = 'var(--color-green)',
    AMBER = 'var(--color-yellow)',
    RED = 'var(--color-red)',
    BLUE = 'var(--color-blue)',
    PANEL = 'var(--color-panel)',
    BORDER = 'var(--color-border)',
    F = 'font-family="RobotoCondensed-Regular,sans-serif"';
var FEEDIN_RATE = 0.1048;   // €/kWh feed-in tariff (matches the hub)

// --- small helpers ---------------------------------------------------------
function card(w, h, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h
        + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">'
        + '<rect x="1" y="1" width="' + (w - 2) + '" height="' + (h - 2) + '" rx="12" fill="' + PANEL + '" stroke="' + BORDER + '"/>'
        + inner + '</svg>';
}
function T(x, y, fill, size, anchor, s) {
    return '<text x="' + x + '" y="' + y + '" fill="' + fill + '" ' + F + ' font-size="' + size + '"'
        + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + s + '</text>';
}
function bar(x, y, w, h, frac, col) {
    var s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (h / 2) + '" fill="' + BORDER + '" opacity="0.6"/>';
    if (frac > 0) s += '<rect x="' + x + '" y="' + y + '" width="' + (w * Math.min(frac, 1)).toFixed(0) + '" height="' + h + '" rx="' + (h / 2) + '" fill="' + col + '"/>';
    return s;
}
function comma(v, dec) { return (typeof v === 'number') ? v.toFixed(dec == null ? 1 : dec).replace('.', ',') : '–'; }
function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function shelly(id) { return sNum('javascript.0.mqtt_shelly.' + id); }
// Colour by role × magnitude (matches the Energiefluss hub): favourable (produce / feed /
// export) grey < 75 W → green; cost (consume / charge / import) grey < 150 W → yellow → red ≥ 2000 W.
var T_PROD = 75, T_CONS_LOW = 150, T_CONS_HIGH = 2000;
function roleCol(val, favourable) {
    var m = Math.abs(val || 0);
    if (favourable) return m < T_PROD ? LBL : GREEN;
    if (m < T_CONS_LOW) return LBL;
    return m < T_CONS_HIGH ? AMBER : RED;
}
function sam(id) { return sNum('javascript.0.sam_digital.' + id); }

// --- 1) Live-Leistung (Shelly 3EM, 3-phase table) --------------------------
function renderPower() {
    var W = 386, H = 210, c = [];
    var watt = { t: shelly('total_act_power'), a: shelly('a_act_power'), b: shelly('b_act_power'), d: shelly('c_act_power') };
    var va = { t: shelly('total_aprt_power'), a: shelly('a_aprt_power'), b: shelly('b_aprt_power'), d: shelly('c_aprt_power') };
    var amp = { t: shelly('total_current'), a: shelly('a_current'), b: shelly('b_current'), d: shelly('c_current') };
    c.push(T(14, 24, VAL, 15, null, 'LIVE-LEISTUNG'));
    c.push(T(372, 24, LBL, 11, 'end', 'Netzanschluss · 3 Phasen'));
    var X = { sum: 196, a: 252, b: 312, c: 372 };
    c.push(T(X.sum, 50, LBL, 11, 'end', 'Σ'));
    c.push(T(X.a, 50, LBL, 11, 'end', 'L1'));
    c.push(T(X.b, 50, LBL, 11, 'end', 'L2'));
    c.push(T(X.c, 50, LBL, 11, 'end', 'L3'));
    function row(y, label, v, fmt, sumCol) {
        c.push(T(14, y, LBL, 13, null, label));
        c.push(T(X.sum, y, sumCol || VAL, 16, 'end', v.t == null ? '–' : fmt(v.t)));
        c.push(T(X.a, y, LBL, 13, 'end', v.a == null ? '–' : fmt(v.a)));
        c.push(T(X.b, y, LBL, 13, 'end', v.b == null ? '–' : fmt(v.b)));
        c.push(T(X.c, y, LBL, 13, 'end', v.d == null ? '–' : fmt(v.d)));
    }
    var fi = function (v) { return Math.round(v); };
    var f1 = function (v) { return comma(v, 1); };
    var wCol = roleCol(watt.t, (watt.t || 0) < 0);   // grid: export green, import yellow→red
    row(82, 'Wirkleistung (W)', watt, fi, wCol);
    row(126, 'Scheinleistung (VA)', va, fi, VAL);
    row(170, 'Strom (A)', amp, f1, VAL);
    return card(W, H, c.join(''));
}

// --- 2) Stromkosten (€/h breakdown + running day/month total) --------------
function renderCosts() {
    var W = 386, H = 210, c = [];
    var price = sNum('javascript.0.tibber_states.energy_price_euro');
    var pur = sNum('javascript.0.power_purchased') || 0;
    var feed = sNum('javascript.0.power_feedin') || 0;
    var self = sNum('javascript.0.power_selfconsumption') || 0;
    var today = sNum('javascript.0.tibber_states.cost_this_day');
    var month = sNum('javascript.0.tibber_states.cost_this_month');
    var einkauf = (pur / 1000) * (price || 0);
    var gewinn = (feed / 1000) * FEEDIN_RATE;
    var gespart = (self / 1000) * (price || 0);
    function eur(v) { return comma(v, 2); }
    c.push(T(14, 24, VAL, 15, null, 'STROMKOSTEN'));
    c.push(T(372, 24, LBL, 11, 'end', 'aktuell · €/h'));
    function row(y, label, val, col, plus) {
        c.push(T(14, y, LBL, 13, null, label));
        c.push(T(372, y, col, 15, 'end', (plus && val > 0.0005 ? '+' : '') + eur(val) + ' €/h'));
    }
    row(58, 'Netzeinkauf', einkauf, roleCol(pur, false), false);        // cost: yellow→red by import W
    row(88, 'Einspeise-Gewinn', gewinn, roleCol(feed, true), true);     // favourable: green ≥75 W
    row(118, 'Eigenverbrauch gespart', gespart, roleCol(self, true), false);
    c.push('<line x1="14" y1="140" x2="372" y2="140" stroke="' + BORDER + '"/>');
    c.push(T(14, 178, LBL, 14, null, 'Heute'));
    c.push(T(372, 182, VAL, 26, 'end', today != null ? eur(today) + ' €' : '–'));
    c.push(T(14, 200, LBL, 11, null, 'Diesen Monat'));
    c.push(T(372, 200, LBL, 12, 'end', month != null ? eur(month) + ' €' : '–'));
    return card(W, H, c.join(''));
}

// --- 3) Autarkie & Eigenverbrauch (current + 7-day context tick) -----------
function renderAutarky() {
    var W = 386, H = 210, c = [];
    var a = sNum('javascript.0.rate_autarky');
    var s = sNum('javascript.0.rate_selfconsumption');
    var a7 = sNum('javascript.0.rate_autarky_7d');
    var s7 = sNum('javascript.0.rate_selfconsumption_7d');
    c.push(T(14, 24, VAL, 15, null, 'AUTARKIE & EIGENVERBRAUCH'));
    function block(y, label, cur, wk) {
        var pct = cur != null ? Math.round(cur * 100) : null;
        c.push(T(14, y, LBL, 13, null, label));
        c.push(T(372, y, VAL, 16, 'end', pct != null ? pct + ' %' : '–'));
        var bx = 14, bw = 358, by = y + 8;
        c.push(bar(bx, by, bw, 8, pct != null ? pct / 100 : 0, GREEN));
        if (wk != null) {
            var mx = bx + bw * Math.min(Math.max(wk, 0), 1);
            c.push('<line x1="' + mx.toFixed(1) + '" y1="' + (by - 3) + '" x2="' + mx.toFixed(1) + '" y2="' + (by + 11) + '" stroke="' + VAL + '" stroke-width="2"/>');
            c.push(T(bx, y + 32, LBL, 11, null, '⌀ 7 Tage: ' + Math.round(wk * 100) + ' %'));
        }
    }
    block(58, 'Autarkie', a, a7);
    block(122, 'Eigenverbrauch', s, s7);
    var ds = getState('javascript.0.power_data_stale');
    var stale = ds && ds.val === true;
    c.push(T(14, 198, LBL, 10, null, stale ? '≈ geschätzt · Cloud-Verzögerung' : 'live · ⌀ 7 Tage aus dem Verlauf'));
    return card(W, H, c.join(''));
}

// --- 4/5) temperature card (Heizkreis / Warmwasser) ------------------------
function renderTempCard(title, rows, valvePct) {
    var W = 386, H = 160, c = [];
    var active = valvePct != null && valvePct > 5;
    c.push(T(14, 24, VAL, 15, null, title));
    c.push(T(372, 24, active ? AMBER : LBL, 11, 'end', active ? 'aktiv' : 'aus'));
    var y = 62;
    rows.forEach(function (r) {
        c.push(T(14, y, LBL, 13, null, r[0]));
        c.push(T(372, y, VAL, 18, 'end', r[1] != null ? comma(r[1], 1) + ' °C' : '–'));
        y += 34;
    });
    c.push(T(14, 142, LBL, 12, null, 'Ventil'));
    c.push(bar(70, 134, 250, 8, valvePct != null ? valvePct / 100 : 0, active ? AMBER : LBL));
    c.push(T(372, 142, VAL, 14, 'end', valvePct != null ? Math.round(valvePct) + ' %' : '–'));
    return card(W, H, c.join(''));
}

// --- 6) Außentemperatur (big value + heating summary) ----------------------
function renderOutdoor(outdoor, hkV, wwV) {
    var W = 386, H = 160, c = [];
    c.push(T(14, 24, VAL, 15, null, 'AUSSENTEMPERATUR'));
    c.push('<text x="193" y="98" fill="' + VAL + '" ' + F + ' font-size="46" text-anchor="middle">'
        + (outdoor != null ? comma(outdoor, 1) : '–') + '<tspan font-size="22"> °C</tspan></text>');
    c.push(T(193, 134, LBL, 12, 'middle', 'Heizung: HK ' + (hkV != null ? Math.round(hkV) : '–') + ' % · WW ' + (wwV != null ? Math.round(wwV) : '–') + ' %'));
    return card(W, H, c.join(''));
}

// --- render + publish all cards --------------------------------------------
function renderAll() {
    setState('et_power_card', renderPower());
    setState('et_costs_card', renderCosts());
    setState('et_autarky_card', renderAutarky());
    var hkV = sam('heating_valve_signal'), wwV = sam('hotwater_valve_signal');
    setState('et_heizkreis_card', renderTempCard('HEIZKREIS',
        [['Vorlauf', sam('heating_flow_temperature')], ['Rücklauf', sam('heating_return_temperature')]], hkV));
    setState('et_warmwasser_card', renderTempCard('WARMWASSER',
        [['Speicher', sam('hotwater_storage_temperature')], ['Rücklauf', sam('hotwater_return_temperature')]], wwV));
    setState('et_outdoor_card', renderOutdoor(sam('outdoor_temperature'), hkV, wwV));
}

// --- 7-day autarky / self-consumption from InfluxDB ------------------------
function query7d() {
    sendTo('influxdb.0', 'query',
        'SELECT MEAN(Consumption) AS c, MEAN(Production) AS p, MEAN(SelfConsumption) AS s'
        + ' FROM home_monitoring.autogen.electricity_power_watt WHERE time > now() - 7d',
        function (res) {
            if (res.error) { console.error('energy_tab 7d: ' + res.error); renderAll(); return; }
            var r = (res.result && res.result[0] && res.result[0][0]) || null;
            if (r && r.c > 0) setState('rate_autarky_7d', Math.max(0, Math.min(1, r.s / r.c)));
            if (r && r.p > 0) setState('rate_selfconsumption_7d', Math.max(0, Math.min(1, r.s / r.p)));
            renderAll();
        });
}

// --- state setup (last createState triggers the first render) --------------
function htmlState(id) { return createState(id, '', { desc: id, type: 'string', role: 'html' }); }
htmlState('et_power_card');
htmlState('et_costs_card');
htmlState('et_autarky_card');
htmlState('et_heizkreis_card');
htmlState('et_warmwasser_card');
htmlState('et_outdoor_card');
createState('rate_autarky_7d', 0, { desc: 'Autarkiequote (7-Tage-Mittel)', type: 'number', role: 'value' });
createState('rate_selfconsumption_7d', 0, { desc: 'Eigenverbrauchsquote (7-Tage-Mittel)', type: 'number', role: 'value' }, function () {
    query7d();
});

// live: re-render the power card on every Shelly reading (~10s)
on({ id: 'javascript.0.mqtt_shelly.total_act_power', change: 'ne' }, function () {
    setState('et_power_card', renderPower());
});
// heating cards on sensor change
['heating_flow_temperature', 'heating_return_temperature', 'hotwater_storage_temperature',
 'hotwater_return_temperature', 'outdoor_temperature', 'heating_valve_signal', 'hotwater_valve_signal']
    .forEach(function (id) {
        on({ id: 'javascript.0.sam_digital.' + id, change: 'ne' }, renderAll);
    });

schedule('*/30 * * * * *', renderAll);   // all cards every 30 s
schedule('*/30 * * * *', query7d);        // refresh 7-day mean every 30 min
