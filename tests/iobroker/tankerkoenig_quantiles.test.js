// Tankerkoenig 14-day price quantiles (tankerkoenig_quantiles.js): InfluxDB rows -> states main_v2 reads.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPT = path.join(__dirname, '..', '..', 'integrations', 'iobroker', 'tankerkoenig_quantiles.js');
const BASE = 'javascript.0.tankerkoenig_quantiles';

// reply(query) returns what influxdb.0 would answer; the script's startup timers are fired by hand.
function load(reply) {
    const written = [], created = [], logs = [], schedules = [], timers = [];
    const ctx = {
        console: {
            log: (m) => logs.push(['log', m]),
            warn: (m) => logs.push(['warn', m]),
            error: (m) => logs.push(['error', m])
        },
        createState: (id, init, common) => created.push({ id, init, common }),
        setState: (id, val) => written.push([id, val]),
        sendTo: (adapter, cmd, query, cb) => cb(reply(query)),
        setTimeout: (fn) => timers.push(fn),
        schedule: (cron, fn) => schedules.push({ cron, fn }),
        on: () => assert.fail('script must not subscribe to anything')
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), ctx);
    return { written, created, logs, schedules, runStartup: () => timers.forEach((fn) => fn()) };
}

const row = { min: 1.6, max: 2.1, p20: 1.7, p50: 1.8, p80: 1.95 };

test('writes min/max/p20/p50/p80 for both fuels from the query result', () => {
    const t = load(() => ({ result: [[row]] }));
    t.runStartup();
    for (const fuel of ['e5', 'diesel']) {
        for (const stat of ['min', 'max', 'p20', 'p50', 'p80']) {
            assert.deepEqual(t.written.filter(([id]) => id === `${BASE}.${fuel}_${stat}`), [[`${BASE}.${fuel}_${stat}`, row[stat]]]);
        }
    }
    assert.equal(t.written.length, 10);
});

test('empty result leaves the states untouched', () => {
    const t = load(() => ({ result: [[]] }));
    t.runStartup();
    assert.deepEqual(t.written, []);
});

test('missing result payload leaves the states untouched', () => {
    const t = load(() => ({}));
    t.runStartup();
    assert.deepEqual(t.written, []);
});

test('influx error does not throw, writes nothing and is logged', () => {
    const t = load(() => ({ error: 'connection refused' }));
    assert.doesNotThrow(() => t.runStartup());
    assert.deepEqual(t.written, []);
    assert.ok(t.logs.some(([level]) => level === 'error'));
});

test('null stat in a row is skipped, the others are written', () => {
    const t = load(() => ({ result: [[{ min: 1.6, max: null, p20: 1.7, p50: 1.8, p80: 1.95 }]] }));
    t.runStartup();
    assert.ok(!t.written.some(([id]) => id.endsWith('_max')));
    assert.equal(t.written.length, 8);
});

test('quantile states start without a value so main_v2 shows a dash, not a 0 price band', () => {
    const t = load(() => ({ result: [[row]] }));
    assert.equal(t.created.length, 10);
    assert.ok(t.created.every((c) => c.init === undefined));
});

test('a run logs at most one line on success; no unused _ts or _html states exist', () => {
    const t = load(() => ({ result: [[row]] }));
    const before = t.logs.length;
    t.runStartup();
    assert.equal(t.logs.length - before, 0);
    assert.ok(!t.created.some((c) => /_ts$|_html$/.test(c.id)));
});

test('refreshes every 30 minutes', () => {
    const t = load(() => ({ result: [[row]] }));
    assert.equal(t.schedules.length, 1);
    assert.equal(t.schedules[0].cron, '1,31 * * * *');
});
