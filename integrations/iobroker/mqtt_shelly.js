// ioBroker JavaScript: MQTT JSON Parser für Shelly Pro 3EM
// Dieses Script läuft im JavaScript Adapter
//
// Nur total_act_power wird gebraucht (solaredge_power.js als Netz-Anker, diagnose_v2.js für die Frische).
// Fehlt der Wert oder ist er keine Zahl, wird nichts geschrieben: ein erfundenes 0 W sähe wie eine frische
// Messung aus, ein alternder Zeitstempel dagegen lässt die Diagnose den toten Feed melden.

const GRID_POWER = 'javascript.0.mqtt_shelly.total_act_power';

createState(GRID_POWER, 0, {name: 'Total Active Power', type: 'number', unit: 'W', read: true, write: false});

let parseErrorLogged = false;

on({id: 'mqtt.0.shellypro3em.status.em:0', change: 'any'}, function(obj) {
    const payload = obj && obj.state ? obj.state.val : null;
    if (payload === null || payload === undefined || payload === '') return;

    let data;
    try {
        data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch (e) {
        if (!parseErrorLogged) {
            parseErrorLogged = true;
            log('Shelly 3EM: MQTT JSON nicht lesbar (weitere Fehler werden nicht geloggt): ' + e.message, 'warn');
        }
        return;
    }

    const power = data ? data.total_act_power : undefined;
    if (typeof power !== 'number' || !isFinite(power)) return;
    setState(GRID_POWER, power, true);
});
