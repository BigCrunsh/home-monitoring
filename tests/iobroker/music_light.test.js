// Music light (openspec add-music-ambient-light, stages 1 and 1b). Zones (javascript.0.music_light_zones,
// configured privately on the Pi; the repo default is the ground floor: kitchen and both TV wall washers)
// each have colour lamps only (owner, 2026-11-21). While a zone plays music (javascript.0.music_zones, from
// musik_v2.js) and its switch is on (key not in javascript.0.music_light_off), its reachable lamps go to
// a warm dimmed scene; the moment that zone's music stops or its switch goes off, its lamps return exactly
// to their state before the music, lamps that were off go off. Zones are independent, each with its own
// persisted snapshot, so a script restart during a song still restores afterwards.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const ZONES_CFG = 'javascript.0.music_light_zones', MUSIC = 'javascript.0.music_zones';
const OFF = 'javascript.0.music_light_off', SNAPSHOT = 'javascript.0.music_light_snapshot';
const KITCHEN = 'hue.0.Küchenlicht', WASHER = 'hue.0.TV-Licht_links', WASHER2 = 'hue.0.TV-Licht_rechts';
const ROOM_LAMP = 'hue.0.Room_Lamp';
const CONFIG = JSON.stringify([
    { key: 'eg', label: 'EG', rooms: ['Wohnzimmer'], lamps: [KITCHEN, WASHER, WASHER2] },
    { key: 'k1', label: 'Kind 1', rooms: ['Studio'], lamps: [ROOM_LAMP] }
]);

function lamp(id, s) {
    const st = { [id + '.reachable']: s.reachable !== false, [id + '.on']: !!s.on, [id + '.bri']: s.bri || 0 };
    if (s.ct !== undefined) st[id + '.ct'] = s.ct;
    if (s.xy !== undefined) st[id + '.xy'] = s.xy;
    if (s.colormode !== undefined) st[id + '.colormode'] = s.colormode;
    return st;
}
const music = (playing) => JSON.stringify(Object.fromEntries(['eg', 'k1'].map((k) => [k, { playing: playing.includes(k), artist: 'A' }])));

// states: {id: val}. ctx.change(id, val) delivers a state change to the script's subscriptions.
function load(states) {
    const st = Object.assign({ [ZONES_CFG]: CONFIG, [MUSIC]: music([]) }, states);
    const handlers = [], commands = [];
    const ctx = {
        console: { log() {} },
        getState: (id) => (id in st ? { val: st[id] } : null),
        existsState: (id) => id in st,
        setState: (id, val) => {
            if (/\.command$/.test(id)) commands.push([id.replace(/\.command$/, ''), JSON.parse(val)]);
            st[id] = val;
        },
        createState: (id, def) => { if (!(id in st)) st[id] = def; },
        on: (opts, fn) => handlers.push({ opts, fn }), setInterval() {},
        // genre, tempo and cover lookups: every service unavailable, so the warm scene's fallback applies
        Buffer, encodeURIComponent,
        require: () => ({ get: (url, o, cb) => { cb({ statusCode: 503, on() { return this; }, resume() {} }); return { on() { return this; }, destroy() {} }; } })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'music_light.js'), 'utf8'), ctx);
    ctx.change = (id, val) => {
        st[id] = val;
        handlers.filter((h) => h.opts.id === id).forEach((h) => h.fn({ id, state: { val } }));
    };
    ctx.commands = commands;
    ctx.st = st;
    return ctx;
}
const house = () => Object.assign({},
    lamp(KITCHEN, { on: true, bri: 254, ct: 4000, colormode: 'ct' }),
    lamp(WASHER, { on: true, bri: 120, xy: '0.3,0.4', colormode: 'xy' }),
    lamp(WASHER2, { on: false }),
    lamp(ROOM_LAMP, { on: true, bri: 200, ct: 3000, colormode: 'ct' }));
const byLamp = (cmds) => Object.fromEntries(cmds.map(([id, c]) => [id, c]));

test('music light: music starting in a zone sets the warm scene on its reachable lamps only', () => {
    const ctx = load(house());
    ctx.change(MUSIC, music(['eg']));
    const c = byLamp(ctx.commands);
    assert.deepEqual(Object.keys(c).sort(), [KITCHEN, WASHER, WASHER2].sort());
    assert.ok(c[KITCHEN].bri > 0 && c[KITCHEN].bri < 254);
    assert.equal(typeof c[KITCHEN].ct, 'number');
});

test('music light: music in one zone leaves the other zone\'s lamps alone', () => {
    const ctx = load(house());
    ctx.change(MUSIC, music(['k1']));
    assert.deepEqual(Object.keys(byLamp(ctx.commands)), [ROOM_LAMP]);
});

