// Energy tab v4 — three-tier layout (Jetzt → Heute → Kontext), live-review refinement of v3.
// The tab is the drill-down of the Overview's Energie card: identical entity names
// (Netz / Haus / SolarEdge / Maxxisun), watts() formatting, enRoleCol/priceBand/spectrum/
// energyFrame semantics. v4 fixes (owner review of the deployed v3, 2026-07-07):
//   Verlauf  — rolling 24h window, two totals only (Erzeugung area + Haus line, 30-min smoothing, FIXED 0-4 kW axis)
//              + a separate slim Maxxisun ±lane below the plot (liefert ↑ / lädt ↓)
//   Bilanz   — segmented balance bars on one shared kWh scale (Erzeugt = direkt+geladen+eingespeist;
//              Verbraucht = Solar+aus Akku+Netz) so autarky is VISIBLE and the balance closes;
//              + "Kosten heute · gespart" (the Tag row moved here from the Kosten card)
//   Heizung  — one roomy line per circuit
//   Kosten   — Monat/Jahr only, "bisher → Prognose · Vorperiode" rows
//   Preis    — native 15-min step-LINE, tier-colored via p20/p80 (guide lines); a line is
//              legitimate on a truncated axis — the v3 bars-from-0,20 baseline error is gone
// Concept + mockups: claude.ai/code/artifact/3ef9905f (session private-home-monitoring).
//
// Widgets on the vis Energy view (page margin 4px, gutter 12px, nav at y=688):
//   et3_flow   (4,4)     1170x158   et3_curve  (4,174)    778x292   et3_bilanz (792,174) 382x252
//   et3_heiz   (792,438)  382x110   et3_price  (4,478)    778x206   et3_period (792,564) 382x124
//
// Data: javascript.0.power_* (reconciled, solaredge_power.js), tibber_states.*, sam_digital.*,
// InfluxDB (adapter DB `iobroker` for the self-logged power curve; home_monitoring.autogen.
// electricity_price_forecast_euro for the 15-min forecast). NOTE Haus semantics:
// power_consumption EXCLUDES battery charging (solaredge_power.computeHybrid) — Maxxisun lädt
// can exceed Haus. Helpers copied 1:1 from main_v2.js until the shared vis_card.js global exists.

var EN = 'javascript.0.';
var FEEDIN_RATE = 0.1048;   // €/kWh feed-in tariff (same constant as main_v2 net €/h)

// ===== palette / tokens (ground truth, identical to main_v2) =====
var GREEN = '#b5fb5b', AMBER = '#F1BE3D', BLUE = '#5080AC', RED = '#A00629';
var TEXT = '#CCCCCC', LBL = '#8A8A8A', SURF = '#15161c', INSET = '#1c1f28', BORD = '#262a33';

var CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');
.et3{
  --bg:#0d0e12; --surface:#15161c; --inset:#1c1f28; --border:#262a33;
  --text:#CCCCCC; --muted:#8A8A8A;
  --green:#b5fb5b; --amber:#F1BE3D; --blue:#5080AC; --red:#A00629;
  box-sizing:border-box; background:var(--bg);
  font-family:'Figtree',system-ui,sans-serif; color:var(--text);
  -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums; overflow:hidden;
}
.et3 *{margin:0;padding:0;box-sizing:border-box}
.et3 .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;
  padding:12px 16px;display:flex;flex-direction:column;gap:8px;overflow:hidden;width:100%;height:100%}
.et3 .card-h{font-size:14px;font-weight:700;letter-spacing:.06em;color:var(--muted);
  text-transform:uppercase;padding-bottom:6px;border-bottom:1px solid var(--border);
  display:flex;justify-content:space-between;align-items:baseline;flex-shrink:0}
.et3 .card-h .bdg{font-size:11px;color:var(--muted);font-weight:500;letter-spacing:0;text-transform:none}
.et3 .u{font-size:13px;color:var(--muted);font-weight:500}
/* flow rows (Tier 1) */
.et3 .frow{display:flex;align-items:center;gap:12px}
.et3 .frow .fi{width:24px;display:flex;justify-content:center;flex-shrink:0}
.et3 .frow .fl{width:160px;font-size:15px;color:var(--text);flex-shrink:0;white-space:nowrap}
.et3 .frow .track{flex:1;height:8px;border-radius:4px;background:var(--inset);overflow:hidden}
.et3 .frow .fill{display:block;height:8px;border-radius:4px;min-width:2px}
.et3 .frow .fv{width:96px;text-align:right;font-size:20px;font-weight:700;white-space:nowrap;flex-shrink:0}
/* stat blocks (Tier-1 right) */
.et3 .stat{display:flex;flex-direction:column;gap:3px;align-items:flex-end}
.et3 .stat .sl{font-size:13px;color:var(--muted);white-space:nowrap}
.et3 .stat .sv{font-size:24px;font-weight:700;line-height:1;white-space:nowrap}
.et3 .stat .ss{font-size:12px;color:var(--muted);white-space:nowrap}
/* spectrum (price min-max, Overview component) */
.et3 .spec{width:150px;display:flex;flex-direction:column;gap:3px}
.et3 .spec .bar{height:5px;border-radius:3px;position:relative;
  background:linear-gradient(90deg,var(--green),var(--amber),var(--red));opacity:.82}
.et3 .spec .knob{position:absolute;top:50%;width:10px;height:10px;border-radius:50%;
  background:var(--text);border:2px solid var(--surface);transform:translate(-50%,-50%)}
