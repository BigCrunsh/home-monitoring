// The Maxxisun is metered only by its Shelly plug (its CCU V2 opens no interface). When the plug
// goes silent, solaredge_power.js counts the Maxxisun as 0 W and power_maxxisun keeps updating, so
// neither the dashboard nor the logged data shows that the meter is gone. Diagnose watches the plug's
// own MQTT report instead: silent for 15 min = a device issue on the Geräte card and in Telegram.
// The plug reports every 7-13 s while feeding and at least every 2 min when idle (2026-11-06).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const PLUG = 'mqtt.0.shellyplugsg3-48f6eeb7af98.status.switch:0';
const MIN = 60000;
const RealDate = Date;

// states: {id: {val, ageMs}}; ctx.advance(ms) moves the script's clock forward
function loadDiagnose(states) {
    let offset = 0;
    class FakeDate extends RealDate {
        constructor(...args) { if (args.length) super(...args); else super(RealDate.now() + offset); }
        static now() { return RealDate.now() + offset; }
    }
    const st = {};
    Object.keys(states).forEach((id) => {
        const ts = RealDate.now() - (states[id].ageMs || 0);
        st[id] = { val: states[id].val, ts, lc: ts };
    });
    const sent = [];
    const ctx = {
        console: { log() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        getObject: () => null,
        getEnums: () => [],
        $: () => ({ each() {} }),
        sendTo: (inst, cmd, msg) => sent.push(msg.text),
        setState: (id, val) => { st[id] = { val, ts: FakeDate.now(), lc: FakeDate.now() }; },
        createState() {}, on() {}, schedule() {}, setTimeout() {},
        Date: FakeDate
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.sent = sent;
    ctx.st = st;
    ctx.advance = (ms) => { offset += ms; };
    return ctx;
}

const report = (ageMs) => ({ [PLUG]: { val: '{"apower":-80}', ageMs } });

test('maxxisun: a plug silent for over 15 minutes is a device issue and one Telegram message', () => {
    const ctx = loadDiagnose(report(70 * MIN));
    ctx.publish();
    ctx.publish();
    assert.match(ctx.buildDevices(), /Maxxisun-Zähler/);
    assert.deepEqual(ctx.sent, ['Diagnose: Maxxisun-Zähler – still seit 1 h']);
});

test('maxxisun: a plug that reported recently is not an issue', () => {
    const ctx = loadDiagnose(report(2 * MIN));
    ctx.publish();
    assert.doesNotMatch(ctx.buildDevices(), /Maxxisun-Zähler/);
    assert.deepEqual(ctx.sent, []);
});

test('maxxisun: a plug that reports again after an alert sends "wieder ok"', () => {
    const ctx = loadDiagnose(report(70 * MIN));
    ctx.publish();
    ctx.st[PLUG] = { val: '{"apower":-80}', ts: Date.now(), lc: Date.now() };
    ctx.publish();
    assert.deepEqual(ctx.sent, [
        'Diagnose: Maxxisun-Zähler – still seit 1 h',
        'Diagnose: Maxxisun-Zähler – wieder ok'
    ]);
});

test('maxxisun: without any plug state (plug removed) nothing is reported', () => {
    const ctx = loadDiagnose({});
    ctx.publish();
    assert.doesNotMatch(ctx.buildDevices(), /Maxxisun-Zähler/);
    assert.deepEqual(ctx.sent, []);
});
