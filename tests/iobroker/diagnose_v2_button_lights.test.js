// A light that did not react to its wall button (kids_room_lights.js publishes these faults) is a red
// device issue: on 2026-11-20 every kids' room button press reached the CCU and no lamp switched, and
// nothing told anyone. Diagnose lists "<light> · reagiert nicht auf Taster", sends it once via Telegram
// and "wieder ok" when a press on that light works again.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const FAULTS = 'javascript.0.light_button_faults';

function loadDiagnose(states) {
    const now = Date.now();
    const st = {};
    Object.keys(states).forEach((id) => { st[id] = { val: states[id], ts: now, lc: now }; });
    const sent = [];
    const ctx = {
        console: { log() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        getObject: () => null,
        getEnums: () => [],
        $: () => ({ each() {} }),
        sendTo: (inst, cmd, msg) => sent.push(msg.text),
        setState: (id, val) => { st[id] = { val, ts: Date.now(), lc: Date.now() }; },
        createState() {}, on() {}, schedule() {}, setTimeout() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.sent = sent;
    ctx.st = st;
    return ctx;
}

test('button lights: a light that did not react shows a red row and sends one message', () => {
    const ctx = loadDiagnose({ [FAULTS]: JSON.stringify({ 'Clara Decke': 1 }) });
    ctx.publish();
    ctx.publish();
    assert.match(ctx.buildDevices(), /<span class="nm">Clara Decke<\/span><span class="ag" style="color:[^"]+">reagiert nicht auf Taster</);
    assert.deepEqual(ctx.sent, ['Diagnose: Clara Decke – reagiert nicht auf Taster']);
});

test('button lights: the summary counts it as a device offline', () => {
    const ctx = loadDiagnose({ [FAULTS]: JSON.stringify({ 'Clara Decke': 1 }) });
    ctx.publish();
    assert.match(ctx.buildSummary(), /Gerät offline/);
});

test('button lights: a cleared fault sends "wieder ok"', () => {
    const ctx = loadDiagnose({ [FAULTS]: JSON.stringify({ 'Clara Decke': 1 }) });
    ctx.publish();
    ctx.st[FAULTS].val = '{}';
    ctx.publish();
    assert.deepEqual(ctx.sent, ['Diagnose: Clara Decke – reagiert nicht auf Taster', 'Diagnose: Clara Decke – wieder ok']);
});

test('button lights: without the fault state there is no issue', () => {
    const ctx = loadDiagnose({});
    ctx.publish();
    assert.doesNotMatch(ctx.buildDevices(), /reagiert nicht/);
    assert.equal(ctx.sent.length, 0);
});

test('button lights: a corrupt fault state is ignored, not thrown', () => {
    const ctx = loadDiagnose({ [FAULTS]: '{not json' });
    ctx.publish();
    assert.doesNotMatch(ctx.buildDevices(), /reagiert nicht/);
});
