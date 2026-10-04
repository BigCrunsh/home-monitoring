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
    const last = JSON.parse(JSON.stringify(ctx.ROOMS.slice(-2)));
    assert.deepEqual(last, [['Bungalow', LUEB], ['Lübkowsee', LUEB + '.02-00-00-c3-99-18']]);
});

test('tile: battery sits under the name, CO₂ over humidity beside the temperature', () => {
    const ctx = loadMain(station(LUEB));
    const html = ctx.buildRoom('Bungalow', LUEB);
    const head = block(html, 'kh', 'kv');
    assert.match(head, /Bungalow/);
    assert.match(head, /<svg[^>]*viewBox="0 0 17 11"/, 'battery icon belongs to the header');
    assert.match(head, />46%</);
    const values = block(html, 'kv');
    assert.match(values, /21,8/);
    assert.ok(values.indexOf('>479<') >= 0 && values.indexOf('>58<') >= 0);
    assert.ok(values.indexOf('>479<') < values.indexOf('>58<'), 'ppm line comes before the humidity line');
});

test('rooms: the grid has exactly one row per pair of rooms', () => {
    const ctx = loadMain({});
    const rows = Number(ctx.CSS_BASE.match(/\.rooms\{[^}]*grid-template-rows:repeat\((\d+),1fr\)/)[1]);
    assert.equal(rows * 2, ctx.ROOMS.length);
});

// outdoor module: no CO₂ sensor; the air pressure comes from its base station
function outdoor(over) {
    const out = LUEB + '.02-00-00-c3-99-18';
    const s = station(out, { [out + '.Temperature.Temperature']: 10.3, [out + '.Humidity.Humidity']: 75 });
    delete s[out + '.CO2.CO2'];
    s[LUEB + '.Pressure.Pressure'] = 1026.8;
    return { out, s: Object.assign(s, over || {}) };
}

test('tile: outdoor module shows humidity and its base station pressure (gauge icon, no unit) instead of CO₂', () => {
    const { out, s } = outdoor();
    const values = block(loadMain(s).buildRoom('Lübkowsee', out), 'kv');
    assert.match(values, />75</);
    assert.match(values, /<circle cx="12" cy="12" r="8.5"\/>.*>1027</, 'gauge icon precedes the pressure');
    assert.doesNotMatch(values, /ppm|mbar/);
    assert.ok(values.indexOf('>1027<') < values.indexOf('>75<'), 'pressure line comes before the humidity line');
});

test('tile: a five-character temperature (−10,2) uses the narrower size so the values still fit', () => {
    const { out, s } = outdoor({ [LUEB + '.02-00-00-c3-99-18.Temperature.Temperature']: -10.2 });
    const values = block(loadMain(s).buildRoom('Lübkowsee', out), 'kv');
    assert.match(values, /class="tv num long"[^>]*>-10,2/);
});

test('tile: a four-character temperature keeps the full size', () => {
    const values = block(loadMain(station(LUEB)).buildRoom('Bungalow', LUEB), 'kv');
    assert.match(values, /class="tv num"[^>]*>21,8/);
});

test('tile: falling pressure colours the value blue, with no arrow', () => {
    const { out, s } = outdoor({ [LUEB + '.Pressure.PressureTrend']: 'down' });
    const ctx = loadMain(s);
    const values = block(ctx.buildRoom('Lübkowsee', out), 'kv');
    assert.match(values, new RegExp('color:' + ctx.VC_PAL.cold + '">1027<'));
    assert.doesNotMatch(values, /[↑↓→]/);
});

test('tile: stable pressure stays plain white text', () => {
    const { out, s } = outdoor({ [LUEB + '.Pressure.PressureTrend']: 'stable' });
    const ctx = loadMain(s);
    const values = block(ctx.buildRoom('Lübkowsee', out), 'kv');
    assert.match(values, new RegExp('color:' + ctx.VC_PAL.text + '">1027<'));
});

test('tile: a base station without a trend state is never asked for one and reads as stable', () => {
    const { out, s } = outdoor();
    const ctx = loadMain(s);
    const missing = [];
    ctx.getState = (id) => { if (!(id in s)) missing.push(id); return id in s ? { val: s[id] } : null; };
    const values = block(ctx.buildRoom('Lübkowsee', out), 'kv');
    assert.deepEqual(JSON.parse(JSON.stringify(missing)), []);
    assert.match(values, new RegExp('color:' + ctx.VC_PAL.text + '">1027<'));
});

test('tile: outdoor module whose base station has no pressure reading shows a dash', () => {
    const { out, s } = outdoor();
    delete s[LUEB + '.Pressure.Pressure'];
    const values = block(loadMain(s).buildRoom('Lübkowsee', out), 'kv');
    assert.doesNotMatch(values, /mbar|ppm/);
    assert.match(values, />–</);
});

test('tile: a dead outdoor module greys the pressure too', () => {
    const { out, s } = outdoor({ [LUEB + '.02-00-00-c3-99-18.LastUpdate']: new Date(Date.now() - 7 * H).toString() });
    const ctx = loadMain(s);
    const values = block(ctx.buildRoom('Lübkowsee', out), 'kv');
    assert.match(values, new RegExp('color:' + ctx.VC_PAL.muted + '">1027<'));
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

test('tile: an outdoor module never reads its non-existent CO₂ state (ioBroker warns on every read)', () => {
    const out = LUEB + '.02-00-00-c3-99-18';
    const s = station(out);
    delete s[out + '.CO2.CO2'];
    const ctx = loadMain(s);
    const missing = [];
    ctx.getState = (id) => { if (!(id in s)) missing.push(id); return id in s ? { val: s[id] } : null; };
    ctx.buildRoom('Bungalow außen', out);
    assert.deepEqual(JSON.parse(JSON.stringify(missing)), []);
});
