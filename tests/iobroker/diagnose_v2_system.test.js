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

test('layout: the middle column holds Adapter + Backup, the right one System · Pi + Geräte, both 691 px tall', () => {
    const ctx = loadDiagnose(HEALTHY);
    ctx.publish();
    const mid = ctx.written.diag_mid, right = ctx.written.diag_right;
    assert.match(mid, /height="691"/);
    assert.match(right, /height="691"/);
    assert.ok(mid.indexOf('>Adapter<') >= 0 && mid.indexOf('>Backup<') > mid.indexOf('>Adapter<'), 'mid: Adapter then Backup');
    assert.ok(right.indexOf('>System · Pi<') >= 0 && right.indexOf('>Geräte<') > right.indexOf('>System · Pi<'), 'right: System then Geräte');
    assert.doesNotMatch(mid, />System · Pi</);
    assert.doesNotMatch(right, />Adapter</);
});

// Last power outage (written by power_outage.js as {start, end} in ms): when it began, Berlin time, and how long
const OUTAGE = 'javascript.0.power.last_outage';
function outageRow(value) {
    const states = Object.assign({}, HEALTHY);
    if (value !== undefined) states[OUTAGE] = value;
    return row(loadDiagnose(states).buildSystem(), 'Stromausfall');
}
const SEP26 = Date.UTC(2026, 8, 25, 22, 36);   // 26.09. 00:36 in Berlin (summer time)

test('system: the last power outage shows its start in Berlin time and its length', () => {
    const r = outageRow(JSON.stringify({ start: SEP26, end: SEP26 + 6 * 60000 }));
    assert.match(r, /26\.09\. 00:36 · 6 min/);
    assert.equal(barWidth(r), null);
});

test('system: an outage of an hour or more reads in hours and minutes', () => {
    const r = outageRow(JSON.stringify({ start: SEP26, end: SEP26 + 95 * 60000 }));
    assert.match(r, /· 1 h 35 min/);
});

test('system: an outage shorter than a minute does not read as 0 min', () => {
    const r = outageRow(JSON.stringify({ start: SEP26, end: SEP26 + 40000 }));
    assert.match(r, /· &lt; 1 min/);
});

test('system: no outage recorded yet says so', () => {
    assert.match(outageRow(undefined), /keiner erfasst/);
});

test('system: before power_outage.js has created its state, the card does not read the missing state', () => {
    // the javascript adapter logs a warning with a stack trace for every getState on a missing id
    const ctx = loadDiagnose(HEALTHY);
    const read = [];
    const getState = ctx.getState;
    ctx.getState = (id) => { read.push(id); return getState(id); };
    ctx.buildSystem();
    assert.ok(!read.includes(OUTAGE), 'read the missing outage state');
});

test('system: the empty initial value counts as no outage recorded', () => {
    assert.match(outageRow(''), /keiner erfasst/);
});

test('system: an unreadable outage record counts as none rather than breaking the card', () => {
    assert.match(outageRow('{not json'), /keiner erfasst/);
});
