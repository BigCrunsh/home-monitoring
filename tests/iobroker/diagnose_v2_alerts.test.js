// Diagnose device alerts (diagnose_v2.js): a Telegram message once per new device issue. The hallway
// motion sensor reported a low battery for two weeks and then sat offline for twelve days before anyone
// noticed the entrance light had stopped switching off.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const HOME = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
const STUDIO = 'netatmo.0.6a48fde5178fa8d8cd09bd27.70-ee-50-c2-86-aa';
const RAIN = HOME + '.05-00-00-05-d4-18', GARDEN = HOME + '.02-00-00-32-ae-a4', ROOF = STUDIO + '.02-00-00-c2-7e-7c';
const HOUR = 3600000;

function netatmoDate(msAgo) { return new Date(Date.now() - msAgo).toString(); }

// objects: {id: name}; states: {id: val}. $ matches the selector's id glob against the state ids.
function loadDiagnose(objects, states) {
    const now = Date.now();
    const st = {};
    Object.keys(states).forEach((id) => { st[id] = { val: states[id], ts: now, lc: now }; });
    const sent = [];
    const ctx = {
        console: { log() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        getObject: (id) => (id in objects ? { common: { name: objects[id] } } : null),
        getEnums: () => [],
        $: (sel) => {
            const glob = sel.match(/id=([^\]]+)\]/)[1];
            const re = new RegExp('^' + glob.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            return { each: (fn) => Object.keys(st).filter((id) => re.test(id)).forEach(fn) };
        },
        sendTo: (inst, cmd, msg) => sent.push({ inst, cmd, msg }),
        setState: (id, val) => { st[id] = { val, ts: now, lc: now }; },
        createState() {}, on() {}, schedule() {}, setTimeout() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.sent = sent;
    ctx.st = st;
    return ctx;
}

test('alerts: a new device issue sends one Telegram message naming the device and the problem', () => {
    const ctx = loadDiagnose({ 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' }, { 'hue.0.Claras_Fernbedienung.battery': 1 });
    ctx.publish();
    assert.equal(ctx.sent.length, 1);
    assert.equal(ctx.sent[0].inst, 'telegram.0');
    assert.match(ctx.sent[0].msg.text, /Claras Fernbedienung/);
    assert.match(ctx.sent[0].msg.text, /Batterie schwach/);
});

test('alerts: an issue that persists is not sent again on the next refresh', () => {
    const ctx = loadDiagnose({ 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' }, { 'hue.0.Claras_Fernbedienung.battery': 1 });
    ctx.publish();
    ctx.publish();
    assert.equal(ctx.sent.length, 1);
});

test('alerts: a growing "still seit" age is the same issue, not a new one', () => {
    const ctx = loadDiagnose({ [RAIN]: 'Regenmesser' }, { [RAIN + '.LastUpdate']: netatmoDate(3 * 24 * HOUR), [RAIN + '.BatteryStatus']: 60 });
    ctx.publish();
    ctx.st[RAIN + '.LastUpdate'].val = netatmoDate(4 * 24 * HOUR);
    ctx.publish();
    assert.equal(ctx.sent.length, 1);
});

test('alerts: an issue that clears and comes back is sent again', () => {
    const ctx = loadDiagnose({ 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' }, { 'hue.0.Claras_Fernbedienung.battery': 1 });
    ctx.publish();
    ctx.st['hue.0.Claras_Fernbedienung.battery'].val = 100;
    ctx.publish();
    ctx.st['hue.0.Claras_Fernbedienung.battery'].val = 2;
    ctx.publish();
    assert.equal(ctx.sent.length, 2);
});

test('alerts: issues already alerted before a script restart are not sent again', () => {
    const objects = { 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' };
    const first = loadDiagnose(objects, { 'hue.0.Claras_Fernbedienung.battery': 1 });
    first.publish();
    const alerted = first.st['javascript.0.diag_alerted'].val;
    const restarted = loadDiagnose(objects, { 'hue.0.Claras_Fernbedienung.battery': 1, 'javascript.0.diag_alerted': alerted });
    restarted.publish();
    assert.equal(restarted.sent.length, 0);
});
