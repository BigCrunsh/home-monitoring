// Kids' room buttons switch their Hue lamps from ioBroker (kids_room_lights.js). Since the Hue bridge
// firmware of 2026-11-17 blocks plain HTTP, the CCU's built-in Hue integration (HTTP only) cannot switch
// any Hue lamp: on 2026-11-20 every press reached the CCU and ran its LICHT_* program, and no lamp moved.
// ioBroker talks to the bridge over HTTPS. Upper rocker = on, lower = off; Carlotta's long press is her
// floor lamp. 15 s after a press the lamp must be confirmed by the bridge in the pressed state, otherwise
// the press is a fault that Diagnose reports ("reagiert nicht auf Taster") until a press works again.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const CLARA = 'hm-rpc.1.0019E2698C76C8', PLAYROOM = 'hm-rpc.1.0019E2698C76E3', CARLOTTA = 'hm-rpc.1.00085D899DB3AB';
const CLARA_LAMP = 'hue.0.Claras_Deckenlampe', PLAYROOM_LAMP = 'hue.0.Deckenlampe_';
const CARLOTTA_CEILING = 'hue.0.Carlottas_Deckenlampe', CARLOTTA_FLOOR = 'hue.0.Carlottas_Stehlampe';
const FAULTS = 'javascript.0.light_button_faults';

// states: {id: val} (ack true). ctx.fire(id) delivers a confirmed button event; ctx.elapse() runs the
// pending reaction checks.
function load(states) {
    const st = {};
    Object.keys(states).forEach((id) => { st[id] = { val: states[id], ack: true }; });
    const handlers = [], written = [], timers = [];
    const ctx = {
        console: { log() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        setState: (id, val, ack) => {
            if (id !== FAULTS) written.push([id, val]);
            st[id] = { val, ack: !!ack };
        },
        createState: (id, def) => { if (!(id in st)) st[id] = { val: def, ack: true }; },
        on: (pattern, cb) => handlers.push({ pattern, cb }),
        setTimeout: (fn) => timers.push(fn)
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'kids_room_lights.js'), 'utf8'), ctx);
    ctx.fire = (id, ack) => handlers.forEach((h) => {
        if (h.pattern.id !== id) return;
        if (h.pattern.ack !== undefined && h.pattern.ack !== (ack !== false)) return;
        h.cb({ id, state: { val: true, ack: ack !== false } });
    });
    ctx.elapse = () => timers.splice(0).forEach((fn) => fn());
    ctx.confirm = (id, val) => { st[id] = { val, ack: true }; };   // the hue adapter acknowledging the bridge
    ctx.faults = () => JSON.parse((st[FAULTS] && st[FAULTS].val) || '{}');
    ctx.written = written;
    return ctx;
}
const reachable = (lamp) => ({ [lamp + '.reachable']: true, [lamp + '.on']: false });

test('buttons: Clara\'s upper rocker switches her ceiling lamp on, the lower one off', () => {
    const ctx = load(reachable(CLARA_LAMP));
    ctx.fire(CLARA + '.2.PRESS_SHORT');
    ctx.fire(CLARA + '.1.PRESS_SHORT');
    assert.deepEqual(ctx.written, [[CLARA_LAMP + '.on', true], [CLARA_LAMP + '.on', false]]);
});

test('buttons: the playroom button switches the playroom ceiling lamp', () => {
    const ctx = load(reachable(PLAYROOM_LAMP));
    ctx.fire(PLAYROOM + '.2.PRESS_SHORT');
    assert.deepEqual(ctx.written, [[PLAYROOM_LAMP + '.on', true]]);
});

test('buttons: Carlotta\'s short press is her ceiling lamp, the long press her floor lamp', () => {
    const ctx = load(Object.assign(reachable(CARLOTTA_CEILING), reachable(CARLOTTA_FLOOR)));
    ctx.fire(CARLOTTA + '.2.PRESS_SHORT');
    ctx.fire(CARLOTTA + '.1.PRESS_LONG_START');
    assert.deepEqual(ctx.written, [[CARLOTTA_CEILING + '.on', true], [CARLOTTA_FLOOR + '.on', false]]);
});

test('buttons: a press event not confirmed by the device (ack=false) switches nothing', () => {
    const ctx = load(reachable(CLARA_LAMP));
    ctx.fire(CLARA + '.2.PRESS_SHORT', false);
    assert.deepEqual(ctx.written, []);
});

test('buttons: a long press on Clara\'s button (no CCU program for it either) switches nothing', () => {
    const ctx = load(reachable(CLARA_LAMP));
    ctx.fire(CLARA + '.2.PRESS_LONG_START');
    assert.deepEqual(ctx.written, []);
});

test('reaction: a lamp the bridge confirms in the pressed state is no fault', () => {
    const ctx = load(reachable(CLARA_LAMP));
    ctx.fire(CLARA + '.2.PRESS_SHORT');
    ctx.confirm(CLARA_LAMP + '.on', true);
    ctx.elapse();
    assert.deepEqual(ctx.faults(), {});
});

test('reaction: a lamp still unconfirmed after the check is a fault named after the light', () => {
    const ctx = load(reachable(CLARA_LAMP));
    ctx.fire(CLARA + '.2.PRESS_SHORT');
    ctx.elapse();
    assert.deepEqual(Object.keys(ctx.faults()), ['Clara Decke']);
});

test('reaction: a lamp the bridge reports in the other state is a fault', () => {
    const ctx = load(reachable(CARLOTTA_FLOOR));
    ctx.fire(CARLOTTA + '.2.PRESS_LONG_START');
    ctx.confirm(CARLOTTA_FLOOR + '.on', false);
    ctx.elapse();
    assert.deepEqual(Object.keys(ctx.faults()), ['Carlotta Stehlampe']);
});

test('reaction: an unreachable lamp (no power) is not a button fault', () => {
    const ctx = load({ [CLARA_LAMP + '.reachable']: false, [CLARA_LAMP + '.on']: false });
    ctx.fire(CLARA + '.2.PRESS_SHORT');
    ctx.elapse();
    assert.deepEqual(ctx.faults(), {});
});

test('reaction: the next press that works clears the fault', () => {
    const ctx = load(reachable(CLARA_LAMP));
    ctx.fire(CLARA + '.2.PRESS_SHORT');
    ctx.elapse();
    ctx.fire(CLARA + '.1.PRESS_SHORT');
    ctx.confirm(CLARA_LAMP + '.on', false);
    ctx.elapse();
    assert.deepEqual(ctx.faults(), {});
});

test('reaction: a fault survives a script restart', () => {
    const ctx = load(Object.assign(reachable(CLARA_LAMP), { [FAULTS]: JSON.stringify({ 'Clara Decke': 1 }) }));
    ctx.fire(PLAYROOM + '.2.PRESS_SHORT');
    assert.deepEqual(Object.keys(ctx.faults()), ['Clara Decke']);
});
