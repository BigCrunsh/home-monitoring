// Diagnose device alerts (diagnose_v2.js): a Telegram message once per new device issue, and a short
// "wieder ok" when an alerted issue clears. The hallway motion sensor reported a low battery for two
// weeks and then sat offline for twelve days before anyone noticed the entrance light had stopped
// switching off. "offline" waits 10 min first: the siren dropped off the radio for 2 min on 2026-10-18
// after a command and an instant alert for that was noise.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const HOME = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
const RAIN = HOME + '.05-00-00-05-d4-18';
const SIREN = 'hm-rpc.1.00245D898FEEF1';
const MIN = 60000, HOUR = 60 * MIN;
const RealDate = Date;

function netatmoDate(msAgo) { return new Date(Date.now() - msAgo).toString(); }

// objects: {id: name}; states: {id: val}. $ matches the selector's id glob against the state ids.
// ctx.advance(ms) moves the script's clock forward.
function loadDiagnose(objects, states) {
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
        getObject: (id) => (id in objects ? { common: { name: objects[id] } } : null),
        getEnums: () => [],
        $: (sel) => {
            const glob = sel.match(/id=([^\]]+)\]/)[1];
            const re = new RegExp('^' + glob.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            return { each: (fn) => Object.keys(st).filter((id) => re.test(id)).forEach(fn) };
        },
        sendTo: (inst, cmd, msg) => sent.push({ inst, cmd, msg }),
        setState: (id, val) => { st[id] = { val, ts: now, lc: now }; },
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

