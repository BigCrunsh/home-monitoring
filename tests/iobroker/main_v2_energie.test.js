// Strom card in the Übersicht (main_v2.js buildEnergie). Haus is demand, while Netz, SolarEdge and
// Maxxisun are the sources that cover it; four identical rows read as four sources (owner,
// 2026-11-08). Haus leads, and a divider separates it from the sources below. All bars keep one
// scale, so a sunny-noon SolarEdge bar may honestly outgrow Haus.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const EN = 'javascript.0.';

function loadMain(states) {
    const ctx = {
        console: { log() {} },
        getState: (id) => (id in states ? { val: states[id] } : null),
        existsState: (id) => id in states,
        setState() {}, createState() {}, on() {}, schedule() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'main_v2.js'), 'utf8'), ctx);
    return ctx;
}
function power(over) {
    return Object.assign({
        [EN + 'power_production']: 134, [EN + 'power_maxxisun']: 0, [EN + 'power_feedin']: 0,
        [EN + 'power_purchased']: 70, [EN + 'power_consumption']: 204, [EN + 'rate_autarky']: 0.66,
        [EN + 'rate_selfconsumption']: 1, [EN + 'power_data_stale']: false
    }, over || {});
}
// the flow rows in order: [label, row markup]
function rows(html) {
    return [...html.matchAll(/<div class="(flow(?!s)[^"]*)">.*?<span class="fl">([^<]+)<\/span>/g)]
        .map((m) => [m[2], m[1]]);
}

test('strom: Haus comes first, then the sources Netz, SolarEdge and Maxxisun', () => {
    const html = loadMain(power()).buildEnergie();
    assert.deepEqual(rows(html).map((r) => r[0]), ['Haus', 'Netz', 'SolarEdge', 'Maxxisun']);
});

test('strom: a divider separates Haus from the sources, on the first source row only', () => {
    const html = loadMain(power()).buildEnergie();
    const classes = Object.fromEntries(rows(html));
    assert.match(classes.Netz, /\bsrc-first\b/);
    ['Haus', 'SolarEdge', 'Maxxisun'].forEach((name) => assert.doesNotMatch(classes[name], /src-first/));
    const css = fs.readFileSync(path.join(IOB, 'main_v2.js'), 'utf8');
    assert.match(css, /\.flow\.src-first\{[^}]*border-top:1px solid var\(--border\)/);
});

test('strom: with stale data Haus still leads (as an estimate) above the divider', () => {
    const html = loadMain(power({ [EN + 'power_data_stale']: true })).buildEnergie();
    const order = rows(html);
    assert.equal(order[0][0], 'Haus');
    assert.match(order[1][1], /src-first/);
    assert.match(html, /≈ /);
});

test('strom: without any power states the four rows still render in the new order', () => {
    const html = loadMain({}).buildEnergie();
    assert.deepEqual(rows(html).map((r) => r[0]), ['Haus', 'Netz', 'SolarEdge', 'Maxxisun']);
});

// The €/h figure beside the price is the cost of the current grid draw; unlabelled it could read as
// a daily or average figure (task 6.1).
const priced = (over) => power(Object.assign({ [EN + 'tibber_states.energy_price_euro']: 0.45 }, over || {}));

test('strom: the cost per hour is labelled "jetzt"', () => {
    const html = loadMain(priced()).buildEnergie();
    assert.match(html, /<span class="net"[^>]*><span class="nl">jetzt<\/span>/);
});

test('strom: without a price there is no price head and no "jetzt" label', () => {
    const html = loadMain(power()).buildEnergie();
    assert.doesNotMatch(html, /price-head|jetzt/);
});

test('strom: the "jetzt" label stays on feed-in income too', () => {
    const html = loadMain(priced({ [EN + 'power_purchased']: 0, [EN + 'power_feedin']: 900 })).buildEnergie();
    assert.match(html, /<span class="nl">jetzt<\/span>/);
});
