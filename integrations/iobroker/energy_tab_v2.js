// Energy tab v4 — three-tier layout (Jetzt → Heute → Kontext), live-review refinement of v3.
// The tab is the drill-down of the Overview's Energie card: identical entity names
// (Netz / Haus / SolarEdge / Maxxisun), watts() formatting, enRoleCol/priceBand/spectrum/
// energyFrame semantics. v4 fixes (owner review of the deployed v3, 2026-07-07):
//   Verlauf  — rolling 24h window, 30-min smoothing; Erzeugung (green), Haus (white) and Akku (blue, feeding
//              in above zero, charging below) on ONE kW axis (0–4 kW unless exceeded), no text in the plot
//   Bilanz   — segmented balance bars on one shared kWh scale (Erzeugt = direkt+geladen+eingespeist;
//              Verbraucht = Solar+aus Akku+Netz) so autarky is VISIBLE and the balance closes;
//              + "Kosten heute · gespart" (the Tag row moved here from the Kosten card)
//   Heizung  — a ribbon beside the nav (2026-10-31), the two circuits stacked
//   Kosten   — 13-month bars as the main figure; month line (vs. same month last year + usage/price split) above, year line below
//   Preis    — native 15-min step-LINE, tier-colored via p20/p80 (guide lines); a line is
//              legitimate on a truncated axis — the v3 bars-from-0,20 baseline error is gone
// Concept + mockups: claude.ai/code/artifact/3ef9905f (session private-home-monitoring).
//
// Widgets on the vis Energy view (page margin 4px, gutter 12px, nav at y=688):
//   et3_flow   (4,4)     1170x158   et3_curve  (4,174)    516x246   et3_period (532,174) 642x302
//   et3_price  (4,432)    516x244   et3_bilanz (532,488)  642x188   et3_heiz   (408,688) 766x87 (ribbon beside the nav)
//
// Data: javascript.0.power_* (reconciled, solaredge_power.js), tibber_states.*, sam_digital.*,
// InfluxDB (adapter DB `iobroker` for the self-logged power curve; home_monitoring.autogen.
// electricity_price_forecast_euro for the 15-min forecast). NOTE Haus semantics:
// power_consumption EXCLUDES battery charging (solaredge_power.computeHybrid) — Maxxisun lädt
// can exceed Haus. Helpers copied 1:1 from main_v2.js until the shared vis_card.js global exists.

var EN = 'javascript.0.';
var FEEDIN_RATE = 0.1048;   // €/kWh feed-in tariff (same constant as main_v2 net €/h)

