// Energiefluss card (energy_tab_v2.js buildFlow). The tab showed numbers and colours but never said
// whether things were going well; the header now carries that takeaway — the month's forecast
// judged against the same month last year, the same verdict as the Kosten card. "Eigenverbrauch
// gespart €/h" left the card: the Bilanz already says what today saved.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const EN = 'javascript.0.', T = EN + 'tibber_states.';
const RealDate = Date;
const GREEN = '#b5fb5b', TEXT = '#CCCCCC';

function load(isoBerlin, tibber, months, extra = {}) {
    const fixed = new RealDate(new RealDate(isoBerlin + '+02:00').getTime());
    class FakeDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(fixed.getTime()); }
        static now() { return fixed.getTime(); }
    }
    const st = {};
    Object.keys(tibber).forEach((k) => { st[T + k] = { val: tibber[k], ts: fixed.getTime() }; });
    Object.keys(extra).forEach((k) => { st[EN + k] = { val: extra[k], ts: fixed.getTime() }; });
    const ctx = {
        console: { log() {}, warn() {}, error() {} },
        getState: (id) => st[id] || null, existsState: (id) => id in st,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}, log() {},
        sendTo: (inst, cmd, q, cb) => {
            cb({ result: q.split(';').map((s) => {
                const m = s.match(/time >= '(\d{4}-\d{2})-01/);
                const row = m && months[m[1]];
                if (!row) return [];
                return /electricity_costs_euro/.test(s) ? [{ cost: row.cost }] : [{ kwh: row.kwh }];
            }) });
        },
        Date: FakeDate
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'energy_tab_v2.js'), 'utf8'), ctx);
    ctx.queryMonthHistory();
    return ctx;
}
function header(h) { return h.slice(h.indexOf('class="card-h"'), h.indexOf('</div>', h.indexOf('class="card-h"'))); }
// owner review 2026-10-31: at 15 px in the header the takeaway was unreadable across the room — it is
// now the first figure block of the card, the forecast as big as the price and the net rate
function take(h) { return h.slice(h.indexOf('class="take"'), h.indexOf('class="stat"', h.indexOf('class="take"'))); }
// keyed by the window start: October 2025 is stored at the start of November 2025
const LAST_OCTOBER = { '2025-11': { cost: 50, kwh: 100 } };
const MID_OCTOBER = { energy_price_euro: 0.45, cost_this_month: 20, consumption_grid_this_month: 50 };

test('flow: the takeaway says where the month is heading, judged against last year', () => {
    const h = take(load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER).buildFlow());
    assert.match(h, />Oktober auf Kurs</);
    assert.match(h, new RegExp('class="tv" style="color:' + GREEN + '">40<span class="u"> €</span>'));
    assert.match(h, new RegExp('class="ts" style="color:' + GREEN + '">▼ 20 % vs\\. Vorjahr'));
});

test('flow: the takeaway left the header line', () => {
    assert.doesNotMatch(header(load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER).buildFlow()), /auf Kurs/);
});

test('flow: without last year\'s month the forecast stands alone, without a verdict', () => {
    const h = take(load('2026-10-16T12:00:00', MID_OCTOBER, {}).buildFlow());
    assert.match(h, new RegExp('class="tv" style="color:' + TEXT + '">40<'));
    assert.doesNotMatch(h, /Vorjahr/);
});

test('flow: early in the month the takeaway shows what is spent so far', () => {
    const h = take(load('2026-10-02T06:00:00', Object.assign({}, MID_OCTOBER, { cost_this_month: 2 }), LAST_OCTOBER).buildFlow());
    assert.match(h, />Oktober bisher</);
    assert.match(h, /class="tv"[^>]*>2</);
});

// the card renders every 30 s from boot, before the month history has arrived from InfluxDB
test('flow: the takeaway gains its verdict as soon as the month history arrives', () => {
    const written = {};
    const ctx = load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER);
    ctx.setState = (id, v) => { written[id] = v; };
    ctx.queryMonthHistory();
    assert.match(take(written['javascript.0.et3_flow']), /vs\. Vorjahr/);
});

test('flow: the saved-per-hour figure left the card; the net rate stays', () => {
    const h = load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER).buildFlow();
    assert.doesNotMatch(h, /Eigenverbrauch gespart/);
    assert.match(h, />Netto</);
});

// owner review 2026-10-31: the bars took most of the card, the figures on the right were squeezed
// and jumped sideways whenever a value grew a digit
test('flow: the bars get a fixed share and the figures fixed-width columns', () => {
    const h = load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER).buildFlow();
    assert.match(h, /class="flows" style="width:520px/);
    assert.match(h, /class="stats" style="[^"]*grid-template-columns:\s*230px 200px 160px/);
});

test('flow: a two-digit net rate renders in the same column as a one-digit one', () => {
    const small = load('2026-10-16T12:00:00', Object.assign({}, MID_OCTOBER), LAST_OCTOBER, { power_purchased: 500 }).buildFlow();
    const big = load('2026-10-16T12:00:00', Object.assign({}, MID_OCTOBER, { energy_price_euro: 0.6 }), LAST_OCTOBER, { power_purchased: 21000 }).buildFlow();
    const statsOf = (h) => h.match(/class="stats" style="([^"]*)"/)[1];
    assert.equal(statsOf(small), statsOf(big));
    assert.match(big, />\+12,60</);
});

// review finding 2026-10-31: Haus was a red bar here but the white series everywhere else; the bars now
// carry each quantity's colour from the curve and the Bilanz, the verdict stays on the number
test('flow: bars carry the series colours, the numbers keep their verdict', () => {
    const h = load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER,
        { power_purchased: 2500, power_consumption: 2900, power_production: 300, power_maxxisun: -240 }).buildFlow();
    const row = (label) => h.slice(h.indexOf('>' + label), h.indexOf('</div>', h.indexOf('>' + label)));
    assert.match(row('Netz'), /class="fill" style="width:\d+%;background:#F1BE3D"/);
    assert.match(row('Haus'), /class="fill" style="width:\d+%;background:#CCCCCC"/);
    assert.match(row('SolarEdge'), new RegExp('class="fill" style="width:\\d+%;background:' + GREEN + '"'));
    assert.match(row('Maxxisun'), /class="fill" style="width:\d+%;background:#5080AC"/);
    // a high Haus draw is still flagged on the number
    assert.match(row('Haus'), /class="fv" style="color:#A00629"/);
});

test('flow: a stale reading greys the Haus number but keeps the bar in its series colour', () => {
    const h = load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER, { power_consumption: 900, power_data_stale: true }).buildFlow();
    const row = h.slice(h.indexOf('>Haus'), h.indexOf('</div>', h.indexOf('>Haus')));
    assert.match(row, /class="fill" style="width:\d+%;background:#CCCCCC"/);
    assert.match(row, /class="fv" style="color:#8A8A8A">≈ /);
});

test('flow: a stale power reading is still flagged next to the takeaway', () => {
    const h = load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER, { power_data_stale: true }).buildFlow();
    assert.match(header(h), /Schätzwert/);
    assert.match(take(h), /auf Kurs/);
});
