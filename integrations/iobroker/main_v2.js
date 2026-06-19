// Prototype of the redesigned Main — "Bubble Card"-inspired aesthetic (pill rows with a
// circular icon), rendered as one SVG into main_v2_card and shown on the "Main2" view to
// compare with the live Main. Iteration 4: zones built — Klima (temp-comfort old bands,
// humidity, CO2, last-update + battery), Tanken (Diesel/E5 verdict), Heute (today's calendar
// from ical.0.data.table) and Energie (the Energiefluss hub recreated in Bubble style from the
// values it already publishes). Steuerung remains a placeholder (interactive → native widgets).
// (Bubble Card itself is Home-Assistant-only; this recreates its look.)

var VAL = 'var(--color-font)', LBL = 'var(--color-text-muted)',
    GREEN = 'var(--color-green)', AMBER = 'var(--color-yellow)', RED = 'var(--color-red)',
    BLUE = 'var(--color-blue)', PANEL = 'var(--color-panel)', BORDER = 'var(--color-border)',
    NODE = '#1c1f28', F = 'font-family="RobotoCondensed-Regular,sans-serif"';

// --- Bubble Card design tokens (source: github.com/Clooos/Bubble-Card @612aaaa).
//     Reproducible: `git clone --depth 1` the repo, then grep src/**/styles.css for the
//     `var(--bubble-*, DEFAULT)` fallbacks and map the defaults to these constants:
//       --bubble-border-radius .......... 32px  (card containers)
//       button row radius ............... calc(--row-height(56px)/2)  → rows are PILLS (h/2)
//       --bubble-icon-border-radius ..... 50%   (circular icons)
//       --bubble-icon-size .............. 24px
var CARD_RAD = 28;   // zone card radius (≈ --bubble-border-radius, tightened for our panels)
var ROW_GAP = 8;     // gap between bubble cards
var ICON_SZ = 24;    // --bubble-icon-size

function T(x, y, fill, size, anchor, s) {
    return '<text x="' + x + '" y="' + y + '" fill="' + fill + '" ' + F + ' font-size="' + size + '"'
        + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + s + '</text>';
}
function rr(x, y, w, h, r, fill, stroke) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + fill + '"'
        + (stroke ? ' stroke="' + stroke + '"' : '') + '/>';
}
function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function comma(v, d) { return (typeof v === 'number') ? v.toFixed(d == null ? 1 : d).replace('.', ',') : '–'; }

// comfort colour = the dashboard's existing temperature bands (used "as before")
function comfortCol(t) { return t == null ? LBL : (t <= 3 ? LBL : (t < 12 ? BLUE : (t < 20 ? GREEN : (t < 27 ? AMBER : RED)))); }
function comfortWord(t) { return t == null ? '' : (t < 12 ? 'kalt' : (t < 20 ? 'kühl' : (t < 27 ? 'warm' : 'heiß'))); }
function co2Col(c) { return c == null ? LBL : (c < 1000 ? GREEN : (c < 1400 ? AMBER : RED)); }
function co2Word(c) { return c == null ? '' : (c < 1000 ? 'gut' : (c < 1400 ? 'mäßig' : 'lüften')); }
function humCol(h) { return h == null ? LBL : (h < 40 ? AMBER : (h <= 60 ? GREEN : BLUE)); }

