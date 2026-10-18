// Energie tab "Kosten · Netzbezug" card (energy_tab_v2.js buildPeriod). The old card packed "bisher →
// Prognose · Vorperiode" into three unlabeled columns, clipped "September 29,97 €" at the edge, and its
// linear year forecast ignored that Nov/Dec are the dearest months (Oct: 305 € linear vs. ~447 € with
// last year's Nov+Dec). Now: forecast + change vs. the previous period first, a bar for bisher /
// Prognose / previous-period marker, and a year forecast that adds last year's remaining months.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const T = 'javascript.0.tibber_states.';
const RealDate = Date;
const AMBER = '#F1BE3D', GREEN = '#b5fb5b';

// the whole script booted with the clock fixed at `isoBerlin` (an offset-free local Berlin time) and
// Influx answering `lastMonthRows` = { '<window start ISO date>': cost } for last_month lookups
function load(isoBerlin, costs, lastMonthRows) {
    const fixed = new RealDate(new RealDate(isoBerlin + '+02:00').getTime());
    class FakeDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(fixed.getTime()); }
        static now() { return fixed.getTime(); }
    }
    const st = {};
    Object.keys(costs).forEach((k) => { st[T + k] = { val: costs[k], ts: fixed.getTime() }; });
    const queries = [], written = {};
    const ctx = {
        console: { log() {}, warn() {}, error() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        setState: (id, v) => { written[id] = v; },
        createState() {}, on() {}, schedule() {}, setTimeout() {}, log() {},
        sendTo: (inst, cmd, q, cb) => {
            queries.push(q);
            const m = q.match(/period = 'last_month' AND time >= '(\d{4}-\d{2}-\d{2})/);
            if (!m) return cb({ result: [[]] });
            if (lastMonthRows === 'error') return cb({ error: 'influx down' });
            const v = lastMonthRows[m[1]];
            cb({ result: [v == null ? [] : [{ ts: fixed.getTime(), cost: v }]] });
        },
        Date: FakeDate
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'energy_tab_v2.js'), 'utf8'), ctx);
    ctx.queries = queries;
    ctx.written = written;
    return ctx;
}
const COSTS = { cost_this_month: 20, cost_last_month: 30, cost_this_year: 240, cost_last_year: 550 };
// last year's Oct, Nov, Dec totals, stored as last_month at the start of the following month
const LY = { '2025-11-01': 25, '2025-12-01': 80, '2026-01-01': 100 };
function rowOf(html, label) {
    const i = html.indexOf('>' + label + '<');
    assert.ok(i >= 0, 'row not found: ' + label);
    return html.slice(html.lastIndexOf('<div class="pr"', i), html.indexOf('<div class="pr"', i + 1) > 0 ? html.indexOf('<div class="pr"', i + 1) : undefined);
}

test('kosten: the month row leads with the forecast and its change vs. last month', () => {
    const ctx = load('2026-10-16T12:00:00', COSTS, LY);
    const r = rowOf(ctx.buildPeriod(), 'Okt');
    assert.match(r, new RegExp('color:' + AMBER + '">40 €'));
    assert.match(r, /▲ 33 % vs\. Sep/);
    assert.match(r, /bisher 20 €/);
});

test('kosten: the year forecast adds last year\'s remaining months to the rest of this month', () => {
    const ctx = load('2026-10-16T12:00:00', COSTS, LY);
    ctx.queryYearTail();
    const r = rowOf(ctx.buildPeriod(), '2026');
    // 240 so far + (40 - 20) rest of October + 80 Nov + 100 Dec last year
    assert.match(r, new RegExp('color:' + GREEN + '">440 €'));
    assert.match(r, /▼ 20 % vs\. 2025/);
});

test('kosten: the tail is looked up as last_month at the start of each following month', () => {
    const ctx = load('2026-10-16T12:00:00', COSTS, LY);
    ctx.queryYearTail();
    const starts = ctx.queries.map((q) => (q.match(/time >= '(\d{4}-\d{2}-\d{2})/) || [])[1]).filter(Boolean);
    assert.deepEqual(starts, ['2025-11-01', '2025-12-01', '2026-01-01']);
});

test('kosten: without last year\'s months the year forecast falls back to linear', () => {
    const ctx = load('2026-10-16T12:00:00', COSTS, {});
    ctx.queryYearTail();
    // 240 / (288.5 / 365)
    assert.match(rowOf(ctx.buildPeriod(), '2026'), />304 €/);
});

test('kosten: one missing month of last year also falls back to linear, never a partial sum', () => {
    const ctx = load('2026-10-16T12:00:00', COSTS, { '2025-11-01': 25, '2026-01-01': 100 });
    ctx.queryYearTail();
    assert.match(rowOf(ctx.buildPeriod(), '2026'), />304 €/);
});

// the live case on 2026-10-18: cost history starts 2025-12-04, so last October's total is unknown —
// it is only needed while this month has no forecast of its own
test('kosten: last year\'s current month is not needed once this month has a forecast', () => {
    const ctx = load('2026-10-16T12:00:00', COSTS, { '2025-12-01': 80, '2026-01-01': 100 });
    ctx.queryYearTail();
    assert.match(rowOf(ctx.buildPeriod(), '2026'), />440 €/);
});

test('kosten: early in the month without last year\'s current month the year falls back to linear', () => {
    const ctx = load('2026-10-02T06:00:00', Object.assign({}, COSTS, { cost_this_month: 2 }), { '2025-12-01': 80, '2026-01-01': 100 });
    ctx.queryYearTail();
    // 240 / ((274 + 0.25) / 365)
    assert.match(rowOf(ctx.buildPeriod(), '2026'), />319 €/);
});

test('kosten: an Influx error falls back to linear and does not throw', () => {
    const ctx = load('2026-10-16T12:00:00', COSTS, 'error');
    assert.doesNotThrow(() => ctx.queryYearTail());
    assert.match(rowOf(ctx.buildPeriod(), '2026'), />304 €/);
});

test('kosten: early in the month there is no month forecast; the year uses last year\'s whole month', () => {
    const ctx = load('2026-10-02T06:00:00', Object.assign({}, COSTS, { cost_this_month: 2 }), LY);
    ctx.queryYearTail();
    const h = ctx.buildPeriod();
    assert.match(rowOf(h, 'Okt'), /class="pv"[^>]*>–</);
    // 240 + (25 - 2) rest of October as last year + 80 + 100
    assert.match(rowOf(h, '2026'), />443 €/);
});

test('kosten: without a previous period there is no change label and no marker', () => {
    const ctx = load('2026-10-16T12:00:00', { cost_this_month: 20, cost_this_year: 240 }, LY);
    const h = ctx.buildPeriod();
    assert.doesNotMatch(h, /class="pd"/);
    assert.doesNotMatch(h, /class="mk"/);
});

test('kosten: whole euros, short month names, and the card fills its 124 px widget', () => {
    const ctx = load('2026-10-16T12:00:00', Object.assign({}, COSTS, { cost_this_month: 21.93 }), LY);
    const h = ctx.buildPeriod();
    assert.match(h, /height="124"/);
    assert.doesNotMatch(h, /September|Oktober/);
    assert.doesNotMatch(h, /\d,\d\d €/);
});
