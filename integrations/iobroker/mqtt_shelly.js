// ioBroker JavaScript: MQTT JSON Parser für Shelly Pro 3EM
// Dieses Script läuft im JavaScript Adapter
//
// total_act_power (em:0) ist der Netz-Anker von solaredge_power.js und die Frische-Quelle von diagnose_v2.js.
// Die Lebensdauer-Zähler für Bezug und Einspeisung (emdata:0, Wh) sind die Grundlage der 15-Minuten-
// Energiesummen und des täglichen Abgleichs mit dem Stromzähler des Netzbetreibers.
// Fehlt ein Wert oder ist er keine Zahl, wird nichts geschrieben: ein erfundenes 0 W sähe wie eine frische
// Messung aus, ein alternder Zeitstempel dagegen lässt die Diagnose den toten Feed melden.

const GRID_POWER = 'javascript.0.mqtt_shelly.total_act_power';
const IMPORT_TOTAL = 'javascript.0.mqtt_shelly.import_total';
const EXPORT_TOTAL = 'javascript.0.mqtt_shelly.export_total';

createState(GRID_POWER, 0, {name: 'Total Active Power', type: 'number', unit: 'W', read: true, write: false});
createState(IMPORT_TOTAL, 0, {name: 'Netzbezug gesamt (Zähler)', type: 'number', role: 'value.energy', unit: 'Wh', read: true, write: false});
createState(EXPORT_TOTAL, 0, {name: 'Einspeisung gesamt (Zähler)', type: 'number', role: 'value.energy', unit: 'Wh', read: true, write: false});

let parseErrorLogged = false;

function parsePayload(obj) {
    const payload = obj && obj.state ? obj.state.val : null;
    if (payload === null || payload === undefined || payload === '') return null;
    try {
        return typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch (e) {
        if (!parseErrorLogged) {
            parseErrorLogged = true;
            log('Shelly 3EM: MQTT JSON nicht lesbar (weitere Fehler werden nicht geloggt): ' + e.message, 'warn');
        }
        return null;
    }
}

const isNumber = (v) => typeof v === 'number' && isFinite(v);

on({id: 'mqtt.0.shellypro3em.status.em:0', change: 'any'}, function(obj) {
    const data = parsePayload(obj);
    const power = data ? data.total_act_power : undefined;
    if (!isNumber(power)) return;
    setState(GRID_POWER, power, true);
});

// Ein Zählerstand von 0 oder unter dem letzten ist ein Messfehler, keine Energie: er würde in der
// nächsten 15-Minuten-Summe als riesiger Sprung erscheinen.
const lastCounter = {};
function publishCounter(id, wh) {
    if (!isNumber(wh) || wh <= 0 || wh < (lastCounter[id] || 0)) return;
    lastCounter[id] = wh;
    setState(id, wh, true);
}

on({id: 'mqtt.0.shellypro3em.status.emdata:0', change: 'any'}, function(obj) {
    const data = parsePayload(obj);
    if (!data) return;
    publishCounter(IMPORT_TOTAL, data.total_act);
    publishCounter(EXPORT_TOTAL, data.total_act_ret);
});
