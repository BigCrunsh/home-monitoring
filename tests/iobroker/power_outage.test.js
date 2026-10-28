// Power outage log (power_outage.js). The Pi has no UPS and no clock battery, so an outage shows up as a
// boot after a stop the javascript adapter did not see coming: the outage began at the last heartbeat
// before that boot and ended when the Pi booted again. A clean shutdown or a script restart is no outage.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const HEARTBEAT = 'javascript.0.power.heartbeat';
const CLEAN_STOP = 'javascript.0.power.clean_stop';
const LAST_OUTAGE = 'javascript.0.power.last_outage';
const MIN = 60 * 1000;
// 2026-09-26 00:42 Berlin: the power came back and the Pi booted, 6 minutes after its last heartbeat
const BOOT = Date.UTC(2026, 8, 25, 22, 42);
const LAST_BEAT = BOOT - 6 * MIN;

function load(states, opts) {
    let now = opts.now;
    const st = {};
    Object.keys(states).forEach((id) => { st[id] = { val: states[id] }; });
    const written = {}, influx = [], timers = [], schedules = [], warnings = [];
    let onStopCb = null;
    const http = {
        request: (o, cb) => {
            const req = {
                on: (ev, h) => { if (ev === 'error' && opts.influxDown) h(new Error('connect ECONNREFUSED')); return req; },
                end: (body) => influx.push({ path: o.path, method: o.method, body })
            };
            return req;
        }
    };
    const ctx = {
        console: { log() {}, warn: (m) => warnings.push(m) },
        Date: { now: () => now, UTC: Date.UTC },
        // uptime runs on its own clock: NTP moving the wall clock does not move it
        uptime: () => (opts.uptimeS != null ? opts.uptimeS : (now - opts.bootAt) / 1000),
        require: (m) => (m === 'os' ? { uptime: () => ctx.uptime() } : m === 'http' ? http : null),
        getState: (id) => st[id] || null,
        setState: (id, val) => { written[id] = val; st[id] = { val }; },
        createState: (id, def, common, cb) => { if (!(id in st)) st[id] = { val: def }; if (cb) cb(); },
        schedule: (rule, cb) => schedules.push(rule),
        setTimeout: (cb, ms) => timers.push({ cb, ms }),
        onStop: (cb) => { onStopCb = cb; }
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'power_outage.js'), 'utf8'), ctx);
    ctx.at = (t) => { now = t; };
    ctx.runTimers = () => { const t = timers.splice(0); t.forEach((x) => x.cb()); };
    ctx.stop = () => onStopCb(() => {});
    Object.assign(ctx, { written, influx, timers, schedules, warnings });
    return ctx;
}

test('a boot after an unannounced stop is logged as an outage from the last heartbeat to the boot', () => {
    const ctx = load({ [HEARTBEAT]: LAST_BEAT, [CLEAN_STOP]: false }, { now: BOOT + 2 * MIN, bootAt: BOOT });
    assert.deepEqual(JSON.parse(ctx.written[LAST_OUTAGE]), { start: LAST_BEAT, end: BOOT });
    assert.equal(ctx.influx.length, 1);
    assert.equal(ctx.influx[0].method, 'POST');
    assert.match(ctx.influx[0].path, /^\/write\?db=home_monitoring&precision=ms$/);
    assert.equal(ctx.influx[0].body, 'electricity_outage_seconds duration=360 ' + LAST_BEAT);
});

test('after the check the heartbeat runs every minute and the stop marker is reset', () => {
    const ctx = load({ [HEARTBEAT]: LAST_BEAT, [CLEAN_STOP]: true }, { now: BOOT + 2 * MIN, bootAt: BOOT });
    assert.equal(ctx.written[HEARTBEAT], BOOT + 2 * MIN);
    assert.equal(ctx.written[CLEAN_STOP], false);
    assert.deepEqual(ctx.schedules, ['* * * * *']);
});

test('a clean shutdown before the boot is no outage', () => {
    const ctx = load({ [HEARTBEAT]: LAST_BEAT, [CLEAN_STOP]: true }, { now: BOOT + 2 * MIN, bootAt: BOOT });
    assert.equal(ctx.written[LAST_OUTAGE], undefined);
    assert.equal(ctx.influx.length, 0);
});

test('stopping the script marks the stop as clean', () => {
    const ctx = load({ [HEARTBEAT]: LAST_BEAT, [CLEAN_STOP]: false }, { now: BOOT + 2 * MIN, bootAt: BOOT });
    ctx.stop();
    assert.equal(ctx.written[CLEAN_STOP], true);
});

test('a script or adapter restart without a Pi reboot is no outage, even without a clean stop', () => {
    const bootedLongAgo = BOOT - 30 * 24 * 60 * MIN;
    const ctx = load({ [HEARTBEAT]: BOOT - MIN, [CLEAN_STOP]: false }, { now: BOOT, bootAt: bootedLongAgo });
    assert.equal(ctx.written[LAST_OUTAGE], undefined);
    assert.equal(ctx.influx.length, 0);
});

test('the very first start (no heartbeat yet) is no outage', () => {
    const ctx = load({}, { now: BOOT, bootAt: BOOT - 10 * MIN });
    assert.equal(ctx.written[LAST_OUTAGE], undefined);
    assert.equal(ctx.written[HEARTBEAT], BOOT);
});

test('before the clock is synced (the Pi boots at 1970) nothing is judged or written, it retries', () => {
    const ctx = load({ [HEARTBEAT]: LAST_BEAT, [CLEAN_STOP]: false }, { now: 4 * MIN, uptimeS: 4 * 60 });
    assert.deepEqual(ctx.written, {});
    assert.equal(ctx.timers.length, 1);
    ctx.at(BOOT + 5 * MIN);                       // NTP has set the clock
    ctx.uptime = () => 5 * 60;
    ctx.runTimers();
    assert.deepEqual(JSON.parse(ctx.written[LAST_OUTAGE]), { start: LAST_BEAT, end: BOOT });
});

test('an unsynced clock on the very first start writes no 1970 heartbeat', () => {
    const ctx = load({}, { now: 5 * MIN, uptimeS: 5 * 60 });
    assert.equal(ctx.written[HEARTBEAT], undefined);
    assert.equal(ctx.timers.length, 1);
});

test('Influx unreachable: the outage still reaches the dashboard and the failure is logged', () => {
    const ctx = load({ [HEARTBEAT]: LAST_BEAT, [CLEAN_STOP]: false }, { now: BOOT + 2 * MIN, bootAt: BOOT, influxDown: true });
    assert.deepEqual(JSON.parse(ctx.written[LAST_OUTAGE]), { start: LAST_BEAT, end: BOOT });
    assert.equal(ctx.written[HEARTBEAT], BOOT + 2 * MIN);
    assert.match(ctx.warnings.join('\n'), /Influx write failed: connect ECONNREFUSED/);
});
