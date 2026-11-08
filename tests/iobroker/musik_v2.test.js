// Musik band (musik_v2.js), tasks 11.2-11.4 of the dashboard redesign:
// - a speaker missing from the Sonos /zones answer is offline: its card is dimmed and says so,
//   instead of a bare "–" that looked like an idle room.
// - the TV soundbar has no standalone play control; its empty play slot is drawn as disabled and
//   the idle line says why.
// - the active group preset is marked like an "on" tile; the others stay muted (all three icons
//   used to be permanently coloured, saying nothing about the current grouping).
// - a playing room says "spielt"; the volume number gets a magnitude bar.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const ROOMS = ['Fernsehzimmer', 'Küche', 'Wohnzimmer', 'Sauna', 'Bad', 'Claras Zimmer', 'Carlottas Zimmer', 'Studio'];

function loadMusik(zones) {
    const ctx = {
        console: { log() {} },
        getState: () => null, existsState: () => false,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}, setInterval() {},
        require: () => ({ get: () => ({ on() { return this; } }) })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'musik_v2.js'), 'utf8'), ctx);
    ctx.ZONES = zones;
    return ctx;
}
// every room on its own (Einzeln) unless a coordinator map says otherwise
function zones(coords, over) {
    const z = {};
    ROOMS.forEach((r) => { z[r] = { vol: 20, play: false, coord: (coords && coords[r]) || r }; });
    return Object.assign(z, over || {});
}
const card = (ctx, room) => ctx.roomCard(room, 0, 0, 278, 122).html;
const presetHtml = (ctx, name) => {
    // one button: no other button may start inside the match
    const m = ctx.build().match(new RegExp('<div class="gbtn([^"]*)"[^>]*><span>(<svg(?:(?!gbtn).)*?</svg>)</span>' + name + '</div>'));
    return { cls: m[1], icon: m[2] };
};

test('musik: a speaker missing from the Sonos answer is dimmed and labelled offline', () => {
    const z = zones();
    delete z.Sauna;
    const html = card(loadMusik(z), 'Sauna');
    assert.match(html, /class="room off"/);
    assert.match(html, /<span class="stt">offline<\/span>/);
});

test('musik: a room that answers is never shown as offline', () => {
    const html = card(loadMusik(zones()), 'Sauna');
    assert.doesNotMatch(html, /room off|offline/);
});

test('musik: the TV soundbar shows a disabled play slot and says why', () => {
    const html = card(loadMusik(zones()), 'Fernsehzimmer');
    assert.match(html, /class="pp ghost"/);
    assert.match(html, /TV · nur Lautstärke/);
});

test('musik: a playing room says "spielt" in its header', () => {
    const z = zones(null, { Bad: { vol: 30, play: true, title: 'Song', artist: 'Band', coord: 'Bad' } });
    assert.match(card(loadMusik(z), 'Bad'), /<span class="stt on">spielt<\/span>/);
});

test('musik: the volume number carries a bar as long as the volume', () => {
    const z = zones(null, { Bad: { vol: 30, play: false, coord: 'Bad' } });
    assert.match(card(loadMusik(z), 'Bad'), /<span class="vbar"><span style="width:30%"><\/span><\/span>/);
});

test('musik: without a volume reading there is no bar, only the dash', () => {
    const z = zones(null, { Bad: { play: false, coord: 'Bad' } });
    const html = card(loadMusik(z), 'Bad');
    assert.doesNotMatch(html, /class="vbar"/);
    assert.match(html, />–</);
});

test('musik: with every room on its own, "Einzeln" is the active preset', () => {
    const ctx = loadMusik(zones());
    assert.match(presetHtml(ctx, 'Einzeln').cls, /\bon\b/);
    assert.doesNotMatch(presetHtml(ctx, 'Alle').cls, /\bon\b/);
});

test('musik: with every room joined to the Wohnzimmer, "Alle" is active', () => {
    const coords = {};
    ROOMS.forEach((r) => { coords[r] = 'Wohnzimmer'; });
    const ctx = loadMusik(zones(coords));
    assert.match(presetHtml(ctx, 'Alle').cls, /\bon\b/);
    assert.doesNotMatch(presetHtml(ctx, 'Einzeln').cls, /\bon\b/);
});

test('musik: Küche and Fernsehzimmer joined to the Wohnzimmer is "Wohnen"', () => {
    const ctx = loadMusik(zones({ 'Küche': 'Wohnzimmer', Fernsehzimmer: 'Wohnzimmer' }));
    assert.match(presetHtml(ctx, 'Wohnen').cls, /\bon\b/);
});

test('musik: a grouping that matches no preset marks none of them', () => {
    const ctx = loadMusik(zones({ Bad: 'Sauna' }));
    ['Alle', 'Wohnen', 'Einzeln'].forEach((p) => assert.doesNotMatch(presetHtml(ctx, p).cls, /\bon\b/));
});

// the Übersicht status bar shows a "Musik" chip while a room plays
test('musik: the number of playing rooms is published with every redraw', () => {
    const z = zones(null, {
        Bad: { vol: 30, play: true, coord: 'Bad' },
        Studio: { vol: 20, play: true, coord: 'Studio' }
    });
    const ctx = loadMusik(z);
    const written = {};
    ctx.setState = (id, val) => { written[id] = val; };
    ctx.publish();
    assert.equal(written['javascript.0.music_playing'], 2);
});

test('musik: nothing playing publishes 0', () => {
    const ctx = loadMusik(zones());
    const written = {};
    ctx.setState = (id, val) => { written[id] = val; };
    ctx.publish();
    assert.equal(written['javascript.0.music_playing'], 0);
});

test('musik: inactive presets have muted icons, the active one is green', () => {
    const ctx = loadMusik(zones());
    assert.match(presetHtml(ctx, 'Alle').icon, new RegExp(ctx.LBL));
    assert.match(presetHtml(ctx, 'Einzeln').icon, new RegExp(ctx.GREEN));
});
