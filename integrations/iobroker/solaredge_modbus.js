// Live SolarEdge readings over Modbus TCP (SunSpec) — replaces the ~15-min,
// rate-limited cloud feed for production, so the Energiefluss hub's consumption
// and autarky become real-time. Inverter SE3680H, SunSpec Modbus TCP port 1502.
//
// The inverter's address comes from the Fritz!Box DHCP and has moved before (a lease change
// on 2026-09-21 left this script polling a dead address for 4.5 days), so it is dialled by
// its Fritz!Box DNS name, which follows the lease.
//
// The inverter accepts only ONE Modbus TCP connection at a time, so each poll
// opens one socket, reads, and closes; overlapping polls are skipped. Published:
//   solaredge_modbus_production    W     inverter AC power (SunSpec 40083/40084)
//   solaredge_modbus_energy_total  Wh    lifetime AC energy counter (SunSpec 40093–40095);
//                                        the 15-minute energy totals are its differences
//   solaredge_modbus_online        bool  last poll succeeded
//
// SunSpec scale factors (sunSF) are signed int16 exponents: value = raw * 10^sf.

var net = require('net');
var HOST = 'solaredgeinv-741523F9.fritz.box', PORT = 1502, UNIT = 1, POLL_MS = 6000;

createState('solaredge_modbus_production', 0, { type: 'number', role: 'value.power', unit: 'W', desc: 'SolarEdge AC-Leistung (Modbus, live)' });
createState('solaredge_modbus_energy_total', 0, { type: 'number', role: 'value.energy', unit: 'Wh', desc: 'SolarEdge AC-Energie gesamt (Modbus-Zähler)' });
createState('solaredge_modbus_online', false, { type: 'boolean', role: 'indicator.reachable', desc: 'SolarEdge Modbus erreichbar' });

// Read `qty` holding registers from `addr` (FC3); resolves with the data Buffer.
function modbusRead(sock, addr, qty) {
    return new Promise(function (resolve, reject) {
        var req = Buffer.alloc(12);
        req.writeUInt16BE(1, 0);       // transaction id
        req.writeUInt16BE(0, 2);       // protocol id
        req.writeUInt16BE(6, 4);       // length
        req.writeUInt8(UNIT, 6);       // unit id
        req.writeUInt8(3, 7);          // FC = read holding registers
        req.writeUInt16BE(addr, 8);
        req.writeUInt16BE(qty, 10);
        var need = 9 + 2 * qty, EXCEPTION_LEN = 9, buf = Buffer.alloc(0);
        function onData(d) {
            buf = Buffer.concat([buf, d]);
            // An exception reply is only 9 bytes, shorter than any data reply.
            var isException = buf.length >= EXCEPTION_LEN && (buf[7] & 0x80);
            if (isException || buf.length >= need) {
                sock.removeListener('data', onData);
                if (isException) reject(new Error('modbus exception ' + buf[8]));
                else resolve(buf.slice(9, 9 + buf[8]));
            }
        }
        sock.on('data', onData);
        sock.write(req);
    });
}

// Log only the online/offline transitions: during a DNS or network outage every 6 s poll fails.
var wasOnline = true;
function noteFailure(message) {
    if (wasOnline) console.warn('solaredge modbus: ' + message);
    wasOnline = false;
}
function noteSuccess() {
    if (!wasOnline) console.log('solaredge modbus: wieder erreichbar');
    wasOnline = true;
}

// A counter of 0 (inverter still starting) or below the last reading is a glitch, not energy:
// publishing it would show up as a huge jump in the next 15-minute total.
var lastEnergy = 0;
function publishEnergy(wh) {
    if (!(wh > 0) || wh < lastEnergy) return;
    lastEnergy = wh;
    setState('solaredge_modbus_energy_total', wh, true);
}

var polling = false;
function poll() {
    if (polling) return;
    polling = true;
    var sock = new net.Socket();
    sock.setTimeout(5000);
    var finished = false;
    function done(ok) {
        if (finished) return;
        finished = true;
        polling = false;
        if (!ok) setState('solaredge_modbus_online', false, true);
        try { sock.destroy(); } catch (e) {}
    }
    sock.on('timeout', function () { noteFailure('timeout'); done(false); });
    sock.on('error', function (e) { noteFailure(e.message); done(false); });
    sock.connect(PORT, HOST, function () {
        // 40083 AC power, 40084 its sf, … 40093–40094 lifetime AC energy (Wh), 40095 its sf
        modbusRead(sock, 40083, 13).then(function (inv) {
            var prod = inv.readInt16BE(0) * Math.pow(10, inv.readInt16BE(2));
            setState('solaredge_modbus_production', Math.round(prod), true);
            publishEnergy(inv.readUInt32BE(20) * Math.pow(10, inv.readInt16BE(24)));
            setState('solaredge_modbus_online', true, true);
            noteSuccess();
            done(true);
        }).catch(function (e) { noteFailure('read: ' + e.message); done(false); });
    });
}

schedule('*/' + (POLL_MS / 1000) + ' * * * * *', poll);
poll();
