// Unit tests for vcPressureTrend — the barometer reading shared by the Klima hero and the room tiles:
// rising pressure = improving weather (good, ↑), falling = worsening (cold, ↓), stable = no arrow.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { console: { log() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'integrations', 'iobroker', 'vis_card.js'), 'utf8'), ctx);
const plain = (o) => JSON.parse(JSON.stringify(o));

test('pressure trend: rising reads good with an up arrow', () => {
    assert.deepEqual(plain(ctx.vcPressureTrend('up')), { sem: 'good', arrow: '↑', word: 'steigend' });
});
test('pressure trend: falling reads cold with a down arrow', () => {
    assert.deepEqual(plain(ctx.vcPressureTrend('down')), { sem: 'cold', arrow: '↓', word: 'fallend' });
});
test('pressure trend: stable is muted without an arrow', () => {
    assert.deepEqual(plain(ctx.vcPressureTrend('stable')), { sem: 'muted', arrow: '', word: 'stabil' });
});
// Wetterhäuschen colouring of the pressure value itself (hero + outdoor tiles)
const P = ctx.VC_PAL;
test('pressure colour: rising pressure is green', () => {
    assert.equal(ctx.vcPressureColor(P, 'up'), P.good);
});
test('pressure colour: falling pressure is blue', () => {
    assert.equal(ctx.vcPressureColor(P, 'down'), P.cold);
});
test('pressure colour: stable, missing or unknown trend stays plain white text', () => {
    assert.equal(ctx.vcPressureColor(P, 'stable'), P.text);
    assert.equal(ctx.vcPressureColor(P, null), P.text);
    assert.equal(ctx.vcPressureColor(P, 'sideways'), P.text);
});

test('pressure trend: unknown or missing trend is muted without an arrow', () => {
    assert.deepEqual(plain(ctx.vcPressureTrend(null)), { sem: 'muted', arrow: '', word: 'stabil' });
    assert.deepEqual(plain(ctx.vcPressureTrend('sideways')), { sem: 'muted', arrow: '', word: 'stabil' });
});
