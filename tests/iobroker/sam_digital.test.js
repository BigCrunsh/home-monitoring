// SAM Digital heating states (sam_digital.js). The current-value queries must be time-bounded and a
// missing row/value must not be written, otherwise the state's ts stays fresh while the collector is
// dead and diagnose_v2 never flags SAM Heizung as stale.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const BASE = 'javascript.0.sam_digital';

// reply(sql) returns the Influx response for that query
function load(reply) {
    const queries = [], written = [], created = [];
    const ctx = {
        console: { log() {}, error() {} },
        createState: (id) => { created.push(id); },
        schedule() {},
        setState: (id, val) => { written.push([id, val]); },
        sendTo: (adapter, cmd, sql, cb) => { queries.push(sql); cb(reply(sql)); }
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'sam_digital.js'), 'utf8'), ctx);
    ctx.queries = queries;
    ctx.written = written;
    ctx.created = created;
    return ctx;
}

const rows = (row) => ({ result: [row ? [row] : []] });
const isTemp = (sql) => sql.includes('heat_temperature_celsius');
const GOOD_TEMPS = { heating_flow: 45, heating_return: 35, hotwater_storage: 55 };
const GOOD_VALVES = { heating: 30, hotwater: 0 };
const normal = (sql) => rows(isTemp(sql) ? GOOD_TEMPS : GOOD_VALVES);
const valueOf = (ctx, name) => (ctx.written.find((w) => w[0] === `${BASE}.${name}`) || [])[1];

test('current-value queries only look at the last 30 minutes', () => {
    const ctx = load(normal);
    const current = ctx.queries.filter((sql) => /LIMIT 1/.test(sql));
    assert.equal(current.length, 2);
    current.forEach((sql) => assert.match(sql, /WHERE time > now\(\) - 30m/));
});

test('no recent temperature row: nothing is written, so the state ts can age', () => {
    const ctx = load((sql) => rows(isTemp(sql) ? null : GOOD_VALVES));
    assert.equal(ctx.written.filter((w) => /temperature/.test(w[0])).length, 0);
});

test('no recent valve row: nothing is written', () => {
    const ctx = load((sql) => rows(isTemp(sql) ? GOOD_TEMPS : null));
    assert.equal(ctx.written.filter((w) => /valve/.test(w[0])).length, 0);
});

test('influx error: nothing is written', () => {
    const ctx = load(() => ({ error: 'timeout' }));
    assert.deepEqual(ctx.written, []);
});

test('valve field missing from the row is written as null, not 0', () => {
    const ctx = load((sql) => rows(isTemp(sql) ? GOOD_TEMPS : { heating: 30 }));
    assert.equal(valueOf(ctx, 'heating_valve_signal'), 30);
    assert.equal(valueOf(ctx, 'hotwater_valve_signal'), null);
});

test('a genuine 0 % valve signal is kept as 0', () => {
    const ctx = load(normal);
    assert.equal(valueOf(ctx, 'hotwater_valve_signal'), 0);
});

test('implausible probe reading (-60 C) is written as null', () => {
    const ctx = load((sql) => rows(isTemp(sql) ? { ...GOOD_TEMPS, heating_flow: -60 } : GOOD_VALVES));
    assert.equal(valueOf(ctx, 'heating_flow_temperature'), null);
    assert.equal(valueOf(ctx, 'heating_return_temperature'), 35);
});

test('plausible readings are written through', () => {
    const ctx = load(normal);
    assert.equal(valueOf(ctx, 'heating_flow_temperature'), 45);
    assert.equal(valueOf(ctx, 'hotwater_storage_temperature'), 55);
    assert.equal(valueOf(ctx, 'heating_valve_signal'), 30);
});

test('only the current-value queries run, no 30-day statistics', () => {
    const ctx = load(normal);
    assert.equal(ctx.queries.length, 2);
    ctx.queries.forEach((sql) => assert.doesNotMatch(sql, /PERCENTILE|MIN\(|MAX\(/));
});

test('only the five states a consumer reads are created', () => {
    const ctx = load(normal);
    assert.deepEqual(ctx.created.sort(), [
        'heating_flow_temperature', 'heating_return_temperature', 'heating_valve_signal',
        'hotwater_storage_temperature', 'hotwater_valve_signal'
    ].map((n) => `${BASE}.${n}`));
});

test('unused outdoor and hotwater-return readings are not written', () => {
    const ctx = load(() => rows({ ...GOOD_TEMPS, ...GOOD_VALVES, outdoor: 8, hotwater_return: 40 }));
    assert.equal(ctx.written.filter((w) => /outdoor|hotwater_return|_30d_/.test(w[0])).length, 0);
});