// ===== palette — derived from the shared canonical VC_PAL (vis_card.js). One source, board-wide. =====
var GREEN = VC_PAL.good, AMBER = VC_PAL.warn, BLUE = VC_PAL.cold, RED = VC_PAL.alarm;
var TEXT = VC_PAL.text, LBL = VC_PAL.muted, SURF = VC_PAL.surf, INSET = VC_PAL.inset, BORD = VC_PAL.border;

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
/* takeaway block (Tier-1 right, first column): where the month is heading */
.et3 .take{display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.et3 .take .tl{font-size:13px;color:var(--muted);white-space:nowrap}
.et3 .take .tv{font-size:30px;font-weight:700;line-height:1;white-space:nowrap}
.et3 .take .ts{font-size:13px;font-weight:600;white-space:nowrap}
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
.et3 .rib-h{font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;width:150px;flex-shrink:0}
.et3 .hzcol{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;align-self:stretch}
.et3 .hzcol .hz .hb{width:260px}
.et3 .hz{flex:1;display:flex;align-items:center;gap:8px;min-width:0}
.et3 .hz .hn{width:92px;font-size:15px;color:var(--text);font-weight:600;flex-shrink:0}
.et3 .hz .ht{flex:1;display:flex;align-items:baseline;justify-content:flex-end;font-size:14px;color:var(--muted);white-space:nowrap;overflow:hidden}
.et3 .hz .ht .t1{width:52px;text-align:right}
.et3 .hz .ht .ta{width:18px;text-align:center}
.et3 .hz .ht .t2{width:52px;text-align:right}
.et3 .hz .hb{width:40px;height:5px;border-radius:3px;background:var(--inset);overflow:hidden;flex-shrink:0}
.et3 .hz .hv{width:48px;text-align:right;font-size:15px;font-weight:600;flex-shrink:0}
/* kosten — one summary line per period (label · forecast · change · bisher) around the main figure */
.et3 .ksum,.et3 .kyear{display:flex;align-items:baseline;gap:12px;flex-shrink:0}
.et3 .kl{font-size:14px;color:var(--muted);width:40px;flex-shrink:0}
.et3 .kv{font-size:26px;font-weight:700;line-height:1;white-space:nowrap}
.et3 .kyear .kv{font-size:18px}
.et3 .kd{font-size:14px;font-weight:600;white-space:nowrap}
.et3 .kb{margin-left:auto;font-size:13px;color:var(--muted);white-space:nowrap}
.et3 .kk{font-size:12px;color:var(--muted);margin:-4px 0 0 52px;flex-shrink:0}
/* 13-month chart, the card's main figure: past months muted, last year's month white,
   this month bisher solid inside its forecast tint; every bar carries its amount */
.et3 .mchart{flex:1;display:flex;min-height:0}
.et3 .mbars{flex:1;display:flex;gap:8px;align-items:stretch}
.et3 .mcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.et3 .mslot{flex:1;width:100%;display:flex;padding-top:18px}
.et3 .mplot{position:relative;flex:1;display:flex;align-items:flex-end}
.et3 .yl{position:absolute;left:-4px;right:-4px;height:0;border-top:2px dashed var(--text);opacity:.55}
.et3 .mb{position:relative;width:100%;border-radius:3px 3px 0 0}
.et3 .mb.past{background:var(--muted);opacity:.45}
.et3 .mb.past .mv{color:var(--muted)}
.et3 .mb.yoy{background:var(--text);opacity:.85}
.et3 .mb .mbp{position:absolute;left:0;right:0;top:0;bottom:0;border-radius:3px 3px 0 0;opacity:.35}
.et3 .mb .mbd{position:absolute;left:0;right:0;bottom:0;border-radius:3px 3px 0 0}
.et3 .mb .mv{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);padding-bottom:3px;font-size:12px;font-weight:600;white-space:nowrap;color:var(--text)}
.et3 .mm{font-size:11px;color:var(--muted)}
/* bilanz bottom rows — label | value | note columns, same table grammar as the other right cards */
.et3 .brow{display:flex;align-items:baseline;gap:8px}
.et3 .brow .bl{flex:1;font-size:15px;color:var(--muted)}
.et3 .brow .bv{text-align:right;white-space:nowrap;flex-shrink:0}
.et3 .bn{font-size:12px;color:var(--muted);white-space:nowrap;text-align:right;margin-top:-6px}
`;

// ===== helpers — now sourced from the shared global vis_card.js (script.js.global.vis_card).
// The pure formatters are direct aliases; the colour/verdict helpers are thin wrappers that bind
// this tab's hex PALette to the global's semantic classifiers, so the thresholds live in ONE place
// (VC.*) and can no longer drift from the Overview. Only stateful reads stay local. =====
var PAL = VC_PAL;
var DAYS_SHORT = VC_DAYS_SHORT, MONTHS = VC_MONTHS;

function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function tibber(id) { return sNum(EN + 'tibber_states.' + id); }
function sam(id) { return sNum(EN + 'sam_digital.' + id); }
var comma = vcComma, clamp01 = vcClamp01, watts = vcWatts, kwh1 = vcKwh1, eur2 = vcEur2;
var enIco = vcEnIco;
var berlinNow = vcBerlinNow, dayKeyBerlin = vcDayKey, berlinParts = vcBerlinParts;
function enRoleCol(val, favourable, high) { return vcSemColor(PAL, vcRoleSem(val, favourable, high)); }
function priceBand(price, p20, p80) { var s = vcPriceSem(price, p20, p80); return { band: s.band, col: vcSemColor(PAL, s.sem), word: s.word }; }
function energyFrame(net, price, p80) { return vcSemColor(PAL, vcEnergyFrameSem(net, price, p80)); }
function frameStyle(sem) { return vcFrameStyle(sem); }   // takes a sem token now (see buildFlow)
function spectrum(price, q) { return vcSpectrum(PAL, price, q); }
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
// the tab's one-line takeaway: where the month is heading, with the Kosten card's verdict
function takeaway(b) {
    var m = monthStats(b), month = MONTHS[b.getMonth()];
    var early = m.prog == null, col = early ? TEXT : m.col;
    var sub = !early && m.yoy ? change(m.pct) + ' vs. Vorjahr' : '&nbsp;';
    return '<div class="take"><span class="tl">' + month + (early ? ' bisher' : ' auf Kurs') + '</span>'
        + '<span class="tv" style="color:' + col + '">' + (early ? (m.cur != null ? Math.round(m.cur) : '–') : Math.round(m.prog))
        + '<span class="u"> €</span></span>'
        + '<span class="ts" style="color:' + col + '">' + sub + '</span></div>';
}
function buildFlow() {
    var prod = sNum(EN + 'power_production') || 0, haus = sNum(EN + 'power_consumption') || 0;
    var pur = sNum(EN + 'power_purchased') || 0, feed = sNum(EN + 'power_feedin') || 0;
    var maxxi = sNum(EN + 'power_maxxisun') || 0;
    var staleS = getState(EN + 'power_data_stale'), stale = !!(staleS && staleS.val === true);
    var price = tibber('energy_price_euro'), p20 = tibber('energy_price_euro_p20'), p80 = tibber('energy_price_euro_p80');
    var pMin = tibber('energy_price_euro_min'), pMax = tibber('energy_price_euro_max');
    var pq = { min: pMin, max: pMax, p20: p20, p50: tibber('energy_price_euro_p50'), p80: p80 };
    var se = Math.max(0, prod - Math.max(0, -maxxi));   // SolarEdge-only, like main_v2
    var grid = pur - feed;
    // direction word from the shared convention (vis_card): negative = speist, positive = lädt.
    // Never re-derive the sign here — doing so is what made this row read "liefert" while the
    // battery was charging. The colour argument below is separate and already correct.
    var mxWord = vcMaxxiWord(maxxi);

    var rows = [
        { ico: 'grid', label: 'Netz' + (Math.abs(grid) >= 75 ? (grid > 0 ? ' · Bezug' : ' · Einspeisung') : ''), val: grid, col: enRoleCol(grid, grid < 0) },
        { ico: 'house', label: 'Haus', val: haus, col: stale ? LBL : enRoleCol(haus, false), approx: stale },
        { ico: 'sun', label: 'SolarEdge', val: se, col: enRoleCol(se, true) },
        { ico: 'battery', label: 'Maxxisun' + (mxWord ? ' · ' + mxWord : ''), val: maxxi, col: enRoleCol(maxxi, maxxi < 0, 500) }
    ];
    var maxV = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.val); }).concat([1]));
    var flows = '<div class="flows" style="width:520px;flex-shrink:0;display:flex;flex-direction:column;justify-content:space-evenly;padding:0 4px">'
        + rows.map(function (r) {
            var frac = clamp01(Math.abs(r.val) / maxV) * 100;
            return '<div class="frow"><span class="fi">' + enIco(r.ico, r.col) + '</span>'
                + '<span class="fl">' + r.label + '</span>'
                + '<span class="track"><span class="fill" style="width:' + frac.toFixed(0) + '%;background:' + r.col + '"></span></span>'
                + '<span class="fv" style="color:' + r.col + '">' + (r.approx ? '≈ ' : '') + watts(r.val) + '</span></div>';
        }).join('') + '</div>';

    var net = grid > 0 ? grid / 1000 * (price || 0) : grid / 1000 * FEEDIN_RATE;
    var netZero = Math.abs(net) < 0.005, netSign = vcNetCostSign(net);
    var fcSem = vcEnergyFrameSem(net, price, p80);
    if (grid > 50 && !(price != null && price > 0)) fcSem = 'warn';   // importing w/o price ≠ break-even
    var fc = vcSemColor(PAL, fcSem);
    var netCol = netZero ? LBL : fc;
    var pb = priceBand(price, p20, p80);
    var priceBlock = '<div class="stat"><span class="sl">Strompreis</span>'
        + '<span class="sv" style="color:' + pb.col + '">' + comma(price, 2) + '<span class="u"> €/kWh</span></span>'
        + ((pMin != null && pMax != null && pMax > pMin)
            ? spectrum(price, pq)
            : '<span class="ss">&nbsp;</span>')
        + '</div>';
    function stat(l, v, u, s, c) {
        return '<div class="stat"><span class="sl">' + l + '</span><span class="sv" style="color:' + c + '">' + v
            + '<span class="u"> ' + u + '</span></span><span class="ss">' + s + '</span></div>';
    }
    var stats = '<div class="stats" style="flex:1;display:grid;grid-template-columns:230px 200px 160px;justify-content:space-evenly;align-items:center">'
        + takeaway(berlinNow())
        + priceBlock
        + stat('Netto', netSign + comma(Math.abs(net), 2), '€/h', grid >= 0 ? 'Bezug' : 'Einspeisung', netCol)
        + '</div>';

    var body = '<div class="card" style="' + frameStyle(fcSem) + '">'
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
    // Charging is POSITIVE power, delivering NEGATIVE — vis_card owns that split so it cannot be
    // re-derived the wrong way round again (these two were feeding each other's counter, which
    // put the battery's charge in the discharge total and skewed both Bilanz bars).
    ['maxxicharge',   function () { return vcMaxxiSplit(sNum(EN + 'power_maxxisun')).charge; }],
    ['maxxidischarge', function () { return vcMaxxiSplit(sNum(EN + 'power_maxxisun')).discharge; }]
];
var _lastTick = null;
// the last seven finished days' totals, logged at midnight, for the Bilanz "Ø 7 Tage" autarky
var DAYS_ID = EN + 'energy_days';
function loggedDays() {
    var s = getState(DAYS_ID);
    try { var days = JSON.parse((s && s.val) || '[]'); return Array.isArray(days) ? days : []; } catch (e) { return []; }
}
function logDay(day) {
    var days = loggedDays().filter(function (d) { return d.day !== day; });
    days.push({ day: day, cons: sNum(EN + 'energy_today_consumption') || 0, pur: sNum(EN + 'energy_today_purchased') || 0 });
    setState(DAYS_ID, JSON.stringify(days.slice(-7)), true);
}
function autarkyOfDays() {
    var days = loggedDays().filter(function (d) { return d.cons > 0.05; });
    if (!days.length) return null;
    var cons = 0, pur = 0;
    days.forEach(function (d) { cons += d.cons; pur += d.pur; });
    return { pct: Math.round(clamp01(1 - pur / cons) * 100), n: days.length };
}
function integrateTick() {
    var today = dayKeyBerlin();
    var dayS = getState(EN + 'energy_today_day');
    if (!dayS || dayS.val !== today) {
        if (dayS && dayS.val) logDay(dayS.val);
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

// ===== TIER 2 RIGHT: HEUTE · BILANZ (642x188) — segmented balance bars left, autarky + cost right =====
// One colour per quantity across the tab, the same as the curve: green = own solar, white = Haus,
// blue = Akku (charged / drawn), amber = Netz.
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
    // judged against the recent days, not fixed thresholds: green when today beats them. Never amber —
    // until the evening, a running day always trails whole days (the night is all grid).
    var autark = cons > 0.05 ? clamp01(1 - pur / cons) : null;
    var akPct = autark != null ? Math.round(autark * 100) : null;
    var avg = autarkyOfDays();
    var akCol = akPct == null ? LBL : (avg && akPct >= avg.pct ? GREEN : TEXT);
    var bezahlt = tibber('cost_this_day');
    var gespart = price != null ? Math.max(0, (cons - pur)) * price : null;

    var body = '<div class="card">' + cardH('Heute · Bilanz')
        + '<div style="flex:1;display:flex;gap:20px;min-height:0">'
        + '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly;min-width:0">'
        + barBlock('Erzeugt', prod, GREEN,
            seg(eDirekt, GREEN, '1') + seg(chg, BLUE, '.8') + seg(feed, GREEN, '.28'),
            chip(GREEN, '1', 'direkt genutzt ' + kwh1(eDirekt)) + chip(BLUE, '.8', 'geladen ' + kwh1(chg)) + chip(GREEN, '.28', 'eingespeist ' + kwh1(feed)))
        + barBlock('Verbraucht', cons, TEXT,
            seg(vSolar, GREEN, '1') + seg(dis, BLUE, '.8') + seg(pur, AMBER, '1'),
            chip(GREEN, '1', 'Solar ' + kwh1(vSolar)) + chip(BLUE, '.8', 'aus Akku ' + kwh1(dis)) + chip(AMBER, '1', 'Netz ' + kwh1(pur)))
        + '</div>'
        + '<div style="width:1px;background:' + BORD + ';flex-shrink:0"></div>'
        + '<div style="width:180px;flex-shrink:0;display:flex;flex-direction:column;justify-content:space-evenly">'
        + '<div class="brow"><span class="bl">autark</span>'
        + '<span class="bv" style="font-size:26px;font-weight:700;color:' + akCol + '">' + (akPct != null ? akPct : '–') + '<span class="u"> %</span></span></div>'
        + '<div class="bn">' + (avg ? 'Ø ' + avg.n + ' Tage: ' + avg.pct + ' %' : '&nbsp;') + '</div>'
        + '<div class="brow"><span class="bl">Kosten heute</span>'
        + '<span class="bv" style="font-size:16px;font-weight:600;color:' + TEXT + '">' + eur2(bezahlt) + '</span></div>'
        + '<div class="bn">' + (gespart != null && gespart > 0.005 ? '<span style="color:' + GREEN + ';font-weight:600">' + eur2(gespart) + ' gespart</span>' : '&nbsp;') + '</div>'
        + '</div></div></div>';
    return fo(642, 188, body);
}

// ===== TIER 2 LEFT: VERLAUF · 24 H (516x246) — totals + Maxxisun lane, rolling window =====
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
    var W = 516, H = 246, PW = W - 78, X0 = 36, MY = 8, MH = 150;
    var prod = CURVE.prod, cons = CURVE.cons;
    // power_maxxisun is negative while the battery feeds in — flipped so feeding in rises above zero
    // like Erzeugung, and charging dips below it, on the same kW scale as the other two series
    var akku = CURVE.mx.map(function (r) { return { h: r.h, v: -r.v }; });
    function swatch(col, label) {
        return '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:3px;background:'
            + col + ';border-radius:2px;display:inline-block"></span>' + label + '</span>';
    }
    var legend = '<span class="bdg" style="display:inline-flex;gap:14px;align-items:center">'
        + swatch(GREEN, 'Erzeugung') + swatch(TEXT, 'Haus') + swatch(BLUE, 'Akku') + '</span>';
    var head = cardH('Verlauf · 24 h').replace('</div>', legend + '</div>');
    if (!CURVE.ready || (prod.length < 2 && cons.length < 2)) {
        return fo(W, H, '<div class="card">' + head
            + '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:' + LBL + ';font-size:14px">'
            + (CURVE.ready ? 'Warte auf Verlaufsdaten…' : 'Lade Verlauf…') + '</div></div>');
    }
    // one frame for all series: 0–4 kW unless the data exceeds it, extended below zero in 0,5 kW
    // steps only as far as the battery actually charged
    var all = prod.concat(cons, akku).map(function (r) { return r.v / 1000; });
    var YMAX = Math.max(4, Math.ceil(Math.max.apply(null, all.concat([1]))));
    var YMIN = Math.min(0, Math.floor(Math.min.apply(null, all.concat([0])) * 2) / 2);
    function sx(h) { return X0 + h / 24 * PW; }
    function sy(w) { return MY + MH - ((w / 1000) - YMIN) / (YMAX - YMIN) * MH; }
    function path(rows) { return 'M' + rows.map(function (r) { return sx(r.h).toFixed(1) + ',' + sy(r.v).toFixed(1); }).join(' L'); }

    var grid = '', k;
    for (k = Math.ceil(YMIN); k <= YMAX; k++) {
        if (k === 0) continue;
        grid += '<line x1="' + X0 + '" y1="' + sy(k * 1000).toFixed(1) + '" x2="' + (X0 + PW) + '" y2="' + sy(k * 1000).toFixed(1) + '" stroke="' + INSET + '" stroke-width="1"/>'
            + '<text x="' + (X0 - 8) + '" y="' + (sy(k * 1000) + 4).toFixed(1) + '" fill="' + LBL + '" font-size="11" text-anchor="end">' + k + (k === YMAX ? ' kW' : '') + '</text>';
    }
    var zero = '<line class="zero" x1="' + X0 + '" y1="' + sy(0).toFixed(1) + '" x2="' + (X0 + PW) + '" y2="' + sy(0).toFixed(1) + '" stroke="' + LBL + '" stroke-width="1" opacity="0.6"/>'
        + '<text x="' + (X0 - 8) + '" y="' + (sy(0) + 4).toFixed(1) + '" fill="' + LBL + '" font-size="11" text-anchor="end">0</text>';
    // clock ticks at real Berlin hours divisible by 6; midnight dashed, like the price chart
    var ticks = '', tw0 = CURVE.t0 || (Date.now() - 24 * 3600e3);
    for (var tm = Math.ceil(tw0 / 3600e3) * 3600e3; tm <= tw0 + 24 * 3600e3; tm += 3600e3) {
        var bp = berlinParts(tm);
        if (bp.h % 6 !== 0) continue;
        var bx = sx((tm - tw0) / 3600e3);
        if (bp.h === 0) {
            ticks += '<line x1="' + bx.toFixed(0) + '" y1="' + MY + '" x2="' + bx.toFixed(0) + '" y2="' + (MY + MH + 4) + '" stroke="' + LBL + '" stroke-width="1" stroke-dasharray="2 3"/>';
        }
        ticks += '<text x="' + bx.toFixed(0) + '" y="' + (MY + MH + 17) + '" fill="' + LBL + '" font-size="11" text-anchor="middle">' + ('0' + bp.h).slice(-2) + '</text>';
    }
    function line(rows, col) {
        if (rows.length < 2) return '';
        var last = rows[rows.length - 1];
        return '<path d="' + path(rows) + '" fill="none" stroke="' + col + '" stroke-width="2.5"/>'
            + '<circle cx="' + sx(last.h).toFixed(1) + '" cy="' + sy(last.v).toFixed(1) + '" r="4" fill="' + col + '" stroke="' + SURF + '" stroke-width="2"/>';
    }
    var area = prod.length > 1 ? '<path d="' + path(prod) + ' L' + sx(prod[prod.length - 1].h).toFixed(1) + ',' + sy(0).toFixed(1)
        + ' L' + sx(prod[0].h).toFixed(1) + ',' + sy(0).toFixed(1) + ' Z" fill="' + GREEN + '" opacity="0.13"/>' : '';
    var svg = '<svg width="' + (PW + X0 + 10) + '" height="' + (MY + MH + 22) + '" style="flex:1">'
        + grid + ticks + zero + area + line(prod, GREEN) + line(akku, BLUE) + line(cons, TEXT) + '</svg>';
    return fo(W, H, '<div class="card">' + head + '<div style="flex:1;display:flex;align-items:stretch">' + svg + '</div></div>');
}

// ===== HEIZUNG (766x87) — a ribbon beside the nav, where the Overview keeps its HAUS ribbon =====
function buildHeiz() {
    var hkV = sam('heating_valve_signal'), wwV = sam('hotwater_valve_signal');
    var hkF = sam('heating_flow_temperature'), hkR = sam('heating_return_temperature');
    var wwS = sam('hotwater_storage_temperature');
    function circuit(name, temps, v) {
        var on = v != null && v > 5, col = on ? AMBER : LBL, pct = v != null ? Math.round(v) : 0;
        return '<div class="hz"><span class="hn">' + name + '</span>'
            + '<span class="ht">' + temps + '</span>'
            + '<span class="hb"><span style="display:block;height:5px;width:' + pct + '%;background:' + col + '"></span></span>'
            + '<span class="hv" style="color:' + col + '">' + (v != null ? pct : '–') + ' %</span></div>';
    }
    var body = '<div class="card" style="flex-direction:row;align-items:center;gap:24px;padding:8px 20px">'
        + '<div class="rib-h">Heizung · Ventil</div>'
        + '<div class="hzcol">'
        + circuit('Heizkreis', '<span class="t1">' + comma(hkF, 1) + '°</span><span class="ta">→</span><span class="t2">' + comma(hkR, 1) + '°</span>', hkV)
        + circuit('Warmwasser', '<span class="t1">Speicher</span><span class="ta"></span><span class="t2">' + comma(wwS, 1) + '°</span>', wwV)
        + '</div></div>';
    return fo(766, 87, body);
}

// ===== STROMPREIS · VORSCHAU (516x244) — native 15-min step-line =====
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
    var W = 516, H = 244;
    var p20 = tibber('energy_price_euro_p20'), p80 = tibber('energy_price_euro_p80');
    // the current price already leads the Energiefluss card — the header keeps only the tier legend
    var badge = '<span style="color:' + GREEN + '">■</span> günstig&nbsp;&nbsp;'
        + '<span style="color:' + AMBER + '">■</span> mittel&nbsp;&nbsp;<span style="color:' + RED + '">■</span> teuer';
    var head = cardH('Strompreis · Vorschau', badge);
    var rows = FORECAST.rows;
    if (rows.length < 8) {
        return fo(W, H, '<div class="card">' + head
            + '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:' + LBL + ';font-size:14px">'
            + (FORECAST.ready ? 'Keine Vorschau-Daten' : 'Lade Vorschau…') + '</div></div>');
    }
    var SW = W - 78, SH = 140, SX0 = 36, SY0 = 8;
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

// ===== KOSTEN · NETZBEZUG (642x302) — month vs. the same month last year, year forecast, 13 months =====
// A month is judged against the same month a year earlier: against the month before, every autumn month
// looked alarming (October always costs more than September — less sun). Costs are Tibber's energy
// cost without the monthly base fee, the basis this_month/this_year have always used.
// HIST = the 12 completed months before this one ({ monthKey: { cost, kwh } }), read daily as the
// last_month value stored at the start of each following month. first(): the backfilled ex-tax value
// sits at 00:00 UTC on the 1st, ahead of the gross totalCost the collector stored until 2026-10-31.
// The year forecast is what's spent so far + the rest of this month + LAST year's remaining months —
// a linear extrapolation underestimates the autumn (Oct 2026: 305 € linear vs. ~447 €).
var HIST = null, HIST_KEY = null;
function monthKey(b) { return b.getFullYear() * 12 + b.getMonth(); }
function monthStart(mk) { return Math.floor(mk / 12) + '-' + ('0' + (mk % 12 + 1)).slice(-2) + '-01T00:00:00Z'; }
function queryMonthHistory() {
    var key = monthKey(berlinNow()), hist = {}, got = 0;
    for (var back = 12; back >= 1; back--) {
        (function (mk) {
            var start = monthStart(mk + 1);
            var where = " WHERE period = 'last_month' AND time >= '" + start + "' AND time < '" + start + "' + 5d";
            sendTo('influxdb.0', 'query',
                'SELECT first(cost) AS cost FROM home_monitoring.autogen.electricity_costs_euro' + where
                + '; SELECT first(consumption) AS kwh FROM home_monitoring.autogen.electricity_consumption_kwh' + where + " AND source = 'grid'",
                function (result) {
                    var res = (!result.error && result.result) || [];
                    var c = res[0] && res[0][0], k = res[1] && res[1][0];
                    hist[mk] = {
                        cost: c && typeof c.cost === 'number' ? c.cost : null,
                        kwh: k && typeof k.kwh === 'number' ? k.kwh : null
                    };
                    if (++got < 12) return;
                    HIST = hist;
                    HIST_KEY = key;
                    setState(EN + 'et3_period', buildPeriod(), true);
                    setState(EN + 'et3_flow', buildFlow(), true);   // the takeaway needs last year's month
                });
        })(key - back);
    }
}
function histOf(mk, b) { return HIST && HIST_KEY === monthKey(b) && HIST[mk] ? HIST[mk] : { cost: null, kwh: null }; }
function eur0(v) { return v == null ? '–' : Math.round(v) + ' €'; }
function shortMonth(mk) { return MONTHS[mk % 12].slice(0, 3); }
function verdictCol(prog, prev) { return prog < prev ? GREEN : (prog > prev * 1.05 ? AMBER : TEXT); }
function change(pct) { return pct === 0 ? '± 0 %' : (pct > 0 ? '▲ ' : '▼ ') + Math.abs(pct) + ' %'; }
function pctOf(now, before) { return Math.round((now / before - 1) * 100); }

// the month in one place: the Kosten card and the Energiefluss headline read the same verdict
function monthStats(b) {
    var key = monthKey(b);
    var daysInMonth = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    var elapsed = (b.getDate() - 1 + (b.getHours() + b.getMinutes() / 60) / 24) / daysInMonth;
    var cur = tibber('cost_this_month'), kwh = tibber('consumption_grid_this_month');
    var prog = (cur != null && elapsed > 0.1) ? cur / elapsed : null;   // suppressed early in the month
    var kwhProg = (kwh != null && elapsed > 0.1) ? kwh / elapsed : null;
    var ly = histOf(key - 12, b);
    var s = { key: key, cur: cur, prog: prog, col: TEXT, deltaCol: LBL, delta: '', usage: '' };
    if (ly.cost != null && ly.cost > 0.01) {
        s.prev = ly.cost;
        s.yoy = true;
        if (prog != null) {
            s.col = verdictCol(prog, ly.cost);
            s.deltaCol = s.col;
            s.pct = pctOf(prog, ly.cost);
            s.delta = change(s.pct) + ' vs. ' + shortMonth(key) + ' ' + String((Math.floor(key / 12) - 1) % 100) + ' · ' + eur0(ly.cost);
            if (kwhProg != null && kwhProg > 0 && ly.kwh != null && ly.kwh > 0) {
                s.usage = 'Verbrauch ' + change(pctOf(kwhProg, ly.kwh))
                    + ' · Ø-Preis ' + change(pctOf(prog / kwhProg, ly.cost / ly.kwh));
            }
        }
        return s;
    }
    var prevCost = histOf(key - 1, b).cost;
    s.prev = prevCost != null ? prevCost : tibber('cost_last_month');
    if (prog != null && s.prev != null && s.prev > 0.01) {
        s.delta = change(pctOf(prog, s.prev)) + ' vs. ' + shortMonth(key - 1) + ' · ' + eur0(s.prev);
    }
    return s;
}
function yearForecast(b, curYear, monthProg) {
    if (curYear == null) return null;
    var key = monthKey(b), lyKey = key - 12, rest = 0;
    var thisMonth = monthProg != null ? monthProg : histOf(lyKey, b).cost;
    if (thisMonth == null) return null;
    for (var mk = lyKey + 1; mk % 12 !== 0; mk++) {
        var c = histOf(mk, b).cost;
        if (c == null) return null;   // never a partial sum
        rest += c;
    }
    return curYear + Math.max(0, thisMonth - (tibber('cost_this_month') || 0)) + rest;
}
function yearStats(b, monthProg) {
    var yDays = ((b.getFullYear() % 4 === 0 && b.getFullYear() % 100 !== 0) || b.getFullYear() % 400 === 0) ? 366 : 365;
    var yElapsed = ((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(b.getFullYear(), 0, 1)) / 86400000
        + (b.getHours() + b.getMinutes() / 60) / 24) / yDays;
    var cur = tibber('cost_this_year'), prev = tibber('cost_last_year');
    var prog = yearForecast(b, cur, monthProg);
    if (prog == null && cur != null && yElapsed > 0.1) prog = cur / yElapsed;
    var s = { cur: cur, prog: prog, prev: prev, col: TEXT, deltaCol: LBL, delta: '', usage: '' };
    if (prog != null && prev != null && prev > 0.01) {
        s.col = verdictCol(prog, prev);
        s.deltaCol = s.col;
        s.delta = change(pctOf(prog, prev)) + ' vs. ' + (b.getFullYear() - 1) + ' · ' + eur0(prev);
    }
    return s;
}
// one period as one line: label · forecast in its verdict colour · change · "bisher" right
function costLine(cls, label, s) {
    return '<div class="' + cls + '"><span class="kl">' + label + '</span>'
        + '<span class="kv" style="color:' + s.col + '">' + eur0(s.prog) + '</span>'
        + (s.delta ? '<span class="kd" style="color:' + s.deltaCol + '">' + s.delta + '</span>' : '')
        + '<span class="kb">bisher ' + eur0(s.cur) + '</span></div>';
}
// the card's main figure: the 13 months from the same month last year up to this one, every bar with
// its amount. Past months muted, last year's month white, this month bisher solid in its forecast tint.
function monthChart(b, m) {
    var key = monthKey(b), cols = [], maxV = 0;
    for (var mk = key - 12; mk <= key; mk++) {
        var v = mk === key ? (m.prog != null ? m.prog : m.cur) : histOf(mk, b).cost;
        cols.push({ mk: mk, v: v });
        if (v != null) maxV = Math.max(maxV, v);
    }
    function h(v) { return maxV > 0 ? Math.max(2, v / maxV * 100).toFixed(1) : '0'; }
    // last year's month as a dashed line across every bar: above it dearer than a year ago, below it cheaper
    var lyCost = cols[0].v, yl = lyCost != null ? '<span class="yl" style="bottom:' + h(lyCost) + '%"></span>' : '';
    var bars = cols.map(function (c) {
        var bar;
        if (c.mk === key) {
            bar = '<div class="mb now" style="height:' + h(c.v || 0) + '%">'
                + '<span class="mbp" style="background:' + m.col + '"></span>'
                + '<span class="mbd" style="height:' + (c.v ? Math.min(100, (m.cur || 0) / c.v * 100).toFixed(1) : '0') + '%;background:' + m.col + '"></span>'
                + '<span class="mv" style="color:' + m.col + '">' + eur0(c.v) + '</span></div>';
        } else if (c.v == null) {
            bar = '<div class="mb gap" style="height:0"></div>';
        } else if (c.mk === key - 12) {
            bar = '<div class="mb yoy" style="height:' + h(c.v) + '%"><span class="mv">' + eur0(c.v) + '</span></div>';
        } else {
            bar = '<div class="mb past" style="height:' + h(c.v) + '%"><span class="mv">' + eur0(c.v) + '</span></div>';
        }
        return '<div class="mcol"><div class="mslot"><div class="mplot">' + bar + yl + '</div></div><span class="mm">' + MONTHS[c.mk % 12].charAt(0) + '</span></div>';
    }).join('');
    return '<div class="mchart"><div class="mbars">' + bars + '</div></div>';
}
function buildPeriod() {
    var b = berlinNow(), m = monthStats(b), y = yearStats(b, m.prog);
    var body = '<div class="card">' + cardH('Kosten · Netzbezug', 'Energie ohne Grundgebühr')
        + costLine('ksum', shortMonth(m.key), m)
        + (m.usage ? '<div class="kk">' + m.usage + '</div>' : '')
        + monthChart(b, m)
        + costLine('kyear', String(b.getFullYear()), y)
        + '</div>';
    return fo(642, 302, body);
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
createState(DAYS_ID, '[]', { type: 'string', role: 'json', desc: 'Tages-kWh der letzten 7 Tage (Bilanz Ø Autarkie)' });
createState(EN + 'energy_today_day', '', { type: 'string', role: 'value', desc: 'Berlin-Tag der energy_today_* Integration' }, function () {
    _lastTick = Date.now();
    setTimeout(function () { integrateTick(); renderFast(); renderSlow(); queryCurve(); queryForecast(); queryMonthHistory(); }, 2000);
});

// ===== subscriptions & schedules =====
['power_production', 'power_consumption', 'power_purchased', 'power_feedin', 'power_maxxisun',
 'power_data_stale', 'tibber_states.energy_price_euro'].forEach(function (s) {
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
schedule('5 0 * * *', queryMonthHistory);   // daily, so a new month picks up its own history
schedule('*/30 * * * * *', renderFast);
console.log('[Energie v4] initialized');