// mqtt_shelly.js feeds the grid anchor of solaredge_power.js and the freshness check of diagnose_v2.js.
// A payload without total_act_power must write nothing: a fabricated 0 W would look like a fresh reading.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPT = path.join(__dirname, '..', '..', 'integrations', 'iobroker', 'mqtt_shelly.js');
const GRID = 'javascript.0.mqtt_shelly.total_act_power';

function load() {
    const handlers = [], written = [], logs = [];
    const ctx = {
        createState() {},
        setState: (id, val, ack) => written.push([id, val, ack]),
        log: (msg, level) => logs.push([level || 'info', msg]),
        on: (pattern, cb) => handlers.push({ pattern, cb })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), ctx);
    ctx.fire = (state) => handlers.forEach((h) => h.cb({ id: h.pattern.id, state }));
    ctx.fireOn = (id, state) => handlers.filter((h) => h.pattern.id === id).forEach((h) => h.cb({ id, state }));
    ctx.written = written;
    ctx.logs = logs;
    return ctx;
}

test('a valid payload writes total_act_power as an acknowledged number', () => {
    const ctx = load();
    ctx.fire({ val: JSON.stringify({ a_act_power: 10, total_act_power: -1234.5 }) });
    assert.deepEqual(ctx.written, [[GRID, -1234.5, true]]);
});

test('a genuine 0 W reading is written (zero is a number, not missing)', () => {
    const ctx = load();
    ctx.fire({ val: JSON.stringify({ total_act_power: 0 }) });
    assert.deepEqual(ctx.written, [[GRID, 0, true]]);
});

test('a payload without total_act_power writes nothing', () => {
    const ctx = load();
    ctx.fire({ val: JSON.stringify({ a_act_power: 10, b_act_power: 20 }) });
    assert.deepEqual(ctx.written, []);
});

for (const bad of ['"1200"', 'null', '"abc"', '{}', '[]', 'true']) {
    test(`total_act_power = ${bad} writes nothing`, () => {
        const ctx = load();
        ctx.fire({ val: `{"total_act_power": ${bad}}` });
        assert.deepEqual(ctx.written, []);
    });
}

for (const [label, state] of [['null state', null], ['undefined val', {}], ['null val', { val: null }], ['empty string', { val: '' }]]) {
    test(`${label} neither throws, writes nor logs an error`, () => {
        const ctx = load();
        assert.doesNotThrow(() => ctx.fire(state));
        assert.deepEqual(ctx.written, []);
        assert.deepEqual(ctx.logs.filter(([level]) => level === 'error'), []);
    });
}

test('JSON that parses to null writes nothing and does not throw', () => {
    const ctx = load();
    assert.doesNotThrow(() => ctx.fire({ val: 'null' }));
    assert.deepEqual(ctx.written, []);
});

test('invalid JSON does not throw, writes nothing, and is logged once rather than per message', () => {
    const ctx = load();
    assert.doesNotThrow(() => { ctx.fire({ val: '{garbled' }); ctx.fire({ val: '{garbled' }); ctx.fire({ val: 'x' }); });
    assert.deepEqual(ctx.written, []);
    assert.equal(ctx.logs.filter(([level]) => level !== 'info').length, 1);
});

test('only total_act_power is written, never the unused fields', () => {
    const ctx = load();
    ctx.fire({ val: JSON.stringify({ a_voltage: 230, total_current: 5, id: 0, total_act_power: 50 }) });
    assert.deepEqual(ctx.written.map(([id]) => id), [GRID]);
});

// The meter's lifetime import/export counters (emdata:0, Wh) are what the 15-minute energy totals
// and the daily check against the utility meter are computed from. Like the power, a missing or
// non-numeric value writes nothing; a 0 or a reading below the last one is a glitch, not energy.
const EMDATA = 'mqtt.0.shellypro3em.status.emdata:0';
const IMPORT = 'javascript.0.mqtt_shelly.import_total';
const EXPORT = 'javascript.0.mqtt_shelly.export_total';

test('the lifetime import and export counters are written in Wh', () => {
    const ctx = load();
    ctx.fireOn(EMDATA, { val: JSON.stringify({ a_total_act_energy: 1, total_act: 3921885.86, total_act_ret: 6084198.95 }) });
    assert.deepEqual(ctx.written, [[IMPORT, 3921885.86, true], [EXPORT, 6084198.95, true]]);
});

test('a counter that is missing or not a number is not written, the other one is', () => {
    const ctx = load();
    ctx.fireOn(EMDATA, { val: JSON.stringify({ total_act: '3921885', total_act_ret: 6084198.95 }) });
    assert.deepEqual(ctx.written, [[EXPORT, 6084198.95, true]]);
});

test('a counter of 0 or below the last reading is not written', () => {
    const ctx = load();
    ctx.fireOn(EMDATA, { val: JSON.stringify({ total_act: 5000, total_act_ret: 9000 }) });
    ctx.fireOn(EMDATA, { val: JSON.stringify({ total_act: 4990, total_act_ret: 0 }) });
    assert.deepEqual(ctx.written, [[IMPORT, 5000, true], [EXPORT, 9000, true]]);
});

test('an unreadable counter payload is logged only once, shared with the power feed', () => {
    const ctx = load();
    ctx.fireOn(EMDATA, { val: '{garbled' });
    ctx.fireOn('mqtt.0.shellypro3em.status.em:0', { val: '{garbled' });
    assert.equal(ctx.logs.filter(([level]) => level !== 'info').length, 1);
    assert.deepEqual(ctx.written, []);
});