test('music light: a lamp without power gets no command', () => {
    const ctx = load(Object.assign(house(), lamp(WASHER2, { reachable: false })));
    ctx.change(MUSIC, music(['eg']));
    assert.equal(byLamp(ctx.commands)[WASHER2], undefined);
});

test('music light: a zone switched off ignores its music', () => {
    const ctx = load(Object.assign(house(), { [OFF]: JSON.stringify(['eg']) }));
    ctx.change(MUSIC, music(['eg', 'k1']));
    assert.deepEqual(Object.keys(byLamp(ctx.commands)), [ROOM_LAMP]);
});

test('music light: music stopping restores the zone exactly, lamps that were off go off', () => {
    const ctx = load(house());
    ctx.change(MUSIC, music(['eg']));
    ctx.commands.length = 0;
    ctx.change(MUSIC, music([]));
    const c = byLamp(ctx.commands);
    assert.equal(c[KITCHEN].bri, 254);
    assert.equal(c[KITCHEN].ct, 4000);
    assert.equal(c[WASHER].bri, 120);
    assert.equal(c[WASHER].xy, '0.3,0.4');
    assert.equal(c[WASHER2].on, false);
});

test('music light: one zone stopping restores only that zone', () => {
    const ctx = load(house());
    ctx.change(MUSIC, music(['eg', 'k1']));
    ctx.commands.length = 0;
    ctx.change(MUSIC, music(['eg']));
    assert.deepEqual(Object.keys(byLamp(ctx.commands)), [ROOM_LAMP]);
});

test('music light: switching a zone off during music restores its lamps', () => {
    const ctx = load(house());
    ctx.change(MUSIC, music(['eg']));
    ctx.commands.length = 0;
    ctx.change(OFF, JSON.stringify(['eg']));
    assert.equal(byLamp(ctx.commands)[KITCHEN].ct, 4000);
});

test('music light: a new track while the scene runs keeps the snapshot from before the music', () => {
    const ctx = load(house());
    ctx.change(MUSIC, music(['eg']));
    ctx.change(KITCHEN + '.bri', 90);
    ctx.change(MUSIC, JSON.stringify({ eg: { playing: true, artist: 'B' }, k1: { playing: false } }));
    ctx.commands.length = 0;
    ctx.change(MUSIC, music([]));
    assert.equal(byLamp(ctx.commands)[KITCHEN].bri, 254);
});

test('music light: after a restart during music the stop still restores the state from before', () => {
    const first = load(house());
    first.change(MUSIC, music(['eg']));
    const restarted = load(Object.assign({}, first.st, lamp(KITCHEN, { on: true, bri: 90, ct: 2200, colormode: 'ct' })));
    assert.deepEqual(restarted.commands, []);
    restarted.change(MUSIC, music([]));
    assert.equal(byLamp(restarted.commands)[KITCHEN].bri, 254);
});

test('music light: an unreadable music state counts as no music', () => {
    const ctx = load(house());
    ctx.change(MUSIC, '{broken');
    assert.deepEqual(ctx.commands, []);
});

test('music light: without a private config the ground floor default is used, with colour lamps only', () => {
    const st = {};
    const ctx = { console: { log() {} }, getState: (id) => (id in st ? { val: st[id] } : null), existsState: (id) => id in st,
        setState: (id, v) => { st[id] = v; }, createState: (id, def) => { st[id] = def; }, on() {}, setInterval() {} };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'music_light.js'), 'utf8'), ctx);
    const zones = JSON.parse(st[ZONES_CFG]);
    assert.deepEqual(zones.map((z) => z.key), ['eg']);
    assert.deepEqual(zones[0].lamps.sort(), [KITCHEN, WASHER, WASHER2].sort());
});

test('music light: the first start reads no state that does not exist yet', () => {
    const read = [];
    const st = {};
    const ctx = {
        console: { log() {} },
        getState: (id) => { read.push(id); return id in st ? { val: st[id] } : null; },
        existsState: (id) => id in st,
        setState: (id, val) => { st[id] = val; },
        createState() {}, on() {}, setInterval() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'music_light.js'), 'utf8'), ctx);
    assert.deepEqual(read, []);
});

test('music light: after a restore the zone snapshot is removed', () => {
    const ctx = load(house());
    ctx.change(MUSIC, music(['eg']));
    ctx.change(MUSIC, music([]));
    assert.deepEqual(JSON.parse(ctx.st[SNAPSHOT]), {});
});

// the hue adapter names its states after the lamp, so a lamp renamed in Hue needs its new name here
test('zones: the ground floor default names both TV light bars by their current Hue names', () => {
    assert.deepEqual(Array.from(load({}).DEFAULT_ZONES[0].lamps), [KITCHEN, WASHER, WASHER2]);
});
