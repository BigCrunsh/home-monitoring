// Netatmo base stations in Diagnose (diagnose_v2.js). Only the modules (outdoor, rain, wind, extra
// rooms) were watched; a base station that went silent showed up only as a red age on the
// dashboard (Studio, 2026-11-08: no reading after 14:36, no message). A station reports every
// ~10 min, so silent for over an hour is a device issue and one Telegram message, named like its
// Datenquellen row ("Netatmo Studio").
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const STUDIO = 'netatmo.0.6a48fde5178fa8d8cd09bd27.70-ee-50-c2-86-aa';
const MAIN = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
const MIN = 60000;

// stations: {station id: minutes since its LastUpdate}
function loadDiagnose(stations) {
    const now = Date.now();
    const st = {};
    Object.keys(stations).forEach((id) => {
        st[id + '.LastUpdate'] = { val: new Date(now - stations[id] * MIN).toString(), ts: now, lc: now };
    });
    const sent = [];
    const ctx = {
        console: { log() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        getObject: (id) => (id in stations ? { common: { name: 'Basis' }, native: { type: 'NAMain' } } : null),
        getEnums: () => [],
        $: (sel) => {
            const re = new RegExp('^' + sel.match(/id=([^\]]+)\]/)[1].replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            return { each: (fn) => Object.keys(st).filter((id) => re.test(id)).forEach(fn) };
        },
        sendTo: (inst, cmd, msg) => sent.push(msg.text),
        setState: (id, val) => { st[id] = { val, ts: now, lc: now }; },
        createState() {}, on() {}, schedule() {}, setTimeout() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.sent = sent;
    return ctx;
}

test('stations: a base station silent for over an hour is an issue and one Telegram message', () => {
    const ctx = loadDiagnose({ [STUDIO]: 70, [MAIN]: 5 });
    ctx.publish();
    ctx.publish();
    assert.match(ctx.buildDevices(), /Netatmo Studio/);
    assert.deepEqual(ctx.sent, ['Diagnose: Netatmo Studio – still seit 1 h']);
});

test('stations: a station that reported within the hour is fine', () => {
    const ctx = loadDiagnose({ [STUDIO]: 50, [MAIN]: 5 });
    ctx.publish();
    assert.doesNotMatch(ctx.buildDevices(), /Netatmo Studio/);
    assert.deepEqual(ctx.sent, []);
});

test('stations: the main station is named plainly "Netatmo"', () => {
    const ctx = loadDiagnose({ [MAIN]: 90 });
    ctx.publish();
    assert.deepEqual(ctx.sent, ['Diagnose: Netatmo – still seit 2 h']);
});

test('stations: a station without a readable LastUpdate is not reported', () => {
    const ctx = loadDiagnose({ [STUDIO]: 70 });
    ctx.getState = (id) => (id === STUDIO + '.LastUpdate' ? { val: 'kaputt', ts: Date.now() } : null);
    ctx.publish();
    assert.deepEqual(ctx.sent, []);
});
