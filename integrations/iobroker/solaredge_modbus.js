// Live SolarEdge readings over Modbus TCP (SunSpec) — replaces the ~15-min,
// rate-limited cloud feed for production, so the Energiefluss hub's consumption
// and autarky become real-time. Inverter SE3680H @ 192.168.178.127:1502.
//
// The inverter accepts only ONE Modbus TCP connection at a time, so each poll
// opens one socket, reads, and closes; overlapping polls are skipped. Published:
//   solaredge_modbus_production  W   inverter AC power (SunSpec 40083/40084)
//   solaredge_modbus_grid        W   WattNode grid meter (40206/40210; +import/-export)
//   solaredge_modbus_online      bool  last poll succeeded
//
// SunSpec scale factors (sunSF) are signed int16 exponents: value = raw * 10^sf.

var net = require('net');
var HOST = '192.168.178.127', PORT = 1502, UNIT = 1, POLL_MS = 6000;

createState('solaredge_modbus_production', 0, { type: 'number', role: 'value.power', unit: 'W', desc: 'SolarEdge AC-Leistung (Modbus, live)' });
createState('solaredge_modbus_grid', 0, { type: 'number', role: 'value.power', unit: 'W', desc: 'WattNode Netzleistung (Modbus)' });
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
        var need = 9 + 2 * qty, buf = Buffer.alloc(0);
        function onData(d) {
            buf = Buffer.concat([buf, d]);
            if (buf.length >= need) {
                sock.removeListener('data', onData);
                if (buf[7] & 0x80) reject(new Error('modbus exception ' + buf[8]));
                else resolve(buf.slice(9, 9 + buf[8]));
            }
        }
        sock.on('data', onData);
        sock.write(req);
    });
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
    sock.on('timeout', function () { done(false); });
    sock.on('error', function (e) { console.warn('solaredge modbus: ' + e.message); done(false); });
    sock.connect(PORT, HOST, function () {
        modbusRead(sock, 40083, 2).then(function (inv) {            // inverter AC power + sf
            var prod = inv.readInt16BE(0) * Math.pow(10, inv.readInt16BE(2));
            return modbusRead(sock, 40206, 5).then(function (mt) {  // meter power (40206) + sf (40210)
                var grid = mt.readInt16BE(0) * Math.pow(10, mt.readInt16BE(8));
                setState('solaredge_modbus_production', Math.round(prod), true);
                setState('solaredge_modbus_grid', Math.round(grid), true);
                setState('solaredge_modbus_online', true, true);
                done(true);
            });
        }).catch(function (e) { console.warn('solaredge modbus read: ' + e.message); done(false); });
    });
}

schedule('*/' + (POLL_MS / 1000) + ' * * * * *', poll);
poll();
