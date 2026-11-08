// Klima forecast card (klima_v2.js buildForecast), task 8.5 of the dashboard redesign: the first of
// the six day rows is today, but it showed only the weekday ("Fr"), so in the evening it read like
// a future day. It is labelled "Heute"; the rows after it keep their weekdays, weekend days blue.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function loadKlima() {
    const ctx = {
        console: { log() {} },
        getState: () => null, existsState: () => false,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {},
        sendTo: (inst, cmd, q, cb) => cb({ result: [[]] })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'klima_v2.js'), 'utf8'), ctx);
    return ctx;
}
const dayLabels = (html) => [...html.matchAll(/<div class="dow">([^<]+)<\/div>/g)].map((m) => m[1]);
function berlinDow(daysAhead) {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    return DAYS_SHORT[new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead).getDay()];
}

test('forecast: the first day row is labelled "Heute"', () => {
    assert.equal(dayLabels(loadKlima().buildForecast())[0], 'Heute');
});

test('forecast: the rows after today keep their weekday names', () => {
    const labels = dayLabels(loadKlima().buildForecast());
    assert.equal(labels.length, 6);
    assert.deepEqual(labels.slice(1), [1, 2, 3, 4, 5].map(berlinDow));
});

test('forecast: the weekday column is wide enough for "Heute"', () => {
    const src = fs.readFileSync(path.join(IOB, 'klima_v2.js'), 'utf8');
    const col = Number(src.match(/\.fcrow\{display:grid; grid-template-columns:(\d+)px/)[1]);
    assert.ok(col >= 46, 'weekday column is ' + col + 'px');
});
