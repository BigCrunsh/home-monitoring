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

test('verlauf: Haus is drawn and labelled in neutral white, never in the cold blue', () => {
    const ctx = load({ curve: SUNNY });
    ctx.queryCurve();
    const h = ctx.buildCurve();
    assert.match(h, new RegExp('stroke="' + TEXT + '" stroke-width="2.5"'));
    assert.match(h, new RegExp('fill="' + TEXT + '"[^>]*>Haus 0,5 kW'));
    assert.doesNotMatch(h.split('</style>')[1], new RegExp(BLUE));
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

test('preis: the narrower header keeps the tier legend and drops the repeated current price', () => {
    const ctx = load({ forecast: Array.from({ length: 40 }, () => 0.45) });
    const h = ctx.buildPrice();
    assert.match(h, /günstig/);
    assert.match(h, /teuer/);
    assert.doesNotMatch(h, /15-min-Preise/);
    assert.doesNotMatch(h, /jetzt <span/);
});
