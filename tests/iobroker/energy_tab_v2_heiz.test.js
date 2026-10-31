// Energie tab Heizung (energy_tab_v2.js buildHeiz). The card moves out of the right column into the
// strip beside the nav (766 × 87) — the same place the Overview tab keeps its HAUS ribbon — so the
// Kosten card can grow. Both circuits sit side by side on one line.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const S = 'javascript.0.sam_digital.';
const AMBER = '#F1BE3D', MUTED = '#8A8A8A';

function load(sam) {
    const st = {};
    Object.keys(sam).forEach((k) => { st[S + k] = { val: sam[k], ts: Date.now() }; });
    const ctx = {
        console: { log() {}, warn() {}, error() {} },
        getState: (id) => st[id] || null, existsState: (id) => id in st,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}, log() {}, sendTo() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'energy_tab_v2.js'), 'utf8'), ctx);
    return ctx;
}
const RUNNING = {
    heating_valve_signal: 23, hotwater_valve_signal: 0, heating_flow_temperature: 36.6,
    heating_return_temperature: 34.9, hotwater_storage_temperature: 56.5
};
function circuit(h, name) {
    const i = h.indexOf('>' + name + '<');
    assert.ok(i >= 0, 'circuit not found: ' + name);
    const next = h.indexOf('class="hz"', i);
    return h.slice(i, next > 0 ? next : undefined);
}

test('heizung: the ribbon is 766 × 87 with both circuits on one line', () => {
    const h = load(RUNNING).buildHeiz();
    assert.match(h, /^<svg[^>]*width="766" height="87"/);
    assert.match(h, /class="hzrow"/);
    assert.ok(h.indexOf('>Heizkreis<') < h.indexOf('>Warmwasser<'));
});

test('heizung: an open valve is amber with its temperatures, a closed one muted', () => {
    const h = load(RUNNING).buildHeiz();
    assert.match(circuit(h, 'Heizkreis'), new RegExp('color:' + AMBER + '">23 %'));
    assert.match(circuit(h, 'Heizkreis'), /36,6°[\s\S]*34,9°/);
    assert.match(circuit(h, 'Warmwasser'), new RegExp('color:' + MUTED + '">0 %'));
    assert.match(circuit(h, 'Warmwasser'), /56,5°/);
});

test('heizung: missing readings show dashes, not zeros or NaN', () => {
    const h = load({}).buildHeiz();
    assert.match(circuit(h, 'Heizkreis'), />– %/);
    assert.doesNotMatch(h, /NaN|undefined/);
});
