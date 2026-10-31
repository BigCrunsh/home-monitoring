// Energie tab re-layout (2026-10-31): the 24 h curve and the price preview shrink to two thirds of
// their width so the Kosten card can grow, and each series keeps one colour across the tab. Haus
// was red in Energiefluss, blue in Verlauf and Bilanz — and blue means "cold/info" on this
// dashboard. Haus is now the neutral white of the clock wherever it is a series.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const TEXT = '#CCCCCC', BLUE = '#5080AC';
const HOUR = 3600e3;

// curve: { '<state id fragment>': watts } — a flat 26 h series per id; forecast: €/kWh per quarter
function load({ curve = {}, forecast = null } = {}) {
    const now = Date.now();
    const ctx = {
        console: { log() {}, warn() {}, error() {} },
        getState: () => null, existsState: () => false,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}, log() {},
        sendTo: (inst, cmd, q, cb) => {
            if (/electricity_price_forecast_euro/.test(q)) {
                if (!forecast) return cb({ result: [[]] });
                const rows = forecast.map((p, i) => ({ ts: now - 90 * 60e3 + i * 900e3, total: p }));
                return cb({ result: [rows] });
            }
            const id = Object.keys(curve).find((k) => q.includes(k));
            if (!id) return cb({ result: [[]] });
            const rows = [];
            for (let t = now - 26 * HOUR; t <= now; t += 10 * 60e3) rows.push({ ts: t, v: curve[id] });
            cb({ result: [rows] });
        }
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'energy_tab_v2.js'), 'utf8'), ctx);
    return ctx;
}
const SUNNY = { power_production: 1400, power_consumption: 450, power_maxxisun: -240 };

test('verlauf: the curve card is 516 × 246', () => {
    const ctx = load({ curve: SUNNY });
    ctx.queryCurve();
    assert.match(ctx.buildCurve(), /^<svg[^>]*width="516" height="246"/);
});

// Owner review 2026-10-31: the curve was "clunky" — text inside the plot, the battery in its own lane
// on its own scale. Now every series shares one kW axis and is told apart by colour only:
// Erzeugung green, Haus white, Akku blue (feeding in above zero, charging below).
function plotOf(h) { return h.split('</style>')[1]; }
function pathOf(h, colour) {
    const m = plotOf(h).match(new RegExp('<path d="([^"]+)" fill="none" stroke="' + colour + '"'));
    assert.ok(m, 'no line drawn in ' + colour);
    return m[1].split(/[ML]/).filter(Boolean).map((p) => p.split(',').map(Number));
}

test('verlauf: Erzeugung green, Haus white and Akku blue are lines on one shared kW scale', () => {
    // production and battery output both 1,4 kW → the two lines end at the same height
    const ctx = load({ curve: { power_production: 1400, power_consumption: 450, power_maxxisun: -1400 } });
    ctx.queryCurve();
    const h = ctx.buildCurve();
    const prod = pathOf(h, '#b5fb5b'), haus = pathOf(h, TEXT), akku = pathOf(h, BLUE);
    assert.equal(akku[akku.length - 1][1], prod[prod.length - 1][1]);
    assert.ok(haus[haus.length - 1][1] > prod[prod.length - 1][1], 'Haus (0,45 kW) sits below 1,4 kW');
});

test('verlauf: a charging battery dips below the zero line, a feeding one rises above it', () => {
    const feeding = load({ curve: { power_production: 1400, power_consumption: 450, power_maxxisun: -500 } });
    feeding.queryCurve();
    const charging = load({ curve: { power_production: 1400, power_consumption: 450, power_maxxisun: 500 } });
    charging.queryCurve();
    const zeroOf = (h) => Number(plotOf(h).match(/class="zero" x1="[\d.]+" y1="([\d.]+)"/)[1]);
    const up = pathOf(feeding.buildCurve(), BLUE), down = pathOf(charging.buildCurve(), BLUE);
    assert.ok(up[up.length - 1][1] < zeroOf(feeding.buildCurve()), 'feeding in must sit above zero');
    assert.ok(down[down.length - 1][1] > zeroOf(charging.buildCurve()), 'charging must sit below zero');
});

