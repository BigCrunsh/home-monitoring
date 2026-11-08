// Steuerung tile wording (steuerung_v2.js), tasks 9.2-9.4 of the dashboard redesign:
// - a shutter at "100 %" did not say whether it was open or closed; HomeMatic LEVEL 100 = open.
// - the Maxxisun plug meters both directions, so its tile says "speist"/"lädt" instead of a
//   bare signed number: the direction goes into the name line, which has room, the status
//   line keeps the plain watts ("speist 812 W" did not fit the square tile).
// - a partial shutter position stays a plain "40 %": "40 % offen" pushed long room names
//   ("Wohnzimmer") into an ellipsis.
// - every garden tile repeated "10 min" (what a tap does); that hint moves to the section header
//   once, and the tiles show their state, with the remaining time while watering. The Stop tile
//   is only alarming while something actually waters.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');

function loadSteuerung(states) {
    const st = states || {};
    const ctx = {
        console: { log() {}, warn() {} },
        getState: (id) => (id in st ? { val: st[id] } : null), existsState: (id) => id in st,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}, sendTo() {},
        $: () => ({ each() {} }), require: () => ({ get: () => Promise.resolve() })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'steuerung_v2.js'), 'utf8'), ctx);
    return ctx;
}
const status = (html) => (html.match(/<span class="st">([^<]*)<\/span>/) || [])[1];
const SHUTTER = ['Küche', '0001DD89A00001'];
const level = (v) => ({ ['hm-rpc.1.0001DD89A00001.4.LEVEL']: v });

test('shutter: fully up reads "offen", fully down reads "zu"', () => {
    assert.equal(status(loadSteuerung(level(100)).shutterTile(SHUTTER, 0, 0, 100, 80).html), 'offen');
    assert.equal(status(loadSteuerung(level(0)).shutterTile(SHUTTER, 0, 0, 100, 80).html), 'zu');
});

test('shutter: a partial position stays a short percentage, so long room names fit', () => {
    assert.equal(status(loadSteuerung(level(40)).shutterTile(SHUTTER, 0, 0, 100, 80).html), '40 %');
});

test('shutter: without a position reading the value stays a dash', () => {
    assert.equal(status(loadSteuerung({}).shutterTile(SHUTTER, 0, 0, 100, 80).html), '–');
});

test('shutter: the "Alle" tile has no value of its own, the middle button reads "50 %"', () => {
    const html = loadSteuerung({}).shutterTile(['Alle', 'scene.0.Alle_Rollläden'], 0, 0, 100, 80).html;
    assert.equal(status(html), '');
    assert.match(html, />50 %</);
});

const MAXXI = ['Maxxi Akku', 'javascript.0.maxxisun_relay', 'javascript.0.power_maxxisun', () => ''];
const maxxi = (on, watts) => ({ 'javascript.0.maxxisun_relay': on, 'javascript.0.power_maxxisun': watts });

const cap = (html) => (html.match(/<span class="cap">([^<]*)<\/span>/) || [])[1];

test('maxxisun plug: feeding the house reads "Maxxi speist" with the watts below', () => {
    const html = loadSteuerung(maxxi(true, -812)).plugTile(MAXXI, 0, 0, 70, 70).html;
    assert.equal(cap(html), 'Maxxi speist');
    assert.equal(status(html), '812 W');
});

test('maxxisun plug: charging reads "Maxxi lädt" with the watts below', () => {
    const html = loadSteuerung(maxxi(true, 35)).plugTile(MAXXI, 0, 0, 70, 70).html;
    assert.equal(cap(html), 'Maxxi lädt');
    assert.equal(status(html), '35 W');
});

test('maxxisun plug: standby power keeps the plain name and reads "bereit", switched off "aus"', () => {
    const idle = loadSteuerung(maxxi(true, 4.8)).plugTile(MAXXI, 0, 0, 70, 70).html;
    assert.equal(cap(idle), 'Maxxi Akku');
    assert.equal(status(idle), 'bereit');
    const off = loadSteuerung(maxxi(false, -300)).plugTile(MAXXI, 0, 0, 70, 70).html;
    assert.equal(cap(off), 'Maxxi Akku');
    assert.equal(status(off), 'aus');
});

test('other plugs keep their plain live watts', () => {
    const plug = ['Drucker', 'hm-rpc.1.X.3.STATE', 'hm-rpc.1.X.6.POWER', () => ''];
    const ctx = loadSteuerung({ 'hm-rpc.1.X.3.STATE': true, 'hm-rpc.1.X.6.POWER': 12.4 });
    assert.equal(status(ctx.plugTile(plug, 0, 0, 70, 70).html), '12 W');
});

function valve(ctx, activity, leftover) {
    const base = ctx.GVALVE + '-3A1';
    return loadSteuerung({
        [base + '.activity_value']: activity,
        [base + '.duration_leftover_i']: leftover,
        [base + '.name_value']: 'Randbeet'
    });
}

test('garden: an idle valve reads "aus", the tap hint is no longer on every tile', () => {
    const probe = loadSteuerung({});
    const ctx = valve(probe, 'CLOSED', null);
    assert.equal(status(ctx.gardenaTile(['Ventil', '-3A1'], 0, 0, 60, 60).html), 'aus');
});

test('garden: a watering valve counts down its remaining minutes', () => {
    const probe = loadSteuerung({});
    const ctx = valve(probe, 'MANUAL_WATERING', 380);
    assert.equal(status(ctx.gardenaTile(['Ventil', '-3A1'], 0, 0, 60, 60).html), 'läuft · 7 min');
});

test('garden: watering without a remaining time still reads "läuft"', () => {
    const probe = loadSteuerung({});
    const ctx = valve(probe, 'SCHEDULED_WATERING', null);
    assert.equal(status(ctx.gardenaTile(['Ventil', '-3A1'], 0, 0, 60, 60).html), 'läuft');
});

test('garden: the section header carries the tap hint once', () => {
    const ctx = loadSteuerung({});
    assert.match(ctx.build(), /Garten · Bewässerung · tippen = 10 min/);
});

test('garden: the Stop tile is dimmed while nothing waters, alarming while a valve runs', () => {
    const probe = loadSteuerung({});
    const idle = valve(probe, 'CLOSED', null).gardenaTile(['Stop', 'STOP'], 0, 0, 60, 60).html;
    const running = valve(probe, 'MANUAL_WATERING', 380).gardenaTile(['Stop', 'STOP'], 0, 0, 60, 60).html;
    assert.doesNotMatch(idle, /class="tile gt stop"/);
    assert.match(running, /class="tile gt stop"/);
});
