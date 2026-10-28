// Diagnose "Geräte" beyond HomeMatic (diagnose_v2.js): Netatmo modules and Hue battery remotes.
// The rain gauge went silent on 2025-12-30 and the wind gauge on 2025-08-14 without the dashboard
// noticing — only the base stations' temperature was watched.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const HOME = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
const STUDIO = 'netatmo.0.6a48fde5178fa8d8cd09bd27.70-ee-50-c2-86-aa';
const RAIN = HOME + '.05-00-00-05-d4-18', GARDEN = HOME + '.02-00-00-32-ae-a4', ROOF = STUDIO + '.02-00-00-c2-7e-7c';
const HOUR = 3600000;

function netatmoDate(msAgo) { return new Date(Date.now() - msAgo).toString(); }

// objects: {id: name}; states: {id: val}. $ matches the selector's id glob against the state ids.
function loadDiagnose(objects, states) {
    const now = Date.now();
    const st = {};
    Object.keys(states).forEach((id) => { st[id] = { val: states[id], ts: now, lc: now }; });
    const ctx = {
        console: { log() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        getObject: (id) => (id in objects ? { common: { name: objects[id] } } : null),
        getEnums: () => [],
        $: (sel) => {
            const glob = sel.match(/id=([^\]]+)\]/)[1];
            const re = new RegExp('^' + glob.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            return { each: (fn) => Object.keys(st).filter((id) => re.test(id)).forEach(fn) };
        },
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    return ctx;
}

test('netatmo: a module silent for months is listed as still', () => {
    const ctx = loadDiagnose({ [RAIN]: 'Regenmesser' }, { [RAIN + '.LastUpdate']: netatmoDate(200 * 24 * HOUR), [RAIN + '.BatteryStatus']: 60 });
    const h = ctx.buildDevices();
    assert.match(h, /Regenmesser<\/span><span class="ag" style="color:#F1BE3D">still seit 200 Tg/);
});

test('netatmo: a module that reported minutes ago with a good battery raises nothing', () => {
    const ctx = loadDiagnose({ [GARDEN]: 'Gartenhaus' }, { [GARDEN + '.LastUpdate']: netatmoDate(0.1 * HOUR), [GARDEN + '.BatteryStatus']: 38 });
    const h = ctx.buildDevices();
    assert.match(h, /1 Geräte/);
    assert.match(h, /alle ok/);
});

test('netatmo: a base station is not mistaken for a module', () => {
    const ctx = loadDiagnose({ [HOME]: 'Wohnzimmer' }, { [HOME + '.LastUpdate']: netatmoDate(500 * HOUR) });
    const h = ctx.buildDevices();
    assert.doesNotMatch(h, /Wohnzimmer/);
    assert.match(h, /0 Geräte/);
});

test('netatmo: a low battery is flagged even while the module still reports', () => {
    const ctx = loadDiagnose({ [GARDEN]: 'Gartenhaus' }, { [GARDEN + '.LastUpdate']: netatmoDate(0.1 * HOUR), [GARDEN + '.BatteryStatus']: 12 });
    assert.match(ctx.buildDevices(), /Gartenhaus<\/span><span class="ag" style="color:#F1BE3D">Batterie schwach/);
});

test('netatmo: a module of the Studio station says which station it belongs to', () => {
    const ctx = loadDiagnose({ [ROOF]: 'Dachterrasse' }, { [ROOF + '.LastUpdate']: netatmoDate(30 * HOUR), [ROOF + '.BatteryStatus']: 90 });
    assert.match(ctx.buildDevices(), /Studio · Dachterrasse/);
});

test('netatmo: an unreadable last-update text is not reported as still', () => {
    const ctx = loadDiagnose({ [GARDEN]: 'Gartenhaus' }, { [GARDEN + '.LastUpdate']: 'garbage', [GARDEN + '.BatteryStatus']: 80 });
    assert.doesNotMatch(ctx.buildDevices(), /still/);
});

// A Hue remote only radios when pressed, so the bridge never marks it unreachable, and it keeps the last
// battery level it heard. Claras Fernbedienung stood at 1 % for over a week (2026-10-19) shown as amber
// "schwach" although it was dead. At 5 % or less a remote is as good as dead: red "Batterie leer".
test('hue: a remote at 1 % battery is shown red as empty, by its name', () => {
    const ctx = loadDiagnose({ 'hue.0.Claras_Fernbedienung': 'Claras Fernbedienung' }, { 'hue.0.Claras_Fernbedienung.battery': 1 });
    assert.match(ctx.buildDevices(), /Claras Fernbedienung<\/span><span class="ag" style="color:#A00629">Batterie leer/);
});

test('hue: 5 % is still empty, 6 % is only low (amber)', () => {
    const at5 = loadDiagnose({ 'hue.0.R': 'R' }, { 'hue.0.R.battery': 5 }).buildDevices();
    const at6 = loadDiagnose({ 'hue.0.R': 'R' }, { 'hue.0.R.battery': 6 }).buildDevices();
    assert.match(at5, /color:#A00629">Batterie leer/);
    assert.match(at6, /color:#F1BE3D">Batterie schwach/);
});

test('hue: a remote at 21 % raises nothing', () => {
    const ctx = loadDiagnose({ 'hue.0.R': 'R' }, { 'hue.0.R.battery': 21 });
    assert.doesNotMatch(ctx.buildDevices(), /Batterie/);
});

test('hue: an empty remote is listed ahead of amber issues', () => {
    // named so that neither alphabet nor enumeration order puts the empty one first
    const ctx = loadDiagnose({ 'hue.0.A_Low': 'Anna', 'hue.0.Z_Empty': 'Zora' }, { 'hue.0.A_Low.battery': 15, 'hue.0.Z_Empty.battery': 2 });
    const h = ctx.buildDevices();
    assert.ok(h.indexOf('>Zora<') >= 0 && h.indexOf('>Zora<') < h.indexOf('>Anna<'), 'empty first');
});

test('hue: a remote that never reported a battery level raises nothing', () => {
    const ctx = loadDiagnose({ 'hue.0.Hue_dimmer_switch_1': 'Hue dimmer switch 1' }, { 'hue.0.Hue_dimmer_switch_1.battery': null });
    assert.doesNotMatch(ctx.buildDevices(), /Batterie/);
});

test('hue: a remote whose device object is gone is not listed', () => {
    const ctx = loadDiagnose({}, { 'hue.0.Old_Remote.battery': 3 });
    assert.doesNotMatch(ctx.buildDevices(), /Old/);
});

// the wind gauge has no BatteryStatus state; reading it anyway logged a warning every minute
test('netatmo: a module without a battery state is never asked for one', () => {
    const WIND = HOME + '.06-00-00-02-a2-5c';
    const ctx = loadDiagnose({ [WIND]: 'Windmesser' }, { [WIND + '.LastUpdate']: netatmoDate(0.1 * HOUR) });
    const asked = [];
    const realGet = ctx.getState;
    ctx.getState = (id) => { asked.push(id); return realGet(id); };
    ctx.buildDevices();
    assert.ok(!asked.includes(WIND + '.BatteryStatus'));
});

// the Geräte card runs down to the nav panel's bottom edge since 2026-10-18 — room for 8 rows
function remotes(n) {
    const objects = {}, states = {};
    for (let i = 1; i <= n; i++) { objects['hue.0.Remote_' + i] = 'Remote ' + i; states['hue.0.Remote_' + i + '.battery'] = 10; }
    return [objects, states];
}

test('devices: eight issues are all listed, nothing folded away', () => {
    const ctx = loadDiagnose(...remotes(8));
    const h = ctx.buildDevices();
    assert.equal((h.match(/Batterie schwach/g) || []).length, 8);
    assert.doesNotMatch(h, /weitere/);
});

test('devices: nine issues show the seven worst and a "+ 2 weitere" row', () => {
    const ctx = loadDiagnose(...remotes(9));
    const h = ctx.buildDevices();
    assert.equal((h.match(/Batterie schwach/g) || []).length, 7);
    assert.match(h, /\+ 2 weitere/);
});
