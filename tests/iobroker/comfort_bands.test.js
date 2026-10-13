// The comfort bands (temperature → colour) are one rule in vis_card (vcComfortSem). Übersicht and
// Klima used to carry their own copies of the thresholds; these guards keep every tab's comfortCol /
// comfortTint derived from the shared rule so a band change can't land in one tab only.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const SAMPLES = [-12, 0, 2, 3, 3.1, 11.9, 12, 19.9, 20, 26.9, 27, 35, null];

function loadTab(file) {
    const ctx = {
        console: { log() {} }, getState: () => null, existsState: () => false,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}, sendTo() {},
        $: () => ({ each() {} })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, file), 'utf8'), ctx);
    return ctx;
}

['main_v2.js', 'klima_v2.js'].forEach((file) => {
    test(file + ': temperature colour comes from the shared comfort rule for every band', () => {
        const ctx = loadTab(file);
        SAMPLES.forEach((t) => assert.equal(ctx.comfortCol(t), ctx.vcSemColor(ctx.VC_PAL, ctx.vcComfortSem(t)), 'at ' + t));
    });
    test(file + ': thermo-disc tint comes from the shared comfort rule for every band', () => {
        const ctx = loadTab(file);
        SAMPLES.forEach((t) => assert.equal(ctx.comfortTint(t), ctx.vcComfortTint(t), 'at ' + t));
    });
});

test('tint: each comfort band has its own tint, missing data the muted one', () => {
    const ctx = loadTab('main_v2.js');
    assert.equal(ctx.vcComfortTint(15), 'var(--green-16)');
    assert.equal(ctx.vcComfortTint(8), 'var(--blue-16)');
    assert.equal(ctx.vcComfortTint(null), 'var(--muted-16)');
});
