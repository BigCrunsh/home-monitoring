// Diagnose "System · Pi" card and column layout (diagnose_v2.js). Only CPU had a usage bar; Last, RAM
// and Disk are capacities too and read faster as bars. Uptime is not a capacity — no bar.
// Layout: the nav panel sits under the left column only, so the middle and right columns run down to
// its bottom edge (y=775): middle = Adapter + Backup, right = System · Pi + Geräte.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const HOST = 'system.host.raspberrypi';

function loadDiagnose(states) {
    const now = Date.now();
    const st = {};
    Object.keys(states).forEach((id) => { st[id] = { val: states[id], ts: now, lc: now }; });
    const written = {};
    const ctx = {
        console: { log() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        getObject: () => null,
        getEnums: () => [],
        $: () => ({ each() {} }),
        sendTo() {},
        setState: (id, val) => { written[id] = val; st[id] = { val, ts: now, lc: now }; },
        createState() {}, on() {}, schedule() {}, setTimeout() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.written = written;
    return ctx;
}
const HEALTHY = {
    [HOST + '.cpu']: 7, [HOST + '.load']: 1.2, [HOST + '.mem']: 48, [HOST + '.freemem']: 1960,
    [HOST + '.diskFree']: 42683, [HOST + '.diskSize']: 59757, [HOST + '.uptime']: 1974363
};
// the srow block for one label, e.g. 'RAM frei'
function row(html, label) {
    const i = html.indexOf('>' + label + '<');
    assert.ok(i >= 0, 'row not found: ' + label);
    const start = html.lastIndexOf('<div class="srow', i);
    const next = html.indexOf('<div class="srow', i);
    return html.slice(start, next < 0 ? undefined : next);
}
function barWidth(r) { const m = r.match(/class="fill" style="width:([\d.]+)%/); return m ? Number(m[1]) : null; }

test('system: CPU, Last, RAM and Disk each show a usage bar', () => {
    const h = loadDiagnose(HEALTHY).buildSystem();
    assert.equal(barWidth(row(h, 'CPU')), 7);
    assert.equal(barWidth(row(h, 'Last (1 min)')), 30);   // 1.2 of 4 cores
    assert.equal(barWidth(row(h, 'RAM frei')), 48);       // host .mem is the used share
    assert.equal(barWidth(row(h, 'Disk frei')), 28.6);    // 1 - 42683/59757
});

test('system: uptime has no bar — it is not a capacity', () => {
    const h = loadDiagnose(HEALTHY).buildSystem();
    assert.equal(barWidth(row(h, 'Uptime')), null);
});

test('system: a load above the core count fills the bar, never overflows it', () => {
    const h = loadDiagnose(Object.assign({}, HEALTHY, { [HOST + '.load']: 6.5 })).buildSystem();
    assert.equal(barWidth(row(h, 'Last (1 min)')), 100);
});

test('system: without a disk size the free value still shows, but no bar is guessed', () => {
    const states = Object.assign({}, HEALTHY);
    delete states[HOST + '.diskSize'];
    const r = row(loadDiagnose(states).buildSystem(), 'Disk frei');
    assert.match(r, /41,7/);
    assert.equal(barWidth(r), null);
});

test('system: without a RAM usage share the free value still shows, but no bar is guessed', () => {
    const states = Object.assign({}, HEALTHY);
    delete states[HOST + '.mem'];
    const r = row(loadDiagnose(states).buildSystem(), 'RAM frei');
    assert.match(r, /1,9/);
    assert.equal(barWidth(r), null);
});
