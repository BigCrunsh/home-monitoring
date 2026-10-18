// Diagnose "Geräte": Gardena soil sensors (smartgarden.0). Three of them sat dead for months
// (battery 0-2 %, last report 73-383 days ago) without any alert.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const LOC = 'smartgarden.0.LOCATION_28b39c94-2D8503-2D4ee7-2D8a95-2D7c5a0f50a8d7.';
const HOCHBEET = 'c080e523-2De083-2D49d5-2D98d8-2D004a9a2ed9b1';
const TS_ID = LOC + 'DEVICE_' + HOCHBEET + '.SERVICE_SENSOR_' + HOCHBEET + '.soilHumidity_timestamp';
const BAT_ID = LOC + 'DEVICE_' + HOCHBEET + '.SERVICE_COMMON_' + HOCHBEET + '.batteryLevel_value';
const HOUR = 3600000;

function loadDiagnose(states) {
    const now = Date.now();
    const st = {};
    const reads = [];
    Object.keys(states).forEach((id) => { st[id] = { val: states[id], ts: now, lc: now }; });
    const ctx = {
        console: { log() {} },
        getState: (id) => { reads.push(id); return st[id] || null; },
        existsState: (id) => id in st,
        getObject: () => null,
        getEnums: () => [],
        $: () => ({ each() {} }),
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.reads = reads;
    return ctx;
}

function isoAgo(ms) { return new Date(Date.now() - ms).toISOString(); }

test('garden: a soil sensor silent for 174 days is listed as still, named as a garden sensor', () => {
    const ctx = loadDiagnose({ [TS_ID]: isoAgo(174 * 24 * HOUR), [BAT_ID]: 0 });
    assert.match(ctx.buildDevices(), /Boden Hochbeet<\/span><span class="ag" style="color:#F1BE3D">still seit 174 Tg/);
});

test('garden: a sensor that reported an hour ago with a good battery raises nothing', () => {
    const ctx = loadDiagnose({ [TS_ID]: isoAgo(HOUR), [BAT_ID]: 80 });
    const h = ctx.buildDevices();
    assert.match(h, /1 Geräte/);
    assert.match(h, /alle ok/);
});

test('garden: a fresh sensor with a low battery says Batterie schwach', () => {
    const ctx = loadDiagnose({ [TS_ID]: isoAgo(HOUR), [BAT_ID]: 15 });
    assert.match(ctx.buildDevices(), /Boden Hochbeet<\/span><span class="ag" style="color:#F1BE3D">Batterie schwach/);
});

test('garden: silence outranks the empty battery of a dead sensor', () => {
    const ctx = loadDiagnose({ [TS_ID]: isoAgo(30 * HOUR), [BAT_ID]: 0 });
    const h = ctx.buildDevices();
    assert.match(h, /still seit 30 h/);
    assert.doesNotMatch(h, /Batterie schwach/);
});

test('garden: a report just under 24 h old is not stale', () => {
    const ctx = loadDiagnose({ [TS_ID]: isoAgo(23 * HOUR), [BAT_ID]: 80 });
    assert.doesNotMatch(ctx.buildDevices(), /still/);
});

test('garden: a missing timestamp neither throws nor flags the sensor', () => {
    const ctx = loadDiagnose({ [BAT_ID]: 0 });
    assert.doesNotMatch(ctx.buildDevices(), /Boden /);
    assert.deepEqual(ctx.reads.filter((id) => id === TS_ID), []);
});

test('garden: an unparseable timestamp is not flagged as still', () => {
    const ctx = loadDiagnose({ [TS_ID]: 'garbage', [BAT_ID]: 80 });
    assert.doesNotMatch(ctx.buildDevices(), /still/);
});

test('garden: a missing battery state is never read', () => {
    const ctx = loadDiagnose({ [TS_ID]: isoAgo(HOUR) });
    assert.doesNotMatch(ctx.buildDevices(), /Boden /);
    assert.deepEqual(ctx.reads.filter((id) => id === BAT_ID), []);
});
