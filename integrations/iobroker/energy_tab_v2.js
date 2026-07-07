// Energy tab v3 — three-tier rebuild (Jetzt → Heute → Kontext), approved 2026-07-07.
// The tab is the drill-down of the Overview's Energie card: identical entity names
// (Netz / Haus / SolarEdge / Maxxisun), watts() formatting, enRoleCol/priceBand/spectrum/
// energyFrame semantics — never a parallel visual story. Concept + mockup:
// claude.ai/code/artifact/3ef9905f (session private-home-monitoring).
//
// Widgets on the vis Energy view (page margin 4px, gutter 12px, nav at y=688):
//   et3_flow   (4,4)     1170x194 — ENERGIEFLUSS · JETZT: Overview flow rows scaled up
//                                   + Strompreis/spectrum + Netto €/h (energyFrame card frame)
//   et3_curve  (4,210)    778x270 — HEUTE · VERLAUF: InfluxDB day curve; Maxxisun by ROLE
//                                   (liefert stacks on SolarEdge, lädt stacks on Haus — the
//                                   battery charges through the house circuit; the gap between
//                                   supply-top and demand-top IS the grid exchange)
//   et3_bilanz (792,210)  382x214 — HEUTE · BILANZ: kWh (in-script integration) + autark
//   et3_heiz   (792,436)  382x116 — HEIZUNG: compact Heizkreis/Warmwasser rows
//   et3_price  (4,492)    778x192 — STROMPREIS · VORSCHAU: hourly bars by p20/p80 tier
//   et3_period (792,564)  382x120 — KOSTEN · NETZBEZUG: bisher · Prognose · Vorperiode
//
// Data sources: javascript.0.power_* (reconciled, solaredge_power.js), tibber_states.*,
// sam_digital.*, InfluxDB (adapter DB `iobroker` for the self-logged power curve;
// home_monitoring.autogen.electricity_price_forecast_euro for the forecast).
// NOTE Haus semantics: power_consumption EXCLUDES battery charging by design
// (solaredge_power.computeHybrid), so "Maxxisun lädt" can exceed "Haus".
// Helpers are copied 1:1 from main_v2.js until the shared vis_card.js global exists.

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
.et3 .frow .fv{width:96px;text-align:right;font-size:22px;font-weight:700;white-space:nowrap;flex-shrink:0}
/* stat blocks (Tier-1 right) */
.et3 .stat{display:flex;flex-direction:column;gap:3px;align-items:flex-end}
.et3 .stat .sl{font-size:13px;color:var(--muted);white-space:nowrap}
.et3 .stat .sv{font-size:26px;font-weight:700;line-height:1;white-space:nowrap}
.et3 .stat .ss{font-size:12px;color:var(--muted);white-space:nowrap}
/* spectrum (price min-max, Overview component) */
.et3 .spec{width:150px;display:flex;flex-direction:column;gap:3px}
.et3 .spec .bar{height:5px;border-radius:3px;position:relative;
  background:linear-gradient(90deg,var(--green),var(--amber),var(--red));opacity:.82}
.et3 .spec .knob{position:absolute;top:50%;width:10px;height:10px;border-radius:50%;
  background:var(--text);border:2px solid var(--surface);transform:translate(-50%,-50%)}
