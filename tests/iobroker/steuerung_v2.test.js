// Steuerung tab (steuerung_v2.js + its native tap-overlays in vis-views.json). The script draws the
// tiles and logs every tap rectangle (STEUERUNG_LAYOUT); the transparent i-vis-universal overlays in
// the Steuerung view must sit on exactly those rects and switch exactly those states. They are
// hand-placed, so these guards catch a tile that moved or a device that was removed on one side only.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const REMOVED = ['0001DD89A46B91', '0001DD89A46CA5'];   // plugs removed on the CCU (Studio Stehlampe, old Maxxisun HmIP)

function loadSteuerung(states) {
    const logs = [];
    const st = states || {};
    const ctx = {
        console: { log: (m) => logs.push(String(m)), warn() {} },
        getState: (id) => (id in st ? { val: st[id] } : null), existsState: (id) => id in st,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {}, sendTo() {},
        $: () => ({ each() {} }), require: () => ({ get: () => Promise.resolve() })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'steuerung_v2.js'), 'utf8'), ctx);
    const html = ctx.build();
    const line = logs.find((l) => l.startsWith('STEUERUNG_LAYOUT '));
    return { ctx, html, targets: JSON.parse(line.slice('STEUERUNG_LAYOUT '.length)) };
}
// overlays lying on the tile grid, in grid coordinates (view position minus the grid widget's
// offset); the music band's overlays below the grid belong to musik_v2 and are not checked here
function overlays() {
    const v = JSON.parse(fs.readFileSync(path.join(IOB, 'vis', 'main', 'vis-views.json'), 'utf8'));
    const grid = v.Steuerung.widgets.st_grid.style;
    const gx = parseInt(grid.left, 10), gy = parseInt(grid.top, 10);
    const gw = parseInt(grid.width, 10), gh = parseInt(grid.height, 10);
    return Object.entries(v.Steuerung.widgets)
        .filter(([, w]) => w.tpl === 'i-vis-universal' && w.data && w.data.oid)
        .map(([id, w]) => ({ id, oid: w.data.oid, x: parseInt(w.style.left, 10) - gx, y: parseInt(w.style.top, 10) - gy }))
        .filter((o) => o.x >= 0 && o.y >= 0 && o.x < gw && o.y < gh);
}

test('maxxi: the Maxxi Akku tile switches the Shelly relay and shows the Maxxisun power', () => {
    const { html, targets } = loadSteuerung({ 'javascript.0.maxxisun_relay': true, 'javascript.0.power_maxxisun': -87 });
    assert.ok(targets.some((t) => t.oid === 'javascript.0.maxxisun_relay' && t.kind === 'toggle'));
    assert.match(html, /Maxxi Akku<\/span><span class="st">-87 W/);
});

test('removed plugs: no tile, tap target or script still points at a device removed on the CCU', () => {
    const { html, targets } = loadSteuerung();
    REMOVED.forEach((serial) => {
        assert.ok(!targets.some((t) => t.oid.includes(serial)), 'tap target for ' + serial);
        assert.doesNotMatch(html, new RegExp(serial));
        fs.readdirSync(IOB).filter((f) => f.endsWith('.js')).forEach((f) => {
            assert.doesNotMatch(fs.readFileSync(path.join(IOB, f), 'utf8'), new RegExp(serial), f + ' references ' + serial);
        });
    });
    assert.doesNotMatch(html, /Stehlampe/);
});

test('overlays: every tap target has a native overlay on the same rect switching the same state', () => {
    const { targets } = loadSteuerung();
    const ov = overlays();
    targets.forEach((t) => {
        const hit = ov.find((o) => o.oid === t.oid && o.x === t.x && o.y === t.y);
        assert.ok(hit, 'no overlay for ' + t.oid + ' at ' + t.x + ',' + t.y);
    });
});

test('overlays: no overlay is left switching a state that no tile shows any more', () => {
    const { targets } = loadSteuerung();
    overlays().forEach((o) => {
        assert.ok(targets.some((t) => t.oid === o.oid && t.x === o.x && t.y === o.y), 'stale overlay ' + o.id + ' → ' + o.oid);
    });
});
