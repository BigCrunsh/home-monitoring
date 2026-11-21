// Music light, stage 1 (openspec add-music-ambient-light, task 1.3): while the switch is on and the
// ground floor plays music (javascript.0.music_ground_floor, from musik_v2.js), the ambient lamps
// (kitchen and both TV wall washers in colour, the dining-table whites) go to a warm dimmed scene; the
// moment the music stops or the switch goes off, every lamp returns exactly to its state before the
// music, lamps that were off go off. A lamp without power is skipped. The snapshot is persisted, so a
// script restart during a song still restores afterwards.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const ENABLED = 'javascript.0.music_light_enabled', MUSIC = 'javascript.0.music_ground_floor';
const SNAPSHOT = 'javascript.0.music_light_snapshot';
const KITCHEN = 'hue.0.Küchenlicht', WASHER = 'hue.0.Hue_Play_wall_washer_1', WASHER2 = 'hue.0.Hue_Play_wall_washer_2';
const TABLE = 'hue.0.Esstischlicht_mitte';

function lamp(id, s) {
    const st = { [id + '.reachable']: s.reachable !== false, [id + '.on']: !!s.on, [id + '.bri']: s.bri || 0 };
    if (s.ct !== undefined) st[id + '.ct'] = s.ct;
    if (s.xy !== undefined) st[id + '.xy'] = s.xy;
    if (s.colormode !== undefined) st[id + '.colormode'] = s.colormode;
    return st;
}
const playing = JSON.stringify({ playing: true, artist: 'A', title: 'T' });
const silent = JSON.stringify({ playing: false });

// states: {id: val}. ctx.change(id, val) delivers a state change to the script's subscriptions.
function load(states) {
    const st = Object.assign({}, states);
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
        on: (opts, fn) => handlers.push({ opts, fn })
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
const living = () => Object.assign({},
    lamp(KITCHEN, { on: true, bri: 254, ct: 4000, colormode: 'ct' }),
    lamp(WASHER, { on: true, bri: 120, xy: '0.3,0.4', colormode: 'xy' }),
    lamp(WASHER2, { on: false }),
    lamp(TABLE, { on: false }));
const byLamp = (cmds) => Object.fromEntries(cmds.map(([id, c]) => [id, c]));

test('music light: music starting sets the warm scene on every reachable lamp', () => {
    const ctx = load(Object.assign(living(), { [MUSIC]: silent }));
    ctx.change(MUSIC, playing);
    const c = byLamp(ctx.commands);
    assert.deepEqual(Object.keys(c).sort(), [TABLE, KITCHEN, WASHER, WASHER2].sort());
    assert.ok(c[KITCHEN].bri > 0 && c[KITCHEN].bri < 254);
    assert.equal(typeof c[KITCHEN].ct, 'number');
    assert.ok(c[TABLE].bri > 0);
    assert.equal(c[TABLE].ct, undefined);
});

test('music light: a lamp without power gets no command', () => {
    const ctx = load(Object.assign(living(), lamp(TABLE, { reachable: false }), { [MUSIC]: silent }));
    ctx.change(MUSIC, playing);
    assert.equal(byLamp(ctx.commands)[TABLE], undefined);
});

test('music light: switched off, music changes nothing', () => {
    const ctx = load(Object.assign(living(), { [MUSIC]: silent, [ENABLED]: false }));
    ctx.change(MUSIC, playing);
    assert.deepEqual(ctx.commands, []);
});

test('music light: without a stored switch setting it counts as on', () => {
    const ctx = load(Object.assign(living(), { [MUSIC]: silent }));
    ctx.change(MUSIC, playing);
    assert.ok(ctx.commands.length > 0);
});

test('music light: music stopping restores every lamp exactly, lamps that were off go off', () => {
    const ctx = load(Object.assign(living(), { [MUSIC]: silent }));
    ctx.change(MUSIC, playing);
    ctx.commands.length = 0;
    ctx.change(MUSIC, silent);
    const c = byLamp(ctx.commands);
    assert.equal(c[KITCHEN].bri, 254);
    assert.equal(c[KITCHEN].ct, 4000);
    assert.equal(c[WASHER].bri, 120);
    assert.equal(c[WASHER].xy, '0.3,0.4');
    assert.equal(c[WASHER2].on, false);
    assert.equal(c[TABLE].on, false);
});

test('music light: switching it off during music restores the lamps', () => {
    const ctx = load(Object.assign(living(), { [MUSIC]: silent }));
    ctx.change(MUSIC, playing);
    ctx.commands.length = 0;
    ctx.change(ENABLED, false);
    assert.equal(byLamp(ctx.commands)[KITCHEN].ct, 4000);
});

test('music light: a new track while the scene runs keeps the snapshot from before the music', () => {
    const ctx = load(Object.assign(living(), { [MUSIC]: silent }));
    ctx.change(MUSIC, playing);
    ctx.change(KITCHEN + '.bri', 90);
    ctx.change(MUSIC, JSON.stringify({ playing: true, artist: 'B', title: 'U' }));
    ctx.commands.length = 0;
    ctx.change(MUSIC, silent);
    assert.equal(byLamp(ctx.commands)[KITCHEN].bri, 254);
});

test('music light: after a restart during music the stop still restores the state from before', () => {
    const first = load(Object.assign(living(), { [MUSIC]: silent }));
    first.change(MUSIC, playing);
    const restarted = load(Object.assign({}, first.st, lamp(KITCHEN, { on: true, bri: 90, ct: 2200, colormode: 'ct' })));
    assert.deepEqual(restarted.commands, []);
    restarted.change(MUSIC, silent);
    assert.equal(byLamp(restarted.commands)[KITCHEN].bri, 254);
});

test('music light: a stop without an active scene sends nothing', () => {
    const ctx = load(Object.assign(living(), { [MUSIC]: playing, [ENABLED]: false }));
    ctx.change(MUSIC, silent);
    assert.deepEqual(ctx.commands, []);
});

test('music light: an unreadable music state counts as no music', () => {
    const ctx = load(Object.assign(living(), { [MUSIC]: silent }));
    ctx.change(MUSIC, '{broken');
    assert.deepEqual(ctx.commands, []);
});

test('music light: after a restore the snapshot is cleared', () => {
    const ctx = load(Object.assign(living(), { [MUSIC]: silent }));
    ctx.change(MUSIC, playing);
    ctx.change(MUSIC, silent);
    assert.equal(ctx.st[SNAPSHOT], '');
});
