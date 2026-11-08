// Domain chips in the Übersicht status bar (main_v2.js buildRibbon), task 6.4 (owner yes,
// 2026-11-08): lights on (amber bulb + count, amber = the "on" colour of the Steuerung tiles) and
// music playing (green note). The bar is 766 px for six fixed chips; full-width text chips cut
// "Schuppen"/"Türschloss" to an ellipsis, so these are compact icon chips, as wide as their
// content, shown only while something is on. Counts come from steuerung_v2 (lights_on) and
// musik_v2 (music_playing).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');

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
const iconChips = (html) => [...html.matchAll(/<div class="rind dom" data-d="([a-z]+)">(<svg.*?<\/svg>)<span class="nm">([^<]*)<\/span><\/div>/g)]
    .map((m) => ({ kind: m[1], svg: m[2], text: m[3] }));
// the light and music chips only (the padlock is always there)
const domChips = (html) => iconChips(html).filter((c) => c.kind !== 'schloss');

test('ribbon: three lights on show an amber bulb with "3"', () => {
    const [c] = domChips(loadMain({ 'javascript.0.lights_on': 3 }).buildRibbon());
    assert.equal(c.kind, 'licht');
    assert.equal(c.text, '3');
    assert.match(c.svg, /var\(--amber\)/);
});

test('ribbon: with every light off there is no lights chip', () => {
    assert.deepEqual(domChips(loadMain({ 'javascript.0.lights_on': 0 }).buildRibbon()), []);
});

test('ribbon: without a light count there is no lights chip', () => {
    assert.deepEqual(domChips(loadMain({}).buildRibbon()), []);
});

test('ribbon: a playing room adds a green note', () => {
    const [c] = domChips(loadMain({ 'javascript.0.music_playing': 2 }).buildRibbon());
    assert.equal(c.kind, 'musik');
    assert.match(c.svg, /var\(--green\)/);
});

test('ribbon: no music chip while nothing plays', () => {
    assert.deepEqual(domChips(loadMain({ 'javascript.0.music_playing': 0 }).buildRibbon()), []);
});

// plugs (owner, 2026-11-08): like the lights, an amber plug symbol with the count while any is on
test('ribbon: two plugs on show an amber plug with "2"', () => {
    const [c] = domChips(loadMain({ 'javascript.0.plugs_on': 2 }).buildRibbon());
    assert.equal(c.kind, 'stecker');
    assert.equal(c.text, '2');
    assert.match(c.svg, /var\(--amber\)/);
});

test('ribbon: no plug chip while every plug is off or the count is missing', () => {
    assert.deepEqual(domChips(loadMain({ 'javascript.0.plugs_on': 0 }).buildRibbon()), []);
    assert.deepEqual(domChips(loadMain({}).buildRibbon()), []);
});

test('ribbon: the chips read lights, plugs, music in that order', () => {
    const html = loadMain({ 'javascript.0.lights_on': 3, 'javascript.0.plugs_on': 1, 'javascript.0.music_playing': 1 }).buildRibbon();
    assert.deepEqual(domChips(html).map((c) => c.kind), ['licht', 'stecker', 'musik']);
    assert.match(html, /grid-template-columns:repeat\(5,1fr\) max-content max-content max-content/);
});

test('ribbon: icon chips take only their content width, the five text chips share the rest', () => {
    const html = loadMain({ 'javascript.0.lights_on': 2, 'javascript.0.music_playing': 1 }).buildRibbon();
    assert.match(html, /grid-template-columns:repeat\(5,1fr\) max-content max-content/);
});

// The lock (owner, 2026-11-08): the door is usually left unlocked now, so a red "Türschloss" chip was
// a standing false alarm. It is a padlock symbol inside the Haustür chip, so it plainly belongs to
// that door: grey (open) when unlocked, red (closed) when locked — on purpose, it warns that someone
// locked the door that is normally left open. Unknown or unreachable reads grey.
const LOCK = 'hm-rpc.1.002A226996B89C';
// the Haustür chip's markup, and the padlock symbol inside it
function haustuer(html) {
    const i = html.indexOf('<span class="nm">Haustür</span>');
    assert.ok(i >= 0, 'no Haustür chip');
    return html.slice(html.lastIndexOf('<div class="rind"', i), html.indexOf('</div>', i));
}
const lockChip = (html) => {
    const m = haustuer(html).match(/<span class="lk" data-d="schloss">(<svg data-l="[a-z]+".*?<\/svg>)/);
    return m ? { svg: m[1] } : undefined;
};

test('ribbon: the padlock sits inside the Haustür chip, right after its name', () => {
    const chip = haustuer(loadMain({ [LOCK + '.1.LOCK_STATE']: 2 }).buildRibbon());
    assert.match(chip, /<span class="nm">Haustür<\/span><span class="lk" data-d="schloss">/);
});

test('ribbon: a locked door shows a red closed padlock', () => {
    const c = lockChip(loadMain({ [LOCK + '.1.LOCK_STATE']: 1 }).buildRibbon());
    assert.match(c.svg, /var\(--red-ind\)/);
    assert.match(c.svg, /data-l="zu"/);
});

test('ribbon: an unlocked door shows a grey open padlock, no alarm', () => {
    const c = lockChip(loadMain({ [LOCK + '.1.LOCK_STATE']: 2 }).buildRibbon());
    assert.match(c.svg, /var\(--muted\)/);
    assert.match(c.svg, /data-l="offen"/);
});

test('ribbon: an unknown lock state reads grey', () => {
    const c = lockChip(loadMain({}).buildRibbon());
    assert.match(c.svg, /var\(--muted\)/);
});

test('ribbon: an unreachable lock reads grey with the low-battery mark, even if it last said locked', () => {
    const html = loadMain({ [LOCK + '.1.LOCK_STATE']: 1, [LOCK + '.0.UNREACH']: true }).buildRibbon();
    assert.match(lockChip(html).svg, /var\(--muted\)/);
    assert.match(haustuer(html), /class="bat/);
});

test('ribbon: there is no separate lock chip any more', () => {
    assert.doesNotMatch(loadMain({ [LOCK + '.1.LOCK_STATE']: 2 }).buildRibbon(), /<div class="rind dom" data-d="schloss"/);
});

test('ribbon: the long "Türschloss" text chip is gone', () => {
    assert.doesNotMatch(loadMain({ [LOCK + '.1.LOCK_STATE']: 2 }).buildRibbon(), /Türschloss/);
});
