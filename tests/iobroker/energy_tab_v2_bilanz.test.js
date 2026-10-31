// Energie tab "Heute · Bilanz" (energy_tab_v2.js buildBilanz + the midnight day log in integrateTick).
// Its "Ø 7 Tage: 98 %" read rate_autarky_7d, a state nothing had written since 19 Jul 2026 — a summer
// value shown all autumn. The average now comes from the tab's own day totals, logged at midnight.
// Today's autarky is judged against that average (green when better) instead of fixed thresholds
// that greyed every winter day; it is never amber, because a morning always trails a whole day.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const EN = 'javascript.0.';
const RealDate = Date;
const GREEN = '#b5fb5b', TEXT = '#CCCCCC', BLUE = '#5080AC';

// clock at `isoBerlin`; ctx.setClock() moves it. `states` = { '<id without javascript.0.>': val }
function load(isoBerlin, states) {
    let now = new RealDate(isoBerlin + '+01:00').getTime();
    class FakeDate extends RealDate {
        constructor(...a) { if (a.length) super(...a); else super(now); }
        static now() { return now; }
    }
    const st = {};
    Object.keys(states).forEach((k) => { st[EN + k] = { val: states[k], ts: now }; });
    const ctx = {
        console: { log() {}, warn() {}, error() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        setState: (id, v) => { st[id.startsWith(EN) ? id : EN + id] = { val: v, ts: now }; },
        createState() {}, on() {}, schedule() {}, setTimeout() {}, log() {}, sendTo() {},
        Date: FakeDate
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'energy_tab_v2.js'), 'utf8'), ctx);
    ctx.st = st;
    ctx.setClock = (iso) => { now = new RealDate(iso + '+01:00').getTime(); };
    return ctx;
}
// one finished day: totals in the today counters, then the clock passes midnight
function finishDay(ctx, day, cons, pur, nextMorningIso) {
    ctx.st[EN + 'energy_today_day'] = { val: day };
    ctx.st[EN + 'energy_today_consumption'] = { val: cons };
    ctx.st[EN + 'energy_today_purchased'] = { val: pur };
    ctx.setClock(nextMorningIso);
    ctx.integrateTick();
}
function autarkRow(h) { return h.slice(h.indexOf('>autark<'), h.indexOf('Kosten heute')); }

test('bilanz: the card is 642 × 188', () => {
    const ctx = load('2026-10-31T12:00:00', { energy_today_consumption: 4, energy_today_purchased: 3 });
    assert.match(ctx.buildBilanz(), /^<svg[^>]*width="642" height="188"/);
});

test('bilanz: the 7-day average comes from the logged day totals', () => {
    const ctx = load('2026-10-28T23:00:00', {});
    finishDay(ctx, '2026-10-28', 10, 8, '2026-10-29T00:01:00');
    finishDay(ctx, '2026-10-29', 10, 6, '2026-10-30T00:01:00');
    finishDay(ctx, '2026-10-30', 20, 10, '2026-10-31T00:01:00');
    // 1 - (8 + 6 + 10) / (10 + 10 + 20) = 40 %
    assert.match(autarkRow(ctx.buildBilanz()), /Ø 3 Tage: 40 %/);
});

test('bilanz: only the last seven days count', () => {
    const ctx = load('2026-10-20T23:00:00', {});
    finishDay(ctx, '2026-10-20', 10, 10, '2026-10-21T00:01:00');   // falls out of the window
    for (let d = 21; d <= 27; d++) finishDay(ctx, '2026-10-' + d, 10, 5, '2026-10-' + (d + 1) + 'T00:01:00');
    assert.match(autarkRow(ctx.buildBilanz()), /Ø 7 Tage: 50 %/);
});

test('bilanz: the stale rate_autarky_7d state is no longer shown', () => {
    const ctx = load('2026-10-31T12:00:00', { rate_autarky_7d: 0.98, energy_today_consumption: 4, energy_today_purchased: 3 });
    assert.doesNotMatch(ctx.buildBilanz(), /98 %/);
    assert.doesNotMatch(ctx.buildBilanz(), /Ø \d/);
});

test('bilanz: a day without consumption does not divide by zero', () => {
    const ctx = load('2026-10-30T23:00:00', {});
    finishDay(ctx, '2026-10-30', 0, 0, '2026-10-31T00:01:00');
    assert.doesNotMatch(autarkRow(ctx.buildBilanz()), /NaN|Infinity/);
});

test('bilanz: today above the average is green, below it stays neutral — never amber', () => {
    const above = load('2026-10-30T23:00:00', {});
    finishDay(above, '2026-10-30', 10, 8, '2026-10-31T15:00:00');   // average 20 %
    above.st[EN + 'energy_today_consumption'] = { val: 4 };
    above.st[EN + 'energy_today_purchased'] = { val: 1 };            // today 75 %
    assert.match(autarkRow(above.buildBilanz()), new RegExp('color:' + GREEN + '">75'));

    const below = load('2026-10-30T23:00:00', {});
    finishDay(below, '2026-10-30', 10, 2, '2026-10-31T08:00:00');   // average 80 %
    below.st[EN + 'energy_today_consumption'] = { val: 2 };
    below.st[EN + 'energy_today_purchased'] = { val: 2 };            // today 0 %
    assert.match(autarkRow(below.buildBilanz()), new RegExp('color:' + TEXT + '">0'));
});

test('bilanz: Verbraucht is Haus-white and the battery share is a solar green, not blue', () => {
    const ctx = load('2026-10-31T12:00:00', { energy_today_consumption: 4, energy_today_purchased: 2, energy_today_maxxidischarge: 1 });
    const h = ctx.buildBilanz().split('</style>')[1];
    assert.match(h, new RegExp('color:' + TEXT + '">4,0'));
    assert.doesNotMatch(h, new RegExp(BLUE));
});