test('verlauf: no text inside the plot — only axis ticks and the legend', () => {
    const ctx = load({ curve: SUNNY });
    ctx.queryCurve();
    const full = ctx.buildCurve();
    const h = full.slice(full.indexOf('<svg width'));   // the plot itself; the legend above may name the series
    assert.doesNotMatch(h, />Erzeugung [\d,]+ kW</);
    assert.doesNotMatch(h, />Haus [\d,]+ kW</);
    assert.doesNotMatch(h, /speist|lädt|>Maxxisun</);
});

test('verlauf: the legend names the three series and drops "jetzt"', () => {
    const ctx = load({ curve: SUNNY });
    ctx.queryCurve();
    const head = ctx.buildCurve().split('class="card-h"')[1].split('</div>')[0];
    assert.match(head, />Erzeugung</);
    assert.match(head, />Haus</);
    assert.match(head, />Akku ↑ speist ↓ lädt</);
    assert.doesNotMatch(head, /jetzt/);
});

test('verlauf: without battery data the other two series still draw', () => {
    const ctx = load({ curve: { power_production: 1400, power_consumption: 450 } });
    ctx.queryCurve();
    const h = ctx.buildCurve();
    assert.ok(pathOf(h, TEXT).length > 2);
    assert.doesNotMatch(plotOf(h), new RegExp('stroke="' + BLUE + '"'));
});

test('verlauf: without data the placeholder keeps the new size', () => {
    const ctx = load();
    ctx.queryCurve();
    const h = ctx.buildCurve();
    assert.match(h, /width="516" height="246"/);
    assert.match(h, /Warte auf Verlaufsdaten/);
});

test('preis: the price preview is 516 × 244', () => {
    const ctx = load({ forecast: Array.from({ length: 40 }, (_, i) => 0.4 + (i % 8) * 0.02) });
    assert.match(ctx.buildPrice(), /^<svg[^>]*width="516" height="244"/);
});

test('preis: without a forecast the placeholder keeps the new size', () => {
    const ctx = load();
    const h = ctx.buildPrice();
    assert.match(h, /width="516" height="244"/);
    assert.match(h, /Vorschau/);
});

// review finding 2026-10-31: like the curve, the price plot carries no text but its axes; the cheapest
// window is still worth acting on, so it moves into a caption under the plot
test('preis: no "jetzt" and no window text inside the plot, the cheap window as a caption', () => {
    const ctx = load({ forecast: Array.from({ length: 40 }, (_, i) => 0.4 + (i % 8) * 0.02) });
    ctx.queryForecast();
    const h = ctx.buildPrice();
    assert.match(h, /<svg width/, 'the plot must be drawn, not the placeholder');
    const svg = h.slice(h.indexOf('<svg width'), h.lastIndexOf('</svg>', h.lastIndexOf('</foreignObject>')));
    assert.doesNotMatch(svg, />jetzt</);
    assert.doesNotMatch(svg, /günstig \d/);
    assert.match(h, /class="pcap"[^>]*>günstig \d{2}(:\d{2})?–\d{2}(:\d{2})? · Ø [\d,]+ €</);
});

test('preis: without a future window there is no caption', () => {
    // a short forecast that has already passed: no 4 h window left
    const ctx = load({ forecast: Array.from({ length: 8 }, () => 0.45) });
    ctx.queryForecast();
    const h = ctx.buildPrice();
    assert.match(h, /<svg width/, 'the plot must be drawn, not the placeholder');
    assert.doesNotMatch(h, /class="pcap"/);
});

test('preis: the narrower header keeps the tier legend and drops the repeated current price', () => {
    const ctx = load({ forecast: Array.from({ length: 40 }, () => 0.45) });
    const h = ctx.buildPrice();
    assert.match(h, /günstig/);
    assert.match(h, /teuer/);
    assert.doesNotMatch(h, /15-min-Preise/);
    assert.doesNotMatch(h, /jetzt <span/);
});
