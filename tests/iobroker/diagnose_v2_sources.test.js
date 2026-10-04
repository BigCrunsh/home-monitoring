// Diagnose tab data-source freshness (diagnose_v2.js). Every Netatmo base station is its own internet
// uplink, so each needs its own row: the bungalow's station can go offline while the house's keeps
// reporting. These tests run the real buildSources against stubbed state timestamps.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const LUEB_TEMP = 'netatmo.0.6ac096020a296fac710a1287.70-ee-50-c3-9e-84.Temperature.Temperature';
const MIN = 60 * 1000;

function loadDiagnose(ts) {
    const ctx = {
        console: { log() {} },
        getState: (id) => (id in ts ? { val: 1, ts: ts[id] } : null),
        existsState: (id) => id in ts,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {},
        $: () => ({ each() {} })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    return ctx;
}
// the row markup for one source label
function row(html, label) {
    const i = html.indexOf('>' + label + '<');
    assert.ok(i >= 0, 'row not found: ' + label);
    return html.slice(html.lastIndexOf('<div class="drow">', i), html.indexOf('</div>', i));
}

test('sources: a fresh Lübkowsee reading shows a green row', () => {
    const ctx = loadDiagnose({ [LUEB_TEMP]: Date.now() - 5 * MIN });
    assert.match(row(ctx.buildSources(), 'Netatmo Lübkowsee'), new RegExp('color:' + ctx.VC_PAL.good));
});

test('sources: Lübkowsee silent for 45 min turns red', () => {
    const ctx = loadDiagnose({ [LUEB_TEMP]: Date.now() - 45 * MIN });
    assert.match(row(ctx.buildSources(), 'Netatmo Lübkowsee'), new RegExp('color:' + ctx.VC_PAL.alarm));
});

test('sources: Lübkowsee never seen shows red with a dash', () => {
    const ctx = loadDiagnose({});
    const r = row(ctx.buildSources(), 'Netatmo Lübkowsee');
    assert.match(r, new RegExp('color:' + ctx.VC_PAL.alarm));
    assert.match(r, />–</);
});