.et3 .spec .mm{display:flex;justify-content:space-between;font-size:11px}
/* bilanz: segmented balance bars + chips */
.et3 .seg{height:14px;border-radius:7px;background:var(--inset);overflow:hidden;display:flex;gap:1px}
.et3 .seg span{display:block;height:14px}
.et3 .chips{display:flex;gap:12px;flex-wrap:wrap}
.et3 .chip{display:inline-flex;gap:5px;align-items:center;font-size:12px;color:var(--muted);white-space:nowrap}
.et3 .chip i{width:9px;height:9px;border-radius:2px;display:inline-block;flex-shrink:0}
/* heizung one-line rows — temps sit in fixed value|arrow|value columns so both lines align */
.et3 .hz{display:flex;align-items:center;gap:10px}
.et3 .hz .hn{width:104px;font-size:15px;color:var(--text);font-weight:600;flex-shrink:0}
.et3 .hz .ht{flex:1;display:flex;align-items:baseline;justify-content:flex-end;font-size:14px;color:var(--muted);white-space:nowrap;overflow:hidden}
.et3 .hz .ht .t1{width:58px;text-align:right}
.et3 .hz .ht .ta{width:18px;text-align:center}
.et3 .hz .ht .t2{width:58px;text-align:right}
.et3 .hz .hb{width:44px;height:5px;border-radius:3px;background:var(--inset);overflow:hidden;flex-shrink:0}
.et3 .hz .hv{width:58px;text-align:right;font-size:15px;font-weight:600;flex-shrink:0}
/* kosten rows — fixed right-aligned value columns: label | bisher | → | Prognose | Vorperiode */
.et3 .kr{display:flex;align-items:baseline;gap:8px}
.et3 .kr .kl{width:52px;font-size:15px;color:var(--muted);flex-shrink:0}
.et3 .kr .kv{width:72px;text-align:right;font-size:17px;font-weight:600;white-space:nowrap;flex-shrink:0}
.et3 .kr .ka{width:16px;text-align:center;font-size:13px;color:var(--muted);flex-shrink:0}
.et3 .kr .kp{margin-left:auto;font-size:14px;color:var(--muted);white-space:nowrap}
/* bilanz bottom rows — label | value | note columns, same table grammar as the other right cards */
.et3 .brow{display:flex;align-items:baseline;gap:8px}
.et3 .brow .bl{width:104px;font-size:15px;color:var(--muted);flex-shrink:0}
.et3 .brow .bv{width:84px;text-align:right;white-space:nowrap;flex-shrink:0}
.et3 .brow .bn{margin-left:auto;font-size:12px;color:var(--muted);white-space:nowrap;text-align:right}
`;

// ===== helpers (verbatim semantics from main_v2.js — consolidate into vis_card.js later) =====
function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function tibber(id) { return sNum(EN + 'tibber_states.' + id); }
function sam(id) { return sNum(EN + 'sam_digital.' + id); }
function comma(v, d) { return (typeof v === 'number') ? v.toFixed(d == null ? 1 : d).replace('.', ',') : '–'; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function watts(v) { var a = Math.abs(v || 0); return a >= 1000 ? comma(a / 1000, 1) + '<span class="u"> kW</span>' : Math.round(a) + '<span class="u"> W</span>'; }
function kwh1(v) { return v == null ? '–' : comma(v, 1); }
function eur2(v) { return v == null ? '–' : comma(v, 2) + ' €'; }
function enRoleCol(val, favourable, high) {
    var m = Math.abs(val || 0);
    if (favourable) return m < 75 ? LBL : GREEN;
    if (m < 150) return LBL;
    return m < (high || 2000) ? AMBER : RED;
}
function priceBand(price, p20, p80) {
    if (price == null || p20 == null || p80 == null) return { band: -1, col: LBL };
    var band = price <= p20 ? 0 : (price >= p80 ? 2 : 1);
    return { band: band, col: [GREEN, AMBER, RED][band] };
}
var COST_NEUTRAL = 0.05;
function energyFrame(net, price, p80) {
    if (-net > COST_NEUTRAL) return GREEN;
    if (Math.abs(net) <= COST_NEUTRAL) return LBL;
    return (price != null && p80 != null && price >= p80) ? RED : AMBER;
}
function frameStyle(c) {
    if (c === GREEN) return 'border-color:rgba(181,251,91,.55);box-shadow:0 0 0 1px rgba(181,251,91,.16)';
    if (c === AMBER) return 'border-color:rgba(241,190,61,.6);box-shadow:0 0 0 1px rgba(241,190,61,.16)';
    if (c === RED) return 'border-color:rgba(160,6,41,.85);box-shadow:0 0 0 1px rgba(160,6,41,.22)';
    return '';
}
function enIco(kind, col, sz) {
    sz = sz || 22;
    var g = '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 18 18"><g stroke="' + col + '" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">';
    if (kind === 'sun') g += '<circle cx="9" cy="9" r="3.4"/><line x1="9" y1="1.5" x2="9" y2="3.4"/><line x1="9" y1="14.6" x2="9" y2="16.5"/><line x1="1.5" y1="9" x2="3.4" y2="9"/><line x1="14.6" y1="9" x2="16.5" y2="9"/><line x1="4" y1="4" x2="5.3" y2="5.3"/><line x1="12.7" y1="12.7" x2="14" y2="14"/><line x1="14" y1="4" x2="12.7" y2="5.3"/><line x1="5.3" y1="12.7" x2="4" y2="14"/>';
    else if (kind === 'battery') g += '<rect x="2" y="5" width="13" height="8" rx="1.6"/><line x1="15.5" y1="7.5" x2="15.5" y2="10.5" stroke-width="2.4"/>';
    else if (kind === 'grid') g += '<line x1="3" y1="15" x2="6" y2="3"/><line x1="15" y1="15" x2="12" y2="3"/><line x1="6" y1="3" x2="12" y2="3"/><line x1="4.5" y1="9" x2="13.5" y2="9"/>';
    else if (kind === 'house') g += '<path d="M2 8 L9 2 L16 8"/><rect x="4.5" y="8" width="9" height="7" rx="1"/>';
    return g + '</g></svg>';
}
function spectrum(knobPct, lo, hi) {
    return '<div class="spec"><div class="bar"><div class="knob" style="left:' + knobPct.toFixed(0) + '%"></div></div>'
        + '<div class="mm"><span style="color:' + GREEN + '">' + lo + '</span><span style="color:' + RED + '">' + hi + '</span></div></div>';
}
// Pi OS runs Europe/London; the household clock is Europe/Berlin
function berlinNow() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })); }
function dayKeyBerlin(dt) { return (dt || new Date()).toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }); }
function berlinParts(ts) {
    var d = new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    return { h: d.getHours(), m: d.getMinutes(), frac: d.getHours() + d.getMinutes() / 60, dow: d.getDay(), date: d.getDate() };
}
var DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function fo(w, h, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
        + '<foreignObject width="' + w + '" height="' + h + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml" class="et3" style="width:' + w + 'px;height:' + h + 'px">'
        + '<style>' + CSS + '</style>' + body + '</div></foreignObject></svg>';
}
function cardH(title, badge) {
    return '<div class="card-h"><span>' + title + '</span>' + (badge ? '<span class="bdg">' + badge + '</span>' : '') + '</div>';
}

// ===== TIER 1: ENERGIEFLUSS · JETZT (1170x158) =====
function buildFlow() {
    var prod = sNum(EN + 'power_production') || 0, haus = sNum(EN + 'power_consumption') || 0;
    var pur = sNum(EN + 'power_purchased') || 0, feed = sNum(EN + 'power_feedin') || 0;
    var maxxi = sNum(EN + 'power_maxxisun') || 0, selfc = sNum(EN + 'power_selfconsumption') || 0;
    var staleS = getState(EN + 'power_data_stale'), stale = !!(staleS && staleS.val === true);
    var price = tibber('energy_price_euro'), p20 = tibber('energy_price_euro_p20'), p80 = tibber('energy_price_euro_p80');
    var pMin = tibber('energy_price_euro_min'), pMax = tibber('energy_price_euro_max');
    var se = Math.max(0, prod - Math.max(0, -maxxi));   // SolarEdge-only, like main_v2
    var grid = pur - feed;

    var rows = [
        { ico: 'grid', label: 'Netz' + (Math.abs(grid) >= 75 ? (grid > 0 ? ' · Bezug' : ' · Einspeisung') : ''), val: grid, col: enRoleCol(grid, grid < 0) },
        { ico: 'house', label: 'Haus', val: haus, col: stale ? LBL : enRoleCol(haus, false), approx: stale },
        { ico: 'sun', label: 'SolarEdge', val: se, col: enRoleCol(se, true) },
        { ico: 'battery', label: 'Maxxisun' + (Math.abs(maxxi) >= 75 ? (maxxi < 0 ? ' · lädt' : ' · liefert') : ''), val: maxxi, col: enRoleCol(maxxi, maxxi < 0, 500) }
    ];
    var maxV = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.val); }).concat([1]));
    var flows = '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly;padding:0 4px">'
        + rows.map(function (r) {
            var frac = clamp01(Math.abs(r.val) / maxV) * 100;
            return '<div class="frow"><span class="fi">' + enIco(r.ico, r.col) + '</span>'
                + '<span class="fl">' + r.label + '</span>'
                + '<span class="track"><span class="fill" style="width:' + frac.toFixed(0) + '%;background:' + r.col + '"></span></span>'
                + '<span class="fv" style="color:' + r.col + '">' + (r.approx ? '≈ ' : '') + watts(r.val) + '</span></div>';
        }).join('') + '</div>';

    var net = grid > 0 ? grid / 1000 * (price || 0) : grid / 1000 * FEEDIN_RATE;
    var netZero = Math.abs(net) < 0.005, netSign = netZero ? '' : (net < 0 ? '+' : '−');
    var fc = energyFrame(net, price, p80);
    if (grid > 50 && !(price != null && price > 0)) fc = AMBER;
    var netCol = netZero ? LBL : fc;
    var gespart = (selfc / 1000) * (price || 0);
    var pb = priceBand(price, p20, p80);
    var priceBlock = '<div class="stat"><span class="sl">Strompreis</span>'
        + '<span class="sv" style="color:' + pb.col + '">' + comma(price, 2) + '<span class="u"> €/kWh</span></span>'
        + ((pMin != null && pMax != null && pMax > pMin)
            ? spectrum(clamp01(((price || 0) - pMin) / (pMax - pMin)) * 100, comma(pMin, 2), comma(pMax, 2))
            : '<span class="ss">&nbsp;</span>')
        + '</div>';
    function stat(l, v, u, s, c) {
        return '<div class="stat"><span class="sl">' + l + '</span><span class="sv" style="color:' + c + '">' + v
            + '<span class="u"> ' + u + '</span></span><span class="ss">' + s + '</span></div>';
    }
    var stats = '<div style="display:flex;align-items:center;gap:26px;padding:0 4px 0 18px;flex-shrink:0">'
        + priceBlock
        + stat('Netto', netSign + comma(Math.abs(net), 2), '€/h', grid >= 0 ? 'Bezug' : 'Einspeisung', netCol)
        + stat('Eigenverbrauch gespart', comma(gespart, 2), '€/h', 'vs. Netzbezug', gespart > 0.01 ? GREEN : LBL)
        + '</div>';

    var body = '<div class="card" style="' + frameStyle(fc) + '">'
        + cardH('Energiefluss · Jetzt', stale ? '≈ Schätzwert (Cloud-Verzögerung)' : '')
        + '<div style="flex:1;display:flex;align-items:stretch;gap:14px">' + flows
        + '<div style="width:1px;background:' + BORD + ';flex-shrink:0"></div>' + stats + '</div></div>';
    return fo(1170, 158, body);
}

// ===== energy_today_* — trapezoid integration, Berlin-midnight reset =====
var INTEGRALS = [
    ['production',    function () { return sNum(EN + 'power_production') || 0; }],
    ['consumption',   function () { return sNum(EN + 'power_consumption') || 0; }],
    ['purchased',     function () { return sNum(EN + 'power_purchased') || 0; }],
    ['feedin',        function () { return sNum(EN + 'power_feedin') || 0; }],
    ['maxxicharge',   function () { return Math.max(0, -(sNum(EN + 'power_maxxisun') || 0)); }],
    ['maxxidischarge', function () { return Math.max(0, (sNum(EN + 'power_maxxisun') || 0)); }]
];
var _lastTick = null;
function integrateTick() {
    var today = dayKeyBerlin();
    var dayS = getState(EN + 'energy_today_day');
    if (!dayS || dayS.val !== today) {
        INTEGRALS.forEach(function (e) { setState(EN + 'energy_today_' + e[0], 0, true); });
        setState(EN + 'energy_today_day', today, true);
        _lastTick = Date.now();
        return;
    }
    var now = Date.now();
    var dtH = _lastTick ? (now - _lastTick) / 3600000 : 0;
    _lastTick = now;
    if (dtH <= 0 || dtH > 0.5) return;   // skip absurd gaps (script pause/restart)
    INTEGRALS.forEach(function (e) {
        var cur = sNum(EN + 'energy_today_' + e[0]) || 0;
        setState(EN + 'energy_today_' + e[0], cur + e[1]() / 1000 * dtH, true);
    });
}

// ===== TIER 2 RIGHT: HEUTE · BILANZ (382x252) — segmented balance bars =====
function buildBilanz() {
    var prod = sNum(EN + 'energy_today_production') || 0, cons = sNum(EN + 'energy_today_consumption') || 0;
    var pur = sNum(EN + 'energy_today_purchased') || 0, feed = sNum(EN + 'energy_today_feedin') || 0;
    var chg = sNum(EN + 'energy_today_maxxicharge') || 0, dis = sNum(EN + 'energy_today_maxxidischarge') || 0;
    var price = tibber('energy_price_euro');
    // reconciled segments (clamped ≥0 so rounding noise can't create negative slivers)
    var eDirekt = Math.max(0, prod - chg - feed);            // Erzeugung direkt genutzt
    var vSolar = Math.max(0, cons - pur - dis);              // Verbrauch aus Solar direkt
    var KMAX = Math.max(prod, cons, 0.1);
    function seg(kwhL, col, op) {
        var w = clamp01(kwhL / KMAX) * 100;
        return w <= 0 ? '' : '<span style="width:' + w.toFixed(1) + '%;background:' + col + ';opacity:' + op + '"></span>';
    }
    function chip(col, op, label) {
        return '<span class="chip"><i style="background:' + col + ';opacity:' + op + '"></i>' + label + '</span>';
    }
    function barBlock(label, total, valCol, segs, chips) {
        return '<div style="display:flex;flex-direction:column;gap:5px">'
            + '<div style="display:flex;justify-content:space-between;align-items:baseline">'
            + '<span style="font-size:15px;color:' + LBL + '">' + label + '</span>'
            + '<span style="font-size:18px;font-weight:600;color:' + valCol + '">' + kwh1(total)
            + '<span class="u"> kWh</span></span></div>'
            + '<div class="seg">' + segs + '</div>'
            + '<div class="chips">' + chips + '</div></div>';
    }
    var autark = cons > 0.05 ? clamp01(1 - pur / cons) : null;
    var akPct = autark != null ? Math.round(autark * 100) : null;
    var akCol = akPct == null ? LBL : (akPct >= 75 ? GREEN : (akPct >= 40 ? AMBER : LBL));
    var a7 = sNum(EN + 'rate_autarky_7d');
    var bezahlt = tibber('cost_this_day');
    var gespart = price != null ? Math.max(0, (cons - pur)) * price : null;

    var body = '<div class="card">' + cardH('Heute · Bilanz')
        + '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding-top:4px">'
        + barBlock('Erzeugt', prod, GREEN,
            seg(eDirekt, GREEN, '1') + seg(chg, GREEN, '.55') + seg(feed, GREEN, '.28'),
            chip(GREEN, '1', 'direkt genutzt ' + kwh1(eDirekt)) + chip(GREEN, '.55', 'geladen ' + kwh1(chg)) + chip(GREEN, '.28', 'eingespeist ' + kwh1(feed)))
        + barBlock('Verbraucht', cons, BLUE,
            seg(vSolar, GREEN, '1') + seg(dis, BLUE, '.6') + seg(pur, AMBER, '1'),
            chip(GREEN, '1', 'Solar ' + kwh1(vSolar)) + chip(BLUE, '.6', 'aus Akku ' + kwh1(dis)) + chip(AMBER, '1', 'Netz ' + kwh1(pur)))
        + '<div style="border-top:1px solid ' + BORD + '"></div>'
        + '<div class="brow"><span class="bl">autark</span>'
        + '<span class="bv" style="font-size:26px;font-weight:700;color:' + akCol + '">' + (akPct != null ? akPct : '–') + '<span class="u"> %</span></span>'
        + '<span class="bn">' + (a7 != null && a7 > 0 ? 'Ø 7 Tage: ' + Math.round(a7 * 100) + ' %' : '&nbsp;') + '</span></div>'
        + '<div class="brow"><span class="bl">Kosten heute</span>'
        + '<span class="bv" style="font-size:16px;font-weight:600;color:' + TEXT + '">' + eur2(bezahlt) + '</span>'
        + '<span class="bn">' + (gespart != null && gespart > 0.005 ? '<span style="color:' + GREEN + ';font-weight:600">' + eur2(gespart) + ' gespart</span>' : '&nbsp;') + '</span></div>'
        + '</div></div>';
    return fo(382, 252, body);
}

// ===== TIER 2 LEFT: VERLAUF · 24 H (778x292) — totals + Maxxisun lane, rolling window =====
var CURVE = { t0: null, prod: [], cons: [], mx: [], ready: false };
function rollMean(rows, win) {
    return rows.map(function (r, i) {
        var s = 0, n = 0;
        for (var j = Math.max(0, i - win + 1); j <= i; j++) { s += rows[j].v; n++; }
        return { h: r.h, v: s / n };
    });
}
function queryCurve() {
    var ids = ['javascript.0.power_production', 'javascript.0.power_consumption', 'javascript.0.power_maxxisun'];
    var out = [[], [], []], done = 0;
    ids.forEach(function (id, i) {
        sendTo('influxdb.0', 'query',
            'SELECT MEAN("value") AS v FROM "' + id + '" WHERE time >= now() - 26h GROUP BY time(10m) fill(none)',
            function (result) {
                if (!result.error && result.result && result.result[0]) out[i] = result.result[0];
                if (++done === 3) {
                    var t0 = Date.now() - 24 * 3600e3;   // rolling 24h window — the plot is always full
                    function windowed(rows) {
                        var w = rows.filter(function (r) { return r.v != null && r.ts >= t0; })
                            .map(function (r) { return { h: (r.ts - t0) / 3600e3, v: r.v }; });
                        return rollMean(w, 3);   // 30-min smoothing over the 10-min means
                    }
                    CURVE = { t0: t0, prod: windowed(out[0]), cons: windowed(out[1]), mx: windowed(out[2]), ready: true };
                    setState(EN + 'et3_curve', buildCurve(), true);
                }
            });
    });
}
function buildCurve() {
    var W = 778, H = 292, PW = 700, X0 = 36;
    var MY = 8, MH = 140;              // main plot
    var LY = MY + MH + 24, LH = 38;    // Maxxisun lane
    var prod = CURVE.prod, cons = CURVE.cons, mx = CURVE.mx;
    var legend = '<span class="bdg" style="display:inline-flex;gap:14px;align-items:center">'
        + '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:3px;background:' + GREEN + ';border-radius:2px;display:inline-block"></span>Erzeugung</span>'
        + '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:3px;background:' + BLUE + ';border-radius:2px;display:inline-block"></span>Haus</span>'
        + '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:1px;height:10px;background:' + TEXT + ';display:inline-block"></span>jetzt</span></span>';
    var head = cardH('Verlauf · 24 h').replace('</div>', legend + '</div>');
    if (!CURVE.ready || (prod.length < 2 && cons.length < 2)) {
        return fo(W, H, '<div class="card">' + head
            + '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:' + LBL + ';font-size:14px">'
            + (CURVE.ready ? 'Warte auf Verlaufsdaten…' : 'Lade Verlauf…') + '</div></div>');
    }
    // fixed frame: 4 kW unless the data genuinely exceeds it
    var dMax = Math.max.apply(null, prod.concat(cons).map(function (r) { return r.v; }).concat([1]));
    var YMAX = Math.max(4, Math.ceil(dMax / 1000));
    var lMax = Math.max.apply(null, mx.map(function (r) { return Math.abs(r.v); }).concat([250]));
    var LMAX = Math.max(0.5, Math.ceil(lMax / 500) * 0.5);   // lane scale in kW, 0.5 steps
    function sx(h) { return X0 + h / 24 * PW; }
    function syM(w) { return MY + MH - clamp01((w / 1000) / YMAX) * MH; }
    function syL(w) { return LY + LH / 2 - Math.max(-1, Math.min(1, (w / 1000) / LMAX)) * (LH / 2); }
    function path(rows, sy) { return 'M' + rows.map(function (r) { return sx(r.h).toFixed(1) + ',' + sy(r.v).toFixed(1); }).join(' L'); }
    var prodP = path(prod, syM);
    var prodA = prodP + ' L' + sx(prod[prod.length - 1].h).toFixed(1) + ',' + syM(0).toFixed(1)
        + ' L' + sx(prod[0].h).toFixed(1) + ',' + syM(0).toFixed(1) + ' Z';
    var consP = cons.length > 1 ? path(cons, syM) : '';
    var laneP = mx.length > 1 ? path(mx, syL) : '';
    var laneA = mx.length > 1 ? laneP + ' L' + sx(mx[mx.length - 1].h).toFixed(1) + ',' + syL(0).toFixed(1)
        + ' L' + sx(mx[0].h).toFixed(1) + ',' + syL(0).toFixed(1) + ' Z' : '';

    var grid = '', k;
    for (k = 1; k <= YMAX; k++) {
        grid += '<line x1="' + X0 + '" y1="' + syM(k * 1000).toFixed(1) + '" x2="' + (X0 + PW) + '" y2="' + syM(k * 1000).toFixed(1) + '" stroke="' + INSET + '" stroke-width="1"/>'
            + '<text x="' + (X0 - 8) + '" y="' + (syM(k * 1000) + 4).toFixed(1) + '" fill="' + LBL + '" font-size="11" text-anchor="end">' + k + (k === YMAX ? ' kW' : '') + '</text>';
    }
    // clock ticks at real Berlin hours divisible by 6; midnight gets the price chart's
    // dashed day-boundary treatment so both time axes speak the same language.
    var ticks = '', tw0 = CURVE.t0 || (Date.now() - 24 * 3600e3);
    for (var tm = Math.ceil(tw0 / 3600e3) * 3600e3; tm <= tw0 + 24 * 3600e3; tm += 3600e3) {
        var bp = berlinParts(tm);
        if (bp.h % 6 !== 0) continue;
        var bx = sx((tm - tw0) / 3600e3);
        if (bp.h === 0) {
            ticks += '<line x1="' + bx.toFixed(0) + '" y1="' + MY + '" x2="' + bx.toFixed(0) + '" y2="' + (LY + LH + 4) + '" stroke="' + LBL + '" stroke-width="1" stroke-dasharray="2 3"/>';
        }
        ticks += '<text x="' + bx.toFixed(0) + '" y="' + (LY + LH + 15) + '" fill="' + LBL + '" font-size="11" text-anchor="middle">' + ('0' + bp.h).slice(-2) + '</text>';
    }

    var lastP = prod[prod.length - 1], lastC = cons.length ? cons[cons.length - 1] : null;
    var lastM = mx.length ? mx[mx.length - 1] : null;
    var nowH = Math.max(lastP.h, lastC ? lastC.h : 0), nowX = sx(nowH);
    var flip = nowX > X0 + PW - 175;
    var tx = (flip ? nowX - 9 : nowX + 9).toFixed(1), ta = flip ? ' text-anchor="end"' : '';
    // collision-safe endpoint labels (≥20 px apart)
    var yP = syM(lastP.v) - 8, yC = lastC ? syM(lastC.v) + 16 : 0;
    if (lastC && Math.abs(yP - yC) < 20) yC = yP + 20;
    var lbl = '<line x1="' + nowX.toFixed(1) + '" y1="' + (MY - 2) + '" x2="' + nowX.toFixed(1) + '" y2="' + (LY + LH) + '" stroke="' + TEXT + '" stroke-width="1" opacity="0.5" stroke-dasharray="3 3"/>'
        + '<circle cx="' + nowX.toFixed(1) + '" cy="' + syM(lastP.v).toFixed(1) + '" r="4" fill="' + GREEN + '" stroke="' + SURF + '" stroke-width="2"/>'
        + '<text x="' + tx + '" y="' + yP.toFixed(1) + '" fill="' + GREEN + '" font-size="13" font-weight="600"' + ta + '>Erzeugung ' + comma(lastP.v / 1000, 1) + ' kW</text>';
    if (lastC) {
        lbl += '<circle cx="' + nowX.toFixed(1) + '" cy="' + syM(lastC.v).toFixed(1) + '" r="4" fill="' + BLUE + '" stroke="' + SURF + '" stroke-width="2"/>'
            + '<text x="' + tx + '" y="' + yC.toFixed(1) + '" fill="' + BLUE + '" font-size="13" font-weight="600"' + ta + '>Haus ' + comma(lastC.v / 1000, 1) + ' kW</text>';
    }
    // lane chrome + endpoint
    var lane = '<line x1="' + X0 + '" y1="' + syL(0).toFixed(1) + '" x2="' + (X0 + PW) + '" y2="' + syL(0).toFixed(1) + '" stroke="' + LBL + '" stroke-width="1" opacity="0.5"/>'
        + '<text x="' + (X0 + 8) + '" y="' + (LY + 12) + '" fill="' + LBL + '" font-size="11" font-weight="600">Maxxisun</text>'
        + '<text x="' + (X0 + PW - 8) + '" y="' + (LY + 12) + '" fill="' + LBL + '" font-size="10" text-anchor="end">liefert ↑</text>'
        + '<text x="' + (X0 + PW - 8) + '" y="' + (LY + LH - 2) + '" fill="' + LBL + '" font-size="10" text-anchor="end">lädt ↓</text>';
    if (mx.length > 1) {
        lane += '<path d="' + laneA + '" fill="' + GREEN + '" opacity="0.25"/>'
            + '<path d="' + laneP + '" fill="none" stroke="' + GREEN + '" stroke-width="1.5"/>';
        if (lastM && Math.abs(lastM.v) >= 75) {
            var word = lastM.v < 0 ? 'lädt' : 'liefert';
            lane += '<circle cx="' + sx(lastM.h).toFixed(1) + '" cy="' + syL(lastM.v).toFixed(1) + '" r="3.5" fill="' + GREEN + '" stroke="' + SURF + '" stroke-width="2"/>'
                + '<text x="' + tx + '" y="' + (syL(lastM.v) + 4).toFixed(1) + '" fill="' + GREEN + '" font-size="12" font-weight="600"' + ta + '>' + word + ' ' + comma(Math.abs(lastM.v) / 1000, 1) + ' kW</text>';
        }
    }
    var svg = '<svg width="' + (PW + X0 + 10) + '" height="' + (LY + LH + 20) + '" style="flex:1">'
        + grid + ticks
        + '<path d="' + prodA + '" fill="' + GREEN + '" opacity="0.13"/>'
        + '<path d="' + prodP + '" fill="none" stroke="' + GREEN + '" stroke-width="2.5"/>'
        + (consP ? '<path d="' + consP + '" fill="none" stroke="' + BLUE + '" stroke-width="2.5"/>' : '')
        + lane + lbl + '</svg>';
    return fo(W, H, '<div class="card">' + head + '<div style="flex:1;display:flex;align-items:stretch">' + svg + '</div></div>');
}

// ===== HEIZUNG (382x110) — one line per circuit =====
function buildHeiz() {
    var hkV = sam('heating_valve_signal'), wwV = sam('hotwater_valve_signal');
    var hkF = sam('heating_flow_temperature'), hkR = sam('heating_return_temperature');
    var wwS = sam('hotwater_storage_temperature');
    function row(name, temps, v) {
        var on = v != null && v > 5, col = on ? AMBER : LBL, pct = v != null ? Math.round(v) : 0;
        return '<div class="hz"><span class="hn">' + name + '</span>'
            + '<span class="ht">' + temps + '</span>'
            + '<span class="hb"><span style="display:block;height:5px;width:' + pct + '%;background:' + col + '"></span></span>'
            + '<span class="hv" style="color:' + col + '">' + (v != null ? pct : '–') + ' %</span></div>';
    }
    var body = '<div class="card">' + cardH('Heizung', 'Ventil')
        + '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly">'
        + row('Heizkreis', '<span class="t1">' + comma(hkF, 1) + '°</span><span class="ta">→</span><span class="t2">' + comma(hkR, 1) + '°</span>', hkV)
        + row('Warmwasser', '<span class="t1">Speicher</span><span class="ta"></span><span class="t2">' + comma(wwS, 1) + '°</span>', wwV)
        + '</div></div>';
    return fo(382, 110, body);
}

// ===== STROMPREIS · VORSCHAU (778x206) — native 15-min step-line =====
var FORECAST = { rows: [], ready: false };
function queryForecast() {
    sendTo('influxdb.0', 'query',
        'SELECT * FROM home_monitoring.autogen.electricity_price_forecast_euro WHERE time >= now() - 90m ORDER BY time ASC LIMIT 300',
        function (result) {
            if (!result.error && result.result && result.result[0]) {
                FORECAST = { rows: result.result[0].filter(function (r) { return typeof r.total === 'number'; }), ready: true };
            } else { FORECAST.ready = true; }
            setState(EN + 'et3_price', buildPrice(), true);
        });
}
function buildPrice() {
    var W = 778, H = 206;
    var price = tibber('energy_price_euro'), p20 = tibber('energy_price_euro_p20'), p80 = tibber('energy_price_euro_p80');
    var badge = 'jetzt <span style="color:' + priceBand(price, p20, p80).col + ';font-weight:700">' + comma(price, 2) + ' €/kWh</span>'
        + '&nbsp;&nbsp;·&nbsp;&nbsp;15-min-Preise&nbsp;&nbsp;·&nbsp;&nbsp;<span style="color:' + GREEN + '">■</span> günstig&nbsp;&nbsp;'
        + '<span style="color:' + AMBER + '">■</span> mittel&nbsp;&nbsp;<span style="color:' + RED + '">■</span> teuer';
    var head = cardH('Strompreis · Vorschau', badge);
    var rows = FORECAST.rows;
    if (rows.length < 8) {
        return fo(W, H, '<div class="card">' + head
            + '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:' + LBL + ';font-size:14px">'
            + (FORECAST.ready ? 'Keine Vorschau-Daten' : 'Lade Vorschau…') + '</div></div>');
    }
    var SW = 700, SH = 96, SX0 = 36, SY0 = 8;
    var t0 = rows[0].ts, t1 = rows[rows.length - 1].ts + 900e3;
    var vals = rows.map(function (r) { return r.total; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var axLo = Math.floor(lo * 20) / 20, axHi = Math.ceil(hi * 20) / 20;
    if (axHi - axLo < 0.05) axHi = axLo + 0.05;
    function qx(ts) { return SX0 + (ts - t0) / (t1 - t0) * SW; }
    function qy(p) { return SY0 + SH - (p - axLo) / (axHi - axLo) * SH; }
    var nowMs = Date.now();
    // step-line: horizontal segment per quarter, vertical connector to the next; past dimmed
    var segs = '', areaPts = [];
    rows.forEach(function (r, i) {
        var x0 = qx(r.ts), x1 = qx(r.ts + 900e3), y = qy(r.total);
        var col = (p20 != null && r.total <= p20) ? GREEN : ((p80 != null && r.total >= p80) ? RED : AMBER);
        var op = (r.ts + 900e3 <= nowMs) ? '0.4' : '1';
        segs += '<line x1="' + x0.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + x1.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + col + '" stroke-width="2.5" opacity="' + op + '"/>';
        if (i + 1 < rows.length && Math.abs(rows[i + 1].total - r.total) > 0.0005) {
            segs += '<line x1="' + x1.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + x1.toFixed(1) + '" y2="' + qy(rows[i + 1].total).toFixed(1) + '" stroke="' + col + '" stroke-width="1" opacity="' + (op * 0.6 || 0.24) + '"/>';
        }
        areaPts.push(x0.toFixed(1) + ',' + y.toFixed(1)); areaPts.push(x1.toFixed(1) + ',' + y.toFixed(1));
    });
    var area = 'M' + areaPts.join(' L') + ' L' + qx(t1).toFixed(1) + ',' + qy(axLo).toFixed(1) + ' L' + qx(t0).toFixed(1) + ',' + qy(axLo).toFixed(1) + ' Z';
    // ticks + day boundary (Berlin)
    var ticks = '', boundary = '';
    rows.forEach(function (r) {
        var b = berlinParts(r.ts);
        if (b.m !== 0) return;
        if (b.h === 0) {
            boundary += '<line x1="' + qx(r.ts).toFixed(0) + '" y1="' + (SY0 - 2) + '" x2="' + qx(r.ts).toFixed(0) + '" y2="' + (SY0 + SH + 4) + '" stroke="' + LBL + '" stroke-width="1" stroke-dasharray="2 3"/>'
                + '<text x="' + (qx(r.ts) + 4).toFixed(0) + '" y="' + (SY0 + SH + 16) + '" fill="' + TEXT + '" font-size="11" font-weight="600">' + DAYS_SHORT[b.dow] + ' ' + b.date + '.</text>';
        } else if (b.h % 6 === 0) {
            ticks += '<text x="' + qx(r.ts).toFixed(0) + '" y="' + (SY0 + SH + 16) + '" fill="' + LBL + '" font-size="11" text-anchor="middle">' + ('0' + b.h).slice(-2) + '</text>';
        }
    });
    // cheapest future 4h window (16 quarter-hours)
    var futStart = 0;
    while (futStart < rows.length && rows[futStart].ts + 900e3 <= nowMs) futStart++;
    var WINQ = 16, bestI = -1, bestAvg = Infinity;
    for (var s = futStart; s + WINQ <= rows.length; s++) {
        var sum = 0; for (var q = s; q < s + WINQ; q++) sum += rows[q].total;
        if (sum / WINQ < bestAvg) { bestAvg = sum / WINQ; bestI = s; }
    }
    var cheap = '';
    if (bestI >= 0) {
        var cx0 = qx(rows[bestI].ts), cx1 = qx(rows[bestI].ts + WINQ * 900e3);
        var b0 = berlinParts(rows[bestI].ts), b1 = berlinParts(rows[bestI].ts + WINQ * 900e3);
        var cFlip = cx1 + 165 > SX0 + SW;
        cheap = '<rect x="' + cx0.toFixed(0) + '" y="' + (SY0 + SH + 21) + '" width="' + (cx1 - cx0).toFixed(0) + '" height="3" rx="1.5" fill="' + GREEN + '"/>'
            + '<text x="' + (cFlip ? (cx0 - 8).toFixed(0) : (cx1 + 8).toFixed(0)) + '" y="' + (SY0 + SH + 27) + '" fill="' + GREEN + '" font-size="11"' + (cFlip ? ' text-anchor="end"' : '') + '>günstig '
            + ('0' + b0.h).slice(-2) + (b0.m ? ':' + ('0' + b0.m).slice(-2) : '') + '–'
            + ('0' + b1.h).slice(-2) + (b1.m ? ':' + ('0' + b1.m).slice(-2) : '') + ' · Ø ' + comma(bestAvg, 2) + ' €</text>';
    }
    var nowX = Math.max(SX0, Math.min(SX0 + SW, qx(nowMs)));
    var nowM = '<line x1="' + nowX.toFixed(0) + '" y1="' + (SY0 - 2) + '" x2="' + nowX.toFixed(0) + '" y2="' + (SY0 + SH) + '" stroke="' + TEXT + '" stroke-width="1.5"/>'
        + '<text x="' + (nowX + 5).toFixed(0) + '" y="' + (SY0 + 9) + '" fill="' + TEXT + '" font-size="11" font-weight="600">jetzt</text>';
    var guides = (p20 != null && p20 >= axLo && p20 <= axHi ? '<line x1="' + SX0 + '" y1="' + qy(p20).toFixed(1) + '" x2="' + (SX0 + SW) + '" y2="' + qy(p20).toFixed(1) + '" stroke="' + GREEN + '" stroke-width="1" opacity="0.25" stroke-dasharray="3 4"/>' : '')
        + (p80 != null && p80 >= axLo && p80 <= axHi ? '<line x1="' + SX0 + '" y1="' + qy(p80).toFixed(1) + '" x2="' + (SX0 + SW) + '" y2="' + qy(p80).toFixed(1) + '" stroke="' + RED + '" stroke-width="1" opacity="0.25" stroke-dasharray="3 4"/>' : '');
    var svg = '<svg width="' + (SW + SX0 + 10) + '" height="' + (SH + SY0 + 34) + '" style="flex:1">'
        + '<text x="' + (SX0 - 8) + '" y="' + (SY0 + 10) + '" fill="' + LBL + '" font-size="11" text-anchor="end">' + comma(axHi, 2) + '</text>'
        + '<text x="' + (SX0 - 8) + '" y="' + (SY0 + SH) + '" fill="' + LBL + '" font-size="11" text-anchor="end">' + comma(axLo, 2) + '</text>'
        + '<path d="' + area + '" fill="' + AMBER + '" opacity="0.06"/>'
        + guides + segs + boundary + ticks + cheap + nowM + '</svg>';
    return fo(W, H, '<div class="card">' + head + '<div style="flex:1;display:flex">' + svg + '</div></div>');
}

// ===== KOSTEN · NETZBEZUG (382x124) — Monat/Jahr, bisher → Prognose · Vorperiode =====
function buildPeriod() {
    var b = berlinNow();
    var daysInMonth = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    var dayFrac = (b.getHours() + b.getMinutes() / 60) / 24;
    var mElapsed = (b.getDate() - 1 + dayFrac) / daysInMonth;
    var yDays = ((b.getFullYear() % 4 === 0 && b.getFullYear() % 100 !== 0) || b.getFullYear() % 400 === 0) ? 366 : 365;
    var yElapsed = ((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(b.getFullYear(), 0, 1)) / 86400000 + dayFrac) / yDays;
    function fmtProg(v) { return v == null ? '–' : (v >= 100 ? Math.round(v) + ' €' : eur2(v)); }
    function krow(label, period, frac, vorLabel) {
        var cur = tibber('cost_this_' + period), prev = tibber('cost_last_' + period);
        var prog = (cur != null && frac > 0.1) ? cur / frac : null;   // suppressed early in the period
        var pCol = (prog == null || prev == null || prev <= 0.01) ? TEXT : (prog < prev ? GREEN : (prog > prev * 1.05 ? AMBER : TEXT));
        return '<div class="kr"><span class="kl">' + label + '</span>'
            + '<span class="kv" style="color:' + TEXT + '">' + eur2(cur) + '</span>'
            + '<span class="ka">→</span>'
            + '<span class="kv" style="color:' + pCol + '">' + fmtProg(prog) + '</span>'
            + '<span class="kp">' + vorLabel + ' ' + (prev != null ? (prev >= 100 ? Math.round(prev) + ' €' : eur2(prev)) : '–') + '</span></div>';
    }
    var prevMonth = MONTHS[(b.getMonth() + 11) % 12];
    var body = '<div class="card">' + cardH('Kosten · Netzbezug', 'bisher → Prognose · Vorperiode')
        + '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly">'
        + krow('Monat', 'month', mElapsed, prevMonth)
        + krow('Jahr', 'year', yElapsed, (b.getFullYear() - 1) + ':')
        + '</div></div>';
    return fo(382, 124, body);
}

// ===== publish =====
function renderFast() {
    setState(EN + 'et3_flow', buildFlow(), true);
    setState(EN + 'et3_heiz', buildHeiz(), true);
}
function renderSlow() {
    setState(EN + 'et3_bilanz', buildBilanz(), true);
    setState(EN + 'et3_period', buildPeriod(), true);
}

// ===== state bootstrap =====
['et3_flow', 'et3_curve', 'et3_bilanz', 'et3_heiz', 'et3_price', 'et3_period'].forEach(function (id) {
    createState(EN + id, '', { type: 'string', role: 'html', desc: 'Energie-Tab et3 ' + id });
});
INTEGRALS.forEach(function (e) {
    createState(EN + 'energy_today_' + e[0], 0, { type: 'number', role: 'value.energy', unit: 'kWh', desc: 'Tages-kWh ' + e[0] + ' (Trapez-Integration)' });
});
createState(EN + 'energy_today_day', '', { type: 'string', role: 'value', desc: 'Berlin-Tag der energy_today_* Integration' }, function () {
    _lastTick = Date.now();
    setTimeout(function () { integrateTick(); renderFast(); renderSlow(); queryCurve(); queryForecast(); }, 2000);
});

// ===== subscriptions & schedules =====
['power_production', 'power_consumption', 'power_purchased', 'power_feedin', 'power_maxxisun',
 'power_selfconsumption', 'power_data_stale', 'tibber_states.energy_price_euro'].forEach(function (s) {
    on({ id: EN + s, change: 'ne' }, renderFast);
});
['sam_digital.heating_valve_signal', 'sam_digital.hotwater_valve_signal',
 'sam_digital.heating_flow_temperature', 'sam_digital.hotwater_storage_temperature'].forEach(function (s) {
    on({ id: EN + s, change: 'ne' }, function () { setState(EN + 'et3_heiz', buildHeiz(), true); });
});
['cost_this_day', 'cost_this_month', 'cost_this_year',
 'cost_last_month', 'cost_last_year'].forEach(function (s) {
    on({ id: EN + 'tibber_states.' + s, change: 'ne' }, renderSlow);
});
schedule('* * * * *', function () { integrateTick(); renderSlow(); });
schedule('*/5 * * * *', function () { queryCurve(); queryForecast(); });
schedule('*/30 * * * * *', renderFast);
console.log('[Energie v4] initialized');