test('alerts: a new device issue sends one Telegram message naming the device and the problem', () => {
    const ctx = loadDiagnose({ 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' }, { 'hue.0.Claras_Fernbedienung.battery': 15 });
    ctx.publish();
    assert.equal(ctx.sent.length, 1);
    assert.equal(ctx.sent[0].inst, 'telegram.0');
    assert.match(ctx.sent[0].msg.text, /Claras Fernbedienung/);
    assert.match(ctx.sent[0].msg.text, /Batterie schwach/);
});

test('alerts: an issue that persists is not sent again on the next refresh', () => {
    const ctx = loadDiagnose({ 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' }, { 'hue.0.Claras_Fernbedienung.battery': 15 });
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

test('alerts: an alerted issue that clears sends "wieder ok", and is sent again if it comes back', () => {
    const ctx = loadDiagnose({ 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' }, { 'hue.0.Claras_Fernbedienung.battery': 15 });
    ctx.publish();
    ctx.st['hue.0.Claras_Fernbedienung.battery'].val = 100;
    ctx.publish();
    ctx.st['hue.0.Claras_Fernbedienung.battery'].val = 12;
    ctx.publish();
    assert.deepEqual(ctx.sent.map((s) => s.msg.text), [
        'Diagnose: Claras Fernbedienung – Batterie schwach',
        'Diagnose: Claras Fernbedienung – wieder ok',
        'Diagnose: Claras Fernbedienung – Batterie schwach'
    ]);
});

test('alerts: an empty remote battery is sent at once — the 10-minute wait is only for offline flickers', () => {
    const ctx = loadDiagnose({ 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' }, { 'hue.0.Claras_Fernbedienung.battery': 1 });
    ctx.publish();
    assert.deepEqual(ctx.sent.map((s) => s.msg.text), ['Diagnose: Claras Fernbedienung – Batterie leer']);
});

test('alerts: a device offline for less than 10 minutes is not sent', () => {
    const ctx = loadDiagnose({ [SIREN]: 'Alarmsirene' }, { [SIREN + '.0.UNREACH']: true });
    ctx.publish();
    ctx.advance(9 * MIN);
    ctx.publish();
    assert.equal(ctx.sent.length, 0);
});

test('alerts: a device still offline after 10 minutes is sent once', () => {
    const ctx = loadDiagnose({ [SIREN]: 'Alarmsirene' }, { [SIREN + '.0.UNREACH']: true });
    ctx.publish();
    ctx.advance(10 * MIN);
    ctx.publish();
    ctx.advance(MIN);
    ctx.publish();
    assert.deepEqual(ctx.sent.map((s) => s.msg.text), ['Diagnose: Alarmsirene – offline']);
});

test('alerts: a device back within 10 minutes sends neither the alert nor "wieder ok"', () => {
    const ctx = loadDiagnose({ [SIREN]: 'Alarmsirene' }, { [SIREN + '.0.UNREACH']: true });
    ctx.publish();
    ctx.advance(2 * MIN);
    ctx.st[SIREN + '.0.UNREACH'].val = false;
    ctx.publish();
    ctx.advance(20 * MIN);
    ctx.publish();
    assert.equal(ctx.sent.length, 0);
});

// the live state was written as {"<name>|<rank>": true} before "wieder ok" existed
test('alerts: issues alerted in the old stored format are neither resent nor lost', () => {
    const objects = { 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' };
    const ctx = loadDiagnose(objects, {
        'hue.0.Claras_Fernbedienung.battery': 15,
        'javascript.0.diag_alerted': JSON.stringify({ 'Claras Fernbedienung|2': true })
    });
    ctx.publish();
    ctx.st['hue.0.Claras_Fernbedienung.battery'].val = 100;
    ctx.publish();
    assert.deepEqual(ctx.sent.map((s) => s.msg.text), ['Diagnose: Claras Fernbedienung – wieder ok']);
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

// When the Netatmo feed stalls, every module goes silent within the same hours: on 2026-10-30 seven
// modules each sent their own "still seit" message overnight. Two or more silent modules are one
// Telegram message; the Geräte card still lists each module.
const GARDEN = HOME + '.02-00-00-32-ae-a4', CLARA = HOME + '.03-00-00-0f-01-6e';
const SILENT_TRIO = { [RAIN]: 'Regenmesser', [GARDEN]: 'Gartenhaus', [CLARA]: 'Kinderzimmer Clara' };
function silentStates(ids, msAgo) {
    const states = {};
    ids.forEach((id) => { states[id + '.LastUpdate'] = netatmoDate(msAgo); });
    return states;
}

test('alerts: several silent Netatmo modules are one message naming them all', () => {
    const ctx = loadDiagnose(SILENT_TRIO, silentStates([RAIN, GARDEN, CLARA], 3 * HOUR));
    ctx.publish();
    assert.deepEqual(ctx.sent.map((s) => s.msg.text), [
        'Diagnose: Netatmo – 3 Module still: Gartenhaus, Kinderzimmer Clara, Regenmesser'
    ]);
});

test('alerts: a single silent Netatmo module is still reported by its own name', () => {
    const ctx = loadDiagnose({ [RAIN]: 'Regenmesser' }, silentStates([RAIN], 3 * HOUR));
    ctx.publish();
    assert.deepEqual(ctx.sent.map((s) => s.msg.text), ['Diagnose: Regenmesser – still seit 3 h']);
});

test('alerts: a further module going silent does not resend the Netatmo message', () => {
    const ctx = loadDiagnose(SILENT_TRIO, Object.assign(silentStates([RAIN, GARDEN], 3 * HOUR), silentStates([CLARA], 0.1 * HOUR)));
    ctx.publish();
    ctx.st[CLARA + '.LastUpdate'].val = netatmoDate(3 * HOUR);
    ctx.publish();
    assert.equal(ctx.sent.length, 1);
});

test('alerts: when the Netatmo modules report again, one "wieder ok" is sent, not one per module', () => {
    const ctx = loadDiagnose(SILENT_TRIO, silentStates([RAIN, GARDEN, CLARA], 3 * HOUR));
    ctx.publish();
    [RAIN, GARDEN, CLARA].forEach((id) => { ctx.st[id + '.LastUpdate'].val = netatmoDate(0.1 * HOUR); });
    ctx.publish();
    assert.deepEqual(ctx.sent.map((s) => s.msg.text).slice(1), ['Diagnose: Netatmo – wieder ok']);
});

// the live state already held each module as alerted when grouping was introduced
test('alerts: modules already alerted one by one are neither re-sent as a group nor cleared', () => {
    const alerted = {};
    ['Regenmesser', 'Gartenhaus', 'Kinderzimmer Clara'].forEach((nm) => { alerted[nm + '|1'] = { nm, since: 0, sent: true }; });
    const ctx = loadDiagnose(SILENT_TRIO, Object.assign(silentStates([RAIN, GARDEN, CLARA], 3 * HOUR), {
        'javascript.0.diag_alerted': JSON.stringify(alerted)
    }));
    ctx.publish();
    assert.equal(ctx.sent.length, 0);
});

test('alerts: a low Netatmo battery is not folded into the silent-modules message', () => {
    const ctx = loadDiagnose(SILENT_TRIO, Object.assign(silentStates([RAIN, GARDEN], 3 * HOUR), silentStates([CLARA], 0.1 * HOUR), {
        [CLARA + '.BatteryStatus']: 10
    }));
    ctx.publish();
    assert.deepEqual(ctx.sent.map((s) => s.msg.text), [
        'Diagnose: Netatmo – 2 Module still: Gartenhaus, Regenmesser',
        'Diagnose: Kinderzimmer Clara – Batterie schwach'
    ]);
});
