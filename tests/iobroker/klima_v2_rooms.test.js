// Klima tab room list (klima_v2.js). Each room's 24 h curve comes from InfluxDB. Netatmo's own module
// names are not unique — the Studio and the Bungalow Lübkowsee base stations are both still called
// "Weather Station" — so the curve must be looked up by the module's hardware address (device_id),
// which the ioBroker path already carries. These tests run the real script against stubbed states.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const LUEB = 'netatmo.0.6ac096020a296fac710a1287.70-ee-50-c3-9e-84';
const STUDIO = 'netatmo.0.6a48fde5178fa8d8cd09bd27.70-ee-50-c2-86-aa';

// curves[device_id] = hourly means the stubbed InfluxDB returns for that device
function loadKlima(curves) {
    const queries = [];
    const ctx = {
        console: { log() {} },
        getState: () => null, existsState: () => false,
        setState() {}, createState() {}, on() {}, schedule() {}, setTimeout() {},
        sendTo: (inst, cmd, q, cb) => {
            queries.push(q);
            const id = (q.match(/device_id='([^']+)'/) || [])[1];
            const vals = (curves || {})[id] || [];
            cb({ result: [vals.map((m) => ({ m }))] });
        }
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'klima_v2.js'), 'utf8'), ctx);
    ctx.queries = queries;
    return ctx;
}

test('rooms: Bungalow Lübkowsee indoor + outdoor join the end of the list', () => {
    const ctx = loadKlima();
    const last = JSON.parse(JSON.stringify(ctx.ROOMS.slice(-2).map((r) => r[1])));
    assert.deepEqual(last, [LUEB, LUEB + '.02-00-00-c3-99-18']);
});

test('curves: each room is queried by the hardware address in its module path', () => {
    const ctx = loadKlima();
    ctx.fetchSparks();
    assert.ok(ctx.queries.some((q) => q.includes("device_id='70:ee:50:c3:9e:84'")));
    assert.ok(ctx.queries.some((q) => q.includes("device_id='02:00:00:c3:99:18'")));
});

test('curves: Studio and Bungalow (both "Weather Station") keep separate curves', () => {
    const ctx = loadKlima({ '70:ee:50:c2:86:aa': [24, 25], '70:ee:50:c3:9e:84': [17, 21] });
    ctx.fetchSparks();
    assert.deepEqual(JSON.parse(JSON.stringify(ctx.SPARK[ctx.deviceId(STUDIO)])), [24, 25]);
    assert.deepEqual(JSON.parse(JSON.stringify(ctx.SPARK[ctx.deviceId(LUEB)])), [17, 21]);
    assert.ok(ctx.queries.every((q) => !q.includes('module_name')), 'no query may key on the ambiguous name');
});

test('curves: the hero outdoor curve is fetched by the outdoor module address too', () => {
    const ctx = loadKlima();
    ctx.fetchSparks();
    assert.ok(ctx.queries.some((q) => q.includes("device_id='02:00:00:32:ae:a4'")));
});

test('curves: a device with fewer than two points gets no curve', () => {
    const ctx = loadKlima({ '70:ee:50:c3:9e:84': [21] });
    ctx.fetchSparks();
    assert.equal(ctx.SPARK[ctx.deviceId(LUEB)], undefined);
});

test('rooms: the room grid has exactly one row per room', () => {
    const ctx = loadKlima();
    const rows = Number(ctx.CSS_BASE.match(/\.rooms\{[^}]*grid-template-rows:repeat\((\d+),1fr\)/)[1]);
    assert.equal(rows, ctx.ROOMS.length);
});

test('rooms: an outdoor module never reads its non-existent CO₂ state (ioBroker warns on every read)', () => {
    const ctx = loadKlima();
    const reads = [];
    ctx.getState = (id) => { reads.push(id); return null; };
    ctx.buildRoom('Bungalow außen', LUEB + '.02-00-00-c3-99-18');
    assert.ok(!reads.some((id) => id.endsWith('.CO2.CO2')), 'read CO₂ although the state does not exist');
});
