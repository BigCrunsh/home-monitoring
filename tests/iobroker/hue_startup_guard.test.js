// Non-Hue lamps on the Hue bridge come up ON after the bridge restarts or the power returns; they reject
// the "restore last state" startup mode the Hue lamps got on 2026-09-26. On 2026-10-27 14:18 a bridge
// firmware update switched Carlottas Deckenlampe on and it stayed on for 19 h while nobody was home.
// hue_startup_guard.js switches such a lamp back off when it comes on right after the bridge reconnects.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const BRIDGE = 'hue.0.info.connection';
const CARLOTTA = 'hue.0.Carlottas_Deckenlampe.on';
const GUARDED = [CARLOTTA, 'hue.0.Vitinenlicht.on', 'hue.0.Flurlampe.on', 'hue.0.Wohnzimmertischlampe.on'];
const HUE_LAMP = 'hue.0.Carlottas_Stehlampe.on';
const MIN = 60 * 1000;

function load(states, startedAt) {
    let now = startedAt;
    const st = {};
    Object.keys(states).forEach((id) => { st[id] = { val: states[id], lc: now }; });
    const handlers = [], written = [];
    const ctx = {
        console: { log() {} },
        Date: { now: () => now },
        getState: (id) => st[id] || null,
        setState: (id, val) => { written.push([id, val]); },
        on: (pattern, cb) => handlers.push({ pattern, cb })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'hue_startup_guard.js'), 'utf8'), ctx);
    ctx.at = (t) => { now = t; };
    ctx.fire = (id, val, ack) => {
        const old = st[id] ? st[id].val : null;
        st[id] = { val, lc: now };
        handlers.forEach((h) => {
            if (h.pattern.id !== id) return;
            if (h.pattern.ack !== undefined && h.pattern.ack !== ack) return;
            if ((h.pattern.change || 'ne') === 'ne' && old === val) return;
            h.cb({ id, state: { val, ack }, oldState: { val: old } });
        });
    };
    ctx.written = written;
    return ctx;
}

test('a guarded lamp that was off and comes on right after the bridge reconnects is switched back off', () => {
    const T = Date.UTC(2026, 9, 27, 13, 17);
    const ctx = load({ [BRIDGE]: true, [CARLOTTA]: false }, T);
    ctx.fire(BRIDGE, false, true);
    ctx.at(T + 2 * MIN);
    ctx.fire(BRIDGE, true, true);
    ctx.at(T + 2 * MIN + 3000);
    ctx.fire(CARLOTTA, true, true);
    assert.deepEqual(ctx.written, [[CARLOTTA, false]]);
});

test('all four non-Hue lamps are guarded', () => {
    for (const lamp of GUARDED) {
        const ctx = load({ [BRIDGE]: false, [lamp]: false }, 0);
        ctx.at(1000);
        ctx.fire(BRIDGE, true, true);
        ctx.fire(lamp, true, true);
        assert.deepEqual(ctx.written, [[lamp, false]], lamp);
    }
});

test('the script starting after the bridge already reconnected (Pi rebooted too) still guards the lamps', () => {
    const T = Date.UTC(2026, 9, 27, 13, 19);
    const ctx = load({ [BRIDGE]: true, [CARLOTTA]: false }, T);   // connection's last change = script start
    ctx.at(T + 20 * 1000);
    ctx.fire(CARLOTTA, true, true);
    assert.deepEqual(ctx.written, [[CARLOTTA, false]]);
});

test('a lamp switched on in normal operation (no bridge reconnect in the last minutes) stays on', () => {
    const T = Date.UTC(2026, 9, 27, 18, 0);
    const ctx = load({ [BRIDGE]: true, [CARLOTTA]: false }, T - 60 * MIN);
    ctx.at(T);
    ctx.fire(CARLOTTA, true, true);
    assert.deepEqual(ctx.written, []);
});

test('a lamp that was already on before the bridge restart stays on', () => {
    const ctx = load({ [BRIDGE]: false, [CARLOTTA]: true }, 0);
    ctx.at(1000);
    ctx.fire(BRIDGE, true, true);
    ctx.fire(CARLOTTA, true, true);
    assert.deepEqual(ctx.written, []);
});

test('the bridge going offline opens no window: only a reconnect does', () => {
    const T = Date.UTC(2026, 9, 27, 18, 0);
    const ctx = load({ [BRIDGE]: true, [CARLOTTA]: false }, T - 60 * MIN);
    ctx.at(T);
    ctx.fire(BRIDGE, false, true);
    ctx.fire(CARLOTTA, true, true);
    assert.deepEqual(ctx.written, []);
});

test('a Hue lamp restores its own state and is left alone', () => {
    const ctx = load({ [BRIDGE]: false, [HUE_LAMP]: false }, 0);
    ctx.at(1000);
    ctx.fire(BRIDGE, true, true);
    ctx.fire(HUE_LAMP, true, true);
    assert.deepEqual(ctx.written, []);
});

test('an unconfirmed switch-on command (ack=false) is not treated as the lamp coming up', () => {
    const ctx = load({ [BRIDGE]: false, [CARLOTTA]: false }, 0);
    ctx.at(1000);
    ctx.fire(BRIDGE, true, true);
    ctx.fire(CARLOTTA, true, false);
    assert.deepEqual(ctx.written, []);
});

test('the window closes three minutes after the reconnect', () => {
    const ctx = load({ [BRIDGE]: false, [CARLOTTA]: false }, 0);
    ctx.at(1000);
    ctx.fire(BRIDGE, true, true);
    ctx.at(1000 + 3 * MIN + 1);
    ctx.fire(CARLOTTA, true, true);
    assert.deepEqual(ctx.written, []);
});
