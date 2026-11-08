// The Übersicht's "Rollläden" tile (owner, 2026-11-08: it replaces the TV scene tile). One tap moves
// all five shutters: down when they are mostly open, up when mostly closed. steuerung_v2.js owns the
// shutter list, so it publishes the next move (roll_next: "runter"/"hoch") for the tile and handles
// the tile's toggle (roll_toggle_cmd) — one tap, no confirm (owner choice; a stray tap is undone by
// a second).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const SERIALS = ['001118A997B92D', '001118A997B950', '00111A498CE3E2', '00111A498CE451', '00111A498CE463'];
const levelId = (s) => 'hm-rpc.1.' + s + '.4.LEVEL';

function loadSteuerung(levels) {
    const st = {};
    SERIALS.forEach((s, i) => { if (levels[i] != null) st[levelId(s)] = levels[i]; });
    const written = {};
    const handlers = [];
    const ctx = {
        console: { log() {}, warn() {} },
        getState: (id) => (id in st ? { val: st[id] } : null), existsState: (id) => id in st,
        setState: (id, val) => { written[id] = val; st[id] = val; },
        createState() {}, on: (opts, fn) => handlers.push({ opts, fn }), schedule() {}, setTimeout() {}, sendTo() {},
        $: () => ({ each() {} }), require: () => ({ get: () => Promise.resolve() })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'steuerung_v2.js'), 'utf8'), ctx);
    ctx.written = written;
    ctx.tap = () => handlers.find((h) => h.opts.id === 'javascript.0.roll_toggle_cmd').fn({ state: { val: true } });
    ctx.handlers = handlers;
    return ctx;
}

test('rollo: mostly open shutters make the next move "runter"', () => {
    assert.equal(loadSteuerung([100, 100, 100, 0, 100]).rollNext(), 'runter');
});

test('rollo: mostly closed shutters make the next move "hoch"', () => {
    assert.equal(loadSteuerung([0, 0, 20, 100, 0]).rollNext(), 'hoch');
});

test('rollo: without any position reading there is no next move', () => {
    assert.equal(loadSteuerung([]).rollNext(), null);
});

test('rollo: one tap on mostly open shutters moves all five down', () => {
    const ctx = loadSteuerung([100, 100, 80, 100, 100]);
    ctx.tap();
    SERIALS.forEach((s) => assert.equal(ctx.written[levelId(s)], 0));
});

test('rollo: one tap on mostly closed shutters moves all five up', () => {
    const ctx = loadSteuerung([0, 0, 0, 30, 0]);
    ctx.tap();
    SERIALS.forEach((s) => assert.equal(ctx.written[levelId(s)], 100));
});

test('rollo: a tap without any position reading moves nothing', () => {
    const ctx = loadSteuerung([]);
    ctx.tap();
    SERIALS.forEach((s) => assert.equal(ctx.written[levelId(s)], undefined));
});

// the Übersicht status bar's lights chip ("3 Lichter an") counts the lights of the Lichter section
test('lights: the number of lit lights is published with every redraw', () => {
    const ctx = loadSteuerung([]);
    ctx.getState = (id) => ({ 'hue.0.Esszimmer.on': { val: true }, 'hue.0.Flur.on': { val: true }, 'hue.0.Keller.on': { val: false } })[id] || null;
    ctx.publish();
    assert.equal(ctx.written['javascript.0.lights_on'], 2);
});

test('lights: with every light off the count is 0, not missing', () => {
    const ctx = loadSteuerung([]);
    ctx.publish();
    assert.equal(ctx.written['javascript.0.lights_on'], 0);
});

// the status bar's plug chip counts the switched-on consumer plugs; the Maxxisun relay is always on
// (it carries the battery), so counting it would make the chip read "1" forever
test('plugs: the number of switched-on consumer plugs is published', () => {
    const ctx = loadSteuerung([]);
    ctx.getState = (id) => ({
        'hm-rpc.1.0001DD89A46CAD.3.STATE': { val: true }, 'hm-rpc.1.0001DD89A46CE1.3.STATE': { val: true },
        'hm-rpc.1.0001DD89AADDE7.3.STATE': { val: false }
    })[id] || null;
    ctx.publish();
    assert.equal(ctx.written['javascript.0.plugs_on'], 2);
});

test('plugs: the always-on Maxxisun relay is not counted', () => {
    const ctx = loadSteuerung([]);
    ctx.getState = (id) => (id === 'javascript.0.maxxisun_relay' ? { val: true } : null);
    ctx.publish();
    assert.equal(ctx.written['javascript.0.plugs_on'], 0);
});

test('rollo: the next move is published for the tile when a shutter position changes', () => {
    const ctx = loadSteuerung([100, 100, 100, 100, 100]);
    const watcher = ctx.handlers.find((h) => Array.isArray(h.opts.id) && h.opts.id.includes(levelId(SERIALS[0])));
    assert.ok(watcher, 'no subscription on the shutter levels');
    watcher.fn({});
    assert.equal(ctx.written['javascript.0.roll_next'], 'runter');
});