// --- metric icons (small, centred at x,y) ---
function icoThermo(cx, cy, col) {
    return '<rect x="' + (cx - 2) + '" y="' + (cy - 9) + '" width="4" height="12" rx="2" fill="' + col + '"/>'
        + '<circle cx="' + cx + '" cy="' + (cy + 5) + '" r="4.5" fill="' + col + '"/>';
}
function icoDrop(x, y, col) {
    return '<path d="M' + x + ' ' + (y - 6) + ' C ' + (x + 4.6) + ' ' + (y - 1) + ' ' + (x + 4.6) + ' ' + (y + 3.4) + ' ' + x + ' ' + (y + 4)
        + ' C ' + (x - 4.6) + ' ' + (y + 3.4) + ' ' + (x - 4.6) + ' ' + (y - 1) + ' ' + x + ' ' + (y - 6) + ' Z" fill="' + col + '"/>';
}
function icoClock(x, y, col) {
    return '<circle cx="' + x + '" cy="' + y + '" r="5.5" fill="none" stroke="' + col + '" stroke-width="1.3"/>'
        + '<path d="M' + x + ' ' + (y - 3) + ' L' + x + ' ' + y + ' L' + (x + 3) + ' ' + y + '" stroke="' + col + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
}
function icoBatt(x, y, col) {
    return '<rect x="' + (x - 6) + '" y="' + (y - 4) + '" width="12" height="8" rx="1.5" fill="none" stroke="' + col + '" stroke-width="1.2"/>'
        + '<rect x="' + (x + 6.4) + '" y="' + (y - 1.6) + '" width="1.8" height="3.2" rx="0.6" fill="' + col + '"/>';
}
function icoFuel(cx, cy, col) {
    return '<rect x="' + (cx - 7) + '" y="' + (cy - 9) + '" width="10" height="18" rx="2" fill="none" stroke="' + col + '" stroke-width="1.6"/>'
        + '<line x1="' + (cx - 4) + '" y1="' + (cy - 4) + '" x2="' + cx + '" y2="' + (cy - 4) + '" stroke="' + col + '" stroke-width="1.5"/>'
        + '<path d="M' + (cx + 3) + ' ' + (cy - 6) + ' h4 v8 a2 2 0 0 1 -4 0" fill="none" stroke="' + col + '" stroke-width="1.3"/>';
}
// Tankstelle price: third decimal as a raised index, e.g. 1,69 + ⁹
function priceSuper(v) {
    if (v == null) return '–';
    var s = v.toFixed(3);
    return s.slice(0, 4).replace('.', ',') + '<tspan baseline-shift="super" font-size="58%">' + s.slice(4) + '</tspan>';
}

var NB = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
var OUTDOOR = NB + '.02-00-00-32-ae-a4';
var FCMIN = 'daswetter.0.NextDays.Location_1.Day_1.Minimale_Temperatur_value';
var FCMAX = 'daswetter.0.NextDays.Location_1.Day_1.Maximale_Temperatur_value';
var ROWS = [
    ['Außen', OUTDOOR],
    ['Wohnzimmer', NB],
    ['Carlottas Zimmer', NB + '.03-00-00-0e-16-36'],
    ['Claras Zimmer', NB + '.03-00-00-0f-01-6e'],
    ['Cleas Zimmer', NB + '.03-00-00-10-e5-42']
];
var DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function bubble(x, y, w, h, name, module, isOut) {
    var t = sNum(module + '.Temperature.Temperature'), hh = sNum(module + '.Humidity.Humidity'),
        c = sNum(module + '.CO2.CO2'), bs = sNum(module + '.BatteryStatus');
    var lu = getState(module + '.LastUpdate');
    var mins = (lu && lu.val) ? Math.round((Date.now() - new Date(lu.val).getTime()) / 60000) : null;
    var cc = comfortCol(t), cx = x + 38, cy = y + h / 2;
    // pill row (Bubble: border-radius = height/2) + circular icon (Bubble: 50%, 24px glyph)
    var p = [rr(x, y, w, h, h / 2, NODE),
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (ICON_SZ - 2) + '" fill="' + cc + '" fill-opacity="0.16"/>', icoThermo(cx, cy, cc)];
    p.push(T(x + 74, y + 26, VAL, 16, null, name));
    // sub-line 1: humidity (+ CO2 for rooms, + forecast min/max for Außen)
    p.push(icoDrop(x + 82, y + 47, humCol(hh)));
    var s1 = T(x + 94, y + 51, humCol(hh), 13, null, hh != null ? Math.round(hh) + ' %' : '–');
    if (c != null) s1 += T(x + 150, y + 51, co2Col(c), 13, null, Math.round(c) + ' ppm ' + co2Word(c));
    if (isOut) {
        var mn = sNum(FCMIN), mx = sNum(FCMAX);
        s1 += T(x + 150, y + 51, LBL, 13, null,
            '<tspan fill="' + comfortCol(mn) + '">&#8595; ' + comma(mn, 0) + '°</tspan>  <tspan fill="' + comfortCol(mx) + '">&#8593; ' + comma(mx, 0) + '°</tspan>');
    }
    p.push(s1);
    // sub-line 2: last-update (+ battery), red on alarm
    p.push(icoClock(x + 84, y + 68, mins != null && mins > 60 ? RED : LBL));
    p.push(T(x + 94, y + 72, mins != null && mins > 60 ? RED : LBL, 12, null, mins != null ? 'vor ' + (mins < 60 ? mins + 'm' : Math.floor(mins / 60) + 'h') : '–'));
    if (bs != null) {
        p.push(icoBatt(x + 184, y + 68, bs < 20 ? RED : LBL));
        p.push(T(x + 196, y + 72, bs < 20 ? RED : LBL, 12, null, Math.round(bs) + ' %'));
    }
    // right: temp (comfort colour) + word
    p.push(T(x + w - 18, y + 33, cc, 24, 'end', comma(t, 1) + '°'));
    p.push(T(x + w - 18, y + 54, cc, 13, 'end', comfortWord(t)));
    return p.join('');
}

