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
// keyed by the window start: October 2025 is stored at the start of November 2025
const LAST_OCTOBER = { '2025-11': { cost: 50, kwh: 100 } };
const MID_OCTOBER = { energy_price_euro: 0.45, cost_this_month: 20, consumption_grid_this_month: 50 };

test('flow: the header says where the month is heading, judged against last year', () => {
    const h = header(load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER).buildFlow());
    assert.match(h, /Oktober auf Kurs:/);
    assert.match(h, new RegExp('color:' + GREEN + '[^"]*">40 € · ▼ 20 % vs\\. Vorjahr'));
});

test('flow: without last year\'s month the forecast stands alone, without a verdict', () => {
    const h = header(load('2026-10-16T12:00:00', MID_OCTOBER, {}).buildFlow());
    assert.match(h, new RegExp('color:' + TEXT + '[^"]*">40 €<'));
    assert.doesNotMatch(h, /Vorjahr/);
});

test('flow: early in the month the header shows what is spent so far', () => {
    const h = header(load('2026-10-02T06:00:00', Object.assign({}, MID_OCTOBER, { cost_this_month: 2 }), LAST_OCTOBER).buildFlow());
    assert.match(h, /Oktober bisher:/);
    assert.match(h, />2 €</);
});

// the card renders every 30 s from boot, before the month history has arrived from InfluxDB
test('flow: the takeaway gains its verdict as soon as the month history arrives', () => {
    const written = {};
    const ctx = load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER);
    ctx.setState = (id, v) => { written[id] = v; };
    ctx.queryMonthHistory();
    assert.match(header(written['javascript.0.et3_flow']), /vs\. Vorjahr/);
});

test('flow: the saved-per-hour figure left the card; the net rate stays', () => {
    const h = load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER).buildFlow();
    assert.doesNotMatch(h, /Eigenverbrauch gespart/);
    assert.match(h, />Netto</);
});

test('flow: a stale power reading is still flagged next to the takeaway', () => {
    const h = header(load('2026-10-16T12:00:00', MID_OCTOBER, LAST_OCTOBER, { power_data_stale: true }).buildFlow());
    assert.match(h, /Schätzwert/);
    assert.match(h, /auf Kurs/);
});
