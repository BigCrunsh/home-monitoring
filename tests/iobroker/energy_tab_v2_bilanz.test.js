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

// review finding 2026-10-31: the 12 px chips under the bars were unreadable from across the room
test('bilanz: the chips under the bars are 14 px', () => {
    const ctx = load('2026-10-31T12:00:00', { energy_today_consumption: 4, energy_today_purchased: 2 });
    assert.match(ctx.buildBilanz(), /\.et3 \.chip\{[^}]*font-size:14px/);
});

// the battery is the blue series in the curve since 2026-10-31, so its shares here are blue too
test('bilanz: Verbraucht is Haus-white and the battery shares are the curve\'s Akku blue', () => {
    const ctx = load('2026-10-31T12:00:00', {
        energy_today_production: 3, energy_today_maxxicharge: 1,
        energy_today_consumption: 4, energy_today_purchased: 2, energy_today_maxxidischarge: 1
    });
    const h = ctx.buildBilanz().split('</style>')[1];
    assert.match(h, new RegExp('color:' + TEXT + '">4,0'));
    assert.match(h, new RegExp('background:' + BLUE + '[^"]*"></i>in Maxxisun'));
    assert.match(h, new RegExp('background:' + BLUE + '[^"]*"></i>von Maxxisun'));
});

// owner question 2026-10-31: "direkt genutzt 2,1" vs. "Solar 1,2" read as the same thing with two values.
// Erzeugt counts SolarEdge + Maxxisun, so its house share is what Verbraucht splits by source — the chips
// now say so, with the Energiefluss names: im Haus = von SolarEdge + von Maxxisun
test('bilanz: the house share of Erzeugt equals what Verbraucht takes from SolarEdge and Maxxisun', () => {
    const ctx = load('2026-10-31T12:00:00', {
        energy_today_production: 3.2, energy_today_feedin: 1.1, energy_today_maxxicharge: 0,
        energy_today_consumption: 6.6, energy_today_purchased: 4.5, energy_today_maxxidischarge: 0.9
    });
    const h = ctx.buildBilanz().split('</style>')[1];
    assert.match(h, /im Haus 2,1</);
    assert.match(h, /von SolarEdge 1,2</);
    assert.match(h, /von Maxxisun 0,9</);
    assert.match(h, /ins Netz 1,1</);
    assert.match(h, /vom Netz 4,5</);
    assert.doesNotMatch(h, /direkt genutzt|>Solar |aus Akku/);
});

// the two bars are integrated separately, so 2,04 vs. 1,24 + 0,86 rounded to "2,0" vs. "1,2 + 0,9" —
// the house share is the sum of the two sources, so the shown figures always add up
test('bilanz: "im Haus" always equals von SolarEdge + von Maxxisun as shown', () => {
    const ctx = load('2026-10-31T12:00:00', {
        energy_today_production: 3.14, energy_today_feedin: 1.1, energy_today_maxxicharge: 0,
        energy_today_consumption: 6.6, energy_today_purchased: 4.5, energy_today_maxxidischarge: 0.86
    });
    const h = ctx.buildBilanz().split('</style>')[1];
    assert.match(h, /von SolarEdge 1,2</);
    assert.match(h, /von Maxxisun 0,9</);
    assert.match(h, /im Haus 2,1</);
});