// one fuel Bubble row: pump icon + name + 14-day range, big price + verdict (günstig/teuer)
function fuelBubble(bx, by, bw, bh, name, feedOid, base) {
    var price = sNum(feedOid), p20 = sNum(base + '_p20'), p80 = sNum(base + '_p80'),
        mn = sNum(base + '_min'), mx = sNum(base + '_max');
    var band = (price != null && p20 != null && p80 != null) ? (price <= p20 ? 0 : (price >= p80 ? 2 : 1)) : 1;
    var col = [GREEN, AMBER, RED][band], word = ['günstig', 'mittel', 'teuer'][band], hint = ['tanken', '', 'warten'][band];
    var cx = bx + 38, cy = by + bh / 2;
    var p = [rr(bx, by, bw, bh, bh / 2, NODE),
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + (ICON_SZ - 2) + '" fill="' + col + '" fill-opacity="0.16"/>', icoFuel(cx, cy, col)];
    p.push(T(bx + 74, by + 28, VAL, 16, null, name));
    p.push(T(bx + 74, by + 52, LBL, 13, null,
        (mn != null ? 'min ' + comma(mn, 2) : '') + (mx != null ? '    max ' + comma(mx, 2) : '')));
    p.push(T(bx + bw - 18, by + 33, col, 22, 'end', priceSuper(price) + ' <tspan font-size="13" fill="' + LBL + '">€/l</tspan>'));
    p.push(T(bx + bw - 18, by + 55, col, 13, 'end', word + (hint ? ' · ' + hint : '')));
    return p.join('');
}
function renderTanken(x, y, w, h) {
    var p = [rr(x, y, w, h, CARD_RAD, PANEL, BORDER), T(x + 18, y + 32, VAL, 17, null, 'Tanken')];
    var bx = x + 14, bw = w - 28, bh = 76, by = y + 46;
    p.push(fuelBubble(bx, by, bw, bh, 'Diesel', 'tankerkoenig.0.stations.1.diesel.feed', 'javascript.0.tankerkoenig_quantiles.diesel'));
    by += bh + ROW_GAP;
    p.push(fuelBubble(bx, by, bw, bh, 'E5', 'tankerkoenig.0.stations.1.e5.feed', 'javascript.0.tankerkoenig_quantiles.e5'));
    return p.join('');
}

