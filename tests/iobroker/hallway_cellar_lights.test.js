// Hallway + cellar lights straight from ioBroker (hallway_cellar_lights.js). The CCU programs that did this
// are slower and stop entirely when the CCU's program engine dies (2026-10-18 02:48 — no light by button
// until a reboot). The script mirrors those programs; the CCU ones stay active as a fallback.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const CELLAR_MOTION = 'hm-rpc.1.00091BE9910C5B.1.MOTION', HALL_MOTION = 'hm-rpc.1.00091A4996315B.1.MOTION';
const CELLAR_LAMP = 'hue.0.Kellervorraumlicht.on', ENTRANCE_LAMP = 'hue.0.Eingangslampe.on';
const FRONT = 'hm-rpc.1.0019DD8989C5B8', BACK = 'hm-rpc.1.0019DD8989C615';
const VITRINE = 'hm-rpc.1.0001DD89AADDE7.3.STATE', COUCH = 'hm-rpc.1.0001DD89A46CAD.3.STATE';

function load(states) {
    const st = Object.assign({}, states);
    const handlers = [], written = [];
    const ctx = {
        console: { log() {} },
        getState: (id) => (id in st ? { val: st[id] } : null),
        existsState: (id) => id in st,
        setState: (id, val) => { written.push([id, val]); st[id] = val; },
        on: (pattern, cb) => handlers.push({ pattern, cb })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'hallway_cellar_lights.js'), 'utf8'), ctx);
    // fire an event the way the javascript adapter would: only to subscriptions whose id matches and
    // whose ack filter accepts it; change 'ne' (the default) drops repeats of the same value
    ctx.fire = (id, val, ack) => {
        const old = st[id];
        st[id] = val;
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

test('cellar: motion switches the cellar light on, no motion switches it off', () => {
    const ctx = load({ [CELLAR_MOTION]: false });
    ctx.fire(CELLAR_MOTION, true, true);
    ctx.fire(CELLAR_MOTION, false, true);
    assert.deepEqual(ctx.written, [[CELLAR_LAMP, true], [CELLAR_LAMP, false]]);
});

test('cellar: a motion command not confirmed by the device (ack=false) switches nothing', () => {
    const ctx = load({ [CELLAR_MOTION]: false });
    ctx.fire(CELLAR_MOTION, true, false);
    assert.deepEqual(ctx.written, []);
});

test('hallway: motion alone does not switch the entrance light on (the buttons do)', () => {
    const ctx = load({ [HALL_MOTION]: false });
    ctx.fire(HALL_MOTION, true, true);
    assert.deepEqual(ctx.written, []);
});

test('hallway: motion ending switches the entrance light off', () => {
    const ctx = load({ [HALL_MOTION]: true });
    ctx.fire(HALL_MOTION, false, true);
    assert.deepEqual(ctx.written, [[ENTRANCE_LAMP, false]]);
});

test('buttons: a short press on the upper rocker of either entrance button switches the light on', () => {
    for (const btn of [FRONT, BACK]) {
        const ctx = load({ [btn + '.2.PRESS_SHORT']: true });
        ctx.fire(btn + '.2.PRESS_SHORT', true, true);   // the same value as last time — every press must count
        assert.deepEqual(ctx.written, [[ENTRANCE_LAMP, true]], btn);
    }
});

test('buttons: a short press on the lower rocker switches the light off', () => {
    const ctx = load({ [FRONT + '.1.PRESS_SHORT']: true });
    ctx.fire(FRONT + '.1.PRESS_SHORT', true, true);
    assert.deepEqual(ctx.written, [[ENTRANCE_LAMP, false]]);
});

test('buttons: a press event not from the device (ack=false) switches nothing', () => {
    const ctx = load({});
    ctx.fire(FRONT + '.2.PRESS_SHORT', true, false);
    assert.deepEqual(ctx.written, []);
});

test('buttons: a long press on the lower rocker switches the entrance light and both living-room plugs off', () => {
    const ctx = load({ [VITRINE]: true, [COUCH]: true });
    ctx.fire(BACK + '.1.PRESS_LONG_START', true, true);
    assert.deepEqual(ctx.written, [[ENTRANCE_LAMP, false], [VITRINE, false], [COUCH, false]]);
});

test('buttons: a long press does not resend a plug that is already in the wanted state', () => {
    const ctx = load({ [VITRINE]: false, [COUCH]: true });
    ctx.fire(FRONT + '.1.PRESS_LONG_START', true, true);
    assert.deepEqual(ctx.written, [[ENTRANCE_LAMP, false], [COUCH, false]]);
});

test('buttons: a long press on the upper rocker switches both plugs on and leaves the entrance light alone', () => {
    const ctx = load({ [VITRINE]: false, [COUCH]: false });
    ctx.fire(FRONT + '.2.PRESS_LONG_START', true, true);
    assert.deepEqual(ctx.written, [[VITRINE, true], [COUCH, true]]);
});

test('buttons: holding a rocker (repeated PRESS_LONG) does not repeat the command', () => {
    const ctx = load({ [VITRINE]: false, [COUCH]: false });
    ctx.fire(FRONT + '.2.PRESS_LONG', true, true);
    ctx.fire(FRONT + '.2.PRESS_LONG', true, true);
    assert.deepEqual(ctx.written, []);
});
