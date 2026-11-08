// Domain chips in the Übersicht status bar (main_v2.js buildRibbon), task 6.4 (owner yes,
// 2026-11-08): lights on (amber bulb + count, amber = the "on" colour of the Steuerung tiles) and
// music playing (green note). The bar is 766 px for six fixed chips; full-width text chips cut
// "Schuppen"/"Türschloss" to an ellipsis, so these are compact icon chips, as wide as their
// content, shown only while something is on. Counts come from steuerung_v2 (lights_on) and
// musik_v2 (music_playing).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');

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
const iconChips = (html) => [...html.matchAll(/<div class="rind dom" data-d="([a-z]+)">(<svg.*?<\/svg>)<span class="nm">([^<]*)<\/span><\/div>/g)]
    .map((m) => ({ kind: m[1], svg: m[2], text: m[3] }));

test('ribbon: three lights on show an amber bulb with "3"', () => {
    const [c] = iconChips(loadMain({ 'javascript.0.lights_on': 3 }).buildRibbon());
    assert.equal(c.kind, 'licht');
    assert.equal(c.text, '3');
    assert.match(c.svg, /var\(--amber\)/);
});

test('ribbon: with every light off there is no lights chip', () => {
    assert.deepEqual(iconChips(loadMain({ 'javascript.0.lights_on': 0 }).buildRibbon()), []);
});

test('ribbon: without a light count there is no lights chip', () => {
    assert.deepEqual(iconChips(loadMain({}).buildRibbon()), []);
});

test('ribbon: a playing room adds a green note', () => {
    const [c] = iconChips(loadMain({ 'javascript.0.music_playing': 2 }).buildRibbon());
    assert.equal(c.kind, 'musik');
    assert.match(c.svg, /var\(--green\)/);
});

test('ribbon: no music chip while nothing plays', () => {
    assert.deepEqual(iconChips(loadMain({ 'javascript.0.music_playing': 0 }).buildRibbon()), []);
});

test('ribbon: icon chips take only their content width, the six fixed chips share the rest', () => {
    const html = loadMain({ 'javascript.0.lights_on': 2, 'javascript.0.music_playing': 1 }).buildRibbon();
    assert.match(html, /grid-template-columns:repeat\(6,1fr\) max-content max-content/);
});
