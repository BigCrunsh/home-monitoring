// Diagnose "Geräte · HomeMatic" (diagnose_v2.js). When a device is removed on the CCU, hm-rpc deletes
// its objects but the last state values linger (UNREACH stays true). The device list must follow the
// CCU on every refresh — a removed plug kept showing "offline" until the script was restarted.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const PLUG = 'hm-rpc.1.0001DD89A46B91', MOTION = 'hm-rpc.1.00091A4996315B', LAMP = 'hm-rpc.1.0001DD89A46CA5';

// objects = device ids whose objects exist (what $ and getObject see); states = lingering values
function loadDiagnose(objects, names, rooms) {
    const now = Date.now();
    const states = {};
    [PLUG, MOTION, LAMP].forEach((d) => { states[d + '.0.UNREACH'] = { val: true, ts: now, lc: now }; });
    const ctx = {
        console: { log() {} },
        getState: (id) => states[id] || null,
        existsState: (id) => id in states,
        getObject: (id) => (objects.includes(id) ? { common: { name: names[id] } } : null),
        getEnums: (cat) => (cat === 'rooms' ? rooms || [] : []),
        $: (sel) => ({ each: (fn) => objects.forEach((d) => fn(d + '.0.UNREACH')) }),
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.objects = objects;
    return ctx;
}
const NAMES = { [PLUG]: 'Steckdose Studio Stehlampe', [MOTION]: 'Bewegungssensor', [LAMP]: 'Steckdose Maxxisun Akku' };

test('devices: a device removed on the CCU disappears on the next refresh, without a restart', () => {
    const objects = [PLUG, MOTION];
    const ctx = loadDiagnose(objects, NAMES);
    assert.match(ctx.buildDevices(), /Steckdose Studio Stehlampe/);
    objects.splice(objects.indexOf(PLUG), 1);   // hm-rpc deleteDevices
    const h = ctx.buildDevices();
    assert.doesNotMatch(h, /Steckdose Studio Stehlampe/);
    assert.match(h, /Bewegungssensor/);
});

test('devices: a channel state left behind by a deleted device is never listed', () => {
    const ctx = loadDiagnose([MOTION], NAMES);
    // the selector still finds the plug's UNREACH, but its device object is gone
    ctx.$ = () => ({ each: (fn) => [PLUG, MOTION].forEach((d) => fn(d + '.0.UNREACH')) });
    const h = ctx.buildDevices();
    assert.doesNotMatch(h, /Steckdose/);
    assert.doesNotMatch(h, /0001DD89A46/);
});

test('devices: a device added on the CCU appears on the next refresh', () => {
    const objects = [MOTION];
    const ctx = loadDiagnose(objects, NAMES);
    ctx.buildDevices();
    objects.push(LAMP);
    assert.match(ctx.buildDevices(), /Steckdose Maxxisun Akku/);
});

// "Bewegungssensor offline" alone doesn't say which of the three motion sensors to fix
test('devices: an offline device names the room it is assigned to on the CCU', () => {
    const rooms = [{ id: 'enum.rooms.Eingang', name: 'Eingangsbereich', members: [MOTION + '.1'] }];
    const h = loadDiagnose([MOTION], NAMES, rooms).buildDevices();
    assert.match(h, /Eingangsbereich · Bewegungssensor/);
});

test('devices: a device without a room keeps its plain name, no dangling separator', () => {
    const rooms = [{ id: 'enum.rooms.Keller', name: 'Keller', members: ['hm-rpc.1.00091BE9910C5B.1'] }];
    const h = loadDiagnose([MOTION], NAMES, rooms).buildDevices();
    assert.match(h, /<span class="nm">Bewegungssensor<\/span>/);
});

test('devices: a room whose name is translated shows the German name', () => {
    const rooms = [{ id: 'enum.rooms.Keller', name: { en: 'Basement', de: 'Keller' }, members: [MOTION] }];
    const h = loadDiagnose([MOTION], NAMES, rooms).buildDevices();
    assert.match(h, /Keller · Bewegungssensor/);
    assert.doesNotMatch(h, /Basement|object Object/);
});

test('devices: a sibling device whose address shares a prefix is not mistaken for a room member', () => {
    const rooms = [{ id: 'enum.rooms.Keller', name: 'Keller', members: [MOTION + '0.1'] }];
    const h = loadDiagnose([MOTION], NAMES, rooms).buildDevices();
    assert.doesNotMatch(h, /Keller/);
});

test('devices: a room already named in the device name is not repeated', () => {
    const rooms = [{ id: 'enum.rooms.Flur', name: 'Flur', members: [MOTION + '.1'] }];
    const h = loadDiagnose([MOTION], { [MOTION]: 'Bewegungsmelder Flur' }, rooms).buildDevices();
    assert.match(h, /<span class="nm">Bewegungsmelder Flur<\/span>/);
});
