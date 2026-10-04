// Room tiles in the Übersicht left column (main_v2.js). The column is pinned at 487 px by the nav
// beneath it, so a fourth row (Bungalow Lübkowsee, indoor + outdoor) only fits because each tile is
// compact: name with the operational line (age · battery) directly beneath, humidity + CO₂ beside
// the temperature. These tests run the real buildRoom against stubbed ioBroker states.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const LUEB = 'netatmo.0.6ac096020a296fac710a1287.70-ee-50-c3-9e-84';
const MIN = 60 * 1000, H = 60 * MIN;

function loadMain(states) {
    const ctx = {
        console: { log() {} },
        getState: (id) => (id in states ? { val: states[id] } : null),
        existsState: (id) => id in states,
        setState() {}, createState() {}, on() {}, schedule() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'main_v2.js'), 'utf8'), ctx);
    return ctx;
}
function station(mod, over) {
    const s = {};
    s[mod + '.Temperature.Temperature'] = 21.8;
    s[mod + '.Humidity.Humidity'] = 58;
    s[mod + '.CO2.CO2'] = 479;
    s[mod + '.BatteryStatus'] = 46;
    s[mod + '.LastUpdate'] = new Date(Date.now() - 2 * MIN).toString();
    return Object.assign(s, over || {});
}
// markup between `<div class="cls"` and the next sibling block marker
function block(html, cls, nextCls) {
    const i = html.indexOf('class="' + cls + '"');
    assert.ok(i >= 0, 'block not found: ' + cls);
    const j = nextCls ? html.indexOf('class="' + nextCls + '"', i) : html.length;
    return html.slice(i, j < 0 ? html.length : j);
}

test('rooms: Bungalow Lübkowsee indoor + outdoor fill the new last row', () => {
    const ctx = loadMain({});
    const last = JSON.parse(JSON.stringify(ctx.ROOMS.slice(-2).map((r) => r[1])));
    assert.deepEqual(last, [LUEB, LUEB + '.02-00-00-c3-99-18']);
});

test('tile: battery sits under the name, humidity + CO₂ beside the temperature', () => {
    const ctx = loadMain(station(LUEB));
    const html = ctx.buildRoom('Bungalow', LUEB);
    const head = block(html, 'kh', 'kv');
    assert.match(head, /Bungalow/);
    assert.match(head, /<svg[^>]*viewBox="0 0 17 11"/, 'battery icon belongs to the header');
    assert.match(head, />46%</);
    const values = block(html, 'kv');
    assert.match(values, /21,8/);
    assert.match(values, />58</);
    assert.match(values, />479</);
});

test('rooms: the grid has exactly one row per pair of rooms', () => {
    const ctx = loadMain({});
    const rows = Number(ctx.CSS_BASE.match(/\.rooms\{[^}]*grid-template-rows:repeat\((\d+),1fr\)/)[1]);
    assert.equal(rows * 2, ctx.ROOMS.length);
});

test('tile: outdoor module without CO₂ shows humidity and a dash for ppm', () => {
    const out = LUEB + '.02-00-00-c3-99-18';
    const s = station(out, { [out + '.Temperature.Temperature']: 10.3, [out + '.Humidity.Humidity']: 75 });
    delete s[out + '.CO2.CO2'];
    const html = loadMain(s).buildRoom('Bungalow außen', out);
    const values = block(html, 'kv');
    assert.match(values, />75</);
    assert.doesNotMatch(values, /ppm/);
    assert.match(values, />–</);
});

test('tile: mains-powered base station shows no battery', () => {
    const s = station(LUEB);
    delete s[LUEB + '.BatteryStatus'];
    const head = block(loadMain(s).buildRoom('Bungalow', LUEB), 'kh', 'kv');
    assert.doesNotMatch(head, /viewBox="0 0 17 11"/);
    assert.doesNotMatch(head, /%/);
});

test('tile: a nearly empty battery turns its icon and % red', () => {
    const ctx = loadMain(station(LUEB, { [LUEB + '.BatteryStatus']: 12 }));
    const head = block(ctx.buildRoom('Bungalow', LUEB), 'kh', 'kv');
    assert.match(head, new RegExp('stroke="' + ctx.VC_PAL.alarm + '"'));
    assert.match(head, new RegExp('color:' + ctx.VC_PAL.alarm + '">12%'));
});

test('tile: a station silent for >6 h greys temperature, humidity and CO₂', () => {
    const s = station(LUEB, { [LUEB + '.LastUpdate']: new Date(Date.now() - 7 * H).toString() });
    const ctx = loadMain(s);
    const values = block(ctx.buildRoom('Bungalow', LUEB), 'kv');
    const colours = values.match(/color:#[0-9A-Fa-f]{6}/g);
    assert.ok(colours.length >= 3);
    colours.forEach((c) => assert.equal(c, 'color:' + ctx.VC_PAL.muted));
});

test('tile: a missing temperature reading renders a dash, not 0', () => {
    const s = station(LUEB);
    delete s[LUEB + '.Temperature.Temperature'];
    const values = block(loadMain(s).buildRoom('Bungalow', LUEB), 'kv');
    assert.match(values, /–<span class="u">°C/);
});
