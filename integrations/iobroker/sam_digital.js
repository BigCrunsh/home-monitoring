// Basis-Pfad für die Datenpunkte
var stateBasePath = 'javascript.0.sam_digital';
var tempMeasurement = 'home_monitoring.autogen.heat_temperature_celsius';
var valveMeasurement = 'home_monitoring.autogen.heat_valve_signal_percentage';

var timeWindowDays = 30

// Reject implausible sensor readings (a faulty/disconnected probe reports e.g.
// -60 °C). Returns null so the dashboard shows no value instead of a fake one.
function plausibleTemp(v, lo, hi) {
    return (typeof v === 'number' && v >= lo && v <= hi) ? v : null;
}

// --- States: Außentemperatur AF1 ---

createState(`${stateBasePath}.outdoor_temperature`, 0, {
    desc: 'Außentemperatur AF1',
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_min`, 0, {
    desc: `Minimale Außentemperatur der letzten ${timeWindowDays} Tage`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_max`, 0, {
    desc: `Maximale Außentemperatur der letzten ${timeWindowDays} Tage`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_p20`, 0, {
    desc: `20 Perzentil der Außentemperatur der letzten ${timeWindowDays} Tage`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_p50`, 0, {
    desc: `50 Perzentil der Außentemperatur der letzten ${timeWindowDays} Tage`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_p80`, 0, {
    desc: `80 Perzentil der Außentemperatur der letzten ${timeWindowDays} Tage`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

// --- States: Heizkreislauf – Vorlauftemperatur VF1 (heating_flow) ---

createState(`${stateBasePath}.heating_flow_temperature`, 0, {
    desc: 'Vorlauftemperatur VF1 (Heizkreislauf)',
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_min`, 0, {
    desc: `Minimale Vorlauftemperatur der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_max`, 0, {
    desc: `Maximale Vorlauftemperatur der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_p20`, 0, {
    desc: `20 Perzentil der Vorlauftemperatur der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_p50`, 0, {
    desc: `50 Perzentil der Vorlauftemperatur der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_p80`, 0, {
    desc: `80 Perzentil der Vorlauftemperatur der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

// --- States: Warmwasserkreislauf – Rücklauftemperatur RüF2 (hotwater_return) ---

createState(`${stateBasePath}.hotwater_return_temperature`, 0, {
    desc: 'Rücklauftemperatur RüF2 (Warmwasserkreislauf)',
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_min`, 0, {
    desc: `Minimale Rücklauftemperatur der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_max`, 0, {
    desc: `Maximale Rücklauftemperatur der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_p20`, 0, {
    desc: `20 Perzentil der Rücklauftemperatur der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_p50`, 0, {
    desc: `50 Perzentil der Rücklauftemperatur der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_p80`, 0, {
    desc: `80 Perzentil der Rücklauftemperatur der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

// --- States: Warmwasserkreislauf – Speichertemperatur SF1 (hotwater_storage) ---

createState(`${stateBasePath}.hotwater_storage_temperature`, 0, {
    desc: 'Speichertemperatur SF1 (Warmwasserkreislauf)',
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_min`, 0, {
    desc: `Minimale Speichertemperatur SF1 der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_max`, 0, {
    desc: `Maximale Speichertemperatur SF1 der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_p20`, 0, {
    desc: `20 Perzentil der  Speichertemperatur SF1 der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_p50`, 0, {
    desc: `50 Perzentil der  Speichertemperatur SF1 der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_p80`, 0, {
    desc: `80 Perzentil der  Speichertemperatur SF1 der letzten ${timeWindowDays} Tage (Warmwasserkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

// --- States: Heizkreislauf – Rücklauftemperatur RüF1 (heating_return) ---

createState(`${stateBasePath}.heating_return_temperature`, 0, {
    desc: 'Rücklauftemperatur RüF1 (Heizkreislauf)',
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_min`, 0, {
    desc: `Minimale Rücklauftemperatur RüF1 der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_max`, 0, {
    desc: `Maximale Rücklauftemperatur RüF1 der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_p20`, 0, {
    desc: `20 Perzentil der Rücklauftemperatur RüF1 der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_p50`, 0, {
    desc: `50 Perzentil der Rücklauftemperatur RüF1 der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

createState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_p80`, 0, {
    desc: `80 Perzentil der Rücklauftemperatur RüF1 der letzten ${timeWindowDays} Tage (Heizkreislauf)`,
    type: 'number',
    role: 'value.temperature',
    unit: '°C'
});

// --- States: Ventilsignale HK1 / HK2 ---

createState(`${stateBasePath}.heating_valve_signal`, 0, {
    desc: 'Stellsignal HK1 (Heizkreislauf)',
    type: 'number',
    role: 'value',
    unit: '%'
});

createState(`${stateBasePath}.hotwater_valve_signal`, 0, {
    desc: 'Stellsignal HK2 (Warmwasserkreislauf)',
    type: 'number',
    role: 'value',
    unit: '%'
});

function queryInfluxDB() {
    // Aktuelle Temperaturen
    sendTo(
        'influxdb.0',
        'query',
        `SELECT * FROM ${tempMeasurement} ORDER BY time DESC LIMIT 1`,
        function (result) {
            if (result.error) {
                console.error(result.error);
            } else if (result.result && result.result[0] && result.result[0][0]) {
                var row = result.result[0][0];

                setState(`${stateBasePath}.outdoor_temperature`, plausibleTemp(row.outdoor, -40, 55), true);
                setState(`${stateBasePath}.heating_flow_temperature`, plausibleTemp(row.heating_flow, -5, 120), true);
                setState(`${stateBasePath}.heating_return_temperature`, plausibleTemp(row.heating_return, -5, 120), true);
                setState(`${stateBasePath}.hotwater_return_temperature`, plausibleTemp(row.hotwater_return, -5, 120), true);
                setState(`${stateBasePath}.hotwater_storage_temperature`, plausibleTemp(row.hotwater_storage, 0, 110), true);
            }
        }
    );

    // Aussentemperatur Statistik 7d (field: outdoor_temperature)
    sendTo(
        'influxdb.0',
        'query',
        `SELECT MIN(outdoor) AS min_temp, MAX(outdoor) AS max_temp, PERCENTILE(outdoor, 20) AS p20_temp, PERCENTILE(outdoor, 50) AS p50_temp, PERCENTILE(outdoor, 80) AS p80_temp FROM ${tempMeasurement} WHERE time >= now() - ${timeWindowDays}d`,
        function (result) {
            if (result.error) {
                console.error(result.error);
            } else if (result.result && result.result[0] && result.result[0][0]) {
                var stats = result.result[0][0];
                setState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_min`, stats.min_temp || 0, true);
                setState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_max`, stats.max_temp || 0, true);
                setState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_p20`, stats.p20_temp || 0, true);
                setState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_p50`, stats.p50_temp || 0, true);
                setState(`${stateBasePath}.outdoor_temperature_${timeWindowDays}d_p80`, stats.p80_temp || 0, true);
            }
        }
    );

    // Vorlauftemperatur VF1 Statistik 7d (field: heating_flow)
    sendTo(
        'influxdb.0',
        'query',
        `SELECT MIN(heating_flow) AS min_temp, MAX(heating_flow) AS max_temp, PERCENTILE(heating_flow, 20) AS p20_temp, PERCENTILE(heating_flow, 50) AS p50_temp, PERCENTILE(heating_flow, 80) AS p80_temp FROM ${tempMeasurement} WHERE time >= now() - ${timeWindowDays}d`,
        function (result) {
            if (result.error) {
                console.error(result.error);
            } else if (result.result && result.result[0] && result.result[0][0]) {
                var stats = result.result[0][0];
                setState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_min`, stats.min_temp || 0, true);
                setState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_max`, stats.max_temp || 0, true);
                setState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_p20`, stats.p20_temp || 0, true);
                setState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_p50`, stats.p50_temp || 0, true);
                setState(`${stateBasePath}.heating_flow_temperature_${timeWindowDays}d_p80`, stats.p80_temp || 0, true);
            }
        }
    );

    // Rücklauftemperatur RüF2 Statistik 7d (field: hotwater_return)
    sendTo(
        'influxdb.0',
        'query',
        `SELECT MIN(hotwater_return) AS min_temp, MAX(hotwater_return) AS max_temp, PERCENTILE(hotwater_return, 20) AS p20_temp, PERCENTILE(hotwater_return, 50) AS p50_temp, PERCENTILE(hotwater_return, 80) AS p80_temp FROM ${tempMeasurement} WHERE time >= now() - ${timeWindowDays}d`,
        function (result) {
            if (result.error) {
                console.error(result.error);
            } else if (result.result && result.result[0] && result.result[0][0]) {
                var stats = result.result[0][0];
                setState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_min`, stats.min_temp || 0, true);
                setState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_max`, stats.max_temp || 0, true);
                setState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_p20`, stats.p20_temp || 0, true);
                setState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_p50`, stats.p50_temp || 0, true);
                setState(`${stateBasePath}.hotwater_return_temperature_${timeWindowDays}d_p80`, stats.p80_temp || 0, true);
            }
        }
    );

    // Speichertemperatur SF1 Statistik 7d (field: hotwater_storage)
    sendTo(
        'influxdb.0',
        'query',
        `SELECT MIN(hotwater_storage) AS min_temp, MAX(hotwater_storage) AS max_temp, PERCENTILE(hotwater_storage, 20) AS p20_temp, PERCENTILE(hotwater_storage, 50) AS p50_temp, PERCENTILE(hotwater_storage, 80) AS p80_temp FROM ${tempMeasurement} WHERE time >= now() - ${timeWindowDays}d`,
        function (result) {
            if (result.error) {
                console.error(result.error);
            } else if (result.result && result.result[0] && result.result[0][0]) {
                var stats = result.result[0][0];
                setState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_min`, stats.min_temp || 0, true);
                setState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_max`, stats.max_temp || 0, true);
                setState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_p20`, stats.p20_temp || 0, true);
                setState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_p50`, stats.p50_temp || 0, true);
                setState(`${stateBasePath}.hotwater_storage_temperature_${timeWindowDays}d_p80`, stats.p80_temp || 0, true);
            }
        }
    );

    // Rücklauftemperatur RüF1 Statistik 7d (field: heating_return)
    sendTo(
        'influxdb.0',
        'query',
        `SELECT MIN(heating_return) AS min_temp, MAX(heating_return) AS max_temp, PERCENTILE(heating_return, 20) AS p20_temp, PERCENTILE(heating_return, 50) AS p50_temp, PERCENTILE(heating_return, 80) AS p80_temp FROM ${tempMeasurement} WHERE time >= now() - ${timeWindowDays}d`,
        function (result) {
            if (result.error) {
                console.error(result.error);
            } else if (result.result && result.result[0] && result.result[0][0]) {
                var stats = result.result[0][0];
                setState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_min`, stats.min_temp || 0, true);
                setState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_max`, stats.max_temp || 0, true);
                setState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_p20`, stats.p20_temp || 0, true);
                setState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_p50`, stats.p50_temp || 0, true);
                setState(`${stateBasePath}.heating_return_temperature_${timeWindowDays}d_p80`, stats.p80_temp || 0, true);
            }
        }
    );

    // Aktuelle Ventilsignale HK1 / HK2 (measurement: heat_valve_signal_percentage)
    sendTo(
        'influxdb.0',
        'query',
        `SELECT * FROM ${valveMeasurement} ORDER BY time DESC LIMIT 1`,
        function (result) {
            if (result.error) {
                console.error(result.error);
            } else if (result.result && result.result[0] && result.result[0][0]) {
                var row = result.result[0][0];

                setState(`${stateBasePath}.heating_valve_signal`, row.heating || 0, true);
                setState(`${stateBasePath}.hotwater_valve_signal`, row.hotwater || 0, true);
            }
        }
    );
}

queryInfluxDB();
schedule('*/5 * * * *', queryInfluxDB);
