// Unit tests for vcBattSem — the one battery rule for every battery-powered sensor on the board
// (Netatmo room/outdoor modules, Gardena soil sensors): < 20 % alarm, < 30 % warn, else muted
// (an ok battery is not news, so it never turns green).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { console: { log() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'integrations', 'iobroker', 'vis_card.js'), 'utf8'), ctx);

test('battery: a healthy battery reads muted', () => {
    assert.equal(ctx.vcBattSem(46), 'muted');
});
test('battery: band edges — 19 alarm, 20 warn, 29 warn, 30 muted', () => {
    assert.equal(ctx.vcBattSem(19.9), 'alarm');
    assert.equal(ctx.vcBattSem(20), 'warn');
    assert.equal(ctx.vcBattSem(29.9), 'warn');
    assert.equal(ctx.vcBattSem(30), 'muted');
});
test('battery: an empty battery is an alarm', () => {
    assert.equal(ctx.vcBattSem(0), 'alarm');
});
test('battery: unknown level is muted, never a false alarm', () => {
    assert.equal(ctx.vcBattSem(null), 'muted');
    assert.equal(ctx.vcBattSem(undefined), 'muted');
    assert.equal(ctx.vcBattSem(NaN), 'muted');
});