// ===== Energie zone — the Energiefluss hub recreated in Bubble style. Reads the values the
//       hub already publishes (no recompute): production, Maxxisun, grid (purchased−feedin),
//       Haus, autarky, Tibber price. Role × magnitude colours mirror solaredge_power.js. =====
var EN_NS = 'javascript.0.';
function enRoleCol(val, favourable, high) {        // same thresholds as the hub
    var m = Math.abs(val || 0);
    if (favourable) return m < 75 ? LBL : GREEN;
    if (m < 150) return LBL;
    return m < (high || 2000) ? AMBER : RED;
}
function watts(v) { var a = Math.abs(v || 0); return a >= 1000 ? comma(a / 1000, 1) + ' kW' : Math.round(a) + ' W'; }
// compact energy node icons (~9px box), centred at cx,cy
function enIco(kind, cx, cy, col) {
    var g = '<g stroke="' + col + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">';
    if (kind === 'sun') {
        g += '<circle cx="' + cx + '" cy="' + cy + '" r="4"/>';
        for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4;
            g += '<line x1="' + (cx + 6 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + 6 * Math.sin(a)).toFixed(1)
              + '" x2="' + (cx + 8 * Math.cos(a)).toFixed(1) + '" y2="' + (cy + 8 * Math.sin(a)).toFixed(1) + '"/>'; }
    } else if (kind === 'house') {
        g += '<path d="M' + (cx - 8) + ' ' + (cy - 1) + ' L' + cx + ' ' + (cy - 8) + ' L' + (cx + 8) + ' ' + (cy - 1) + '"/>';
        g += '<rect x="' + (cx - 6) + '" y="' + (cy - 1) + '" width="12" height="8" rx="1"/>';
    } else if (kind === 'grid') {
        g += '<line x1="' + (cx - 6) + '" y1="' + (cy + 8) + '" x2="' + (cx - 1.5) + '" y2="' + (cy - 8) + '"/>';
        g += '<line x1="' + (cx + 6) + '" y1="' + (cy + 8) + '" x2="' + (cx + 1.5) + '" y2="' + (cy - 8) + '"/>';
        g += '<line x1="' + (cx - 6) + '" y1="' + (cy - 8) + '" x2="' + (cx + 6) + '" y2="' + (cy - 8) + '"/>';
        g += '<line x1="' + (cx - 4.5) + '" y1="' + cy + '" x2="' + (cx + 4.5) + '" y2="' + cy + '"/>';
    } else if (kind === 'battery') {
        g += '<rect x="' + (cx - 8) + '" y="' + (cy - 5) + '" width="15" height="10" rx="1.6"/>';
        g += '<line x1="' + (cx + 8.5) + '" y1="' + (cy - 2) + '" x2="' + (cx + 8.5) + '" y2="' + (cy + 2) + '" stroke-width="2.4"/>';
    }
    return g + '</g>';
}
function renderEnergie(x, y, w, h) {
    var prodTotal = sNum(EN_NS + 'power_production'), maxxi = sNum(EN_NS + 'power_maxxisun'),
        feedin = sNum(EN_NS + 'power_feedin'), purchased = sNum(EN_NS + 'power_purchased'),
        haus = sNum(EN_NS + 'power_consumption'), autark = sNum(EN_NS + 'rate_autarky'),
        price = sNum(EN_NS + 'tibber_states.energy_price_euro'),
        p20 = sNum(EN_NS + 'tibber_states.energy_price_euro_p20'),
        p80 = sNum(EN_NS + 'tibber_states.energy_price_euro_p80');
    var staleS = getState(EN_NS + 'power_data_stale'), stale = !!(staleS && staleS.val === true);
    // power_production folds in Maxxisun feed-in (= seProd + maxxiFeed); recover SolarEdge-only
    // so the battery isn't counted twice across the SolarEdge and Maxxisun rows.
    var se = prodTotal != null ? Math.max(0, prodTotal - Math.max(0, -(maxxi || 0))) : null;
    var grid = (purchased || 0) - (feedin || 0);          // signed: + import, − export
    var imp = grid > 50, exp = grid < -50;
    var gridCol = enRoleCol(grid, grid < 0);
    var statusWord = exp ? 'Einspeisung' : (imp ? 'Netzbezug' : 'Ausgeglichen');
    var net = grid > 0 ? grid / 1000 * (price || 0) : grid / 1000 * 0.1048;   // €/h (feed-in rate 0.1048)
    var earning = net < -0.0005, netCol = Math.abs(net) < 0.005 ? LBL : gridCol;

    var p = [rr(x, y, w, h, CARD_RAD, PANEL, BORDER), T(x + 18, y + 30, VAL, 17, null, 'Energie')];
    p.push(T(x + w - 18, y + 30, gridCol, 15, 'end', statusWord + ' ' + watts(grid)));
    // price verdict (band by 7-day p20/p80, like the hub) + net €/h
    var band = (price != null && p20 != null && p80 != null) ? (price <= p20 ? 0 : (price >= p80 ? 2 : 1)) : 1;
    var priceCol = [GREEN, AMBER, RED][band], word = ['günstig', 'mittel', 'teuer'][band];
    if (price != null && price > 0) {
        p.push(T(x + 18, y + 52, LBL, 13, null, 'Strompreis <tspan fill="' + priceCol + '">' + comma(price, 2) + ' €/kWh · ' + word + '</tspan>'));
        p.push(T(x + w - 18, y + 52, netCol, 13, 'end', (earning ? '+' : '') + comma(Math.abs(net), 2) + ' €/h'));
    }
    // four flow rows with magnitude bars (icon · name · bar · value), each role × magnitude coloured
    var maxV = Math.max(Math.abs(se || 0), Math.abs(maxxi || 0), Math.abs(grid || 0), Math.abs(haus || 0), 1);
    var bx = x + 150, bw = w - 150 - 72;
    function frow(yy, kind, name, val, col, prefix) {
        var frac = Math.min(1, Math.abs(val || 0) / maxV);
        p.push(enIco(kind, x + 26, yy, col));
        p.push(T(x + 44, yy + 4, LBL, 13, null, name));
        p.push('<rect x="' + bx + '" y="' + (yy - 3) + '" width="' + bw + '" height="6" rx="3" fill="' + BORDER + '" opacity="0.5"/>');
        p.push('<rect x="' + bx + '" y="' + (yy - 3) + '" width="' + (bw * frac).toFixed(0) + '" height="6" rx="3" fill="' + col + '"/>');
        p.push(T(x + w - 16, yy + 5, col, 14, 'end', (prefix || '') + watts(val)));
    }
    var y0 = y + 82, step = 30;
    frow(y0,            'sun',     'SolarEdge', se,    enRoleCol(se, true), '');
    frow(y0 + step,     'battery', 'Maxxisun',  maxxi, enRoleCol(maxxi, maxxi < 0, 500), '');
    frow(y0 + step * 2, 'grid',    'Netz',      grid,  gridCol, '');
    frow(y0 + step * 3, 'house',   'Haus',      haus,  stale ? LBL : enRoleCol(haus, false), stale ? '≈ ' : '');
    // autarky bar (bottom)
    var aPct = Math.round((autark || 0) * 100), ay = y + h - 20;
    p.push(T(x + 18, ay, LBL, 12, null, 'Autarkie' + (stale ? ' (≈)' : '')));
    p.push(T(x + w - 18, ay, LBL, 12, 'end', aPct + ' %'));
    p.push('<rect x="' + (x + 18) + '" y="' + (ay + 5) + '" width="' + (w - 36) + '" height="5" rx="2.5" fill="' + BORDER + '"/>');
    p.push('<rect x="' + (x + 18) + '" y="' + (ay + 5) + '" width="' + ((w - 36) * Math.min(aPct, 100) / 100).toFixed(0) + '" height="5" rx="2.5" fill="' + GREEN + '"/>');
    return p.join('');
}

