// Door lock HmIP-DLD (reset_lock_target_state.js): keeps LOCK_TARGET_LEVEL in line with the real
// LOCK_STATE and resets 'OPEN' to 'UNLOCKED' 7 s after the latch retracts. The delayed reset must
// never unlock a door that was locked again in the meantime.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const STATE = 'hm-rpc.1.002A226996B89C.1.LOCK_STATE';
const TARGET = 'hm-rpc.1.002A226996B89C.1.LOCK_TARGET_LEVEL';

function load(lockState, target) {
    const st = { [STATE]: lockState, [TARGET]: target };
    const writes = [], timers = new Map();
    let nextTimer = 1, handler = null;
    const ctx = {
        console: { log() {}, debug() {} },
        getState: (id) => ({ val: st[id] }),
        setState: (id, val) => { writes.push({ id, val }); st[id] = val; },
        on: (_opts, fn) => { handler = fn; },
        setTimeout: (fn, ms) => { const t = nextTimer++; timers.set(t, { fn, ms }); return t; },
        clearTimeout: (t) => { timers.delete(t); }
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'reset_lock_target_state.js'), 'utf8'), ctx);
    return {
        st, writes, timers,
        // the device reports a new LOCK_STATE, then the handler runs
        event(val, oldState) {
            st[STATE] = val;
            return handler({ state: { val }, oldState });
        },
        fireTimers() { for (const [t, { fn }] of [...timers]) { timers.delete(t); fn(); } }
    };
}

test('OPEN target is reset to UNLOCKED once the 7 s timer fires with the door still unlocked', async () => {
    const lock = load(2, 'OPEN');
    await lock.event(2, { val: 1 });
    assert.deepEqual(lock.writes, []);
    assert.deepEqual([...lock.timers.values()].map((t) => t.ms), [7000]);
    lock.fireTimers();
    assert.deepEqual(lock.writes, [{ id: TARGET, val: 'UNLOCKED' }]);
});

test('door locked within the 7 s: stale reset must not unlock it', async () => {
    const lock = load(2, 'OPEN');
    await lock.event(2, { val: 1 });
    await lock.event(1, { val: 2 });
    lock.fireTimers();
    assert.ok(!lock.writes.some((w) => w.val === 'UNLOCKED'), JSON.stringify(lock.writes));
});

test('even if the pending timer survives, it re-checks LOCK_STATE before writing', async () => {
    const lock = load(2, 'OPEN');
    await lock.event(2, { val: 1 });
    lock.st[STATE] = 1;
    lock.fireTimers();
    assert.deepEqual(lock.writes, []);
});

test('repeated unlocked events leave a single pending timer, so only one write lands', async () => {
    const lock = load(2, 'OPEN');
    await lock.event(2, { val: 1 });
    await lock.event(2, { val: 2 });
    await lock.event(2, { val: 2 });
    assert.equal(lock.timers.size, 1);
    lock.fireTimers();
    assert.equal(lock.writes.filter((w) => w.val === 'UNLOCKED').length, 1);
});

test('target changed away from OPEN before the timer fires: no write', async () => {
    const lock = load(2, 'OPEN');
    await lock.event(2, { val: 1 });
    lock.st[TARGET] = 'LOCKED';
    lock.fireTimers();
    assert.deepEqual(lock.writes, []);
});

test('any later lock event clears the pending timer', async () => {
    const lock = load(2, 'OPEN');
    await lock.event(2, { val: 1 });
    lock.st[TARGET] = 'LOCKED';
    await lock.event(1, { val: 2 });
    assert.equal(lock.timers.size, 0);
});

test('locked door with target UNLOCKED: target synced to LOCKED', async () => {
    const lock = load(1, 'UNLOCKED');
    await lock.event(1, { val: 2 });
    assert.deepEqual(lock.writes, [{ id: TARGET, val: 'LOCKED' }]);
});

test('unlocked door with target LOCKED: target synced to UNLOCKED, no timer', async () => {
    const lock = load(2, 'LOCKED');
    await lock.event(2, { val: 1 });
    assert.deepEqual(lock.writes, [{ id: TARGET, val: 'UNLOCKED' }]);
    assert.equal(lock.timers.size, 0);
});

test('consistent state writes nothing', async () => {
    const lock = load(1, 'LOCKED');
    await lock.event(1, { val: 1 });
    assert.deepEqual(lock.writes, []);
});

test('missing oldState does not throw', () => {
    const lock = load(2, 'OPEN');
    assert.doesNotThrow(() => lock.event(2, undefined));
});