.et3 .spec .mm{display:flex;justify-content:space-between;font-size:11px}
/* bilanz rows */
.et3 .brow{display:flex;flex-direction:column;gap:2px}
.et3 .brow .top{display:flex;justify-content:space-between;align-items:baseline}
.et3 .brow .bl{font-size:15px;color:var(--muted)}
.et3 .brow .bv{font-size:17px;font-weight:600}
.et3 .btrack{height:4px;border-radius:2px;background:var(--inset);overflow:hidden}
.et3 .bfill{display:block;height:4px;border-radius:2px}
/* heizung rows */
.et3 .hzrow{display:flex;align-items:center;gap:12px}
.et3 .hzrow .hl{flex:1;display:flex;flex-direction:column;gap:1px;min-width:0}
.et3 .hzrow .hn{font-size:15px;color:var(--text);font-weight:600}
.et3 .hzrow .ht{font-size:13px;color:var(--muted);white-space:nowrap}
.et3 .hzrow .hr{display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0;width:110px}
.et3 .hzrow .hv{font-size:14px;font-weight:600;white-space:nowrap}
/* perioden table */
.et3 table.per{width:100%;border-collapse:collapse;margin-top:0}
.et3 table.per th{text-align:right;color:var(--muted);font-size:11px;font-weight:600;padding:0 4px}
.et3 table.per td{text-align:right;font-size:15px;font-weight:600;padding:2px 4px}
.et3 table.per td:first-child{text-align:left;color:var(--muted);font-size:14px;font-weight:400}
`;

// ===== helpers (verbatim semantics from main_v2.js — consolidate into vis_card.js later) =====
function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function tibber(id) { return sNum(EN + 'tibber_states.' + id); }
function sam(id) { return sNum(EN + 'sam_digital.' + id); }
function comma(v, d) { return (typeof v === 'number') ? v.toFixed(d == null ? 1 : d).replace('.', ',') : '–'; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function watts(v) { var a = Math.abs(v || 0); return a >= 1000 ? comma(a / 1000, 1) + '<span class="u"> kW</span>' : Math.round(a) + '<span class="u"> W</span>'; }
function kwh(v) { return v == null ? '–' : comma(v, 1) + '<span class="u"> kWh</span>'; }
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
function berlinHourFrac(ts) {
    var d = new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    return d.getHours() + d.getMinutes() / 60;
}
function fo(w, h, body) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
        + '<foreignObject width="' + w + '" height="' + h + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml" class="et3" style="width:' + w + 'px;height:' + h + 'px">'
        + '<style>' + CSS + '</style>' + body + '</div></foreignObject></svg>';
}
function cardH(title, badge) {
    return '<div class="card-h"><span>' + title + '</span>' + (badge ? '<span class="bdg">' + badge + '</span>' : '') + '</div>';
}

// ===== TIER 1: ENERGIEFLUSS · JETZT (1170x194) =====
function buildFlow() {
    var prod = sNum(EN + 'power_production') || 0, haus = sNum(EN + 'power_consumption') || 0;
    var pur = sNum(EN + 'power_purchased') || 0, feed = sNum(EN + 'power_feedin') || 0;
    var maxxi = sNum(EN + 'power_maxxisun') || 0, selfc = sNum(EN + 'power_selfconsumption') || 0;
    var staleS = getState(EN + 'power_data_stale'), stale = !!(staleS && staleS.val === true);
    var price = tibber('energy_price_euro'), p20 = tibber('energy_price_euro_p20'), p80 = tibber('energy_price_euro_p80');
    var pMin = tibber('energy_price_euro_min'), pMax = tibber('energy_price_euro_max');
    var se = Math.max(0, prod - Math.max(0, -maxxi));   // SolarEdge-only, like main_v2
    var grid = pur - feed;

    // rows: Netz first (headline flow), then Haus / SolarEdge / Maxxisun — Overview order
    var rows = [
        { ico: 'grid', label: 'Netz · ' + (grid >= 0 ? 'Bezug' : 'Einspeisung'), val: grid, col: enRoleCol(grid, grid < 0) },
        { ico: 'house', label: 'Haus', val: haus, col: stale ? LBL : enRoleCol(haus, false), approx: stale },
        { ico: 'sun', label: 'SolarEdge', val: se, col: enRoleCol(se, true) },
        { ico: 'battery', label: 'Maxxisun' + (Math.abs(maxxi) >= 75 ? (maxxi < 0 ? ' · lädt' : ' · liefert') : ''), val: maxxi, col: enRoleCol(maxxi, maxxi < 0, 500) }
    ];
    var maxV = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.val); }).concat([1]));
    var flows = '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly;padding:2px 4px 0 4px">'
        + rows.map(function (r) {
            var frac = clamp01(Math.abs(r.val) / maxV) * 100;
            return '<div class="frow"><span class="fi">' + enIco(r.ico, r.col) + '</span>'
                + '<span class="fl">' + r.label + '</span>'
                + '<span class="track"><span class="fill" style="width:' + frac.toFixed(0) + '%;background:' + r.col + '"></span></span>'
                + '<span class="fv" style="color:' + r.col + '">' + (r.approx ? '≈ ' : '') + watts(r.val) + '</span></div>';
        }).join('') + '</div>';

    // right zone: Strompreis + spectrum, Netto €/h, Eigenverbrauch gespart — verbatim Overview rules
    var net = grid > 0 ? grid / 1000 * (price || 0) : grid / 1000 * FEEDIN_RATE;
    var netZero = Math.abs(net) < 0.005, netSign = netZero ? '' : (net < 0 ? '+' : '−');
    var fc = energyFrame(net, price, p80);
    if (grid > 50 && !(price != null && price > 0)) fc = AMBER;   // importing w/o price ≠ break-even
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
    return fo(1170, 194, body);
}

// ===== energy_today_* — trapezoid integration of the live power states, Berlin-midnight reset =====
var INTEGRALS = [
    ['production', 'power_production'], ['consumption', 'power_consumption'],
    ['purchased', 'power_purchased'], ['feedin', 'power_feedin'],
    ['maxxicharge', null]   // derived: max(0, -power_maxxisun)
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
        var w = e[1] ? (sNum(EN + e[1]) || 0) : Math.max(0, -(sNum(EN + 'power_maxxisun') || 0));
        var cur = sNum(EN + 'energy_today_' + e[0]) || 0;
        setState(EN + 'energy_today_' + e[0], cur + w / 1000 * dtH, true);
    });
}

// ===== TIER 2 RIGHT: HEUTE · BILANZ (382x214) =====
function buildBilanz() {
    var prod = sNum(EN + 'energy_today_production'), cons = sNum(EN + 'energy_today_consumption');
    var pur = sNum(EN + 'energy_today_purchased'), feed = sNum(EN + 'energy_today_feedin');
    var kmax = Math.max(prod || 0, cons || 0, 0.1);
    function brow(label, v, col) {
        return '<div class="brow"><div class="top"><span class="bl">' + label + '</span>'
            + '<span class="bv" style="color:' + col + '">' + kwh(v) + '</span></div>'
            + '<div class="btrack"><span class="bfill" style="width:' + (clamp01((v || 0) / kmax) * 100).toFixed(0) + '%;background:' + col + '"></span></div></div>';
    }
    // energy-based Autarkie heute; colors = Overview thresholds (>=75 green, >=40 amber, else muted)
    var autark = (cons != null && cons > 0.05) ? clamp01(1 - (pur || 0) / cons) : null;
    var eigen = (prod != null && prod > 0.05) ? clamp01((prod - (feed || 0)) / prod) : null;
    var akPct = autark != null ? Math.round(autark * 100) : null;
    var akCol = akPct == null ? LBL : (akPct >= 75 ? GREEN : (akPct >= 40 ? AMBER : LBL));
    var a7 = sNum(EN + 'rate_autarky_7d');
    var sub = (a7 != null && a7 > 0 ? 'Ø 7 Tage: ' + Math.round(a7 * 100) + ' %' : '')
        + (eigen != null ? (a7 ? ' · ' : '') + '<span style="color:' + BLUE + '">Eigenverbrauch ' + Math.round(eigen * 100) + ' %</span>' : '');
    var body = '<div class="card">' + cardH('Heute · Bilanz')
        + '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding-top:2px">'
        + brow('Erzeugt', prod, GREEN)
        + brow('Verbraucht', cons, BLUE)
        + brow('Netzbezug', pur, (pur || 0) > 0.05 ? AMBER : LBL)
        + brow('Eingespeist', feed, GREEN)
        + '<div style="border-top:1px solid ' + BORD + ';margin:1px 0"></div>'
        + '<div class="brow"><div class="top"><span class="bl">autark</span>'
        + '<span style="font-size:24px;font-weight:700;color:' + akCol + '">' + (akPct != null ? akPct : '–') + '<span class="u"> %</span></span></div>'
        + '<div class="btrack"><span class="bfill" style="width:' + (akPct || 0) + '%;background:' + akCol + '"></span></div></div>'
        + (sub ? '<div style="font-size:12px;color:' + LBL + ';text-align:right">' + sub + '</div>' : '')
        + '</div></div>';
    return fo(382, 214, body);
}

// ===== TIER 2 LEFT: HEUTE · VERLAUF (778x270) — data from InfluxDB (adapter DB) =====
var CURVE = { prod: [], cons: [], mx: [], ready: false };
function queryCurve() {
    // 26h window then filter to today (Berlin) — covers midnight from any wall-clock time
    var ids = ['javascript.0.power_production', 'javascript.0.power_consumption', 'javascript.0.power_maxxisun'];
    var out = [[], [], []], done = 0;
    ids.forEach(function (id, i) {
        sendTo('influxdb.0', 'query',
            'SELECT MEAN("value") AS v FROM "' + id + '" WHERE time >= now() - 26h GROUP BY time(10m) fill(none)',
            function (result) {
                if (!result.error && result.result && result.result[0]) out[i] = result.result[0];
                if (++done === 3) {
                    var today = dayKeyBerlin();
                    function todays(rows) {
                        return rows.filter(function (r) { return r.v != null && dayKeyBerlin(new Date(r.ts)) === today; })
                            .map(function (r) { return { h: berlinHourFrac(r.ts), v: r.v }; });
                    }
                    CURVE = { prod: todays(out[0]), cons: todays(out[1]), mx: todays(out[2]), ready: true };
                    setState(EN + 'et3_curve', buildCurve(), true);
                }
            });
    });
}
function buildCurve() {
    var W = 778, H = 270, PW = 700, PH = 164, X0 = 36, Y0 = 10;
    var prod = CURVE.prod, cons = CURVE.cons, mx = CURVE.mx;
    var legend = '<span class="bdg" style="display:inline-flex;gap:12px;align-items:center">'
        + '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:3px;background:' + GREEN + ';border-radius:2px;display:inline-block"></span>SolarEdge</span>'
        + '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:3px;background:' + BLUE + ';border-radius:2px;display:inline-block"></span>Haus</span>'
        + '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:3px;background:' + GREEN + ';opacity:.45;border-radius:2px;display:inline-block"></span>+ Maxxi liefert</span>'
        + '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:10px;height:3px;background:' + BLUE + ';opacity:.55;border-radius:2px;display:inline-block"></span>+ Maxxi lädt</span>'
        + '<span style="display:inline-flex;gap:5px;align-items:center"><span style="width:1px;height:10px;background:' + TEXT + ';display:inline-block"></span>jetzt</span></span>';
    var head = cardH('Heute · Verlauf').replace('</div>', legend + '</div>');

    if (!CURVE.ready || (prod.length < 2 && cons.length < 2)) {
        return fo(W, H, '<div class="card">' + head
            + '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:' + LBL + ';font-size:14px">'
            + (CURVE.ready ? 'Datensammlung läuft — Kurve füllt sich im Tagesverlauf' : 'Lade Verlauf…') + '</div></div>');
    }
    // merge onto a common 10-min grid keyed by hour fraction
    var byH = {};
    function put(rows, k) { rows.forEach(function (r) { var key = r.h.toFixed(2); (byH[key] = byH[key] || { h: r.h })[k] = r.v; }); }
    put(prod, 'p'); put(cons, 'c'); put(mx, 'm');
    var S = Object.keys(byH).map(function (k) { return byH[k]; }).sort(function (a, b) { return a.h - b.h; });
    // SolarEdge-only + role bands, same math as the live flow rows
    S.forEach(function (s) {
        var m = s.m || 0;
        s.se = Math.max(0, (s.p || 0) - Math.max(0, -m));
        s.supTop = s.se + Math.max(0, m);
        s.demTop = (s.c || 0) + Math.max(0, -m);
    });
    var ymaxW = Math.max.apply(null, S.map(function (s) { return Math.max(s.supTop, s.demTop); }).concat([1000]));
    var YMAX = Math.max(2, Math.ceil(ymaxW / 1000));
    function sx(h) { return X0 + h / 24 * PW; }
    function sy(w) { return Y0 + PH - (w / 1000) / YMAX * PH; }
    function pathOf(key) { return 'M' + S.map(function (s) { return sx(s.h).toFixed(1) + ',' + sy(s[key]).toFixed(1); }).join(' L'); }
    var seP = pathOf('se');
    var seA = seP + ' L' + sx(S[S.length - 1].h).toFixed(1) + ',' + sy(0).toFixed(1) + ' L' + sx(S[0].h).toFixed(1) + ',' + sy(0).toFixed(1) + ' Z';
    // Maxxisun role bands: contiguous runs of liefert (m>20W) / lädt (m<-20W)
    function bands(pred, baseK, topK, col) {
        var svg = '', run = [];
        function flush() {
            if (run.length > 1) {
                var top = 'M' + run.map(function (s) { return sx(s.h).toFixed(1) + ',' + sy(s[topK]).toFixed(1); }).join(' L');
                var poly = top + ' L' + run.slice().reverse().map(function (s) { return sx(s.h).toFixed(1) + ',' + sy(s[baseK]).toFixed(1); }).join(' L') + ' Z';
                svg += '<path d="' + poly + '" fill="' + col + '" opacity="0.18"/>'
                    + '<path d="' + top + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-dasharray="4 3"/>';
            }
            run = [];
        }
        S.forEach(function (s) { if (pred(s.m || 0)) run.push(s); else flush(); });
        flush();
        return svg;
    }
    var supB = bands(function (m) { return m > 20; }, 'se', 'supTop', GREEN);
    var demB = bands(function (m) { return m < -20; }, 'c', 'demTop', BLUE);

    var grid = '', k;
    for (k = 1; k <= YMAX; k++) {
        grid += '<line x1="' + X0 + '" y1="' + sy(k * 1000).toFixed(1) + '" x2="' + (X0 + PW) + '" y2="' + sy(k * 1000).toFixed(1) + '" stroke="' + INSET + '" stroke-width="1"/>'
            + '<text x="' + (X0 - 8) + '" y="' + (sy(k * 1000) + 4).toFixed(1) + '" fill="' + LBL + '" font-size="11" text-anchor="end">' + k + (k === YMAX ? ' kW' : '') + '</text>';
    }
    var ticks = [0, 6, 12, 18, 24].map(function (t) {
        return '<text x="' + sx(t).toFixed(0) + '" y="' + (Y0 + PH + 16) + '" fill="' + LBL + '" font-size="11" text-anchor="middle">' + ('0' + t).slice(-2) + '</text>';
    }).join('');

    var last = S[S.length - 1], nowX = sx(last.h);
    var liveSe = last.se, liveC = last.c || 0, liveM = last.m || 0;
    // late in the day the labels would clip the right edge — flip them to the left of the marker
    var flip = nowX > X0 + PW - 235;
    var tx = (flip ? nowX - 9 : nowX + 9).toFixed(1), ta = flip ? ' text-anchor="end"' : '';
    var lbl = '<line x1="' + nowX.toFixed(1) + '" y1="' + (Y0 - 2) + '" x2="' + nowX.toFixed(1) + '" y2="' + (Y0 + PH) + '" stroke="' + TEXT + '" stroke-width="1" opacity="0.5" stroke-dasharray="3 3"/>'
        + '<circle cx="' + nowX.toFixed(1) + '" cy="' + sy(liveSe).toFixed(1) + '" r="4" fill="' + GREEN + '" stroke="' + SURF + '" stroke-width="2"/>'
        + '<circle cx="' + nowX.toFixed(1) + '" cy="' + sy(liveC).toFixed(1) + '" r="4" fill="' + BLUE + '" stroke="' + SURF + '" stroke-width="2"/>'
        + '<text x="' + tx + '" y="' + (sy(liveSe) - 9).toFixed(1) + '" fill="' + GREEN + '" font-size="13" font-weight="600"' + ta + '>SolarEdge ' + comma(liveSe / 1000, 1) + ' kW</text>'
        + '<text x="' + tx + '" y="' + (sy(liveC) + 17).toFixed(1) + '" fill="' + BLUE + '" font-size="13" font-weight="600"' + ta + '>Haus ' + comma(liveC / 1000, 1) + ' kW</text>';
    if (liveM < -20) {
        lbl += '<circle cx="' + nowX.toFixed(1) + '" cy="' + sy(last.demTop).toFixed(1) + '" r="4" fill="' + BLUE + '" stroke="' + SURF + '" stroke-width="2"/>'
            + '<text x="' + tx + '" y="' + (sy(last.demTop) - 7).toFixed(1) + '" fill="' + BLUE + '" font-size="13" font-weight="600"' + ta + '>Σ ' + comma(last.demTop / 1000, 1) + ' kW · Haus + Maxxi lädt</text>';
    } else if (liveM > 20) {
        lbl += '<circle cx="' + nowX.toFixed(1) + '" cy="' + sy(last.supTop).toFixed(1) + '" r="4" fill="' + GREEN + '" stroke="' + SURF + '" stroke-width="2"/>'
            + '<text x="' + tx + '" y="' + (sy(last.supTop) - 7).toFixed(1) + '" fill="' + GREEN + '" font-size="13" font-weight="600"' + ta + '>Σ ' + comma(last.supTop / 1000, 1) + ' kW · SolarEdge + Maxxi</text>';
    }
    var svg = '<svg width="' + (PW + X0 + 10) + '" height="' + (PH + Y0 + 24) + '" style="flex:1">'
        + grid + ticks
        + '<path d="' + seA + '" fill="' + GREEN + '" opacity="0.13"/>'
        + '<path d="' + seP + '" fill="none" stroke="' + GREEN + '" stroke-width="2"/>'
        + supB + demB
        + '<path d="' + pathOf('c') + '" fill="none" stroke="' + BLUE + '" stroke-width="2"/>'
        + lbl + '</svg>';
    return fo(W, H, '<div class="card">' + head + '<div style="flex:1;display:flex;align-items:stretch">' + svg + '</div></div>');
}

// ===== TIER 2 RIGHT BOTTOM: HEIZUNG (382x116) =====
function buildHeiz() {
    var hkV = sam('heating_valve_signal'), wwV = sam('hotwater_valve_signal');
    var hkF = sam('heating_flow_temperature'), hkR = sam('heating_return_temperature');
    var wwS = sam('hotwater_storage_temperature'), wwR = sam('hotwater_return_temperature');
    function row(name, temps, v, on) {
        var col = on ? AMBER : LBL, pct = v != null ? Math.round(v) : 0;
        return '<div class="hzrow"><div class="hl"><span class="hn">' + name + '</span>'
            + '<span class="ht">' + temps + '</span></div>'
            + '<div class="hr"><span class="hv" style="color:' + col + '">Ventil ' + (v != null ? pct : '–') + ' %' + (on ? ' · aktiv' : '') + '</span>'
            + '<span style="width:100%;height:4px;border-radius:2px;background:' + INSET + ';overflow:hidden">'
            + '<span style="display:block;height:4px;width:' + pct + '%;background:' + col + '"></span></span></div></div>';
    }
    var body = '<div class="card">' + cardH('Heizung')
        + '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly">'
        + row('Heizkreis', 'Vorlauf ' + comma(hkF, 1) + '° · Rücklauf ' + comma(hkR, 1) + '°', hkV, hkV != null && hkV > 5)
        + '<div style="border-top:1px solid ' + INSET + '"></div>'
        + row('Warmwasser', 'Speicher ' + comma(wwS, 1) + '° · Rücklauf ' + comma(wwR, 1) + '°', wwV, wwV != null && wwV > 5)
        + '</div></div>';
    return fo(382, 116, body);
}

// ===== TIER 3 LEFT: STROMPREIS · VORSCHAU (778x192) — hourly bars from the forecast =====
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
    var W = 778, H = 192;
    var price = tibber('energy_price_euro'), p20 = tibber('energy_price_euro_p20'), p80 = tibber('energy_price_euro_p80');
    var badge = 'jetzt <span style="color:' + priceBand(price, p20, p80).col + ';font-weight:700">' + comma(price, 2) + ' €/kWh</span>'
        + '&nbsp;&nbsp;·&nbsp;&nbsp;<span style="color:' + GREEN + '">■</span> günstig&nbsp;&nbsp;'
        + '<span style="color:' + AMBER + '">■</span> mittel&nbsp;&nbsp;<span style="color:' + RED + '">■</span> teuer';
    var head = cardH('Strompreis · Vorschau', badge);
    // group the 15-min rows into Berlin hours
    var hours = [], cur = null;
    FORECAST.rows.forEach(function (r) {
        var d = new Date(new Date(r.ts).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        var key = dayKeyBerlin(new Date(r.ts)) + ' ' + d.getHours();
        if (!cur || cur.key !== key) { cur = { key: key, day: dayKeyBerlin(new Date(r.ts)), hour: d.getHours(), sum: 0, n: 0 }; hours.push(cur); }
        cur.sum += r.total; cur.n++;
    });
    hours.forEach(function (h) { h.v = h.sum / h.n; });
    if (hours.length < 3) {
        return fo(W, H, '<div class="card">' + head
            + '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:' + LBL + ';font-size:14px">'
            + (FORECAST.ready ? 'Keine Vorschau-Daten' : 'Lade Vorschau…') + '</div></div>');
    }
    var lo = Math.min.apply(null, hours.map(function (h) { return h.v; }));
    var hi = Math.max.apply(null, hours.map(function (h) { return h.v; }));
    var axLo = Math.floor(lo * 20) / 20, axHi = Math.ceil(hi * 20) / 20;
    if (axHi - axLo < 0.05) axHi = axLo + 0.05;
    var BW = 700, BH = 82, BX0 = 36, BY0 = 6, bw = BW / hours.length;
    var bars = '', ticks = '', boundary = '';
    var DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    hours.forEach(function (h, i) {
        var col = (p20 != null && h.v <= p20) ? GREEN : ((p80 != null && h.v >= p80) ? RED : AMBER);
        var hgt = Math.max(2, (h.v - axLo) / (axHi - axLo) * BH);
        bars += '<rect x="' + (BX0 + i * bw + 1).toFixed(1) + '" y="' + (BY0 + BH - hgt).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="2" fill="' + col + '" opacity="' + (i === 0 ? '1' : '0.72') + '"/>';
        if (h.hour === 0) {
            var d = new Date(h.day + 'T12:00:00');
            boundary += '<line x1="' + (BX0 + i * bw).toFixed(0) + '" y1="' + (BY0 - 2) + '" x2="' + (BX0 + i * bw).toFixed(0) + '" y2="' + (BY0 + BH + 4) + '" stroke="' + LBL + '" stroke-width="1" stroke-dasharray="2 3"/>'
                + '<text x="' + (BX0 + i * bw + bw / 2).toFixed(0) + '" y="' + (BY0 + BH + 15) + '" fill="' + TEXT + '" font-size="11" font-weight="600" text-anchor="middle">' + DAYS[d.getDay()] + ' ' + d.getDate() + '.</text>';
        } else if (h.hour % 6 === 0) {
            ticks += '<text x="' + (BX0 + i * bw + bw / 2).toFixed(0) + '" y="' + (BY0 + BH + 15) + '" fill="' + LBL + '" font-size="11" text-anchor="middle">' + ('0' + h.hour).slice(-2) + '</text>';
        }
    });
    // cheapest 4h window → green underline + label
    var bestI = 0, bestAvg = Infinity, WIN = Math.min(4, hours.length);
    for (var s = 0; s + WIN <= hours.length; s++) {
        var sum = 0; for (var q = s; q < s + WIN; q++) sum += hours[q].v;
        if (sum / WIN < bestAvg) { bestAvg = sum / WIN; bestI = s; }
    }
    // window near the right edge → put the label left of the underline instead of clipping
    var cFlip = BX0 + bestI * bw + WIN * bw + 170 > BX0 + BW;
    var cheap = '<rect x="' + (BX0 + bestI * bw).toFixed(0) + '" y="' + (BY0 + BH + 20) + '" width="' + (WIN * bw).toFixed(0) + '" height="3" rx="1.5" fill="' + GREEN + '"/>'
        + '<text x="' + (cFlip ? (BX0 + bestI * bw - 8).toFixed(0) : (BX0 + bestI * bw + WIN * bw + 8).toFixed(0)) + '" y="' + (BY0 + BH + 26) + '" fill="' + GREEN + '" font-size="11"' + (cFlip ? ' text-anchor="end"' : '') + '>günstig '
        + ('0' + hours[bestI].hour).slice(-2) + '–' + ('0' + ((hours[bestI].hour + WIN) % 24)).slice(-2) + ' · Ø ' + comma(bestAvg, 2) + ' €</text>';
    var svg = '<svg width="' + (BW + BX0 + 10) + '" height="' + (BH + BY0 + 34) + '" style="flex:1">'
        + '<text x="' + (BX0 - 8) + '" y="' + (BY0 + 10) + '" fill="' + LBL + '" font-size="11" text-anchor="end">' + comma(axHi, 2) + '</text>'
        + '<text x="' + (BX0 - 8) + '" y="' + (BY0 + BH) + '" fill="' + LBL + '" font-size="11" text-anchor="end">' + comma(axLo, 2) + '</text>'
        + bars + boundary + ticks + cheap + '</svg>';
    return fo(W, H, '<div class="card">' + head + '<div style="flex:1;display:flex">' + svg + '</div></div>');
}

// ===== TIER 3 RIGHT: KOSTEN · NETZBEZUG (382x120) — bisher · Prognose · Vorperiode =====
function buildPeriod() {
    var b = berlinNow();
    var daysInMonth = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    var dayFrac = (b.getHours() + b.getMinutes() / 60) / 24;
    var elapsed = {
        day: dayFrac,
        month: (b.getDate() - 1 + dayFrac) / daysInMonth,
        year: ((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(b.getFullYear(), 0, 1)) / 86400000 + dayFrac)
            / (((b.getFullYear() % 4 === 0 && b.getFullYear() % 100 !== 0) || b.getFullYear() % 400 === 0) ? 366 : 365)
    };
    function prow(label, period, frac) {
        var cur = tibber('cost_this_' + period), prev = tibber('cost_last_' + period);
        // Prognose = linear pace; suppressed early in the period (extrapolation too noisy)
        var prog = (cur != null && frac > 0.1) ? cur / frac : null;
        var pCol = (prog == null || prev == null || prev <= 0.01) ? TEXT : (prog < prev ? GREEN : (prog > prev * 1.05 ? AMBER : TEXT));
        var progStr = prog == null ? '–' : (prog >= 100 ? Math.round(prog) + ' €' : eur2(prog));
        return '<tr><td>' + label + '</td>'
            + '<td style="color:' + TEXT + '">' + eur2(cur) + '</td>'
            + '<td style="color:' + pCol + '">' + progStr + '</td>'
            + '<td style="color:' + LBL + ';font-weight:400">' + eur2(prev) + '</td></tr>';
    }
    var body = '<div class="card">' + cardH('Kosten · Netzbezug', 'Prognose vs. Vorperiode')
        + '<table class="per"><tr><th></th><th>bisher</th><th>Prognose</th><th>Vorperiode</th></tr>'
        + prow('Tag', 'day', elapsed.day)
        + prow('Monat', 'month', elapsed.month)
        + prow('Jahr', 'year', elapsed.year)
        + '</table></div>';
    return fo(382, 120, body);
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
    createState(EN + id, '', { type: 'string', role: 'html', desc: 'Energie-Tab v3 ' + id });
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
['cost_this_hour', 'cost_this_day', 'cost_this_month', 'cost_this_year',
 'cost_last_day', 'cost_last_month', 'cost_last_year'].forEach(function (s) {
    on({ id: EN + 'tibber_states.' + s, change: 'ne' }, renderSlow);
});
schedule('* * * * *', function () { integrateTick(); renderSlow(); });
schedule('*/5 * * * *', function () { queryCurve(); queryForecast(); });
schedule('*/30 * * * * *', renderFast);
console.log('[Energie v3] initialized');
