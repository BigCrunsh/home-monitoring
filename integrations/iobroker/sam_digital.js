// Basis-Pfad für die Datenpunkte
var stateBasePath = 'javascript.0.sam_digital';
var tempMeasurement = 'home_monitoring.autogen.heat_temperature_celsius';
var valveMeasurement = 'home_monitoring.autogen.heat_valve_signal_percentage';

// Older rows mean the collector is down. The queries then return nothing and no state is written, so
// the state timestamps age and diagnose_v2 can flag SAM Heizung as stale.
var freshnessWindow = '30m';

// Reject implausible sensor readings (a faulty/disconnected probe reports e.g.
// -60 °C). Returns null so the dashboard shows no value instead of a fake one.
function plausibleTemp(v, lo, hi) {
    return (typeof v === 'number' && v >= lo && v <= hi) ? v : null;
}

function numberOrNull(v) {
    return typeof v === 'number' ? v : null;
}

function createNumberState(name, desc, role, unit) {
    createState(`${stateBasePath}.${name}`, null, { desc: desc, type: 'number', role: role, unit: unit });
}

createNumberState('heating_flow_temperature', 'Vorlauftemperatur VF1 (Heizkreislauf)', 'value.temperature', '°C');
createNumberState('heating_return_temperature', 'Rücklauftemperatur RüF1 (Heizkreislauf)', 'value.temperature', '°C');
createNumberState('hotwater_storage_temperature', 'Speichertemperatur SF1 (Warmwasserkreislauf)', 'value.temperature', '°C');
createNumberState('heating_valve_signal', 'Stellsignal HK1 (Heizkreislauf)', 'value', '%');
createNumberState('hotwater_valve_signal', 'Stellsignal HK2 (Warmwasserkreislauf)', 'value', '%');

function queryInfluxDB() {
    // Aktuelle Temperaturen
    sendTo(
        'influxdb.0',
        'query',
        `SELECT * FROM ${tempMeasurement} WHERE time > now() - ${freshnessWindow} ORDER BY time DESC LIMIT 1`,
        function (result) {
            if (result.error) {
                console.error(result.error);
            } else if (result.result && result.result[0] && result.result[0][0]) {
                var row = result.result[0][0];

                setState(`${stateBasePath}.heating_flow_temperature`, plausibleTemp(row.heating_flow, -5, 120), true);
                setState(`${stateBasePath}.heating_return_temperature`, plausibleTemp(row.heating_return, -5, 120), true);
                setState(`${stateBasePath}.hotwater_storage_temperature`, plausibleTemp(row.hotwater_storage, 0, 110), true);
            }
        }
    );

    // Aktuelle Ventilsignale HK1 / HK2 (measurement: heat_valve_signal_percentage)
    sendTo(
        'influxdb.0',
        'query',
        `SELECT * FROM ${valveMeasurement} WHERE time > now() - ${freshnessWindow} ORDER BY time DESC LIMIT 1`,
        function (result) {
            if (result.error) {
                console.error(result.error);
            } else if (result.result && result.result[0] && result.result[0][0]) {
                var row = result.result[0][0];

                setState(`${stateBasePath}.heating_valve_signal`, numberOrNull(row.heating), true);
                setState(`${stateBasePath}.hotwater_valve_signal`, numberOrNull(row.hotwater), true);
            }
        }
    );
}

queryInfluxDB();
schedule('*/5 * * * *', queryInfluxDB);
