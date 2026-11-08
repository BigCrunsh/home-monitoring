// The Diagnose summary banner (diagnose_v2.js buildSummary) is the tab's verdict at a glance. It
// counted only data sources and adapters, so it said "Alle Quellen aktuell" while devices on the
// Geräte card were offline or silent (task 10.1). Device problems now count in the banner too,
// worst first, and the banner colour follows the worst problem.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const MOTION = 'hm-rpc.1.00091A4996315B', LOCK = 'hm-rpc.1.002A226996B89C';

// devices: {id: {UNREACH, LOW_BAT}}; every data source is fresh unless listed in stale
function loadDiagnose(devices, stale = []) {
    const now = Date.now();
    const st = {};
    const put = (id, val, ageMs = 0) => { st[id] = { val, ts: now - ageMs, lc: now - ageMs }; };
    Object.keys(devices).forEach((d) => {
        put(d + '.0.UNREACH', !!devices[d].UNREACH);
        put(d + '.0.LOW_BAT', !!devices[d].LOW_BAT);
    });
    const ctx = {
        console: { log() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        getObject: (id) => (id in devices ? { common: { name: devices[id].name } } : null),
        getEnums: () => [],
        $: (sel) => ({ each: (fn) => Object.keys(devices).forEach((d) => fn(d + '.0.UNREACH')) }),
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}, sendTo() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.SOURCES.forEach((s) => put(s[1], 1, stale.includes(s[0]) ? 10 * 24 * 3600 * 1000 : 0));
    ctx.enumerateHmDevices();
    ctx.enumerateBatteryDevices();
    return ctx;
}
const banner = (ctx) => ctx.buildSummary().match(/class="txt" style="color:([^"]+)">([^<]+)</).slice(1);

test('summary: no source and no device problem reads all clear in green', () => {
    const ctx = loadDiagnose({ [MOTION]: { name: 'Bewegungsmelder Flur' } });
    const [col, txt] = banner(ctx);
    assert.equal(txt, 'Alle Quellen und Geräte ok');
    assert.equal(col, ctx.GREEN);
});

test('summary: an offline device makes the banner red even when every source is fresh', () => {
    const ctx = loadDiagnose({ [LOCK]: { name: 'Türschloss', UNREACH: true } });
    const [col, txt] = banner(ctx);
    assert.equal(txt, '1 Gerät offline');
    assert.equal(col, ctx.RED);
});

test('summary: a low battery is a device to check, in amber', () => {
    const ctx = loadDiagnose({
        [MOTION]: { name: 'Bewegungsmelder Flur', LOW_BAT: true },
        [LOCK]: { name: 'Türschloss', LOW_BAT: true }
    });
    const [col, txt] = banner(ctx);
    assert.equal(txt, '2 Geräte prüfen');
    assert.equal(col, ctx.AMBER);
});

test('summary: source and device problems are listed together, worst first', () => {
    const ctx = loadDiagnose({ [MOTION]: { name: 'Bewegungsmelder Flur', LOW_BAT: true } }, ['Tankstelle']);
    const [col, txt] = banner(ctx);
    assert.equal(txt, '1 Quelle offline · 1 Gerät prüfen');
    assert.equal(col, ctx.RED);
});

// A schedule-mode adapter (daswetter) is not alive between its runs; "geplant" read like "not set
// up yet" (task 10.4). It now says it runs on a schedule.
test('adapters: a schedule-mode adapter between runs reads "nach Zeitplan" in green', () => {
    const ctx = loadDiagnose({});
    ctx.getObject = (id) => (id === 'system.adapter.daswetter.0' ? { common: { mode: 'schedule', enabled: true } } : null);
    const health = ctx.adapterHealth('daswetter.0');
    assert.equal(health.st, 'nach Zeitplan');
    assert.equal(health.col, ctx.GREEN);
});

test('adapters: a disabled schedule-mode adapter is still red, not "nach Zeitplan"', () => {
    const ctx = loadDiagnose({});
    ctx.getObject = (id) => (id === 'system.adapter.daswetter.0' ? { common: { mode: 'schedule', enabled: false } } : null);
    assert.equal(ctx.adapterHealth('daswetter.0').st, 'deaktiviert');
});
