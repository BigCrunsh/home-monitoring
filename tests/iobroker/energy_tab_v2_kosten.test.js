// Energie tab "Kosten · Netzbezug" card (energy_tab_v2.js buildPeriod). A month used to be judged
// against the month before it, so every autumn month showed a red-flag "▲ 144 % vs. Sep" although
// October always costs more than September (less sun). It is now judged against the same month a
// year earlier, says whether usage or price drove the change, and shows the last 13 months as bars.
// The months come from InfluxDB as last_month points read with first(): the backfilled ex-tax value
// sits at 00:00 UTC on the 1st, ahead of the live collector's points from before 2026-10-31, which
// stored the gross totalCost.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const T = 'javascript.0.tibber_states.';
const RealDate = Date;
const AMBER = '#F1BE3D', GREEN = '#b5fb5b', MUTED = '#8A8A8A';

// the whole script booted with the clock fixed at `isoBerlin` (an offset-free local Berlin time).
// `months` = { 'YYYY-MM': { cost, kwh } } is what InfluxDB holds for each completed month.
function load(isoBerlin, states, months) {
    const fixed = new RealDate(new RealDate(isoBerlin + '+02:00').getTime());
    class FakeDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(fixed.getTime()); }
        static now() { return fixed.getTime(); }
    }
    const st = {};
    Object.keys(states).forEach((k) => { st[T + k] = { val: states[k], ts: fixed.getTime() }; });
    const queries = [], written = {};
    function answer(statement) {
        const m = statement.match(/period = 'last_month'.*time >= '(\d{4}-\d{2})-01/);
        if (!m) return [];
        // the value stored at the start of month M+1 is month M
        const [y, mo] = m[1].split('-').map(Number);
        const key = mo === 1 ? (y - 1) + '-12' : y + '-' + String(mo - 1).padStart(2, '0');
        const row = months[key];
        if (!row) return [];
        const field = /electricity_costs_euro/.test(statement) ? 'cost' : 'kwh';
        return row[field] == null ? [] : [{ ts: fixed.getTime(), [field]: row[field] }];
    }
    const ctx = {
        console: { log() {}, warn() {}, error() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        setState: (id, v) => { written[id] = v; },
        createState() {}, on() {}, schedule() {}, setTimeout() {}, log() {},
        sendTo: (inst, cmd, q, cb) => {
            queries.push(q);
            if (months === 'error') return cb({ error: 'influx down' });
            cb({ result: q.split(';').map((s) => answer(s)) });
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
// on 16 Oct at noon half the month (15.5 of 31 days) is gone: 20 € so far → 40 € forecast
const NOW = { cost_this_month: 20, consumption_grid_this_month: 50, cost_last_month: 30, cost_this_year: 240, cost_last_year: 550 };
const HISTORY = {
    '2025-10': { cost: 50, kwh: 100 }, '2025-11': { cost: 80, kwh: 180 }, '2025-12': { cost: 100, kwh: 250 },
    '2026-01': { cost: 90, kwh: 240 }, '2026-02': { cost: 80, kwh: 220 }, '2026-03': { cost: 55, kwh: 150 },
    '2026-04': { cost: 25, kwh: 70 }, '2026-05': { cost: 15, kwh: 45 }, '2026-06': { cost: 7, kwh: 20 },
    '2026-07': { cost: 7, kwh: 20 }, '2026-08': { cost: 4, kwh: 12 }, '2026-09': { cost: 19, kwh: 47 }
};
function rowOf(html, label) {
    const i = html.indexOf('>' + label + '<');
    assert.ok(i >= 0, 'row not found: ' + label);
    const start = html.lastIndexOf('<div class="pr"', i);
    const next = html.indexOf('<div class="pr"', i + 1);
    return html.slice(start, next > 0 ? next : html.indexOf('<div class="mchart"', i));
}
function booted(isoBerlin, states, months) {
    const ctx = load(isoBerlin, states, months);
    ctx.queryMonthHistory();
    return ctx;
}

test('kosten: the month is judged against the same month last year', () => {
    const r = rowOf(booted('2026-10-16T12:00:00', NOW, HISTORY).buildPeriod(), 'Okt');
    // 40 € forecast vs. 50 € in Oct 2025
    assert.match(r, new RegExp('class="pv" style="color:' + GREEN + '">40 €'));
    assert.match(r, /▼ 20 % vs\. Okt 25 · 50 €/);
    assert.match(r, /bisher 20 €/);
});

test('kosten: the month line says whether usage or price moved the cost', () => {
    const r = rowOf(booted('2026-10-16T12:00:00', NOW, HISTORY).buildPeriod(), 'Okt');
    // 50 kWh so far → 100 kWh forecast = same as Oct 2025; 0,40 €/kWh vs. 0,50 €/kWh
    assert.match(r, /Verbrauch ± 0 %/);
    assert.match(r, /Ø-Preis ▼ 20 %/);
});

test('kosten: without last year\'s month the previous month is shown grey, without a verdict', () => {
    const history = Object.assign({}, HISTORY, { '2025-10': undefined });
    const r = rowOf(booted('2026-10-16T12:00:00', NOW, history).buildPeriod(), 'Okt');
    assert.match(r, new RegExp('class="pv" style="color:#CCCCCC">40 €'));
    assert.match(r, new RegExp('class="pd" style="color:' + MUTED + '">▲ 111 % vs\\. Sep · 19 €'));
    assert.doesNotMatch(r, /Ø-Preis/);
});

test('kosten: a dearer month than last year is amber once it is more than 5 % up', () => {
    const r = rowOf(booted('2026-10-16T12:00:00', Object.assign({}, NOW, { cost_this_month: 30 }), HISTORY).buildPeriod(), 'Okt');
    assert.match(r, new RegExp('class="pv" style="color:' + AMBER + '">60 €'));
    assert.match(r, /▲ 20 % vs\. Okt 25/);
});

test('kosten: the year forecast adds last year\'s remaining months to the rest of this month', () => {
    const r = rowOf(booted('2026-10-16T12:00:00', NOW, HISTORY).buildPeriod(), '2026');
    // 240 so far + (40 - 20) rest of October + 80 Nov + 100 Dec last year
    assert.match(r, new RegExp('color:' + GREEN + '">440 €'));
    assert.match(r, /▼ 20 % vs\. 2025/);
});

test('kosten: the twelve completed months are read with first(), from the start of each following month', () => {
    const ctx = booted('2026-10-16T12:00:00', NOW, HISTORY);
    const starts = ctx.queries.map((q) => (q.match(/time >= '(\d{4}-\d{2}-\d{2})/) || [])[1]);
    assert.equal(starts.length, 12);
    assert.equal(starts[0], '2025-11-01');
    assert.equal(starts[11], '2026-10-01');
    ctx.queries.forEach((q) => {
        assert.match(q, /first\(cost\)/);
        assert.doesNotMatch(q, /last\(/);
    });
});

test('kosten: one missing month of last year falls back to a linear year, never a partial sum', () => {
    const history = Object.assign({}, HISTORY, { '2025-11': undefined });
    // 240 / (288.5 / 365)
    assert.match(rowOf(booted('2026-10-16T12:00:00', NOW, history).buildPeriod(), '2026'), />304 €/);
});

test('kosten: an Influx error falls back to linear, shows no chart bars and does not throw', () => {
    const ctx = load('2026-10-16T12:00:00', NOW, 'error');
    assert.doesNotThrow(() => ctx.queryMonthHistory());
    const h = ctx.buildPeriod();
    assert.match(rowOf(h, '2026'), />304 €/);
    assert.doesNotMatch(h, /class="mb past"/);
});

test('kosten: early in the month there is no month forecast and no verdict', () => {
    const h = booted('2026-10-02T06:00:00', Object.assign({}, NOW, { cost_this_month: 2 }), HISTORY).buildPeriod();
    assert.match(rowOf(h, 'Okt'), /class="pv"[^>]*>–</);
    // 240 + (50 - 2) rest of October as last year + 80 + 100
    assert.match(rowOf(h, '2026'), />468 €/);
});

test('kosten: the bar shows bisher solid and the forecast as a tint of the verdict colour', () => {
    const r = rowOf(booted('2026-10-16T12:00:00', NOW, HISTORY).buildPeriod(), 'Okt');
    assert.match(r, new RegExp('class="done" style="width:[\\d.]+%;background:' + GREEN + '"'));
    assert.match(r, new RegExp('class="fc" style="width:[\\d.]+%;background:' + GREEN + '"'));
    assert.match(r, /class="mk"/);
});

test('kosten: thirteen month bars run from the same month last year to this month', () => {
    const h = booted('2026-10-16T12:00:00', NOW, HISTORY).buildPeriod();
    assert.equal((h.match(/class="mb /g) || []).length, 13);
    assert.match(h, /class="mb yoy"[^>]*>[\s\S]*?50 €/);
    assert.match(h, /class="mb now"/);
});

test('kosten: a month missing from the history leaves an empty slot, the rest still draw', () => {
    const history = Object.assign({}, HISTORY, { '2026-03': undefined });
    const h = booted('2026-10-16T12:00:00', NOW, history).buildPeriod();
    assert.equal((h.match(/class="mb past"/g) || []).length, 10);
    assert.equal((h.match(/class="mb gap"/g) || []).length, 1);
});

test('kosten: the card fills its 642 × 302 widget and names the energy-only basis', () => {
    const h = booted('2026-10-16T12:00:00', NOW, HISTORY).buildPeriod();
    assert.match(h, /width="642" height="302"/);
    assert.match(h, /ohne Grundgebühr/);
    assert.doesNotMatch(h, /\d,\d\d €/);
});
