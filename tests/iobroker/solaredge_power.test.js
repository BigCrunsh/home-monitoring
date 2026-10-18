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

// Boot the script with fake ioBroker globals. `inputs` maps state id -> {val, ts}.
function boot(inputs) {
    const published = {};
    const handlers = [];
    const influxCallbacks = [];
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
        sendTo: (_adapter, _cmd, _query, cb) => influxCallbacks.push(cb),
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return {
        published,
        plugReported: handlers.find((h) => h.opts.id === MAXXI_STATE).fn,
        // the script's own InfluxDB reply handler, as registered by queryInfluxDB()
        influxReply: () => {
            vm.runInContext('queryInfluxDB()', ctx);
            return influxCallbacks[influxCallbacks.length - 1];
        },
    };
}

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

test('influx reply without a result array does not throw', () => {
    const { influxReply } = boot({});
    assert.doesNotThrow(() => influxReply()({}));
});

test('influx reply with an empty result array does not throw', () => {
    const { influxReply } = boot({});
    assert.doesNotThrow(() => influxReply()({ result: [] }));
});
