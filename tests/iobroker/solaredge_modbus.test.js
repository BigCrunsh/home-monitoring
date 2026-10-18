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

// Boot the script once. `onConnect(sock, host, port)` decides what the fake socket does;
// `onWrite(sock)` (optional) answers a Modbus request by emitting 'data' on it.
function boot(onConnect, onWrite = () => {}) {
    const sockets = [];
    const states = {};
    const logs = [];
    const scheduled = [];
    class FakeSocket extends EventEmitter {
        setTimeout() {}
        destroy() { this.destroyed = true; }
        write() { onWrite(this); }
        connect(port, host, cb) {
            this.port = port;
            this.host = host;
            sockets.push(this);
            onConnect(this, host, port);
            if (cb && !this.failed) cb();
        }
    }
    const ctx = {
        console: { log: (m) => logs.push(m), warn: (m) => logs.push(m) },
        Buffer,
        Math,
        Promise,
        require: (m) => {
            assert.strictEqual(m, 'net', `unexpected require(${m})`);
            return { Socket: FakeSocket };
        },
        createState: (id, def) => { if (!(id in states)) states[id] = { val: def, writes: 0 }; },
        setState: (id, val) => { states[id] = { val, writes: (states[id]?.writes || 0) + 1 }; },
        schedule: (spec, fn) => scheduled.push(fn),
    };
    vm.createContext(ctx);
    vm.runInContext(SRC, ctx);
    return { sockets, states, logs, poll: scheduled[0] };
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

// The error tests emit 'error' inside onConnect and must not also trigger the connect callback.
const failConnect = (message) => (sock) => {
    sock.failed = true;
    sock.emit('error', new Error(message));
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

function powerFrame(raw, sf) {
    const f = Buffer.alloc(13);
    f.writeUInt16BE(6 + 1 + 4, 4);
    f.writeUInt8(1, 6);
    f.writeUInt8(3, 7);
    f.writeUInt8(4, 8);
    f.writeInt16BE(raw, 9);
    f.writeInt16BE(sf, 11);
    return f;
}

function exceptionFrame(code) {
    const f = Buffer.alloc(9);
    f.writeUInt16BE(3, 4);
    f.writeUInt8(1, 6);
    f.writeUInt8(0x83, 7);
    f.writeUInt8(code, 8);
    return f;
}

const reply = (frame) => (sock) => setImmediate(() => sock.emit('data', frame));

test('a valid power frame publishes production with the scale factor applied', async () => {
    const { states, sockets } = boot(() => {}, reply(powerFrame(1234, -1)));
    await tick();
    assert.strictEqual(states.solaredge_modbus_production.val, 123);
    assert.strictEqual(states.solaredge_modbus_online.val, true);
    assert.strictEqual(sockets.length, 1);
});

test('production is published from a single read, no meter read follows', async () => {
    let writes = 0;
    const { states } = boot(() => {}, (sock) => {
        writes += 1;
        reply(powerFrame(2000, 0))(sock);
    });
    await tick();
    await tick();
    assert.strictEqual(writes, 1);
    assert.strictEqual(states.solaredge_modbus_production.val, 2000);
});

test('no grid state is created any more (nothing consumes it)', () => {
    const { states } = boot(() => {});
    assert.ok(!('solaredge_modbus_grid' in states));
});

test('a modbus exception frame fails promptly instead of waiting for the idle timeout', async () => {
    const { states, logs } = boot(() => {}, reply(exceptionFrame(2)));
    await tick();
    assert.strictEqual(states.solaredge_modbus_online.val, false);
    assert.strictEqual(states.solaredge_modbus_production.writes, 0);
    assert.match(logs.join('\n'), /modbus exception 2/);
});

test('a socket timeout marks the source offline without fabricating production', () => {
    const { states, sockets } = boot(() => {});
    sockets[0].emit('timeout');
    assert.strictEqual(states.solaredge_modbus_online.val, false);
    assert.strictEqual(states.solaredge_modbus_production.writes, 0);
});

test('repeated failures log only once, not on every poll', () => {
    const { logs, poll } = boot(failConnect('getaddrinfo ENOTFOUND x'));
    poll();
    poll();
    poll();
    assert.strictEqual(logs.length, 1);
});

test('recovery after failures logs once, and a later failure logs again', async () => {
    let healthy = false;
    const { logs, poll, states } = boot(
        (sock) => { if (!healthy) failConnect('ENOTFOUND')(sock); },
        reply(powerFrame(500, 0)),
    );
    poll();
    assert.strictEqual(logs.length, 1);
    healthy = true;
    poll();
    await tick();
    assert.strictEqual(states.solaredge_modbus_online.val, true);
    assert.strictEqual(logs.length, 2, 'one line for the recovery');
    assert.match(logs[1], /recover|wieder/i);
    poll();
    await tick();
    assert.strictEqual(logs.length, 2, 'staying online is silent');
    healthy = false;
    poll();
    assert.strictEqual(logs.length, 3, 'a new outage logs again');
});