// ===== Heute zone — today's calendar events from ical.0.data.table ({_date,event,_allDay}) =====
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function clip(s, n) { s = String(s == null ? '' : s); return esc(s.length > n ? s.slice(0, n - 1) + '…' : s); }
function renderHeute(x, y, w, h) {
    var tbl = getState('ical.0.data.table'), arr = (tbl && tbl.val) ? tbl.val : [];
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { arr = []; } }
    var now = new Date(), todayKey = now.toDateString(), evs = [];
    (arr || []).forEach(function (e) {
        var dt = e && e._date ? new Date(e._date) : null;
        if (!dt || isNaN(dt.getTime()) || dt.toDateString() !== todayKey) return;
        evs.push({ dt: dt, allDay: e._allDay === true, title: e.event || '' });
    });
    evs.sort(function (a, b) { return a.dt - b.dt; });

    var p = [rr(x, y, w, h, CARD_RAD, PANEL, BORDER), T(x + 18, y + 30, VAL, 17, null, 'Heute')];
    p.push(T(x + w - 18, y + 30, LBL, 13, 'end', DAYS[now.getDay()] + ', ' + now.getDate() + '. ' + MONTHS[now.getMonth()]));
    if (!evs.length) {
        p.push(T(x + 18, y + h / 2 + 6, LBL, 14, null, 'Keine Termine heute'));
        return p.join('');
    }
    var ry = y + 60, step = 30, maxRows = 5;
    evs.slice(0, maxRows).forEach(function (e) {
        var time = e.allDay ? 'ganztägig' : ('0' + e.dt.getHours()).slice(-2) + ':' + ('0' + e.dt.getMinutes()).slice(-2);
        p.push('<circle cx="' + (x + 24) + '" cy="' + (ry - 4) + '" r="3" fill="' + BLUE + '"/>');
        p.push(T(x + 36, ry, LBL, 13, null, time));
        p.push(T(x + 104, ry, VAL, 14, null, clip(e.title, 28)));
        ry += step;
    });
    if (evs.length > maxRows) p.push(T(x + 36, ry, LBL, 12, null, '+ ' + (evs.length - maxRows) + ' weitere'));
    return p.join('');
}

function ph(x, y, w, h, title) {
    return rr(x, y, w, h, CARD_RAD, PANEL, BORDER) + T(x + 18, y + 32, VAL, 17, null, title)
        + T(x + 18, y + h / 2 + 10, LBL, 14, null, '… folgt');
}

