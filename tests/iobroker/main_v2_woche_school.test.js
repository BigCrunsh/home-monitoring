// School calendars in the Übersicht Woche card (main_v2.js buildWoche), owner 2026-11-21. Two children
// each have a school calendar in ical.0 ("Schule 1", "Schule 2"). Their events carry the child's heart
// (💜, 🩵, the same hearts the family calendar's child tags use); an event both calendars share (the
// whole-school calendar is in both feeds) is shown once with 🏫. Family calendar events stay unmarked.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');

function loadMain(events) {
    const states = { 'ical.0.data.table': events };
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
// tomorrow at 10:00 local, so the event lands on a day the card always shows
function tomorrowAt(h) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
}
const ev = (calName, title, h) => ({ _date: tomorrowAt(h || 10), _allDay: false, event: title, _calName: calName });
const titles = (html) => [...html.matchAll(/<div class="e"><span class="t num">[^<]*<\/span>([^<]*)<\/div>/g)].map((m) => m[1]);

test('woche: an event of the first school calendar carries the first child\'s heart', () => {
    assert.deepEqual(titles(loadMain([ev('Schule 1', 'Elternabend')]).buildWoche()), ['💜 Elternabend']);
});

test('woche: an event of the second school calendar carries the second child\'s heart', () => {
    assert.deepEqual(titles(loadMain([ev('Schule 2', 'Wandertag')]).buildWoche()), ['🩵 Wandertag']);
});

test('woche: an event in both school calendars is shown once with the school symbol', () => {
    const html = loadMain([ev('Schule 1', 'Laternenfest'), ev('Schule 2', 'Laternenfest')]).buildWoche();
    assert.deepEqual(titles(html), ['🏫 Laternenfest']);
});

test('woche: the same title at different times stays two events, each with its heart', () => {
    const html = loadMain([ev('Schule 1', 'Sport', 9), ev('Schule 2', 'Sport', 11)]).buildWoche();
    assert.deepEqual(titles(html), ['💜 Sport', '🩵 Sport']);
});

test('woche: family calendar events stay unmarked', () => {
    assert.deepEqual(titles(loadMain([ev('Familie', 'Zahnarzt')]).buildWoche()), ['Zahnarzt']);
});

test('woche: an event without a calendar name stays unmarked', () => {
    assert.deepEqual(titles(loadMain([{ _date: tomorrowAt(10), _allDay: false, event: 'Termin' }]).buildWoche()), ['Termin']);
});

test('woche: a school event that is also in a family calendar keeps the child\'s heart', () => {
    const html = loadMain([ev('Familie', 'Elternabend'), ev('Schule 1', 'Elternabend')]).buildWoche();
    assert.deepEqual(titles(html), ['💜 Elternabend']);
});
