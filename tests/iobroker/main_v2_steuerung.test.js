// Übersicht control tiles (main_v2.js buildSteuerung). The TV scene tile is replaced by a
// "Rollläden" tile (owner, 2026-11-08) showing the next move for all shutters, which
// steuerung_v2.js publishes as roll_next; the tile's overlay toggles roll_toggle_cmd.
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
function rollo(html) {
    const m = html.match(/data-k="rollo">.*?<span class="cap">([^<]*)<\/span><span class="st">([^<]*)<\/span>/);
    return m ? [m[1], m[2]] : null;
}

test('steuerung: the first tile is Rollläden with the next move "runter"', () => {
    const html = loadMain({ 'javascript.0.roll_next': 'runter' }).buildSteuerung();
    assert.deepEqual(rollo(html), ['Rollläden', 'runter']);
    assert.ok(html.indexOf('data-k="rollo"') < html.indexOf('data-k="ambiente"'));
});

test('steuerung: mostly closed shutters show "hoch"', () => {
    assert.deepEqual(rollo(loadMain({ 'javascript.0.roll_next': 'hoch' }).buildSteuerung()), ['Rollläden', 'hoch']);
});

test('steuerung: without a published next move the tile shows a dash', () => {
    assert.deepEqual(rollo(loadMain({}).buildSteuerung()), ['Rollläden', '–']);
});

test('steuerung: the TV scene tile is gone', () => {
    const html = loadMain({}).buildSteuerung();
    assert.doesNotMatch(html, /data-k="tv"|>TV</);
});

test('steuerung: the tile redraws when the next move changes', () => {
    const ctx = loadMain({});
    assert.ok(ctx.STEUER_OIDS.includes('javascript.0.roll_next'));
});

test('steuerung: the tile\'s tap overlay toggles the all-shutters switch', () => {
    const views = JSON.parse(fs.readFileSync(path.join(IOB, 'vis', 'main', 'vis-views.json'), 'utf8'));
    const w = views.Main.widgets.wov_rollo;
    assert.ok(w, 'overlay wov_rollo missing');
    assert.equal(w.data.oid, 'javascript.0.roll_toggle_cmd');
    assert.ok(!views.Main.widgets.wov_tv, 'the TV scene overlay is still there');
});
