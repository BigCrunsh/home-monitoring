// Dachterrasse
createState('valve_last_activity_dachterrasse', 0,{
    desc: 'Letzte Bewässerung Modus im Dachterrasse',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_dachterrasse', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Dachterrasse',
    type: 'number',
    role: 'value',
});

// Garten
createState('valve_last_activity_garten', 0,{
    desc: 'Letzte Bewässerung Modus im Garten',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_garten', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Garten',
    type: 'number',
    role: 'value',
});

// Hochbeet
createState('valve_last_activity_hochbeet', 0,{
    desc: 'Letzte Bewässerung Modus im Hochbeet',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_hochbeet', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Hochbeet',
    type: 'number',
    role: 'value',
});

// Randbeet
createState('valve_last_activity_randbeet', 0,{
    desc: 'Letzte Bewässerung Modus im Randbeet',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_randbeet', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Randbeet',
    type: 'number',
    role: 'value',
});

// Traufkiesstreifen
createState('valve_last_activity_traufkiesstreifen', 0,{
    desc: 'Letzte Bewässerung Modus im Traufkiesstreifen',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_traufkiesstreifen', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Traufkiesstreifen',
    type: 'number',
    role: 'value',
});

// Vorgarten
createState('valve_last_activity_vorgarten', 0,{
    desc: 'Letzte Bewässerung Modus im Vorgarten',
    type: 'string',
    role: 'value',
});

createState('valve_last_activity_ts_vorgarten', 0,{
    desc: 'Zeitpunkt der letzten Bewässerung im Vorgarten',
    type: 'number',
    role: 'value',
});


function queryInfluxDBGardena() {
    sendTo('influxdb.0', 'query', "SELECT last(state), valve_name, activity FROM home_monitoring.autogen.garden_valves_activity WHERE activity != 'CLOSED' AND state = 1 GROUP BY valve_name", function (result) {
        log(result.result[0])
        if (result.error) {
            console.error(result.error);
        } else {
            for (let i = 0; i < result.result[0].length; i++) {
                const date = new Date(result.result[0][i].ts)

                // Dachterrasse
                if (result.result[0][i].valve_name === 'Dachterrasse') {
                    setState('valve_last_activity_dachterrasse', result.result[0][i].activity);
                    setState('valve_last_activity_ts_dachterrasse', result.result[0][i].ts);
                }
                // Garten
                if (result.result[0][i].valve_name === 'Garten') {
                    setState('valve_last_activity_garten', result.result[0][i].activity);
                    setState('valve_last_activity_ts_garten', result.result[0][i].ts);
                }
                // Hochbeet
                if (result.result[0][i].valve_name === 'Hochbeet') {
                    setState('valve_last_activity_hochbeet', result.result[0][i].activity);
                    setState('valve_last_activity_ts_hochbeet', result.result[0][i].ts);
                }
                // Randbeet
                if (result.result[0][i].valve_name === 'Randbeet') {
                    setState('valve_last_activity_randbeet', result.result[0][i].activity);
                    setState('valve_last_activity_ts_randbeet', result.result[0][i].ts);
                }
                // Traufkiesstreifen
                if (result.result[0][i].valve_name === 'Traufkiesstreifen') {
                    setState('valve_last_activity_traufkiesstreifen', result.result[0][i].activity);
                    setState('valve_last_activity_ts_traufkiesstreifen', result.result[0][i].ts);
                }
                // Vorgarten
                if (result.result[0][i].valve_name === 'Vorgarten') {
                    setState('valve_last_activity_vorgarten', result.result[0][i].activity);
                    setState('valve_last_activity_ts_vorgarten', result.result[0][i].ts);
                }
            }
        };
    })
}

queryInfluxDBGardena()

schedule("*/5 * * * *", queryInfluxDBGardena);
