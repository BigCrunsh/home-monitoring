// Guards for the Maxxisun plug readout in solaredge_power.js.
//
// The defect: once the plug reading went stale or unreachable, power_maxxisun and
// maxxisun_status kept their last value (e.g. "Speist -800 W") forever, while production
// already treated the Maxxisun as 0. The dashboard must show idle ("Bereit", 0 W) instead.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'integrations', 'iobroker', 'solaredge_power.js'),
    'utf8',
);

const MAXXI_STATE = 'mqtt.0.shellyplugsg3-48f6eeb7af98.status.switch:0';

const GRID_STATE = 'javascript.0.mqtt_shelly.total_act_power';

// Boot the script with fake ioBroker globals. `inputs` maps state id -> {val, ts};
// `daylight` is what the adapter's isAstroDay() answers (sun above the horizon).
function boot(inputs, daylight = true) {
    const published = {};
    const handlers = [];
    const influxQueries = [];
    const ctx = {
        console: { log() {}, warn() {}, error() {} },
        Math,
        Date,
        JSON,
        require: () => ({ get: () => Promise.resolve() }),
        createState: () => {},
        setState: (id, val) => { published[id] = val; },
        getState: (id) => inputs[id] || null,
        on: (opts, fn) => handlers.push({ opts, fn }),
        schedule: () => {},
        sendTo: (_adapter, _cmd, query) => influxQueries.push(query),
        isAstroDay: () => daylight,
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return {
        published,
        influxQueries,
        plugReported: handlers.find((h) => h.opts.id === MAXXI_STATE).fn,
        gridReported: handlers.find((h) => h.opts.id === GRID_STATE).fn,
    };
}

const fresh = (val) => ({ val, ts: Date.now() - 1000 });
const modbusLive = (watts) => ({
    'javascript.0.solaredge_modbus_online': fresh(true),
    'javascript.0.solaredge_modbus_production': fresh(watts),
});
const modbusOffline = { 'javascript.0.solaredge_modbus_online': fresh(false) };

function plug(apower, ageSeconds = 1) {
    return { val: JSON.stringify({ apower, output: true }), ts: Date.now() - ageSeconds * 1000 };
}

test('fresh plug reading is published with its status', () => {
    const { published, plugReported } = boot({ [MAXXI_STATE]: plug(-800) });
    plugReported();
    assert.strictEqual(published.power_maxxisun, -800);
    assert.strictEqual(published.maxxisun_status, 'Speist');
});

test('stale plug reading resets power and status to idle', () => {
    const { published, plugReported } = boot({ [MAXXI_STATE]: plug(-800, 121) });
    plugReported();
    assert.strictEqual(published.power_maxxisun, 0);
    assert.strictEqual(published.maxxisun_status, 'Bereit');
});

test('missing plug state resets power and status to idle', () => {
    const { published, plugReported } = boot({});
    plugReported();
    assert.strictEqual(published.power_maxxisun, 0);
    assert.strictEqual(published.maxxisun_status, 'Bereit');
});

test('unparseable plug payload resets power and status to idle', () => {
    const { published, plugReported } = boot({
        [MAXXI_STATE]: { val: 'not json', ts: Date.now() },
    });
    plugReported();
    assert.strictEqual(published.power_maxxisun, 0);
    assert.strictEqual(published.maxxisun_status, 'Bereit');
});

test('plug payload without a numeric apower resets power and status to idle', () => {
    const { published, plugReported } = boot({
        [MAXXI_STATE]: { val: JSON.stringify({ output: false }), ts: Date.now() },
    });
    plugReported();
    assert.strictEqual(published.power_maxxisun, 0);
    assert.strictEqual(published.maxxisun_status, 'Bereit');
});

// Production comes from Modbus only: the SolarEdge cloud rows that used to stand in while the
// inverter was unreachable were retired on 2026-11-03. An inverter that does not answer at night
// is asleep and produces nothing; one that does not answer in daylight is unknown, so the states
// go stale instead of showing a made-up value.
test('live Modbus production and a fresh grid reading are published', () => {
    const { published, gridReported } = boot({ ...modbusLive(1200), [GRID_STATE]: fresh(-300) });
    gridReported();
    assert.strictEqual(published.power_production, 1200);
    assert.strictEqual(published.power_feedin, 300);
    assert.strictEqual(published.power_consumption, 900);
    assert.strictEqual(published.power_data_stale, false);
});

test('an inverter asleep at night counts as 0 W and the house runs on the grid', () => {
    const { published, gridReported } = boot({ ...modbusOffline, [GRID_STATE]: fresh(450) }, false);
    gridReported();
    assert.strictEqual(published.power_production, 0);
    assert.strictEqual(published.power_consumption, 450);
    assert.strictEqual(published.power_data_stale, false);
});

test('an inverter unreachable in daylight leaves the states stale, not guessed', () => {
    const { published, gridReported } = boot({ ...modbusOffline, [GRID_STATE]: fresh(450) }, true);
    gridReported();
    assert.strictEqual(published.power_data_stale, true);
    assert.ok(!('power_production' in published));
});

test('a stale grid reading leaves the states stale even with live production', () => {
    const grid = { val: 450, ts: Date.now() - 10 * 60 * 1000 };
    const { published, gridReported } = boot({ ...modbusLive(1200), [GRID_STATE]: grid });
    gridReported();
    assert.strictEqual(published.power_data_stale, true);
    assert.ok(!('power_consumption' in published));
});

test('the retired SolarEdge cloud table is no longer queried', () => {
    const { influxQueries, gridReported } = boot({ ...modbusLive(1200), [GRID_STATE]: fresh(0) });
    gridReported();
    assert.deepStrictEqual(influxQueries, []);
    assert.doesNotMatch(SRC, /electricity_power_watt/);
});