function renderMainV2() {
    var W = 1170, H = 676, p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">'];

    // ===== glance band: time + date (left); weather cluster (right): icon (native overlay) ·
    //       big Außen temp · bigger forecast min/max · Auf/Untergang · Luftdruck =====
    var d = new Date();
    var hhmm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    p.push(T(34, 82, VAL, 72, null, hhmm));
    p.push(T(40, 114, LBL, 22, null, DAYS[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS[d.getMonth()]));
    var ot = sNum(OUTDOOR + '.Temperature.Temperature'), mn = sNum(FCMIN), mx = sNum(FCMAX);
    var sr = getState('javascript.0.sunrise'), ss = getState('javascript.0.sunset');
    var pr = sNum(NB + '.Pressure.Pressure'), prt = getState(NB + '.Pressure.PressureTrend');
    var trend = (prt && prt.val === 'up') ? '&#8593;' : ((prt && prt.val === 'down') ? '&#8595;' : '&#8594;');
    p.push(T(W - 28, 46, LBL, 18, 'end', 'Außen'));
    p.push(T(W - 28, 128, comfortCol(ot), 88, 'end', comma(ot, 1) + '°'));
    p.push(T(W - 28, 164, LBL, 28, 'end',
        '<tspan fill="' + comfortCol(mn) + '">&#8595; ' + comma(mn, 0) + '°</tspan>     <tspan fill="' + comfortCol(mx) + '">&#8593; ' + comma(mx, 0) + '°</tspan>'));
    // sun + pressure column (weather icon is a native widget overlaying ~x560)
    p.push(T(706, 60, LBL, 17, null, 'Aufgang  ' + ((sr && sr.val) ? sr.val : '–')));
    p.push(T(706, 90, LBL, 17, null, 'Untergang  ' + ((ss && ss.val) ? ss.val : '–')));
    p.push(T(706, 124, LBL, 17, null, (pr != null ? Math.round(pr) + ' mbar  ' + trend : '–')));
    p.push('<line x1="20" y1="180" x2="' + (W - 20) + '" y2="180" stroke="' + BORDER + '"/>');

    // ===== Klima zone (Bubble rows, keep-all) =====
    var kx = 4, ky = 192, kw = 386, kh = 462;
    p.push(rr(kx, ky, kw, kh, CARD_RAD, PANEL, BORDER));
    p.push(T(kx + 18, ky + 32, VAL, 17, null, 'Klima'));
    var bx = kx + 14, bw = kw - 28, bh = 78, gap = ROW_GAP, by = ky + 46;
    ROWS.forEach(function (r, i) { p.push(bubble(bx, by, bw, bh, r[0], r[1], i === 0)); by += bh + gap; });

    // ===== zones: Heute (calendar) · Energie (hub, Bubble style) · Tanken · Steuerung (TODO) =====
    p.push(renderHeute(396, 192, 386, 224));
    p.push(renderEnergie(788, 192, 386, 224));
    p.push(renderTanken(396, 422, 386, 232));
    p.push(ph(788, 422, 386, 232, 'Steuerung'));   // interactive → native widgets, pending scope

    p.push('</svg>');
    return p.join('');
}

function publish() { setState('main_v2_card', renderMainV2()); }

createState('main_v2_card', '', { desc: 'Main-Redesign Prototyp (SVG)', type: 'string', role: 'html' }, function () {
    publish();
});

ROWS.forEach(function (r) {
    ['.Temperature.Temperature', '.Humidity.Humidity', '.CO2.CO2', '.LastUpdate', '.BatteryStatus'].forEach(function (s) {
        on({ id: r[1] + s, change: 'ne' }, publish);
    });
});
on({ id: FCMIN, change: 'ne' }, publish);
on({ id: FCMAX, change: 'ne' }, publish);
on({ id: 'tankerkoenig.0.stations.1.diesel.feed', change: 'ne' }, publish);
on({ id: 'tankerkoenig.0.stations.1.e5.feed', change: 'ne' }, publish);
['power_production', 'power_maxxisun', 'power_feedin', 'power_purchased', 'power_consumption', 'rate_autarky', 'power_data_stale'].forEach(function (s) {
    on({ id: EN_NS + s, change: 'ne' }, publish);
});
on({ id: EN_NS + 'tibber_states.energy_price_euro', change: 'ne' }, publish);
on({ id: 'ical.0.data.table', change: 'ne' }, publish);
schedule('*/20 * * * * *', publish);
