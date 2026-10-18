const suncalc = require('suncalc');

 
const latitude = 52.52003195
const longitude = 13.493240478844644

createState('moon_phase', 0, {
   type: 'number',
   min: 0,
   max: 7,
   role: 'level',
   states: {
      0: 'Neumond',
      1: 'Viertelmond zu',
      2: 'Halbmond zu',
      3: 'Dreiviertelmond zu',
      4: 'Vollmond',
      5: 'Dreiviertelmond ab',
      6: 'Halbmond ab',
      7: 'Viertelmond ab'
   }   
});

createState('sunrise', '', {type: 'string'});
createState('sunset', '', {type: 'string'});
createState('moonrise', '', {type: 'string'});
createState('moonset', '', {type: 'string'});
 
function getStats() {
   const now = new Date()
   var mond = suncalc.getMoonIllumination(now);
   var mp = mond.phase;
   var state = 0; 
   if(mp > 0.05) state = 1;
   if(mp > 0.2) state = 2;
   if(mp > 0.3) state = 3;
   if(mp > 0.45) state = 4;
   if(mp > 0.55) state = 5;
   if(mp > 0.7) state = 6;
   if(mp > 0.8) state = 7;
   if(mp > 0.95) state = 0;
   setState('moon_phase', state, true);

   const sunTimes = suncalc.getTimes(
      now,
      latitude,
      longitude,
   );
   const moonTimes = suncalc.getMoonTimes(
      now,
      latitude,
      longitude,
   );

   const hhmm = {hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'};
   // suncalc omits rise/set on days the moon never crosses the horizon
   const clock = (date) => date ? date.toLocaleString('de-DE', hhmm) : '–';
   setState('sunrise', clock(sunTimes.sunrise), true);
   setState('sunset', clock(sunTimes.sunset), true);
   setState('moonrise', clock(moonTimes.rise), true);
   setState('moonset', clock(moonTimes.set), true);
}
 
getStats(); // Skriptstart


schedule("*/10 * * * *", getStats);  // alle 10 Minuten
