// Diagnose: the CCU's program engine (ReGaHSS) as a device issue (diagnose_v2.js). On 2026-10-18 it died
// at 02:48; buttons still reached the CCU but no program ran, so no light switched — and nothing on the
// dashboard said so until someone found the entrance light dead in the morning.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const REGA_UP = 'hm-rega.0.info.ccuRegaUp';
const MIN = 60000;
const RealDate = Date;

function loadDiagnose(states) {
    let offset = 0;
    class FakeDate extends RealDate {
        constructor(...args) { if (args.length) super(...args); else super(RealDate.now() + offset); }
        static now() { return RealDate.now() + offset; }
    }
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
        sendTo: (inst, cmd, msg) => sent.push({ inst, cmd, msg }),
        setState: (id, val) => { st[id] = { val, ts: now, lc: now }; },
        createState() {}, on() {}, schedule() {}, setTimeout() {},
        Date: FakeDate
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.sent = sent;
    ctx.advance = (ms) => { offset += ms; };
    return ctx;
}

test('ccu: a dead program engine shows as a red device issue', () => {
    const h = loadDiagnose({ [REGA_UP]: false }).buildDevices();
    assert.match(h, /CCU-Programme<\/span><span class="ag" style="color:#A00629">offline/);
});

test('ccu: a running program engine raises nothing', () => {
    const h = loadDiagnose({ [REGA_UP]: true }).buildDevices();
    assert.doesNotMatch(h, /CCU-Programme/);
});

test('ccu: no engine state yet (hm-rega not installed or still starting) raises nothing', () => {
    const h = loadDiagnose({}).buildDevices();
    assert.doesNotMatch(h, /CCU-Programme/);
});

test('ccu: a program engine dead for 10 minutes is sent to Telegram', () => {
    const ctx = loadDiagnose({ [REGA_UP]: false });
    ctx.publish();
    ctx.advance(10 * MIN);
    ctx.publish();
    assert.equal(ctx.sent.length, 1);
    assert.match(ctx.sent[0].msg.text, /CCU-Programme – offline/);
});
