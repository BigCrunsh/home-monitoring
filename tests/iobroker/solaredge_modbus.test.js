// Guards for how solaredge_modbus.js reaches the inverter.
//
// The defect that shipped: the script dialled a hard-coded IPv4 address. On 2026-09-21 the
// Fritz!Box handed the inverter a new DHCP lease, every poll failed with EHOSTUNREACH for
// 4.5 days, and the energy hub silently fell back to the ~1 h delayed cloud feed. The fix dials
// the inverter's Fritz!Box DNS name, which follows the lease. These tests boot the script in a
// sandbox with a fake `net` module and pin (1) which host it dials and (2) that a failed lookup
// degrades exactly like an unreachable host: online=false, no fabricated production reading.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

const SRC = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'integrations', 'iobroker', 'solaredge_modbus.js'),
    'utf8',
);

// Boot the script once. `onConnect(sock, host, port)` decides what the fake socket does.
function boot(onConnect) {
    const sockets = [];
    const states = {};
    class FakeSocket extends EventEmitter {
        setTimeout() {}
        destroy() { this.destroyed = true; }
        write() {}
        connect(port, host, cb) {
            this.port = port;
            this.host = host;
            sockets.push(this);
            onConnect(this, host, port, cb);
        }
    }
    const ctx = {
        console: { log() {}, warn() {} },
        Buffer,
        Math,
        Promise,
        require: (m) => {
            assert.strictEqual(m, 'net', `unexpected require(${m})`);
            return { Socket: FakeSocket };
        },
        createState: (id, def) => { if (!(id in states)) states[id] = { val: def, writes: 0 }; },
        setState: (id, val) => { states[id] = { val, writes: (states[id]?.writes || 0) + 1 }; },
        schedule: () => {},
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return { sockets, states };
}

test('dials the inverter by its Fritz!Box DNS name on the SunSpec port', () => {
    const { sockets } = boot(() => {});
    assert.strictEqual(sockets.length, 1, 'expected one poll on start-up');
    assert.strictEqual(sockets[0].host, 'solaredgeinv-741523F9.fritz.box');
    assert.strictEqual(sockets[0].port, 1502);
});

test('never dials a hard-coded IPv4 address (DHCP moves the inverter)', () => {
    const { sockets } = boot(() => {});
    assert.doesNotMatch(sockets[0].host, /^\d{1,3}(\.\d{1,3}){3}$/);
    assert.doesNotMatch(SRC, /192\.168\.\d+\.\d+/, 'no LAN IPv4 literal may remain in the script');
});

test('a failed name lookup marks the source offline and writes no production reading', () => {
    const { states } = boot((sock) => {
        const err = new Error('getaddrinfo ENOTFOUND solaredgeinv-741523F9.fritz.box');
        err.code = 'ENOTFOUND';
        sock.emit('error', err);
    });
    assert.strictEqual(states.solaredge_modbus_online.val, false);
    assert.strictEqual(states.solaredge_modbus_online.writes, 1);
    assert.strictEqual(
        states.solaredge_modbus_production.writes,
        0,
        'production must age out (Diagnose relies on its timestamp), not be overwritten',
    );
});
