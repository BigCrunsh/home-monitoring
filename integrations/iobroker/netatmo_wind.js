createState('wind_beaufort', 0,{
    desc: 'Windstärke auf Beaufort-Skala',
    type: 'number',
    role: 'value',
    unit: 'Bft'
});

createState('gust_beaufort', 0,{
    desc: 'Windböenstärke auf Beaufort-Skala',
    type: 'number',
    role: 'value',
    unit: 'Bft'
});

function kmhToBft(kmh) {    
    if (kmh < 2) return 0;
    if (kmh < 6) return 1;
    if (kmh < 12) return 2;
    if (kmh < 20) return 3;
    if (kmh < 29) return 4;
    if (kmh < 39) return 5;
    if (kmh < 50) return 6;
    if (kmh < 62) return 7;
    if (kmh < 75) return 8;
    if (kmh < 89) return 9;
    if (kmh < 103) return 10;
    if (kmh < 118) return 11;
    return 12
}

function getWindStrengths() {
    var gustStrength = getState('netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c.06-00-00-02-a2-5c.Wind.GustStrength').val
    var windStrength = getState('netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c.06-00-00-02-a2-5c.Wind.WindStrength').val

    setState('wind_beaufort', kmhToBft(windStrength));
    setState('gust_beaufort', kmhToBft(gustStrength));
}
 
getWindStrengths(); // Skriptstart


schedule("*/10 * * * *", getWindStrengths);  // alle 10 Minuten
