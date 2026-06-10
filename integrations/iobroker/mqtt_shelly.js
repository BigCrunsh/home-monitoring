// ioBroker JavaScript: MQTT JSON Parser für Shelly Pro 3EM
// Dieses Script läuft im JavaScript Adapter

// Basis-Pfad für die Datenpunkte
const basePath = 'javascript.0.mqtt_shelly';

// Alle Datenpunkte beim Start erstellen
createState(`${basePath}.a_voltage`, 0, {name: 'Phase A Voltage', type: 'number', unit: 'V', read: true, write: false});
createState(`${basePath}.a_current`, 0, {name: 'Phase A Current', type: 'number', unit: 'A', read: true, write: false});
createState(`${basePath}.a_act_power`, 0, {name: 'Phase A Active Power', type: 'number', unit: 'W', read: true, write: false});
createState(`${basePath}.a_aprt_power`, 0, {name: 'Phase A Apparent Power', type: 'number', unit: 'VA', read: true, write: false});
createState(`${basePath}.a_pf`, 0, {name: 'Phase A Power Factor', type: 'number', read: true, write: false});
createState(`${basePath}.a_freq`, 0, {name: 'Phase A Frequency', type: 'number', unit: 'Hz', read: true, write: false});

createState(`${basePath}.b_voltage`, 0, {name: 'Phase B Voltage', type: 'number', unit: 'V', read: true, write: false});
createState(`${basePath}.b_current`, 0, {name: 'Phase B Current', type: 'number', unit: 'A', read: true, write: false});
createState(`${basePath}.b_act_power`, 0, {name: 'Phase B Active Power', type: 'number', unit: 'W', read: true, write: false});
createState(`${basePath}.b_aprt_power`, 0, {name: 'Phase B Apparent Power', type: 'number', unit: 'VA', read: true, write: false});
createState(`${basePath}.b_pf`, 0, {name: 'Phase B Power Factor', type: 'number', read: true, write: false});
createState(`${basePath}.b_freq`, 0, {name: 'Phase B Frequency', type: 'number', unit: 'Hz', read: true, write: false});

createState(`${basePath}.c_voltage`, 0, {name: 'Phase C Voltage', type: 'number', unit: 'V', read: true, write: false});
createState(`${basePath}.c_current`, 0, {name: 'Phase C Current', type: 'number', unit: 'A', read: true, write: false});
createState(`${basePath}.c_act_power`, 0, {name: 'Phase C Active Power', type: 'number', unit: 'W', read: true, write: false});
createState(`${basePath}.c_aprt_power`, 0, {name: 'Phase C Apparent Power', type: 'number', unit: 'VA', read: true, write: false});
createState(`${basePath}.c_pf`, 0, {name: 'Phase C Power Factor', type: 'number', read: true, write: false});
createState(`${basePath}.c_freq`, 0, {name: 'Phase C Frequency', type: 'number', unit: 'Hz', read: true, write: false});

createState(`${basePath}.total_current`, 0, {name: 'Total Current', type: 'number', unit: 'A', read: true, write: false});
createState(`${basePath}.total_act_power`, 0, {name: 'Total Active Power', type: 'number', unit: 'W', read: true, write: false});
createState(`${basePath}.total_aprt_power`, 0, {name: 'Total Apparent Power', type: 'number', unit: 'VA', read: true, write: false});

createState(`${basePath}.id`, 0, {name: 'ID', type: 'number', read: true, write: false});
createState(`${basePath}.n_current`, 0, {name: 'Neutral Current', type: 'number', unit: 'A', read: true, write: false});

log('Shelly Pro 3EM MQTT Parser gestartet - Datenpunkte erstellt', 'info');

// Event Handler für MQTT Updates
on({id: 'mqtt.0.shellypro3em.status.em:0', change: 'any'}, function(obj) {
    const jsonString = obj.state.val;
    
    try {
        // JSON parsen
        const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        
        // Nur Werte setzen (States existieren bereits)
        setState(`${basePath}.a_voltage`, data.a_voltage || 0, true);
        setState(`${basePath}.a_current`, data.a_current || 0, true);
        setState(`${basePath}.a_act_power`, data.a_act_power || 0, true);
        setState(`${basePath}.a_aprt_power`, data.a_aprt_power || 0, true);
        setState(`${basePath}.a_pf`, data.a_pf || 0, true);
        setState(`${basePath}.a_freq`, data.a_freq || 0, true);
        
        setState(`${basePath}.b_voltage`, data.b_voltage || 0, true);
        setState(`${basePath}.b_current`, data.b_current || 0, true);
        setState(`${basePath}.b_act_power`, data.b_act_power || 0, true);
        setState(`${basePath}.b_aprt_power`, data.b_aprt_power || 0, true);
        setState(`${basePath}.b_pf`, data.b_pf || 0, true);
        setState(`${basePath}.b_freq`, data.b_freq || 0, true);
        
        setState(`${basePath}.c_voltage`, data.c_voltage || 0, true);
        setState(`${basePath}.c_current`, data.c_current || 0, true);
        setState(`${basePath}.c_act_power`, data.c_act_power || 0, true);
        setState(`${basePath}.c_aprt_power`, data.c_aprt_power || 0, true);
        setState(`${basePath}.c_pf`, data.c_pf || 0, true);
        setState(`${basePath}.c_freq`, data.c_freq || 0, true);
        
        setState(`${basePath}.total_current`, data.total_current || 0, true);
        setState(`${basePath}.total_act_power`, data.total_act_power || 0, true);
        setState(`${basePath}.total_aprt_power`, data.total_aprt_power || 0, true);
        
        setState(`${basePath}.id`, data.id || 0, true);
        if (data.n_current !== null && data.n_current !== undefined) {
            setState(`${basePath}.n_current`, data.n_current, true);
        }
        
    } catch(e) {
        log('Fehler beim Parsen des MQTT JSON: ' + e.message, 'error');
    }
});
