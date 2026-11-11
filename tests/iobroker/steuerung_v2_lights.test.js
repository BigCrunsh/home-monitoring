// Light tiles read their lamps, not the Hue room (owner, 2026-11-11). A Hue room keeps its "on" flag
// (and anyOn) at the last command even after its lamps lost power at the wall switch: Esszimmer read
// "on" for two weeks with all three table lamps unreachable, so Steuerung lit three tiles and the
// Übersicht chip said "3" while only the Flur lamp was on. A tile is "on" when one of its reachable
// lamps is on, and "offline" (dimmed, dashed, slashed bulb) when none of its lamps is reachable, so
// nobody taps a light that cannot switch.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');

function loadSteuerung(states) {
    const written = {};
    const handlers = [];
    const ctx = {
        console: { log() {}, warn() {} },
        getState: (id) => (id in states ? { val: states[id] } : null), existsState: (id) => id in states,
        setState: (id, val) => { written[id] = val; },
        createState() {}, on: (opts, fn) => handlers.push({ opts, fn }), schedule() {}, setTimeout() {}, sendTo() {},
        $: () => ({ each() {} }), require: () => ({ get: () => Promise.resolve() })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'steuerung_v2.js'), 'utf8'), ctx);
    ctx.written = written;
    ctx.handlers = handlers;
    return ctx;
}
// the square light tile with this caption: its class list and its icon
function lightTile(svg, caption) {
    const m = svg.match(new RegExp('<div class="tile sq([^"]*)"[^>]*><span class="ic">(<svg(?:(?!</svg>).)*</svg>)</span><span class="cap">' + caption + '</span>'));
    assert.ok(m, 'no light tile "' + caption + '"');
    return { cls: m[1].trim().split(/\s+/).filter(Boolean), icon: m[2] };
}
const lamp = (name, on, reachable) => ({ ['hue.0.' + name + '.on']: on, ['hue.0.' + name + '.reachable']: reachable });

test('lights: a reachable lamp that is on lights its tile', () => {
    const tile = lightTile(loadSteuerung(lamp('Flurlampe', true, true)).build(), 'Flur');
    assert.deepEqual(tile.cls, ['on']);
});

test('lights: a room whose lamps are all unreachable reads offline, even though the room says on', () => {
    const ctx = loadSteuerung({
        'hue.0.Esszimmer.on': true, 'hue.0.Esszimmer.anyOn': true,
        ...lamp('Esstischlicht_hinten', false, false), ...lamp('Esstischlicht_mitte', false, false), ...lamp('Esstischlicht_vorne', false, false)
    });
    const tile = lightTile(ctx.build(), 'Esstisch');
    assert.deepEqual(tile.cls, ['offline']);
    assert.match(tile.icon, /data-l="offline"/);
});

test('lights: a lamp without any reachability reading reads offline', () => {
    assert.deepEqual(lightTile(loadSteuerung({}).build(), 'Küche').cls, ['offline']);
});

test('lights: a reachable lamp that is off reads plain off, not offline', () => {
    const tile = lightTile(loadSteuerung({ 'hue.0.Küche.on': true, ...lamp('Küchenlicht', false, true) }).build(), 'Küche');
    assert.deepEqual(tile.cls, []);
    assert.doesNotMatch(tile.icon, /data-l="offline"/);
});

test('lights: one reachable lamp of three keeps the room off rather than offline', () => {
    const ctx = loadSteuerung({
        ...lamp('Esstischlicht_hinten', false, true), ...lamp('Esstischlicht_mitte', false, false), ...lamp('Esstischlicht_vorne', false, false)
    });
    assert.deepEqual(lightTile(ctx.build(), 'Esstisch').cls, []);
});

test('lights: an unreachable lamp still flagged on does not light its tile', () => {
    assert.deepEqual(lightTile(loadSteuerung(lamp('Küchenlicht', true, false)).build(), 'Küche').cls, ['offline']);
});

// the owner's evening: three rooms flagged on, only the hallway lamp actually lit
test('lights: the Übersicht count includes only lamps that are reachable and on', () => {
    const ctx = loadSteuerung({
        'hue.0.Esszimmer.on': true, 'hue.0.Küche.on': true, 'hue.0.Flur.on': true,
        ...lamp('Esstischlicht_hinten', false, false), ...lamp('Esstischlicht_mitte', false, false), ...lamp('Esstischlicht_vorne', false, false),
        ...lamp('Küchenlicht', false, false), ...lamp('Flurlampe', true, true)
    });
    ctx.publish();
    assert.equal(ctx.written['javascript.0.lights_on'], 1);
});

test('lights: with every light off the count is 0, not missing', () => {
    const ctx = loadSteuerung({});
    ctx.publish();
    assert.equal(ctx.written['javascript.0.lights_on'], 0);
});

test('lights: a lamp going unreachable redraws the grid', () => {
    const ctx = loadSteuerung({});
    const ids = ctx.handlers.flatMap((h) => [].concat(h.opts.id));
    assert.ok(ids.includes('hue.0.Esstischlicht_mitte.reachable'), 'no subscription on lamp reachability');
    assert.ok(ids.includes('hue.0.Esstischlicht_mitte.on'), 'no subscription on lamp state');
});

test('lights: the tap still switches the whole room', () => {
    const ctx = loadSteuerung({});
    const logged = [];
    ctx.console.log = (line) => logged.push(line);
    ctx.build();
    const targets = JSON.parse(logged.find((l) => l.startsWith('STEUERUNG_LAYOUT ')).slice('STEUERUNG_LAYOUT '.length));
    assert.ok(targets.some((t) => t.kind === 'toggle' && t.oid === 'hue.0.Esszimmer.on'));
});
